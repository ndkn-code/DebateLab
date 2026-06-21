import {
  BookOpen,
  Mic,
  PenLine,
  Volume2,
  type LucideIcon,
} from "@/components/ui/icons";
import type { IeltsSkill } from "@/lib/ielts/adaptive/contracts";

/** Shared skill → icon mapping for the IELTS learner dashboard surfaces. */
export const IELTS_SKILL_ICON: Record<IeltsSkill, LucideIcon> = {
  listening: Volume2,
  reading: BookOpen,
  writing: PenLine,
  speaking: Mic,
};
