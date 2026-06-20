import assert from "node:assert/strict";
import { parseListeningScript, type SpeakerMeta } from "./script-parser";

const speakers: SpeakerMeta[] = [
  { name: "Receptionist", accent: "uk" },
  { name: "Caller", accent: "aus" },
];

// --- basic two-speaker dialogue --------------------------------------------
const dialogue = parseListeningScript(
  "RECEPTIONIST: Good morning.\nCALLER: Hi, I'd like to book a room.",
  speakers,
  "uk",
);
assert.equal(dialogue.length, 2);
assert.deepEqual(dialogue[0], { speaker: "RECEPTIONIST", accent: "uk", text: "Good morning." });
assert.deepEqual(dialogue[1], {
  speaker: "CALLER",
  accent: "aus",
  text: "Hi, I'd like to book a room.",
});

// --- narration before any label uses the section accent ---------------------
const narrated = parseListeningScript(
  "You will hear a conversation in a hotel.\nCALLER: Hello?",
  speakers,
  "us",
);
assert.equal(narrated.length, 2);
assert.deepEqual(narrated[0], {
  speaker: null,
  accent: "us",
  text: "You will hear a conversation in a hotel.",
});
assert.equal(narrated[1].accent, "aus");

// --- continuation lines merge into the current turn ------------------------
const multiline = parseListeningScript(
  "CALLER: First part\nand second part.\nRECEPTIONIST: Noted.",
  speakers,
  "uk",
);
assert.equal(multiline.length, 2);
assert.equal(multiline[0].text, "First part and second part.");

// --- stage directions are stripped; cue-only turns dropped -----------------
const cues = parseListeningScript(
  "[telephone rings]\nCALLER: Hello [pause] are you there?\n[line goes dead]",
  speakers,
  "uk",
);
assert.equal(cues.length, 1);
assert.equal(cues[0].text, "Hello are you there?");
assert.equal(cues[0].speaker, "CALLER");

// --- unknown speaker falls back to the section accent ----------------------
const unknown = parseListeningScript("TOUR GUIDE: Welcome everyone.", speakers, "aus");
assert.equal(unknown.length, 1);
assert.equal(unknown[0].accent, "aus");

// --- accent match is case-insensitive --------------------------------------
const lower = parseListeningScript("caller: hi there", speakers, "uk");
assert.equal(lower[0].accent, "aus");

// --- blank line flushes; whitespace collapses ------------------------------
const blanks = parseListeningScript(
  "CALLER:   lots    of     space\n\nRECEPTIONIST: ok",
  speakers,
  "uk",
);
assert.equal(blanks.length, 2);
assert.equal(blanks[0].text, "lots of space");

console.log("ielts/listening-audio/script-parser tests passed");
