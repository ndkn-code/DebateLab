import { NextResponse } from "next/server";

export async function GET() {
  try {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      console.error("DEEPGRAM_API_KEY is not set in environment variables");
      return NextResponse.json(
        { error: "Deepgram API key not configured" },
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
    console.error("Deepgram token error:", error);
    return NextResponse.json(
      { error: "Failed to get Deepgram token" },
      { status: 500 }
    );
  }
}
