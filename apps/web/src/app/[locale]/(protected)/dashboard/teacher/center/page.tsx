import { notFound, redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { createTypedServerClient } from "@/lib/supabase/server";
import { loadCenterSnapshot } from "@/lib/center-operations/repository";
import { CenterWorkbench } from "@/components/center-operations/CenterWorkbench";
import { PageContainer } from "@/components/shared/product-layout";

export default async function CenterOperationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ organization?: string }>;
}) {
  if (process.env.CENTER_OPERATIONS_V1 !== "true") notFound();
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const client = await createTypedServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect(`/${locale}/login`);
  const { data: memberships, error } = await client
    .from("club_memberships")
    .select("club_id,clubs(id,name)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .in("role", ["owner", "admin", "head_teacher", "teacher", "coach"]);
  if (error) throw new Error("Unable to load your centers.");
  const centers = [
    ...new Map(
      (memberships ?? []).flatMap((membership) =>
        membership.clubs
          ? [[membership.club_id, membership.clubs] as const]
          : [],
      ),
    ).values(),
  ];
  const selected =
    query.organization ?? (centers.length === 1 ? centers[0].id : undefined);
  const vi = locale === "vi";
  return (
    <PageContainer size="data" className="min-w-0">
      {centers.length > 1 && (
        <nav
          aria-label={vi ? "Trung tâm" : "Centers"}
          className="mb-4 flex flex-wrap gap-3"
        >
          {centers.map((center) => (
            <Link
              key={center.id}
              href={`/dashboard/teacher/center?organization=${center.id}`}
              className="type-label text-primary underline underline-offset-4"
            >
              {center.name}
            </Link>
          ))}
        </nav>
      )}
      {selected ? (
        <CenterWorkbench
          existingCalendarsEnabled={
            process.env.CENTER_GOOGLE_EXISTING_CALENDARS_ENABLED === "true"
          }
          initial={await loadCenterSnapshot(selected)}
          locale={vi ? "vi" : "en"}
        />
      ) : (
        <div className="space-y-3">
          <h1 className="type-heading-lg text-on-surface">
            {vi ? "Vận hành trung tâm" : "Center operations"}
          </h1>
          <p className="type-body text-on-surface-variant">
            {vi
              ? "Chọn trung tâm để bắt đầu. Quyền truy cập được giới hạn theo lớp phụ trách."
              : "Choose a center to begin. Access is limited to your assigned classes."}
          </p>
          {centers.length === 0 && (
            <Link
              href="/dashboard/teacher/organization"
              className="type-label text-primary"
            >
              {vi ? "Thiết lập trung tâm" : "Set up a center"}
            </Link>
          )}
        </div>
      )}
    </PageContainer>
  );
}
