import type { DebateTopic } from "@/types";
import { getTopicCategoryKey } from "@/lib/topics";
import type { PracticeLanguage } from "@/types";

export type PracticeCategoryTone =
  | "blue"
  | "green"
  | "teal"
  | "violet"
  | "amber"
  | "indigo";

export type PracticeDifficultyTone = "easy" | "medium" | "hard";

export interface PracticeAvatarSeed {
  initials: string;
  toneClassName: string;
}

export interface PracticeTopicDisplay {
  topic: DebateTopic;
  popularityRank: number;
  practiceCount: number;
  summary: string;
  categoryTone: PracticeCategoryTone;
  difficultyTone: PracticeDifficultyTone;
  avatars: PracticeAvatarSeed[];
}

const CATEGORY_TONES: Record<string, PracticeCategoryTone> = {
  technology: "blue",
  education: "green",
  environment: "teal",
  society: "indigo",
  ethics: "violet",
  vietnam: "amber",
};

const AVATAR_TONES = [
  "bg-[#f6c4b8] text-[#7b3d2d]",
  "bg-[#f3d9a4] text-[#7c5312]",
  "bg-[#c8defb] text-[#2756a8]",
  "bg-[#d5efd7] text-[#2e7a49]",
  "bg-[#d9d1ff] text-[#5944bf]",
  "bg-[#ffd6d8] text-[#b74f56]",
] as const;

const AVATAR_INITIALS = [
  "AM",
  "TL",
  "JP",
  "NV",
  "SK",
  "LM",
  "RH",
  "PQ",
] as const;

const FEATURED_ORDER = [
  "tech-01",
  "edu-01",
  "env-03",
  "eth-02",
  "tech-02",
  "vn-04",
  "tech-03",
  "soc-06",
  "edu-02",
  "edu-03",
] as const;

const SUMMARY_OVERRIDES: Record<
  PracticeLanguage,
  Partial<Record<string, string>>
> = {
  en: {
    "tech-01":
      "Social media affects mental health, productivity, and real-life relationships.",
    "edu-01": "Weekends should be for rest, not more academic pressure.",
    "env-03":
      "Banning single-use plastics is essential for a cleaner, healthier future.",
    "eth-02":
      "Absolute free speech is often defended as essential for an open society.",
    "tech-02":
      "AI automation is transforming industries faster than many workers can adapt.",
    "vn-04":
      "Many students feel the system rewards memorization more than independent thought.",
    "tech-03":
      "Phone restrictions in schools are often framed as a focus and wellbeing issue.",
    "soc-06":
      "Public shaming online can silence discussion and escalate conflicts instead of resolving them.",
  },
  vi: {
    "tech-01":
      "Mạng xã hội tác động đến sức khỏe tinh thần, năng suất và quan hệ ngoài đời.",
    "edu-01":
      "Cuối tuần nên dành cho nghỉ ngơi, không phải thêm áp lực học tập.",
    "env-03":
      "Cấm nhựa dùng một lần là bước quan trọng cho tương lai sạch và khỏe hơn.",
    "eth-02":
      "Tự do ngôn luận tuyệt đối thường được bảo vệ như nền tảng của xã hội mở.",
    "tech-02":
      "Tự động hóa AI đang thay đổi ngành nghề nhanh hơn nhiều lao động có thể thích ứng.",
    "vn-04":
      "Nhiều học sinh cảm thấy hệ thống thưởng cho ghi nhớ hơn tư duy độc lập.",
    "tech-03":
      "Hạn chế điện thoại trong trường thường được xem là vấn đề tập trung và sức khỏe tinh thần.",
    "soc-06":
      "Bêu xấu công khai trên mạng có thể làm im lặng thảo luận và đẩy xung đột đi xa hơn.",
  },
};

const PRACTICE_COUNT_OVERRIDES: Partial<Record<string, number>> = {
  "tech-01": 1200,
  "edu-01": 932,
  "env-03": 1100,
  "eth-02": 874,
  "tech-02": 665,
  "vn-04": 712,
  "tech-03": 558,
  "soc-06": 689,
};

const FEATURED_ORDER_INDEX = FEATURED_ORDER.reduce<Record<string, number>>(
  (accumulator, id, index) => {
    accumulator[id] = index;
    return accumulator;
  },
  {}
);

function clampCount(value: number) {
  return Math.max(108, value);
}

function formatPracticeCount(value: number) {
  if (value >= 1000) {
    const rounded = Math.round((value / 1000) * 10) / 10;
    return `${rounded.toFixed(rounded % 1 === 0 ? 0 : 1)}K practiced`;
  }

  return `+${value} practiced`;
}

function resolveSummary(topic: DebateTopic, language: PracticeLanguage) {
  const override = SUMMARY_OVERRIDES[language][topic.topicKey ?? topic.id];
  if (override) {
    return override;
  }

  const source =
    topic.context?.trim() ??
    topic.suggestedPoints?.proposition?.[0]?.trim() ??
    topic.suggestedPoints?.opposition?.[0]?.trim() ??
    "";

  if (!source) {
    return "Build your case, test your reasoning, and sharpen how you explain impact.";
  }

  if (source.length <= 92) {
    return source;
  }

  return `${source.slice(0, 89).trimEnd()}...`;
}

function resolveDifficultyTone(
  difficulty: DebateTopic["difficulty"]
): PracticeDifficultyTone {
  if (difficulty === "advanced") {
    return "hard";
  }

  if (difficulty === "intermediate") {
    return "medium";
  }

  return "easy";
}

function resolvePracticeCount(
  topic: DebateTopic,
  index: number,
  total: number
) {
  if (PRACTICE_COUNT_OVERRIDES[topic.id]) {
    return PRACTICE_COUNT_OVERRIDES[topic.id] as number;
  }

  const difficultyBoost =
    topic.difficulty === "advanced"
      ? 190
      : topic.difficulty === "intermediate"
        ? 120
        : 40;

  return clampCount(1480 - index * 79 - (total - index) * 3 + difficultyBoost);
}

function resolveAvatars(index: number): PracticeAvatarSeed[] {
  return Array.from({ length: 3 }, (_, avatarIndex) => {
    const seedIndex = (index + avatarIndex * 2) % AVATAR_INITIALS.length;
    const toneIndex = (index + avatarIndex) % AVATAR_TONES.length;

    return {
      initials: AVATAR_INITIALS[seedIndex],
      toneClassName: AVATAR_TONES[toneIndex],
    };
  });
}

export function buildPracticeTopicDisplays(
  sourceTopics: DebateTopic[],
  language: PracticeLanguage = "en"
): PracticeTopicDisplay[] {
  const sourceIndexById = new Map(
    sourceTopics.map((topic, index) => [topic.id, index])
  );
  const orderedTopics = [...sourceTopics].sort((left, right) => {
    const leftIndex = FEATURED_ORDER_INDEX[left.id];
    const rightIndex = FEATURED_ORDER_INDEX[right.id];

    if (leftIndex !== undefined && rightIndex !== undefined) {
      return leftIndex - rightIndex;
    }

    if (leftIndex !== undefined) {
      return -1;
    }

    if (rightIndex !== undefined) {
      return 1;
    }

    if (
      left.displayOrder !== undefined &&
      right.displayOrder !== undefined &&
      left.displayOrder !== right.displayOrder
    ) {
      return left.displayOrder - right.displayOrder;
    }

    return (
      (sourceIndexById.get(left.id) ?? 0) - (sourceIndexById.get(right.id) ?? 0)
    );
  });

  return orderedTopics.map((topic, index, allTopics) => ({
    topic,
    popularityRank: index + 1,
    practiceCount: resolvePracticeCount(topic, index, allTopics.length),
    summary: resolveSummary(topic, language),
    categoryTone: CATEGORY_TONES[getTopicCategoryKey(topic)] ?? "blue",
    difficultyTone: resolveDifficultyTone(topic.difficulty),
    avatars: resolveAvatars(index),
  }));
}

export function formatPracticeCountLabel(value: number, label = "practiced") {
  const count = formatPracticeCount(value).replace(" practiced", "");
  return `${count} ${label}`;
}
