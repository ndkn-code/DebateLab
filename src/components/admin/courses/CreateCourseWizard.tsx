"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Globe, Crown, Lock, ChevronRight, ChevronLeft } from "lucide-react";
import { createCourse } from "@/app/actions/courses";
import type { CourseVisibility } from "@/lib/types/admin";

type FormData = {
  title: string;
  description: string;
  category: string;
  difficulty: string;
  visibility: CourseVisibility;
  thumbnail_url: string;
};

export function CreateCourseWizard() {
  const t = useTranslations("admin.courses.wizard");
  const tv = useTranslations("admin.courses.visibility");
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FormData>({
    title: "",
    description: "",
    category: "debate",
    difficulty: "beginner",
    visibility: "public",
    thumbnail_url: "",
  });

  const update = (key: keyof FormData, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const canNext = step === 1 ? form.title.trim().length > 0 : true;

  async function handleCreate() {
    setLoading(true);
    try {
      const course = await createCourse({
        title: form.title,
        description: form.description || undefined,
        category: form.category,
        difficulty: form.difficulty,
        visibility: form.visibility,
        thumbnail_url: form.thumbnail_url || undefined,
      });
      router.push(`/dashboard/admin/courses/${course.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error creating course");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-2.5 w-2.5 rounded-full transition-colors ${s === step ? "bg-primary" : s < step ? "bg-primary/50" : "bg-outline-variant/30"}`}
          />
        ))}
      </div>

      <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 p-6 shadow-sm">
        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="space-y-5">
            <h2 className="text-xl font-bold text-on-surface">{t("step1Title")}</h2>
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1.5">{t("title")}</label>
              <input
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder={t("titlePlaceholder")}
                maxLength={100}
                className="w-full rounded-xl border border-outline-variant/20 bg-surface-container-lowest px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1.5">{t("description")}</label>
              <textarea
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder={t("descriptionPlaceholder")}
                maxLength={500}
                rows={3}
                className="w-full rounded-xl border border-outline-variant/20 bg-surface-container-lowest px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-on-surface mb-1.5">{t("category")}</label>
                <select
                  value={form.category}
                  onChange={(e) => update("category", e.target.value)}
                  className="w-full rounded-xl border border-outline-variant/20 bg-surface-container-lowest px-4 py-2.5 text-sm"
                >
                  <option value="debate">Debate</option>
                  <option value="public_speaking">Public Speaking</option>
                  <option value="argumentation">Argumentation</option>
                  <option value="critical_thinking">Critical Thinking</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-on-surface mb-1.5">{t("difficulty")}</label>
                <select
                  value={form.difficulty}
                  onChange={(e) => update("difficulty", e.target.value)}
                  className="w-full rounded-xl border border-outline-variant/20 bg-surface-container-lowest px-4 py-2.5 text-sm"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Visibility */}
        {step === 2 && (
          <div className="space-y-5">
            <h2 className="text-xl font-bold text-on-surface">{t("step2Title")}</h2>
            <div className="space-y-3">
              {([
                { value: "public", icon: Globe, title: tv("publicTitle"), desc: tv("publicDesc") },
                { value: "premium", icon: Crown, title: tv("premiumTitle"), desc: tv("premiumDesc") },
                { value: "class_restricted", icon: Lock, title: tv("restrictedTitle"), desc: tv("restrictedDesc") },
              ] as const).map(({ value, icon: Icon, title, desc }) => (
                <button
                  key={value}
                  onClick={() => update("visibility", value)}
                  className={`w-full flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                    form.visibility === value
                      ? "border-primary bg-primary/5"
                      : "border-outline-variant/20 hover:border-outline-variant/40"
                  }`}
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${form.visibility === value ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant"}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-on-surface">{title}</p>
                    <p className="text-sm text-on-surface-variant mt-0.5">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="space-y-5">
            <h2 className="text-xl font-bold text-on-surface">{t("step3Title")}</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-outline-variant/10">
                <span className="text-on-surface-variant">{t("title")}</span>
                <span className="font-medium text-on-surface">{form.title}</span>
              </div>
              {form.description && (
                <div className="flex justify-between py-2 border-b border-outline-variant/10">
                  <span className="text-on-surface-variant">{t("description")}</span>
                  <span className="font-medium text-on-surface max-w-[60%] text-right">{form.description}</span>
                </div>
              )}
              <div className="flex justify-between py-2 border-b border-outline-variant/10">
                <span className="text-on-surface-variant">{t("category")}</span>
                <span className="font-medium text-on-surface capitalize">{form.category.replace("_", " ")}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-outline-variant/10">
                <span className="text-on-surface-variant">{t("difficulty")}</span>
                <span className="font-medium text-on-surface capitalize">{form.difficulty}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-on-surface-variant">{t("step2Title")}</span>
                <span className="font-medium text-on-surface capitalize">{form.visibility.replace("_", " ")}</span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-1 rounded-xl px-4 py-2.5 text-sm font-medium text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />{t("back")}
            </button>
          ) : <div />}
          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canNext}
              className="flex items-center gap-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {t("next")}<ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={loading}
              className="rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? t("creating") : t("create")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
