export interface SeedCourse {
  title: string;
  slug: string;
  description: string;
  category: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  estimated_hours: number;
  is_published: boolean;
  modules: SeedModule[];
}

export interface SeedModule {
  title: string;
  description: string;
  order_index: number;
  lessons: SeedLesson[];
}

export interface SeedLesson {
  title: string;
  slug: string;
  type: "article" | "video" | "quiz" | "practice";
  content: Record<string, unknown>;
  video_url: string | null;
  duration_minutes: number;
  order_index: number;
  is_published: boolean;
}

function createPlaceholderCourse(config: {
  title: string;
  slug: string;
  description: string;
  category: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedHours: number;
  moduleCount: number;
  lessonPrefix: string;
}) {
  const modules: SeedModule[] = Array.from({ length: config.moduleCount }, (_, index) => {
    const moduleNumber = index + 1;
    const lessonTitle =
      index === 0
        ? `${config.lessonPrefix} Fundamentals`
        : `${config.lessonPrefix} ${moduleNumber}`;

    return {
      title: `Module ${moduleNumber}`,
      description: `Placeholder module ${moduleNumber} for ${config.title}.`,
      order_index: index,
      lessons: [
        {
          title: lessonTitle,
          slug: `${config.slug}-lesson-${moduleNumber}`,
          type: "article",
          video_url: null,
          duration_minutes: 10 + (index % 3) * 4,
          order_index: 0,
          is_published: true,
          content: {
            markdown: `# ${lessonTitle}

This is placeholder content for **${config.title}**.

## What this lesson is for

This mock lesson exists so the course card is fully clickable and the course reader has real database-backed content to render.

## What you can expect later

- Real lesson copy
- More examples
- Better sequencing and activities

## For now

Use this course to review the layout, spacing, navigation, and overall browsing experience while we continue filling in the full curriculum.`,
          },
        },
      ],
    };
  });

  return {
    title: config.title,
    slug: config.slug,
    description: config.description,
    category: config.category,
    difficulty: config.difficulty,
    estimated_hours: config.estimatedHours,
    is_published: true,
    modules,
  } satisfies SeedCourse;
}

export const LIBRARY_MOCK_COURSES: SeedCourse[] = [
  createPlaceholderCourse({
    title: "Public Speaking Mastery",
    slug: "public-speaking-mastery",
    description: "Speak with confidence and deliver powerful, memorable speeches.",
    category: "public-speaking",
    difficulty: "beginner",
    estimatedHours: 3,
    moduleCount: 8,
    lessonPrefix: "Speaking Skills",
  }),
  createPlaceholderCourse({
    title: "Logic & Critical Thinking",
    slug: "logic-and-critical-thinking",
    description: "Sharpen your reasoning and learn to spot strong vs. weak arguments.",
    category: "debate",
    difficulty: "beginner",
    estimatedHours: 4,
    moduleCount: 10,
    lessonPrefix: "Logic Builder",
  }),
  createPlaceholderCourse({
    title: "Advanced Debate Strategies",
    slug: "advanced-debate-strategies",
    description: "Master advanced techniques and outsmart your opponents.",
    category: "debate",
    difficulty: "intermediate",
    estimatedHours: 5,
    moduleCount: 14,
    lessonPrefix: "Strategy Lab",
  }),
  createPlaceholderCourse({
    title: "Rebuttals That Win Arguments",
    slug: "rebuttals-that-win-arguments",
    description: "Learn how to dismantle opposing arguments and present effective rebuttals.",
    category: "debate",
    difficulty: "intermediate",
    estimatedHours: 4,
    moduleCount: 9,
    lessonPrefix: "Rebuttal Studio",
  }),
];
