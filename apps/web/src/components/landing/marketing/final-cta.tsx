import { GridPattern } from "@/components/magicui/grid-pattern";
import { StudentCta, TeacherCta } from "./cta";
import { Eyebrow, Shell } from "./editorial";
import type { MarketingFinalCtaCopy } from "./types";

/**
 * Inverted ink panel. `inverse-surface` flips correctly in both themes, so the
 * block reads as a deliberate closing plate rather than a coloured banner.
 */
export function FinalCta({
  copy,
  studentHref,
  teacherHref,
}: {
  copy: MarketingFinalCtaCopy;
  studentHref: string;
  teacherHref: string;
}) {
  return (
    <section className="bg-background">
      <Shell className="py-20 sm:py-24">
        <div className="relative isolate overflow-hidden rounded-[16px] bg-primary px-6 py-14 sm:px-12 sm:py-16">
          <div aria-hidden="true" className="absolute inset-0 -z-10 opacity-15">
            <GridPattern
              size={72}
              className="stroke-current text-on-primary [mask-image:radial-gradient(120%_100%_at_0%_0%,black,transparent_70%)]"
            />
          </div>

          <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-7">
              <Eyebrow className="text-on-primary">{copy.eyebrow}</Eyebrow>
              <h2 className="mt-5 max-w-[18ch] type-display-sm text-on-primary">
                {copy.title}
              </h2>
              <p className="mt-5 max-w-[52ch] type-body-lg text-on-primary">
                {copy.body}
              </p>
            </div>

            <div className="lg:col-span-5">
              <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
                <StudentCta
                  href={studentHref}
                  placement="final_cta"
                  tone="inverse"
                >
                  {copy.student}
                </StudentCta>
                <TeacherCta
                  href={teacherHref}
                  placement="final_cta"
                  tone="inverse"
                >
                  {copy.teacher}
                </TeacherCta>
              </div>
              <p className="mt-5 type-caption text-on-primary lg:text-right">
                {copy.note}
              </p>
            </div>
          </div>
        </div>
      </Shell>
    </section>
  );
}
