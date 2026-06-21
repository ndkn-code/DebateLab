"use client";

/**
 * IELTS question renderer registry (WS-2.1) — the integration seam for WS-1.2.
 * The mock player asks `getIeltsQuestionRenderer(type)` for a component and
 * renders it through the typed `IeltsRendererProps` contract. Objective types
 * register their rich family renderers; Writing/Speaking register async capture
 * surfaces. The fallback stays only as a defensive preview/degraded path.
 */
import { useId } from "react";
import type { ComponentType, ReactElement } from "react";
import { extractValue, extractValues } from "@/lib/scoring/ielts/answer-normalize";
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
} from "@/lib/ielts/question-types";
import { CompletionRenderer } from "./questions/CompletionRenderer";
import { LabelingRenderer } from "./questions/LabelingRenderer";
import { MatchingRenderer } from "./questions/MatchingRenderer";
import { MultiSelectRenderer } from "./questions/MultiSelectRenderer";
import { SingleSelectRenderer } from "./questions/SingleSelectRenderer";
import type {
  IeltsRendererProps as ObjectiveRendererProps,
} from "./questions/types";

/**
 * Player context a registered task surface may need beyond the question itself —
 * e.g. the live attempt id the Writing/Speaking surfaces submit against (WS-5.2).
 * Optional so objective renderers (and isolated previews) ignore it.
 */
export interface IeltsRendererContext {
  attemptId: string;
}

export interface IeltsRendererProps {
  question: IeltsQuestionView;
  value: unknown;
  disabled: boolean;
  onChange: (value: unknown) => void;
  context?: IeltsRendererContext;
}

export type IeltsQuestionRenderer = (props: IeltsRendererProps) => ReactElement | null;

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

function coerceObjectiveAnswer(
  question: IeltsQuestionView,
  value: unknown,
): IeltsAnswer | null {
  const parsed = IeltsAnswerSchema.safeParse(value);
  if (parsed.success) return parsed.data;

  if (question.questionType === "mcq_multi") {
    const values = extractValues(value);
    return values.length > 0 ? { values: { [DEFAULT_BLANK_ID]: values } } : null;
  }

  const single = extractValue(value);
  return single === null ? null : { values: { [DEFAULT_BLANK_ID]: single } };
}

function adaptObjectiveRenderer(
  Renderer: ComponentType<ObjectiveRendererProps>,
): IeltsQuestionRenderer {
  return function ObjectiveRendererAdapter({
    question,
    value,
    disabled,
    onChange,
  }: IeltsRendererProps) {
    return (
      <Renderer
        question={question}
        value={coerceObjectiveAnswer(question, value)}
        disabled={disabled}
        onChange={onChange}
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

export function isIeltsQuestionRendererRegistered(type: IeltsQuestionType): boolean {
  return REGISTRY.has(type);
}

export function getRegisteredIeltsQuestionRendererTypes(): IeltsQuestionType[] {
  return [...REGISTRY.keys()];
}

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
      const label = String(record.label ?? record.text ?? record.value ?? value);
      return { value, label };
    }
    return { value: String(index), label: String(index) };
  });
}

function ChoiceGroup({
  choices,
  selected,
  disabled,
  onPick,
}: {
  choices: Choice[];
  selected: string | null;
  disabled: boolean;
  onPick: (value: string) => void;
}) {
  const name = useId();
  return (
    <div className="flex flex-col gap-2">
      {choices.map((choice) => (
        <label
          key={choice.value}
          className="flex items-center gap-3 rounded-2xl border border-outline-variant bg-surface px-4 py-3 text-on-surface"
        >
          <input
            type="radio"
            name={name}
            value={choice.value}
            checked={selected === choice.value}
            disabled={disabled}
            onChange={() => onPick(choice.value)}
            className="size-4 accent-primary"
          />
          <span className="text-sm">{choice.label}</span>
        </label>
      ))}
    </div>
  );
}

function CheckboxGroup({
  choices,
  selected,
  disabled,
  onToggle,
}: {
  choices: Choice[];
  selected: Set<string>;
  disabled: boolean;
  onToggle: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {choices.map((choice) => (
        <label
          key={choice.value}
          className="flex items-center gap-3 rounded-2xl border border-outline-variant bg-surface px-4 py-3 text-on-surface"
        >
          <input
            type="checkbox"
            value={choice.value}
            checked={selected.has(choice.value)}
            disabled={disabled}
            onChange={() => onToggle(choice.value)}
            className="size-4 accent-primary"
          />
          <span className="text-sm">{choice.label}</span>
        </label>
      ))}
    </div>
  );
}

function FallbackQuestion({
  question,
  value,
  disabled,
  onChange,
}: IeltsRendererProps): ReactElement {
  const type = question.questionType;

  if (type === "true_false_notgiven" || type === "yes_no_notgiven") {
    return (
      <ChoiceGroup
        choices={type === "true_false_notgiven" ? TFNG : YNNG}
        selected={extractValue(value)}
        disabled={disabled}
        onPick={(picked) => onChange({ value: picked })}
      />
    );
  }

  if (type === "mcq_multi") {
    const selected = new Set(extractValues(value));
    return (
      <CheckboxGroup
        choices={normalizeOptions(question.options)}
        selected={selected}
        disabled={disabled}
        onToggle={(picked) => {
          const next = new Set(selected);
          if (next.has(picked)) next.delete(picked);
          else next.add(picked);
          onChange({ values: [...next] });
        }}
      />
    );
  }

  if (SINGLE_CHOICE_TYPES.has(type)) {
    return (
      <ChoiceGroup
        choices={normalizeOptions(question.options)}
        selected={extractValue(value)}
        disabled={disabled}
        onPick={(picked) => onChange({ value: picked })}
      />
    );
  }

  // completion / short-answer / diagram-label: free text capture.
  return (
    <input
      type="text"
      value={extractValue(value) ?? ""}
      disabled={disabled}
      onChange={(event) => onChange({ value: event.target.value })}
      placeholder="Type your answer"
      className="w-full rounded-2xl border border-outline-variant bg-surface px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant"
    />
  );
}
