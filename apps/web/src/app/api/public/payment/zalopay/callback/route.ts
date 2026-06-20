import { NextRequest, NextResponse } from "next/server";
import { createPaymentRepository } from "@/lib/api/payments-repository";
import { processZaloPayCallback } from "@/lib/payments/zalopay/callback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readCallback(
  request: NextRequest,
): Promise<{ data: string; mac: string }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const json = (await request.json()) as { data?: string; mac?: string };
    return { data: json.data ?? "", mac: json.mac ?? "" };
  }
  const form = await request.formData();
  return { data: String(form.get("data") ?? ""), mac: String(form.get("mac") ?? "") };
}

// ZaloPay always expects HTTP 200 with { return_code, return_message }.
// return_code 1 = handled (don't retry); anything else = retry.
export async function POST(request: NextRequest) {
  try {
    const { data, mac } = await readCallback(request);
    if (!data || !mac) {
      return NextResponse.json({ return_code: 0, return_message: "missing data/mac" });
    }
    const result = await processZaloPayCallback(data, mac, createPaymentRepository());
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ return_code: 0, return_message: "error" });
  }
}
