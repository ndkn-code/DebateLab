import { z } from "zod";

/**
 * PostgreSQL accepts every canonical 128-bit UUID representation. This is
 * intentionally a little broader than Zod's RFC-version-aware `uuid()` check:
 * DebateLab uses deterministic MD5-derived UUID values for first-party seeded
 * content. Database constraints and RLS remain authoritative for existence,
 * ownership, and access.
 */
export const PostgresUuidSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "Invalid UUID",
  );
