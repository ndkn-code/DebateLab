import type {
  CoachVisualConnector,
  CoachVisualExplainerSpec,
  CoachVisualStep,
  CoachVisualTemplate,
} from "@/types";

const TEMPLATES = [
  "argument_chain",
  "rebuttal_pivot",
  "clash_map",
  "weighing_scale",
] as const satisfies readonly CoachVisualTemplate[];

const ALLOWED_TOP_LEVEL_KEYS = new Set([
  "version",
  "template",
  "title",
  "subtitle",
  "steps",
  "connectors",
  "takeaway",
]);

const ALLOWED_STEP_KEYS = new Set(["id", "label", "text", "accent"]);
const ALLOWED_CONNECTOR_KEYS = new Set(["from", "to", "label"]);
const SAFE_TEXT_PATTERN = /^[^<>{}]*$/;

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || !SAFE_TEXT_PATTERN.test(text)) return null;
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}...` : text;
}

function cleanId(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const id = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return id.slice(0, 40) || fallback;
}

function isTemplate(value: unknown): value is CoachVisualTemplate {
  return typeof value === "string" && TEMPLATES.includes(value as CoachVisualTemplate);
}

function getStepBounds(template: CoachVisualTemplate) {
  if (template === "rebuttal_pivot") return { min: 3, max: 4 };
  if (template === "clash_map") return { min: 2, max: 5 };
  return { min: 3, max: 5 };
}

function hasOnlyKnownKeys(value: Record<string, unknown>, keys: Set<string>) {
  return Object.keys(value).every((key) => keys.has(key));
}

function normalizeStep(value: unknown, index: number): CoachVisualStep | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (!hasOnlyKnownKeys(raw, ALLOWED_STEP_KEYS)) return null;
  const label = cleanText(raw.label, 44);
  const text = cleanText(raw.text, 220);
  if (!label || !text) return null;
  const accent =
    raw.accent === "warning" ||
    raw.accent === "success" ||
    raw.accent === "danger" ||
    raw.accent === "primary"
      ? raw.accent
      : undefined;

  return {
    id: cleanId(raw.id, `step-${index + 1}`),
    label,
    text,
    ...(accent ? { accent } : {}),
  };
}

function normalizeConnector(
  value: unknown,
  stepIds: Set<string>
): CoachVisualConnector | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (!hasOnlyKnownKeys(raw, ALLOWED_CONNECTOR_KEYS)) return null;
  const from = cleanId(raw.from, "");
  const to = cleanId(raw.to, "");
  if (!from || !to || !stepIds.has(from) || !stepIds.has(to) || from === to) {
    return null;
  }
  const label = cleanText(raw.label, 42);
  return {
    from,
    to,
    ...(label ? { label } : {}),
  };
}

export function normalizeCoachVisualExplainerSpec(
  value: unknown,
  options: {
    sourceMessageId?: string;
    plannerModel?: string;
  } = {}
): CoachVisualExplainerSpec | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (!hasOnlyKnownKeys(raw, ALLOWED_TOP_LEVEL_KEYS)) return null;
  if (!isTemplate(raw.template)) return null;

  const template = raw.template;
  const title = cleanText(raw.title, 96);
  if (!title) return null;
  const subtitle = cleanText(raw.subtitle, 140) ?? undefined;
  const takeaway = cleanText(raw.takeaway, 180) ?? undefined;
  const { min, max } = getStepBounds(template);

  const steps = Array.isArray(raw.steps)
    ? raw.steps
        .map((step, index) => normalizeStep(step, index))
        .filter((step): step is CoachVisualStep => Boolean(step))
        .slice(0, max)
    : [];

  if (steps.length < min) return null;

  const stepIds = new Set(steps.map((step) => step.id));
  const connectors = Array.isArray(raw.connectors)
    ? raw.connectors
        .map((connector) => normalizeConnector(connector, stepIds))
        .filter((connector): connector is CoachVisualConnector =>
          Boolean(connector)
        )
        .slice(0, 6)
    : undefined;

  return {
    version: 1,
    template,
    title,
    ...(subtitle ? { subtitle } : {}),
    steps,
    ...(connectors && connectors.length > 0 ? { connectors } : {}),
    ...(takeaway ? { takeaway } : {}),
    ...(options.sourceMessageId ? { sourceMessageId: options.sourceMessageId } : {}),
    ...(options.plannerModel ? { plannerModel: options.plannerModel } : {}),
  };
}

export function extractJsonObjectFromText(text: string) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
    if (fenced) {
      try {
        return JSON.parse(fenced);
      } catch {
        return null;
      }
    }
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

