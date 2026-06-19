/**
 * Subject axis (debate | ielts).
 *
 * A first-class content/app dimension, ORTHOGONAL to the EN/VI language axis
 * (the next-intl UI locale) and to the practice-language axis. Mirrors the
 * config-map shape of `practice/language.ts`.
 *
 * Engine-purity (masterplan §2.7): `subject` is a dimension carried alongside
 * content and app state — it is never branched on inside the core activity
 * engine. New subjects slot in by extending this config map, not by editing the
 * engine.
 */

export const SUBJECTS = ["debate", "ielts"] as const;

export type Subject = (typeof SUBJECTS)[number];

export const DEFAULT_SUBJECT: Subject = "debate";

export interface SubjectConfig {
  code: Subject;
  /** Label shown in the `en` UI locale. */
  label: string;
  /** Label shown in the `vi` UI locale. */
  labelVi: string;
}

export const SUBJECT_CONFIG: Record<Subject, SubjectConfig> = {
  debate: {
    code: "debate",
    label: "Debate",
    // The VN copy guidelines keep "debate" in English where it reads naturally,
    // matching the app's existing "Debate Tiếng Việt" usage.
    labelVi: "Debate",
  },
  ielts: {
    code: "ielts",
    label: "IELTS",
    labelVi: "IELTS",
  },
};

export function isSubject(value: unknown): value is Subject {
  return SUBJECTS.includes(value as Subject);
}

export function coerceSubject(
  value: unknown,
  fallback: Subject = DEFAULT_SUBJECT,
): Subject {
  return isSubject(value) ? value : fallback;
}

export function getSubjectConfig(subject: unknown): SubjectConfig {
  return SUBJECT_CONFIG[coerceSubject(subject)];
}
