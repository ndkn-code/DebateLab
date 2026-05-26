import type { MotionBrief, PracticeLanguage } from "@/types";

export interface SttContextInput {
  practiceLanguage?: PracticeLanguage;
  topic?: string | null;
  side?: "proposition" | "opposition" | "random" | null;
  motionBrief?: MotionBrief | null;
  prepNotes?: string | null;
  extraTerms?: string[];
}

const BASE_DEBATE_TERMS = [
  "clash",
  "weighing",
  "impact",
  "burden",
  "rebuttal",
  "mechanism",
  "WSDC",
  "Trường Teen",
  "ECOWAS",
  "AES",
  "Sahel",
  "Burkina Faso",
  "Niger",
  "Nigeria",
  "Ghana",
  "Mali",
  "Malala Yousafzai",
  "J.K. Rowling",
  "Gitanjali Rao",
  "World Bank",
  "Pew Research",
  "UNICEF",
  "portfolio",
  "familiarity heuristic",
];

const VI_DEBATE_TERMS = [
  "gánh nặng chứng minh",
  "luận điểm",
  "cơ chế",
  "tác động",
  "phản biện",
  "chất vấn",
  "so sánh thế giới",
  "chốt clash",
  "cân tác động",
  "chi phí cơ hội",
  "tính độc nhất",
];

function splitPotentialTerms(value: string) {
  const matches = value.match(
    /\b[A-Z][A-Za-z0-9.-]{1,}(?:\s+[A-Z][A-Za-z0-9.-]{1,}){0,3}\b/g
  );
  const acronymMatches = value.match(/\b[A-Z]{2,}\b/g);
  return [...(matches ?? []), ...(acronymMatches ?? [])];
}

function cleanTerm(value: string) {
  return value
    .replace(/[“”"()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export function buildSttKeyterms(input: SttContextInput = {}) {
  const terms = [
    ...BASE_DEBATE_TERMS,
    ...(input.practiceLanguage === "vi" ? VI_DEBATE_TERMS : []),
    ...(input.motionBrief?.keyTerms ?? []),
    input.topic ?? "",
    ...(input.extraTerms ?? []),
  ];

  if (input.topic) terms.push(...splitPotentialTerms(input.topic));
  if (input.prepNotes) terms.push(...splitPotentialTerms(input.prepNotes));

  const seen = new Set<string>();
  return terms
    .flatMap((term) => cleanTerm(term).split(/\s*\|\s*/))
    .map(cleanTerm)
    .filter((term) => term.length >= 2 && term.length <= 80)
    .filter((term) => {
      const key = term.toLocaleLowerCase("vi");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 42);
}

export function appendDeepgramKeyterms(url: URL, keyterms: string[]) {
  keyterms.slice(0, 42).forEach((term) => {
    url.searchParams.append("keyterm", term);
  });
}
