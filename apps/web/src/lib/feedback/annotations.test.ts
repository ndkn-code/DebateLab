import assert from "node:assert/strict";
import {
  locateTranscriptAnnotations,
  normalizeTranscriptAnnotations,
  normalizeTranscriptAnnotationsForFeedback,
} from "@/lib/feedback/annotations";

const normalized = normalizeTranscriptAnnotations([
  {
    quote: "Cảm ơn đội bạn.",
    speaker: "ai",
    tag: "clash",
    severity: "improvement",
    feedback: "Needs a better answer.",
    suggestion: "Answer the actual clash.",
  },
  {
    quote: "Cảm ơn đội bạn đã có những luận điểm rất rõ ràng.",
    speaker: "ai",
    tag: "clash",
    severity: "improvement",
    feedback: "Needs a better answer.",
    suggestion: "Anchor this on an actual clash.",
  },
  {
    quote: "Kính thưa ban giám khảo và quý vị khán giả.",
    speaker: "user",
    tag: "stance",
    severity: "strength",
    feedback: "Opening etiquette is not a substantive argument.",
    suggestion: "Quote the claim after the greeting instead.",
  },
  {
    quote:
      "Hello Vậy là rồi điều màn hình là không ghi âm được Đối mặt với một cái lý độc hại",
    speaker: "user",
    tag: "claim",
    severity: "strength",
    feedback: "Anchors the burden.",
    suggestion: "Remove the noisy opening words.",
  },
  {
    quote: "AI chủ động ở đây quét siêu dữ liệu",
    speaker: "user",
    tag: "claim",
    severity: "improvement",
    feedback: "This is the real mechanism clash.",
    suggestion: "Add thresholds and safeguards.",
  },
  {
    quote: "AI chủ động ở đây quét siêu dữ liệu",
    speaker: "user",
    tag: "logic",
    severity: "improvement",
    feedback: "Duplicate should be removed.",
    suggestion: "Duplicate should be removed.",
  },
]);

assert.equal(normalized.length, 1);
assert.equal(normalized[0].quote, "AI chủ động ở đây quét siêu dữ liệu");
assert.equal(normalized[0].tag, "stance");

assert.equal(
  locateTranscriptAnnotations("Kính thưa ban giám khảo và quý vị khán giả.", [
    {
      quote: "Kính thưa ban giám khảo và quý vị khán giả.",
      speaker: "user",
      tag: "stance",
      severity: "strength",
      feedback: "Opening etiquette is not a substantive argument.",
      suggestion: "Quote the claim after the greeting instead.",
    },
  ]).length,
  0
);

const validated = normalizeTranscriptAnnotationsForFeedback(
  [
    {
      quote: "Truyền thông nên ngừng ca ngợi các cá nhân có thành công đến sớm",
      speaker: "user",
      roundNumber: 1,
      tag: "rebuttal",
      severity: "improvement",
      feedback:
        "Phần này đang nói về survival bias nhưng quote lại chỉ là motion title.",
      suggestion:
        "Hãy neo vào đoạn bạn gọi đây là ngụy biện kẻ sống sót rồi giải thích nhóm bị bỏ lại.",
    },
  ],
  {
    transcript:
      "Truyền thông nên ngừng ca ngợi các cá nhân có thành công đến sớm. Đây là ngụy biện kẻ sống sót vì chúng ta chỉ thấy những người thành công được lên báo, còn số đông thất bại thì bị biến mất khỏi câu chuyện.",
    topic: "Truyền thông nên ngừng ca ngợi các cá nhân có thành công đến sớm",
    practiceLanguage: "vi",
    depthTarget: { minAnnotations: 1 },
  }
);
assert.equal(validated.metadata.rejectedCount, 1);
assert.equal(validated.metadata.repairUsed, true);
assert.match(validated.annotations[0].quote, /ngụy biện kẻ sống sót/);

const fallback = normalizeTranscriptAnnotationsForFeedback([], {
  transcript:
    "Chúng tôi phản biện rằng áp lực không đến từ truyền thông mà đến từ bộ lọc kỳ vọng méo mó của phụ huynh và nhà trường. Vì vậy cơ chế của đội bạn chưa chứng minh được nguyên nhân gốc.",
  topic: "Truyền thông nên ngừng ca ngợi các cá nhân có thành công đến sớm",
  practiceLanguage: "vi",
  depthTarget: { minAnnotations: 1 },
});
assert.equal(fallback.metadata.fallbackUsed, true);
assert.equal(fallback.annotations.length, 1);

const headingRepair = normalizeTranscriptAnnotationsForFeedback(
  [
    {
      quote: "Phản biện hai: vạch trần: ngụy biện kẻ sống sót.",
      speaker: "user",
      tag: "rebuttal",
      severity: "improvement",
      feedback: "Phần survival bias cần được neo vào câu giải thích thật.",
      suggestion: "Quote the sentence explaining why only visible winners are misleading.",
    },
  ],
  {
    transcript:
      "Phản biện hai: vạch trần: ngụy biện kẻ sống sót. Đội bạn đã rơi vào bẫy ngụy biện kẻ sống sót vì chỉ nhìn thấy những cá nhân thành công được truyền thông đưa tin, còn số đông thất bại thì bị bỏ khỏi câu chuyện.",
    topic: "Truyền thông nên ngừng ca ngợi các cá nhân có thành công đến sớm",
    practiceLanguage: "vi",
    depthTarget: { minAnnotations: 1 },
  }
);
assert.equal(headingRepair.metadata.repairUsed, true);
assert.equal(headingRepair.annotations.length, 1);
assert.match(headingRepair.annotations[0].quote, /số đông thất bại/);
assert.doesNotMatch(headingRepair.annotations[0].quote, /^Phản biện hai:/);

const duplicateAfterRepair = normalizeTranscriptAnnotationsForFeedback(
  [
    {
      quote: "Truyền thông nên ngừng ca ngợi các cá nhân có thành công đến sớm",
      speaker: "user",
      tag: "rebuttal",
      severity: "improvement",
      feedback: "Cần neo vào cơ chế truyền thông khuếch đại áp lực.",
      suggestion: "Quote the sentence about family and school using media examples.",
    },
    {
      quote: "Một quote không tồn tại trong transcript",
      speaker: "user",
      tag: "rebuttal",
      severity: "improvement",
      feedback: "Cần neo vào cơ chế truyền thông khuếch đại áp lực.",
      suggestion: "Quote the sentence about family and school using media examples.",
    },
  ],
  {
    transcript:
      "Truyền thông nên ngừng ca ngợi các cá nhân có thành công đến sớm. Gia đình và nhà trường không tự nhiên sinh ra các tiêu chuẩn độc hại; họ lấy chính những hình mẫu do truyền thông thắp sáng làm thước đo để áp đặt lên con cái.",
    topic: "Truyền thông nên ngừng ca ngợi các cá nhân có thành công đến sớm",
    practiceLanguage: "vi",
    depthTarget: { minAnnotations: 2 },
  }
);
assert.equal(duplicateAfterRepair.annotations.length, 1);
assert.match(
  duplicateAfterRepair.metadata.rejectedReasons.join(","),
  /duplicate_quote/
);

const weakFallback = normalizeTranscriptAnnotationsForFeedback([], {
  transcript:
    "Phản biện ba: tái định hình so sánh hai thế giới xã hội bền vững vsus, cuộc đua trình diễn.",
  topic: "Một chính sách giả định",
  practiceLanguage: "vi",
  depthTarget: { minAnnotations: 1 },
});
assert.equal(weakFallback.annotations.length, 0);

const longSentenceFallback = normalizeTranscriptAnnotationsForFeedback([], {
  transcript:
    "Chúng tôi phản biện rằng cơ chế này cần được xem xét trong một chuỗi tác động rất dài vì nếu chỉ nói rằng chính sách sẽ giúp người trẻ tự tin hơn mà không chỉ ra nhóm chịu tác động, xác suất thay đổi hành vi, chi phí cơ hội, khả năng phản ứng của đối phương và mức độ đảo ngược thiệt hại thì lập luận vẫn chỉ là một khẳng định chung chung thiếu neo bằng chứng.",
  topic: "Một chính sách giả định",
  practiceLanguage: "vi",
  depthTarget: { minAnnotations: 1 },
});
assert.equal(longSentenceFallback.annotations.length, 0);

const cappedFallback = normalizeTranscriptAnnotationsForFeedback([], {
  transcript:
    "Cơ chế thứ nhất chưa rõ nhóm chịu tác động và thiếu bằng chứng so sánh trực tiếp. Tác động thứ hai có số liệu 70% nhưng chưa cân được xác suất. Phản biện thứ ba có clash nhưng thiếu bước weighing cuối cùng.",
  topic: "Một chính sách giả định",
  practiceLanguage: "vi",
  depthTarget: { minAnnotations: 10 },
});
assert.ok(cappedFallback.annotations.length <= 2);

console.log("Transcript annotation normalization tests passed");
