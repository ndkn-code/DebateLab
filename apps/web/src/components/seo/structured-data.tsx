type JsonLdValue = Record<string, unknown> | Array<Record<string, unknown>>;

export function StructuredData({ value }: { value: JsonLdValue }) {
  const entries = Array.isArray(value) ? value : [value];
  return entries.map((entry, index) => {
    const json = JSON.stringify(entry).replace(/</g, "\\u003c");
    return (
      <script
        key={index}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: json }}
      />
    );
  });
}
