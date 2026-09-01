"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "@/components/ui/icons";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  OrganizationRole,
  OrganizationStatus,
  OrganizationType,
} from "@/lib/organizations/contracts";
import { cn } from "@/lib/utils";
import {
  organizationSetupOperations,
  type OrganizationSetupOperations,
} from "./organization-setup-adapter";
import { validateOrganizationSetupStep } from "./organization-setup-model";

export type OrganizationSetupDraft = {
  organizationId?: string;
  organizationType: OrganizationType;
  name: string;
  country: string;
  city: string;
  timezone: string;
  logoUrl: string;
  facebookUrl: string;
  instagramUrl: string;
  threadsUrl: string;
  inviteEmail: string;
  inviteRole: OrganizationRole;
  classId?: string;
  classTitle: string;
  programType: "debate" | "ielts" | "public_speaking";
  teacherId: string;
  courseId: string;
  materialId: string;
  status: OrganizationStatus;
};

const EMPTY_DRAFT: OrganizationSetupDraft = {
  organizationType: "club",
  name: "",
  country: "VN",
  city: "",
  timezone: "Asia/Ho_Chi_Minh",
  logoUrl: "",
  facebookUrl: "",
  instagramUrl: "",
  threadsUrl: "",
  inviteEmail: "",
  inviteRole: "teacher",
  classTitle: "",
  programType: "debate",
  teacherId: "",
  courseId: "",
  materialId: "",
  status: "draft",
};

const copy = {
  en: {
    eyebrow: "Organization setup",
    title: "Build your learning workspace",
    description:
      "After identity is created, each completed step is saved to the organization so you can resume safely.",
    step: "Step",
    of: "of",
    steps: ["Type", "Identity", "People", "First class", "Review"],
    typeTitle: "Choose the organization type",
    typeHelp: "This changes the language and tools people see across Thinkfy.",
    club: "Club",
    clubHelp: "A community for practice, events, and friendly competition.",
    school: "School",
    schoolHelp: "Classes, teachers, assignments, and structured reporting.",
    identityTitle: "Add identity and location",
    name: "Organization name",
    country: "Country code",
    city: "City",
    timezone: "Timezone",
    logo: "Logo URL (optional)",
    facebook: "Facebook URL (optional)",
    instagram: "Instagram URL (optional)",
    threads: "Threads URL (optional)",
    peopleTitle: "Invite the first person",
    peopleHelp:
      "Optional for now. Invitations are always checked by the server.",
    email: "Email address",
    role: "Role",
    owner: "Owner",
    admin: "Admin",
    teacher: "Teacher",
    student: "Student",
    classTitle: "Create the first class",
    classHelp: "Optional. Leave the class name blank to create it later.",
    className: "Class name",
    program: "Program",
    debate: "Debate",
    ielts: "IELTS",
    publicSpeaking: "Public speaking",
    teacherId: "Teacher account ID (optional)",
    teacherHint: "Use a verified account ID. You can assign a teacher later.",
    reviewTitle: "Review and activate",
    resourcesHelp:
      "Courses and materials are optional. Add verified resource IDs or leave them blank.",
    courseId: "Course ID (optional)",
    materialId: "Material ID (optional)",
    activateLabel: "Activate this organization",
    activateHelp:
      "Activation makes the workspace available to authorized members. Leave unchecked to keep a draft.",
    back: "Back",
    continue: "Save and continue",
    finishDraft: "Save draft",
    activate: "Activate organization",
    saving: "Saving…",
    saved: "Progress saved",
    required: "Complete the required fields before continuing.",
    invalid: "Check the email, secure URL, or account and resource IDs.",
    failed: "We couldn’t save this step. Your current entries are still here.",
    unavailable:
      "This organization is unavailable or you do not have permission to manage it.",
    returnList: "Return to organizations",
  },
  vi: {
    eyebrow: "Thiết lập tổ chức",
    title: "Xây dựng không gian học tập",
    description:
      "Sau khi tạo nhận diện, mỗi bước hoàn tất được lưu vào tổ chức để bạn có thể tiếp tục sau.",
    step: "Bước",
    of: "trên",
    steps: ["Loại", "Nhận diện", "Thành viên", "Lớp đầu tiên", "Xem lại"],
    typeTitle: "Chọn loại tổ chức",
    typeHelp:
      "Lựa chọn này thay đổi ngôn ngữ và công cụ mọi người thấy trên Thinkfy.",
    club: "Câu lạc bộ",
    clubHelp: "Cộng đồng để luyện tập, tổ chức sự kiện và thi đấu thân thiện.",
    school: "Trường học",
    schoolHelp: "Lớp học, giáo viên, bài tập và báo cáo có cấu trúc.",
    identityTitle: "Thêm nhận diện và địa điểm",
    name: "Tên tổ chức",
    country: "Mã quốc gia",
    city: "Thành phố",
    timezone: "Múi giờ",
    logo: "URL logo (không bắt buộc)",
    facebook: "URL Facebook (không bắt buộc)",
    instagram: "URL Instagram (không bắt buộc)",
    threads: "URL Threads (không bắt buộc)",
    peopleTitle: "Mời thành viên đầu tiên",
    peopleHelp: "Có thể bỏ qua lúc này. Lời mời luôn được máy chủ kiểm tra.",
    email: "Địa chỉ email",
    role: "Vai trò",
    owner: "Chủ sở hữu",
    admin: "Quản trị viên",
    teacher: "Giáo viên",
    student: "Học viên",
    classTitle: "Tạo lớp đầu tiên",
    classHelp: "Không bắt buộc. Để trống tên lớp nếu bạn muốn tạo sau.",
    className: "Tên lớp",
    program: "Chương trình",
    debate: "Tranh biện",
    ielts: "IELTS",
    publicSpeaking: "Thuyết trình",
    teacherId: "ID tài khoản giáo viên (không bắt buộc)",
    teacherHint: "Dùng ID tài khoản đã xác minh. Bạn có thể phân công sau.",
    reviewTitle: "Xem lại và kích hoạt",
    resourcesHelp:
      "Khóa học và tài liệu là tùy chọn. Thêm ID đã xác minh hoặc để trống.",
    courseId: "ID khóa học (không bắt buộc)",
    materialId: "ID tài liệu (không bắt buộc)",
    activateLabel: "Kích hoạt tổ chức này",
    activateHelp:
      "Kích hoạt cho phép thành viên được ủy quyền truy cập. Bỏ chọn để giữ bản nháp.",
    back: "Quay lại",
    continue: "Lưu và tiếp tục",
    finishDraft: "Lưu bản nháp",
    activate: "Kích hoạt tổ chức",
    saving: "Đang lưu…",
    saved: "Đã lưu tiến trình",
    required: "Hoàn tất các trường bắt buộc trước khi tiếp tục.",
    invalid: "Kiểm tra email, URL bảo mật hoặc ID tài khoản và tài nguyên.",
    failed: "Không thể lưu bước này. Nội dung bạn nhập vẫn được giữ lại.",
    unavailable: "Tổ chức này không khả dụng hoặc bạn không có quyền quản lý.",
    returnList: "Quay lại danh sách tổ chức",
  },
} as const;

function makeRequestId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `organization-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function OrganizationSetupWizard({
  initialDraft,
  initialStep = 0,
  locale = "en",
  available = true,
  navigationEnabled = true,
  operations = organizationSetupOperations,
}: {
  initialDraft?: Partial<OrganizationSetupDraft>;
  initialStep?: number;
  locale?: "en" | "vi";
  available?: boolean;
  navigationEnabled?: boolean;
  operations?: OrganizationSetupOperations;
}) {
  const router = useRouter();
  const t = copy[locale];
  const [draft, setDraft] = useState<OrganizationSetupDraft>({
    ...EMPTY_DRAFT,
    ...initialDraft,
  });
  const [step, setStep] = useState(Math.min(4, Math.max(0, initialStep)));
  const [requestIds] = useState(() => Array.from({ length: 5 }, makeRequestId));
  const [error, setError] = useState<"required" | "invalid" | "failed" | null>(
    null,
  );
  const [saved, setSaved] = useState(false);
  const [activateOnFinish, setActivateOnFinish] = useState(false);
  const [isPending, startTransition] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const update = <K extends keyof OrganizationSetupDraft>(
    key: K,
    value: OrganizationSetupDraft[K],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaved(false);
    setError(null);
  };

  const advance = () => {
    setSaved(true);
    setStep((current) => Math.min(4, current + 1));
  };

  const saveCurrentStep = () => {
    if (isPending) return;
    const validation = validateOrganizationSetupStep(step, draft);
    if (validation !== "valid") {
      setError(validation);
      return;
    }

    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        if (step === 0) {
          setStep(1);
          return;
        }

        if (step === 1) {
          const result = await operations.saveIdentity({
            requestId: requestIds[1]!,
            organizationId: draft.organizationId,
            organizationType: draft.organizationType,
            name: draft.name,
            country: draft.country,
            city: draft.city,
            timezone: draft.timezone,
            logoUrl: draft.logoUrl,
            facebookUrl: draft.facebookUrl,
            instagramUrl: draft.instagramUrl,
            threadsUrl: draft.threadsUrl,
          });
          setDraft((current) => ({
            ...current,
            organizationId: result.organizationId,
          }));
          if (navigationEnabled) {
            router.replace(
              `/${locale}/dashboard/admin/organizations/${result.organizationId}/setup`,
            );
          }
          advance();
          return;
        }

        if (!draft.organizationId) {
          setError("failed");
          return;
        }

        if (step === 2) {
          await operations.savePeople({
            requestId: requestIds[2]!,
            organizationId: draft.organizationId,
            email: draft.inviteEmail.trim() || undefined,
            role: draft.inviteRole,
          });
          advance();
          return;
        }

        if (step === 3) {
          if (!draft.classTitle.trim()) {
            await operations.saveSetupVersion(draft.organizationId, 4);
            advance();
            return;
          }
          const result = await operations.saveFirstClass({
            requestId: requestIds[3]!,
            organizationId: draft.organizationId,
            title: draft.classTitle,
            programType: draft.programType,
            teacherId: draft.teacherId.trim() || undefined,
          });
          setDraft((current) => ({ ...current, classId: result.classId }));
          advance();
          return;
        }

        await operations.saveResources({
          requestId: requestIds[4]!,
          organizationId: draft.organizationId,
          classId: draft.classId,
          courseId: draft.courseId.trim() || undefined,
          materialId: draft.materialId.trim() || undefined,
        });
        if (activateOnFinish) {
          await operations.activate(draft.organizationId);
        } else {
          await operations.saveSetupVersion(draft.organizationId, 5);
        }
        if (navigationEnabled) {
          router.push(
            `/${locale}/dashboard/admin/organizations/${draft.organizationId}`,
          );
        } else {
          setSaved(true);
        }
      } catch {
        setError("failed");
      }
    });
  };

  if (!available) {
    return (
      <main className="mx-auto w-full max-w-2xl p-4 sm:p-8">
        <section className="rounded-[12px] border border-outline-variant bg-surface p-6 text-center">
          <h1 className="type-title text-on-surface">{t.unavailable}</h1>
          <a
            href={`/${locale}/dashboard/admin/organizations`}
            className={buttonVariants({
              variant: "outline",
              className: "mt-5",
            })}
          >
            {t.returnList}
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl p-4 sm:p-6 lg:p-8">
      <header className="max-w-2xl">
        <p className="type-eyebrow text-primary">{t.eyebrow}</p>
        <h1 className="mt-1 type-heading-xl text-on-surface">{t.title}</h1>
        <p className="mt-2 type-body text-on-surface-variant">
          {t.description}
        </p>
      </header>

      <p className="mt-6 type-label text-on-surface sm:hidden">
        {t.step} {step + 1} {t.of} 5 · {t.steps[step]}
      </p>
      <ol
        className="mt-6 hidden grid-cols-5 gap-2 sm:grid"
        aria-label={t.title}
      >
        {t.steps.map((label, index) => (
          <li
            key={label}
            aria-current={index === step ? "step" : undefined}
            className={cn(
              "border-t-2 pt-2 type-caption",
              index <= step
                ? "border-primary text-primary"
                : "border-outline-variant text-on-surface-variant",
            )}
          >
            {index + 1}. {label}
          </li>
        ))}
      </ol>

      <section className="mt-4 rounded-[12px] border border-outline-variant bg-surface p-4 sm:mt-6 sm:p-7">
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="type-title text-on-surface outline-none"
        >
          {step === 0
            ? t.typeTitle
            : step === 1
              ? t.identityTitle
              : step === 2
                ? t.peopleTitle
                : step === 3
                  ? t.classTitle
                  : t.reviewTitle}
        </h2>

        {step === 0 ? (
          <fieldset className="mt-4">
            <legend className="type-body-sm text-on-surface-variant">
              {t.typeHelp}
            </legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {(["club", "school"] as const).map((type) => (
                <label
                  key={type}
                  className={cn(
                    "min-h-20 cursor-pointer rounded-control border p-4 text-left transition-colors focus-within:outline-none focus-within:ring-2 focus-within:ring-ring motion-reduce:transition-none",
                    draft.organizationType === type
                      ? "border-primary bg-primary-container"
                      : "border-outline-variant hover:bg-surface-container-low",
                  )}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name="organizationType"
                    value={type}
                    checked={draft.organizationType === type}
                    onChange={() => update("organizationType", type)}
                  />
                  <span className="block type-label text-on-surface">
                    {type === "club" ? t.club : t.school}
                  </span>
                  <span className="mt-1 block type-body-sm text-on-surface-variant">
                    {type === "club" ? t.clubHelp : t.schoolHelp}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        {step === 1 ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label={t.name} required className="sm:col-span-2">
              <Input
                value={draft.name}
                onChange={(event) => update("name", event.target.value)}
                autoComplete="organization"
                required
              />
            </Field>
            <Field label={t.country}>
              <Input
                value={draft.country}
                onChange={(event) => update("country", event.target.value)}
                autoComplete="country"
                maxLength={2}
              />
            </Field>
            <Field label={t.city}>
              <Input
                value={draft.city}
                onChange={(event) => update("city", event.target.value)}
                autoComplete="address-level2"
              />
            </Field>
            <Field label={t.timezone}>
              <Input
                value={draft.timezone}
                onChange={(event) => update("timezone", event.target.value)}
              />
            </Field>
            <Field label={t.logo}>
              <Input
                type="url"
                value={draft.logoUrl}
                onChange={(event) => update("logoUrl", event.target.value)}
                placeholder="https://"
              />
            </Field>
            <Field label={t.facebook}>
              <Input
                type="url"
                value={draft.facebookUrl}
                onChange={(event) => update("facebookUrl", event.target.value)}
                placeholder="https://"
              />
            </Field>
            <Field label={t.instagram}>
              <Input
                type="url"
                value={draft.instagramUrl}
                onChange={(event) => update("instagramUrl", event.target.value)}
                placeholder="https://"
              />
            </Field>
            <Field label={t.threads} className="sm:col-span-2">
              <Input
                type="url"
                value={draft.threadsUrl}
                onChange={(event) => update("threadsUrl", event.target.value)}
                placeholder="https://"
              />
            </Field>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
            <p className="type-body-sm text-on-surface-variant sm:col-span-2">
              {t.peopleHelp}
            </p>
            <Field label={t.email}>
              <Input
                type="email"
                value={draft.inviteEmail}
                onChange={(event) => update("inviteEmail", event.target.value)}
                autoComplete="email"
              />
            </Field>
            <Field label={t.role}>
              <select
                className="h-10 w-full rounded-control border border-outline-variant bg-surface px-3 type-body text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={draft.inviteRole}
                onChange={(event) =>
                  update("inviteRole", event.target.value as OrganizationRole)
                }
              >
                {(["owner", "admin", "teacher", "student"] as const).map(
                  (role) => (
                    <option key={role} value={role}>
                      {t[role]}
                    </option>
                  ),
                )}
              </select>
            </Field>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <p className="type-body-sm text-on-surface-variant sm:col-span-2">
              {t.classHelp}
            </p>
            <Field label={t.className} className="sm:col-span-2">
              <Input
                value={draft.classTitle}
                onChange={(event) => update("classTitle", event.target.value)}
              />
            </Field>
            <Field label={t.program}>
              <select
                className="h-10 w-full rounded-control border border-outline-variant bg-surface px-3 type-body text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={draft.programType}
                onChange={(event) =>
                  update(
                    "programType",
                    event.target.value as OrganizationSetupDraft["programType"],
                  )
                }
              >
                <option value="debate">{t.debate}</option>
                <option value="ielts">{t.ielts}</option>
                <option value="public_speaking">{t.publicSpeaking}</option>
              </select>
            </Field>
            <Field label={t.teacherId} hint={t.teacherHint}>
              <Input
                value={draft.teacherId}
                onChange={(event) => update("teacherId", event.target.value)}
              />
            </Field>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="mt-4 space-y-5">
            <p className="type-body-sm text-on-surface-variant">
              {t.resourcesHelp}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.courseId}>
                <Input
                  value={draft.courseId}
                  onChange={(event) => update("courseId", event.target.value)}
                />
              </Field>
              <Field label={t.materialId}>
                <Input
                  value={draft.materialId}
                  onChange={(event) => update("materialId", event.target.value)}
                />
              </Field>
            </div>
            <dl className="grid gap-3 rounded-control bg-surface-container-low p-4 type-body-sm sm:grid-cols-2">
              <Summary label={t.name} value={draft.name} />
              <Summary
                label={t.typeTitle}
                value={draft.organizationType === "club" ? t.club : t.school}
              />
              <Summary label={t.className} value={draft.classTitle} />
              <Summary
                label={t.program}
                value={
                  t[
                    draft.programType === "public_speaking"
                      ? "publicSpeaking"
                      : draft.programType
                  ]
                }
              />
            </dl>
            <label className="flex min-h-11 items-start gap-3 rounded-control border border-outline-variant p-3">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-primary"
                checked={activateOnFinish}
                onChange={(event) => setActivateOnFinish(event.target.checked)}
              />
              <span>
                <span className="block type-label text-on-surface">
                  {t.activateLabel}
                </span>
                <span className="mt-1 block type-caption text-on-surface-variant">
                  {t.activateHelp}
                </span>
              </span>
            </label>
          </div>
        ) : null}

        <div className="mt-5 min-h-5" aria-live="polite">
          {error ? (
            <p
              role={error === "failed" ? "alert" : "status"}
              className="type-label text-error"
            >
              {t[error]}
            </p>
          ) : saved ? (
            <p className="type-label text-primary">
              <Check className="mr-1 inline h-4 w-4" aria-hidden="true" />
              {t.saved}
            </p>
          ) : null}
        </div>

        <div className="mt-4 flex flex-col-reverse gap-2 border-t border-outline-variant pt-4 sm:flex-row sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => setStep((current) => Math.max(0, current - 1))}
            disabled={step === 0 || isPending}
            className="min-h-11 sm:min-h-8"
          >
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            {t.back}
          </Button>
          <Button
            onClick={saveCurrentStep}
            disabled={isPending}
            className="min-h-11 sm:min-h-8"
          >
            {isPending ? (
              <Loader2
                className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : null}
            {isPending
              ? t.saving
              : step === 4
                ? activateOnFinish
                  ? t.activate
                  : t.finishDraft
                : t.continue}
            {step < 4 && !isPending ? (
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            ) : null}
          </Button>
        </div>
      </section>
    </main>
  );
}

function Field({
  label,
  hint,
  required,
  className,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block type-label text-on-surface", className)}>
      {label}
      {required ? <span aria-hidden="true"> *</span> : null}
      <span className="mt-2 block">{children}</span>
      {hint ? (
        <span className="mt-1 block type-caption text-on-surface-variant">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="type-caption text-on-surface-variant">{label}</dt>
      <dd className="mt-0.5 text-on-surface">{value || "—"}</dd>
    </div>
  );
}
