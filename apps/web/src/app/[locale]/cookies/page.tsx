import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal/legal-document-page";
import { getLegalDocument } from "@/lib/legal-copy";
import {
  asPublicLocale,
  legalPublicationReady,
  publicPageMetadata,
} from "@/lib/public-site";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = asPublicLocale((await params).locale);
  const copy = getLegalDocument(locale, "cookies");
  return publicPageMetadata({
    locale,
    path: "/cookies",
    title: copy.title,
    description: copy.description,
    noIndex: !legalPublicationReady(),
  });
}

export default async function CookiesPage({ params }: Props) {
  const locale = asPublicLocale((await params).locale);
  return <LegalDocumentPage locale={locale} kind="cookies" />;
}
