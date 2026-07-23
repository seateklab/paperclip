import {
  getDefaultValues,
  projectValuesToSchema,
  type JsonSchemaNode,
} from "@/components/JsonSchemaForm";

export interface PluginConfigErrorState {
  fieldErrors: Record<string, string>;
  summary: string;
}

export function buildPluginConfigFormValues(
  schema: JsonSchemaNode,
  initialValues?: Record<string, unknown>,
): Record<string, unknown> {
  return projectValuesToSchema(schema, {
    ...getDefaultValues(schema),
    ...(initialValues ?? {}),
  });
}

export function getPluginConfigErrorState(error: unknown): PluginConfigErrorState {
  const fallback = error instanceof Error ? error.message : "Configuration request failed.";
  const body = isRecord(error) && isRecord(error.body) ? error.body : undefined;
  const rawFieldErrors = body?.fieldErrors;

  if (!Array.isArray(rawFieldErrors)) {
    return { fieldErrors: {}, summary: fallback || "Configuration request failed." };
  }

  const fieldErrors: Record<string, string> = {};
  const rootMessages: string[] = [];

  for (const entry of rawFieldErrors) {
    if (!isRecord(entry) || typeof entry.field !== "string" || typeof entry.message !== "string") {
      continue;
    }
    fieldErrors[entry.field] = entry.message;
    if (entry.field === "/") rootMessages.push(entry.message);
  }

  return {
    fieldErrors,
    summary: rootMessages.length > 0
      ? rootMessages.join("; ")
      : "Configuration validation failed. Review the highlighted fields.",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
