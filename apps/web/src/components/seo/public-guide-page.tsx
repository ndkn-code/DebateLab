import Link from "next/link";
import type { PublicLocale } from "@/lib/public-site";
import type { PublicGuideSlug } from "@/lib/public-guides";
import { getPublicGuide } from "@/lib/public-guides";

export function PublicGuidePage({
  locale,
  slug,
}: {
  locale: PublicLocale;
  slug: PublicGuideSlug;
}) {
  const guide = getPublicGuide(locale, slug);
  const vi = locale === "vi";

  return (
    <main className="min-h-dvh bg-background text-on-surface">
      <header className="border-b border-outline-variant bg-surface">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link
            href={`/${locale}`}
            className="type-title font-semibold tracking-tight"
          >
            thinkfy<span className="text-secondary">.</span>
          </Link>
          <Link
            href={`/${locale}/${slug.startsWith("ielts") ? "ielts" : ""}`}
            className="inline-flex min-h-10 items-center rounded-control bg-on-surface px-4 type-label font-semibold text-surface"
          >
            {vi ? "Bắt đầu miễn phí" : "Start free"}
          </Link>
        </div>
      </header>
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="type-eyebrow text-secondary">
          {guide.eyebrow}
        </p>
        <h1 className="mt-3 type-heading-lg font-semibold tracking-tight">
          {guide.title}
        </h1>
        <p className="mt-5 type-body-lg leading-8 text-on-surface-variant">
          {guide.summary}
        </p>
        <div className="mt-10 space-y-10">
          {guide.sections.map((section) => (
            <section key={section.title}>
              <h2 className="type-title font-semibold">{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p
                  key={paragraph}
                  className="mt-3 type-body leading-7 text-on-surface-variant"
                >
                  {paragraph}
                </p>
              ))}
              {section.steps ? (
                <ol className="mt-4 grid gap-2 sm:grid-cols-2">
                  {section.steps.map((step, index) => (
                    <li
                      key={step}
                      className="rounded-control border border-outline-variant bg-surface p-3 type-body-sm"
                    >
                      <span className="mr-2 font-semibold text-secondary">
                        {index + 1}.
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              ) : null}
            </section>
          ))}
        </div>
        {guide.sources.length ? (
          <section className="mt-12 border-t border-outline-variant pt-8">
            <h2 className="type-title font-semibold">
              {vi ? "Nguồn chính thức" : "Primary sources"}
            </h2>
            <ul className="mt-3 space-y-2">
              {guide.sources.map((source) => (
                <li key={source.href}>
                  <a
                    href={source.href}
                    target="_blank"
                    rel="noreferrer"
                    className="type-body-sm text-secondary underline underline-offset-4"
                  >
                    {source.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <aside className="mt-12 rounded-xl border border-outline-variant bg-surface-container-low p-6">
          <h2 className="type-title font-semibold">
            {vi
              ? "Áp dụng vào lần luyện tiếp theo"
              : "Apply it in your next practice"}
          </h2>
          <p className="mt-2 type-body-sm text-on-surface-variant">
            {vi
              ? "Thinkfy giúp biến quy trình này thành bài luyện tập có cấu trúc và phản hồi có thể xem lại."
              : "Thinkfy turns this process into structured practice with feedback you can review."}
          </p>
          <Link
            href={`/${locale}/auth/login?next=${encodeURIComponent(slug.startsWith("ielts") ? "/ielts/onboarding" : "/onboarding")}`}
            className="mt-5 inline-flex min-h-10 items-center rounded-control bg-on-surface px-4 type-label font-semibold text-surface"
          >
            {vi ? "Bắt đầu miễn phí" : "Start free"}
          </Link>
        </aside>
      </article>
    </main>
  );
}
