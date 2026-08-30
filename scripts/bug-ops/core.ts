export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface BugOpsEnvironment {
  CLICKUP_API_TOKEN?: string;
  CLICKUP_BUG_LIST_ID?: string;
  GRAFANA_URL?: string;
  GRAFANA_SERVICE_ACCOUNT_TOKEN?: string;
  GRAFANA_LOKI_DATASOURCE_UID?: string;
}

export interface ClickUpTask {
  id: string;
  name: string;
  status?: { status?: string };
  priority?: { priority?: string } | null;
  url?: string;
  date_updated?: string;
}

export interface GrafanaQueryOptions {
  expression: string;
  fromMs: number;
  toMs: number;
  limit?: number;
  datasourceUid?: string;
}

const REQUEST_TIMEOUT_MS = 15_000;

function required(value: string | undefined, name: string): string {
  if (!value?.trim()) throw new Error(`Missing required environment variable: ${name}`);
  return value.trim();
}

function safeBaseUrl(value: string, name: string): string {
  const url = new URL(value);
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !local) {
    throw new Error(`${name} must use HTTPS (localhost is allowed for tests)`);
  }
  return url.toString().replace(/\/$/, "");
}

async function requestJson(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
): Promise<JsonValue> {
  const response = await fetchImpl(url, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await response.text();
  let body: JsonValue = null;
  if (text) {
    try {
      body = JSON.parse(text) as JsonValue;
    } catch {
      body = { message: text.slice(0, 500) };
    }
  }
  if (!response.ok) {
    const retryAfter = response.headers.get("retry-after");
    throw new Error(
      `Request failed (${response.status})${retryAfter ? `; retry after ${retryAfter}s` : ""}: ${JSON.stringify(body)}`,
    );
  }
  return body;
}

export class ClickUpClient {
  private readonly token: string;
  private readonly listId: string;

  constructor(
    env: BugOpsEnvironment,
    private readonly fetchImpl: FetchLike = fetch,
  ) {
    this.token = required(env.CLICKUP_API_TOKEN, "CLICKUP_API_TOKEN");
    this.listId = required(env.CLICKUP_BUG_LIST_ID, "CLICKUP_BUG_LIST_ID");
  }

  private request(path: string, init: RequestInit = {}): Promise<JsonValue> {
    return requestJson(this.fetchImpl, `https://api.clickup.com/api/v2${path}`, {
      ...init,
      headers: {
        Authorization: this.token,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
  }

  async list(status = "Ready for Agent", limit = 20): Promise<ClickUpTask[]> {
    const params = new URLSearchParams({
      include_closed: "false",
      order_by: "priority",
      reverse: "false",
      subtasks: "true",
    });
    params.append("statuses[]", status);
    const body = (await this.request(`/list/${encodeURIComponent(this.listId)}/task?${params}`)) as {
      tasks?: ClickUpTask[];
    };
    return (body.tasks ?? []).slice(0, Math.max(1, Math.min(limit, 100)));
  }

  async get(taskId: string): Promise<ClickUpTask> {
    return (await this.request(`/task/${encodeURIComponent(taskId)}`)) as unknown as ClickUpTask;
  }

  async claim(taskId: string): Promise<ClickUpTask> {
    const before = await this.get(taskId);
    const status = before.status?.status;
    if (status !== "Ready for Agent") {
      throw new Error(`Task ${taskId} is not claimable; current status is ${status ?? "unknown"}`);
    }
    await this.request(`/task/${encodeURIComponent(taskId)}`, {
      method: "PUT",
      body: JSON.stringify({ status: "Agent Working" }),
    });
    const claimed = await this.get(taskId);
    if (claimed.status?.status !== "Agent Working") {
      throw new Error(`Task ${taskId} claim could not be verified`);
    }
    return claimed;
  }

  async update(
    taskId: string,
    options: { status?: string; comment?: string },
  ): Promise<ClickUpTask> {
    if (!options.status && !options.comment) {
      throw new Error("update requires --status and/or --comment");
    }
    if (options.status) {
      await this.request(`/task/${encodeURIComponent(taskId)}`, {
        method: "PUT",
        body: JSON.stringify({ status: options.status }),
      });
    }
    if (options.comment) {
      await this.request(`/task/${encodeURIComponent(taskId)}/comment`, {
        method: "POST",
        body: JSON.stringify({ comment_text: options.comment, notify_all: false }),
      });
    }
    return this.get(taskId);
  }
}

export class GrafanaClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly defaultDatasourceUid?: string;

  constructor(
    env: BugOpsEnvironment,
    private readonly fetchImpl: FetchLike = fetch,
  ) {
    this.baseUrl = safeBaseUrl(required(env.GRAFANA_URL, "GRAFANA_URL"), "GRAFANA_URL");
    this.token = required(
      env.GRAFANA_SERVICE_ACCOUNT_TOKEN,
      "GRAFANA_SERVICE_ACCOUNT_TOKEN",
    );
    this.defaultDatasourceUid = env.GRAFANA_LOKI_DATASOURCE_UID?.trim();
  }

  async query(options: GrafanaQueryOptions): Promise<JsonValue> {
    const datasourceUid =
      options.datasourceUid ??
      required(this.defaultDatasourceUid, "GRAFANA_LOKI_DATASOURCE_UID");
    const body = {
      from: String(options.fromMs),
      to: String(options.toMs),
      queries: [
        {
          refId: "A",
          datasource: { type: "loki", uid: datasourceUid },
          expr: options.expression,
          queryType: "range",
          maxLines: Math.max(1, Math.min(options.limit ?? 200, 1_000)),
        },
      ],
    };
    return requestJson(this.fetchImpl, `${this.baseUrl}/api/ds/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }

  incident(fingerprint: string, fromMs: number, toMs: number): Promise<JsonValue> {
    const escaped = fingerprint.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return this.query({
      expression: `{environment="production"} | json | error_fingerprint="${escaped}"`,
      fromMs,
      toMs,
      limit: 500,
    });
  }
}

export function parseDuration(value: string, nowMs = Date.now()): number {
  if (/^\d+$/.test(value)) return Number(value);
  const match = value.match(/^(\d+)(m|h|d)$/);
  if (!match) throw new Error(`Invalid duration ${value}; use epoch milliseconds or 30m/6h/7d`);
  const amount = Number(match[1]);
  const units = { m: 60_000, h: 3_600_000, d: 86_400_000 } as const;
  return nowMs - amount * units[match[2] as keyof typeof units];
}
