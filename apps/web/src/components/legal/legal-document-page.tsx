import Link from "next/link";
import { getLegalDocument, type LegalDocumentKind } from "@/lib/legal-copy";
import {
  legalOperatorDetails,
  legalPublicationReady,
  localizedPath,
  type PublicLocale,
} from "@/lib/public-site";
import { CookieConsentManager } from "@/components/legal/cookie-consent-manager";

const NAV_ITEMS: Array<{ kind: LegalDocumentKind; en: string; vi: string }> = [
  { kind: "privacy", en: "Privacy", vi: "Quyền riêng tư" },
  { kind: "terms", en: "Terms", vi: "Điều khoản" },
  { kind: "cookies", en: "Cookies", vi: "Cookie" },
];

export function LegalDocumentPage({
  kind,
  locale,
}: {
  kind: LegalDocumentKind;
  locale: PublicLocale;
}) {
  const document = getLegalDocument(locale, kind);
  const operator = legalOperatorDetails();
  const ready = legalPublicationReady();

  return (
    <main className="min-h-dvh bg-background text-on-surface">
      <header className="sticky top-0 z-20 border-b border-outline-variant bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href={localizedPath(locale)}
            className="rounded-control type-title font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            thinkfy<span className="text-secondary">.</span>
          </Link>
          <nav
            aria-label={
              locale === "vi" ? "Tài liệu pháp lý" : "Legal documents"
            }
            className="flex items-center gap-1"
          >
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.kind}
                href={localizedPath(locale, `/${item.kind}`)}
                aria-current={item.kind === kind ? "page" : undefined}
                className={`inline-flex h-8 items-center rounded-control px-3 type-label font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  item.kind === kind
                    ? "bg-on-surface text-surface"
                    : "text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                {locale === "vi" ? item.vi : item.en}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="type-eyebrow text-secondary">
          Thinkfy
        </p>
        <h1 className="mt-3 type-heading-lg font-semibold tracking-tight">
          {document.title}
        </h1>
        <p className="mt-3 max-w-2xl type-body text-on-surface-variant">
          {document.description}
        </p>
        <p className="mt-4 type-label text-on-surface-variant">
          {document.effectiveLabel}: {document.effectiveDate}
        </p>

        {!ready ? (
          <aside
            role="note"
            className="mt-6 rounded-control border border-warning/35 bg-warning-container p-4 type-body-sm text-on-warning-container"
          >
            {document.draftNotice}
          </aside>
        ) : null}

        <div className="mt-10 space-y-9">
          {document.sections.map((section) => (
            <section
              key={section.title}
              aria-labelledby={`section-${slug(section.title)}`}
            >
              <h2
                id={`section-${slug(section.title)}`}
                className="type-heading-sm font-semibold"
              >
                {section.title}
              </h2>
              {section.paragraphs?.map((paragraph) => (
                <p
                  key={paragraph}
                  className="mt-3 type-body leading-7 text-on-surface-variant"
                >
                  {paragraph}
                </p>
              ))}
              {section.bullets ? (
                <ul className="mt-3 list-disc space-y-2 pl-5 type-body leading-7 text-on-surface-variant">
                  {section.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        <section className="mt-12 rounded-xl border border-outline-variant bg-surface p-5">
          <h2 className="type-title font-semibold">
            {locale === "vi" ? "Thông tin đơn vị vận hành" : "Operator details"}
          </h2>
          <dl className="mt-4 grid gap-3 type-body-sm text-on-surface-variant sm:grid-cols-[9rem_1fr]">
            <dt className="font-semibold text-on-surface">
              {locale === "vi" ? "Đơn vị" : "Operator"}
            </dt>
            <dd>{operator.name}</dd>
            {operator.address ? (
              <>
                <dt className="font-semibold text-on-surface">
                  {locale === "vi" ? "Địa chỉ" : "Address"}
                </dt>
                <dd>{operator.address}</dd>
              </>
            ) : null}
            <dt className="font-semibold text-on-surface">Email</dt>
            <dd>
              <a
                className="text-secondary underline underline-offset-4"
                href={`mailto:${operator.privacyEmail}`}
              >
                {operator.privacyEmail}
              </a>
            </dd>
            <dt className="font-semibold text-on-surface">
              {locale === "vi" ? "Luật điều chỉnh" : "Governing law"}
            </dt>
            <dd>{operator.governingLaw}</dd>
          </dl>
          {kind === "terms" ? (
            <p className="mt-4 type-body-sm leading-6 text-on-surface-variant">
              {locale === "vi"
                ? `Các điều khoản này chịu sự điều chỉnh của ${operator.governingLaw}. Tranh chấp sẽ được giải quyết theo thủ tục và tại cơ quan có thẩm quyền theo pháp luật áp dụng, sau khi các bên cố gắng giải quyết thiện chí.`
                : `These terms are governed by ${operator.governingLaw}. Disputes will be handled through the procedures and competent authorities available under applicable law after the parties first attempt a good-faith resolution.`}
            </p>
          ) : null}
        </section>
        {kind === "cookies" ? (
          <CookieConsentManager locale={locale} mode="settings" />
        ) : null}
      </article>
    </main>
  );
}

function slug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
