import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  normalizeTextKey,
  normalizeTruongTeenCorpus,
  splitTopLevelJsonObjects,
} from "./normalize-truong-teen-corpus";

assert.equal(normalizeTextKey("THPT Chuyên Lê Quý Đôn Bình Định"), "thpt chuyen le quy don binh dinh");

const fixture = `
{
  "source": {
    "video_title": "Fixture",
    "youtube_url": "[https://youtu.be/example123?si=test](https://youtu.be/example123?si=test)",
    "source_type": "multi_match_compilation",
    "season": 2025,
    "language": "vi",
    "transcript_quality": "good",
    "overall_confidence": 0.9
  },
  "matches": [
    {
      "match_key": "match_a",
      "match_confidence": 0.95,
      "motion": {
        "vi": "Truyền thông nên ngừng ca ngợi các cá nhân có thành công đến sớm",
        "en_translation": "The media should stop praising early success",
        "motion_confidence": 1
      },
      "teams": [
        { "team_name": "Chu Văn An", "side": "proposition", "confidence": 1 },
        { "team_name": "Lê Quý Đôn Bình Định", "side": "opposition", "confidence": 1 }
      ],
      "segment_map": [
        {
          "segment_type": "poi",
          "approx_start": "00:00",
          "approx_end": "00:30",
          "speaker_or_role": "Hai đội",
          "side": "unclear",
          "summary": "Chất vấn",
          "confidence": 0.8
        }
      ],
      "debate_moments": [
        {
          "moment_key": "m1",
          "moment_type": "weighing",
          "side": "proposition",
          "approx_timestamp": "00:10",
          "short_paraphrase": "Truyền thông tạo FOMO cho số đông.",
          "strategic_value": "Scope weighing.",
          "what_strong_ai_should_notice": "Đây là scope weighing.",
          "what_weak_ai_would_miss": "Chỉ thấy ví dụ.",
          "usable_for": ["weighing", "style"],
          "evidence_status": "not_applicable",
          "confidence": 0.9
        }
      ],
      "phrase_bank": [
        {
          "phrase_vi": "Không cài báo thức cho thành công.",
          "function": "definition",
          "phrase_en": "Do not set an alarm for success.",
          "difficulty": "advanced",
          "natural_truong_teen_style": true,
          "confidence": 0.95
        }
      ],
      "judging_lessons": [],
      "extraction_notes": { "human_review_needed": false }
    }
  ],
  "cross_source_notes": {
    "recommended_import_status": "needs_review",
    "recommended_use": ["rebuttal", "judging"],
    "reason": "Fixture"
  }
}
{
  "source": {
    "video_title": "Fixture duplicate",
    "youtube_url": "https://youtu.be/example456?si=test",
    "source_type": "multi_match_compilation",
    "season": 2025,
    "language": "vi",
    "transcript_quality": "medium",
    "overall_confidence": 0.8
  },
  "matches": [
    {
      "match_key": "match_b",
      "match_confidence": 0.9,
      "motion": {
        "vi": "Truyền thông nên ngừng ca ngợi các cá nhân có thành công đến sớm",
        "en_translation": "The media should stop praising early success",
        "motion_confidence": 1
      },
      "teams": [
        { "team_name": "Chu Văn An", "side": "proposition", "confidence": 1 },
        { "team_name": "Lê Quý Đôn Bình Định", "side": "opposition", "confidence": 1 }
      ],
      "segment_map": [],
      "debate_moments": [],
      "phrase_bank": [],
      "judging_lessons": [],
      "case_skeletons": [
        {
          "side": "opposition",
          "independent_claims": [
            {
              "side": "opposition",
              "label": "Thành công sớm có thể truyền cảm hứng có điều kiện",
              "claim": "Truyền thông không cần ngừng ca ngợi hoàn toàn, mà cần ca ngợi kèm quá trình và điều kiện thành công.",
              "mechanism": "Khi câu chuyện nhấn vào quá trình học, thất bại và hỗ trợ, người trẻ học được mô hình hành động thay vì chỉ so sánh kết quả.",
              "impact": "Nguồn cảm hứng vẫn tồn tại nhưng giảm FOMO và áp lực phi thực tế.",
              "answerability": "Phe ủng hộ có thể phản biện rằng truyền thông đại chúng hiếm khi giữ được sắc thái này."
            }
          ],
          "mechanisms": ["Ca ngợi có ngữ cảnh chuyển trọng tâm từ kết quả sang quá trình."],
          "examples": ["Câu chuyện khởi nghiệp có nhắc tới thất bại và nguồn lực hỗ trợ."],
          "weighing_hooks": ["Cân lợi ích cảm hứng với rủi ro FOMO."],
          "common_clashes": ["Ngừng ca ngợi hoàn toàn hay sửa cách ca ngợi."],
          "evidence_status": "not_applicable",
          "confidence": 0.85
        }
      ],
      "extraction_notes": { "human_review_needed": true }
    }
  ],
  "cross_source_notes": {
    "recommended_import_status": "needs_review",
    "recommended_use": ["rebuttal"],
    "reason": "Fixture"
  }
}
`;

assert.equal(splitTopLevelJsonObjects(fixture).length, 2);

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "truong-teen-corpus-test-"));
const inputPath = path.join(tmpDir, "notes.md");
fs.writeFileSync(inputPath, fixture);

const corpus = normalizeTruongTeenCorpus(inputPath);
assert.equal(corpus.summary.sources, 2);
assert.equal(corpus.summary.source_matches, 2);
assert.equal(corpus.summary.canonical_matches, 1);
assert.equal(corpus.summary.candidate_matches, 1);
assert.equal(corpus.summary.phrase_only_matches, 0);
assert.equal(corpus.summary.debate_moments, 1);
assert.equal(corpus.summary.case_skeletons, 1);
assert.equal(corpus.sources[0]?.youtube_url, "https://youtu.be/example123");
assert.equal(corpus.sources[0]?.transcript_quality, "medium");
assert.equal(corpus.source_matches[0]?.segment_map[0]?.side, "unknown");
assert.deepEqual(corpus.source_matches[0]?.debate_moments[0]?.usable_for, [
  "judging",
  "phrase_bank",
]);
assert.equal(corpus.source_matches[0]?.phrase_bank[0]?.english_meaning, "Do not set an alarm for success.");
assert.equal(corpus.source_matches[0]?.phrase_bank[0]?.function, "burden");
assert.equal(corpus.source_matches[1]?.case_skeletons[0]?.independent_claims.length, 1);

console.log("Truong Teen corpus normalizer tests passed.");
