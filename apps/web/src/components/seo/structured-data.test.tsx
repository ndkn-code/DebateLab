import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { StructuredData } from "./structured-data";

const markup = renderToStaticMarkup(
  <StructuredData
    value={[
      { "@context": "https://schema.org", "@type": "WebSite", name: "Thinkfy" },
      { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: [] },
    ]}
  />,
);

const scripts = markup.match(/<script[^>]*type="application\/ld\+json"[^>]*>.*?<\/script>/g) ?? [];
assert.equal(
  scripts.length,
  2,
  "each top-level JSON-LD object should have its own script for Safari compatibility",
);
const documents = scripts.map((script) =>
  JSON.parse(script.slice(script.indexOf(">") + 1, -"</script>".length)) as Record<string, unknown>,
);
assert.deepEqual(
  documents.map((document) => document["@type"]),
  ["WebSite", "FAQPage"],
);
for (const document of documents) {
  assert.equal(Array.isArray(document), false, "JSON-LD roots must be objects for Safari");
  assert.equal(document["@context"], "https://schema.org");
}

const escapedMarkup = renderToStaticMarkup(
  <StructuredData
    value={{
      "@context": "https://schema.org",
      "@type": "Article",
      headline: "<script>alert(1)</script>",
    }}
  />,
);
assert.match(escapedMarkup, /\\u003cscript>alert\(1\)\\u003c\/script>/);
assert.doesNotMatch(escapedMarkup, /<script>alert\(1\)<\/script>/);

const singleObjectMarkup = renderToStaticMarkup(
  <StructuredData
    value={{ "@context": "https://schema.org", "@type": "Article", headline: "Guide" }}
  />,
);
assert.equal(
  (singleObjectMarkup.match(/<script[^>]*type="application\/ld\+json"[^>]*>.*?<\/script>/g) ?? [])
    .length,
  1,
  "a single JSON-LD object should still render one script",
);
console.log("structured data rendering tests passed");
