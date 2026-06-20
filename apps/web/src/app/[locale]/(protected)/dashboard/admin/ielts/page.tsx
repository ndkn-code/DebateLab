import { listIeltsTestsForAdmin } from "@/lib/api/ielts/tests-repository";
import { IeltsTestsClient } from "@/components/admin/ielts/IeltsTestsClient";

export const metadata = { title: "Admin — IELTS content" };

export default async function IeltsAdminPage() {
  const tests = await listIeltsTestsForAdmin();
  return <IeltsTestsClient tests={tests} />;
}
