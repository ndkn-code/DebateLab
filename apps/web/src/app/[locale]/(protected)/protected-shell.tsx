"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/shared/sidebar";
import { GlobalOverlays } from "@/components/shared/global-overlays";
import { SessionHeartbeatProvider } from "@/components/shared/SessionHeartbeatProvider";
import type { Profile } from "@/types/database";

interface ProtectedShellProps {
  children: React.ReactNode;
  profile: Profile | null;
  userEmail: string | null;
  userId: string;
}

export function ProtectedShell({
  children,
  profile,
  userEmail,
  userId,
}: ProtectedShellProps) {
  const pathname = usePathname();
  const isPracticeSession = pathname?.includes("/practice/session");

  if (isPracticeSession) {
    return (
      <div className="h-dvh min-h-0 overflow-hidden bg-background">
        {children}
        <GlobalOverlays />
        <SessionHeartbeatProvider userId={userId} />
      </div>
    );
  }

  return (
    <div className="flex h-dvh w-screen flex-col overflow-hidden bg-background md:flex-row">
      <Sidebar profile={profile} userEmail={userEmail} />
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
        {children}
      </main>
      <GlobalOverlays />
      <SessionHeartbeatProvider userId={userId} />
    </div>
  );
}
