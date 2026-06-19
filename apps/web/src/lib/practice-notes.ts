export const MAX_NOTES_LENGTH = 1000;

const ALLOWED_NOTE_TAGS = new Set([
  "a",
  "b",
  "br",
  "div",
  "em",
  "i",
  "li",
  "ol",
  "p",
  "strong",
  "u",
  "ul",
]);

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function plainTextToRichNotes(value: string) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

function hasRichNoteMarkup(value: string) {
  return /<\/?(a|b|br|div|em|i|li|ol|p|strong|u|ul)\b/i.test(value);
}

function normalizeLegacyNoteFormatting(value: string) {
  return value
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+)\)/g,
      '<a href="$2">$1</a>'
    )
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/_([^_]+)_/g, "<em>$1</em>");
}

export function sanitizeRichNotes(value: string) {
  if (typeof document === "undefined") return value;

  const template = document.createElement("template");
  template.innerHTML = value;

  function cleanNode(node: Node): Node | DocumentFragment | null {
    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.textContent ?? "");
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return null;

    const element = node as HTMLElement;
    const tagName = element.tagName.toLowerCase();

    if (tagName === "script" || tagName === "style") return null;

    const cleanedChildren = Array.from(element.childNodes)
      .map(cleanNode)
      .filter(Boolean) as Array<Node | DocumentFragment>;

    if (!ALLOWED_NOTE_TAGS.has(tagName)) {
      const fragment = document.createDocumentFragment();
      cleanedChildren.forEach((child) => fragment.appendChild(child));
      return fragment;
    }

    const cleanElement = document.createElement(tagName);
    if (tagName === "a") {
      const href = element.getAttribute("href") ?? "";
      if (/^(https?:|mailto:)/i.test(href)) {
        cleanElement.setAttribute("href", href);
        cleanElement.setAttribute("target", "_blank");
        cleanElement.setAttribute("rel", "noopener noreferrer");
      }
    }

    cleanedChildren.forEach((child) => cleanElement.appendChild(child));
    return cleanElement;
  }

  const wrapper = document.createElement("div");
  Array.from(template.content.childNodes).forEach((node) => {
    const cleaned = cleanNode(node);
    if (cleaned) wrapper.appendChild(cleaned);
  });

  return wrapper.innerHTML;
}

export function toRichNotesHtml(value: string) {
  if (!value) return "";
  const html = hasRichNoteMarkup(value) ? value : plainTextToRichNotes(value);
  return sanitizeRichNotes(normalizeLegacyNoteFormatting(html));
}

export function richNotesToPlainText(value: string) {
  if (!value) return "";

  const withBreaks = value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|p|li)>/gi, "\n");

  if (typeof document !== "undefined") {
    const element = document.createElement("div");
    element.innerHTML = sanitizeRichNotes(withBreaks);
    return (element.textContent ?? "").replace(/\n{3,}/g, "\n\n").trimEnd();
  }

  return withBreaks.replace(/<[^>]*>/g, "").replace(/\n{3,}/g, "\n\n").trimEnd();
}

export function truncateNotesForPrompt(
  value: string | null | undefined,
  maxLength = MAX_NOTES_LENGTH
) {
  return richNotesToPlainText(value ?? "").trim().slice(0, maxLength);
}

export function appendPlainTextBlockToRichNotes(
  currentValue: string,
  block: string,
  maxLength = MAX_NOTES_LENGTH
) {
  const currentPlainText = richNotesToPlainText(currentValue);
  const separator = currentPlainText.trim().length > 0 ? "\n\n" : "";
  const remainingLength = maxLength - currentPlainText.length - separator.length;

  if (remainingLength <= 0) return toRichNotesHtml(currentValue);

  const trimmedBlock = block.slice(0, remainingLength);
  return sanitizeRichNotes(
    `${toRichNotesHtml(currentValue)}${plainTextToRichNotes(
      `${separator}${trimmedBlock}`
    )}`
  );
}
