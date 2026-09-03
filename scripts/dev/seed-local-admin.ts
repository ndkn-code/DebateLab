import path from "node:path";
import { fileURLToPath } from "node:url";
import type { User } from "@supabase/supabase-js";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function assertLoopbackSupabaseUrl(value: string | undefined): URL {
  if (!value) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required.");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be a valid URL.");
  }

  if (!LOOPBACK_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error("Refusing to seed a non-loopback Supabase URL.");
  }

  return url;
}

function requiredEnv(name: "LOCAL_ADMIN_EMAIL" | "LOCAL_ADMIN_PASSWORD") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

export async function seedLocalAdmin() {
  const url = assertLoopbackSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required.");

  const email = requiredEnv("LOCAL_ADMIN_EMAIL");
  const password = requiredEnv("LOCAL_ADMIN_PASSWORD");
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url.toString(), serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let page = 1;
  let existing: User | undefined;
  do {
    const { data: listed, error: listError } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (listError) throw new Error(`Could not list local users: ${listError.message}`);
    existing = listed.users.find(
      (user) => user.email?.toLowerCase() === email.toLowerCase(),
    );
    if (existing || listed.nextPage === null) break;
    page = listed.nextPage;
  } while (true);

  const { data: authData, error: authError } = existing
    ? await supabase.auth.admin.updateUserById(existing.id, { email, password, email_confirm: true })
    : await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (authError || !authData.user) {
    throw new Error(`Could not seed local admin auth user: ${authError?.message ?? "unknown error"}`);
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    { id: authData.user.id, email, display_name: "Local Admin", role: "admin" },
    { onConflict: "id" },
  );
  if (profileError) throw new Error(`Could not seed local admin profile: ${profileError.message}`);

  console.log(`Seeded local admin ${email} at ${url.origin}.`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === path.resolve(fileURLToPath(import.meta.url))) {
  seedLocalAdmin().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
