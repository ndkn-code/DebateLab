import { OTLPHttpProtoTraceExporter, registerOTel } from "@vercel/otel";
import { getGrafanaOtlpConfig } from "@/lib/observability/grafana-otel-config";

const SERVICE_NAME = "thinkfy-web";


export function register() {
  const grafana = getGrafanaOtlpConfig();
  const environment =
    process.env.VERCEL_ENV?.trim() ||
    process.env.NEXT_PUBLIC_VERCEL_ENV?.trim() ||
    process.env.NODE_ENV ||
    "development";

  // registerOTel preserves Vercel's built-in telemetry exporter and automatic
  // fetch instrumentation. The custom exporter is additive and only present
  // after both Grafana credentials have been configured.
  registerOTel({
    serviceName: SERVICE_NAME,
    attributes: {
      "deployment.environment.name": environment,
      "service.namespace": "thinkfy",
    },
    // `auto` includes W3C tracecontext, baggage, and Vercel's runtime
    // propagator. Do not replace it with a custom propagator.
    propagators: ["auto"],
    ...(grafana
      ? {
          traceExporter: new OTLPHttpProtoTraceExporter(grafana),
        }
      : {}),
  });
}
