import assert from "node:assert/strict";
import {
  canAccessCourseRecord,
  canAccessModuleRecord,
  isSubscriptionCurrentlyActive,
  resolveEntitlementFromSubscriptions,
  type SubscriptionRecord,
} from "./entitlements";

const now = new Date("2026-05-07T12:00:00.000Z");
const future = "2026-06-07T12:00:00.000Z";
const past = "2026-04-07T12:00:00.000Z";

function subscription(
  overrides: Partial<SubscriptionRecord> = {}
): SubscriptionRecord {
  return {
    plan_type: "premium",
    status: "active",
    current_period_start: "2026-05-01T12:00:00.000Z",
    current_period_end: future,
    ...overrides,
  };
}

{
  const entitlement = resolveEntitlementFromSubscriptions([], {
    betaAllAccess: true,
    now,
  });

  assert.equal(entitlement.planType, "premium");
  assert.equal(entitlement.hasPremiumAccess, true);
  assert.equal(entitlement.source, "beta_all_access");
}

{
  const entitlement = resolveEntitlementFromSubscriptions([], {
    betaAllAccess: false,
    now,
  });

  assert.equal(entitlement.planType, "free");
  assert.equal(entitlement.hasPremiumAccess, false);
  assert.equal(
    canAccessCourseRecord({
      visibility: "premium",
      entitlement,
    }),
    false
  );
}

{
  const entitlement = resolveEntitlementFromSubscriptions([subscription()], {
    betaAllAccess: false,
    now,
  });

  assert.equal(entitlement.planType, "premium");
  assert.equal(entitlement.hasPremiumAccess, true);
  assert.equal(entitlement.source, "subscription");
}

{
  const entitlement = resolveEntitlementFromSubscriptions(
    [
      subscription({
        status: "trial",
        trial_start_date: "2026-05-01T12:00:00.000Z",
        trial_end_date: future,
      }),
    ],
    {
      betaAllAccess: false,
      now,
    }
  );

  assert.equal(entitlement.planType, "premium");
  assert.equal(entitlement.hasPremiumAccess, true);
}

{
  assert.equal(
    isSubscriptionCurrentlyActive(
      subscription({ current_period_end: past }),
      now
    ),
    false
  );
  assert.equal(
    isSubscriptionCurrentlyActive(subscription({ status: "cancelled" }), now),
    false
  );

  const entitlement = resolveEntitlementFromSubscriptions(
    [
      subscription({ current_period_end: past }),
      subscription({ status: "cancelled" }),
    ],
    {
      betaAllAccess: false,
      now,
    }
  );

  assert.equal(entitlement.planType, "free");
  assert.equal(entitlement.hasPremiumAccess, false);
}

{
  const premiumEntitlement = resolveEntitlementFromSubscriptions(
    [subscription()],
    {
      betaAllAccess: false,
      now,
    }
  );
  const freeEntitlement = resolveEntitlementFromSubscriptions([], {
    betaAllAccess: false,
    now,
  });

  assert.equal(
    canAccessCourseRecord({
      visibility: "public",
      entitlement: freeEntitlement,
    }),
    true
  );
  assert.equal(
    canAccessCourseRecord({
      visibility: "class_restricted",
      entitlement: freeEntitlement,
      hasAccessRule: true,
    }),
    true
  );
  assert.equal(
    canAccessModuleRecord({
      accessLevel: "premium",
      entitlement: premiumEntitlement,
    }),
    true
  );
  assert.equal(
    canAccessModuleRecord({
      accessLevel: "locked",
      entitlement: freeEntitlement,
    }),
    false
  );
}

console.log("Entitlement tests passed");
