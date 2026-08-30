"use client";

import { IeltsRouteError } from "@/components/ielts/IeltsRouteError";

export default function IeltsProfileError({ reset }: { reset: () => void }) {
  return <IeltsRouteError reset={reset} supportCode="IELTS-PROFILE-01" />;
}
