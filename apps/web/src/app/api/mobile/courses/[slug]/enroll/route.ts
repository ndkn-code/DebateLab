import { NextRequest, NextResponse } from "next/server";

import {
  MobileCourseApiError,
  enrollMobileCourse,
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

  console.error("Mobile course enrollment failed:", error);
  return NextResponse.json(
    { error: "Unable to enroll in course.", code: "enrollment_failed" },
    { status: 500 },
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return auth.errorResponse;

  const { slug: courseId } = await params;

  try {
    return NextResponse.json(
      await enrollMobileCourse({
        courseId,
        supabase: auth.supabase,
        userId: auth.user.id,
      }),
    );
  } catch (error) {
    return courseErrorResponse(error);
  }
}
