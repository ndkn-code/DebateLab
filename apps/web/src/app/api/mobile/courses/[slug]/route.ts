import { NextRequest, NextResponse } from "next/server";

import {
  MobileCourseApiError,
  getMobileCourseDetail,
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

  console.error("Mobile course detail failed:", error);
  return NextResponse.json(
    { error: "Unable to load course.", code: "course_unavailable" },
    { status: 500 },
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return auth.errorResponse;

  const { slug } = await params;

  try {
    return NextResponse.json({
      course: await getMobileCourseDetail({
        slug,
        supabase: auth.supabase,
        userId: auth.user.id,
      }),
    });
  } catch (error) {
    return courseErrorResponse(error);
  }
}
