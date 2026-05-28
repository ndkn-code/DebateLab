import assert from "node:assert/strict";
import { pruneCoachMetadata } from "./metadata";
import type { CoachMessageMetadata } from "@/types";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const screenshotLikeAnswer = `Phản biện của bạn yếu hơn trình bày vì một số lý do. Trước hết, bạn đã xác định được điểm mạnh của mình là trình bày, nhưng phản biện vẫn còn là một khoảng trống cần cải thiện.

Một số yếu tố có thể dẫn đến việc phản biện của bạn yếu hơn trình bày bao gồm:

- Thiếu kinh nghiệm và thực hành trong việc xây dựng và trình bày các lập luận phản biện
- Chưa hiểu rõ về các kỹ thuật và chiến thuật phản biện hiệu quả
- Khó khăn trong việc phân tích và đánh giá các lập luận của đối thủ

Để cải thiện phản biện, bạn cần tập trung vào việc xây dựng các kỹ năng như:

- Xây dựng lập luận phản biện rõ ràng và thuyết phục
- Phân tích và đánh giá các lập luận của đối thủ
- Sử dụng các kỹ thuật và chiến thuật phản biện hiệu quả`;

test("prunes screenshot-like duplicate generic diagnosis and next steps", () => {
  const metadata: CoachMessageMetadata = {
    renderVersion: 1,
    suggestedActions: [],
    blocks: [
      {
        id: "diagnosis",
        type: "diagnosis",
        title: "Phân tích điểm yếu",
        body: "Phản biện của bạn yếu hơn trình bày vì một số lý do. Trước hết, bạn đã xác định được điểm mạnh của mình là trình bày, nhưng phản biện vẫn còn là một khoảng trống cần cải thiện.",
        items: [
          "Thiếu kinh nghiệm và thực hành trong việc xây dựng và trình bày các lập luận phản biện",
          "Chưa hiểu rõ về các kỹ thuật và chiến thuật phản biện hiệu quả",
          "Khó khăn trong việc phân tích và đánh giá các lập luận của đối thủ",
        ],
      },
      {
        id: "next",
        type: "next_steps",
        title: "Cải thiện phản biện",
        body: "Để cải thiện phản biện, bạn cần tập trung vào việc xây dựng các kỹ năng như:",
        items: [
          "Xây dựng lập luận phản biện rõ ràng và thuyết phục",
          "Phân tích và đánh giá các lập luận của đối thủ",
          "Sử dụng các kỹ thuật và chiến thuật phản biện hiệu quả",
        ],
      },
    ],
  };

  const result = pruneCoachMetadata(metadata, {
    assistantText: screenshotLikeAnswer,
    studentMessage: "Phản biện của tôi yếu hơn trình bày, vì sao?",
  });

  assert.equal(result.metadata, null);
  assert.equal(result.audit.rejectedBlockCount, 2);
  assert.ok(result.audit.reasons.low_signal || result.audit.reasons.duplicates_answer);
});

test("keeps a concrete timed drill", () => {
  const metadata: CoachMessageMetadata = {
    renderVersion: 1,
    suggestedActions: [],
    blocks: [
      {
        id: "drill",
        type: "drill",
        title: "Drill 60 giây",
        body: "Trong 60 giây, viết lại phản biện bằng 2 câu: một câu chỉ ra cơ chế sai, một câu weighing tác động.",
        items: [
          "Câu 1: cơ chế nào của đối phương không vận hành?",
          "Câu 2: tại sao tác hại này lớn hơn lợi ích họ nêu?",
        ],
      },
    ],
  };

  const result = pruneCoachMetadata(metadata, {
    assistantText:
      "Bạn đang thiếu lớp cơ chế. Hãy tập viết ngắn hơn và gắn vào weighing.",
  });

  assert.equal(result.metadata?.blocks.length, 1);
  assert.equal(result.metadata?.blocks[0]?.type, "drill");
  assert.equal(result.audit.rejectedBlockCount, 0);
});

test("visual explainer messages hide normal cards", () => {
  const metadata: CoachMessageMetadata = {
    renderVersion: 1,
    visualizable: true,
    suggestedActions: [],
    blocks: [
      {
        id: "note",
        type: "diagnosis",
        title: "Sơ đồ",
        body: "Nội dung này sẽ được minh hoạ bằng sơ đồ.",
      },
    ],
  };

  const result = pruneCoachMetadata(metadata, {
    intent: "visual_explainer",
    assistantText: "Dưới đây là cách hiểu ý này.",
  });

  assert.equal(result.metadata?.blocks.length, 0);
  assert.equal(
    result.audit.reasons.visual_explainer_no_extra_cards,
    1
  );
});

test("keeps one concrete next move but trims additional normal cards", () => {
  const metadata: CoachMessageMetadata = {
    renderVersion: 1,
    suggestedActions: [],
    blocks: [
      {
        id: "next",
        type: "next_steps",
        title: "Bước tiếp theo",
        body: "Trong 60 giây, rewrite phản biện thành: Claim sai ở cơ chế nào? Impact nào lớn hơn?",
      },
      {
        id: "diagnosis",
        type: "diagnosis",
        title: "Thiếu weighing",
        body: "Bạn có nhắc tác hại nhưng chưa so sánh vì sao tác hại đó lớn hơn lợi ích.",
      },
    ],
  };

  const result = pruneCoachMetadata(metadata, {
    assistantText: "Bạn cần thêm weighing cụ thể.",
  });

  assert.equal(result.metadata?.blocks.length, 1);
  assert.equal(result.metadata?.blocks[0]?.id, "next");
  assert.equal(result.audit.reasons.normal_card_limit, 1);
});
