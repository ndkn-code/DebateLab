"use client";

/**
 * IELTS question renderer registry (WS-2.1) — the integration seam for WS-1.2.
 * The mock player asks `getIeltsQuestionRenderer(type)` for a component and
 * renders it through the typed `IeltsRendererProps` contract. Objective types
 * register their rich family renderers; Writing/Speaking register async capture
 * surfaces. The fallback stays only as a defensive preview/degraded path.
 */
import type { ComponentType, ReactElement } from "react";
import {
  extractValue,
  extractValues,
} from "@/lib/scoring/ielts/answer-normalize";
import type {
  IeltsQuestionType,
  IeltsQuestionView,
} from "@/lib/ielts/question-contract";
import {
  DEFAULT_BLANK_ID,
  getQuestionFamily,
  IeltsAnswerSchema,
  OBJECTIVE_QUESTION_TYPES,
  type IeltsAnswer,
  type IeltsQuestionFamily,
  type IeltsVerdict,
} from "@/lib/ielts/question-types";
import { BlankControl } from "./questions/BlankControl";
import { ChoiceTile } from "./questions/ChoiceTile";
import { CompletionRenderer } from "./questions/CompletionRenderer";
import { LabelingRenderer } from "./questions/LabelingRenderer";
import { MatchingRenderer } from "./questions/MatchingRenderer";
import { MultiSelectRenderer } from "./questions/MultiSelectRenderer";
import { SingleSelectRenderer } from "./questions/SingleSelectRenderer";
import type {
  IeltsRendererContext,
  IeltsRendererProps as ObjectiveRendererProps,
} from "./questions/types";

export type { IeltsRendererContext } from "./questions/types";

export interface IeltsRendererProps {
  question: IeltsQuestionView;
  value: unknown;
  disabled: boolean;
  onChange: (value: unknown) => void;
  context?: IeltsRendererContext;
  /** Present → objective renderers enter read-only review mode. */
  verdict?: IeltsVerdict | null;
}

export type IeltsQuestionRenderer = (
  props: IeltsRendererProps,
) => ReactElement | null;

const REGISTRY = new Map<IeltsQuestionType, IeltsQuestionRenderer>();

const OBJECTIVE_RENDERERS: Record<
  IeltsQuestionFamily,
  ComponentType<ObjectiveRendererProps>
> = {
  single_select: SingleSelectRenderer,
  multi_select: MultiSelectRenderer,
  matching: MatchingRenderer,
  completion: CompletionRenderer,
  labeling: LabelingRenderer,
};

/**
 * Normalise whatever the response store holds into the typed `IeltsAnswer`
 * the family renderers expect (legacy `{ value }` / `{ values: [] }` envelopes
 * are folded onto blank "0").
 */
export function coerceObjectiveAnswer(
  question: Pick<IeltsQuestionView, "questionType">,
  value: unknown,
): IeltsAnswer | null {
  const hasValuesEnvelope =
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "values" in value;
  const parsed = hasValuesEnvelope ? IeltsAnswerSchema.safeParse(value) : null;
  if (parsed?.success) return parsed.data;

  if (question.questionType === "mcq_multi") {
    const values = extractValues(value);
    return values.length > 0
      ? { values: { [DEFAULT_BLANK_ID]: values } }
      : null;
  }

  const single = extractValue(value);
  return single === null ? null : { values: { [DEFAULT_BLANK_ID]: single } };
}

/** Wrap a family renderer in the registry contract, forwarding context + verdict. */
export function adaptObjectiveRenderer(
  Renderer: ComponentType<ObjectiveRendererProps>,
): IeltsQuestionRenderer {
  return function ObjectiveRendererAdapter({
    question,
    value,
    disabled,
    onChange,
    context,
    verdict,
  }: IeltsRendererProps) {
    return (
      <Renderer
        question={question}
        value={coerceObjectiveAnswer(question, value)}
        disabled={disabled}
        onChange={onChange}
        context={context}
        verdict={verdict}
      />
    );
  };
}

let objectiveRenderersRegistered = false;

export function ensureIeltsObjectiveRenderersRegistered(): void {
  if (objectiveRenderersRegistered) return;
  objectiveRenderersRegistered = true;
  for (const type of OBJECTIVE_QUESTION_TYPES) {
    registerIeltsRenderer(
      type,
      adaptObjectiveRenderer(OBJECTIVE_RENDERERS[getQuestionFamily(type)]),
    );
  }
}

/** WS-1.2 hook: register a rich renderer for a question type. */
export function registerIeltsRenderer(
  type: IeltsQuestionType,
  renderer: IeltsQuestionRenderer,
): void {
  REGISTRY.set(type, renderer);
}

export function getIeltsQuestionRenderer(
  type: IeltsQuestionType,
): IeltsQuestionRenderer {
  return REGISTRY.get(type) ?? FallbackQuestion;
}

export function isIeltsQuestionRendererRegistered(
  type: IeltsQuestionType,
): boolean {
  return REGISTRY.has(type);
}

export function getRegisteredIeltsQuestionRendererTypes(): IeltsQuestionType[] {
  return [...REGISTRY.keys()];
}

// ── Fallback (defensive path: unregistered type / isolated preview) ──────────

interface Choice {
  value: string;
  label: string;
}

const TFNG: Choice[] = [
  { value: "true", label: "True" },
  { value: "false", label: "False" },
  { value: "not_given", label: "Not Given" },
];
const YNNG: Choice[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "not_given", label: "Not Given" },
];

const SINGLE_CHOICE_TYPES = new Set<IeltsQuestionType>([
  "mcq_single",
  "matching_headings",
  "matching_information",
  "matching_features",
  "map_plan_label",
]);

function normalizeOptions(options: unknown): Choice[] {
  if (!Array.isArray(options)) return [];
  return options.map((option, index) => {
    if (typeof option === "string") return { value: option, label: option };
    if (option && typeof option === "object") {
      const record = option as Record<string, unknown>;
      const value = String(record.value ?? record.id ?? record.key ?? index);
      const label = String(
        record.label ?? record.text ?? record.value ?? value,
      );
      return { value, label };
    }
    return { value: String(index), label: String(index) };
  });
}

function ChoiceList({
  choices,
  control,
  selected,
  disabled,
  onPick,
}: {
  choices: Choice[];
  control: "radio" | "checkbox";
  selected: ReadonlySet<string>;
  disabled: boolean;
  onPick: (value: string) => void;
}) {
  return (
    <div role="group" className="flex flex-col gap-2">
      {choices.map((choice) => (
        <ChoiceTile
          key={choice.value}
          control={control}
          text={choice.label}
          selected={selected.has(choice.value)}
          disabled={disabled}
          onSelect={() => onPick(choice.value)}
        />
      ))}
    </div>
  );
}

/** Wrap a scalar into the typed answer envelope the grader accepts. */
function singleAnswer(value: string): IeltsAnswer {
  return { values: { [DEFAULT_BLANK_ID]: value } };
}

export function FallbackQuestion({
  question,
  value,
  disabled,
  onChange,
  verdict,
}: IeltsRendererProps): ReactElement {
  const type = question.questionType;
  const locked = disabled || verdict != null;

  if (type === "true_false_notgiven" || type === "yes_no_notgiven") {
    const current = extractValue(coerceObjectiveAnswer(question, value)?.values[DEFAULT_BLANK_ID] ?? null);
    return (
      <ChoiceList
        choices={type === "true_false_notgiven" ? TFNG : YNNG}
        control="radio"
        selected={new Set(current === null ? [] : [current])}
        disabled={locked}
        onPick={(picked) => onChange(singleAnswer(picked))}
      />
    );
  }

  if (type === "mcq_multi") {
    const selected = new Set(extractValues(coerceObjectiveAnswer(question, value)?.values[DEFAULT_BLANK_ID] ?? []));
    return (
      <ChoiceList
        choices={normalizeOptions(question.options)}
        control="checkbox"
        selected={selected}
        disabled={locked}
        onPick={(picked) => {
          const next = new Set(selected);
          if (next.has(picked)) next.delete(picked);
          else next.add(picked);
          onChange({ values: { [DEFAULT_BLANK_ID]: [...next] } });
        }}
      />
    );
  }

  if (SINGLE_CHOICE_TYPES.has(type)) {
    const current = extractValue(coerceObjectiveAnswer(question, value)?.values[DEFAULT_BLANK_ID] ?? null);
    return (
      <ChoiceList
        choices={normalizeOptions(question.options)}
        control="radio"
        selected={new Set(current === null ? [] : [current])}
        disabled={locked}
        onPick={(picked) => onChange(singleAnswer(picked))}
      />
    );
  }

  // completion / short-answer / diagram-label: free text capture.
  return (
    <BlankControl
      blankId={DEFAULT_BLANK_ID}
      value={coerceObjectiveAnswer(question, value)}
      onChange={onChange}
      disabled={locked}
      ariaLabel={question.prompt}
      placeholder="Type your answer"
      layout="block"
    />
  );
}
