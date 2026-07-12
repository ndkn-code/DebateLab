import { QuestionBankBrowser } from "@/components/admin/ielts/QuestionBankBrowser";
import { getBankFacets, getBankQuestion, listBankQuestions } from "@/lib/api/ielts/question-bank";
import { normalizeBankFilters } from "@/lib/ielts/question-bank/model";

export const metadata = { title: "Admin — Question Bank" };

export default async function QuestionBankPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const filters = normalizeBankFilters(raw);
  const questionId = Array.isArray(raw.question) ? raw.question[0] : raw.question;
  const [result, facets, detail] = await Promise.all([
    listBankQuestions(filters),
    getBankFacets(),
    questionId ? getBankQuestion(questionId) : Promise.resolve(null),
  ]);
  return <QuestionBankBrowser result={result} facets={facets} filters={filters} detail={detail} />;
}
