import { NextRequest, NextResponse } from "next/server";

import {
  MobileCourseApiError,
  getMobileCourseLibrary,
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

  console.error("Mobile courses failed:", error);
  return NextResponse.json(
    { error: "Unable to load courses.", code: "courses_unavailable" },
    { status: 500 },
  );
}

export async function GET(request: NextRequest) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return auth.errorResponse;

  try {
    return NextResponse.json(
      await getMobileCourseLibrary({
        supabase: auth.supabase,
        userId: auth.user.id,
      }),
    );
  } catch (error) {
    return courseErrorResponse(error);
  }
}
