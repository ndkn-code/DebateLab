import { NextRequest, NextResponse } from "next/server";

import type { MobileCourseUnitKind } from "@thinkfy/shared/courses";
import {
  MobileCourseApiError,
  getMobileCourseUnit,
} from "@/lib/api/mobile-courses";
import { requireRequestAuth } from "@/lib/api/request-auth";

export const dynamic = "force-dynamic";

function courseErrorResponse(error: unknown) {
  if (error instanceof MobileCourseApiError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }

  console.error("Mobile course unit failed:", error);
  return NextResponse.json(
    { error: "Unable to load unit.", code: "unit_unavailable" },
    { status: 500 },
  );
}

function parseUnitKind(value: string): MobileCourseUnitKind {
  if (value === "lesson" || value === "activity") return value;
  throw new MobileCourseApiError("Unit type is invalid.", 400, "invalid_unit_kind");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; unitKind: string; id: string }> },
) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return auth.errorResponse;

  const { id, slug, unitKind } = await params;

  try {
    return NextResponse.json(
      await getMobileCourseUnit({
        slug,
        unitId: id,
        unitKind: parseUnitKind(unitKind),
        supabase: auth.supabase,
        userId: auth.user.id,
      }),
    );
  } catch (error) {
    return courseErrorResponse(error);
  }
}
