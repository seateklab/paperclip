import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "paperclip-plugin-tool.mjs");
const servers = new Set();

afterEach(async () => {
  await Promise.all([...servers].map((server) => new Promise((resolve) => server.close(resolve))));
  servers.clear();
});

function startServer(handler) {
  const server = http.createServer(handler);
  servers.add(server);
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("missing server address"));
      resolve({ server, url: `http://127.0.0.1:${address.port}` });
    });
  });
}

function run(args, env, input = "") {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: path.resolve("."),
      env: { ...process.env, ...env },
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(input);
  });
}

test("executes a plugin tool with UTF-8 parameters and an env-derived run context", async () => {
  const requests = [];
  const { url } = await startServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    requests.push({
      method: request.method,
      path: request.url,
      headers: request.headers,
      body: Buffer.concat(chunks).toString("utf8"),
    });
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ pluginId: "seatek.noto", result: { content: "Đã gửi bài viết tiếng Việt" } }));
  });

  const result = await run(
    ["execute", "--tool", "seatek.noto:execute_connection_function", "--project-id", "project-1", "--stdin"],
    {
      PAPERCLIP_API_URL: url,
      PAPERCLIP_API_KEY: "run-secret",
      PAPERCLIP_AGENT_ID: "agent-1",
      PAPERCLIP_COMPANY_ID: "company-1",
      PAPERCLIP_RUN_ID: "run-1",
    },
    JSON.stringify({ input: { message: "Đăng bài tiếng Việt đầy đủ" } }),
  );

  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    ok: true,
    data: { pluginId: "seatek.noto", result: { content: "Đã gửi bài viết tiếng Việt" } },
  });
  assert.equal(requests[0].headers.authorization, "Bearer run-secret");
  assert.equal(requests[0].headers["x-paperclip-run-id"], "run-1");
  assert.match(requests[0].headers["content-type"], /application\/json;\s*charset=utf-8/i);
  assert.deepEqual(JSON.parse(requests[0].body), {
    tool: "seatek.noto:execute_connection_function",
    parameters: { input: { message: "Đăng bài tiếng Việt đầy đủ" } },
    runContext: {
      agentId: "agent-1",
      runId: "run-1",
      companyId: "company-1",
      projectId: "project-1",
    },
  });
});

test("resolves projectId from the current task before executing", async () => {
  const requests = [];
  const { url } = await startServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    requests.push({ method: request.method, path: request.url, body: Buffer.concat(chunks).toString("utf8") });
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(request.url === "/api/issues/task-1"
      ? JSON.stringify({ projectId: "project-from-task" })
      : JSON.stringify({ ok: true }));
  });

  const result = await run(
    ["execute", "--tool", "demo:tool", "--stdin"],
    {
      PAPERCLIP_API_URL: url,
      PAPERCLIP_API_KEY: "run-secret",
      PAPERCLIP_AGENT_ID: "agent-1",
      PAPERCLIP_COMPANY_ID: "company-1",
      PAPERCLIP_RUN_ID: "run-1",
      PAPERCLIP_TASK_ID: "task-1",
    },
    "{}",
  );

  assert.equal(result.code, 0, result.stderr);
  assert.equal(requests[0].path, "/api/issues/task-1");
  assert.deepEqual(JSON.parse(requests[1].body).runContext.projectId, "project-from-task");
});

test("returns structured errors without leaking the API key or retrying", async () => {
  let calls = 0;
  const { url } = await startServer(async (_request, response) => {
    calls += 1;
    response.writeHead(502, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "provider secret should not be surfaced" }));
  });

  const result = await run(
    ["execute", "--tool", "demo:tool", "--project-id", "project-1", "--stdin"],
    {
      PAPERCLIP_API_URL: url,
      PAPERCLIP_API_KEY: "run-secret",
      PAPERCLIP_AGENT_ID: "agent-1",
      PAPERCLIP_COMPANY_ID: "company-1",
      PAPERCLIP_RUN_ID: "run-1",
    },
    "{}",
  );

  assert.equal(result.code, 1);
  assert.equal(calls, 1);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.ok, false);
  assert.equal(parsed.error.status, 502);
  assert.equal(result.stdout.includes("run-secret"), false);
  assert.equal(result.stdout.includes("provider secret"), false);
});

test("preserves actual Vietnamese code points in the JSON byte round trip", async () => {
  const expected = "\u0110\u0103ng b\u00e0i ti\u1ebfng Vi\u1ec7t \u0111\u1ea7y \u0111\u1ee7";
  let received = null;
  const { url } = await startServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    received = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ echoed: received.parameters.input.message }));
  });

  const result = await run(
    ["execute", "--tool", "demo:tool", "--project-id", "project-1", "--stdin"],
    {
      PAPERCLIP_API_URL: url,
      PAPERCLIP_API_KEY: "run-secret",
      PAPERCLIP_AGENT_ID: "agent-1",
      PAPERCLIP_COMPANY_ID: "company-1",
      PAPERCLIP_RUN_ID: "run-1",
    },
    JSON.stringify({ input: { message: expected } }),
  );

  assert.equal(result.code, 0, result.stderr);
  assert.equal(received.parameters.input.message, expected);
  assert.equal(JSON.parse(result.stdout).data.echoed, expected);
});

test("preserves actual Vietnamese code points from a UTF-8 parameters file", async () => {
  const expected = "\u0110\u0103ng b\u00e0i ti\u1ebfng Vi\u1ec7t \u0111\u1ea7y \u0111\u1ee7";
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-plugin-tool-"));
  const parametersPath = path.join(tempDir, "parameters.json");
  await fs.writeFile(parametersPath, Buffer.from(JSON.stringify({ input: { message: expected } }), "utf8"));

  try {
    let received = null;
    const { url } = await startServer(async (request, response) => {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      received = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ echoed: received.parameters.input.message }));
    });

    const result = await run(
      ["execute", "--tool", "demo:tool", "--project-id", "project-1", "--parameters-file", parametersPath],
      {
        PAPERCLIP_API_URL: url,
        PAPERCLIP_API_KEY: "run-secret",
        PAPERCLIP_AGENT_ID: "agent-1",
        PAPERCLIP_COMPANY_ID: "company-1",
        PAPERCLIP_RUN_ID: "run-1",
      },
    );

    assert.equal(result.code, 0, result.stderr);
    assert.equal(received.parameters.input.message, expected);
    assert.equal(JSON.parse(result.stdout).data.echoed, expected);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
