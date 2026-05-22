#!/usr/bin/env tsx
// Run with: npx tsx src/lib/seed/run-seed.ts

import { createClient } from "@supabase/supabase-js";
import { SEED_COURSES } from "./courses";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seed() {
  console.log(`Seeding ${SEED_COURSES.length} courses...\n`);

  for (const course of SEED_COURSES) {
    // Upsert course (use slug as unique identifier)
    const { data: existingCourse } = await supabase
      .from("courses")
      .select("id")
      .eq("slug", course.slug)
      .single();

    let courseId: string;

    if (existingCourse) {
      // Update existing course
      const { data, error } = await supabase
        .from("courses")
        .update({
          title: course.title,
          description: course.description,
          category: course.category,
          difficulty: course.difficulty,
          estimated_hours: course.estimated_hours,
          is_published: course.is_published,
        })
        .eq("id", existingCourse.id)
        .select("id")
        .single();

      if (error) throw new Error(`Failed to update course "${course.title}": ${error.message}`);
      courseId = data!.id;
      console.log(`  ↻ Updated course: ${course.title}`);
    } else {
      // Insert new course
      const { data, error } = await supabase
        .from("courses")
        .insert({
          title: course.title,
          slug: course.slug,
          description: course.description,
          category: course.category,
          difficulty: course.difficulty,
          estimated_hours: course.estimated_hours,
          is_published: course.is_published,
        })
        .select("id")
        .single();

      if (error) throw new Error(`Failed to insert course "${course.title}": ${error.message}`);
      courseId = data!.id;
      console.log(`  ✓ Created course: ${course.title}`);
    }

    // Seed modules
    for (const mod of course.modules) {
      const { data: existingModule } = await supabase
        .from("course_modules")
        .select("id")
        .eq("course_id", courseId)
        .eq("order_index", mod.order_index)
        .single();

      let moduleId: string;

      if (existingModule) {
        const { data, error } = await supabase
          .from("course_modules")
          .update({
            title: mod.title,
            description: mod.description,
            order_index: mod.order_index,
          })
          .eq("id", existingModule.id)
          .select("id")
          .single();

        if (error) throw new Error(`Failed to update module "${mod.title}": ${error.message}`);
        moduleId = data!.id;
      } else {
        const { data, error } = await supabase
          .from("course_modules")
          .insert({
            course_id: courseId,
            title: mod.title,
            description: mod.description,
            order_index: mod.order_index,
          })
          .select("id")
          .single();

        if (error) throw new Error(`Failed to insert module "${mod.title}": ${error.message}`);
        moduleId = data!.id;
      }

      console.log(`    ├─ Module: ${mod.title}`);

      // Seed lessons
      for (const lesson of mod.lessons) {
        const { data: existingLesson } = await supabase
          .from("lessons")
          .select("id")
          .eq("module_id", moduleId)
          .eq("slug", lesson.slug)
          .single();

        let lessonId: string;

        if (existingLesson) {
          const { data, error } = await supabase
            .from("lessons")
            .update({
              title: lesson.title,
              type: lesson.type,
              content: lesson.content,
              video_url: lesson.video_url,
              duration_minutes: lesson.duration_minutes,
              order_index: lesson.order_index,
              is_published: lesson.is_published,
            })
            .eq("id", existingLesson.id)
            .select("id")
            .single();

          if (error) throw new Error(`Failed to update lesson "${lesson.title}": ${error.message}`);
          lessonId = data!.id;
        } else {
          const { data, error } = await supabase
            .from("lessons")
            .insert({
              module_id: moduleId,
              title: lesson.title,
              slug: lesson.slug,
              type: lesson.type,
              content: lesson.content,
              video_url: lesson.video_url,
              duration_minutes: lesson.duration_minutes,
              order_index: lesson.order_index,
              is_published: lesson.is_published,
            })
            .select("id")
            .single();

          if (error) throw new Error(`Failed to insert lesson "${lesson.title}": ${error.message}`);
          lessonId = data!.id;
        }

        console.log(`    │  ├─ ${lesson.type}: ${lesson.title}`);

        // Seed quiz questions if present
        const questions = (lesson.content as { questions?: Array<{
          question_text: string;
          question_type: string;
          options: string[];
          correct_answer: string;
          explanation: string;
        }> }).questions;

        if (questions && questions.length > 0) {
          // Delete existing questions for this lesson and re-insert
          await supabase
            .from("quiz_questions")
            .delete()
            .eq("lesson_id", lessonId);

          const questionRows = questions.map((q, i) => ({
            lesson_id: lessonId,
            question_text: q.question_text,
            question_type: q.question_type,
            options: q.options,
            correct_answer: q.correct_answer,
            explanation: q.explanation,
            order_index: i,
          }));

          const { error } = await supabase
            .from("quiz_questions")
            .insert(questionRows);

          if (error) throw new Error(`Failed to insert quiz questions for "${lesson.title}": ${error.message}`);
          console.log(`    │  │  └─ ${questions.length} questions`);
        }
      }
    }

    console.log("");
  }

  console.log("Seeding complete!");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
