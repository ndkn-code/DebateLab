import { createHmac, timingSafeEqual } from "node:crypto";

import type { SupportIssueReportRow } from "@/types/database";
import { TALLY_BUG_REPORT_HIDDEN_FIELDS } from "./tally-url";

export interface TallySupportIssueInsert {
  tally_event_id: string;
  tally_response_id: string | null;
  tally_submission_id: string | null;
  tally_form_id: string | null;
  tally_form_name: string | null;
  user_id: string | null;
  user_email: string | null;
  locale: string | null;
  route: string | null;
  source: string;
  issue_type: string | null;
  severity: string | null;
  title: string | null;
  description: string | null;
  expected_behavior: string | null;
  steps_to_reproduce: string | null;
  contact_permission: string | null;
  attachments: Record<string, unknown>[];
  environment: Record<string, unknown>;
  hidden_fields: Record<string, unknown>;
  raw_payload: Record<string, unknown>;
  status: SupportIssueReportRow["status"];
  submitted_at: string | null;
}

interface TallyField {
  key?: unknown;
  label?: unknown;
  type?: unknown;
  value?: unknown;
  options?: unknown;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const FIELD_MATCHERS = {
  issueType: [
    /what kind of issue/,
    /issue type/,
    /type of issue/,
    /bao cao loai su co/,
    /loai su co/,
  ],
  severity: [
    /how serious/,
    /severity/,
    /impact/,
    /muc do nghiem trong/,
  ],
  description: [
    /what happened/,
    /describe.*issue/,
    /actual behavior/,
    /chuyen gi da xay ra/,
    /da xay ra/,
  ],
  expectedBehavior: [
    /expected behavior/,
    /what did you expect/,
    /expect.*happen/,
    /mong doi dieu gi/,
    /mong app hoat dong/,
  ],
  stepsToReproduce: [
    /steps to reproduce/,
    /reproduce/,
    /what steps/,
    /cac buoc de tai hien/,
    /tai hien/,
  ],
  contactPermission: [
    /contact.*report/,
    /contact.*issue/,
    /can we contact/,
    /co the lien he/,
    /lien he.*bao cao/,
  ],
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return null;
}

function getRecord(value: unknown) {
  return isRecord(value) ? value : {};
}

function getTallyData(payload: Record<string, unknown>) {
  return getRecord(payload.data);
}

function getTallyFields(payload: Record<string, unknown>) {
  const fields = getTallyData(payload).fields;
  return Array.isArray(fields)
    ? fields.filter((field): field is TallyField => isRecord(field))
    : [];
}

function normalizeLabel(value: unknown) {
  return (getString(value) ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function selectedOptionText(field: TallyField, optionId: unknown) {
  const id = getString(optionId);
  if (!id || !Array.isArray(field.options)) return null;

  for (const option of field.options) {
    if (!isRecord(option)) continue;
    if (getString(option.id) === id) {
      return getString(option.text);
    }
  }

  return null;
}

function fieldValueToText(field: TallyField) {
  const value = field.value;

  if (Array.isArray(value)) {
    const values = value
      .map((entry) => selectedOptionText(field, entry) ?? getString(entry))
      .filter((entry): entry is string => Boolean(entry));

    return values.length ? values.join(", ") : null;
  }

  if (isRecord(value)) {
    return null;
  }

  return getString(value);
}

function findFieldText(fields: TallyField[], patterns: readonly RegExp[]) {
  for (const field of fields) {
    if (getString(field.type) === "HIDDEN_FIELDS") continue;
    const label = normalizeLabel(field.label);
    if (patterns.some((pattern) => pattern.test(label))) {
      return fieldValueToText(field);
    }
  }

  return null;
}

function getHiddenFields(fields: TallyField[]) {
  const hiddenFields: Record<string, unknown> = {};

  for (const field of fields) {
    const label = getString(field.label);
    if (!label) continue;

    if (
      getString(field.type) === "HIDDEN_FIELDS" ||
      TALLY_BUG_REPORT_HIDDEN_FIELDS.includes(
        label as (typeof TALLY_BUG_REPORT_HIDDEN_FIELDS)[number]
      )
    ) {
      hiddenFields[label] = field.value;
    }
  }

  return hiddenFields;
}

function getAttachments(fields: TallyField[]) {
  const attachments: Record<string, unknown>[] = [];

  for (const field of fields) {
    const type = getString(field.type);
    const label = normalizeLabel(field.label);
    if (type !== "FILE_UPLOAD" && !/(screenshot|file|attachment)/.test(label)) {
      continue;
    }

    if (Array.isArray(field.value)) {
      attachments.push(
        ...field.value.filter((item): item is Record<string, unknown> =>
          isRecord(item)
        )
      );
    } else if (isRecord(field.value)) {
      attachments.push(field.value);
    }
  }

  return attachments;
}

function toIsoTimestamp(value: unknown) {
  const candidate = getString(value);
  if (!candidate) return null;

  const timestamp = new Date(candidate);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

function normalizeEmail(value: unknown) {
  const email = getString(value);
  return email ? email.toLowerCase() : null;
}

function normalizeUuid(value: unknown) {
  const uuid = getString(value);
  return uuid && UUID_PATTERN.test(uuid) ? uuid : null;
}

function titleFromDescription(description: string | null, issueType: string | null) {
  const firstLine = description?.split(/\r?\n/).find((line) => line.trim());
  if (firstLine) {
    return firstLine.trim().slice(0, 160);
  }

  return issueType ?? "Support issue report";
}

function normalizeSource(value: unknown) {
  return getString(value) ?? "tally";
}

function getOptionalString(
  source: Record<string, unknown>,
  key: string
) {
  return getString(source[key]);
}

function normalizeSignature(signature: string) {
  return signature.trim().replace(/^sha256=/i, "");
}

export function createTallyWebhookSignature(rawBody: string, secret: string) {
  return createHmac("sha256", secret).update(rawBody).digest("base64");
}

export function verifyTallyWebhookSignature(input: {
  rawBody: string;
  signature: string | null;
  secret: string;
}) {
  const receivedSignature = input.signature
    ? normalizeSignature(input.signature)
    : null;

  if (!receivedSignature || !input.secret) {
    return false;
  }

  const expectedSignature = createTallyWebhookSignature(
    input.rawBody,
    input.secret
  );
  const received = Buffer.from(receivedSignature);
  const expected = Buffer.from(expectedSignature);

  if (received.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(received, expected);
}

export function parseTallySupportIssuePayload(
  payload: Record<string, unknown>
): TallySupportIssueInsert {
  const data = getTallyData(payload);
  const fields = getTallyFields(payload);
  const hiddenFields = getHiddenFields(fields);
  const eventId = getOptionalString(payload, "eventId");

  if (!eventId) {
    throw new Error("Missing Tally eventId");
  }

  const issueType = findFieldText(fields, FIELD_MATCHERS.issueType);
  const description = findFieldText(fields, FIELD_MATCHERS.description);
  const submittedAt =
    toIsoTimestamp(hiddenFields.timestamp) ||
    toIsoTimestamp(data.createdAt) ||
    toIsoTimestamp(payload.createdAt);

  return {
    tally_event_id: eventId,
    tally_response_id: getOptionalString(data, "responseId"),
    tally_submission_id: getOptionalString(data, "submissionId"),
    tally_form_id: getOptionalString(data, "formId"),
    tally_form_name: getOptionalString(data, "formName"),
    user_id: normalizeUuid(hiddenFields.userId),
    user_email: normalizeEmail(hiddenFields.email),
    locale: getString(hiddenFields.locale),
    route: getString(hiddenFields.route),
    source: normalizeSource(hiddenFields.source),
    issue_type: issueType,
    severity: findFieldText(fields, FIELD_MATCHERS.severity),
    title: titleFromDescription(description, issueType),
    description,
    expected_behavior: findFieldText(fields, FIELD_MATCHERS.expectedBehavior),
    steps_to_reproduce: findFieldText(fields, FIELD_MATCHERS.stepsToReproduce),
    contact_permission: findFieldText(fields, FIELD_MATCHERS.contactPermission),
    attachments: getAttachments(fields),
    environment: {
      userAgent: getString(hiddenFields.userAgent),
      viewport: getString(hiddenFields.viewport),
      timestamp: toIsoTimestamp(hiddenFields.timestamp),
    },
    hidden_fields: hiddenFields,
    raw_payload: payload,
    status: "new",
    submitted_at: submittedAt,
  };
}
