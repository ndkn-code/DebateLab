import { NextResponse } from "next/server";
import { getMaintenanceState } from "@/lib/api/maintenance";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const maintenance = await getMaintenanceState();
    return NextResponse.json(
      { maintenance },
      { headers: { "Cache-Control": "public, max-age=0, s-maxage=3" } },
    );
  } catch {
    return NextResponse.json(
      { error: "maintenance_status_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
