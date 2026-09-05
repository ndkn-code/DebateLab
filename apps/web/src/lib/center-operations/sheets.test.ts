import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultStagedMapping,
  planStagedRosterSheet,
  stagedSheetToRosterSheet,
  type StagedSheet,
} from "./sheets";

function staged(rows: unknown[][]): StagedSheet {
  return {
    id: "stage-1",
    rows,
    status: "pending",
    created_at: "2026-09-04T12:00:00Z",
  };
}

test("maps shuffled Vietnamese headings, excludes the header, and normalizes student and guardian phones", () => {
  const stage = staged([
    [
      "Ghi chú",
      "SĐT phụ huynh",
      "Ngày sinh",
      "Họ và tên",
      "Email",
      "Số điện thoại",
      "Mã học viên",
      "Tên phụ huynh",
    ],
    [
      "Lớp chiều",
      "0905.123.456",
      "17/04/2009",
      "  Nguyễn   Minh An ",
      " AN@example.com ",
      905123457,
      "HV-01",
      "Nguyễn Hà",
    ],
  ]);
  const sheet = stagedSheetToRosterSheet(stage);
  const mapping = defaultStagedMapping(sheet.headers);
  assert.equal(mapping.fullName, 3);
  assert.equal(mapping.guardianPhone, 1);
  assert.equal(mapping.phone, 5);
  const plan = planStagedRosterSheet(stage, mapping);
  assert.deepEqual(plan.counts, {
    total: 1,
    ready: 1,
    blocked: 0,
    withEmail: 1,
  });
  assert.equal(plan.rows[0].rowNumber, 1);
  assert.deepEqual(plan.rows[0].values, {
    fullName: "Nguyễn Minh An",
    email: "an@example.com",
    studentCode: "HV-01",
    dateOfBirth: "2009-04-17",
    phone: "+84905123457",
    guardianName: "Nguyễn Hà",
    guardianPhone: "+84905123456",
    guardianEmail: null,
    notes: "Lớp chiều",
  });
});

test("manual mapping feeds the same B3 validation and blocks both duplicate identities", () => {
  const stage = staged([
    ["Tên riêng", "Liên hệ"],
    ["An", "an@example.com"],
    ["Bình", "AN@example.com"],
  ]);
  const mapping = {
    ...defaultStagedMapping(["Tên riêng", "Liên hệ"]),
    fullName: 0,
    email: 1,
  };
  const plan = planStagedRosterSheet(stage, mapping);
  assert.equal(plan.counts.blocked, 2);
  assert.ok(
    plan.rows.every((row) =>
      row.issues.some((issue) => issue.code === "duplicate_in_file"),
    ),
  );
});

test("duplicate source headings preserve the first value and report the unreadable second column", () => {
  const stage = staged([
    ["Họ và tên", "Họ và tên"],
    ["An", "Wrong student"],
  ]);
  const plan = planStagedRosterSheet(
    stage,
    defaultStagedMapping(["Họ và tên", "Họ và tên"]),
  );
  assert.equal(plan.rows[0].values.fullName, "An");
  assert.equal(plan.warnings.length, 1);
});

test("rejects missing headers and does not invent a student from a header-only sheet", () => {
  assert.throws(() => stagedSheetToRosterSheet(staged([])), /header/);
  assert.throws(() => stagedSheetToRosterSheet(staged([["", null]])), /header/);
  const stage = staged([["Họ và tên"]]);
  assert.equal(
    planStagedRosterSheet(stage, defaultStagedMapping(["Họ và tên"])).counts
      .total,
    0,
  );
});
