import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function getOrganizationSetupVersion(
  organizationId: string,
): Promise<number | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clubs")
    .select("setup_version")
    .eq("id", organizationId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to load organization setup version: ${error.message}`,
    );
  }

  return data?.setup_version ?? null;
}
