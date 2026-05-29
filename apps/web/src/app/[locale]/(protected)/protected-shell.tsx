"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useReducedMotion } from "framer-motion";
import { Sidebar } from "@/components/shared/sidebar";
import { GlobalOverlays } from "@/components/shared/global-overlays";
import { SessionHeartbeatProvider } from "@/components/shared/SessionHeartbeatProvider";
import { SeasonReplayDialog } from "@/components/leaderboards/season-replay-dialog";
import { useRouter } from "@/i18n/navigation";
import {
  getSeasonReplayDismissalKey,
  isReplayableSeasonOutcome,
} from "@/lib/leaderboards/replay";
import type { LeaderboardSeasonOutcome } from "@/lib/leaderboards/types";
import type { Profile } from "@/types/database";

interface ProtectedShellProps {
  children: React.ReactNode;
  profile: Profile | null;
  userEmail: string | null;
  userId: string;
  seasonReplayEnabled?: boolean;
  seasonReplayOutcome?: LeaderboardSeasonOutcome | null;
  seasonReplayReducedMotionOverride?: boolean;
  seasonReplayReviewMode?: boolean;
}

function useViewportScrollLock() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousHtmlOverscroll = html.style.overscrollBehavior;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyOverscroll = body.style.overscrollBehavior;

    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";

    return () => {
      html.style.overflow = previousHtmlOverflow;
      html.style.overscrollBehavior = previousHtmlOverscroll;
      body.style.overflow = previousBodyOverflow;
      body.style.overscrollBehavior = previousBodyOverscroll;
    };
  }, []);
}

function useScrollBoundaryLock<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const node = ref.current;

    if (!node) return;

    let lastTouchY = 0;

    const isAtTop = () => node.scrollTop <= 0;
    const isAtBottom = () =>
      Math.ceil(node.scrollTop + node.clientHeight) >= node.scrollHeight;
    const canNestedScrollerMove = (target: EventTarget | null, deltaY: number) => {
      if (!(target instanceof HTMLElement)) return false;

      let current: HTMLElement | null = target;

      while (current && current !== node) {
        const style = window.getComputedStyle(current);
        const isScrollable =
          /(auto|scroll|overlay)/.test(style.overflowY) &&
          current.scrollHeight > current.clientHeight;

        if (isScrollable) {
          const canScrollUp = current.scrollTop > 0;
          const canScrollDown =
            Math.ceil(current.scrollTop + current.clientHeight) <
            current.scrollHeight;

          if ((deltaY < 0 && canScrollUp) || (deltaY > 0 && canScrollDown)) {
            return true;
          }
        }

        current = current.parentElement;
      }

      return false;
    };

    const handleWheel = (event: WheelEvent) => {
      if (canNestedScrollerMove(event.target, event.deltaY)) {
        return;
      }

      if (event.deltaY < 0 && isAtTop()) {
        event.preventDefault();
      }

      if (event.deltaY > 0 && isAtBottom()) {
        event.preventDefault();
      }
    };

    const handleTouchStart = (event: TouchEvent) => {
      lastTouchY = event.touches[0]?.clientY ?? 0;
    };

    const handleTouchMove = (event: TouchEvent) => {
      const touchY = event.touches[0]?.clientY ?? lastTouchY;
      const deltaY = lastTouchY - touchY;
      lastTouchY = touchY;

      if (canNestedScrollerMove(event.target, deltaY)) {
        return;
      }

      if (deltaY < 0 && isAtTop()) {
        event.preventDefault();
      }

      if (deltaY > 0 && isAtBottom()) {
        event.preventDefault();
      }
    };

    node.addEventListener("wheel", handleWheel, { passive: false });
    node.addEventListener("touchstart", handleTouchStart, { passive: true });
    node.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      node.removeEventListener("wheel", handleWheel);
      node.removeEventListener("touchstart", handleTouchStart);
      node.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  return ref;
}

export function ProtectedShell({
  children,
  profile,
  userEmail,
  userId,
  seasonReplayEnabled = false,
  seasonReplayOutcome = null,
  seasonReplayReducedMotionOverride,
  seasonReplayReviewMode = false,
}: ProtectedShellProps) {
  useViewportScrollLock();
  const mainScrollRef = useScrollBoundaryLock<HTMLElement>();
  const pathname = usePathname();
  const router = useRouter();
  const detectedReducedMotion = useReducedMotion() ?? false;
  const prefersReducedMotion =
    seasonReplayReducedMotionOverride ?? detectedReducedMotion;
  const [seasonReplayOpen, setSeasonReplayOpen] = useState(false);
  const isPracticeSession = pathname?.includes("/practice/session");
  const seasonReplayDismissalKey = useMemo(() => {
    if (!seasonReplayOutcome) return null;
    return getSeasonReplayDismissalKey(userId, seasonReplayOutcome);
  }, [seasonReplayOutcome, userId]);
  const canShowSeasonReplay =
    seasonReplayEnabled && isReplayableSeasonOutcome(seasonReplayOutcome);

  useEffect(() => {
    if (!canShowSeasonReplay || !seasonReplayDismissalKey) {
      return;
    }

    let openTimer: number | null = null;

    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("resetReplay") === "1") {
        window.localStorage.removeItem(seasonReplayDismissalKey);
      }

      if (!window.localStorage.getItem(seasonReplayDismissalKey)) {
        openTimer = window.setTimeout(() => setSeasonReplayOpen(true), 0);
      }
    } catch {
      openTimer = window.setTimeout(() => setSeasonReplayOpen(true), 0);
    }

    return () => {
      if (openTimer) {
        window.clearTimeout(openTimer);
      }
    };
  }, [canShowSeasonReplay, seasonReplayDismissalKey]);

  function handleSeasonReplayOpenChange(open: boolean) {
    setSeasonReplayOpen(open);

    if (!open && seasonReplayDismissalKey) {
      try {
        window.localStorage.setItem(seasonReplayDismissalKey, "dismissed");
      } catch {
        // Local replay dismissal is best-effort only.
      }
    }
  }

  function handleViewLeaderboard() {
    handleSeasonReplayOpenChange(false);

    if (!pathname?.includes("/leaderboards")) {
      router.push("/leaderboards");
    }
  }

  const seasonReplayOverlay =
    canShowSeasonReplay && seasonReplayOutcome ? (
      <SeasonReplayDialog
        open={seasonReplayOpen}
        outcome={seasonReplayOutcome}
        onOpenChange={handleSeasonReplayOpenChange}
        onViewLeaderboard={handleViewLeaderboard}
        prefersReducedMotion={prefersReducedMotion}
        reviewMode={seasonReplayReviewMode}
      />
    ) : null;

  if (isPracticeSession) {
    return (
      <div className="fixed inset-0 h-dvh min-h-0 overflow-hidden overscroll-none bg-background">
        {children}
        <GlobalOverlays />
        {seasonReplayOverlay}
        <SessionHeartbeatProvider userId={userId} />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex h-dvh w-screen flex-col overflow-hidden overscroll-none bg-background md:flex-row">
      <Sidebar profile={profile} userEmail={userEmail} />
      <main
        ref={mainScrollRef}
        className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-none"
        style={{ WebkitOverflowScrolling: "auto" }}
      >
        {children}
      </main>
      <GlobalOverlays />
      {seasonReplayOverlay}
      <SessionHeartbeatProvider userId={userId} />
    </div>
  );
}
