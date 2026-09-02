begin;

-- Backfill only. All preparatory DDL committed in 20260901200000 and all final
-- constraints/functions follow in 20260901202000, avoiding pending-trigger
-- failures from ALTER TABLE after data-changing statements.
update public.ai_grading_verified_withdrawal_receipts
set
  study_actor_key = 'legacy.actor.' || pg_catalog.substr(
    pg_catalog.encode(extensions.digest(withdrawn_by::text, 'sha256'), 'hex'),
    1,
    32
  ),
  actor_kind = case reason_code
    when 'participant_withdrawal' then 'participant'
    when 'guardian_withdrawal' then 'guardian'
    when 'rights_revoked' then 'rights_controller'
    else 'retention_controller'
  end,
  request_key = 'legacy.request.' || pg_catalog.substr(
    pg_catalog.encode(extensions.digest(id::text, 'sha256'), 'hex'),
    1,
    32
  ),
  verification_version = 'legacy_profile_v1',
  legacy_operator_profile_sha256 = pg_catalog.encode(
    extensions.digest(verified_by::text, 'sha256'),
    'hex'
  );

update public.ai_grading_benchmark_withdrawals withdrawal
set
  study_actor_key = coalesce(
    receipt.study_actor_key,
    'legacy.actor.' || pg_catalog.substr(
      pg_catalog.encode(extensions.digest(withdrawal.withdrawn_by::text, 'sha256'), 'hex'),
      1,
      32
    )
  ),
  actor_kind = coalesce(
    receipt.actor_kind,
    case withdrawal.reason_code
      when 'participant_withdrawal' then 'participant'
      when 'guardian_withdrawal' then 'guardian'
      when 'rights_revoked' then 'rights_controller'
      else 'retention_controller'
    end
  ),
  verified_receipt_id = receipt.id
from public.ai_grading_verified_withdrawal_receipts receipt
where receipt.benchmark_id = withdrawal.benchmark_id;

update public.ai_grading_benchmark_withdrawals withdrawal
set
  study_actor_key = 'legacy.actor.' || pg_catalog.substr(
    pg_catalog.encode(extensions.digest(withdrawal.withdrawn_by::text, 'sha256'), 'hex'),
    1,
    32
  ),
  actor_kind = case withdrawal.reason_code
    when 'participant_withdrawal' then 'participant'
    when 'guardian_withdrawal' then 'guardian'
    when 'rights_revoked' then 'rights_controller'
    else 'retention_controller'
  end
where study_actor_key is null;

commit;
