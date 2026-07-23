---
name: managed-tool-utf8-transport
description: Use when sending non-ASCII JSON to Paperclip managed plugin tools, especially from Windows PowerShell or when Unicode may become ?, U+FFFD, or mojibake.
key: paperclipai/bundled/software-development/managed-tool-utf8-transport
recommendedForRoles:
  - engineer
  - publisher
  - operator
tags:
  - utf-8
  - unicode
  - windows
  - powershell
  - paperclip
  - managed-tools
---

# Managed-tool UTF-8 transport

Use a file as the only parameter source for Paperclip managed plugin-tool
calls on Windows. PowerShell string pipelines can transcode non-ASCII text
before Node receives it; the Paperclip helper cannot recover characters that
were already changed to `?`.

## Required procedure

1. Build the complete JSON parameters value from the approved source. Do not
   regenerate, transliterate, or shorten user content.
2. Write it as BOM-less UTF-8. In Windows PowerShell, use:

   ```powershell
   $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
   [System.IO.File]::WriteAllText($parametersPath, $json, $utf8NoBom)
   ```

3. Verify the file before any external mutation:

   ```powershell
   $bytes = [System.IO.File]::ReadAllBytes($parametersPath)
   if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
     throw "Parameters file has a UTF-8 BOM"
   }
   $strictUtf8 = [System.Text.UTF8Encoding]::new($false, $true)
   $roundTrip = $strictUtf8.GetString($bytes)
   if ($roundTrip -cne $json) { throw "Parameters changed during UTF-8 file write" }
   if ($roundTrip.Contains([char]0xFFFD)) { throw "Parameters contain a replacement character" }
   ```

   Confirm that expected Vietnamese or other non-ASCII characters are still
   present. A `?` is safe only when it was present in the approved source;
   newly introduced `?`, replacement characters, or mojibake are a hard stop.

4. Invoke the bundled helper with the file. Use the actual project and managed
   tool name discovered for the current run:

   ```powershell
   node skills/paperclip/scripts/paperclip-plugin-tool.mjs execute `
     --tool <namespaced-tool-name> `
     --project-id <project-id> `
     --parameters-file $parametersPath
   ```

## Forbidden transport paths

- Never use `$json | node ...`, `ConvertTo-Json | node ...`, or any PowerShell
  string pipeline to feed the helper.
- Never use `Out-File`, `Set-Content`, or another encoding-ambiguous writer for
  the parameters file.
- Never use `--parameters-json` or `--stdin` for this Windows workflow.
- Never bypass the helper with `curl`, `Invoke-RestMethod`, raw provider HTTP,
  or a guessed connector endpoint.
- Never treat a clean-looking PowerShell console as proof of correct bytes;
  console rendering and transport bytes are separate.

If the file cannot be written, verified, or passed with `--parameters-file`,
stop and block the operation before calling a tool that can mutate external
state. Do not retry through a different shell transport.
