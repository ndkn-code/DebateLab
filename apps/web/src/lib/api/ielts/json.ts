/**
 * A Zod schema whose inferred type is the generated `Json` (WS-1.1). Used to type
 * free-form jsonb columns (question metadata, correct-answer payloads) so they
 * are assignable to the typed RPC `Json` parameters without casts.
 */
import { z } from "zod";
import type { Json } from "@/types/supabase";

export const JsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonSchema),
    z.record(z.string(), JsonSchema),
  ]),
);
