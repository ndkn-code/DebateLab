import { Fragment, type ReactNode } from "react";

const BOLD_PATTERN = /\*\*([^*]+)\*\*/g;

/** One line: `**bold**` runs become <strong>, everything else stays text. */
function renderLine(line: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let index = 0;
  for (const match of line.matchAll(BOLD_PATTERN)) {
    const at = match.index ?? 0;
    if (at > last) nodes.push(line.slice(last, at));
    nodes.push(
      <strong key={`${keyPrefix}-b${index}`} className="font-semibold text-on-surface">
        {match[1]}
      </strong>,
    );
    last = at + match[0].length;
    index += 1;
  }
  if (last < line.length) nodes.push(line.slice(last));
  return nodes;
}

/**
 * Render authored summary/notes text: newlines become line breaks and
 * `**bold**` becomes <strong>. Deliberately tiny — no markdown engine.
 */
export function renderRichText(text: string, keyPrefix = "t"): ReactNode {
  const lines = text.split(/\r?\n/);
  return lines.map((line, lineIndex) => (
    <Fragment key={`${keyPrefix}-l${lineIndex}`}>
      {lineIndex > 0 ? <br /> : null}
      {renderLine(line, `${keyPrefix}-l${lineIndex}`)}
    </Fragment>
  ));
}
