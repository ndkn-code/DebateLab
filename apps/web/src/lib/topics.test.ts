import assert from "node:assert/strict";
import {
  getCategoryKey,
  getLocalizedCategoryOptions,
  getLocalizedTopics,
  getTopicCategoryKey,
  getTopicStableKey,
  topics,
} from "./topics";
import {
  buildLegacyPracticeLanguageRedirect,
  buildPracticeHref,
  findPracticeTopicByTitle,
  readPracticePrefill,
  resolvePracticeTopic,
} from "./practice-prefill";
import { normalizeSettingsPreferences } from "./settings";
import { buildPracticeTopicDisplays } from "@/components/practice/practice-topic-display";

const englishTopics = getLocalizedTopics("en");
const vietnameseTopics = getLocalizedTopics("vi");

assert.equal(englishTopics.length, topics.length);
assert.equal(vietnameseTopics.length, topics.length);

const englishPhoneTopic = englishTopics.find((topic) => topic.id === "tech-03");
const vietnamesePhoneTopic = vietnameseTopics.find(
  (topic) => topic.id === "tech-03"
);

assert.equal(englishPhoneTopic?.title, "Smartphones should be banned in schools");
assert.equal(
  vietnamesePhoneTopic?.title,
  "Nên cấm điện thoại thông minh trong trường học"
);
assert.equal(getTopicStableKey(vietnamesePhoneTopic!), "tech-03");
assert.equal(getTopicCategoryKey(vietnamesePhoneTopic!), "technology");
assert.equal(vietnamesePhoneTopic?.category, "Công Nghệ & Mạng Xã Hội");
assert.match(
  vietnamesePhoneTopic?.suggestedPoints?.proposition[0] ?? "",
  /Điện thoại/
);
assert.match(englishPhoneTopic?.motionBrief?.scope ?? "", /personal smartphones/);
assert.match(
  vietnamesePhoneTopic?.motionBrief?.modelClarification ?? "",
  /điện thoại cá nhân/i
);

const homeworkTopic = englishTopics.find((topic) => topic.id === "edu-01");
const cancelCultureTopic = englishTopics.find((topic) => topic.id === "soc-06");
const vietnameseRoteLearningTopic = vietnameseTopics.find(
  (topic) => topic.id === "vn-04"
);
assert.match(homeworkTopic?.motionBrief?.scope ?? "", /compulsory homework/);
assert.match(cancelCultureTopic?.motionBrief?.scope ?? "", /online accountability/);
assert.match(
  vietnameseRoteLearningTopic?.motionBrief?.scope ?? "",
  /học thuộc/
);
assert.equal(getTopicCategoryKey(vietnameseRoteLearningTopic!), "education");
assert.equal(
  vietnameseRoteLearningTopic?.category,
  "Giáo Dục & Đời Sống"
);

assert.equal(getCategoryKey("Technology & Social Media"), "technology");
assert.equal(getCategoryKey("Công Nghệ & Mạng Xã Hội"), "technology");
const vietnameseCategoryKeys = getLocalizedCategoryOptions("vi").map(
  (category) => category.key
);
assert.deepEqual(vietnameseCategoryKeys.slice(0, 3), [
  "all",
  "education",
  "technology",
]);
assert.equal(vietnameseCategoryKeys.includes("vietnam"), false);
assert.equal(
  getTopicCategoryKey({
    id: "legacy-vn-student-pressure",
    title: "Vietnamese students face too much academic pressure",
    category: "Vietnam-Specific Issues",
    difficulty: "beginner",
  }),
  "education"
);

const prioritizedDisplays = buildPracticeTopicDisplays(
  [
    {
      id: "standard-topic",
      title: "A popular standard motion",
      category: "Society & Culture",
      categoryKey: "society",
      difficulty: "beginner",
      displayOrder: 1,
    },
    {
      id: "high-confidence-topic",
      title: "A high confidence motion",
      category: "Ethics & Philosophy",
      categoryKey: "ethics",
      difficulty: "advanced",
      displayOrder: 2,
      aiConfidence: 0.9,
    },
    {
      id: "tt-motion",
      title: "Trường Teen corpus motion",
      category: "Education & School Life",
      categoryKey: "education",
      difficulty: "intermediate",
      displayOrder: 3,
      sourceKind: "truong_teen",
      aggregateConfidence: 0.92,
    },
  ],
  "vi"
);
assert.deepEqual(
  prioritizedDisplays.map((display) => display.topic.id),
  ["tt-motion", "high-confidence-topic", "standard-topic"]
);
assert.equal(prioritizedDisplays[0].priorityBadges[0]?.label, "Trường Teen");

assert.equal(
  findPracticeTopicByTitle("Smartphones should be banned in schools", "vi")
    ?.title,
  "Nên cấm điện thoại thông minh trong trường học"
);
assert.equal(
  findPracticeTopicByTitle(
    "Nên cấm điện thoại thông minh trong trường học",
    "en"
  )?.title,
  "Smartphones should be banned in schools"
);

const resolvedByKey = resolvePracticeTopic(
  {
    topicId: "tech-03",
    topicTitle: "Legacy title ignored when key is present",
    practiceLanguage: "vi",
  },
  "vi"
);
assert.equal(resolvedByKey.title, "Nên cấm điện thoại thông minh trong trường học");

const href = buildPracticeHref({
  topicId: "tech-03",
  topicTitle: vietnamesePhoneTopic!.title,
  topicCategory: vietnamesePhoneTopic!.category,
  practiceTrack: "debate",
  practiceLanguage: "vi",
});
const parsedPrefill = readPracticePrefill(new URLSearchParams(href.split("?")[1]));
assert.equal(parsedPrefill?.topicId, "tech-03");
assert.equal(new URL(href, "https://thinkfy.test").searchParams.has("language"), false);
assert.equal(parsedPrefill?.practiceLanguage, undefined);

assert.deepEqual(
  buildLegacyPracticeLanguageRedirect(
    "/practice",
    "en",
    new URLSearchParams("language=en&topicId=tech-03")
  ),
  {
    finalHref: "/en/practice?topicId=tech-03",
    switchHref: "/en/practice?topicId=tech-03",
  }
);
assert.deepEqual(
  buildLegacyPracticeLanguageRedirect(
    "/en/practice",
    "vi",
    new URLSearchParams("language=vi&topicId=tech-03")
  ),
  {
    finalHref: "/vi/practice?topicId=tech-03",
    switchHref: "/vi/practice?topicId=tech-03",
  }
);

const normalizedSettings = normalizeSettingsPreferences({
  preferred_locale: "en",
  practice_language: "vi",
  tts_voice: "vi-VN-Wavenet-A",
});
assert.equal(normalizedSettings.preferredLocale, "en");
assert.equal(normalizedSettings.practiceLanguage, "en");
assert.equal(normalizedSettings.ttsVoice, "aura-asteria-en");

console.log("topic localization tests passed");
