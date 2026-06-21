import type { MicroDraftSourceContext } from "./model";
import { IELTS_MICRO_DRAFT_ACTIVITY_TYPES } from "./schema";

function truncate(value: string | null | undefined, max: number): string {
  const text = value?.trim() ?? "";
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function jsonSnippet(value: unknown, max: number): string {
  return truncate(JSON.stringify(value, null, 2), max);
}

function formatSubskills(source: MicroDraftSourceContext): string {
  return source.subskills
    .map((subskill) =>
      [
        `- ${subskill.key}`,
        `skill=${subskill.skill}`,
        `label_en=${subskill.labelEn}`,
        `label_vi=${subskill.labelVi}`,
        `kind=${subskill.kind}`,
        subskill.questionType ? `question_type=${subskill.questionType}` : null,
        subskill.tags.length > 0 ? `tags=${subskill.tags.join(",")}` : null,
      ]
        .filter(Boolean)
        .join("; "),
    )
    .join("\n");
}

export function buildMicroDraftPrompt(source: MicroDraftSourceContext): string {
  const allowedTypes = IELTS_MICRO_DRAFT_ACTIVITY_TYPES.join(", ");
  return `You draft IELTS Learn-mode micro-activities for teacher QA.

Rules:
- Use ONLY the original source content provided below. Do not invent facts, examples, answers, people, statistics, or vocabulary unrelated to the source.
- Draft 1 to 3 micro-items total.
- Allowed activityType values: ${allowedTypes}.
- Prefer ielts_gap_fill only when the original question/key supports a completion-style answer.
- Every item must include bilingual English and Vietnamese learner-facing copy.
- Put learner-visible prompts/options in content only.
- Put every correct option, accepted answer, and explanation needed for scoring in answerKey only.
- Do not include answerKey, correctAnswer, correctOptionId, acceptVariants, acceptedAnswers, or any answer field inside content.
- sourceTextQuote must be an exact short quote from the provided source text.
- Return raw JSON only, no markdown.

JSON shape:
{
  "drafts": [
    {
      "activityType": "ielts_vocab_collocation" | "ielts_paraphrase_transform" | "ielts_gap_fill",
      "subskillKey": "one key from the candidate list or null",
      "content": {
        "type": "<same as activityType>",
        "title": { "en": "...", "vi": "..." },
        "instruction": { "en": "...", "vi": "..." },
        "prompt": { "en": "...", "vi": "..." },
        "sourceAttribution": { "en": "Based on ...", "vi": "Dựa trên ..." },
        "estimatedMinutes": 3,
        "...": "activity-specific public fields only"
      },
      "answerKey": {
        "type": "<same as activityType>",
        "...": "scoring fields only"
      },
      "rationaleEn": "Why this helps IELTS prep.",
      "rationaleVi": "Vì sao mục này hữu ích cho luyện IELTS.",
      "sourceTextQuote": "exact source quote"
    }
  ]
}

Activity-specific content:
- ielts_vocab_collocation content also needs stem {en,vi}, options [{id,text}], focusLexeme.
- ielts_paraphrase_transform content also needs sourceText, targetMeaning {en,vi}, options [{id,text}].
- ielts_gap_fill content also needs textWithBlank using exactly one [[blank]], blankLabel, wordLimit.

Activity-specific answerKey:
- ielts_vocab_collocation and ielts_paraphrase_transform: correctOptionId, explanationEn, explanationVi.
- ielts_gap_fill: correctAnswers, acceptVariants, caseSensitive, explanationEn, explanationVi.

Candidate subskills:
${formatSubskills(source)}

Original IELTS source:
Question ID: ${source.questionId}
Skill: ${source.skill}
Question type: ${source.questionType}
Question prompt:
"""${truncate(source.prompt, 1600)}"""

Group instructions:
"""${truncate(source.groupInstructions, 1200)}"""

Passage or listening script:
"""${truncate(source.sourceText, 5000)}"""

Existing answer explanation EN:
"""${truncate(source.explanationEn, 1600)}"""

Existing answer explanation VI:
"""${truncate(source.explanationVi, 1600)}"""

Existing correct answer JSON:
"""${jsonSnippet(source.correctAnswer, 1200)}"""

Existing accepted variants JSON:
"""${jsonSnippet(source.acceptVariants, 1200)}"""

Existing model answer, if any:
"""${truncate(source.modelAnswer, 2400)}"""`;
}
