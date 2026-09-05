import { notFound, redirect } from "next/navigation";
import { claimGuardianInvite } from "@/lib/center-operations/guardians";
import { PageContainer } from "@/components/shared/product-layout";

export default async function ClaimFamilyPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  if (process.env.CENTER_OPERATIONS_V1 !== "true") notFound();
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!query.token)
    return (
      <PageContainer size="focused">
        <p className="type-body text-on-surface-variant">
          {locale === "vi"
            ? "Liên kết mời không hợp lệ."
            : "This family invite is invalid."}
        </p>
      </PageContainer>
    );
  const result = await claimGuardianInvite({ token: query.token });
  const student = result as { studentRecordId?: string };
  if (!student.studentRecordId)
    return (
      <PageContainer size="focused">
        <p className="type-body text-on-surface-variant">
          {locale === "vi"
            ? "Không thể xác nhận liên kết."
            : "This family link could not be confirmed."}
        </p>
      </PageContainer>
    );
  redirect(
    `/${locale}/dashboard/family?student=${encodeURIComponent(student.studentRecordId)}`,
  );
}
