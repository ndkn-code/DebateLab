import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { PostHogProvider, PostHogPageview } from "@/app/posthog-provider";
import { ToastProvider } from "@/components/shared/toast-provider";
import { ANALYTICS_COOKIE_NAME, isAnalyticsEnabled } from "@/lib/settings";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  const cookieStore = await cookies();

  if (!routing.locales.includes(locale as "vi" | "en")) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();
  const analyticsEnabled = isAnalyticsEnabled(
    cookieStore.get(ANALYTICS_COOKIE_NAME)?.value
  );

  return (
    <NextIntlClientProvider messages={messages}>
      <PostHogProvider enabled={analyticsEnabled}>
        <PostHogPageview enabled={analyticsEnabled} />
        {children}
      </PostHogProvider>
      <ToastProvider />
    </NextIntlClientProvider>
  );
}
