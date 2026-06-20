import type {
  IeltsAnswer,
  IeltsQuestionView,
  IeltsVerdict,
} from "@/lib/ielts/question-types";

/**
 * The shared, controlled props every IELTS question renderer accepts. The
 * dispatcher parses the DB row into a {@link IeltsQuestionView} and hands the
 * learner's answer + an `onChange` setter down. When `verdict` is provided the
 * renderer enters read-only review mode and marks the learner's own answer
 * correct/incorrect (never revealing the key — the correct option is not shown).
 */
export interface IeltsRendererProps {
  question: IeltsQuestionView;
  value: IeltsAnswer | null;
  onChange: (next: IeltsAnswer) => void;
  disabled?: boolean;
  verdict?: IeltsVerdict | null;
}
