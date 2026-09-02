# IELTS benchmark withdrawal operator runbook

This procedure is for a study lead responding to a participant, guardian,
rights-holder, or retention withdrawal. A participant or guardian never needs
a DebateLab account. The only participant identity stored in the benchmark
database is a random, study-scoped `studyActorKey` held in the offline consent
mapping.

## Trust boundary

- The withdrawal requester proves control through the study's off-platform
  identity procedure. Do not ask them to create a product account.
- One operator verifies the request. A different authorized staff member must
  already have verified that operator's DebateLab profile and Ed25519 public
  key in `ai_grading_withdrawal_operator_keys`.
- Register keys, revocations, and verified receipts only through a direct,
  audited database-owner connection. Never use the Supabase service-role key,
  a web route, an application worker, or a browser SQL client carrying an
  application token.
- The service role can consume a pre-registered receipt but has no `SELECT` or
  write privilege on the receipt or operator-key registries. It therefore
  cannot invent a requester, receipt, operator key, or signature.

PostgreSQL stores and hashes the canonical signed payload, but it cannot
cryptographically verify Ed25519 in the extensions currently approved for this
project. The operator must verify the Ed25519 signature with the registered
public key offline before inserting the receipt. The database-owner-only insert
boundary and immutable registry preserve that independent verification. Do not
weaken this by granting registry writes to `service_role`.

## One-time key registration

1. Confirm the operator and credential verifier are different people and each
   profile belongs to the expected staff member.
2. Verify the key fingerprint through a second channel. Record the
   verification evidence as a SHA-256 receipt without raw identity documents.
3. In a database-owner transaction, insert one immutable
   `ai_grading_withdrawal_operator_keys` row. Use a validity period appropriate
   to the study. Key rotation creates another row; it never edits the old one.
4. To revoke a key, insert an immutable
   `ai_grading_withdrawal_operator_key_revocations` row. Never update or delete
   the key.

The database rejects self-verification because `operator_profile_id` must
differ from `credential_verified_by_profile_id`.

## Verify and register a withdrawal

1. Locate the offline consent record and resolve the request to its random
   `studyActorKey`. Confirm the actor kind and authority:
   `participant`, `guardian`, `rights_controller`, or `retention_controller`.
2. Create a unique pseudonymous `requestKey`. Hash the original request or
   signed withdrawal form as `receiptSha256`. Do not place names, email
   addresses, phone numbers, document numbers, or free-form reasons in the
   database.
3. Build this JSON object with exactly the registered values:

   ```json
   {
     "schema": "debatelab.ielts.withdrawal.v2",
     "benchmarkId": "00000000-0000-0000-0000-000000000000",
     "studyActorKey": "study.actor.random-pseudonym",
     "actorKind": "participant",
     "reasonCode": "participant_withdrawal",
     "receiptSha256": "64-lowercase-hex-characters",
     "requestKey": "study.withdrawal.random-request-key",
     "operatorKeyId": "study-operator-key.2026-01"
   }
   ```

4. Canonicalize the value exactly as PostgreSQL `jsonb::text`, calculate its
   SHA-256, and verify the Ed25519 signature offline. Save only the payload,
   payload hash, signature, and source receipt hash. Do not save the withdrawal
   form itself in Supabase.
5. Through the database-owner connection, start a transaction and lock the
   benchmark row. Recheck that the benchmark and operator key are active and
   that no withdrawal already exists. Insert the signed v2 receipt with an
   `expires_at` no later than seven days after `verified_at`, then commit.
6. Invoke `withdraw_ai_grading_benchmark(benchmark_id, receipt_id)` through the
   application operations identity. The first call appends the withdrawal and
   deactivates the benchmark. An exact retry returns `true` without another
   side effect. A different receipt, an expired unconsumed receipt, a revoked
   key, or a legacy unsigned receipt fails closed.
7. Confirm `ai_grading_benchmarks.is_active = false` using the database-owner
   connection. Then perform storage deletion or legal-retention actions under
   the study DPA. Those artifact actions are intentionally outside this RPC.

## Incident handling

- If offline signature verification fails, do not insert anything. Preserve
  the request in the approved study case-management system and escalate.
- If the registry insert fails, do not bypass the constraints. Recompute the
  canonical payload and confirm all identifiers and validity times.
- If the RPC reports an expired or revoked key, issue and independently verify
  a new signed receipt. Do not edit or delete the old receipt.
- Migration of an old profile-bound receipt intentionally produces
  `legacy_profile_v1`. It remains an audit/idempotency record only. It cannot
  authorize a new withdrawal and must be re-verified as signed v2.

## Explicit limitations

- Database integrity proves that the application service could not forge the
  verification. It does not prove the off-platform identity check was correct.
- Ed25519 verification is an operator responsibility until an approved database
  extension or independent signing service is adopted.
- Withdrawal deactivates the evaluation label. Erasure of encrypted audio,
  transcripts, backups, and the offline identity mapping remains a separately
  audited retention process.
