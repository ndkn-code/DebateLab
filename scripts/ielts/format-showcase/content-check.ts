/**
 * Structural self-check for the format-showcase fixtures.
 *
 * Run:  cd apps/web && npx tsx ../../scripts/ielts/format-showcase/content-check.ts
 * Imported by scripts/ielts/verify-format-showcase.ts via `runContentCheck`.
 */
import { FORMAT_SHOWCASE_TESTS } from "./index";
import type { AuthoredGroup, AuthoredQuestion, AuthoredTest } from "./types";

const EXPECTED_POINTS: Record<string, Partial<Record<AuthoredQuestion["skill"], number>>> = {
  "format-showcase-academic": { listening: 40, reading: 40 },
  "format-showcase-general": { reading: 14 },
};

const OBJECTIVE_SKILLS = new Set<AuthoredQuestion["skill"]>(["listening", "reading"]);

function wc(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function optionId(o: NonNullable<AuthoredGroup["bank"]>[number], i: number): string {
  return typeof o === "string" ? String.fromCharCode(65 + i) : o.id;
}

function stimulusSlots(group: AuthoredGroup): string[] {
  const s = group.stimulus;
  if (!s) return [];
  const slots: string[] = [];
  const scan = (text: string) => {
    for (const m of text.matchAll(/__BLANK_([A-Za-z0-9]+)__/g)) slots.push(m[1]);
  };
  if (s.kind === "text") scan(s.body);
  if (s.kind === "flowchart") s.steps.forEach((st) => scan(st.text));
  if (s.kind === "table") s.rows.forEach((row) => row.forEach((cell) => typeof cell !== "string" && slots.push(cell.gap)));
  if (s.kind === "image") s.hotspots.forEach((h) => slots.push(h.slot));
  return slots;
}

function needsMarkingCases(q: AuthoredQuestion, group: AuthoredGroup | undefined): string | null {
  if (!OBJECTIVE_SKILLS.has(q.skill)) return null;
  if (q.acceptVariants?.length) return "acceptVariants";
  if (q.allowNumber) return "allowNumber";
  if (Array.isArray(q.correctAnswer)) return "multi-select";
  if (group?.anyOrder) return "anyOrder";
  const textMode = (group?.answerMode ?? "text") === "text" && !q.options;
  if (textMode && typeof q.correctAnswer === "string") {
    if (q.correctAnswer.includes("/")) return "slash alternatives";
    if (q.correctAnswer.includes("-")) return "hyphen";
  }
  return null;
}

function checkTest(test: AuthoredTest, problems: string[], notes: string[]): void {
  const tag = `[${test.slug}]`;
  const fail = (msg: string) => problems.push(`${tag} ${msg}`);

  const passages = new Map(test.passages.map((p) => [p.importId, p]));
  const sections = new Map(test.listeningSections.map((s) => [s.importId, s]));
  const groups = new Map<string, AuthoredGroup>();
  for (const g of test.groups) {
    if (groups.has(g.groupKey)) fail(`duplicate groupKey ${g.groupKey}`);
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(g.groupKey)) fail(`bad groupKey ${g.groupKey}`);
    groups.set(g.groupKey, g);
    if (g.passageImportId && !passages.has(g.passageImportId)) fail(`group ${g.groupKey} references unknown passage ${g.passageImportId}`);
    if (g.sectionImportId && !sections.has(g.sectionImportId)) fail(`group ${g.groupKey} references unknown section ${g.sectionImportId}`);
  }
  const assetIds = new Set(test.assets.map((a) => a.importId));
  for (const g of test.groups) {
    if (g.stimulus?.kind === "image" && !assetIds.has(g.stimulus.assetImportId)) {
      fail(`group ${g.groupKey} references unknown asset ${g.stimulus.assetImportId}`);
    }
  }

  const importIds = new Set<string>();
  for (const q of test.questions) {
    if (importIds.has(q.importId)) fail(`duplicate question importId ${q.importId}`);
    importIds.add(q.importId);
  }

  /* orderIndex contiguity + points per skill */
  const bySkill = new Map<AuthoredQuestion["skill"], AuthoredQuestion[]>();
  for (const q of test.questions) bySkill.set(q.skill, [...(bySkill.get(q.skill) ?? []), q]);
  const pointsBySkill: Record<string, number> = {};
  for (const [skill, qs] of bySkill) {
    const sorted = [...qs].sort((a, b) => a.orderIndex - b.orderIndex);
    sorted.forEach((q, i) => {
      if (q.orderIndex !== i) fail(`${skill} orderIndex gap at ${q.importId}: expected ${i}, got ${q.orderIndex}`);
    });
    if (OBJECTIVE_SKILLS.has(skill)) {
      let sum = 0;
      for (const q of sorted) {
        const pts = q.maxPoints ?? 1;
        const span = q.numberSpan ?? 1;
        if (span !== pts) fail(`${q.importId}: numberSpan ${span} != maxPoints ${pts}`);
        sum += pts;
      }
      pointsBySkill[skill] = sum;
    }
  }
  const expected = EXPECTED_POINTS[test.slug] ?? {};
  for (const [skill, want] of Object.entries(expected)) {
    if (pointsBySkill[skill] !== want) fail(`${skill} points ${pointsBySkill[skill] ?? 0}, expected ${want}`);
  }

  /* question-level checks */
  const membersByGroup = new Map<string, AuthoredQuestion[]>();
  for (const q of test.questions) {
    const group = q.groupKey ? groups.get(q.groupKey) : undefined;
    if (q.groupKey) {
      if (!group) fail(`${q.importId} references unknown groupKey ${q.groupKey}`);
      else {
        if (group.skill !== q.skill) fail(`${q.importId} skill ${q.skill} != group ${q.groupKey} skill ${group.skill}`);
        membersByGroup.set(q.groupKey, [...(membersByGroup.get(q.groupKey) ?? []), q]);
        if (group.stimulus && !q.slot) fail(`${q.importId}: member of stimulus group ${q.groupKey} has no slot`);
        if (group.sectionImportId && q.sectionImportId !== group.sectionImportId) fail(`${q.importId}: section mismatch with group ${q.groupKey}`);
        if (group.passageImportId && q.passageImportId !== group.passageImportId) fail(`${q.importId}: passage mismatch with group ${q.groupKey}`);
      }
    }
    if (q.passageImportId && !passages.has(q.passageImportId)) fail(`${q.importId} references unknown passage ${q.passageImportId}`);
    if (q.sectionImportId && !sections.has(q.sectionImportId)) fail(`${q.importId} references unknown section ${q.sectionImportId}`);
    if (!q.explanationEn || !q.explanationVi) fail(`${q.importId}: missing bilingual explanation`);

    if (OBJECTIVE_SKILLS.has(q.skill)) {
      if (q.correctAnswer === undefined) fail(`${q.importId}: objective question without correctAnswer`);
      /* support substring */
      const body = q.sectionImportId ? sections.get(q.sectionImportId)?.script : passages.get(q.passageImportId ?? "")?.body;
      if (!q.support) fail(`${q.importId}: objective question without support`);
      else if (!body) fail(`${q.importId}: no script/passage to check support against`);
      else if (!body.includes(q.support)) fail(`${q.importId}: support is not a verbatim substring: "${q.support}"`);

      /* select-mode keys must be option/bank ids */
      const selectMode = group?.answerMode === "select" || !!q.options;
      if (selectMode) {
        const pool = q.options ?? group?.bank ?? [];
        const ids = new Set(pool.map(optionId));
        const keys = Array.isArray(q.correctAnswer) ? q.correctAnswer : [q.correctAnswer ?? ""];
        for (const k of keys) if (!ids.has(k)) fail(`${q.importId}: select key "${k}" is not an option/bank id (${[...ids].join(",")})`);
        if (q.selectCount && keys.length !== q.selectCount) fail(`${q.importId}: selectCount ${q.selectCount} != ${keys.length} keys`);
        for (const c of q.markingCases ?? []) {
          const inputs = Array.isArray(c.input) ? c.input : [c.input];
          for (const inp of inputs) if (!ids.has(inp)) fail(`${q.importId}: markingCase input "${inp}" is not an option id`);
        }
      } else if (Array.isArray(q.correctAnswer)) {
        fail(`${q.importId}: text-mode question has an array key`);
      }

      /* marking upgrade => markingCases */
      const upgrade = needsMarkingCases(q, group);
      if (upgrade && !q.markingCases?.length) fail(`${q.importId}: marking upgrade (${upgrade}) without markingCases`);
      for (const c of q.markingCases ?? []) {
        const max = q.maxPoints ?? 1;
        if (c.expectedPoints < 0 || c.expectedPoints > max) fail(`${q.importId}: markingCase expectedPoints ${c.expectedPoints} outside 0..${max}`);
      }
    } else {
      if (!q.modelAnswer || !q.examinerNotes || Object.keys(q.examinerNotes).length === 0) fail(`${q.importId}: writing/speaking needs modelAnswer + examinerNotes`);
      if (q.questionType === "speaking_part2_cuecard" && !q.cueCard) fail(`${q.importId}: cue card missing`);
      if (q.questionType === "writing_task1_academic" && !q.visual) fail(`${q.importId}: task 1 academic needs a visual`);
      if (q.questionType === "writing_task1_general" && !q.letter) fail(`${q.importId}: task 1 general needs a letter`);
    }
  }

  /* stimulus slots <-> members */
  for (const g of test.groups) {
    const members = membersByGroup.get(g.groupKey) ?? [];
    if (members.length === 0) fail(`group ${g.groupKey} has no members`);
    const slots = stimulusSlots(g);
    if (slots.length !== new Set(slots).size) fail(`group ${g.groupKey}: duplicate stimulus slots`);
    if (g.stimulus) {
      const memberSlots = new Set(members.map((m) => m.slot));
      for (const s of slots) if (!memberSlots.has(s)) fail(`group ${g.groupKey}: stimulus slot ${s} has no member question`);
      for (const m of members) if (m.slot && !slots.includes(m.slot)) fail(`group ${g.groupKey}: member ${m.importId} slot ${m.slot} not in stimulus`);
      if (g.stimulus.kind === "image") {
        for (const h of g.stimulus.hotspots) {
          if (h.x < 0 || h.x > 100 || h.y < 0 || h.y > 100) fail(`group ${g.groupKey}: hotspot ${h.slot} outside 0..100%`);
        }
      }
    }
    if (g.bankReuse === false && g.answerMode === "select" && g.bank) {
      const keys = members.map((m) => m.correctAnswer).filter((k): k is string => typeof k === "string");
      if (new Set(keys).size !== keys.length) fail(`group ${g.groupKey}: bankReuse=false but a bank id is used twice`);
    }
  }

  /* word counts (informational) */
  for (const p of test.passages) notes.push(`${tag} passage ${p.importId} "${p.title}": ${wc(p.body)} words`);
  for (const s of test.listeningSections) {
    const spoken = s.script
      .split(/\r?\n/)
      .filter((l) => !/^\s*Narrator:/i.test(l))
      .map((l) => l.replace(/^\s*[A-Za-z][A-Za-z0-9 .'\-]{0,39}?:\s*/, ""))
      .join(" ");
    notes.push(`${tag} listening part ${s.sectionNumber} "${s.title}": ${wc(spoken)} spoken words`);
    for (const sp of s.speakers) {
      if (!new RegExp(`^${sp.name}:`, "m").test(s.script)) fail(`section ${s.importId}: speaker ${sp.name} never speaks`);
    }
  }
  notes.push(`${tag} points: ${JSON.stringify(pointsBySkill)}; questions: ${test.questions.length}; groups: ${test.groups.length}`);
}

export function runContentCheck(tests: AuthoredTest[]): void {
  const problems: string[] = [];
  const notes: string[] = [];
  for (const t of tests) checkTest(t, problems, notes);
  for (const n of notes) console.log(n);
  if (problems.length) {
    for (const p of problems) console.error(`FAIL ${p}`);
    throw new Error(`format-showcase content check failed with ${problems.length} problem(s)`);
  }
  console.log(`format-showcase content check OK: ${tests.length} test(s), ${tests.reduce((n, t) => n + t.questions.length, 0)} questions`);
}

if (process.argv[1] && process.argv[1].endsWith("content-check.ts")) runContentCheck(FORMAT_SHOWCASE_TESTS);
