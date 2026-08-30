import assert from "node:assert/strict";
import test from "node:test";
import { strToU8, zipSync } from "fflate";
import {
  canClaimMaterialLease,
  parseMaterialQueueMessage,
  parsePubSubEnvelope,
} from "./contracts.mjs";
import { buildDraftMaterialDocument } from "./processor.mjs";
import { convertMaterialBytes } from "./converter.mjs";

const message = {
  materialId: "00000000-0000-4000-8000-000000000001",
  versionId: "00000000-0000-4000-8000-000000000002",
  idempotencyKey: "material-fixture-1",
};

test("material queue messages are strict enough for the worker boundary", () => {
  assert.deepEqual(parseMaterialQueueMessage(message), message);
  assert.throws(
    () => parseMaterialQueueMessage({ ...message, versionId: "not-a-uuid" }),
    /UUID/,
  );
});

test("Pub/Sub envelopes decode the version message", () => {
  const parsed = parsePubSubEnvelope({
    message: {
      messageId: "123",
      data: Buffer.from(JSON.stringify(message)).toString("base64"),
    },
    deliveryAttempt: 2,
  });
  assert.deepEqual(parsed, {
    message,
    messageId: "123",
    deliveryAttempt: 2,
  });
});

test("active leases cannot be claimed while expired leases can", () => {
  assert.equal(
    canClaimMaterialLease({
      processing_status: "converting",
      lease_expires_at: "2099-01-01T00:00:00.000Z",
    }),
    false,
  );
  assert.equal(
    canClaimMaterialLease(
      {
        processing_status: "converting",
        lease_expires_at: "2020-01-01T00:00:00.000Z",
      },
      new Date("2021-01-01T00:00:00.000Z"),
    ),
    true,
  );
});

test("worker draft output preserves the web material-document contract", () => {
  const document = buildDraftMaterialDocument({
    title: "Unit 1",
    versionId: message.versionId,
    renditionId: message.materialId,
    text: "Teacher review text",
  });
  assert.equal(document.schemaVersion, 1);
  assert.equal(document.sections[0].blocks[0].type, "page_preview");
  assert.equal(document.sections[0].blocks[1].text, "Teacher review text");
});

test("plain text conversion is normalized without an external service", async () => {
  const result = await convertMaterialBytes({
    bytes: new TextEncoder().encode("  Lesson one  \r\n\r\nKey   point  "),
    mimeType: "text/plain",
    fileName: "lesson-one.txt",
  });
  assert.deepEqual(result, {
    title: "lesson-one",
    text: "Lesson one\n\nKey point",
  });
});

test("unsupported binary formats fail explicitly", async () => {
  await assert.rejects(
    () =>
      convertMaterialBytes({
        bytes: new Uint8Array([1, 2, 3]),
        mimeType: "application/msword",
        fileName: "legacy.doc",
      }),
    /not supported/,
  );
});

test("DOCX and PPTX XML text is extracted in document order", async () => {
  const docx = zipSync({
    "word/document.xml": strToU8(
      "<w:document><w:p><w:r><w:t>First &amp; second</w:t></w:r></w:p><w:p><w:r><w:t>Next</w:t></w:r></w:p></w:document>",
    ),
  });
  const docxResult = await convertMaterialBytes({
    bytes: docx,
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    fileName: "unit.docx",
  });
  assert.equal(docxResult.text, "First & second\nNext");

  const pptx = zipSync({
    "ppt/slides/slide2.xml": strToU8("<p:sld><a:t>Slide two</a:t></p:sld>"),
    "ppt/slides/slide1.xml": strToU8("<p:sld><a:t>Slide one</a:t></p:sld>"),
  });
  const pptxResult = await convertMaterialBytes({
    bytes: pptx,
    mimeType:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    fileName: "deck.pptx",
  });
  assert.equal(pptxResult.text, "Slide one\n\nSlide two");
});
