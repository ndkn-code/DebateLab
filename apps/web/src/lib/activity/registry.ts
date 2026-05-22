import type { ActivityType, ActivityPhase, ActivityContent } from "@/lib/types/admin";

export function getDefaultPhase(type: ActivityType): ActivityPhase {
  switch (type) {
    case "lesson": return "learn";
    case "flashcard": return "learn";
    case "matching": return "practice";
    case "fill_blank": return "practice";
    case "drag_order": return "practice";
    case "quiz": return "apply";
  }
}

export function getDefaultContent(type: ActivityType): ActivityContent {
  switch (type) {
    case "lesson": return { type: "article", body: "" } as ActivityContent;
    case "quiz": return { questions: [] } as ActivityContent;
    case "matching": return { pairs: [] } as ActivityContent;
    case "fill_blank": return { passages: [] } as ActivityContent;
    case "drag_order": return { items: [], instruction: "" } as ActivityContent;
    case "flashcard": return { cards: [] } as ActivityContent;
  }
}

export function getDefaultDuration(type: ActivityType): number {
  switch (type) {
    case "lesson": return 10;
    case "drag_order": return 3;
    default: return 5;
  }
}
