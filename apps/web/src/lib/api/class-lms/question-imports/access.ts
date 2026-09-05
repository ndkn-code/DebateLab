/** Checked before service-role writes; a visible batch alone is not upload authority. */
export function assertQuestionImportUploadAccess(
  batch: { club_id: string; created_by: string; status: string; copyright_attested: boolean; copyright_attestation_version: string | null } | null,
  input: { clubId: string; actorId: string; attestationVersion: string },
) {
  if (!batch || batch.club_id !== input.clubId || batch.created_by !== input.actorId ||
      !["draft", "queued", "processing"].includes(batch.status) || !batch.copyright_attested ||
      batch.copyright_attestation_version !== input.attestationVersion) {
    throw new Error("You do not have permission to upload to this question import.");
  }
}
