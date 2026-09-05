import { notFound, redirect } from "next/navigation";
import { createTypedServerClient } from "@/lib/supabase/server";
import { loadGuardianProgress } from "@/lib/center-operations/guardians";
import { CenterFamily } from "@/components/center-operations/CenterFamily";
import { PageContainer } from "@/components/shared/product-layout";

export default async function FamilyPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ student?: string }>;
}) {
  if (process.env.CENTER_OPERATIONS_V1 !== "true") notFound();
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const client = await createTypedServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect(`/${locale}/login`);
  if (!query.student)
    return (
      <PageContainer size="data">
        <p className="type-body text-on-surface-variant">
          {locale === "vi"
            ? "Chọn học sinh từ liên kết gia đình."
            : "Choose a student from your family link."}
        </p>
      </PageContainer>
    );
  const progress = await loadGuardianProgress({
    studentRecordId: query.student,
  });
  return (
    <PageContainer size="data">
      <CenterFamily
        progress={progress}
        locale={locale === "vi" ? "vi" : "en"}
      />
    </PageContainer>
  );
}
