import type { Metadata } from "next";
import { createTypedServerClient } from "@/lib/supabase/server";
import { ClassJoinScreen } from "@/components/class-join/ClassJoinScreen";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function ClassJoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const db = await createTypedServerClient();
  const { data, error } = await db.auth.getUser();
  return (
    <ClassJoinScreen
      initialCode={typeof code === "string" ? code.slice(0, 128) : ""}
      signedIn={!error && !!data.user}
    />
  );
}
