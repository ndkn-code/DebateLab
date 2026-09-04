import assert from "node:assert/strict";
import test from "node:test";
import {
  readPages,
  readChunkedPages,
  requireRows,
  type QueryCost,
} from "./query-pages";
import { reportingPeriod, dateInZone, localMidnight } from "./reporting-period";
test("reads beyond 1000 rows and records fixture query cost without truncation", async () => {
  const source = Array.from({ length: 1200 }, (_, id) => ({ id }));
  const cost: QueryCost = { queries: 0, rows: 0, bytes: 0 };
  const rows = requireRows(
    await readPages(
      async (from, to) => ({ data: source.slice(from, to + 1), error: null }),
      cost,
    ),
    "fixture",
  );
  assert.equal(rows.length, 1200);
  assert.equal(cost.queries, 3);
  assert.equal(cost.rows, 1200);
  assert.ok(cost.bytes > 10000);
});
test("all IN lists are chunked, no duplicates across chunk boundaries", async () => {
  const ids = Array.from({ length: 301 }, (_, id) => String(id));
  const calls: number[][] = [];
  const result = await readChunkedPages([ids, ["a", "b"]], async (chunks) => {
    calls.push(chunks.map((chunk) => chunk.length));
    return { data: chunks[0], error: null };
  });
  assert.equal(result.data?.length, 301);
  assert.ok(calls.every((chunks) => chunks.every((size) => size <= 150)));
});
test("a later page failure discards previously loaded rows", async () => {
  const result = await readPages(async (from) =>
    from === 0
      ? { data: Array.from({ length: 500 }, (_, id) => id), error: null }
      : { data: null, error: { message: "source down" } },
  );
  assert.equal(result.data, null);
  assert.throws(() => requireRows(result, "fixture"), /unavailable/);
});
test("Vietnam and DST day boundaries use local calendar days", () => {
  assert.equal(
    localMidnight("2026-09-04", "Asia/Ho_Chi_Minh"),
    "2026-09-03T17:00:00.000Z",
  );
  assert.equal(
    localMidnight("2026-03-08", "America/New_York"),
    "2026-03-08T05:00:00.000Z",
  );
  assert.equal(
    localMidnight("2026-03-09", "America/New_York"),
    "2026-03-09T04:00:00.000Z",
  );
  const period = reportingPeriod(
    7,
    "Asia/Ho_Chi_Minh",
    new Date("2026-09-04T20:00:00Z"),
  );
  assert.equal(dateInZone(period.start, period.timezone), "2026-08-30");
  assert.equal(dateInZone(period.end, period.timezone), "2026-09-05");
});
