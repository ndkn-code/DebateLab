import type { SupabaseClient } from "@supabase/supabase-js";

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function ensureUniqueSlug(slug: string, supabase: SupabaseClient, excludeId?: string): Promise<string> {
  let candidate = slug;
  let counter = 1;

  while (true) {
    let query = supabase.from("courses").select("id").eq("slug", candidate);
    if (excludeId) query = query.neq("id", excludeId);
    const { data } = await query.limit(1);
    if (!data || data.length === 0) return candidate;
    counter++;
    candidate = `${slug}-${counter}`;
  }
}
