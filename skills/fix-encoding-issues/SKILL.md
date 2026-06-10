---
name: fix-encoding-issues
required: false
description: >
  Fix UTF-8 encoding problems in Paperclip agent output on Windows.
  Use when agent responses show corrupted Vietnamese characters,
  garbled text in run logs, or mangled issue comments.
  Covers TextDecoder fixes, child process stdout encoding,
  run log store byte-range reads, and PowerShell codepage setup.
---

# Fix Encoding Issues

Operational skill for diagnosing and fixing UTF-8 encoding corruption
in Paperclip agent output, particularly on Windows where PowerShell and
Node.js child processes default to non-UTF-8 codepages.

## When to use

Trigger when the assignment reports:

- 'tieng viet bi loi', 'encoding broken', 'garbled text', 'mojibake'
- 'agent tra loi sai tieng viet', 'run log bi loi font'
- 'issue comment bi hong ky tu', 'unicode replacement characters'
- Vietnamese diacritics display as question marks, boxes, or U+FFFD
- Characters like 'D hon thnh' instead of 'Da hoan thanh'

## When NOT to use

- The user is asking about font rendering in the browser UI. This skill fixes data encoding, not CSS font issues.
- The issue is about a specific adapter's API response format, not character encoding.
- The corruption is in a file that was already saved with wrong encoding. This skill prevents future corruption; it does not recover already-lost data.
- The platform is Linux or macOS with UTF-8 locale already set. The fixes here are Windows-specific.

## Procedure

### Step 1: Identify the corruption source

Determine which layer is producing the bad bytes:

| Symptom | Likely source | File to fix |
|---------|---------------|-------------|
| Corrupted in run log `.ndjson` file | Child process stdout encoding | `packages/adapter-utils/src/server-utils.ts` |
| Corrupted in streaming adapter response | `TextDecoder` missing explicit encoding | Adapter's `execute.ts` (e.g. `packages/adapters/ollama-local/src/server/execute.ts`) |
| Corrupted when reading run log back | Byte-range read cuts multi-byte UTF-8 characters | `server/src/services/run-log-store.ts` |
| Corrupted in PowerShell command output | Windows console codepage is not UTF-8 | Spawn environment or command wrapper |

### Step 2: Fix child process stdout encoding

In `packages/adapter-utils/src/server-utils.ts`, locate `runChildProcess` and add explicit UTF-8 encoding after `spawn`:

```typescript
const child = spawn(target.command, target.args, {
  cwd: target.cwd ?? opts.cwd,
  env: mergedEnv,
  detached: process.platform !== "win32",
  shell: false,
  stdio: [opts.stdin != null ? "pipe" : "ignore", "pipe", "pipe"],
}) as ChildProcessWithEvents;

// Explicitly set UTF-8 so multi-byte characters decode correctly
child.stdout?.setEncoding("utf8");
child.stderr?.setEncoding("utf8");
```

This ensures `String(chunk)` in the `data` event handler receives a proper UTF-8 string instead of raw bytes that may be interpreted with the default Windows codepage.

### Step 3: Fix streaming adapter TextDecoder

In any adapter that reads a streaming HTTP body with `TextDecoder`, explicitly pass `"utf-8"`:

```typescript
// Before (default may vary by environment)
const decoder = new TextDecoder();

// After (explicit UTF-8)
const decoder = new TextDecoder("utf-8");
```

Example locations:
- `packages/adapters/ollama-local/src/server/execute.ts`
- Any other adapter using `response.body.getReader()` + `TextDecoder`

### Step 4: Fix run log store byte-range reads

In `server/src/services/run-log-store.ts`, update `readFileRange` to avoid cutting through multi-byte UTF-8 characters:

```typescript
async function readFileRange(filePath: string, offset: number, limitBytes: number): Promise<RunLogReadResult> {
  const stat = await fs.stat(filePath).catch(() => null);
  if (!stat) throw notFound("Run log not found");

  const start = Math.max(0, Math.min(offset, stat.size));
  const end = Math.max(start, Math.min(start + limitBytes - 1, stat.size - 1));

  if (start > end) {
    return { content: "", nextOffset: start };
  }

  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath, { start, end });
    stream.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    stream.on("error", reject);
    stream.on("end", () => resolve());
  });

  let buffer = Buffer.concat(chunks);
  const originalLength = buffer.length;
  let droppedLeading = 0;
  let droppedTrailing = 0;

  // If we started mid-file, drop leading continuation bytes (0x80-0xBF)
  // so we do not start in the middle of a multi-byte UTF-8 character.
  if (start > 0) {
    while (droppedLeading < buffer.length && (buffer[droppedLeading] & 0xC0) === 0x80) {
      droppedLeading++;
    }
  }

  // If we did not read to EOF, the last byte might be the start of a
  // multi-byte UTF-8 character whose continuation bytes lie beyond our
  // range. Drop it so we do not cut a character in half at the end.
  if (end < stat.size - 1 && buffer.length > droppedLeading) {
    const lastByte = buffer[buffer.length - 1];
    if ((lastByte & 0x80) !== 0 && (lastByte & 0xC0) !== 0x80) {
      droppedTrailing = 1;
    }
  }

  if (droppedLeading > 0 || droppedTrailing > 0) {
    buffer = buffer.slice(droppedLeading, buffer.length - droppedTrailing);
  }

  const content = buffer.toString("utf8");
  const consumedBytes = originalLength - droppedLeading - droppedTrailing;
  const nextOffset = start + consumedBytes;

  return { content, nextOffset: nextOffset < stat.size ? nextOffset : undefined };
}
```

### Step 5: Ensure Windows console codepage is UTF-8

When spawning PowerShell or Cmd on Windows, the console codepage defaults to the system OEM codepage (often 437 or 1252). Force UTF-8 (65001) before running commands that output multi-byte characters.

Option A: Prepend `chcp 65001` to PowerShell commands:

```powershell
chcp 65001 > $null
# ... rest of command that outputs Vietnamese
```

Option B: Set the `PYTHONIOENCODING` or `OutputEncoding` environment variable:

```typescript
const mergedEnv = {
  ...process.env,
  PYTHONIOENCODING: "utf-8",
  OutputEncoding: "utf8",
};
```

Option C: For Node.js child processes, the `setEncoding("utf8")` fix in Step 2 is usually sufficient. If the spawned process itself is PowerShell, also pass `-Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8"` as a preamble.

### Step 6: Verify the fix

After applying changes:

1. Rebuild affected packages:
   ```bash
   pnpm --filter @paperclipai/adapter-utils build
   pnpm --filter @paperclipai/server build
   pnpm --filter @paperclipai/ollama-local build
   ```

2. Restart the dev server:
   ```bash
   pnpm dev:stop
   pnpm dev
   ```

3. Create a test issue with Vietnamese text and run an agent heartbeat.

4. Inspect the run log `.ndjson` file directly:
   ```powershell
   Get-Content data/run-logs/.../....ndjson -Encoding UTF8 | Select-Object -Last 10
   ```

5. Confirm characters like `Đ`, `ệ`, `ư`, `ơ`, `á`, `à` appear correctly in both the raw log file and the Paperclip UI.

## Pitfalls

- **Only fixing the UI layer.** Changing the browser font or HTML meta tag does not fix corrupted bytes already written to the run log. The fix must be at the data source.
- **Forgetting to rebuild after editing adapter-utils.** `server-utils.ts` is in `adapter-utils`, which is a workspace dependency. Other packages use the compiled `dist/`. Always run `pnpm --filter @paperclipai/adapter-utils build` after editing.
- **Assuming `TextDecoder()` defaults to UTF-8.** In some Node.js or test environments, the default encoding may differ. Always pass `"utf-8"` explicitly.
- **Fixing only one adapter.** If multiple adapters stream responses (Ollama, OpenAI-compatible gateways, etc.), check each one for the same `TextDecoder` pattern.
- **Not handling the trailing byte in run log reads.** If `readFileRange` simply does `Buffer.concat(chunks).toString("utf8")`, a trailing start-byte of a multi-byte character becomes U+FFFD. The byte-dropping logic in Step 4 is required.
- **Using PowerShell `Out-File` or `Set-Content` without `-Encoding UTF8`.** When writing test files or scripts containing Vietnamese, always specify the encoding. The safest method is Python: `open(path, "w", encoding="utf-8")`.

## Verification checklist

- [ ] `child.stdout?.setEncoding("utf8")` added after `spawn` in `server-utils.ts`
- [ ] `child.stderr?.setEncoding("utf8")` added after `spawn` in `server-utils.ts`
- [ ] All streaming adapters use `new TextDecoder("utf-8")` instead of `new TextDecoder()`
- [ ] `readFileRange` in `run-log-store.ts` drops leading continuation bytes and trailing start bytes
- [ ] `nextOffset` in `readFileRange` is computed from actual consumed bytes, not `end + 1`
- [ ] Affected packages rebuilt: `adapter-utils`, `server`, and any modified adapter
- [ ] Dev server restarted after rebuild
- [ ] Test issue with Vietnamese text created and agent heartbeat run
- [ ] Raw `.ndjson` log file inspected with `Get-Content -Encoding UTF8` and shows correct characters
- [ ] Paperclip UI transcript view shows correct characters without U+FFFD or question marks
