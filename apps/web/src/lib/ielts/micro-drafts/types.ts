import type { Tables } from "@/types/supabase";

export type MicroItemDraftRow = Tables<"ielts_micro_item_drafts">;

export interface MicroItemDraftView {
  draft: MicroItemDraftRow;
  sourceLabel: string;
  publishedActivityTitle: string | null;
}

export interface MicroItemPublishTarget {
  moduleId: string;
  moduleTitle: string;
  courseId: string;
  courseTitle: string;
}
