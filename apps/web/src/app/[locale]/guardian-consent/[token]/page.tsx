import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { recordGuardianDecisionAction } from "@/app/actions/age-assurance";
import { asPublicLocale, publicPageMetadata } from "@/lib/public-site";

type Props = {
  params: Promise<{ locale: string; token: string }>;
  searchParams: Promise<{ result?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = asPublicLocale((await params).locale);
  return publicPageMetadata({
    locale,
    path: "/guardian-consent",
    title:
      locale === "vi" ? "Xem xét yêu cầu đồng ý" : "Review guardian consent",
    description:
      locale === "vi"
        ? "Xem xét yêu cầu sử dụng Thinkfy của học sinh."
        : "Review a student's request to use Thinkfy.",
    noIndex: true,
  });
}

export default async function GuardianConsentPage({
  params,
  searchParams,
}: Props) {
  const { locale: rawLocale, token } = await params;
  const { result: resultParam } = await searchParams;
  const locale = asPublicLocale(rawLocale);
  const vi = locale === "vi";

  async function decide(formData: FormData) {
    "use server";
    const decision = formData.get("decision") === "grant" ? "grant" : "decline";
    const result = await recordGuardianDecisionAction({ token, decision });
    redirect(
      `/${locale}/guardian-consent/${encodeURIComponent(token)}?result=${
        result.ok ? decision : result.error
      }`,
    );
  }

  const completed = resultParam === "grant" || resultParam === "decline";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10 text-on-surface">
      <section className="w-full max-w-lg rounded-xl border border-outline-variant bg-surface p-6 shadow-sm sm:p-8">
        <p className="type-eyebrow text-secondary">
          Thinkfy
        </p>
        <h1 className="mt-3 type-heading-lg font-semibold">
          {vi ? "Yêu cầu đồng ý của người giám hộ" : "Guardian consent request"}
        </h1>
        {completed ? (
          <div className="mt-5 rounded-control border border-outline-variant bg-surface-container-low p-4">
            <p className="type-title font-semibold">
              {resultParam === "grant"
                ? vi
                  ? "Đã ghi nhận sự đồng ý"
                  : "Consent recorded"
                : vi
                  ? "Đã từ chối yêu cầu"
                  : "Request declined"}
            </p>
            <p className="mt-2 type-body-sm text-on-surface-variant">
              {vi
                ? "Bạn có thể đóng trang này. Học sinh cần tải lại trang Thinkfy để thấy trạng thái mới."
                : "You can close this page. The student should refresh Thinkfy to see the updated status."}
            </p>
          </div>
        ) : (
          <>
            <p className="mt-4 type-body text-on-surface-variant">
              {vi
                ? "Nếu đồng ý, học sinh có thể sử dụng các tính năng luyện tập xử lý bài viết và giọng nói để tạo phản hồi AI hỗ trợ. Thinkfy không bảo đảm phản hồi AI luôn chính xác. Bạn có thể yêu cầu rút lại sự đồng ý và xóa dữ liệu qua support@thinkfy.net."
                : "If you consent, the student may use practice features that process writing and voice data to produce AI-assisted feedback. Thinkfy does not guarantee that AI feedback is always accurate. You may withdraw consent and request deletion through support@thinkfy.net."}
            </p>
            <p className="mt-3 type-body-sm text-on-surface-variant">
              <Link
                className="text-secondary underline underline-offset-4"
                href={`/${locale}/privacy`}
              >
                {vi ? "Chính sách quyền riêng tư" : "Privacy Policy"}
              </Link>{" "}
              ·{" "}
              <Link
                className="text-secondary underline underline-offset-4"
                href={`/${locale}/terms`}
              >
                {vi ? "Điều khoản sử dụng" : "Terms of Service"}
              </Link>
            </p>
            <form action={decide} className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                name="decision"
                value="decline"
                className="min-h-11 rounded-control border border-outline px-4 type-label font-semibold"
              >
                {vi ? "Không đồng ý" : "Decline"}
              </button>
              <button
                name="decision"
                value="grant"
                className="min-h-11 rounded-control bg-on-surface px-4 type-label font-semibold text-surface"
              >
                {vi ? "Đồng ý" : "Give consent"}
              </button>
            </form>
            {resultParam ? (
              <p role="alert" className="mt-4 type-body-sm text-error">
                {vi
                  ? "Liên kết không hợp lệ, đã hết hạn hoặc đã được sử dụng."
                  : "This link is invalid, expired, or has already been used."}
              </p>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}
