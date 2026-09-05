import { getLocale } from "next-intl/server";
import { PageContainer } from "@/components/shared/product-layout";

export default async function ParentReportLoading() {
  const locale = await getLocale();
  return <PageContainer size="focused"><p role="status" className="type-body text-on-surface-variant">{locale === "en" ? "Preparing the report…" : "Đang chuẩn bị báo cáo…"}</p></PageContainer>;
}
