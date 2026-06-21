export type CourseCategory = "debate" | "public-speaking";

export function normalizeCourseCategory(
  category: string | null | undefined,
): CourseCategory {
  const normalized = (category ?? "debate").trim().toLowerCase().replace(/_/g, "-");
  return normalized === "public-speaking" ? "public-speaking" : "debate";
}
