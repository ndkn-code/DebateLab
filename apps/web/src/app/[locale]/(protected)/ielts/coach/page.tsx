import { IeltsCoachShell } from "@/components/ielts/coach/IeltsCoachShell";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return {
    title: locale === "vi" ? "Trợ lý AI IELTS" : "IELTS AI Coach",
  };
}

export default function IeltsCoachPage() {
  return <IeltsCoachShell />;
}
