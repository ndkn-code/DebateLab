import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LeaderboardsPage } from "@/components/leaderboards/leaderboards-page";
import { ProtectedShell } from "../../(protected)/protected-shell";
import { DEV_ADMIN_PROFILE } from "@/lib/dev-admin-bypass";
import {
  makeMockLeaderboardPageData,
  type LeaderboardFixtureState,
} from "@/lib/leaderboards/fixtures";
import { coerceLeaderboardLanguage } from "@/lib/leaderboards/model";
import { DevQaToolbar, devQaActiveChipClass, devQaChipClass } from "../dev-v2";

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
  params: routeParams,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
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

  const [{ locale }, params] = await Promise.all([routeParams, searchParams]);
  const leaderboardLanguage = coerceLeaderboardLanguage(locale);
  const state = getFixtureState(params.state);
  const motion = Array.isArray(params.motion) ? params.motion[0] : params.motion;
  const review = Array.isArray(params.review) ? params.review[0] : params.review;
  const data = makeMockLeaderboardPageData({
    viewerUserId: QA_USER_ID,
    state,
    leaderboardLanguage,
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
      <>
        <div className="border-b border-border bg-surface px-4 py-2 sm:px-6">
          <DevQaToolbar label="Leaderboard fixture">
            {(["normal", "promotion", "promotion-100", "demotion", "demotion-100", "champion", "held", "held-down", "outside", "empty", "low-pop"] as const).map((fixture) => (
              <Link
                key={fixture}
                href={`?state=${fixture}${motion ? `&motion=${motion}` : ""}${review ? `&review=${review}` : ""}`}
                aria-current={state === fixture ? "page" : undefined}
                className={state === fixture ? devQaActiveChipClass : devQaChipClass}
              >
                {fixture.replaceAll("-", " ")}
              </Link>
            ))}
            <Link
              href={`?state=${state}&motion=${motion === "reduce" ? "full" : "reduce"}${review ? `&review=${review}` : ""}`}
              className={motion === "reduce" ? devQaActiveChipClass : devQaChipClass}
              aria-pressed={motion === "reduce"}
            >
              Reduced motion
            </Link>
          </DevQaToolbar>
        </div>
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
      </>
    </ProtectedShell>
  );
}
