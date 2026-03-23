"use client";

import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import type { QuizContent, ActivityContent } from "@/lib/types/admin";

interface Props {
  content: ActivityContent;
  onChange: (content: ActivityContent) => void;
}

export function QuizBuilder({ content, onChange }: Props) {
  const t = useTranslations("admin.courses.builders.quiz");
  const c = content as QuizContent;
  const questions = c.questions ?? [];

  const update = (questions: QuizContent["questions"]) =>
    onChange({ questions } as ActivityContent);

  const addQuestion = () => {
    update([...questions, {
      id: crypto.randomUUID(),
      question: "",
      type: "multiple_choice",
      options: [
        { id: crypto.randomUUID(), text: "" },
        { id: crypto.randomUUID(), text: "" },
        { id: crypto.randomUUID(), text: "" },
        { id: crypto.randomUUID(), text: "" },
      ],
      correctAnswer: "",
      explanation: "",
    }]);
  };

  const updateQ = (idx: number, changes: Partial<QuizContent["questions"][0]>) => {
    const updated = [...questions];
    updated[idx] = { ...updated[idx], ...changes };
    update(updated);
  };

  const removeQ = (idx: number) => update(questions.filter((_, i) => i !== idx));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-on-surface">{t("questions")} ({questions.length})</span>
        <button onClick={addQuestion} className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80">
          <Plus className="h-3.5 w-3.5" />{t("addQuestion")}
        </button>
      </div>

      {questions.map((q, qi) => (
        <div key={q.id} className="rounded-xl border border-outline-variant/20 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-on-surface-variant">
              {t("questionNumber", { number: qi + 1, total: questions.length })}
            </span>
            <div className="flex items-center gap-2">
              <select
                value={q.type}
                onChange={(e) => updateQ(qi, { type: e.target.value as "multiple_choice" | "true_false" })}
                className="text-xs rounded-lg border border-outline-variant/20 px-2 py-1"
              >
                <option value="multiple_choice">{t("multipleChoice")}</option>
                <option value="true_false">{t("trueFalse")}</option>
              </select>
              <button onClick={() => removeQ(qi)} className="p-1 hover:bg-red-50 rounded-lg text-on-surface-variant hover:text-red-600">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <textarea
            value={q.question}
            onChange={(e) => updateQ(qi, { question: e.target.value })}
            placeholder={t("questionPlaceholder")}
            rows={2}
            className="w-full rounded-lg border border-outline-variant/20 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
          />

          {q.type === "multiple_choice" ? (
            <div className="space-y-2">
              <span className="text-xs text-on-surface-variant">{t("options")}</span>
              {q.options.map((opt, oi) => (
                <div key={opt.id} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${q.id}`}
                    checked={q.correctAnswer === opt.id}
                    onChange={() => updateQ(qi, { correctAnswer: opt.id })}
                    className="accent-primary"
                  />
                  <input
                    value={opt.text}
                    onChange={(e) => {
                      const opts = [...q.options];
                      opts[oi] = { ...opts[oi], text: e.target.value };
                      updateQ(qi, { options: opts });
                    }}
                    placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                    className="flex-1 rounded-lg border border-outline-variant/20 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  {q.options.length > 2 && (
                    <button
                      onClick={() => {
                        const opts = q.options.filter((_, i) => i !== oi);
                        updateQ(qi, { options: opts, correctAnswer: q.correctAnswer === opt.id ? "" : q.correctAnswer });
                      }}
                      className="p-1 hover:bg-red-50 rounded-lg text-on-surface-variant hover:text-red-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
              {q.options.length < 6 && (
                <button
                  onClick={() => updateQ(qi, { options: [...q.options, { id: crypto.randomUUID(), text: "" }] })}
                  className="text-xs text-primary hover:text-primary/80 font-medium"
                >
                  + {t("addOption")}
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-sm">
                <input type="radio" name={`tf-${q.id}`} checked={q.correctAnswer === "true"} onChange={() => updateQ(qi, { correctAnswer: "true" })} className="accent-primary" />
                True
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <input type="radio" name={`tf-${q.id}`} checked={q.correctAnswer === "false"} onChange={() => updateQ(qi, { correctAnswer: "false" })} className="accent-primary" />
                False
              </label>
            </div>
          )}

          <textarea
            value={q.explanation}
            onChange={(e) => updateQ(qi, { explanation: e.target.value })}
            placeholder={t("explanationPlaceholder")}
            rows={2}
            className="w-full rounded-lg border border-outline-variant/20 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      ))}
    </div>
  );
}
