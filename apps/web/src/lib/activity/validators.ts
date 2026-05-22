import type { ActivityType, ActivityContent, QuizContent, MatchingContent, FillBlankContent, DragOrderContent, FlashcardContent, LessonContent } from "@/lib/types/admin";

type ValidationResult = { valid: boolean; errors: string[] };

function validateQuiz(content: QuizContent): ValidationResult {
  const errors: string[] = [];
  if (!content.questions || content.questions.length === 0) errors.push("At least 1 question required");
  content.questions?.forEach((q, i) => {
    if (!q.question?.trim()) errors.push(`Question ${i + 1}: text is empty`);
    if (q.type === "multiple_choice") {
      if (!q.options || q.options.length < 2) errors.push(`Question ${i + 1}: at least 2 options`);
      if (!q.correctAnswer) errors.push(`Question ${i + 1}: select correct answer`);
    }
    if (!q.explanation?.trim()) errors.push(`Question ${i + 1}: explanation is empty`);
  });
  return { valid: errors.length === 0, errors };
}

function validateMatching(content: MatchingContent): ValidationResult {
  const errors: string[] = [];
  if (!content.pairs || content.pairs.length < 2) errors.push("At least 2 pairs required");
  content.pairs?.forEach((p, i) => {
    if (!p.left?.trim()) errors.push(`Pair ${i + 1}: left side is empty`);
    if (!p.right?.trim()) errors.push(`Pair ${i + 1}: right side is empty`);
  });
  return { valid: errors.length === 0, errors };
}

function validateFillBlank(content: FillBlankContent): ValidationResult {
  const errors: string[] = [];
  if (!content.passages || content.passages.length === 0) errors.push("At least 1 passage required");
  content.passages?.forEach((p, i) => {
    if (!p.text?.trim()) errors.push(`Passage ${i + 1}: text is empty`);
    const blanksInText = (p.text?.match(/__BLANK_\d+__/g) ?? []).length;
    if (blanksInText === 0) errors.push(`Passage ${i + 1}: no blanks found`);
    p.blanks?.forEach((b, j) => {
      if (!b.answer?.trim()) errors.push(`Passage ${i + 1}, Blank ${j + 1}: answer is empty`);
    });
  });
  return { valid: errors.length === 0, errors };
}

function validateDragOrder(content: DragOrderContent): ValidationResult {
  const errors: string[] = [];
  if (!content.items || content.items.length < 2) errors.push("At least 2 items required");
  content.items?.forEach((item, i) => {
    if (!item.text?.trim()) errors.push(`Item ${i + 1}: text is empty`);
  });
  return { valid: errors.length === 0, errors };
}

function validateFlashcard(content: FlashcardContent): ValidationResult {
  const errors: string[] = [];
  if (!content.cards || content.cards.length === 0) errors.push("At least 1 card required");
  content.cards?.forEach((c, i) => {
    if (!c.front?.trim()) errors.push(`Card ${i + 1}: front is empty`);
    if (!c.back?.trim()) errors.push(`Card ${i + 1}: back is empty`);
  });
  return { valid: errors.length === 0, errors };
}

function validateLesson(content: LessonContent): ValidationResult {
  const errors: string[] = [];
  if (content.type === "article" && !content.body?.trim()) errors.push("Article body is empty");
  if (content.type === "video" && !content.video_url?.trim()) errors.push("Video URL is required");
  return { valid: errors.length === 0, errors };
}

export function validateActivityContent(type: ActivityType, content: ActivityContent): ValidationResult {
  switch (type) {
    case "quiz": return validateQuiz(content as QuizContent);
    case "matching": return validateMatching(content as MatchingContent);
    case "fill_blank": return validateFillBlank(content as FillBlankContent);
    case "drag_order": return validateDragOrder(content as DragOrderContent);
    case "flashcard": return validateFlashcard(content as FlashcardContent);
    case "lesson": return validateLesson(content as LessonContent);
  }
}
