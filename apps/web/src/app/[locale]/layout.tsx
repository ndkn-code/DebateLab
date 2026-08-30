import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { CookieConsentManager } from "@/components/legal/cookie-consent-manager";
import { DocumentLanguage } from "@/components/shared/document-language";
import { asPublicLocale } from "@/lib/public-site";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as "vi" | "en")) {
    notFound();
  }

  setRequestLocale(locale);

  return (
    <>
      <DocumentLanguage locale={locale} />
      {children}
      <CookieConsentManager locale={asPublicLocale(locale)} />
    </>
  );
}
