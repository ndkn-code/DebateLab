"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  ChevronDown,
  Lightbulb,
  MessageCircle,
  PenTool,
} from "lucide-react";
import { MarkdownRenderer } from "@/components/shared/markdown-renderer";
import type { LessonWithContext } from "@/lib/api/courses";

interface ArticleRendererProps {
  lesson: LessonWithContext;
  courseSlug: string;
}

interface ArticleSection {
  heading: string | null;
  body: string;
}

interface ExampleRow {
  label: string;
  text: string;
}

export function ArticleRenderer({ lesson }: ArticleRendererProps) {
  const t = useTranslations("dashboard.courses");
  const markdown = (lesson.content as { markdown?: string }).markdown ?? "";
  const sections = useMemo(() => splitMarkdownSections(markdown), [markdown]);
  const summary = useMemo(() => extractFirstParagraph(markdown), [markdown]);
  const exampleRows = useMemo(
    () => extractExampleRows(markdown, t),
    [markdown, t]
  );
  const commonMistake = useMemo(
    () =>
      extractCommonMistake(sections) ?? t("reader.article_common_mistake_fallback"),
    [sections, t]
  );
  const tryThis = useMemo(
    () => extractTryThis(sections) ?? t("reader.article_try_this_fallback"),
    [sections, t]
  );

  return (
    <div className="space-y-3.5">
      <article className="rounded-[22px] border border-[#d8f0df] bg-[#f8fffb] px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#eaf9ee] text-[#2ca655]">
            <Lightbulb className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[1.05rem] font-semibold text-[#24a353]">
              {t("reader.article_key_idea")}
            </p>
            <p className="mt-2 text-sm leading-7 text-[#516279]">
              {summary || t("reader.article_summary_fallback")}
            </p>
          </div>
        </div>
      </article>

      <article className="rounded-[22px] border border-[#dee8f8] bg-[#f8fbff] px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#edf4ff] text-[#3971dd]">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[1.05rem] font-semibold text-[#3971dd]">
              {t("reader.article_example")}
            </p>
            <div className="mt-2 space-y-1.5 text-sm leading-7 text-[#415069]">
              {exampleRows.map((row) => (
                <p key={`${row.label}-${row.text}`}>
                  <span className="font-semibold text-[#182945]">{row.label}:</span>{" "}
                  {row.text}
                </p>
              ))}
            </div>
          </div>
        </div>
      </article>

      <article className="rounded-[18px] border border-[#fde8c2] bg-[#fff8eb] px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#fff1d3] text-[#f59e0b]">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#dd8a00]">
              {t("reader.article_common_mistake")}
            </p>
            <p className="mt-1 text-sm leading-7 text-[#8b6a31]">
              {commonMistake}
            </p>
          </div>
        </div>
      </article>

      <details className="group overflow-hidden rounded-[18px] border border-[#eadfff] bg-[#f6f0ff]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#efe4ff] text-[#8b5cf6]">
              <PenTool className="h-5 w-5" />
            </div>
            <p className="text-[1.05rem] font-semibold text-[#7a4edc]">
              {t("reader.article_try_this")}
            </p>
          </div>
          <ChevronDown className="h-4 w-4 text-[#8b5cf6] transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-[#eadfff] px-5 py-4">
          <p className="text-sm leading-7 text-[#5b4c82]">{tryThis}</p>
        </div>
      </details>

      <details className="group overflow-hidden rounded-[22px] border border-[#dee8f8] bg-[#f8fbff]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
          <div>
            <p className="text-[1.05rem] font-semibold text-[#10213f]">
              {t("reader.article_full_notes")}
            </p>
            <p className="mt-1 text-sm leading-7 text-[#66758d]">
              {t("reader.article_full_notes_description")}
            </p>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-[#4d86f7] transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-[#edf3fd] px-5 py-6">
          <MarkdownRenderer content={markdown} size="lg" />
        </div>
      </details>
    </div>
  );
}

function splitMarkdownSections(markdown: string): ArticleSection[] {
  const lines = markdown.split("\n");
  const sections: ArticleSection[] = [];
  let currentHeading: string | null = null;
  let currentBody: string[] = [];

  const pushSection = () => {
    const body = currentBody.join("\n").trim();
    if (!currentHeading && !body) return;
    sections.push({
      heading: currentHeading,
      body,
    });
  };

  for (const line of lines) {
    if (/^#\s+/.test(line)) {
      continue;
    }

    if (/^##\s+/.test(line)) {
      pushSection();
      currentHeading = line.replace(/^##\s+/, "").trim();
      currentBody = [];
      continue;
    }

    currentBody.push(line);
  }

  pushSection();
  return sections;
}

function extractFirstParagraph(markdown: string) {
  const paragraphs = markdown
    .split(/\n\s*\n/)
    .map((section) => cleanMarkdownText(section))
    .filter((section) => section.length > 40);

  return paragraphs[0] ?? "";
}

function extractExampleRows(
  markdown: string,
  t: ReturnType<typeof useTranslations>
): ExampleRow[] {
  const explicitRows = Array.from(
    markdown.matchAll(
      /(?:^|\n)\s*>?\s*\*\*(Claim|Reasoning|Reason|Warrant|Evidence|Impact):\*\*\s*(.+)$/gim
    )
  )
    .map((match) => ({
      label: normalizeExampleLabel(match[1] ?? "", t),
      text: cleanMarkdownText(match[2] ?? ""),
    }))
    .filter((row) => row.text.length > 0)
    .slice(0, 3);

  if (explicitRows.length > 0) {
    return explicitRows;
  }

  const fallbackSentences = cleanMarkdownText(markdown)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 24);

  return [
    {
      label: t("reader.article_example_claim_label"),
      text:
        fallbackSentences[0] ??
        t("reader.article_summary_fallback"),
    },
    {
      label: t("reader.article_example_reason_label"),
      text:
        fallbackSentences[1] ??
        t("reader.article_try_this_fallback"),
    },
    {
      label: t("reader.article_example_impact_label"),
      text:
        fallbackSentences[2] ??
        t("reader.article_common_mistake_fallback"),
    },
  ];
}

function normalizeExampleLabel(
  label: string,
  t: ReturnType<typeof useTranslations>
) {
  const normalized = label.toLowerCase();

  if (normalized === "claim") {
    return t("reader.article_example_claim_label");
  }

  if (normalized === "warrant" || normalized === "reason" || normalized === "reasoning") {
    return t("reader.article_example_reason_label");
  }

  if (normalized === "impact") {
    return t("reader.article_example_impact_label");
  }

  return label;
}

function extractCommonMistake(sections: ArticleSection[]) {
  const targetSection = sections.find((section) =>
    /common mistake|common mistakes|mistakes to avoid|avoid/i.test(
      section.heading ?? ""
    )
  );

  const bullet =
    extractBulletLines(targetSection?.body ?? "")[0] ??
    extractFirstSentence(targetSection?.body ?? "");

  return cleanMarkdownText(bullet);
}

function extractTryThis(sections: ArticleSection[]) {
  const targetSection = sections.find((section) =>
    /practice|exercise|putting it all together|tips|next step/i.test(
      section.heading ?? ""
    )
  );

  if (!targetSection) return null;

  const bullets = extractBulletLines(targetSection.body)
    .slice(0, 2)
    .map((line) => cleanMarkdownText(line));

  if (bullets.length > 0) {
    return bullets.join(" ");
  }

  return cleanMarkdownText(extractFirstSentence(targetSection.body));
}

function extractBulletLines(markdown: string) {
  return markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, "").trim());
}

function extractFirstSentence(text: string) {
  const cleaned = cleanMarkdownText(text);
  const [sentence] = cleaned.split(/(?<=[.!?])\s+/);
  return sentence ?? "";
}

function cleanMarkdownText(text: string) {
  return text
    .replace(/^#+\s+/gm, "")
    .replace(/^[-*]\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
