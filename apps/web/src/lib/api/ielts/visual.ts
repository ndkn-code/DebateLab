/**
 * Typed `visual` JSON for IELTS questions (WS-1.1).
 *
 * Re-expresses Lumist's lesson-chunk visual union (image / table / chart) in our
 * stack so diagram-label, map/plan-label, and Writing-Task-1 data questions can
 * carry structured stimulus. Stored in the non-secret `ielts_questions.visual`
 * jsonb column; rendered by WS-1.2 (out of scope here — we only author + store).
 */
import { z } from "zod";

const ImageVisualSchema = z.object({
  type: z.literal("image"),
  url: z.string().url(),
  alt: z.string().min(1).max(500),
  caption: z.string().max(500).optional(),
});

const TableVisualSchema = z.object({
  type: z.literal("table"),
  headers: z.array(z.string().max(200)).max(20),
  rows: z.array(z.array(z.string().max(500)).max(20)).max(60),
  caption: z.string().max(500).optional(),
});

const ChartSeriesSchema = z.object({
  dataKey: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
});

const ChartVisualSchema = z.object({
  type: z.literal("chart"),
  chartType: z.enum(["line", "bar", "area", "pie"]),
  title: z.string().max(200).optional(),
  xAxisKey: z.string().max(80).optional(),
  // Each datum is an object of string|number keys (Recharts-shaped, kept generic).
  data: z.array(z.record(z.string(), z.union([z.string(), z.number()]))).max(200),
  series: z.array(ChartSeriesSchema).max(12),
});

/**
 * Free-form "describe the visual" fallback — Task-1 prompts where the teacher
 * pastes a textual description rather than structured data (template column
 * "Visual/Data (Task 1 Academic — describe or attach)").
 */
const DescribedVisualSchema = z.object({
  type: z.literal("described"),
  description: z.string().min(1).max(4000),
});

export const VisualSchema = z.discriminatedUnion("type", [
  ImageVisualSchema,
  TableVisualSchema,
  ChartVisualSchema,
  DescribedVisualSchema,
]);

export type IeltsVisual = z.infer<typeof VisualSchema>;
