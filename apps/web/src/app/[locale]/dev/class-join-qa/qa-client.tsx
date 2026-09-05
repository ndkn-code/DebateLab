"use client";

import { useCallback, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ClassInvitationDialog } from "@/components/class-join/ClassInvitationDialog";
import { ClassJoinScreen } from "@/components/class-join/ClassJoinScreen";
import {
  CLASS_JOIN_STATUSES,
  type ClassInvitation,
  type ClassInvitationAction,
  type ClassJoinStatus,
} from "@/lib/class-join/contracts";
import { PageContainer } from "@/components/shared/product-layout";
import { ThemeToggle } from "@/components/shared/theme-toggle";

const classId = "00000000-0000-4000-8000-000000000001";
const code = "0123456789abcdef0123456789abcdef";

/** Local UI fixtures never call a server action or write database state. */
export function ClassJoinQa() {
  const params = useSearchParams();
  const [calls, setCalls] = useState(0);
  const invitation = useRef<ClassInvitation | null>(null);
  const serial = useRef(1);
  const previewAttempts = useRef(0);
  const status = CLASS_JOIN_STATUSES.includes(
    params.get("state") as ClassJoinStatus,
  )
    ? (params.get("state") as ClassJoinStatus)
    : "ready";
  const title =
    params.get("long") === "1"
      ? "QA · Lớp luyện kỹ năng trình bày và tư duy phản biện dành cho học sinh trung học"
      : "QA · Debate class";
  async function manageAction(input: {
    action: ClassInvitationAction;
    expectedId?: string;
  }) {
    await new Promise((resolve) => setTimeout(resolve, 180));
    if (params.get("managerError") === "1")
      return { status: "forbidden" as const };
    if (input.action === "revoke" || input.action === "replace") {
      if (input.expectedId !== invitation.current?.id)
        return { status: "stale" as const };
      invitation.current = null;
    }
    if (
      (input.action === "create" || input.action === "replace") &&
      !invitation.current
    ) {
      invitation.current = {
        id: `00000000-0000-4000-8000-${String(serial.current++).padStart(12, "0")}`,
        code: serial.current === 2 ? code : "abcdef0123456789abcdef0123456789",
        expiresAt: "2026-09-12T12:00:00Z",
        maxUses: 100,
        useCount: 0,
        revokedAt: null,
      };
    }
    return { status: "ready" as const, invitation: invitation.current };
  }
  const previewAction = useCallback(async () => {
    const attempt = ++previewAttempts.current;
    await new Promise((resolve) => setTimeout(resolve, 180));
    if (params.get("retry") === "1" && attempt <= 2)
      return { status: "unavailable" as const };
    return {
      status,
      classId,
      classTitle: title,
      organizationName: "QA · Thinkfy test center",
      programType: "debate",
    };
  }, [params, status, title]);
  async function claimAction() {
    setCalls((value) => value + 1);
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { status: "joined" as const, classId, classTitle: title };
  }
  return (
    <>
      <PageContainer size="focused" className="space-y-3">
        <p className="type-label text-on-surface-variant">
          QA ONLY · local UI fixtures · e70e/class-join
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <ThemeToggle />
          <ClassInvitationDialog
            classId={classId}
            classTitle={title}
            manageAction={manageAction}
          />
        </div>
        <p
          data-testid="claim-count"
          className="type-caption text-on-surface-variant"
        >
          Claim calls: {calls}
        </p>
      </PageContainer>
      <ClassJoinScreen
        initialCode={code}
        signedIn={params.get("anonymous") !== "1"}
        previewAction={previewAction}
        claimAction={claimAction}
      />
    </>
  );
}
