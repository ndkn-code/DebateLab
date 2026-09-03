import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RichNotes } from "@/components/feedback/rich-notes";
import {
  appendPlainTextBlockToRichNotes,
  parseRichNotes,
  richNotesToPlainText,
  sanitizeRichNotes,
  truncateNotesForPrompt,
} from "./practice-notes";

const richNotes =
  "<strong>Clash</strong><br><ul><li>Attention vs flexibility</li><li>Weigh protected class time</li></ul>";

assert.equal(
  richNotesToPlainText(richNotes),
  "Clash\nAttention vs flexibility\nWeigh protected class time",
);

assert.equal(truncateNotesForPrompt("<p>One</p><p>Two</p>", 6), "One\nTw");

const appended = appendPlainTextBlockToRichNotes(
  "First line",
  "Second line",
  100,
);
assert.equal(richNotesToPlainText(appended), "First line\n\nSecond line");

const capped = appendPlainTextBlockToRichNotes("12345", "67890", 8);
assert.equal(richNotesToPlainText(capped), "12345\n\n6");

assert.equal(
  sanitizeRichNotes(
    '<p class="x" style="color:red">Keep <strong>this</strong></p><script>alert(1)</script><a href="javascript:alert(1)" onclick="alert(2)">link</a>',
  ),
  "<p>Keep <strong>this</strong></p><a>link</a>",
);
assert.equal(
  sanitizeRichNotes(
    '<ul data-x="1"><li><em>One</em></li></ul><a href="https://example.com" title="ignored">safe</a>',
  ),
  '<ul><li><em>One</em></li></ul><a href="https://example.com" target="_blank" rel="noopener noreferrer">safe</a>',
);
assert.equal(
  sanitizeRichNotes("<span>Unknown wrapper</span><img src=x>After"),
  "Unknown wrapperAfter",
);
assert.equal(
  sanitizeRichNotes(
    "<!--comment--><svg onload=alert(1)><script>alert(1)</script><text>SVG text</text></svg><p>After",
  ),
  "<p>After</p>",
);
assert.equal(
  sanitizeRichNotes(
    '<a href=" data:text/html,&lt;script&gt;">bad</a><a href="java&#x73;cript:alert(1)">bad</a><a href="java&#10;script:alert(1)">bad</a><a href="mailto:learner@example.com">mail</a>',
  ),
  '<a>bad</a><a>bad</a><a>bad</a><a href="mailto:learner@example.com" target="_blank" rel="noopener noreferrer">mail</a>',
);
assert.equal(
  sanitizeRichNotes(
    "<iframe><p>embedded</p></iframe><video><source src=x>media</video><p>Visible</p>",
  ),
  "<p>Visible</p>",
);
assert.doesNotThrow(() => sanitizeRichNotes("&#99999999;"));
const serverMarkup = renderToStaticMarkup(
  createElement(RichNotes, {
    nodes: parseRichNotes("<p><strong>Clash</strong><br />Mở bài</p>"),
  }),
);
assert.equal(serverMarkup, "<p><strong>Clash</strong><br/>Mở bài</p>");
assert.deepEqual(parseRichNotes("A\nB"), [{ type: "text", value: "A\nB" }]);

console.log("practice notes utilities passed");
