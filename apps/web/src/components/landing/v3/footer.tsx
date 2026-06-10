import Image from "next/image";
import { landingHref } from "../links";
import type { LandingLocale, LandingV3Copy } from "./copy";

const SOCIAL_ICONS = [
  {
    label: "X",
    path: "M18.9 2H22l-6.77 7.73L23 22h-6.1l-4.78-6.25L6.65 22H3.54l7.24-8.27L1.5 2h6.25l4.32 5.72L18.9 2Z",
  },
  {
    label: "YouTube",
    path: "M21.58 7.19a2.92 2.92 0 0 0-2.05-2.06C17.73 4.63 12 4.63 12 4.63s-5.73 0-7.53.5A2.92 2.92 0 0 0 2.42 7.2 30.62 30.62 0 0 0 2 12a30.62 30.62 0 0 0 .42 4.81 2.92 2.92 0 0 0 2.05 2.06c1.8.5 7.53.5 7.53.5s5.73 0 7.53-.5a2.92 2.92 0 0 0 2.05-2.06A30.62 30.62 0 0 0 22 12a30.62 30.62 0 0 0-.42-4.81ZM10.09 15.01V8.99L15.27 12l-5.18 3.01Z",
  },
  {
    label: "Instagram",
    path: "M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2Zm0 1.9A3.85 3.85 0 0 0 3.9 7.75v8.5A3.85 3.85 0 0 0 7.75 20.1h8.5a3.85 3.85 0 0 0 3.85-3.85v-8.5A3.85 3.85 0 0 0 16.25 3.9h-8.5Zm8.87 1.42a1.06 1.06 0 1 1 0 2.12 1.06 1.06 0 0 1 0-2.12ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 1.9a3.1 3.1 0 1 0 0 6.2 3.1 3.1 0 0 0 0-6.2Z",
  },
] as const;

export function LandingV3Footer({
  copy,
  locale,
}: {
  copy: LandingV3Copy;
  locale: LandingLocale;
}) {
  return (
    <footer id="about" className="bg-white px-6 pb-10 pt-16 md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_0.8fr_0.8fr_0.8fr_1.1fr]">
          <div>
            <Image
              src="/brand/thinkfy/thinkfy-logo-light.png"
              alt="Thinkfy"
              width={640}
              height={226}
              className="h-10 w-auto object-contain"
            />
            <p className="mt-5 max-w-[300px] text-[15px] leading-7 text-on-surface-variant">
              {copy.footer.brandDescription}
            </p>
            <div className="mt-6 flex items-center gap-3">
              {SOCIAL_ICONS.map((icon) => (
                <a
                  key={icon.label}
                  href="#"
                  aria-label={icon.label}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant bg-white text-on-surface-variant transition-all duration-200 hover:-translate-y-0.5 hover:border-[#8BE8F7] hover:text-primary"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                    <path d={icon.path} />
                  </svg>
                </a>
              ))}
            </div>
          </div>

          {copy.footer.columns.map((column) => (
            <div key={column.title}>
              <p className="text-sm font-extrabold text-on-surface">{column.title}</p>
              <div className="mt-5 flex flex-col gap-3.5">
                {column.links.map((link) => (
                  <a
                    key={link.label}
                    href={landingHref(locale, link.href)}
                    className="text-[15px] text-on-surface-variant transition-colors hover:text-primary"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          ))}

          <div>
            <p className="text-sm font-extrabold text-on-surface">{copy.footer.newsletter.title}</p>
            <p className="mt-5 max-w-[260px] text-[15px] leading-7 text-on-surface-variant">
              {copy.footer.newsletter.description}
            </p>
            <form className="mt-5 flex gap-2.5">
              <input
                type="email"
                placeholder={copy.footer.newsletter.placeholder}
                className="h-12 min-w-0 flex-1 rounded-xl border border-outline-variant bg-white px-4 text-sm text-on-surface outline-none placeholder:text-on-surface-variant focus:border-primary"
              />
              <button
                type="submit"
                className="btn-3d-primary h-12 shrink-0 rounded-xl bg-primary px-5 text-sm font-bold text-on-primary hover:bg-primary-dim"
              >
                {copy.footer.newsletter.button}
              </button>
            </form>
          </div>
        </div>

        <div className="mt-12 border-t border-outline-variant pt-6 text-center text-sm text-on-surface-variant">
          {copy.footer.copyright}
        </div>
      </div>
    </footer>
  );
}
