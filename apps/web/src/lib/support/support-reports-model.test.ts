import assert from "node:assert/strict";

import {
  buildSupportReportsViewModel,
  mapSupportReportRow,
  normalizeSupportReportsFilters,
  SUPPORT_REPORT_STATUS_LABELS,
  type RawSupportReportRow,
} from "./support-reports-model";

function row(overrides: Partial<RawSupportReportRow>): RawSupportReportRow {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    tally_event_id: "evt_1",
    tally_response_id: null,
    tally_submission_id: null,
    tally_form_id: null,
    tally_form_name: null,
    user_id: null,
    user_email: null,
    locale: "en",
    route: "/dashboard",
    source: "tally",
    issue_type: "Bug",
    severity: "Blocking",
    title: "Dashboard loop",
    description: "The dashboard keeps redirecting.",
    expected_behavior: null,
    steps_to_reproduce: null,
    contact_permission: null,
    attachments: [],
    environment: {},
    hidden_fields: {},
    raw_payload: {},
    status: "new",
    submitted_at: "2026-05-21T16:00:00.000Z",
    created_at: "2026-05-21T16:00:00.000Z",
    updated_at: "2026-05-21T16:00:00.000Z",
    ...overrides,
  };
}

const reports = [
  mapSupportReportRow(
    row({
      id: "00000000-0000-4000-8000-000000000001",
      status: "new",
      severity: "Blocking",
      issue_type: "Bug",
      user_email: "teacher@example.com",
      title: "Homework queue is blank",
    })
  ),
  mapSupportReportRow(
    row({
      id: "00000000-0000-4000-8000-000000000002",
      status: "in_progress",
      severity: "Hard to use",
      issue_type: "UI/UX confusion",
      source: "web_sidebar_help_support",
      description: "The Vietnamese switch is hard to find.",
      user_email: "learner@example.com",
    })
  ),
  mapSupportReportRow(
    row({
      id: "00000000-0000-4000-8000-000000000003",
      status: "resolved",
      severity: "Minor",
      issue_type: "Question",
      source: "tally",
      title: "Can I reset a quiz?",
      user_email: "coach@example.com",
    })
  ),
  mapSupportReportRow(
    row({
      id: "00000000-0000-4000-8000-000000000004",
      status: "closed",
      severity: "Minor",
      issue_type: "Bug",
      title: "Old mobile layout report",
    })
  ),
];

const filters = normalizeSupportReportsFilters({
  status: "all",
  severity: "all",
  issueType: "Bug",
  source: "all",
  search: "homework",
  page: 1,
});

const model = buildSupportReportsViewModel({
  reports,
  filters,
  pageSize: 2,
});

assert.equal(SUPPORT_REPORT_STATUS_LABELS.in_progress, "In progress");
assert.equal(model.totalCount, 1);
assert.equal(model.reports[0]?.title, "Homework queue is blank");
assert.equal(model.kpis.statusCounts.new, 1);
assert.equal(model.kpis.openCount, 1);
assert.equal(model.kpis.resolvedCount, 0);
assert.deepEqual(model.facets.issueTypes, ["Bug", "Question", "UI/UX confusion"]);
assert.deepEqual(model.facets.sources, ["tally", "web_sidebar_help_support"]);

const workingModel = buildSupportReportsViewModel({
  reports,
  filters: normalizeSupportReportsFilters({
    status: "in_progress",
    severity: "all",
    issueType: "all",
    source: "web_sidebar_help_support",
    search: "vietnamese",
    page: 1,
  }),
});

assert.equal(workingModel.totalCount, 1);
assert.equal(workingModel.reports[0]?.status, "in_progress");
assert.equal(workingModel.kpis.statusCounts.in_progress, 1);
assert.equal(workingModel.kpis.openCount, 1);

const fallback = mapSupportReportRow(
  row({
    status: "not_a_real_status",
    title: null,
    description: "First usable line\nSecond line",
    attachments: [{ name: "screen.png" }, "bad"],
    environment: ["bad"],
  })
);

assert.equal(fallback.status, "new");
assert.equal(fallback.title, "First usable line");
assert.deepEqual(fallback.attachments, [{ name: "screen.png" }]);
assert.deepEqual(fallback.environment, {});

console.log("support reports model tests passed");
