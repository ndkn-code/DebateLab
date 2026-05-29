import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { LeaderboardsPage } from "@/components/leaderboards/leaderboards-page";
import { ProtectedShell } from "../../(protected)/protected-shell";
import { DEV_ADMIN_PROFILE } from "@/lib/dev-admin-bypass";
import {
  makeMockLeaderboardPageData,
  type LeaderboardFixtureState,
} from "@/lib/leaderboards/fixtures";

const QA_USER_ID = DEV_ADMIN_PROFILE.id;

function isLocalhostHost(host: string) {
  const normalizedHost = host.toLowerCase();
  return (
    normalizedHost === "localhost" ||
    normalizedHost.startsWith("localhost:") ||
    normalizedHost === "127.0.0.1" ||
    normalizedHost.startsWith("127.0.0.1:") ||
    normalizedHost === "[::1]" ||
    normalizedHost.startsWith("[::1]:")
  );
}

function getFixtureState(
  value: string | string[] | undefined
): LeaderboardFixtureState {
  const state = Array.isArray(value) ? value[0] : value;

  if (
    state === "promotion" ||
    state === "promotion-100" ||
    state === "demotion" ||
    state === "demotion-100" ||
    state === "champion" ||
    state === "held" ||
    state === "held-down" ||
    state === "outside" ||
    state === "empty" ||
    state === "low-pop"
  ) {
    return state;
  }

  return "normal";
}

export default async function LeaderboardsQaRoute({
  searchParams,
}: {
  searchParams: Promise<{
    state?: string | string[];
    motion?: string | string[];
    review?: string | string[];
  }>;
}) {
  const host = (await headers()).get("host") ?? "";
  if (process.env.NODE_ENV !== "development" || !isLocalhostHost(host)) {
    notFound();
  }

  const params = await searchParams;
  const state = getFixtureState(params.state);
  const motion = Array.isArray(params.motion) ? params.motion[0] : params.motion;
  const review = Array.isArray(params.review) ? params.review[0] : params.review;
  const data = makeMockLeaderboardPageData({
    viewerUserId: QA_USER_ID,
    state,
  });

  return (
    <ProtectedShell
      profile={DEV_ADMIN_PROFILE}
      userEmail={DEV_ADMIN_PROFILE.email}
      userId={QA_USER_ID}
      seasonReplayEnabled
      seasonReplayOutcome={data.personal.outcome}
      seasonReplayReducedMotionOverride={motion === "reduce"}
      seasonReplayReviewMode={review === "1" || review === "true"}
    >
      <LeaderboardsPage
        data={data}
        viewerUserId={QA_USER_ID}
        seasonReplayEnabled
        reducedMotionOverride={motion === "reduce"}
        seasonReplayReviewMode={review === "1" || review === "true"}
        socialSignalsEnabled
        analyticsEnabled
        mockActionsEnabled
      />
    </ProtectedShell>
  );
}
