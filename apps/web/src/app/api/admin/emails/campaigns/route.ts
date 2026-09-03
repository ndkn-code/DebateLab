import { NextRequest, NextResponse } from "next/server";
import {
  approveCampaign,
  getCampaign,
  cancelCampaign,
  getCampaignResults,
  getEmailCampaignOptions,
  listCampaigns,
  pauseCampaign,
  resolveAudience,
  resumeCampaign,
  scheduleCampaign,
  sendCampaign,
  upsertCampaign,
} from "@/lib/api/email-campaigns";
import { emailAudienceSegmentSchema } from "@/lib/email/campaigns-model";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function errorResponse(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Unable to manage campaigns.";
  const status = message.includes("unauthorized")
    ? 401
    : message.includes("forbidden")
      ? 403
      : 400;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (id) {
      const [campaign, results] = await Promise.all([
        getCampaign(id),
        getCampaignResults(id),
      ]);
      return NextResponse.json({ campaign, results });
    }
    const [campaigns, options] = await Promise.all([
      listCampaigns(),
      getEmailCampaignOptions(),
    ]);
    return NextResponse.json({ campaigns, options });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = body.action;
    if (action === "resolve") {
      const recipients = await resolveAudience(
        emailAudienceSegmentSchema.parse(body.audience),
      );
      return NextResponse.json({ count: recipients.length });
    }
    if (action === "send") {
      const result = await sendCampaign(
        String(body.id ?? ""),
        String(body.confirmationName ?? ""),
      );
      return NextResponse.json(result);
    }
    if (action === "approve") {
      const campaign = await approveCampaign(
        String(body.id ?? ""),
        String(body.confirmationName ?? ""),
      );
      return NextResponse.json({ campaign });
    }
    if (action === "schedule") {
      const campaign = await scheduleCampaign(
        String(body.id ?? ""),
        String(body.at ?? ""),
        String(body.confirmationName ?? ""),
      );
      return NextResponse.json({ campaign });
    }
    if (action === "cancel") {
      const campaign = await cancelCampaign(String(body.id ?? ""));
      return NextResponse.json({ campaign });
    }
    if (action === "pause") {
      const campaign = await pauseCampaign(String(body.id ?? ""));
      return NextResponse.json({ campaign });
    }
    if (action === "resume") {
      const campaign = await resumeCampaign(String(body.id ?? ""));
      return NextResponse.json({ campaign });
    }
    if (action === "save") {
      const campaign = await upsertCampaign(body.campaign);
      return NextResponse.json({ campaign });
    }
    return NextResponse.json(
      { error: "Unknown campaign action." },
      { status: 400 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
