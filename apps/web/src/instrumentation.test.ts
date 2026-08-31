import test from "node:test";
import assert from "node:assert/strict";

import { getGrafanaOtlpConfig } from "./lib/observability/grafana-otel-config";

test("Grafana exporter stays disabled when credentials are absent", () => {
  assert.equal(
    getGrafanaOtlpConfig({
      GRAFANA_OTLP_TRACES_ENDPOINT: "https://otlp.grafana.net/otlp/v1/traces",
    }),
    null,
  );
  assert.equal(
    getGrafanaOtlpConfig({
      GRAFANA_OTLP_AUTH_HEADER: "Basic secret",
    }),
    null,
  );
});

test("Grafana exporter accepts a complete HTTPS OTLP configuration", () => {
  assert.deepEqual(
    getGrafanaOtlpConfig({
      GRAFANA_OTLP_TRACES_ENDPOINT:
        "https://otlp.grafana.net/otlp/v1/traces",
      GRAFANA_OTLP_AUTH_HEADER: "Basic instance-token",
    }),
    {
      url: "https://otlp.grafana.net/otlp/v1/traces",
      headers: { Authorization: "Basic instance-token" },
    },
  );
});

test("Grafana exporter rejects insecure or incomplete endpoints", () => {
  assert.equal(
    getGrafanaOtlpConfig({
      GRAFANA_OTLP_TRACES_ENDPOINT: "http://localhost:4318/v1/traces",
      GRAFANA_OTLP_AUTH_HEADER: "Basic local",
    }),
    null,
  );
  assert.equal(
    getGrafanaOtlpConfig({
      GRAFANA_OTLP_TRACES_ENDPOINT: "https://otlp.grafana.net/otlp",
      GRAFANA_OTLP_AUTH_HEADER: "Basic local",
    }),
    null,
  );
});
