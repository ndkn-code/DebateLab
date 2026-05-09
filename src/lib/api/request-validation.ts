import type { NextRequest } from "next/server";

export class RequestValidationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "RequestValidationError";
    this.status = status;
  }
}

export type JsonRecord = Record<string, unknown>;

export async function readJsonObject(
  request: NextRequest,
  options: { maxBytes?: number } = {}
): Promise<JsonRecord> {
  const maxBytes = options.maxBytes ?? 64 * 1024;
  const contentLength = request.headers.get("content-length");
  const parsedLength = contentLength ? Number(contentLength) : 0;

  if (Number.isFinite(parsedLength) && parsedLength > maxBytes) {
    throw new RequestValidationError("Request body is too large.", 413);
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType && !contentType.toLowerCase().includes("application/json")) {
    throw new RequestValidationError("Expected a JSON request body.", 415);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new RequestValidationError("Invalid JSON request body.");
  }

  if (!isPlainRecord(body)) {
    throw new RequestValidationError("Expected a JSON object.");
  }

  return body;
}

export function isPlainRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function getString(
  body: JsonRecord,
  key: string,
  options: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    defaultValue?: string;
  } = {}
) {
  const value = body[key];
  if (value == null || value === "") {
    if (options.required) {
      throw new RequestValidationError(`${key} is required.`);
    }
    return options.defaultValue;
  }

  if (typeof value !== "string") {
    throw new RequestValidationError(`${key} must be a string.`);
  }

  const trimmed = value.trim();
  const minLength = options.minLength ?? 0;
  if (trimmed.length < minLength) {
    throw new RequestValidationError(`${key} is too short.`);
  }

  if (options.maxLength && trimmed.length > options.maxLength) {
    throw new RequestValidationError(`${key} is too long.`);
  }

  return trimmed;
}

export function getNumber(
  body: JsonRecord,
  key: string,
  options: {
    required?: boolean;
    min?: number;
    max?: number;
    defaultValue?: number;
  } = {}
) {
  const value = body[key];
  if (value == null || value === "") {
    if (options.required) {
      throw new RequestValidationError(`${key} is required.`);
    }
    return options.defaultValue;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RequestValidationError(`${key} must be a number.`);
  }

  if (options.min != null && value < options.min) {
    throw new RequestValidationError(`${key} is too small.`);
  }

  if (options.max != null && value > options.max) {
    throw new RequestValidationError(`${key} is too large.`);
  }

  return value;
}

export function getBoolean(
  body: JsonRecord,
  key: string,
  defaultValue?: boolean
) {
  const value = body[key];
  if (value == null) return defaultValue;
  if (typeof value !== "boolean") {
    throw new RequestValidationError(`${key} must be a boolean.`);
  }
  return value;
}

export function getEnum<T extends readonly string[]>(
  body: JsonRecord,
  key: string,
  values: T,
  options: { required?: boolean; defaultValue?: T[number] } = {}
): T[number] | undefined {
  const value = body[key];
  if (value == null || value === "") {
    if (options.required) {
      throw new RequestValidationError(`${key} is required.`);
    }
    return options.defaultValue;
  }

  if (typeof value !== "string" || !values.includes(value)) {
    throw new RequestValidationError(`${key} is invalid.`);
  }

  return value;
}

export function getJsonRecord(
  body: JsonRecord,
  key: string,
  options: { maxBytes?: number; defaultValue?: JsonRecord } = {}
) {
  const value = body[key];
  if (value == null) return options.defaultValue ?? {};
  if (!isPlainRecord(value)) {
    throw new RequestValidationError(`${key} must be an object.`);
  }

  const maxBytes = options.maxBytes ?? 8 * 1024;
  const size = JSON.stringify(value).length;
  if (size > maxBytes) {
    throw new RequestValidationError(`${key} is too large.`, 413);
  }

  return value;
}

export function getStringArray(
  value: unknown,
  key: string,
  options: { maxItems: number; maxItemLength: number }
) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > options.maxItems) {
    throw new RequestValidationError(`${key} is invalid.`);
  }

  return value.map((item) => {
    if (typeof item !== "string") {
      throw new RequestValidationError(`${key} contains a non-string value.`);
    }
    const trimmed = item.trim();
    if (trimmed.length > options.maxItemLength) {
      throw new RequestValidationError(`${key} contains a value that is too long.`);
    }
    return trimmed;
  });
}

export function normalizeSearchTerm(value: string, maxLength = 80) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function isUuid(value: string | null | undefined) {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value
      )
  );
}
