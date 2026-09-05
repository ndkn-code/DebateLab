import { notFound } from "next/navigation";
import { z } from "zod";
import { Link } from "@/i18n/navigation";
import { createTypedServerClient } from "@/lib/supabase/server";
import { isIeltsAccessible } from "@/lib/ielts/access";
import { STUDENT_LMS_WORKSPACE_V1 } from "@/lib/features";
import {
  PageContainer,
  ProductPageHeader,
} from "@/components/shared/product-layout";
import { buttonVariants } from "@/components/ui/button";

/** Membership-checked destination; never loads a roster or bypasses subject rollout. */
export default async function JoinedClassPage({
  params,
}: {
  params: Promise<{ locale: string; classId: string }>;
}) {
  const { locale, classId } = await params;
  if (!z.string().uuid().safeParse(classId).success) notFound();
  const db = await createTypedServerClient();
  const { data: auth, error: authError } = await db.auth.getUser();
  if (authError || !auth.user) notFound();
  const { data: membership, error: membershipError } = await db
    .from("class_memberships")
    .select("id")
    .eq("class_id", classId)
    .eq("user_id", auth.user.id)
    .eq("member_role", "student")
    .eq("status", "active")
    .maybeSingle();
  if (membershipError || !membership) notFound();
  const { data: classroom, error } = await db
    .from("classes")
    .select("id,title,club_id,program_type,meeting_schedule,room,status")
    .eq("id", classId)
    .eq("status", "active")
    .maybeSingle();
  if (error || !classroom?.club_id) notFound();
  if (classroom.program_type === "ielts" && !(await isIeltsAccessible()))
    notFound();
  const { data: organizationMembership, error: organizationError } = await db
    .from("club_memberships")
    .select("id")
    .eq("club_id", classroom.club_id)
    .eq("user_id", auth.user.id)
    .eq("role", "student")
    .eq("status", "active")
    .maybeSingle();
  if (organizationError || !organizationMembership) notFound();
  const { data: organization, error: organizationReadError } = await db
    .from("clubs")
    .select("name")
    .eq("id", classroom.club_id)
    .eq("status", "active")
    .maybeSingle();
  if (organizationReadError || !organization) notFound();
  const vi = locale === "vi";
  const copy = vi
    ? {
        joined: "Bạn đã tham gia lớp",
        schedule: "Lịch học",
        room: "Phòng học",
        waiting: "Giáo viên sẽ chia sẻ lịch học và các bước tiếp theo với bạn.",
        open: "Xem lịch học và bài tập",
        home: "Về trang chủ",
        another: "Nhập mã lớp khác",
      }
    : {
        joined: "You have joined this class",
        schedule: "Class schedule",
        room: "Room",
        waiting:
          "Your teacher will share the class schedule and next steps with you.",
        open: "View schedule and assignments",
        home: "Go to home",
        another: "Enter another class code",
      };
  return (
    <PageContainer size="focused">
      <p className="mb-2 type-label text-on-surface-variant">{copy.joined}</p>
      <ProductPageHeader title={classroom.title} />
      <p className="mb-4 break-words type-body text-on-surface-variant">
        {organization.name}
      </p>
      <div className="space-y-4 rounded-control border border-outline-variant bg-surface-container-lowest p-6">
        {classroom.meeting_schedule ? (
          <div>
            <h2 className="type-label text-on-surface-variant">
              {copy.schedule}
            </h2>
            <p className="break-words type-body text-on-surface">
              {classroom.meeting_schedule}
            </p>
          </div>
        ) : null}
        {classroom.room ? (
          <div>
            <h2 className="type-label text-on-surface-variant">{copy.room}</h2>
            <p className="break-words type-body text-on-surface">
              {classroom.room}
            </p>
          </div>
        ) : null}
        <p className="type-body text-on-surface-variant">{copy.waiting}</p>
        <div className="flex flex-wrap gap-3">
          {classroom.program_type === "ielts" && STUDENT_LMS_WORKSPACE_V1 ? (
            <Link
              className={buttonVariants({ variant: "primary" })}
              href="/ielts/classes"
            >
              {copy.open}
            </Link>
          ) : (
            <Link
              className={buttonVariants({ variant: "primary" })}
              href="/dashboard"
            >
              {copy.home}
            </Link>
          )}
          <Link
            className={buttonVariants({ variant: "outline" })}
            href="/join-class"
          >
            {copy.another}
          </Link>
        </div>
      </div>
    </PageContainer>
  );
}
