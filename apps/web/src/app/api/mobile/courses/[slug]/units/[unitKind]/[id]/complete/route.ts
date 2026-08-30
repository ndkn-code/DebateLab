import { NextRequest, NextResponse } from "next/server";

import type { MobileCourseUnitKind } from "@thinkfy/shared/courses";
import {
  MobileCourseApiError,
  completeMobileCourseUnit,
} from "@/lib/api/mobile-courses";
import { requireRequestAuth } from "@/lib/api/request-auth";
import {
  RequestValidationError,
  readJsonObject,
} from "@/lib/api/request-validation";

export const dynamic = "force-dynamic";

function courseErrorResponse(error: unknown) {
  if (error instanceof MobileCourseApiError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }

  if (error instanceof RequestValidationError) {
    return NextResponse.json(
      { error: error.message, code: "invalid_request" },
      { status: error.status },
    );
  }

  console.error("Mobile course unit complete failed:", error);
  return NextResponse.json(
    { error: "Unable to complete unit.", code: "unit_complete_failed" },
    { status: 500 },
  );
}

function parseUnitKind(value: string): MobileCourseUnitKind {
  if (value === "lesson" || value === "activity") return value;
  throw new MobileCourseApiError("Unit type is invalid.", 400, "invalid_unit_kind");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; unitKind: string; id: string }> },
) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return auth.errorResponse;

  const { id, slug, unitKind } = await params;

  try {
    return NextResponse.json(
      await completeMobileCourseUnit({
        body: await readJsonObject(request, { maxBytes: 96 * 1024 }),
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
