"use server";

import { createClient } from "@/lib/supabase/server";
import { enrollInCourse, markLessonComplete } from "@/lib/api/courses";
import { revalidatePath } from "next/cache";

export async function enrollAction(courseId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  await enrollInCourse(user.id, courseId);
  revalidatePath("/courses");
  revalidatePath("/dashboard");
}

export async function markLessonCompleteAction(
  lessonId: string,
  courseId: string,
  score?: number,
  timeSpentSeconds?: number
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const result = await markLessonComplete(
    user.id,
    lessonId,
    courseId,
    score,
    timeSpentSeconds
  );

  revalidatePath("/courses");
  revalidatePath("/dashboard");

  return result;
}
