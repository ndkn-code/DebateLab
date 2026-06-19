import assert from "node:assert/strict";
import {
  appendPlainTextBlockToRichNotes,
  richNotesToPlainText,
  truncateNotesForPrompt,
} from "./practice-notes";

const richNotes =
  "<strong>Clash</strong><br><ul><li>Attention vs flexibility</li><li>Weigh protected class time</li></ul>";

assert.equal(
  richNotesToPlainText(richNotes),
  "Clash\nAttention vs flexibility\nWeigh protected class time"
);

assert.equal(truncateNotesForPrompt("<p>One</p><p>Two</p>", 6), "One\nTw");

const appended = appendPlainTextBlockToRichNotes("First line", "Second line", 100);
assert.equal(richNotesToPlainText(appended), "First line\n\nSecond line");

const capped = appendPlainTextBlockToRichNotes("12345", "67890", 8);
assert.equal(richNotesToPlainText(capped), "12345\n\n6");

console.log("practice notes utilities passed");
