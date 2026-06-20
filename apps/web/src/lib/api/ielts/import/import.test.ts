/**
 * Unit tests for the bulk-import pipeline (WS-1.1): CSV parsing, the .xlsx reader
 * (round-tripped through an in-memory workbook), and the pure planner +
 * column-mapping. No DB — execute.ts is exercised via typecheck.
 */
import assert from "node:assert/strict";
import { strToU8, zipSync } from "fflate";
import { parseCsvSheet } from "./parse-csv";
import { parseXlsxWorkbook } from "./parse-xlsx";
import { planWorkbookImport } from "./plan";
import type { ParsedSheet, ParsedWorkbook } from "./workbook";

// ---- CSV parsing --------------------------------------------------------
{
  const csv = 'Item ID,Question Stem,Correct Answer(s)\nRQ-1,"Says ""hi"", really?","TRUE"\nRQ-2,Plain,FALSE\n';
  const sheet = parseCsvSheet("Reading Questions", csv);
  assert.deepEqual(sheet.headers, ["Item ID", "Question Stem", "Correct Answer(s)"]);
  assert.equal(sheet.rows.length, 2);
  assert.equal(sheet.rows[0]["Question Stem"], 'Says "hi", really?');
  assert.equal(sheet.rows[1]["Correct Answer(s)"], "FALSE");
}

// ---- xlsx round-trip ----------------------------------------------------
function colLetter(index: number): string {
  let s = "";
  let i = index + 1;
  while (i > 0) {
    s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
}

function buildXlsx(sheets: Array<{ name: string; rows: string[][] }>): Uint8Array {
  const shared: string[] = [];
  const idx = new Map<string, number>();
  const indexOf = (value: string): number => {
    if (!idx.has(value)) {
      idx.set(value, shared.length);
      shared.push(value);
    }
    return idx.get(value) as number;
  };
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const files: Record<string, Uint8Array> = {};
  sheets.forEach((sheet, si) => {
    const rowsXml = sheet.rows
      .map((row, ri) => {
        const cells = row
          .map((val, ci) => `<c r="${colLetter(ci)}${ri + 1}" t="s"><v>${indexOf(val)}</v></c>`)
          .join("");
        return `<row r="${ri + 1}">${cells}</row>`;
      })
      .join("");
    files[`xl/worksheets/sheet${si + 1}.xml`] = strToU8(
      `<?xml version="1.0"?><worksheet><sheetData>${rowsXml}</sheetData></worksheet>`,
    );
  });
  files["xl/sharedStrings.xml"] = strToU8(
    `<?xml version="1.0"?><sst>${shared.map((s) => `<si><t>${esc(s)}</t></si>`).join("")}</sst>`,
  );
  files["xl/workbook.xml"] = strToU8(
    `<?xml version="1.0"?><workbook><sheets>${sheets
      .map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join("")}</sheets></workbook>`,
  );
  files["xl/_rels/workbook.xml.rels"] = strToU8(
    `<?xml version="1.0"?><Relationships>${sheets
      .map((_, i) => `<Relationship Id="rId${i + 1}" Target="worksheets/sheet${i + 1}.xml"/>`)
      .join("")}</Relationships>`,
  );
  return zipSync(files);
}

{
  const xlsx = buildXlsx([
    { name: "Reading Passages", rows: [["Passage ID", "Title", "Passage Text"], ["RP-1", "Wolves & Rivers", "Body <text>"]] },
  ]);
  const wb = parseXlsxWorkbook(xlsx);
  assert.equal(wb.sheets.length, 1);
  assert.equal(wb.sheets[0].name, "Reading Passages");
  assert.deepEqual(wb.sheets[0].headers, ["Passage ID", "Title", "Passage Text"]);
  assert.equal(wb.sheets[0].rows[0]["Title"], "Wolves & Rivers");
  assert.equal(wb.sheets[0].rows[0]["Passage Text"], "Body <text>", "xml entities round-trip");
}

// ---- planner + column mapping ------------------------------------------
function mkSheet(name: string, headers: string[], rows: string[][]): ParsedSheet {
  return {
    name,
    headers,
    rows: rows.map((cells) => {
      const row: Record<string, string> = {};
      headers.forEach((h, i) => (row[h] = cells[i] ?? ""));
      return row;
    }),
  };
}

const Q_HEADERS = [
  "Item ID", "Passage ID", "Set/Test", "Q#", "Question Type (key)", "Instructions",
  "Question Stem", "Options (A|B|C|... pipe-separated)", "Correct Answer(s)", "Accept Variants",
  "Explanation (EN)", "Explanation (VN)", "Difficulty", "Author", "Status", "QA Reviewer",
];
const LQ_HEADERS = Q_HEADERS.map((h) => (h === "Passage ID" ? "Script ID" : h));

const workbook: ParsedWorkbook = {
  sheets: [
    mkSheet(
      "Reading Passages",
      ["Passage ID", "Title", "Genre/Type", "Word Count", "Passage Text", "Author", "Status"],
      [
        ["RP-001 (EXAMPLE)", "Example", "x", "850", "ex", "T", "Approved"],
        ["RP-010", "The Return of the Wolf", "Expository", "≈850", "Full passage…", "T. Author", "Draft"],
      ],
    ),
    mkSheet("Reading Questions", Q_HEADERS, [
      ["RQ-010", "RP-010", "Set 9", "1", "true_false_notgiven", "Write TRUE, FALSE or NOT GIVEN.", "Wolves were absent for fifty years.", "", "f", "", "Para 2.", "Đoạn 2.", "Medium", "T", "Draft", ""],
    ]),
    mkSheet(
      "Listening Scripts",
      ["Script ID", "Set/Test", "Section (1–4)", "Context", "Speakers & Accents", "Script Text", "Audio Status", "Status"],
      [["LS-010", "Set 9", "1", "Sports centre enquiry", "F-UK (caller), M-AUS (staff)", "CALLER: Hello…", "Not generated", "Draft"]],
    ),
    mkSheet("Listening Questions", LQ_HEADERS, [
      ["LQ-010", "LS-010", "Set 9", "11", "map_plan_label", "Label the map A–G.", "The cafe", "A|B|C|D|E|F|G", "C", "", "Past the lockers.", "", "Medium", "T", "Draft", ""],
    ]),
    mkSheet(
      "Writing Prompts",
      ["Item ID", "Task", "Topic", "Prompt Text", "Word Min", "Time (min)", "Model Answer (Band 9)", "Examiner Notes: TA/TR", "Examiner Notes: GRA", "Set/Test", "Status"],
      [["WP-010", "Task 2 (essay)", "Education", "Discuss both views…", "250", "40", "A band-9 essay…", "Both views addressed", "Near error-free", "Set 9", "Draft"]],
    ),
    mkSheet(
      "Speaking Prompts",
      ["Item ID", "Part (1/2/3)", "Topic", "Prompt / Cue Card", "Cue Card Bullets (Part 2)", "Follow-up Qs (Part 3)", "Sample Band-9 Answer / Notes", "Examiner Notes: FC", "Set/Test", "Status"],
      [["SP-010", "2", "A person", "Describe a person…", "who they are|how you know them|what they did", "Why do role models matter?", "1–2 min notes…", "Speaks at length", "Set 9", "Draft"]],
    ),
  ],
};

const plan = planWorkbookImport(workbook);

// example row skipped, real passage mapped
assert.equal(plan.passages.length, 1);
assert.equal(plan.passages[0].importId, "RP-010");
assert.equal(plan.passages[0].input.wordCount, 850);
assert.equal(plan.passages[0].input.metadata.set, undefined); // passages tab has no Set col here

// listening section: speakers parsed, primary accent from first speaker
assert.equal(plan.listeningSections.length, 1);
assert.equal(plan.listeningSections[0].input.sectionNumber, 1);
assert.deepEqual(plan.listeningSections[0].input.speakers, [
  { name: "caller", accent: "uk" },
  { name: "staff", accent: "aus" },
]);
assert.equal(plan.listeningSections[0].input.accent, "uk");

// four questions across the four tabs
assert.equal(plan.questions.length, 4);
const byId = new Map(plan.questions.map((q) => [q.importId, q]));

const reading = byId.get("RQ-010");
assert.ok(reading);
assert.equal(reading?.input.skill, "reading");
assert.equal(reading?.input.questionType, "true_false_notgiven");
assert.equal(reading?.passageImportId, "RP-010");
assert.equal(reading?.input.correctAnswer, "f"); // raw; normalized later by the canonical create path

const listening = byId.get("LQ-010");
assert.equal(listening?.input.skill, "listening");
assert.equal(listening?.sectionImportId, "LS-010");
assert.equal(listening?.input.options, "A|B|C|D|E|F|G");

const writing = byId.get("WP-010");
assert.equal(writing?.input.skill, "writing");
assert.equal(writing?.input.questionType, "writing_task2_essay");
assert.equal(writing?.input.modelAnswer, "A band-9 essay…");
assert.equal(writing?.input.examinerNotes.task, "Both views addressed");
assert.equal(writing?.input.examinerNotes.grammar, "Near error-free");
assert.equal(writing?.input.metadata.wordMin, 250);

const speaking = byId.get("SP-010");
assert.equal(speaking?.input.skill, "speaking");
assert.equal(speaking?.input.questionType, "speaking_part2_cuecard");
assert.equal(speaking?.input.options, "who they are|how you know them|what they did");
assert.equal(speaking?.input.examinerNotes.fluency, "Speaks at length");
assert.equal(speaking?.input.metadata.followups, "Why do role models matter?");

// single set -> no multi-set warning
assert.equal(plan.warnings.length, 0);

// multiple sets -> warning
const multi = planWorkbookImport({
  sheets: [
    mkSheet("Reading Questions", Q_HEADERS, [
      ["RQ-1", "RP-1", "Set A", "1", "true_false_notgiven", "i", "s", "", "TRUE", "", "", "", "Easy", "T", "Draft", ""],
    ]),
    mkSheet("Writing Prompts", ["Item ID", "Task", "Prompt Text", "Set/Test"], [["WP-1", "Task 2 (essay)", "p", "Set B"]]),
  ],
});
assert.equal(multi.warnings.length, 1);
assert.match(multi.warnings[0], /spans 2 sets/);

console.log("IELTS import tests passed");
