import type { AiDifficulty, PracticeLanguage, PracticeTrack } from "@/types";
import type { RebuttalWordTarget } from "@/lib/rebuttal/debate-continuity";

export const TRUONG_TEEN_PROMPT_VERSION = "truong-teen-2025-v2";

export interface TruongTeenArchetype {
  key: string;
  viName: string;
  recognitionSignal: string;
  promptRule: string;
}

export const TRUONG_TEEN_REBUTTAL_ARCHETYPES: TruongTeenArchetype[] = [
  {
    key: "definition_attack",
    viName: "Tấn công định nghĩa",
    recognitionSignal: "Opponent relies on a broad, vague, or convenient interpretation.",
    promptRule:
      "Challenge whether the opponent's definition actually matches the motion, then explain how the round should be framed instead.",
  },
  {
    key: "uniqueness_attack",
    viName: "Đánh vào tính độc nhất",
    recognitionSignal: "The claimed harm happens in both worlds or is already caused by another force.",
    promptRule:
      "Show the harm is not unique to their side and identify the alternative cause the judge should care about.",
  },
  {
    key: "mechanism_break",
    viName: "Bẻ gãy cơ chế",
    recognitionSignal: "The opponent jumps from policy to outcome without explaining actor incentives.",
    promptRule:
      "Name the causal chain, find the weakest link, and explain why the claimed actor will not behave as assumed.",
  },
  {
    key: "goodhart_incentive_toxicity",
    viName: "Độc tính chỉ số",
    recognitionSignal: "A metric or incentive is treated as automatically productive.",
    promptRule:
      "Explain how turning a goal into a metric changes behavior and creates strategic gaming or pressure.",
  },
  {
    key: "opportunity_cost",
    viName: "Chi phí cơ hội",
    recognitionSignal: "The opponent proposes a solution while ignoring resources, attention, or lost alternatives.",
    promptRule:
      "Compare what society, schools, or students lose by spending limited capacity on the opponent's model.",
  },
  {
    key: "harm_hierarchy",
    viName: "Thứ bậc tác hại",
    recognitionSignal: "Both sides prove some harm, but not which harm should decide the round.",
    promptRule:
      "Weigh harms by scale, severity, probability, reversibility, affected group, and time frame.",
  },
  {
    key: "contradiction_catch",
    viName: "Bắt mâu thuẫn mô hình",
    recognitionSignal: "The opponent's later answer quietly changes their opening model or burden.",
    promptRule:
      "Call out the contradiction respectfully, explain why it weakens their burden, and lock the judge back to the original model.",
  },
  {
    key: "turn",
    viName: "Đảo ngược lập luận",
    recognitionSignal: "The opponent's own logic can prove your side's impact.",
    promptRule:
      "Concede the surface premise if useful, then show why it actually makes your side more necessary.",
  },
  {
    key: "implementation_failure",
    viName: "Đổ vỡ khi triển khai",
    recognitionSignal: "The proposal assumes perfect schools, parents, media, platforms, or regulators.",
    promptRule:
      "Test the proposal against Vietnam's actual implementation constraints: incentives, capacity, enforcement, and inequality.",
  },
  {
    key: "already_solved_elsewhere",
    viName: "Tác hại đã có công cụ khác xử lý",
    recognitionSignal: "The opponent overclaims a harm that existing institutions or norms already reduce.",
    promptRule:
      "Show the harm is better handled by narrower tools, then argue their model is overbroad or unnecessary.",
  },
];

export interface TruongTeenPhrase {
  function: string;
  vi: string;
  enMeaning: string;
  difficulty: "beginner" | "intermediate" | "advanced";
}

export const TRUONG_TEEN_PHRASE_BANK: TruongTeenPhrase[] = [
  {
    function: "burden",
    vi: "Gánh nặng chứng minh cốt lõi của trận đấu hôm nay không nằm ở việc..., mà nằm ở việc...",
    enMeaning: "The core burden is not X, but Y.",
    difficulty: "intermediate",
  },
  {
    function: "burden",
    vi: "Chúng tôi không cần chứng minh một thế giới hoàn hảo, chỉ cần chứng minh thế giới của mình ít rủi ro hơn.",
    enMeaning: "We do not need a perfect world, only a comparatively better one.",
    difficulty: "intermediate",
  },
  {
    function: "mechanism",
    vi: "Cơ chế này vận hành qua ba bước: động cơ, hành vi, rồi hệ quả.",
    enMeaning: "This mechanism runs through incentive, behavior, then consequence.",
    difficulty: "beginner",
  },
  {
    function: "mechanism",
    vi: "Nếu không giải thích được ai thay đổi hành vi và vì sao họ thay đổi, tác động đó chỉ là một mong muốn.",
    enMeaning: "Without actor incentives, the impact is only a wish.",
    difficulty: "advanced",
  },
  {
    function: "assumption_attack",
    vi: "Đội bạn đang xây dựng toàn bộ lập luận trên một giả định chưa được chứng minh.",
    enMeaning: "The opponent builds on an unproven assumption.",
    difficulty: "beginner",
  },
  {
    function: "assumption_attack",
    vi: "Điểm yếu ở đây là đội bạn giả định mọi đối tượng đều phản ứng giống nhau trước cùng một chính sách.",
    enMeaning: "The weakness is assuming every group reacts the same way.",
    difficulty: "intermediate",
  },
  {
    function: "world_comparison",
    vi: "Hãy nhìn vào khác biệt lớn nhất giữa hai thế giới.",
    enMeaning: "Look at the biggest difference between the two worlds.",
    difficulty: "beginner",
  },
  {
    function: "world_comparison",
    vi: "Tác hại này xảy ra ở cả hai thế giới, nên nó không thể là lý do để đội bạn thắng.",
    enMeaning: "This harm occurs in both worlds, so it cannot decide the round for them.",
    difficulty: "intermediate",
  },
  {
    function: "weighing",
    vi: "Cái mất ở thế giới chúng tôi là..., nhưng cái giá phải trả ở thế giới đội bạn là...",
    enMeaning: "Our cost is X, but their world pays Y.",
    difficulty: "intermediate",
  },
  {
    function: "weighing",
    vi: "Về quy mô, mức độ nghiêm trọng, khả năng xảy ra và khả năng đảo ngược, tác động của chúng tôi nặng hơn.",
    enMeaning: "By scale, severity, probability, and reversibility, our impact is heavier.",
    difficulty: "advanced",
  },
  {
    function: "crystallization",
    vi: "Trận tranh biện này không xoay quanh các chi tiết vụn vặt, mà xoay quanh câu hỏi...",
    enMeaning: "This round is not about details, but the central question.",
    difficulty: "intermediate",
  },
  {
    function: "polite_attack",
    vi: "Chúng tôi rất hoan nghênh lý tưởng của đội bạn, nhưng cơ chế họ đưa ra lại tạo ra hệ quả ngược.",
    enMeaning: "We respect their ideal, but their mechanism backfires.",
    difficulty: "advanced",
  },
];

export const TRUONG_TEEN_JUDGING_RUBRIC = [
  "Burden fulfillment: Did the side prove the exact comparative burden, not a nearby moral claim?",
  "Case construction: Are claims named, scoped, and connected to a consistent model?",
  "Mechanism depth: Does each impact explain actor incentives, causal steps, and feasibility?",
  "Rebuttal/clash: Does the speaker answer the strongest version of the opponent's case?",
  "Weighing: Does the speech compare scale, severity, probability, reversibility, affected group, and time frame?",
  "Evidence/examples: Are examples used to prove a mechanism, not just decorate the speech?",
  "Structure: Does the speech group arguments into macro clashes instead of point-by-point dumping?",
  "Language/delivery: Is Vietnamese natural, debate-native, and precise enough for the judge to follow?",
  "Strategic adaptation: Does the speaker rebuild after attacks and exploit concessions or contradictions?",
] as const;

export interface TruongTeenEvalMoment {
  key: string;
  motion: string;
  type:
    | "definition"
    | "mechanism"
    | "rebuttal"
    | "weighing"
    | "clash"
    | "closing"
    | "judging"
    | "implementation_failure";
  strongAiShouldNotice: string;
  weakAiWouldMiss: string;
}

export const TRUONG_TEEN_EVAL_MOMENTS: TruongTeenEvalMoment[] = [
  {
    key: "discipline-suspension-scope",
    motion: "Trường học nên bỏ đình chỉ học tập với học sinh vi phạm kỷ luật.",
    type: "definition",
    strongAiShouldNotice: "Distinguish punishment removal from no discipline at all.",
    weakAiWouldMiss: "Treat suspension as the only discipline tool.",
  },
  {
    key: "discipline-suspension-safety",
    motion: "Trường học nên bỏ đình chỉ học tập với học sinh vi phạm kỷ luật.",
    type: "weighing",
    strongAiShouldNotice: "Weigh student reintegration against classroom safety and deterrence.",
    weakAiWouldMiss: "Only discuss empathy for the punished student.",
  },
  {
    key: "university-admissions-autonomy",
    motion: "Bộ Giáo dục nên dừng can thiệp tuyển sinh đại học.",
    type: "mechanism",
    strongAiShouldNotice: "Test whether autonomy improves fit or worsens inequality and opacity.",
    weakAiWouldMiss: "Assume autonomy automatically creates quality.",
  },
  {
    key: "university-admissions-standard",
    motion: "Bộ Giáo dục nên dừng can thiệp tuyển sinh đại học.",
    type: "clash",
    strongAiShouldNotice: "Frame national standards versus institutional flexibility.",
    weakAiWouldMiss: "List pros and cons without deciding the tradeoff.",
  },
  {
    key: "creative-writing-compulsory",
    motion: "Sáng tác văn học nên là nội dung bắt buộc trong môn Ngữ văn.",
    type: "mechanism",
    strongAiShouldNotice: "Separate creative practice from grading artistic talent.",
    weakAiWouldMiss: "Treat creativity as impossible to teach.",
  },
  {
    key: "creative-writing-pressure",
    motion: "Sáng tác văn học nên là nội dung bắt buộc trong môn Ngữ văn.",
    type: "weighing",
    strongAiShouldNotice: "Weigh expression and empathy against exam pressure and subjective marking.",
    weakAiWouldMiss: "Only celebrate literature emotionally.",
  },
  {
    key: "saving-culture-modernity",
    motion: "Văn hóa tiết kiệm bị mai một là thay đổi có hại.",
    type: "definition",
    strongAiShouldNotice: "Define saving as prudent allocation, not refusal to consume.",
    weakAiWouldMiss: "Equate all spending with waste.",
  },
  {
    key: "saving-culture-economy",
    motion: "Văn hóa tiết kiệm bị mai một là thay đổi có hại.",
    type: "rebuttal",
    strongAiShouldNotice: "Answer whether consumption can create opportunity without toxic materialism.",
    weakAiWouldMiss: "Moralize spending without economic mechanism.",
  },
  {
    key: "parental-penalty-causation",
    motion: "Nhà nước nên phạt cha mẹ khi con dưới 18 tuổi vi phạm pháp luật.",
    type: "mechanism",
    strongAiShouldNotice: "Interrogate parental control, deterrence, and unfair punishment.",
    weakAiWouldMiss: "Assume parents fully control teenagers.",
  },
  {
    key: "parental-penalty-vulnerable",
    motion: "Nhà nước nên phạt cha mẹ khi con dưới 18 tuổi vi phạm pháp luật.",
    type: "weighing",
    strongAiShouldNotice: "Weigh accountability against harm to already vulnerable families.",
    weakAiWouldMiss: "Ignore socioeconomic effects.",
  },
  {
    key: "early-success-media-incentive",
    motion: "Truyền thông nên ngừng ca ngợi người thành công sớm.",
    type: "mechanism",
    strongAiShouldNotice: "Apply incentive toxicity: media praise can distort youth risk-taking.",
    weakAiWouldMiss: "Only say inspiration is good or bad.",
  },
  {
    key: "early-success-media-alternative-cause",
    motion: "Truyền thông nên ngừng ca ngợi người thành công sớm.",
    type: "rebuttal",
    strongAiShouldNotice: "Separate media celebration from family, school, and platform pressure.",
    weakAiWouldMiss: "Blame media for every anxiety.",
  },
  {
    key: "single-life-positive",
    motion: "Người trẻ chọn sống độc thân là xu hướng tích cực.",
    type: "definition",
    strongAiShouldNotice: "Define chosen singleness separately from loneliness or economic exclusion.",
    weakAiWouldMiss: "Treat all unmarried people as the same group.",
  },
  {
    key: "single-life-social-cost",
    motion: "Người trẻ chọn sống độc thân là xu hướng tích cực.",
    type: "weighing",
    strongAiShouldNotice: "Weigh autonomy and wellbeing against demographic and care burdens.",
    weakAiWouldMiss: "Only compare personal happiness.",
  },
  {
    key: "celebrity-doxxing-public-interest",
    motion: "Bóc phốt đời tư người nổi tiếng gây hại nhiều hơn lợi.",
    type: "clash",
    strongAiShouldNotice: "Separate public-interest accountability from voyeuristic privacy invasion.",
    weakAiWouldMiss: "Treat all exposure as identical.",
  },
  {
    key: "celebrity-doxxing-platforms",
    motion: "Bóc phốt đời tư người nổi tiếng gây hại nhiều hơn lợi.",
    type: "mechanism",
    strongAiShouldNotice: "Explain platform incentives and mob amplification.",
    weakAiWouldMiss: "Only say netizens are mean.",
  },
  {
    key: "historical-fiction-memory",
    motion: "Điện ảnh Việt Nam nên khuyến khích hư cấu trong phim lịch sử.",
    type: "weighing",
    strongAiShouldNotice: "Weigh artistic access against distortion of collective memory.",
    weakAiWouldMiss: "Assume fiction means lying.",
  },
  {
    key: "historical-fiction-labeling",
    motion: "Điện ảnh Việt Nam nên khuyến khích hư cấu trong phim lịch sử.",
    type: "rebuttal",
    strongAiShouldNotice: "Consider disclaimers and audience literacy as narrower tools.",
    weakAiWouldMiss: "Make the debate censorship versus chaos.",
  },
  {
    key: "child-image-commercial-consent",
    motion: "Cấm phụ huynh dùng hình ảnh trẻ em cho mục đích thương mại.",
    type: "mechanism",
    strongAiShouldNotice: "Focus on consent, digital permanence, and parent-child power asymmetry.",
    weakAiWouldMiss: "Only say parents love their children.",
  },
  {
    key: "child-image-commercial-enforcement",
    motion: "Cấm phụ huynh dùng hình ảnh trẻ em cho mục đích thương mại.",
    type: "implementation_failure",
    strongAiShouldNotice: "Test enforcement against informal livestreams and family businesses.",
    weakAiWouldMiss: "Assume a ban is easy to monitor.",
  },
  {
    key: "school-motivation-cause",
    motion: "Trường học làm thui chột động lực học tập của học sinh.",
    type: "rebuttal",
    strongAiShouldNotice: "Separate school design from exams, family pressure, and labor market incentives.",
    weakAiWouldMiss: "Blame schools for every loss of motivation.",
  },
  {
    key: "school-motivation-rebuild",
    motion: "Trường học làm thui chột động lực học tập của học sinh.",
    type: "closing",
    strongAiShouldNotice: "Crystallize whether school is root cause or reformable platform.",
    weakAiWouldMiss: "Repeat anecdotes without weighing.",
  },
  {
    key: "under15-chatgpt-learning",
    motion: "Học sinh dưới 15 tuổi không nên sử dụng ChatGPT.",
    type: "mechanism",
    strongAiShouldNotice: "Compare dependency risk with guided literacy and unequal access.",
    weakAiWouldMiss: "Treat ChatGPT as either magic tutor or pure cheating.",
  },
  {
    key: "graduation-exam-equity",
    motion: "Có nên bỏ kỳ thi tốt nghiệp THPT?",
    type: "weighing",
    strongAiShouldNotice: "Weigh national fairness and signaling against pressure and teaching distortion.",
    weakAiWouldMiss: "Only count exam stress.",
  },
  {
    key: "student-competition-final",
    motion: "Các cuộc thi cạnh tranh dành cho học sinh cần được chấm dứt.",
    type: "judging",
    strongAiShouldNotice: "Judge whether competition harms identity or creates motivation with safeguards.",
    weakAiWouldMiss: "Let emotional rhetoric replace comparative burden proof.",
  },
];

export const FUZZY_EVIDENCE_MAPPINGS = [
  {
    variants: ["Malale Yusfi", "Malale Yousfi", "Malala Yusfi"],
    normalized: "Malala Yousafzai",
    note: "Likely STT variant for the education activist Malala Yousafzai.",
  },
  {
    variants: ["Gitan Chor Ground", "Gitan Chord Ground", "Gitanjali Ground"],
    normalized: "Gitanjali Rao",
    note: "Likely STT variant for inventor and student scientist Gitanjali Rao.",
  },
  {
    variants: ["cc Sanders", "C C Sanders", "si si Sanders"],
    normalized: "Colonel Sanders",
    note: "Likely STT variant for KFC founder Colonel Harland Sanders.",
  },
] as const;

function normalizeForEvidenceSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function findFuzzyEvidenceHints(text: string | string[] | null | undefined) {
  const haystack = normalizeForEvidenceSearch(
    Array.isArray(text) ? text.join("\n") : text ?? ""
  );

  if (!haystack) return [];

  return FUZZY_EVIDENCE_MAPPINGS.filter((mapping) =>
    mapping.variants.some((variant) =>
      haystack.includes(normalizeForEvidenceSearch(variant))
    )
  );
}

export function buildFuzzyEvidenceHintBlock(
  text: string | string[] | null | undefined
) {
  const hints = findFuzzyEvidenceHints(text);
  if (hints.length === 0) return "";

  return `\n## Possible Normalized Evidence Hints
The transcript may contain speech-to-text variants. Do not rewrite or quote the original transcript as if corrected; use these only as cautious context hints:
${hints
  .map(
    (hint) =>
      `- ${hint.variants.join(" / ")} -> ${hint.normalized}: ${hint.note}`
  )
  .join("\n")}`;
}

export function shouldUseTruongTeenPrompt(params: {
  practiceLanguage?: PracticeLanguage;
  practiceTrack?: PracticeTrack;
}) {
  return params.practiceLanguage === "vi" && (params.practiceTrack ?? "debate") === "debate";
}

export function getTruongTeenWordTarget(params: {
  enabled: boolean;
  difficulty?: AiDifficulty;
  target: RebuttalWordTarget;
}): RebuttalWordTarget {
  if (
    params.enabled &&
    params.difficulty === "hard" &&
    params.target.label === "7-minute"
  ) {
    return { ...params.target, min: 800, max: 1200 };
  }

  return params.target;
}

export function buildTruongTeenRebuttalPromptAddendum(params: {
  difficulty?: AiDifficulty;
  wordTarget: RebuttalWordTarget;
}) {
  const hardSevenMinute =
    params.difficulty === "hard" && params.wordTarget.label === "7-minute";

  return `\n## Trường Teen 2025 Debate DNA (${TRUONG_TEEN_PROMPT_VERSION})
Apply these Vietnamese debate rules because this is Vietnamese debate practice:
- Group the response into 2-3 macro clash axes instead of answering every sentence point-by-point.
- Use natural spoken signposting and paragraph breaks, but do not put literal Markdown headings inside the "rebuttal" string.
- Strong rebuttal flow: frame the burden, concede a harmless/minor point if useful, break the opponent's mechanism, weigh impacts, rebuild your side, and crystallize why the judge should prefer your world.
- Do not only rebut. Surface at least one standalone, answerable claim for your side outside pure "đội bạn nói..." clash so the student has independent offense to answer next.
- The standalone claim should be its own spoken paragraph and should begin naturally with "Luận điểm độc lập của chúng tôi là..." or "Một luận điểm riêng của chúng tôi là...".
- A strong response should balance roughly 55-70% direct clash with 30-45% independent offense, rebuild, and weighing. Closing speeches should crystallize the judge question, not just list rebuttals.
- Attack causal chains, actor incentives, uniqueness, contradictions, implementation limits, and opportunity costs.
- Use Trường Teen-style Vietnamese phrases sparingly and naturally: "gánh nặng chứng minh", "cơ chế", "tính độc nhất", "chi phí cơ hội", "so sánh hai thế giới", "chốt clash".
- Avoid translationese such as "điểm của bạn là"; prefer "đội bạn đang giả định rằng..." or "lỗ hổng nằm ở...".
- Do not invent percentages, named studies, expert quotes, or institutional evidence. Prefer mechanism and weighing unless the transcript or corpus explicitly supplies evidence.
- If evidence names look odd because of speech-to-text, treat normalized hints cautiously and never fabricate statistics.
${hardSevenMinute ? "- Hard 7-minute Vietnamese mode: the rebuttal string must be 800-1200 Vietnamese words across 9-12 substantial spoken paragraphs. Do not compress this into a short answer. Use 2-3 macro clashes, with roughly 20% framing/rebuttal map, 50% mechanism attack and turn, 30% weighing/rebuild/crystallization." : ""}

Preferred rebuttal archetypes to use when relevant:
${TRUONG_TEEN_REBUTTAL_ARCHETYPES.map(
  (item) => `- ${item.viName}: ${item.promptRule}`
).join("\n")}`;
}

export function buildTruongTeenJudgingPromptAddendum() {
  return `\n## Trường Teen 2025 Judging Standard (${TRUONG_TEEN_PROMPT_VERSION})
Use stricter Vietnamese competitive debate judging while preserving the requested JSON shape.

Reward:
${TRUONG_TEEN_JUDGING_RUBRIC.map((rule) => `- ${rule}`).join("\n")}

Caps and penalties:
- Assertion dumping: if the student lists claims without actor incentives or causal steps, cap Content at 24/40.
- Missing mechanism: if major impacts skip the "who changes behavior and why" layer, cap Content at 25/40 even with good examples.
- Point-by-point rebuttal without clash grouping: cap Structure at 17/25 and Persuasion at 7/10.
- Lack of weighing: if the student never compares scale, severity, probability, reversibility, affected group, or time frame, cap Persuasion at 7/10.
- Model contradiction: if the student shifts their model or burden mid-round, penalize Content and Structure and mention the contradiction.
- Generic or translated Vietnamese: if user-facing Vietnamese sounds like English translated word-for-word, penalize Language and rewrite examples in natural Vietnamese.
- Evidence misuse: reward examples only when they prove a mechanism; do not reward name-dropping or hallucinated sources.

Decision logic:
- Prefer the side that proves the central comparative burden, not the side with more examples.
- In close rounds, decide based on the cleanest mechanism plus the clearest impact weighing.
- For feedback, explain the missing debate layer with Vietnamese terms such as gánh nặng chứng minh, cơ chế, phản biện, so sánh thế giới, cân tác động, and chốt clash.`;
}

export function buildTruongTeenDuelJudgingPromptAddendum() {
  return `\n## Trường Teen 2025 Duel Judging Addendum (${TRUONG_TEEN_PROMPT_VERSION})
Judge this Vietnamese duel like a competitive Trường Teen ballot:
- Decide the macro clashes first, then map individual speeches onto those clashes.
- Penalize dropped burdens, model shifts, unsupported causal jumps, and rebuttal that only denies without weighing.
- A team can sound fluent and still lose if it never proves mechanism or comparative impact.
- Pick a winner unless the debate is genuinely inseparable; explain the deciding clash in natural Vietnamese.`;
}
