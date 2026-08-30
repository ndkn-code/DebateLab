export function encodeGradebookCursor(userId: string, classId: string, clubId: string): string {
  return Buffer.from(JSON.stringify({ userId, classId, clubId }), "utf8").toString("base64url");
}

export function decodeGradebookCursor(cursor: string | null | undefined, classId: string, clubId: string): string | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { userId?: unknown; classId?: unknown; clubId?: unknown };
    if (parsed.classId !== classId || parsed.clubId !== clubId || typeof parsed.userId !== "string") throw new Error("Invalid IELTS gradebook cursor");
    return parsed.userId;
  } catch { throw new Error("Invalid IELTS gradebook cursor"); }
}

export function isCurrentResponseRevision(reviewRevision: number, responseRevision: number): boolean {
  return reviewRevision === responseRevision;
}

export function reviewRevisionKey(responseId: string, revision: number): string {
  return `${responseId}:${revision}`;
}

export function officialOverallVisibility(input: {
  listening: number | null;
  reading: number | null;
  writing: number | null;
  speaking: number | null;
  overall: number | null;
  flaggedProvisional?: boolean;
}) {
  const skillCount = [input.listening, input.reading, input.writing, input.speaking]
    .filter((band) => band !== null).length;
  const overallIsProvisional = skillCount < 4 || Boolean(input.flaggedProvisional);
  return { skillCount, overallIsProvisional, overall: overallIsProvisional ? null : input.overall };
}
