"use client";

import { IeltsRouteError } from "@/components/ielts/IeltsRouteError";

export default function IeltsSettingsError({ reset }: { reset: () => void }) {
  return <IeltsRouteError reset={reset} supportCode="IELTS-SETTINGS-01" />;
}
