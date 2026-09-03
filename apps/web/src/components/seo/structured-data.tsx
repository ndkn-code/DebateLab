type JsonLdValue = Record<string, unknown> | Array<Record<string, unknown>>;

export function StructuredData({
  value,
  nonce,
}: {
  value: JsonLdValue;
  nonce?: string;
}) {
  const entries = Array.isArray(value) ? value : [value];
  return entries.map((entry, index) => {
    const json = JSON.stringify(entry).replace(/</g, "\\u003c");
    return (
      <script key={index} nonce={nonce} type="application/ld+json">
        {json}
      </script>
    );
  });
}
