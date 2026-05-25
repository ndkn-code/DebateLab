import assert from "node:assert/strict";
import {
  buildCorpusMotionCandidatePlans,
  hashCorpusMotionTitle,
  parseCorpusImportText,
  summarizeCorpusSeed,
} from "./importer";

const bundle = {
  source: {
    video_title: "Trường Teen 2025 | Test Bundle",
    youtube_url: "https://youtu.be/example12345",
    source_type: "multi_match_compilation",
    season: 2025,
    stage: "Vòng loại",
    language: "vi",
    transcript_quality: "good",
    overall_confidence: 0.9,
  },
  matches: [
    {
      match_key: "test_match_exam",
      match_confidence: 0.95,
      motion: {
        vi: "Nên bỏ kỳ thi tốt nghiệp trung học phổ thông",
        en_translation: "The high school graduation exam should be abolished",
      },
      teams: [
        { team_name: "THPT A", side: "proposition", confidence: 1 },
        { team_name: "THPT B", side: "opposition", confidence: 1 },
      ],
      debate_moments: [
        {
          moment_key: "exam_macro_governance",
          moment_type: "rebuttal",
          side: "opposition",
          short_paraphrase: "Kỳ thi tạo dữ liệu chuẩn hóa toàn quốc.",
          strategic_value: "Ép phe ủng hộ thay thế chức năng quản trị vĩ mô.",
          what_strong_ai_should_notice: "Tính độc nhất của công cụ đo lường.",
          what_weak_ai_would_miss: "Chỉ nghe thấy chi phí kỳ thi.",
          usable_for: ["rebuttal", "judging"],
          evidence_status: "mentioned_but_unverified",
          confidence: 0.9,
        },
      ],
      phrase_bank: [
        {
          phrase_vi: "Giữ một thước đo chung hay chấp nhận sự phân mảnh?",
          function: "crystallization",
          english_meaning: "Keep a shared metric or accept fragmentation?",
          difficulty: "intermediate",
          natural_truong_teen_style: true,
          confidence: 0.95,
        },
      ],
      judging_lessons: [
        {
          lesson: "Mô hình thay thế phải thay được chức năng vĩ mô.",
          rewarded_behavior: "So sánh trực diện chức năng hệ thống.",
          penalized_behavior: "Chỉ kể lợi ích cá nhân.",
          thinkfy_judge_rule: "Penalize countermodels that cannot replace the unique macro function.",
          evidence_status: "verified_from_video",
          confidence: 0.95,
        },
      ],
    },
    {
      match_key: "metadata_only_intro",
      match_confidence: 0.5,
      motion: {
        vi: "Các cuộc thi mang tính cạnh tranh dành cho học sinh cần được chấm dứt",
      },
      teams: [],
      debate_moments: [],
      phrase_bank: [],
      judging_lessons: [],
    },
  ],
};

const parsed = parseCorpusImportText(JSON.stringify(bundle));
assert.equal(parsed.inputFormat, "json");
assert.equal(parsed.objectCount, 1);
assert.equal(parsed.seed.sources.length, 1);
assert.equal(parsed.seed.canonical_matches.length, 2);

const summary = summarizeCorpusSeed(parsed.seed);
assert.equal(summary.sources, 1);
assert.equal(summary.matches, 2);
assert.equal(summary.items, 3);
assert.equal(summary.motions, 2);

const candidates = buildCorpusMotionCandidatePlans(parsed.seed);
assert.equal(candidates[0]?.categoryKey, "education");
assert.equal(candidates[0]?.difficulty, "advanced");

const markdown = [
  "# reviewed bundle",
  "",
  "```json",
  JSON.stringify(bundle),
  "```",
].join("\n");
const parsedMarkdown = parseCorpusImportText(markdown);
assert.equal(parsedMarkdown.inputFormat, "markdown");
assert.equal(parsedMarkdown.seed.canonical_matches[0]?.motion.vi, bundle.matches[0].motion.vi);

assert.equal(
  hashCorpusMotionTitle("Nên bỏ kỳ thi tốt nghiệp trung học phổ thông."),
  hashCorpusMotionTitle("nên bỏ kỳ thi tốt nghiệp trung học phổ thông"),
  "motion dedupe hash should ignore punctuation and casing"
);
