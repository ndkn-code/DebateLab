import assert from "node:assert/strict";
import {
  analyzeTruongTeenOpponentOutput,
  ensureTruongTeenStandaloneOffense,
} from "./opponent-quality";

const casePlan = {
  independentClaims: [
    {
      label: "Chuẩn hóa công bằng",
      claim:
        "một thước đo chung giúp học sinh ở các vùng khác nhau được so sánh bằng cùng một chuẩn tối thiểu",
      mechanism:
        "khi có chuẩn ngoài trường, học bạ nội bộ khó bị làm đẹp mà không bị phát hiện",
      impact:
        "giảm bất công giữa học sinh ở trường mạnh và trường yếu khi xét tốt nghiệp",
      answerability: "đội bạn có thể chứng minh rằng học bạ đã đủ chuẩn hóa",
    },
  ],
};

const closingWithNewLd =
  "Chốt lại, trận này được quyết định bởi tính công bằng. Bây giờ tôi sẽ đưa ra một luận điểm độc lập của chúng tôi. Luận điểm độc lập của chúng tôi là: bỏ kỳ thi tạo ra lạm phát học bạ. Vì vậy, so sánh hai thế giới, phía chúng tôi thắng.";

const closingMetrics = analyzeTruongTeenOpponentOutput(
  closingWithNewLd,
  "closing"
);
assert.equal(closingMetrics.version, 2);
assert.equal(closingMetrics.hasClosingNewArgumentRisk, true);
assert.ok(closingMetrics.closingNewArgumentCueCount >= 1);

const supportedPercentMetrics = analyzeTruongTeenOpponentOutput(
  "Đội bạn thừa nhận rằng gia đình và nhà trường tạo ra 70% áp lực. So sánh hai thế giới, điểm này làm gánh nặng của họ yếu hơn.",
  "closing",
  {
    sourceText:
      "Đội bạn dẫn số liệu rằng bảy mươi phần trăm áp lực đến từ gia đình và nhà trường.",
  }
);
assert.equal(supportedPercentMetrics.hasInventedEvidenceRisk, false);

const unsupportedPercentMetrics = analyzeTruongTeenOpponentOutput(
  "Theo một nghiên cứu, gia đình và nhà trường tạo ra 70% áp lực. So sánh hai thế giới, điểm này làm gánh nặng của họ yếu hơn.",
  "closing",
  {
    sourceText: "Đội bạn nói áp lực đến từ gia đình và nhà trường.",
  }
);
assert.equal(unsupportedPercentMetrics.hasInventedEvidenceRisk, true);

const closingGuardrail = ensureTruongTeenStandaloneOffense({
  text: "Chốt lại, đội bạn chưa chứng minh được cơ chế thay thế. So sánh hai thế giới, rủi ro bất công của họ lớn hơn.",
  mode: "closing",
  casePlan,
});
assert.equal(closingGuardrail.inserted, false);
assert.equal(closingGuardrail.text.includes("Luận điểm độc lập"), false);

const rebuttalGuardrail = ensureTruongTeenStandaloneOffense({
  text: "Đội bạn đang giả định rằng nhà trường tự động công bằng hơn, nhưng chưa có cơ chế giám sát. So sánh hai thế giới, rủi ro này lớn hơn.",
  mode: "rebuttal",
  casePlan,
});
assert.equal(rebuttalGuardrail.inserted, true);
assert.match(rebuttalGuardrail.text, /Luận điểm độc lập của chúng tôi là/);
