# Question import operations

This runbook covers the operational controls around organization-owned document imports.
It complements, but does not replace, organization contracts or advice from Vietnamese
legal counsel.

## Production launch gates

Keep document-to-question import disabled in production until all of the following are
recorded and approved by the operator:

- the LlamaParse data-processing agreement, processing region, and subprocessors;
- the Vietnam personal-data processing and cross-border transfer impact records;
- encryption, retention, deletion, incident-response, and data-subject request procedures;
- B2B controller/processor terms and the organization's authority to upload materials;
- a monitored copyright contact at `NEXT_PUBLIC_COPYRIGHT_EMAIL`.

The three existing ingest/finalize/retry routes and the private worker require both
`LMS_QUESTION_IMPORT_ENABLED=true` and `LMS_QUESTION_IMPORT_COMPLIANCE_APPROVED=true`.
`NEXT_PUBLIC_LMS_QUESTION_IMPORT_ENABLED` controls the UI only; it does not authorize
server work. Keep all three false until launch review is complete. A worker with either
server flag disabled refuses an import before claiming its lease. Drain or retain queued
messages deliberately when disabling the feature; a flag change does not erase content
or necessarily cancel an already running provider request.

Legal and vendor review should use the current primary references, including Vietnam's
[copyright intermediary guidance](https://cspl.mic.gov.vn/Pages/TinTuc/138697/Doanh-nghiep-cung-cap-dich-vu-trung-gian-theo-quy-dinh--cua-phap-luat-ve-so-huu-tri-tue.html),
[Law 91/2025/QH15 on personal data protection](https://congbao.chinhphu.vn/van-ban/luat-so-91-2025-qh15-45578.htm),
and [Decree 356/2025/ND-CP](https://thuvienphapluat.vn/van-ban/EN/Cong-nghe-thong-tin/Decree-356-2025-ND-CP-elaborating-on-certain-articles-of-Law-on-personal-data-protection/689146/tieng-anh.aspx).

## Copyright notice handling

1. Acknowledge receipt through the monitored copyright channel and open an audit record.
2. Identify every source document, draft, published bank item, organization, and derivative
   linked by source hash or import provenance.
3. Quarantine the identified records so they are unavailable to organization members while
   the request is assessed. Do not destroy the audit trail.
4. Notify the uploader and organization administrators using the contact information already
   held for their accounts. Record the notice and any evidence supplied.
5. Apply the removal, objection, restoration, and authority-order timelines approved by
   Vietnamese counsel. Store every transition and actor in the copyright event ledger.
6. When removal is final, delete private source and intermediate artifacts and tombstone the
   affected bank items. Retain only the minimum audit evidence required by law and policy.

Platform administrators may quarantine content even when an organization chose to retain the
source until manual deletion. The upload checkbox is evidence of the uploader's confirmation;
it is not a substitute for this process.

## Personal-data and deletion requests

Requests must be correlated across Supabase Storage, LMS material versions, import drafts,
provider request audits, and published bank provenance. Quarantine immediately hides the
batch's bank items, keys, and stimuli. Restore reinstates the prior processing/review state.
Deletion is a final tombstone; it cannot be restored through the source-action RPC.
Other batches sharing a collection remain available.

A deletion request does **not** itself erase Storage objects or the provider's copy.
After the lead has marked the batch deleted, run this command inside the existing private
worker image with its scoped service credentials:

```sh
node src/question-import-cleanup.mjs BATCH_UUID
```

The command validates organization/material/version bindings, active leases, and every
Storage path before deletion. It refuses shared source bindings. It deletes originals,
ingest objects and previews, then scrubs parser results, draft/bank payloads, private keys,
and dedicated stimuli. It retains IDs, source hashes/page evidence, usage and compliance
records. Multiple-document cleanup and reruns are supported. A completion event records
`storage_cleanup_completed: true` and `provider_deletion_verified: false` only after the
local cleanup succeeds. Schedule and monitor this private command operationally; there is
no new Vercel endpoint or automatically scheduled cleanup in this patch. Fulfil and record
provider deletion separately, and agree the audit-record retention period with counsel.

The [LlamaParse v2 create reference](https://developers.api.llamaindex.ai/api/python/resources/parsing/methods/create/)
defines `disable_cache` as bypassing result caching. This setting is **not evidence of zero
retention or provider deletion**. Confirm those obligations in the vendor agreement.
The adapter uses short-lived signed URLs, English/Vietnamese OCR, local PDF size/page
inspection and returned usage metadata. Pin `LLAMAPARSE_VERSION` to an evaluated dated
version before launch; the fallback `latest` can change extraction behavior. Parser output
is untrusted, and requires teacher review, a confirmed objective key and lead publication.

## Retry and provider reconciliation

Quota claims lock the organization entitlement and reuse a single reservation identity.
Successful persistence consumes that reservation in its original billing month. In-flight
jobs count across month boundaries. The application ledger is a quota ledger; the raw
provider usage fields still need reconciliation against the vendor invoice, including failed
or cancelled jobs that may have incurred charges.

The worker persists a `submitting` marker before the paid POST and a provider job ID after
acknowledgement. Delivery retries poll that ID. If acknowledgement is lost, the worker
raises `LLAMAPARSE_SUBMIT_AMBIGUOUS` and will not automatically submit a second paid job.
An operator must correlate the source hash, submission time and provider audit records.
If a job exists, attach the verified provider ID to the bound document through the private
administrative workflow and retry the existing material version. Clear an ambiguous marker
only after the provider confirms that no job was created; record the evidence. Do not
blindly clear a provider job ID to retry a failed parse. Terminal failed provider jobs retain
their identity and usage; an intentional new parse requires an explicit operator decision.

Publication receipts bind the batch, collection and exact sorted item IDs. Replaying a
successful final publication returns the original result, including after reload. A partial
publication keeps the remaining items submitted. Returning changes requires a lead reason.


## Monitoring

Alert on repeated provider authentication failures, HTTP 402/429 responses, dead-lettered
jobs, quota reservation mismatches, cross-organization authorization denials, and imports
that remain in a processing state beyond their lease and retry window. Review provider cost
per page, teacher correction rate, and publication rate before changing trial quotas.
