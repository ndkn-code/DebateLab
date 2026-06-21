-- =============================================================================
-- WS-6.3a — B2C IELTS skill-drill plan items
-- =============================================================================
-- Adds an explicit study-plan kind for item-bank drills assembled from
-- published IELTS questions. A skill_drill is test-backed, so it must carry an
-- ielts_test_id just like mini/full mocks — that reference CHECK lives in a
-- SEPARATE migration (…_constraint.sql) because Postgres forbids referencing a
-- newly-added enum value within the same transaction that introduced it.
-- =============================================================================

alter type public.ielts_plan_item_kind
  add value if not exists 'skill_drill' after 'review';
