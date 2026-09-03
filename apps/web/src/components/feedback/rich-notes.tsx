import type { RichNoteNode } from "@/lib/practice-notes";

export function RichNotes({ nodes }: { nodes: RichNoteNode[] }) {
  return <>{nodes.map((node, index) => <RichNoteNodeView key={`${node.type}-${index}`} node={node} />)}</>;
}

function RichNoteNodeView({ node }: { node: RichNoteNode }) {
  if (node.type === "text") return <>{node.value}</>;
  const children = <RichNotes nodes={node.children} />;
  switch (node.tag) {
    case "a":
      return <a href={node.href} target="_blank" rel="noopener noreferrer">{children}</a>;
    case "b": return <b>{children}</b>;
    case "br": return <br />;
    case "div": return <div>{children}</div>;
    case "em": return <em>{children}</em>;
    case "i": return <i>{children}</i>;
    case "li": return <li>{children}</li>;
    case "ol": return <ol>{children}</ol>;
    case "p": return <p>{children}</p>;
    case "strong": return <strong>{children}</strong>;
    case "u": return <u>{children}</u>;
    case "ul": return <ul>{children}</ul>;
    default: return children;
  }
}
