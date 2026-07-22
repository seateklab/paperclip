#!/usr/bin/env node

import fs from "node:fs/promises";

class HelperError extends Error {
  constructor(code, message, status = null) {
    super(message);
    this.name = "HelperError";
    this.code = code;
    this.status = status;
  }
}

function parseArgs(argv) {
  const [action, ...rest] = argv;
  if (action !== "list" && action !== "execute") {
    throw new HelperError("usage", "Action must be list or execute.");
  }

  const options = { action };
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (token === "--stdin") {
      options.stdin = true;
      continue;
    }
    if (!token.startsWith("--")) {
      throw new HelperError("usage", `Unexpected argument for ${action}.`);
    }
    const key = token.slice(2).replaceAll("-", "_");
    const value = rest[index + 1];
    if (!value || value.startsWith("--")) {
      throw new HelperError("usage", `Missing value for ${token}.`);
    }
    options[key] = value;
    index += 1;
  }
  return options;
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new HelperError("missing_configuration", `${name} is required.`);
  return value;
}

function apiUrlFor(pathname) {
  const base = requiredEnv("PAPERCLIP_API_URL");
  return new URL(pathname, `${base.replace(/\/+$/, "")}/`).toString();
}

function authHeaders() {
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${requiredEnv("PAPERCLIP_API_KEY")}`,
  };
  const runId = process.env.PAPERCLIP_RUN_ID?.trim();
  if (runId) headers["X-Paperclip-Run-Id"] = runId;
  return headers;
}

async function requestJson(method, pathname, body) {
  const headers = authHeaders();
  const request = { method, headers };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json; charset=utf-8";
    request.body = Buffer.from(JSON.stringify(body), "utf8");
  }

  let response;
  try {
    response = await fetch(apiUrlFor(pathname), request);
  } catch {
    throw new HelperError("network_error", "Paperclip API request could not be completed.");
  }

  let parsed = null;
  try {
    const text = await response.text();
    parsed = text ? JSON.parse(text) : null;
  } catch {
    throw new HelperError("invalid_json_response", "Paperclip API returned invalid JSON.", response.status);
  }

  if (!response.ok) {
    throw new HelperError("paperclip_api_error", "Paperclip API rejected the request.", response.status);
  }
  return parsed;
}

async function readStdinJson() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new HelperError("invalid_parameters", "Parameters from stdin are not valid JSON.");
  }
}

async function readParameters(options) {
  const sources = [options.parameters_json, options.parameters_file, options.stdin].filter(Boolean);
  if (sources.length > 1) {
    throw new HelperError("usage", "Choose only one parameters source.");
  }
  if (options.parameters_json) {
    try {
      return JSON.parse(options.parameters_json);
    } catch {
      throw new HelperError("invalid_parameters", "The parameters JSON is invalid.");
    }
  }
  if (options.parameters_file) {
    try {
      return JSON.parse(await fs.readFile(options.parameters_file, "utf8"));
    } catch {
      throw new HelperError("invalid_parameters", "The parameters file is missing or invalid JSON.");
    }
  }
  if (options.stdin) return readStdinJson();
  return {};
}

async function resolveProjectId(options) {
  const configured = options.project_id?.trim() || process.env.PAPERCLIP_PROJECT_ID?.trim();
  if (configured) return configured;
  const taskId = process.env.PAPERCLIP_TASK_ID?.trim();
  if (!taskId) {
    throw new HelperError("missing_project", "Provide --project-id or PAPERCLIP_PROJECT_ID/PAPERCLIP_TASK_ID.");
  }
  const issue = await requestJson("GET", `/api/issues/${encodeURIComponent(taskId)}`);
  const projectId = typeof issue?.projectId === "string" ? issue.projectId.trim() : "";
  if (!projectId) throw new HelperError("missing_project", "The current Paperclip task has no projectId.");
  return projectId;
}

async function run(options) {
  requiredEnv("PAPERCLIP_AGENT_ID");
  requiredEnv("PAPERCLIP_COMPANY_ID");
  if (options.action === "list") {
    const query = options.plugin_id ? `?pluginId=${encodeURIComponent(options.plugin_id)}` : "";
    return requestJson("GET", `/api/plugins/tools${query}`);
  }

  const tool = options.tool?.trim();
  if (!tool) throw new HelperError("usage", "--tool is required for execute.");
  const projectId = await resolveProjectId(options);
  const parameters = await readParameters(options);
  return requestJson("POST", "/api/plugins/tools/execute", {
    tool,
    parameters,
    runContext: {
      agentId: requiredEnv("PAPERCLIP_AGENT_ID"),
      runId: requiredEnv("PAPERCLIP_RUN_ID"),
      companyId: requiredEnv("PAPERCLIP_COMPANY_ID"),
      projectId,
    },
  });
}

try {
  const result = await run(parseArgs(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify({ ok: true, data: result })}\n`);
} catch (error) {
  const helperError = error instanceof HelperError
    ? error
    : new HelperError("unexpected_error", "Paperclip plugin-tool helper failed.");
  process.stdout.write(`${JSON.stringify({
    ok: false,
    error: {
      code: helperError.code,
      status: helperError.status,
      message: helperError.message,
    },
  })}\n`);
  process.exitCode = 1;
}
