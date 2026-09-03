import assert from "node:assert/strict";
import test from "node:test";
import { nonceMermaidStyles } from "./mermaid-csp";

test("adds the request nonce to every Mermaid style element", () => {
  const svg = '<svg><style>.node{fill:red}</style><STYLE media="all">text{fill:black}</STYLE></svg>';

  assert.equal(
    nonceMermaidStyles(svg, "abc123"),
    '<svg><style nonce="abc123">.node{fill:red}</style><style nonce="abc123" media="all">text{fill:black}</STYLE></svg>',
  );
});

test("does not rewrite non-style elements or output without a nonce", () => {
  const svg = "<svg><stylex>unchanged</stylex></svg>";

  assert.equal(nonceMermaidStyles(svg, "abc123"), svg);
  assert.equal(nonceMermaidStyles("<svg><style>text{}</style></svg>", undefined), "<svg><style>text{}</style></svg>");
  assert.equal(
    nonceMermaidStyles("<svg><style>text{}</style></svg>", 'abc" onload="alert(1)'),
    "<svg><style>text{}</style></svg>",
  );
});
