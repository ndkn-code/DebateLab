#!/usr/bin/env tsx
// Run with: npx tsx src/lib/seed/run-library-mock-seed.ts

import { createClient } from "@supabase/supabase-js";
import { seedLibraryMockCourses } from "./seed-library-mock-courses";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seed() {
  const result = await seedLibraryMockCourses(supabase, { logger: console });

  console.log("");
  console.log(
    `Seed complete. Created ${result.createdCourseSlugs.length} course(s), updated ${result.updatedCourseSlugs.length} course(s).`
  );
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
