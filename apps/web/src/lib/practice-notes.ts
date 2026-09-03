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
const VOID_NOTE_TAGS = new Set(["br"]);
const VOID_HTML_TAGS = new Set([
  "area",
  "base",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);
const DROP_CONTENT_TAGS = new Set([
  "audio",
  "canvas",
  "embed",
  "iframe",
  "math",
  "object",
  "picture",
  "script",
  "style",
  "svg",
  "template",
  "video",
]);

export type RichNoteTag =
  | "a"
  | "b"
  | "br"
  | "div"
  | "em"
  | "i"
  | "li"
  | "ol"
  | "p"
  | "strong"
  | "u"
  | "ul";
export type RichNoteNode =
  | { type: "text"; value: string }
  | {
      type: "element";
      tag: RichNoteTag;
      href?: string;
      children: RichNoteNode[];
    };

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function decodeEntities(value: string) {
  return value
    .replace(/&#(x[\da-f]+|\d+);?/gi, (_, code: string) => {
      const parsed = code.toLowerCase().startsWith("x")
        ? Number.parseInt(code.slice(1), 16)
        : Number.parseInt(code, 10);
      return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 0x10ffff
        ? String.fromCodePoint(parsed)
        : "�";
    })
    .replace(
      /&(amp|lt|gt|quot|apos|nbsp);/gi,
      (_, name: string) =>
        ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0" })[
          name.toLowerCase()
        ] ?? `&${name};`,
    );
}

function isSafeHref(value: string) {
  return /^(?:https?:|mailto:)/i.test(value.trim());
}

function appendChildren(target: RichNoteNode[], children: RichNoteNode[]) {
  for (const child of children) {
    const previous = target.at(-1);
    if (previous?.type === "text" && child.type === "text")
      previous.value += child.value;
    else target.push(child);
  }
}

function parseHref(source: string) {
  const match = source.match(
    /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i,
  );
  const href = match?.[1] ?? match?.[2] ?? match?.[3];
  const decoded = href ? decodeEntities(href).trim() : "";
  return decoded && isSafeHref(decoded) ? decoded : undefined;
}

/** Parse the deliberately small notes format without browser DOM APIs. */
export function parseRichNotes(value: string): RichNoteNode[] {
  const root: RichNoteNode[] = [];
  const stack: Array<{
    tag: string;
    children: RichNoteNode[];
    drop: boolean;
    appendTo?: RichNoteNode[];
  }> = [{ tag: "root", children: root, drop: false }];
  const tokenPattern = /<!--[\s\S]*?-->|<\/?([a-z][\w:-]*)([^>]*)>|([^<]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = tokenPattern.exec(value))) {
    const token = match[0];
    const parent = stack.at(-1)!;
    if (token.startsWith("<!--")) continue;
    if (match[3]) {
      if (!parent.drop)
        appendChildren(parent.children, [
          { type: "text", value: decodeEntities(match[3]) },
        ]);
      continue;
    }
    const tag = match[1].toLowerCase();
    if (token.startsWith("</")) {
      const index = stack.findLastIndex((entry) => entry.tag === tag);
      if (index > 0) {
        const frame = stack[index];
        if (frame.appendTo) appendChildren(frame.appendTo, frame.children);
        stack.splice(index);
      }
      continue;
    }
    const drop = parent.drop || DROP_CONTENT_TAGS.has(tag);
    if (drop) {
      if (!VOID_NOTE_TAGS.has(tag))
        stack.push({ tag, children: [], drop: true });
      continue;
    }
    if (!ALLOWED_NOTE_TAGS.has(tag)) {
      if (!token.endsWith("/>") && !VOID_HTML_TAGS.has(tag))
        stack.push({
          tag,
          children: [],
          drop: false,
          appendTo: parent.children,
        });
      continue;
    }
    const children: RichNoteNode[] = [];
    const href = tag === "a" ? parseHref(match[2]) : undefined;
    const node: RichNoteNode = {
      type: "element",
      tag: tag as RichNoteTag,
      ...(href ? { href } : {}),
      children,
    };
    parent.children.push(node);
    if (!VOID_NOTE_TAGS.has(tag) && !token.endsWith("/"))
      stack.push({ tag, children, drop: false });
  }
  for (let index = stack.length - 1; index > 0; index -= 1) {
    const frame = stack[index];
    if (frame.appendTo) appendChildren(frame.appendTo, frame.children);
  }
  return root;
}

function serializeRichNotes(nodes: RichNoteNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === "text") return escapeHtml(node.value);
      const href =
        node.tag === "a" && node.href
          ? ` href="${escapeHtml(node.href)}" target="_blank" rel="noopener noreferrer"`
          : "";
      if (node.tag === "br") return "<br>";
      return `<${node.tag}${href}>${serializeRichNotes(node.children)}</${node.tag}>`;
    })
    .join("");
}

export function plainTextToRichNotes(value: string) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

function hasRichNoteMarkup(value: string) {
  return /<\/?[a-z][\w:-]*(?:\s[^>]*)?>/i.test(value);
}

function normalizeLegacyNoteFormatting(value: string) {
  return value
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+)\)/g,
      '<a href="$2">$1</a>',
    )
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/_([^_]+)_/g, "<em>$1</em>");
}

export function sanitizeRichNotes(value: string) {
  return serializeRichNotes(parseRichNotes(value));
}

export function toRichNotesHtml(value: string) {
  if (!value) return "";
  const html = hasRichNoteMarkup(value) ? value : plainTextToRichNotes(value);
  return sanitizeRichNotes(normalizeLegacyNoteFormatting(html));
}

export function richNotesToPlainText(value: string) {
  if (!value) return "";
  function text(nodes: RichNoteNode[]): string {
    return nodes
      .map((node) =>
        node.type === "text"
          ? node.value
          : `${node.tag === "br" ? "\n" : ""}${text(node.children)}${["div", "p", "li"].includes(node.tag) ? "\n" : ""}`,
      )
      .join("");
  }
  return text(parseRichNotes(value))
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}

export function truncateNotesForPrompt(
  value: string | null | undefined,
  maxLength = MAX_NOTES_LENGTH,
) {
  return richNotesToPlainText(value ?? "")
    .trim()
    .slice(0, maxLength);
}

export function appendPlainTextBlockToRichNotes(
  currentValue: string,
  block: string,
  maxLength = MAX_NOTES_LENGTH,
) {
  const currentPlainText = richNotesToPlainText(currentValue);
  const separator = currentPlainText.trim().length > 0 ? "\n\n" : "";
  const remainingLength =
    maxLength - currentPlainText.length - separator.length;
  if (remainingLength <= 0) return toRichNotesHtml(currentValue);
  const trimmedBlock = block.slice(0, remainingLength);
  return sanitizeRichNotes(
    `${toRichNotesHtml(currentValue)}${plainTextToRichNotes(`${separator}${trimmedBlock}`)}`,
  );
}
