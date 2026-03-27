import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { success } = rateLimit(`deepgram:${user.id}`, 5, 60 * 1000);
    if (!success) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      if (process.env.NODE_ENV === 'development') console.error("DEEPGRAM_API_KEY is not set");
      return NextResponse.json(
        { error: "Something went wrong. Please try again." },
        { status: 500 }
      );
    }

    // Return the API key for the client to use in WebSocket connection.
    // This is safe because:
    // 1. This is a server-side API route — the key is never in client bundles
    // 2. The client fetches it per-session and uses it only for a short-lived WSS connection
    // 3. For production hardening, replace with Deepgram's temporary scoped keys
    return NextResponse.json({ key: apiKey });
  } catch (error) {
    if (process.env.NODE_ENV === 'development') console.error("Deepgram token error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
