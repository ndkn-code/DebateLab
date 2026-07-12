"use client";

import { usePathname, useRouter } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";
import type { BankFacets, BankQuestionDetail } from "@/lib/api/ielts/question-bank";
import type { BankFilters, BankQuestionCard } from "@/lib/ielts/question-bank/model";

type ListResult = { questions: BankQuestionCard[]; count: number; page: number; pageSize: number; pageCount: number };

function jsonText(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function queryHref(filters: BankFilters, patch: Record<string, string | number | undefined>) {
  const values: Record<string, string | number | undefined> = {
    skill: filters.skill, questionType: filters.questionType, testId: filters.testId,
    difficulty: filters.difficulty, subskillTag: filters.subskillTag, search: filters.search,
    page: filters.page, ...patch,
  };
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => { if (value) params.set(key, String(value)); });
  return `/dashboard/admin/question-bank?${params.toString()}`;
}

function FilterSelect({ name, label, value, options }: { name: string; label: string; value?: string; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="flex min-w-36 flex-1 flex-col gap-1.5">
      <span className="type-label text-on-surface-variant">{label}</span>
      <select name={name} defaultValue={value ?? ""} className="h-10 rounded-xl border border-input bg-surface-container-lowest px-3 text-sm text-on-surface outline-none focus-visible:ring-3 focus-visible:ring-ring/40">
        <option value="">All</option>
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

export function QuestionBankBrowser({ facets, result, filters, detail }: { facets: BankFacets; result: ListResult; filters: BankFilters; detail: BankQuestionDetail | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const closeDetail = () => {
    const params = new URLSearchParams(window.location.search);
    params.delete("question");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="type-headline text-on-surface">Question Bank</h1></div>
        <Badge variant="secondary" className="font-mono">{result.count.toLocaleString()} questions</Badge>
      </header>

      <form method="get" className="rounded-2xl border border-outline-variant bg-surface-container-low p-4 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <FilterSelect name="skill" label="Skill" value={filters.skill} options={facets.skills.map(value => ({ value, label: value }))} />
          <FilterSelect name="questionType" label="Question type" value={filters.questionType} options={facets.questionTypes.map(value => ({ value, label: value.replaceAll("_", " ") }))} />
          <FilterSelect name="difficulty" label="Difficulty" value={filters.difficulty} options={facets.difficulties.map(value => ({ value, label: value }))} />
          <FilterSelect name="subskillTag" label="Subskill" value={filters.subskillTag} options={facets.subskillTags.map(value => ({ value, label: value }))} />
          <FilterSelect name="testId" label="Test" value={filters.testId} options={facets.tests.map(test => ({ value: test.id, label: test.title }))} />
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input name="search" defaultValue={filters.search} placeholder="Search question prompts" className="bg-surface-container-lowest" />
          <Button type="submit">Apply filters</Button>
          <Button variant="outline" nativeButton={false} render={<Link href="/dashboard/admin/question-bank" />}>Clear</Button>
        </div>
      </form>

      {result.questions.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {result.questions.map(question => (
            <Link key={question.id} href={queryHref(filters, { question: question.id })} scroll={false} className="group rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm transition hover:border-primary/40 hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40">
              <div className="mb-3 flex flex-wrap gap-1.5">
                <Badge variant="info">{question.skill}</Badge>
                <Badge variant="outline">{question.questionType.replaceAll("_", " ")}</Badge>
                {question.difficulty ? <Badge variant="secondary">{question.difficulty}</Badge> : null}
              </div>
              <p className="line-clamp-3 min-h-15 text-sm font-medium leading-5 text-on-surface">{question.promptExcerpt}</p>
              <div className="mt-4 flex items-center justify-between gap-3 text-xs text-on-surface-variant">
                <span className="truncate">{question.testTitle}</span><span className="shrink-0 font-mono">{question.maxPoints} pt</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-low p-10 text-center text-on-surface-variant">No questions match these filters.</div>
      )}

      <nav aria-label="Question bank pagination" className="flex items-center justify-between gap-3">
        <Button variant="outline" nativeButton={result.page <= 1} disabled={result.page <= 1} render={result.page > 1 ? <Link href={queryHref(filters, { page: result.page - 1 })} /> : undefined}>Previous</Button>
        <span className="text-sm text-on-surface-variant">Page <b className="text-on-surface">{result.page}</b> of {result.pageCount}</span>
        <Button variant="outline" nativeButton={result.page >= result.pageCount} disabled={result.page >= result.pageCount} render={result.page < result.pageCount ? <Link href={queryHref(filters, { page: result.page + 1 })} /> : undefined}>Next</Button>
      </nav>

      <Sheet open={Boolean(detail)} onOpenChange={open => { if (!open) closeDetail(); }}>
        <SheetContent className="w-full max-w-none overflow-y-auto sm:max-w-2xl">
          {detail ? <QuestionDetail detail={detail} /> : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function QuestionDetail({ detail }: { detail: BankQuestionDetail }) {
  const { question, key } = detail;
  const metadata = question.metadata && typeof question.metadata === "object" && !Array.isArray(question.metadata) ? question.metadata : {};
  const entries = Object.entries(metadata);
  return <>
    <SheetHeader className="border-b border-outline-variant pr-12">
      <div className="flex flex-wrap gap-1.5"><Badge variant="info">{question.skill}</Badge><Badge variant="outline">{question.question_type.replaceAll("_", " ")}</Badge></div>
      <SheetTitle className="mt-2 text-lg">{question.ielts_tests?.title ?? "Question detail"}</SheetTitle>
      <SheetDescription>Question {question.order_index + 1} · {question.max_points} point{question.max_points === 1 ? "" : "s"}</SheetDescription>
    </SheetHeader>
    <div className="flex flex-col gap-5 px-4 pb-8">
      {question.group_instructions ? <DetailBlock title="Instructions" value={question.group_instructions} /> : null}
      <DetailBlock title="Prompt" value={question.prompt} />
      <DetailBlock title="Options" value={jsonText(question.options)} code />
      <DetailBlock title="Correct answer" value={jsonText(key?.correct_answer)} code />
      <DetailBlock title="Accepted variants" value={jsonText(key?.accept_variants)} code />
      <DetailBlock title="Explanation · English" value={key?.explanation_en ?? "—"} />
      <DetailBlock title="Explanation · Vietnamese" value={key?.explanation_vi ?? "—"} />
      <DetailBlock title="Model answer" value={key?.model_answer ?? "—"} />
      <section><h3 className="type-label mb-2 text-on-surface-variant">Metadata</h3><div className="flex flex-wrap gap-2">{entries.length ? entries.map(([name, value]) => <Badge key={name} variant="secondary" className="max-w-full whitespace-normal"><b>{name}:</b>&nbsp;{jsonText(value)}</Badge>) : <span>—</span>}</div></section>
    </div>
  </>;
}

function DetailBlock({ title, value, code = false }: { title: string; value: string; code?: boolean }) {
  return <section><h3 className="type-label mb-2 text-on-surface-variant">{title}</h3><div className={`whitespace-pre-wrap rounded-xl bg-surface-container-low p-3 text-on-surface ${code ? "font-mono text-xs" : "text-sm leading-6"}`}>{value}</div></section>;
}
