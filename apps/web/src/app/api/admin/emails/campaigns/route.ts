import { NextRequest, NextResponse } from "next/server";
import {
  getCampaign,
  cancelCampaign,
  getCampaignResults,
  getEmailCampaignOptions,
  listCampaigns,
  resolveAudience,
  scheduleCampaign,
  sendCampaign,
  upsertCampaign,
} from "@/lib/api/email-campaigns";
import { emailAudienceSegmentSchema } from "@/lib/email/campaigns-model";
import { isDevAdminBypassEnabled } from "@/lib/dev-admin-bypass";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const devCampaigns: Array<Record<string, unknown>> = [];
const devResults = { total: 1, sent: 1, delivered: 1, opened: 1, clicked: 0, bounced: 0, failed: 0, suppressed: 0, deliveryRate: 100, openRate: 100, clickRate: 0 };

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to manage campaigns.";
  const status = message.includes("unauthorized") ? 401 : message.includes("forbidden") ? 403 : 400;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (isDevAdminBypassEnabled()) {
      if (id) return NextResponse.json({ campaign: devCampaigns.find((item) => item.id === id), results: devResults });
      return NextResponse.json({ campaigns: devCampaigns, options: { clubs: [{ id: "00000000-0000-4000-8000-000000000010", name: "DebateLab Test Club" }], plans: ["free", "premium"] } });
    }
    if (id) {
      const [campaign, results] = await Promise.all([getCampaign(id), getCampaignResults(id)]);
      return NextResponse.json({ campaign, results });
    }
    const [campaigns, options] = await Promise.all([listCampaigns(), getEmailCampaignOptions()]);
    return NextResponse.json({ campaigns, options });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = body.action;
    if (isDevAdminBypassEnabled()) {
      if (action === "resolve") return NextResponse.json({ count: (body.audience as { type?: string })?.type === "admin_test" ? 1 : 12 });
      if (action === "save") {
        const input = body.campaign as Record<string, unknown>;
        const now = new Date().toISOString();
        const campaign = { ...input, id: input.id ?? crypto.randomUUID(), status: "draft", scheduledFor: null, sentCount: 0, createdAt: now, updatedAt: now };
        const index = devCampaigns.findIndex((item) => item.id === campaign.id);
        if (index >= 0) devCampaigns[index] = campaign;
        else devCampaigns.unshift(campaign);
        return NextResponse.json({ campaign });
      }
      if (action === "schedule" || action === "cancel") {
        const campaign = devCampaigns.find((item) => item.id === body.id);
        if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
        campaign.status = action === "schedule" ? "scheduled" : "canceled";
        campaign.scheduledFor = action === "schedule" ? body.at : null;
        campaign.updatedAt = new Date().toISOString();
        return NextResponse.json({ campaign });
      }
      if (action === "send") {
        const campaign = devCampaigns.find((item) => item.id === body.id);
        if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
        campaign.status = "sent";
        campaign.sentCount = 1;
        campaign.updatedAt = new Date().toISOString();
        return NextResponse.json({ completed: true, audienceCount: 1, results: devResults });
      }
    }
    if (action === "resolve") {
      const recipients = await resolveAudience(emailAudienceSegmentSchema.parse(body.audience));
      return NextResponse.json({ count: recipients.length });
    }
    if (action === "send") {
      const result = await sendCampaign(String(body.id ?? ""), String(body.confirmationName ?? ""));
      return NextResponse.json(result);
    }
    if (action === "schedule") {
      const campaign = await scheduleCampaign(
        String(body.id ?? ""),
        String(body.at ?? ""),
        String(body.confirmationName ?? "")
      );
      return NextResponse.json({ campaign });
    }
    if (action === "cancel") {
      const campaign = await cancelCampaign(String(body.id ?? ""));
      return NextResponse.json({ campaign });
    }
    if (action === "save") {
      const campaign = await upsertCampaign(body.campaign);
      return NextResponse.json({ campaign });
    }
    return NextResponse.json({ error: "Unknown campaign action." }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}
