import { unzipSync } from "fflate";
import { extractText } from "unpdf";

const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const MAX_EXTRACTED_BYTES = 10 * 1024 * 1024;
const OFFICE_XML_LIMIT = 40 * 1024 * 1024;

const MIME = Object.freeze({
  pdf: "application/pdf",
  text: "text/plain",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
});

function decodeXmlText(value) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    );
}

function normalizeText(value) {
  const normalized = value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[\t ]+/g, " ").trim())
    .filter((line, index, lines) => line || lines[index - 1])
    .join("\n")
    .trim();
  if (!normalized) throw new Error("Material contains no extractable text.");
  if (Buffer.byteLength(normalized, "utf8") > MAX_EXTRACTED_BYTES) {
    throw new Error("Extracted material text exceeds the conversion limit.");
  }
  return normalized;
}

function extractTaggedText(xml, tag) {
  const expression = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "g");
  return Array.from(xml.matchAll(expression), (match) =>
    decodeXmlText(match[1].replace(/<[^>]+>/g, "")),
  );
}

function unzipOfficeXml(bytes, include) {
  const files = unzipSync(bytes, {
    filter(file) {
      if (!include(file.name)) return false;
      if (file.originalSize > OFFICE_XML_LIMIT) {
        throw new Error("Office document XML exceeds the conversion limit.");
      }
      return true;
    },
  });
  const total = Object.values(files).reduce((sum, file) => sum + file.byteLength, 0);
  if (total > OFFICE_XML_LIMIT) {
    throw new Error("Office document XML exceeds the conversion limit.");
  }
  return files;
}

function extractDocx(bytes) {
  const files = unzipOfficeXml(bytes, (name) => name === "word/document.xml");
  const document = files["word/document.xml"];
  if (!document) throw new Error("DOCX document body is missing.");
  const xml = new TextDecoder().decode(document);
  const paragraphs = Array.from(
    xml.matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g),
    (match) => extractTaggedText(match[1], "w:t").join(""),
  );
  return normalizeText(paragraphs.join("\n"));
}

function extractPptx(bytes) {
  const slidePattern = /^ppt\/slides\/slide(\d+)\.xml$/;
  const files = unzipOfficeXml(bytes, (name) => slidePattern.test(name));
  const slides = Object.entries(files)
    .map(([name, file]) => ({
      number: Number(name.match(slidePattern)?.[1] ?? 0),
      xml: new TextDecoder().decode(file),
    }))
    .sort((left, right) => left.number - right.number);
  if (slides.length === 0) throw new Error("PPTX contains no slides.");
  return normalizeText(
    slides
      .map((slide) => extractTaggedText(slide.xml, "a:t").join("\n"))
      .join("\n\n"),
  );
}

function titleFromFileName(fileName) {
  return fileName.replace(/\.[^.]+$/, "").trim() || "Untitled material";
}

export async function convertMaterialBytes({ bytes, mimeType, fileName }) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) {
    throw new Error("Material source is empty.");
  }
  if (bytes.byteLength > MAX_SOURCE_BYTES) {
    throw new Error("Material source exceeds the conversion limit.");
  }

  let text;
  if (mimeType === MIME.text) {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } else if (mimeType === MIME.pdf) {
    const extracted = await extractText(bytes, { mergePages: true });
    text = extracted.text;
  } else if (mimeType === MIME.docx) {
    text = extractDocx(bytes);
  } else if (mimeType === MIME.pptx) {
    text = extractPptx(bytes);
  } else {
    throw new Error(`Material type is not supported for text conversion: ${mimeType}.`);
  }

  return {
    text: normalizeText(text),
    title: titleFromFileName(fileName),
  };
}

export async function downloadAndConvertMaterial(request) {
  const response = await fetch(request.sourceUrl, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Could not download material source (${response.status}).`);
  }
  const declaredSize = Number(response.headers.get("content-length") ?? 0);
  if (declaredSize > MAX_SOURCE_BYTES) {
    throw new Error("Material source exceeds the conversion limit.");
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  return convertMaterialBytes({
    bytes,
    mimeType: request.mimeType,
    fileName: request.fileName,
  });
}
