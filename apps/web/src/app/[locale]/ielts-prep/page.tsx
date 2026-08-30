import { setRequestLocale } from "next-intl/server";
import { IeltsLanding } from "@/components/landing/ielts/IeltsLanding";

export default async function IeltsPrepPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <IeltsLanding locale={locale === "vi" ? "vi" : "en"} />;
}
