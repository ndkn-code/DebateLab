const MIGRATION_PATTERN = /\b\d{14}_[A-Za-z0-9_-]+\.sql\b/g;

export function pendingMigrationNames(output: string) {
  return Array.from(new Set(output.match(MIGRATION_PATTERN) ?? []));
}
