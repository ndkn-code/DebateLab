import { notFound } from "next/navigation";
import { getIeltsTestBySlug } from "@/lib/api/ielts/tests-repository";
import { loadMockStructure } from "@/lib/api/ielts/mock-repository";
import { MockTestPlayer } from "@/components/ielts/MockTestPlayer";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return { title: `IELTS Mock — ${slug}` };
}

export default async function IeltsMockPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug } = await params;
  const test = await getIeltsTestBySlug(slug);
  if (!test) notFound();

  const structure = await loadMockStructure(test.id);
  if (!structure) notFound();

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <MockTestPlayer structure={structure} />
    </main>
  );
}
