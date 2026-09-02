import assert from "node:assert/strict";
import {
  buildWritingScorerPrompt,
  criteriaDescriptors,
  type WritingScorerGrounding,
} from "./prompt";

const emptyGrounding: WritingScorerGrounding = {
  questionModelAnswer: null,
  examinerNotes: [],
  peerModelAnswers: [],
};

// --- Task 2, English, no grounding ------------------------------------------
const t2 = buildWritingScorerPrompt({
  taskNumber: 2,
  taskType: "writing_task2_essay",
  questionPrompt: "Some people think universities should be free.",
  essay: "I strongly agree that university education should be free for all.",
  wordCount: 11,
  feedbackLanguage: "en",
  grounding: emptyGrounding,
});
assert.match(t2, /Writing Task 2/);
assert.match(t2, /universities should be free/); // task prompt embedded
assert.match(t2, /university education should be free for all/); // essay embedded
// all four criteria keys present
for (const key of [
  "taskResponse",
  "coherenceCohesion",
  "lexicalResource",
  "grammaticalRangeAccuracy",
]) {
  assert.ok(t2.includes(key), `prompt should mention ${key}`);
}
assert.match(t2, /modelAnswer/);
assert.match(t2, /Return ONLY a JSON object/);
// transparency: model must NOT compute the overall/average
assert.match(t2, /Do NOT output an overall band/);
// under-length penalty triggered (11 < 250)
assert.match(t2, /under the 250-word minimum/);
// no grounding block when empty
assert.equal(t2.includes("GROUNDING"), false);

// --- Task 1, Vietnamese, with grounding -------------------------------------
const t1 = buildWritingScorerPrompt({
  taskNumber: 1,
  taskType: "writing_task1_academic",
  questionPrompt: "Describe the chart.",
  essay: "The chart shows steady growth across all years of the study period.",
  wordCount: 180,
  feedbackLanguage: "vi",
  grounding: {
    questionModelAnswer: "A band 9 overview with accurate key features.",
    examinerNotes: ["Needs a clear overview", "Group data logically"],
    peerModelAnswers: ["Another exemplar overview."],
  },
});
assert.match(t1, /Writing Task 1/);
assert.match(t1, /at least 150 words/);
// not under length (180 >= 150)
assert.equal(t1.includes("under the 150-word minimum"), false);
// grounding rendered
assert.match(t1, /GROUNDING/);
assert.match(t1, /A band 9 overview with accurate key features/);
assert.match(t1, /Needs a clear overview/);
assert.match(t1, /Another exemplar overview/);
// Vietnamese summary required
assert.match(t1, /Vietnamese-language summary in vietnameseSummary/);
assert.match(t1, /REQUIRED: a clear Vietnamese-language explanation/);
// Academic Task 1 keeps the overview/key-features descriptor, no GT letter line, no VISUAL block
assert.match(t1, /clear overview \+ accurate key features/);
assert.equal(t1.includes("letter conventions"), false);
assert.equal(t1.includes("VISUAL ("), false);
assert.equal(t1.includes("LETTER BRIEF"), false);

// --- General Training Task 1: letter descriptors + brief -------------------
const gt = buildWritingScorerPrompt({
  taskNumber: 1,
  taskType: "writing_task1_general",
  questionPrompt: "Write a letter to your landlord.",
  essay: "Dear Mr Smith, I am writing to inform you about the broken heating.",
  wordCount: 160,
  feedbackLanguage: "en",
  grounding: emptyGrounding,
  letter: {
    recipient: "your landlord",
    register: "formal",
    bullets: ["explain the problem", "say how it affects you", "suggest a solution"],
  },
});
assert.match(gt, /purpose of the letter stated clearly and early/);
assert.match(gt, /appropriate to the required register/);
assert.match(gt, /ALL bullet points/);
assert.match(gt, /letter conventions \(suitable greeting and closing\)/);
assert.equal(gt.includes("clear overview + accurate key features"), false);
assert.match(gt, /LETTER BRIEF/);
assert.match(gt, /Recipient: your landlord/);
assert.match(gt, /Required register: formal/);
assert.match(gt, /- suggest a solution/);
// GT descriptors are absent for Task 2 and Academic Task 1
assert.equal(criteriaDescriptors("writing_task2_essay").includes("letter conventions"), false);
assert.equal(criteriaDescriptors("writing_task1_academic").includes("letter conventions"), false);
assert.match(criteriaDescriptors("writing_task1_general"), /letter conventions/);

// --- Academic Task 1 with a chart visual: rendered as a pipe table ----------
const chart = buildWritingScorerPrompt({
  taskNumber: 1,
  taskType: "writing_task1_academic",
  questionPrompt: "The chart shows car ownership.",
  essay: "Car ownership rose in both countries over the period shown in the chart.",
  wordCount: 170,
  feedbackLanguage: "en",
  grounding: emptyGrounding,
  visual: {
    type: "chart",
    chartType: "line",
    title: "Car ownership 2000-2020",
    xAxisKey: "year",
    data: [
      { year: 2000, uk: 20, vn: 5 },
      { year: 2020, uk: 35, vn: 18 },
    ],
    series: [
      { dataKey: "uk", label: "UK" },
      { dataKey: "vn", label: "Vietnam" },
    ],
  },
});
assert.match(chart, /VISUAL \(the data\/stimulus/);
assert.match(chart, /Chart type: line — Car ownership 2000-2020/);
assert.match(chart, /X axis: year/);
assert.match(chart, /\| year \| UK \| Vietnam \|/);
assert.match(chart, /\| --- \| --- \| --- \|/);
assert.match(chart, /\| 2000 \| 20 \| 5 \|/);
assert.match(chart, /\| 2020 \| 35 \| 18 \|/);
assert.match(chart, /inaccurate or invented data counts against taskResponse/);

// --- Table visual --------------------------------------------------------
const table = buildWritingScorerPrompt({
  taskNumber: 1,
  taskType: "writing_task1_academic",
  questionPrompt: "The table shows exports.",
  essay: "Exports grew.",
  wordCount: 150,
  feedbackLanguage: "en",
  grounding: emptyGrounding,
  visual: {
    type: "table",
    caption: "Exports by year",
    headers: ["Year", "Rice", "Coffee"],
    rows: [
      ["2010", "1.2", "0.8"],
      ["2020", "2.0", "1.5"],
    ],
  },
});
assert.match(table, /Exports by year/);
assert.match(table, /\| Year \| Rice \| Coffee \|/);
assert.match(table, /\| 2010 \| 1\.2 \| 0\.8 \|/);

// --- Described + image visuals are passed through as text -----------------
const described = buildWritingScorerPrompt({
  taskNumber: 1,
  taskType: "writing_task1_academic",
  questionPrompt: "Describe.",
  essay: "Essay.",
  wordCount: 150,
  feedbackLanguage: "en",
  grounding: emptyGrounding,
  visual: { type: "described", description: "A bar chart comparing three cities." },
});
assert.match(described, /A bar chart comparing three cities\./);
const image = buildWritingScorerPrompt({
  taskNumber: 1,
  taskType: "writing_task1_academic",
  questionPrompt: "Describe.",
  essay: "Essay.",
  wordCount: 150,
  feedbackLanguage: "en",
  grounding: emptyGrounding,
  visual: {
    type: "image",
    url: "https://example.com/map.png",
    alt: "Map of a town before and after development",
    caption: "Town plan",
  },
});
assert.match(image, /Map of a town before and after development/);
assert.match(image, /Caption: Town plan/);
assert.match(image, /URL: https:\/\/example\.com\/map\.png/);

console.log("ielts/writing-scorer/prompt tests passed");
