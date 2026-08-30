import type {
  SandboxConversionRequest,
  SandboxConversionResult,
} from "./contracts";

export class SandboxConfigurationError extends Error {
  constructor(message = "Material conversion is not configured.") {
    super(message);
    this.name = "SandboxConfigurationError";
  }
}

export class SandboxConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SandboxConversionError";
  }
}

export type MaterialSandboxAdapter = {
  convert(request: SandboxConversionRequest): Promise<SandboxConversionResult>;
};

function sandboxConfig() {
  const endpoint = process.env.VERCEL_SANDBOX_API_URL?.trim();
  const token = process.env.VERCEL_SANDBOX_TOKEN?.trim();
  if (!endpoint || !token) {
    throw new SandboxConfigurationError(
      "VERCEL_SANDBOX_API_URL and VERCEL_SANDBOX_TOKEN are required; conversion fails closed.",
    );
  }
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new SandboxConfigurationError(
      "VERCEL_SANDBOX_API_URL must be an absolute URL.",
    );
  }
  if (url.protocol !== "https:" && process.env.NODE_ENV === "production") {
    throw new SandboxConfigurationError(
      "Production Sandbox endpoint must use HTTPS.",
    );
  }
  return { endpoint: url.toString().replace(/\/$/, ""), token };
}

/**
 * Thin boundary around the Sandbox conversion service. The application never
 * executes uploaded content in a Vercel function. The adapter accepts a short
 * lived signed source URL and returns normalized text only.
 */
export function createVercelSandboxAdapter(
  fetchImpl: typeof fetch = fetch,
): MaterialSandboxAdapter {
  return {
    async convert(request) {
      const config = sandboxConfig();
      const response = await fetchImpl(
        `${config.endpoint}/v1/material-conversions`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${config.token}`,
            "content-type": "application/json",
            "x-material-id": request.materialId,
            "x-material-version-id": request.versionId,
          },
          body: JSON.stringify({
            sourceUrl: request.sourceUrl,
            mimeType: request.mimeType,
            fileName: request.fileName,
            output: "normalized_text",
          }),
          signal: AbortSignal.timeout(30_000),
        },
      );
      if (!response.ok) {
        throw new SandboxConversionError(
          `Sandbox conversion failed (${response.status}).`,
        );
      }
      const body: unknown = await response.json();
      if (
        !body ||
        typeof body !== "object" ||
        typeof (body as { text?: unknown }).text !== "string"
      ) {
        throw new SandboxConversionError(
          "Sandbox returned an invalid conversion result.",
        );
      }
      const result = body as SandboxConversionResult;
      if (result.text.length > 10_000_000)
        throw new SandboxConversionError(
          "Sandbox result exceeded the conversion limit.",
        );
      return result;
    },
  };
}

export function createFakeSandboxAdapter(
  result: SandboxConversionResult = { text: "deterministic preview" },
): MaterialSandboxAdapter {
  return { convert: async () => result };
}
