import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createDeepSeekChatCompletion,
  type DeepSeekMessage,
} from "@/lib/ai/deepseek";
import type {
  AiDifficulty,
  MotionBrief,
  PracticeLanguage,
  PracticeTrack,
} from "@/types";

export const TRUONG_TEEN_CASE_PLAN_VERSION = "truong-teen-case-plan-v1";

export interface TruongTeenCaseClaim {
  label: string;
  claim: string;
  mechanism: string;
  impact: string;
  answerability: string;
}

export interface TruongTeenCaseSkeletonReference {
  itemId: string;
  side: "proposition" | "opposition" | "neutral" | "unknown";
  confidence: number;
  content: Record<string, unknown>;
}

export interface TruongTeenOpponentCasePlan {
  version: typeof TRUONG_TEEN_CASE_PLAN_VERSION;
  cacheKey: string;
  cacheHit: boolean;
  generationSource: "cache" | "deepseek" | "fallback";
  promptPrefixHash: string | null;
  motion: string;
  aiSide: "proposition" | "opposition";
  studentSide: "proposition" | "opposition";
  independentClaims: TruongTeenCaseClaim[];
  expectedRebuttalTargets: string[];
  weighingHooks: string[];
  crystallization: string;
  corpus: {
    exactMotionCaseSkeletonCount: number;
    usedItemIds: string[];
  };
  latencyMs: number | null;
  providerRequestIds: string[];
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    cacheHitTokens?: number;
    cacheMissTokens?: number;
  };
}

interface GetCasePlanParams {
  supabase?: SupabaseClient | null;
  userId?: string | null;
  topic: string;
  aiSide: "proposition" | "opposition";
  studentSide: "proposition" | "opposition";
  difficulty: AiDifficulty;
  debateFormat: "rebuttal" | "closing";
  practiceLanguage: PracticeLanguage;
  practiceTrack: PracticeTrack;
  motionBrief?: MotionBrief;
  sourceRoute: string;
}

interface CacheEntry {
  expiresAt: number;
  plan: TruongTeenOpponentCasePlan;
}

const CASE_PLAN_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const casePlanCache = new Map<string, CacheEntry>();

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function clip(value: string, max = 900) {
  const normalized = compactWhitespace(value);
  return normalized.length > max
    ? `${normalized.slice(0, max - 1).trim()}...`
    : normalized;
}

function hashValue(value: unknown) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function normalizeMotionKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown, max = 500) {
  return typeof value === "string" ? clip(value, max) : "";
}

function readStringArray(value: unknown, limit: number, maxLength = 500) {
  return Array.isArray(value)
    ? value
        .map((item) => readString(item, maxLength))
        .filter(Boolean)
        .slice(0, limit)
    : [];
}

function readClaimSeed(value: unknown): Partial<TruongTeenCaseClaim> | null {
  if (typeof value === "string") {
    const claim = clip(value, 600);
    return claim ? { claim } : null;
  }
  const source = asRecord(value);
  const claim = readString(source.claim ?? source.text ?? source.summary, 600);
  if (!claim) return null;
  return {
    label: readString(source.label ?? source.title, 120),
    claim,
    mechanism: readString(source.mechanism ?? source.why, 700),
    impact: readString(source.impact ?? source.impact_summary, 500),
    answerability: readString(source.answerability ?? source.response, 500),
  };
}

function sideLabel(side: "proposition" | "opposition") {
  return side === "proposition" ? "Ủng hộ" : "Phản đối";
}

function cloneAsCacheHit(plan: TruongTeenOpponentCasePlan) {
  return {
    ...plan,
    cacheHit: true,
    generationSource: "cache" as const,
    latencyMs: 0,
    providerRequestIds: [],
  };
}

function getCache(cacheKey: string) {
  const entry = casePlanCache.get(cacheKey);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    casePlanCache.delete(cacheKey);
    return null;
  }
  return cloneAsCacheHit(entry.plan);
}

function setCache(plan: TruongTeenOpponentCasePlan) {
  casePlanCache.set(plan.cacheKey, {
    expiresAt: Date.now() + CASE_PLAN_CACHE_TTL_MS,
    plan: {
      ...plan,
      cacheHit: false,
      generationSource:
        plan.generationSource === "cache" ? "deepseek" : plan.generationSource,
    },
  });
}

function getJoinedMatch(row: Record<string, unknown>) {
  const joined = row.debate_corpus_matches;
  if (Array.isArray(joined)) return asRecord(joined[0]);
  return asRecord(joined);
}

async function fetchExactMotionCaseSkeletons(params: {
  supabase?: SupabaseClient | null;
  topic: string;
}) {
  if (!params.supabase) return [];
  const normalizedTopic = normalizeMotionKey(params.topic);
  if (!normalizedTopic) return [];

  try {
    const { data, error } = await params.supabase
      .from("debate_corpus_items")
      .select(
        "id,side,usable_for,evidence_status,confidence,review_status,content,metadata,debate_corpus_matches!inner(canonical_match_key,motion_vi,motion_key,review_status)"
      )
      .eq("item_type", "case_skeleton")
      .eq("language", "vi")
      .in("review_status", ["candidate", "approved"])
      .limit(80);
    if (error) return [];

    return ((data ?? []) as Record<string, unknown>[])
      .filter((row) => {
        const match = getJoinedMatch(row);
        const motion = readString(match.motion_vi, 400);
        const normalizedMotion = normalizeMotionKey(motion);
        return (
          normalizedMotion === normalizedTopic ||
          normalizedMotion.includes(normalizedTopic) ||
          normalizedTopic.includes(normalizedMotion)
        );
      })
      .map((row): TruongTeenCaseSkeletonReference => ({
        itemId: readString(row.id, 80),
        side:
          row.side === "proposition" ||
          row.side === "opposition" ||
          row.side === "neutral" ||
          row.side === "unknown"
            ? row.side
            : "unknown",
        confidence:
          typeof row.confidence === "number" && Number.isFinite(row.confidence)
            ? row.confidence
            : 0,
        content: asRecord(row.content),
      }))
      .filter((row) => row.itemId)
      .sort((left, right) => right.confidence - left.confidence)
      .slice(0, 4);
  } catch {
    return [];
  }
}

function formatSkeletonReference(reference: TruongTeenCaseSkeletonReference) {
  const nested = asRecord(reference.content.case_skeleton);
  const content = Object.keys(nested).length > 0 ? nested : reference.content;
  const claims = readStringArray(
    content.independent_claims ?? content.claims,
    5,
    600
  );
  const mechanisms = readStringArray(content.mechanisms, 5, 600);
  const weighing = readStringArray(content.weighing_hooks ?? content.weighing, 5, 500);
  const clashes = readStringArray(content.common_clashes ?? content.clashes, 5, 500);

  return [
    `Item: ${reference.itemId}`,
    `Side: ${reference.side}`,
    claims.length ? `Independent claims: ${claims.join(" | ")}` : "",
    mechanisms.length ? `Mechanisms: ${mechanisms.join(" | ")}` : "",
    weighing.length ? `Weighing: ${weighing.join(" | ")}` : "",
    clashes.length ? `Common clashes: ${clashes.join(" | ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildSkeletonPromptBlock(references: TruongTeenCaseSkeletonReference[]) {
  if (references.length === 0) return "No exact-motion case skeletons found.";
  return references.map(formatSkeletonReference).join("\n\n");
}

function readSkeletonContent(reference: TruongTeenCaseSkeletonReference) {
  const nested = asRecord(reference.content.case_skeleton);
  return Object.keys(nested).length > 0 ? nested : reference.content;
}

function buildCacheKey(params: {
  topic: string;
  aiSide: "proposition" | "opposition";
  studentSide: "proposition" | "opposition";
  difficulty: AiDifficulty;
  debateFormat: "rebuttal" | "closing";
  practiceLanguage: PracticeLanguage;
  practiceTrack: PracticeTrack;
  motionBrief?: MotionBrief;
  skeletons: TruongTeenCaseSkeletonReference[];
}) {
  return hashValue({
    version: TRUONG_TEEN_CASE_PLAN_VERSION,
    corpusVersion: process.env.TRUONG_TEEN_CORPUS_VERSION ?? "default",
    topic: normalizeMotionKey(params.topic),
    aiSide: params.aiSide,
    studentSide: params.studentSide,
    difficulty: params.difficulty,
    debateFormat: params.debateFormat,
    practiceLanguage: params.practiceLanguage,
    practiceTrack: params.practiceTrack,
    motionBriefHash: params.motionBrief ? hashValue(params.motionBrief) : null,
    skeletonHash: hashValue(
      params.skeletons.map((item) => ({
        id: item.itemId,
        side: item.side,
        confidence: item.confidence,
        content: item.content,
      }))
    ),
  });
}

function buildClaimsFromSkeletons(params: {
  aiSide: "proposition" | "opposition";
  skeletons: TruongTeenCaseSkeletonReference[];
}): TruongTeenCaseClaim[] {
  const sidePriority = params.skeletons.filter(
    (item) => item.side === params.aiSide || item.side === "neutral"
  );
  const candidates = (sidePriority.length > 0 ? sidePriority : params.skeletons)
    .flatMap((reference) => {
      const content = readSkeletonContent(reference);
      const claims = Array.isArray(content.independent_claims)
        ? content.independent_claims
        : Array.isArray(content.claims)
          ? content.claims
          : [];
      return claims.map(readClaimSeed).filter(Boolean);
    })
    .filter((claim): claim is Partial<TruongTeenCaseClaim> => Boolean(claim));

  return candidates
    .map((claim, index) => ({
      label: claim.label || `Ý độc lập ${index + 1}`,
      claim: claim.claim ?? "",
      mechanism:
        claim.mechanism ||
        "Cơ chế cần được nối từ động cơ của tác nhân đến hành vi và hệ quả trong đúng motion.",
      impact:
        claim.impact ||
        "Tác động nằm ở việc thay đổi cơ hội, động lực hoặc rủi ro của nhóm bị ảnh hưởng chính.",
      answerability:
        claim.answerability ||
        "đội bạn có thể phản biện bằng cách chứng minh cơ chế này không xảy ra trong thực tế.",
    }))
    .filter((claim) => claim.claim)
    .slice(0, 3);
}

function getTopicFamily(topic: string) {
  const normalized = normalizeMotionKey(topic);
  if (
    normalized.includes("cuoc thi") ||
    normalized.includes("canh tranh") ||
    normalized.includes("hoc sinh")
  ) {
    return "student_competitions";
  }
  if (
    normalized.includes("truyen thong") &&
    (normalized.includes("ca ngoi") || normalized.includes("thanh cong som"))
  ) {
    return "early_success_media";
  }
  return "generic";
}

function buildFallbackClaims(params: {
  aiSide: "proposition" | "opposition";
  topic: string;
  skeletons: TruongTeenCaseSkeletonReference[];
}): TruongTeenCaseClaim[] {
  const skeletonClaims = buildClaimsFromSkeletons(params);
  if (skeletonClaims.length > 0) return skeletonClaims;

  const family = getTopicFamily(params.topic);

  if (family === "early_success_media") {
    return params.aiSide === "opposition"
      ? [
          {
            label: "Vấn đề là cách kể chuyện, không phải việc ghi nhận thành công",
            claim:
              "Truyền thông không cần ngừng ca ngợi người thành công sớm; điều cần thay đổi là ca ngợi kèm bối cảnh, thất bại và điều kiện hỗ trợ phía sau thành công.",
            mechanism:
              "Khi câu chuyện có bối cảnh, công chúng không xem thành công sớm như chuẩn bắt buộc, mà xem nó như một trường hợp học hỏi về nỗ lực, may mắn, nguồn lực và lựa chọn cá nhân.",
            impact:
              "Xã hội vẫn giữ được hình mẫu truyền cảm hứng nhưng giảm được áp lực tuổi tác và ảo tưởng rằng ai chậm hơn là thất bại.",
            answerability:
              "đội bạn có thể chứng minh truyền thông đại chúng có động cơ giật tít nên gần như không thể ca ngợi có trách nhiệm.",
          },
          {
            label: "Im lặng làm mất hình mẫu tích cực cho người trẻ",
            claim:
              "Nếu truyền thông dừng ghi nhận thành công đến sớm, người trẻ mất một nhóm hình mẫu cho thấy năng lực và đóng góp không nhất thiết phải chờ đến tuổi trưởng thành muộn.",
            mechanism:
              "Việc nhìn thấy người cùng thế hệ làm được điều khó có thể mở rộng tưởng tượng nghề nghiệp, nhất là với học sinh không có mạng lưới cố vấn gần gũi.",
            impact:
              "Tác động tích cực là tăng tham vọng có định hướng, miễn là truyền thông không biến ngoại lệ thành thước đo phổ quát.",
            answerability:
              "đội bạn có thể phản biện rằng cảm hứng này nhỏ hơn áp lực so sánh mà số đông phải chịu.",
          },
        ]
      : [
          {
            label: "Ca ngợi thành công sớm tạo chuẩn tuổi tác độc hại",
            claim:
              "Khi truyền thông liên tục tôn vinh người thành công quá sớm, xã hội biến tuổi trẻ thành một cuộc đua thời hạn.",
            mechanism:
              "Người trẻ không chỉ học từ nội dung được ca ngợi, mà còn học từ tiêu chí được chọn để lên sóng: càng trẻ, càng nổi bật, càng đáng ngưỡng mộ.",
            impact:
              "Điều này tạo áp lực tự so sánh, sợ chậm nhịp và đánh giá thấp những con đường phát triển bền vững hơn.",
            answerability:
              "đội bạn có thể chứng minh truyền thông có thể ca ngợi cân bằng mà không tạo chuẩn tuổi tác.",
          },
          {
            label: "Truyền thông biến ngoại lệ thành kỳ vọng phổ quát",
            claim:
              "Cá nhân thành công sớm thường là ngoại lệ có điều kiện đặc biệt, nhưng truyền thông dễ kể họ như công thức ai cũng nên đạt được.",
            mechanism:
              "Câu chuyện thành công thường lược bỏ nguồn lực gia đình, may mắn, mạng lưới và chi phí đánh đổi, khiến khán giả hiểu sai nguyên nhân thành công.",
            impact:
              "Nhóm không có điều kiện tương tự bị đổ lỗi cá nhân khi không đạt cùng kết quả.",
            answerability:
              "đội bạn có thể phản biện bằng cách chứng minh lợi ích truyền cảm hứng vẫn lớn hơn rủi ro hiểu sai.",
          },
        ];
  }

  if (family === "student_competitions") {
    if (params.aiSide === "opposition") {
      return [
        {
          label: "Cạnh tranh có điều kiện tạo động lực thật",
          claim:
            "Vấn đề không phải là mọi cuộc thi đều độc hại, mà là cách thiết kế cuộc thi quyết định nó tạo áp lực hay tạo động lực.",
          mechanism:
            "Khi học sinh có một mục tiêu rõ, luật chơi minh bạch và phản hồi từ giám khảo, các em học cách đặt chuẩn cao hơn cho bản thân thay vì chỉ học để hoàn thành tối thiểu.",
          impact:
            "Điều này tạo kỹ năng chịu áp lực, cải thiện năng lực trình bày và giúp học sinh phát hiện thế mạnh sớm.",
          answerability:
            "đội bạn có thể chứng minh phần lớn cuộc thi trong thực tế không có điều kiện bảo vệ này.",
        },
        {
          label: "Chấm dứt toàn bộ làm mất công cụ phát hiện bất bình đẳng",
          claim:
            "Xóa bỏ cuộc thi không xóa bỏ áp lực thành tích; nó chỉ đẩy cạnh tranh sang những kênh ít minh bạch hơn.",
          mechanism:
            "Nếu không còn sân chơi công khai, học sinh có nguồn lực vẫn cạnh tranh qua học thêm, quan hệ, hồ sơ cá nhân và các cơ hội ngoài trường.",
          impact:
            "Nhóm yếu thế mất một con đường được nhìn thấy năng lực, còn hệ thống giáo dục mất dữ liệu để hỗ trợ tài năng.",
          answerability:
            "đội bạn có thể đưa ra mô hình thay thế công bằng hơn hoặc chứng minh cuộc thi hiện tại không còn khả năng sửa.",
        },
      ];
    }

    return [
      {
        label: "Cạnh tranh sớm biến giáo dục thành thước đo danh tính",
        claim:
          "Khi cuộc thi dành cho học sinh được đặt ở trung tâm, trẻ em dễ hiểu rằng giá trị bản thân phụ thuộc vào thứ hạng.",
        mechanism:
          "Nhà trường, phụ huynh và truyền thông cùng khuếch đại huy chương, khiến học sinh tối ưu hóa thành tích thay vì quá trình học.",
        impact:
          "Điều này tạo áp lực tâm lý, sợ thất bại và thu hẹp động lực học tập nội tại.",
        answerability:
          "đội bạn có thể chứng minh thiết kế cuộc thi tốt vẫn tách được kết quả khỏi giá trị cá nhân.",
      },
      {
        label: "Cuộc thi phân bổ cơ hội theo nguồn lực, không chỉ theo năng lực",
        claim:
          "Trong thực tế, học sinh không bước vào cạnh tranh với cùng điểm xuất phát.",
        mechanism:
          "Gia đình có tiền, thời gian và thông tin có thể mua luyện thi, huấn luyện và mạng lưới hỗ trợ tốt hơn.",
        impact:
          "Cuộc thi vì thế dễ hợp thức hóa bất bình đẳng bằng ngôn ngữ tài năng.",
        answerability:
          "đội bạn có thể đáp lại bằng cách chứng minh cuộc thi là kênh phát hiện tài năng rẻ hơn các hình thức tuyển chọn khác.",
      },
    ];
  }

  return params.aiSide === "opposition"
    ? [
        {
          label: "Motion đang phản ứng quá rộng",
          claim:
            "Lập trường phản đối không cần chứng minh hiện trạng hoàn hảo; chúng tôi chứng minh việc dừng hoặc chấm dứt hoàn toàn là phản ứng quá rộng so với vấn đề mà motion nêu ra.",
          mechanism:
            "Một thực hành xã hội thường gây hại vì cách thiết kế, động cơ truyền thông hoặc thiếu chuẩn bảo vệ, nên giải pháp hẹp có thể xử lý điểm hại mà không xóa toàn bộ lợi ích.",
          impact:
            "Thế giới của chúng tôi giữ lại cơ hội, tín hiệu tích cực hoặc không gian thử nghiệm, đồng thời vẫn cho phép sửa phần gây hại.",
          answerability:
            "đội bạn có thể chứng minh tác hại là bản chất của thực hành này nên không thể sửa bằng quy định hẹp.",
        },
        {
          label: "Cấm đoán làm mất tín hiệu hữu ích",
          claim:
            "Khi xã hội loại bỏ hoàn toàn một kênh ghi nhận hoặc cạnh tranh, những người cần tín hiệu công khai để được nhìn thấy sẽ mất một cơ hội quan trọng.",
          mechanism:
            "Các kênh chính thức tạo tiêu chuẩn minh bạch hơn so với quan hệ cá nhân, nguồn lực gia đình hoặc cơ hội ngầm.",
          impact:
            "Tác động rơi mạnh vào nhóm ít đặc quyền, vì họ cần sân chơi hoặc hình mẫu công khai hơn nhóm vốn đã có mạng lưới hỗ trợ.",
          answerability:
            "đội bạn có thể phản biện bằng cách đưa ra một cơ chế thay thế cụ thể và công bằng hơn.",
        },
      ]
    : [
        {
          label: "Tín hiệu xã hội tạo sai lệch hành vi",
          claim:
            "Khi một thực hành được duy trì và tôn vinh công khai, nó không chỉ phản ánh giá trị xã hội mà còn dạy người trẻ tối ưu hóa hành vi theo tín hiệu đó.",
          mechanism:
            "Trường học, gia đình, truyền thông hoặc thị trường sẽ nhìn vào tín hiệu được thưởng để quyết định nên đầu tư thời gian, danh dự và nguồn lực vào đâu.",
          impact:
            "Nếu tín hiệu ấy sai lệch, số đông phải chịu áp lực, so sánh và phân bổ nguồn lực sai, kể cả khi chỉ một nhóm nhỏ nhận được lợi ích.",
          answerability:
            "đội bạn có thể chứng minh tín hiệu này có thể được giữ lại nhưng diễn giải lành mạnh hơn.",
        },
        {
          label: "Chi phí của số đông quan trọng hơn lợi ích biểu tượng",
          claim:
            "Ngay cả khi motion có vài lợi ích truyền cảm hứng hoặc phát hiện năng lực, ta phải cân với chi phí mà số đông người trẻ phải gánh.",
          mechanism:
            "Những lợi ích biểu tượng thường tập trung vào nhóm nổi bật, còn áp lực và bất bình đẳng lan ra cả những người không có điều kiện tham gia hoặc đạt chuẩn.",
          impact:
            "Vì vậy phía ủng hộ thắng nếu chứng minh tác hại phổ biến, lặp lại và khó đảo ngược hơn lợi ích của vài câu chuyện thành công.",
          answerability:
            "đội bạn có thể phản biện bằng cách chứng minh lợi ích không chỉ nằm ở nhóm đạt kết quả cao.",
        },
      ];
}

function buildFallbackPlan(params: {
  cacheKey: string;
  topic: string;
  aiSide: "proposition" | "opposition";
  studentSide: "proposition" | "opposition";
  skeletons: TruongTeenCaseSkeletonReference[];
  promptPrefixHash: string | null;
  latencyMs: number | null;
}): TruongTeenOpponentCasePlan {
  const independentClaims = buildFallbackClaims({
    aiSide: params.aiSide,
    topic: params.topic,
    skeletons: params.skeletons,
  });
  const family = getTopicFamily(params.topic);
  return {
    version: TRUONG_TEEN_CASE_PLAN_VERSION,
    cacheKey: params.cacheKey,
    cacheHit: false,
    generationSource: "fallback",
    promptPrefixHash: params.promptPrefixHash,
    motion: params.topic,
    aiSide: params.aiSide,
    studentSide: params.studentSide,
    independentClaims,
    expectedRebuttalTargets:
      family === "student_competitions" && params.aiSide === "opposition"
        ? [
            "Đội bạn sẽ nói cuộc thi gây áp lực tâm lý.",
            "Đội bạn sẽ nói cạnh tranh làm học sinh ích kỷ hoặc so sánh bản thân.",
            "Đội bạn sẽ nói chỉ học sinh có điều kiện mới hưởng lợi.",
          ]
        : family === "student_competitions"
          ? [
            "Đội bạn sẽ nói cạnh tranh tạo động lực và phát hiện tài năng.",
            "Đội bạn sẽ nói vấn đề nằm ở cách tổ chức, không nằm ở cuộc thi.",
            "Đội bạn sẽ nói xóa cuộc thi làm mất cơ hội cho học sinh giỏi.",
            ]
          : [
              "Đội bạn sẽ nhấn mạnh tác hại xã hội hoặc tâm lý của thực hành hiện tại.",
              "Đội bạn sẽ nói giải pháp hẹp không đủ vì tác hại nằm ở bản chất của vấn đề.",
              "Đội bạn sẽ cố cân tác hại của số đông so với lợi ích của một nhóm nhỏ.",
            ],
    weighingHooks: [
      "Cân giữa lợi ích phát triển năng lực và rủi ro biến giáo dục thành cuộc đua danh tính.",
      "So sánh thế giới sửa thiết kế cuộc thi với thế giới chấm dứt hoặc giữ nguyên cuộc thi.",
      "Ưu tiên tác động xảy ra với số đông học sinh, không chỉ nhóm đạt giải.",
    ],
    crystallization:
      params.aiSide === "opposition"
        ? "Câu hỏi trung tâm là liệu ta nên xóa một công cụ có thể sửa, hay sửa nó để giữ động lực, minh bạch và cơ hội."
        : "Câu hỏi trung tâm là liệu lợi ích thành tích có đáng để duy trì một hệ thống khiến học sinh định nghĩa bản thân bằng thứ hạng hay không.",
    corpus: {
      exactMotionCaseSkeletonCount: params.skeletons.length,
      usedItemIds: params.skeletons.map((item) => item.itemId),
    },
    latencyMs: params.latencyMs,
    providerRequestIds: [],
  };
}

function buildCasePlanMessages(params: {
  topic: string;
  aiSide: "proposition" | "opposition";
  studentSide: "proposition" | "opposition";
  difficulty: AiDifficulty;
  debateFormat: "rebuttal" | "closing";
  motionBrief?: MotionBrief;
  skeletons: TruongTeenCaseSkeletonReference[];
}): DeepSeekMessage[] {
  return [
    {
      role: "system",
      content: `You produce concise internal case plans for a Vietnamese Trường Teen debate opponent.

Return ONLY valid JSON:
{
  "independentClaims": [
    {
      "label": "short Vietnamese label",
      "claim": "standalone claim for the AI side",
      "mechanism": "actor incentive or causal chain",
      "impact": "why it matters",
      "answerability": "how a student could respond"
    }
  ],
  "expectedRebuttalTargets": ["likely opponent claim to answer"],
  "weighingHooks": ["comparative weighing hook"],
  "crystallization": "one sentence central judge question"
}`,
    },
    {
      role: "user",
      content: `## Static Case-Planning Rules
Create 2-3 standalone offensive claims the AI can use outside pure rebuttal.
Every claim must be answerable by the human debater later.
Prefer mechanisms, incentives, implementation limits, opportunity cost, and weighing.
Do not invent statistics, studies, or named evidence.
Use natural Vietnamese debate language.`,
    },
    {
      role: "user",
      content: `## Dynamic Case Setup
Motion: ${params.topic}
AI side: ${params.aiSide} (${sideLabel(params.aiSide)})
Student side: ${params.studentSide} (${sideLabel(params.studentSide)})
Difficulty: ${params.difficulty}
Speech mode: ${params.debateFormat}

Motion brief:
${params.motionBrief ? JSON.stringify(params.motionBrief, null, 2) : "None supplied."}

Exact-motion corpus case skeletons:
${buildSkeletonPromptBlock(params.skeletons)}`,
    },
  ];
}

function sanitizeClaim(value: unknown): TruongTeenCaseClaim | null {
  const source = asRecord(value);
  const claim = {
    label: readString(source.label ?? source.title, 120),
    claim: readString(source.claim ?? source.text ?? source.summary, 600),
    mechanism: readString(source.mechanism ?? source.why, 700),
    impact: readString(source.impact ?? source.impact_summary, 500),
    answerability: readString(
      source.answerability ?? source.answerable_response ?? source.response,
      500
    ),
  };
  return claim.label && claim.claim && claim.mechanism && claim.impact
    ? claim
    : null;
}

function parseGeneratedPlan(value: string) {
  const trimmed = value.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch?.[0] ?? trimmed) as Record<string, unknown>;
  const rawClaims =
    parsed.independentClaims ??
    parsed.independent_claims ??
    parsed.claims ??
    parsed.offensiveClaims ??
    parsed.offensive_claims;
  const independentClaims = Array.isArray(rawClaims)
    ? rawClaims.map(sanitizeClaim).filter(Boolean)
    : [];
  return {
    independentClaims: independentClaims.slice(0, 3) as TruongTeenCaseClaim[],
    expectedRebuttalTargets: readStringArray(
      parsed.expectedRebuttalTargets ?? parsed.expected_rebuttal_targets,
      5,
      500
    ),
    weighingHooks: readStringArray(
      parsed.weighingHooks ?? parsed.weighing_hooks,
      5,
      500
    ),
    crystallization: readString(parsed.crystallization, 700),
  };
}

export async function getTruongTeenOpponentCasePlan(
  params: GetCasePlanParams
): Promise<TruongTeenOpponentCasePlan | null> {
  if (params.practiceLanguage !== "vi" || params.practiceTrack !== "debate") {
    return null;
  }

  const skeletons = await fetchExactMotionCaseSkeletons({
    supabase: params.supabase,
    topic: params.topic,
  });
  const cacheKey = buildCacheKey({ ...params, skeletons });
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const messages = buildCasePlanMessages({ ...params, skeletons });
  const promptPrefixHash = hashValue({
    system: messages[0]?.content ?? "",
    staticRules: messages[1]?.content ?? "",
  });

  if (
    process.env.TRUONG_TEEN_CASE_PLAN_GENERATION !== "deepseek" ||
    !process.env.DEEPSEEK_API_KEY
  ) {
    const fallback = buildFallbackPlan({
      ...params,
      cacheKey,
      skeletons,
      promptPrefixHash,
      latencyMs: null,
    });
    setCache(fallback);
    return fallback;
  }

  const startedAt = Date.now();
  try {
    const result = await createDeepSeekChatCompletion({
      messages,
      thinking: { type: "disabled" },
      responseFormat: "json_object",
      maxTokens: 900,
      temperature: 0.35,
      timeoutMs: 9000,
      userId: params.userId ?? undefined,
      sourceRoute: `${params.sourceRoute}/case-plan`,
      outputType: "rebuttal",
      metadata: {
        stage: "truong_teen_case_plan",
        casePlanVersion: TRUONG_TEEN_CASE_PLAN_VERSION,
        casePlanCacheKey: cacheKey,
        casePlanPromptPrefixHash: promptPrefixHash,
        exactMotionCaseSkeletonCount: skeletons.length,
        exactMotionCaseSkeletonItemIds: skeletons.map((item) => item.itemId),
      },
    });
    const parsed = parseGeneratedPlan(result.content);
    if (parsed.independentClaims.length === 0) {
      throw new Error("CASE_PLAN_EMPTY_CLAIMS");
    }

    const plan: TruongTeenOpponentCasePlan = {
      version: TRUONG_TEEN_CASE_PLAN_VERSION,
      cacheKey,
      cacheHit: false,
      generationSource: "deepseek",
      promptPrefixHash,
      motion: params.topic,
      aiSide: params.aiSide,
      studentSide: params.studentSide,
      independentClaims: parsed.independentClaims,
      expectedRebuttalTargets:
        parsed.expectedRebuttalTargets.length > 0
          ? parsed.expectedRebuttalTargets
          : buildFallbackPlan({
              ...params,
              cacheKey,
              skeletons,
              promptPrefixHash,
              latencyMs: null,
            }).expectedRebuttalTargets,
      weighingHooks:
        parsed.weighingHooks.length > 0
          ? parsed.weighingHooks
          : buildFallbackPlan({
              ...params,
              cacheKey,
              skeletons,
              promptPrefixHash,
              latencyMs: null,
            }).weighingHooks,
      crystallization:
        parsed.crystallization ||
        buildFallbackPlan({
          ...params,
          cacheKey,
          skeletons,
          promptPrefixHash,
          latencyMs: null,
        }).crystallization,
      corpus: {
        exactMotionCaseSkeletonCount: skeletons.length,
        usedItemIds: skeletons.map((item) => item.itemId),
      },
      latencyMs: Date.now() - startedAt,
      providerRequestIds: result.providerRequestId ? [result.providerRequestId] : [],
      usage: {
        inputTokens: result.usage?.prompt_tokens,
        outputTokens: result.usage?.completion_tokens,
        cacheHitTokens: result.usage?.prompt_cache_hit_tokens,
        cacheMissTokens: result.usage?.prompt_cache_miss_tokens,
      },
    };
    setCache(plan);
    return plan;
  } catch {
    const fallback = buildFallbackPlan({
      ...params,
      cacheKey,
      skeletons,
      promptPrefixHash,
      latencyMs: Date.now() - startedAt,
    });
    setCache(fallback);
    return fallback;
  }
}

export function formatTruongTeenOpponentCasePlanPromptBlock(
  plan: TruongTeenOpponentCasePlan | null | undefined,
  debateFormat: "rebuttal" | "closing" = "rebuttal"
) {
  if (!plan) return "";

  const targets = plan.expectedRebuttalTargets
    .map((target) => `- ${target}`)
    .join("\n");
  const weighing = plan.weighingHooks.map((hook) => `- ${hook}`).join("\n");

  if (debateFormat === "closing") {
    return `\n## Cached AI Opponent Case Plan (${plan.version})
Use this only as closing strategy. Do not introduce any new independent claim, new LD, new model, or "Luận điểm độc lập..." / "Một luận điểm riêng..." signpost. Rebuild only arguments already present in prior AI material, then weigh and crystallize.
Source: ${plan.generationSource}${plan.cacheHit ? " (cache hit)" : ""}

Expected rebuttal targets:
${targets || "- No specific targets supplied."}

Weighing hooks:
${weighing || "- Compare probability, scale, severity, reversibility, and affected group."}

Crystallization:
${plan.crystallization}
`;
  }

  const claims = plan.independentClaims
    .map(
      (claim, index) =>
        `${index + 1}. ${claim.label}: ${claim.claim} Mechanism: ${claim.mechanism} Impact: ${claim.impact} Answerable opening: ${claim.answerability}`
    )
    .join("\n");

  return `\n## Cached AI Opponent Case Plan (${plan.version})
Use this as internal strategy. You still must answer the latest speech, but you must also surface at least one standalone claim from this plan so the student has independent offense to rebut.
Source: ${plan.generationSource}${plan.cacheHit ? " (cache hit)" : ""}
Independent offensive claims:
${claims}

Expected rebuttal targets:
${targets || "- No specific targets supplied."}

Weighing hooks:
${weighing || "- Compare probability, scale, severity, reversibility, and affected group."}

Crystallization:
${plan.crystallization}
`;
}

export function createTruongTeenOpponentCasePlanMetadata(
  plan: TruongTeenOpponentCasePlan | null | undefined
) {
  if (!plan) return {};
  return {
    opponentCasePlanVersion: plan.version,
    opponentCasePlanCacheKey: plan.cacheKey,
    opponentCasePlanCacheHit: plan.cacheHit,
    opponentCasePlanSource: plan.generationSource,
    opponentCasePlanLatencyMs: plan.latencyMs,
    opponentCasePlanPromptPrefixHash: plan.promptPrefixHash,
    opponentCasePlanClaimCount: plan.independentClaims.length,
    opponentCasePlanExpectedRebuttalTargetCount:
      plan.expectedRebuttalTargets.length,
    opponentCasePlanWeighingHookCount: plan.weighingHooks.length,
    opponentCasePlanExactMotionSkeletonCount:
      plan.corpus.exactMotionCaseSkeletonCount,
    opponentCasePlanExactMotionSkeletonItemIds: plan.corpus.usedItemIds,
    opponentCasePlanProviderRequestIds: plan.providerRequestIds,
    opponentCasePlanUsage: plan.usage ?? null,
  };
}
