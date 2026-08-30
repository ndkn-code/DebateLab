import { Link } from "@/i18n/navigation";
import { ProductIcon } from "@/components/ui/product-icon";

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

export default async function IeltsCoachPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const vi = locale === "vi";
  return (
    <main className="mx-auto grid min-h-full w-full max-w-4xl place-items-center p-4 sm:p-6">
      <section className="w-full rounded-xl border border-outline-variant bg-surface p-5 shadow-token-card sm:p-7">
        <span className="flex size-11 items-center justify-center rounded-xl bg-primary-container text-primary">
          <ProductIcon name="sparkles" size="lg" weight="duotone" />
        </span>
        <p className="mt-5 type-eyebrow text-primary">
          {vi ? "IELTS · Hỗ trợ luyện tập" : "IELTS · Practice support"}
        </p>
        <h1 className="mt-1 type-heading-lg text-on-surface">
          {vi
            ? "Trợ lý IELTS đang được kết nối"
            : "IELTS Coach is being connected"}
        </h1>
        <p className="mt-2 max-w-2xl type-body-sm text-on-surface-variant">
          {vi
            ? "Chúng tôi chưa bật trò chuyện cho đến khi nguồn và hướng dẫn IELTS riêng được kết nối. Điều này ngăn lời khuyên Tranh biện xuất hiện trong không gian IELTS."
            : "Chat stays unavailable until its dedicated IELTS instructions and sources are connected. This prevents Debate advice from appearing in your IELTS workspace."}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/ielts/tests"
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[10px] bg-primary px-2.5 type-body-sm font-medium text-primary-foreground outline-none transition-colors hover:bg-primary-dim focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {vi ? "Chọn bài luyện" : "Choose a practice task"}
            <ProductIcon name="arrowRight" size="sm" />
          </Link>
          <Link
            href="/ielts/home"
            className="inline-flex h-8 items-center justify-center rounded-[10px] border border-border bg-background px-2.5 type-body-sm font-medium text-primary-dim outline-none transition-colors hover:bg-primary-container focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {vi ? "Về trang IELTS" : "Back to IELTS home"}
          </Link>
        </div>
      </section>
    </main>
  );
}
