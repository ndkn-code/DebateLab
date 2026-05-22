export interface MarkdownRendererProps {
  content: string;
  size?: "sm" | "base" | "lg" | "xl";
  className?: string;
}

export interface CoursePathItem {
  id: string;
  title: string;
  description?: string | null;
  kind: "lesson" | "activity";
  typeKey: string;
  typeLabel: string;
  durationMinutes: number;
  href: string | null;
  completed: boolean;
  active: boolean;
  locked: boolean;
}

export interface CoursePathSection {
  id: string;
  title: string;
  description?: string | null;
  items: CoursePathItem[];
  completedCount: number;
  trackableCount: number;
  totalItemCount: number;
  progressPercent: number;
}
