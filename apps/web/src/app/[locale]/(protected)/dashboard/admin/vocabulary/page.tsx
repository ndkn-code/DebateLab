import { VocabularyAdmin } from "@/components/admin/vocabulary/VocabularyAdmin";
import { listVocab } from "@/lib/api/vocab";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin - Vocabulary" };
const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export default async function AdminVocabularyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const data = await listVocab({
    subject: first(query.subject),
    bandTag: first(query.bandTag),
    topicTag: first(query.topicTag),
    search: first(query.search) ?? first(query.q),
    page: first(query.page),
  });
  return <VocabularyAdmin data={data} />;
}
