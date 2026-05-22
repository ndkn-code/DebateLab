import assert from "node:assert/strict";

import {
  createTallyWebhookSignature,
  parseTallySupportIssuePayload,
  verifyTallyWebhookSignature,
} from "./tally-webhook";

const payload = {
  eventId: "evt_123",
  eventType: "FORM_RESPONSE",
  createdAt: "2026-05-21T16:00:03.000Z",
  data: {
    responseId: "resp_123",
    submissionId: "sub_123",
    formId: "ODolq7",
    formName: "Report an issue",
    createdAt: "2026-05-21T16:00:02.000Z",
    fields: [
      {
        key: "question_issue_type",
        label: "What kind of issue are you reporting?",
        type: "MULTIPLE_CHOICE",
        value: ["opt_ui"],
        options: [
          { id: "opt_bug", text: "Bug or broken behavior" },
          { id: "opt_ui", text: "UI/UX confusion" },
        ],
      },
      {
        key: "question_severity",
        label: "How serious is it?",
        type: "MULTIPLE_CHOICE",
        value: ["opt_hard"],
        options: [
          { id: "opt_blocking", text: "Blocking" },
          { id: "opt_hard", text: "Hard to use" },
        ],
      },
      {
        key: "question_what_happened",
        label: "What happened?",
        type: "TEXTAREA",
        value: "I could not find the Vietnamese switch.",
      },
      {
        key: "question_expected",
        label: "What did you expect?",
        type: "TEXTAREA",
        value: "A clear language switch in the sidebar.",
      },
      {
        key: "question_steps",
        label: "Steps to reproduce",
        type: "TEXTAREA",
        value: "Open dashboard\nScan the sidebar",
      },
      {
        key: "question_file",
        label: "Add a screenshot or file (optional)",
        type: "FILE_UPLOAD",
        value: [
          {
            id: "file_123",
            name: "sidebar.png",
            url: "https://storage.example/sidebar.png",
            mimeType: "image/png",
            size: 1234,
          },
        ],
      },
      {
        key: "question_contact",
        label: "Can we contact you about this report?",
        type: "MULTIPLE_CHOICE",
        value: ["opt_yes"],
        options: [
          { id: "opt_yes", text: "Yes" },
          { id: "opt_no", text: "No" },
        ],
      },
      {
        key: "hidden_user",
        label: "userId",
        type: "HIDDEN_FIELDS",
        value: "80700d13-3701-4f29-8f4e-3a51f11e3d2f",
      },
      {
        key: "hidden_email",
        label: "email",
        type: "HIDDEN_FIELDS",
        value: "Learner+QA@example.com",
      },
      {
        key: "hidden_locale",
        label: "locale",
        type: "HIDDEN_FIELDS",
        value: "vi",
      },
      {
        key: "hidden_route",
        label: "route",
        type: "HIDDEN_FIELDS",
        value: "/dashboard",
      },
      {
        key: "hidden_source",
        label: "source",
        type: "HIDDEN_FIELDS",
        value: "web_sidebar_help_support",
      },
      {
        key: "hidden_agent",
        label: "userAgent",
        type: "HIDDEN_FIELDS",
        value: "Mozilla/5.0 Test Browser",
      },
      {
        key: "hidden_viewport",
        label: "viewport",
        type: "HIDDEN_FIELDS",
        value: "1440x900",
      },
      {
        key: "hidden_timestamp",
        label: "timestamp",
        type: "HIDDEN_FIELDS",
        value: "2026-05-21T16:00:01.000Z",
      },
    ],
  },
};

const rawBody = JSON.stringify(payload);
const secret = "whsec_test_secret";
const signature = createTallyWebhookSignature(rawBody, secret);

assert.equal(
  verifyTallyWebhookSignature({ rawBody, signature, secret }),
  true
);
assert.equal(
  verifyTallyWebhookSignature({
    rawBody,
    signature: `${signature}tampered`,
    secret,
  }),
  false
);
assert.equal(
  verifyTallyWebhookSignature({
    rawBody,
    signature: `sha256=${signature}`,
    secret,
  }),
  true
);

const issue = parseTallySupportIssuePayload(payload);
assert.equal(issue.tally_event_id, "evt_123");
assert.equal(issue.tally_response_id, "resp_123");
assert.equal(issue.tally_form_id, "ODolq7");
assert.equal(issue.user_id, "80700d13-3701-4f29-8f4e-3a51f11e3d2f");
assert.equal(issue.user_email, "learner+qa@example.com");
assert.equal(issue.locale, "vi");
assert.equal(issue.route, "/dashboard");
assert.equal(issue.source, "web_sidebar_help_support");
assert.equal(issue.issue_type, "UI/UX confusion");
assert.equal(issue.severity, "Hard to use");
assert.equal(issue.description, "I could not find the Vietnamese switch.");
assert.equal(issue.expected_behavior, "A clear language switch in the sidebar.");
assert.match(issue.steps_to_reproduce ?? "", /Scan the sidebar/);
assert.equal(issue.contact_permission, "Yes");
assert.equal(issue.attachments[0]?.name, "sidebar.png");
assert.equal(issue.environment.viewport, "1440x900");
assert.equal(issue.submitted_at, "2026-05-21T16:00:01.000Z");
assert.equal(issue.status, "new");

const vietnamesePayload = {
  eventId: "evt_vi_123",
  eventType: "FORM_RESPONSE",
  data: {
    responseId: "resp_vi_123",
    formId: "NpRXRQ",
    formName: "Báo cáo sự cố",
    fields: [
      {
        label: "Bạn muốn báo cáo loại sự cố nào?",
        type: "MULTIPLE_CHOICE",
        value: ["opt_ui_vi"],
        options: [
          { id: "opt_bug_vi", text: "Lỗi hoặc hành vi không đúng" },
          { id: "opt_ui_vi", text: "Giao diện khó hiểu" },
        ],
      },
      {
        label: "Mức độ nghiêm trọng thế nào?",
        type: "MULTIPLE_CHOICE",
        value: ["opt_hard_vi"],
        options: [
          { id: "opt_block_vi", text: "Không thể tiếp tục" },
          { id: "opt_hard_vi", text: "Rất khó sử dụng" },
        ],
      },
      {
        label: "Chuyện gì đã xảy ra?",
        type: "TEXTAREA",
        value: "Tôi không tìm thấy nút đổi sang tiếng Việt.",
      },
      {
        label: "Bạn mong đợi điều gì?",
        type: "TEXTAREA",
        value: "Có một nút đổi ngôn ngữ rõ ràng trong thanh bên.",
      },
      {
        label: "Các bước để tái hiện",
        type: "TEXTAREA",
        value: "Mở dashboard\nQuan sát thanh bên",
      },
      {
        label: "Tụi mình có thể liên hệ bạn về báo cáo này không?",
        type: "MULTIPLE_CHOICE",
        value: ["opt_yes_vi"],
        options: [
          { id: "opt_yes_vi", text: "Có" },
          { id: "opt_no_vi", text: "Không" },
        ],
      },
      {
        label: "locale",
        type: "HIDDEN_FIELDS",
        value: "vi",
      },
      {
        label: "source",
        type: "HIDDEN_FIELDS",
        value: "web_sidebar_help_support",
      },
    ],
  },
};

const vietnameseIssue = parseTallySupportIssuePayload(vietnamesePayload);
assert.equal(vietnameseIssue.tally_form_id, "NpRXRQ");
assert.equal(vietnameseIssue.tally_form_name, "Báo cáo sự cố");
assert.equal(vietnameseIssue.locale, "vi");
assert.equal(vietnameseIssue.issue_type, "Giao diện khó hiểu");
assert.equal(vietnameseIssue.severity, "Rất khó sử dụng");
assert.equal(
  vietnameseIssue.description,
  "Tôi không tìm thấy nút đổi sang tiếng Việt."
);
assert.equal(
  vietnameseIssue.expected_behavior,
  "Có một nút đổi ngôn ngữ rõ ràng trong thanh bên."
);
assert.match(vietnameseIssue.steps_to_reproduce ?? "", /Quan sát thanh bên/);
assert.equal(vietnameseIssue.contact_permission, "Có");

assert.throws(
  () => parseTallySupportIssuePayload({ data: { fields: [] } }),
  /eventId/
);

console.log("tally webhook tests passed");
