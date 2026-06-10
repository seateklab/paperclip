---
name: seatek-image-generation
required: false
description: >
  Generate AI images using SeaTek Lab Image Generation API from within Paperclip.
  Use when an agent needs to create images from text prompts, thumbnails,
  illustrations, or any visual asset for a task or issue.
  API gateway: https://api.ai.seateklab.vn/v1/ka.
---

# SeaTek Image Generation

Operational skill for generating AI images from Paperclip via the SeaTek Lab API.
This skill provides the API contract, reference implementation, and integration
patterns. It does not auto-generate images; it instructs the agent on how to
implement and call the API correctly.

## When to use

Trigger when the assignment asks for:

- 'tao anh', 'generate image', 've anh', 'tao hinh minh hoa'
- 'tao thumbnail cho issue', 'generate banner', 'tao anh AI'
- Integrating SeaTek Lab Image Generation into a Paperclip workflow

## When NOT to use

- The user wants to upload an existing image. This skill only generates new images.
- As a replacement for asset storage. Generated images return URLs; long-term storage still uses the Paperclip asset system.
- No network access is available or the SeaTek Lab API key is not accessible. This is an external dependency blocker.

## Procedure

### Step 1: Choose integration layer

| Layer | Use when |
|-------|----------|
| **Plugin** (`packages/plugins/`) | **Default recommendation.** Externalize logic, enable/disable via plugin manager. Agents call it as a tool. |
| **Server service** (`server/src/services/`) | Generate images from business logic (issue created, milestone reached). |
| **Adapter layer** (`packages/adapters/`) | Generate images within the agent lifecycle. Less common. |

### Step 2: Implement the plugin worker

Create `src/worker.ts` in the plugin package:

```typescript
import { definePlugin, runWorker, type ToolResult } from "@paperclipai/plugin-sdk";

const PLUGIN_ID = "paperclip.seatek-image";

const API_BASE = "https://api.ai.seateklab.vn/v1/ka";
const GENERATE_ENDPOINT = `${API_BASE}/generate/image`;
const STATUS_ENDPOINT = `${API_BASE}/record-info`;

const AUTH_HEADERS = {
  "x-client-id": "69c61b6522d86d99e867a4ae",
  "x-workspace-id": "69c61b6722d86d99e867a4b2",
  "x-app-id": "9f8c7e5a-1234-4d3b-9876-abcdef123456",
  "x-api-key": "sk_c34729537897f0873d379640a53adc9e2830c7781312b0ecc4cfb639ce3947c5",
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function submitGeneration(body: {
  model: string;
  input: { prompt: string; aspect_ratio: string; resolution: string; output_format: string };
}) {
  const response = await fetch(GENERATE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...AUTH_HEADERS },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`SeaTek API ${response.status}`);
  const json = await response.json();
  if (!json.status || !json.data?.taskId) {
    throw new Error(`SeaTek error: ${json.message}`);
  }
  return { taskId: json.data.taskId, initialData: json.data };
}

async function checkStatus(taskId: string) {
  const response = await fetch(`${STATUS_ENDPOINT}/${encodeURIComponent(taskId)}`, {
    headers: AUTH_HEADERS,
  });
  if (!response.ok) throw new Error(`Status API ${response.status}`);
  const json = await response.json();
  if (!json.status) throw new Error(`Status error: ${json.message}`);
  if (json.data?.resultUrls?.length > 0) return json.data;
  return null;
}

async function pollForResult(
  taskId: string,
  maxWaitSeconds: number,
  pollIntervalSeconds: number,
  logger: { info: (msg: string) => void; error: (msg: string) => void },
) {
  const deadline = Date.now() + maxWaitSeconds * 1000;
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt++;
    logger.info(`[${PLUGIN_ID}] Polling ${taskId} (attempt ${attempt})...`);
    const data = await checkStatus(taskId);
    if (data) {
      logger.info(`[${PLUGIN_ID}] Task ${taskId} completed.`);
      return data;
    }
    await sleep(pollIntervalSeconds * 1000);
  }
  throw new Error(`Timed out after ${maxWaitSeconds}s. Task: ${taskId}`);
}

const plugin = definePlugin({
  async setup(ctx) {
    ctx.logger.info(`${PLUGIN_ID} plugin setup complete`);

    ctx.tools.register(
      "generate-image",
      {
        displayName: "Generate Image",
        description:
          "Generate an image from a text prompt using SeaTek AI. " +
          "Submits a generation request and polls until the result is ready. " +
          "Returns the URL(s) of the generated image(s).",
        parametersSchema: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "Text prompt describing the image" },
            model: { type: "string", description: "Model to use", default: "standard" },
            aspect_ratio: { type: "string", description: "Aspect ratio", default: "auto" },
            resolution: { type: "string", description: "Resolution", default: "1K" },
            output_format: { type: "string", description: "Output format", default: "jpg" },
            maxWaitSeconds: {
              type: "number",
              description: "Maximum seconds to wait for completion",
              minimum: 10,
              maximum: 600,
              default: 120,
            },
            pollIntervalSeconds: {
              type: "number",
              description: "Seconds between status checks",
              minimum: 2,
              maximum: 60,
              default: 5,
            },
          },
          required: ["prompt"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { prompt, model, aspect_ratio, resolution, output_format, maxWaitSeconds, pollIntervalSeconds } =
          params as Record<string, unknown>;
        if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
          return { error: "prompt is required" };
        }

        try {
          const { taskId, initialData } = await submitGeneration({
            model: typeof model === "string" ? model : "standard",
            input: {
              prompt: prompt.trim(),
              aspect_ratio: typeof aspect_ratio === "string" ? aspect_ratio : "auto",
              resolution: typeof resolution === "string" ? resolution : "1K",
              output_format: typeof output_format === "string" ? output_format : "jpg",
            },
          });

          if (initialData?.resultUrls?.length > 0) {
            return {
              content: `Image generated\n\nTask ID: ${taskId}\nURLs:\n${initialData.resultUrls.map((u: string) => `- ${u}`).join("\n")}`,
              data: initialData,
            };
          }

          const result = await pollForResult(
            taskId,
            Math.min(Math.max(typeof maxWaitSeconds === "number" ? maxWaitSeconds : 120, 10), 600),
            Math.min(Math.max(typeof pollIntervalSeconds === "number" ? pollIntervalSeconds : 5, 2), 60),
            ctx.logger,
          );

          return {
            content: `Image generated\n\nTask ID: ${taskId}\nModel: ${result.model}\nCost time: ${result.costTime}s\n\nURLs:\n${result.resultUrls.map((u: string) => `- ${u}`).join("\n")}`,
            data: result,
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          ctx.logger.error(`[${PLUGIN_ID}] Failed: ${message}`);
          return { error: `Image generation failed: ${message}` };
        }
      },
    );
  },

  async onHealth() {
    return { status: "ok", message: "SeaTek Image Generation ready" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
```

### Step 3: Configure package.json

```json
{
  "name": "@paperclipai/plugin-seatek-image",
  "version": "1.0.0",
  "description": "Paperclip plugin for SeaTek AI image generation",
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "paperclipPlugin": {
    "manifest": "./dist/manifest.js",
    "worker": "./dist/worker.js"
  },
  "scripts": {
    "prebuild": "pnpm --filter @paperclipai/plugin-sdk ensure-build-deps",
    "build": "tsc",
    "clean": "rm -rf dist",
    "typecheck": "pnpm --filter @paperclipai/plugin-sdk ensure-build-deps && tsc --noEmit"
  },
  "dependencies": {
    "@paperclipai/plugin-sdk": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^24.6.0",
    "typescript": "^5.7.3"
  }
}
```

### Step 4: Build and install

```bash
# In the plugin directory
pnpm install
pnpm build

# In the Paperclip instance
paperclipai plugin install /absolute/path/to/plugin-seatek-image

# Verify
paperclipai plugin list
paperclipai plugin inspect paperclip.seatek-image
```

After installation, agents can call the tool:

```
generate-image(prompt="A futuristic city at night with neon lights")
```

### API Contract Reference

#### Endpoints

| Purpose | Method | URL |
|---------|--------|-----|
| Submit generation | POST | `https://api.ai.seateklab.vn/v1/ka/generate/image` |
| Check status | GET | `https://api.ai.seateklab.vn/v1/ka/record-info/{taskId}` |

#### Headers (Required)

| Header | Value |
|--------|-------|
| Content-Type | application/json |
| x-client-id | 69c61b6522d86d99e867a4ae |
| x-workspace-id | 69c61b6722d86d99e867a4b2 |
| x-app-id | 9f8c7e5a-1234-4d3b-9876-abcdef123456 |
| x-api-key | sk_c34729537897f0873d379640a53adc9e2830c7781312b0ecc4cfb639ce3947c5 |

#### Request Body (Generate)

```json
{
  "model": "standard",
  "input": {
    "prompt": "A serene sunset over the ocean with golden clouds",
    "aspect_ratio": "auto",
    "resolution": "1K",
    "output_format": "jpg"
  }
}
```

#### Parameters

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| model | string | No | "standard" | Generation model |
| input.prompt | string | Yes | — | Text prompt describing the image |
| input.aspect_ratio | string | No | "auto" | Aspect ratio |
| input.resolution | string | No | "1K" | Resolution |
| input.output_format | string | No | "jpg" | Output format |

#### Response (Generate)

```json
{
  "status": true,
  "statusCode": 200,
  "message": "Success",
  "data": {
    "taskId": "<task-id>",
    "type": "image",
    "success": true,
    "resultUrls": ["https://..."],
    "model": "standard",
    "costTime": 12.5
  }
}
```

- `resultUrls` present and non-empty: task completed.
- `resultUrls` empty or null: task still processing, poll again.

## Pitfalls

- **Hardcoding the API key in source.** The example key is a demo key. In production, inject it via environment variable or the Paperclip secret system. Never commit production keys.
- **Not polling long enough.** Image generation can take 30-120 seconds. The default `maxWaitSeconds` is 120; increase it for complex prompts or high resolution.
- **Assuming synchronous completion.** The SeaTek API is async. Always check `resultUrls` in the initial response; if absent, poll until timeout or completion.
- **Using the result URL as permanent storage.** `resultUrls` are temporary public URLs. For long-term storage, download the image and upload it to the Paperclip asset system.
- **Missing error handling on status checks.** The status endpoint can return HTTP 200 with `status: false` if the task failed server-side. Always check `json.status` before accessing `json.data`.

## Verification checklist

- [ ] Frontmatter has `name`, `required`, and `description` with folded scalar `>`
- [ ] All 5 main sections exist: When to use, When NOT to use, Procedure, Pitfalls, Verification
- [ ] No emojis anywhere in the file
- [ ] Code blocks have info strings (`typescript`, `json`, `bash`)
- [ ] Folder name is kebab-case and matches `name` in frontmatter
- [ ] API key is marked as demo-only and not suitable for production
- [ ] Polling logic handles both immediate completion and async tasks
- [ ] Error handling covers API errors, timeouts, and missing resultUrls
