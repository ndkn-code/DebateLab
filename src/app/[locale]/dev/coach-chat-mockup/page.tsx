import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { CoachChatMockupClient } from "./coach-chat-mockup-client";

function isLocalhostHost(host: string) {
  const normalizedHost = host.toLowerCase();
  return (
    normalizedHost === "localhost" ||
    normalizedHost.startsWith("localhost:") ||
    normalizedHost === "127.0.0.1" ||
    normalizedHost.startsWith("127.0.0.1:") ||
    normalizedHost === "[::1]" ||
    normalizedHost.startsWith("[::1]:")
  );
}

export default async function Page() {
  const host = (await headers()).get("host") ?? "";
  if (process.env.NODE_ENV !== "development" || !isLocalhostHost(host)) {
    notFound();
  }

  return <CoachChatMockupClient />;
}
