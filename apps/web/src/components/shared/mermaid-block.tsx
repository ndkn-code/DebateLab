"use client";

import { useEffect, useState } from "react";

interface MermaidBlockProps {
  chart: string;
}

export function MermaidBlock({ chart }: MermaidBlockProps) {
  const [svg, setSvg] = useState("");
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function renderChart() {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "neutral",
          securityLevel: "strict",
        });

        const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
        const { svg: rendered } = await mermaid.render(id, chart);

        if (!cancelled) {
          setSvg(rendered);
          setHasError(false);
        }
      } catch {
        if (!cancelled) {
          setHasError(true);
          setSvg("");
        }
      }
    }

    renderChart();

    return () => {
      cancelled = true;
    };
  }, [chart]);

  if (hasError) {
    return (
      <pre className="mb-4 overflow-x-auto rounded-xl bg-surface-container p-4 text-sm text-on-surface">
        <code>{chart}</code>
      </pre>
    );
  }

  if (!svg) {
    return (
      <div className="mb-4 flex items-center justify-center rounded-xl bg-surface-container p-6 text-sm text-on-surface-variant">
        Rendering diagram...
      </div>
    );
  }

  return (
    <div
      className="not-prose mb-4 overflow-x-auto rounded-xl bg-surface-container-low p-4"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
