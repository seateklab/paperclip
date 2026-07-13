import { Buffer } from "node:buffer";

export function toUtf8TextChunk(chunk: unknown): string {
  if (typeof chunk === "string") return chunk;
  if (Buffer.isBuffer(chunk)) return chunk.toString("utf8");
  if (ArrayBuffer.isView(chunk)) {
    return Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength).toString("utf8");
  }
  if (chunk instanceof ArrayBuffer) {
    return Buffer.from(chunk).toString("utf8");
  }
  return String(chunk);
}
