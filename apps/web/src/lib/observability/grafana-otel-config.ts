export type InstrumentationEnv = Record<string, string | undefined>;

export type GrafanaOtlpConfig = {
  url: string;
  headers: { Authorization: string };
};

export function getGrafanaOtlpConfig(
  env: InstrumentationEnv = process.env,
): GrafanaOtlpConfig | null {
  const endpoint = env.GRAFANA_OTLP_TRACES_ENDPOINT?.trim();
  const authorization = env.GRAFANA_OTLP_AUTH_HEADER?.trim();
  if (!endpoint || !authorization) return null;

  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    return null;
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    !parsed.pathname.endsWith("/v1/traces")
  ) {
    return null;
  }
  if (!/^(Basic|Bearer)\s+\S+$/i.test(authorization)) return null;
  return { url: parsed.toString(), headers: { Authorization: authorization } };
}
