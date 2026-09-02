import { z } from "zod";

const uuidSchema = z.string().uuid();

function readFlag(argv: readonly string[], name: string) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

/** Shared fail-closed parser for scripts that create attributable drafts. */
export function parseKnowledgeDraftArgs(
  argv: readonly string[],
  options: { minimumVersion: number; defaultVersion: number },
) {
  return z
    .object({
      collectionVersion: z.number().int().min(options.minimumVersion),
      submittedBy: uuidSchema,
    })
    .parse({
      collectionVersion: Number(
        readFlag(argv, "--collection-version") ?? options.defaultVersion,
      ),
      submittedBy: readFlag(argv, "--submitted-by"),
    });
}
