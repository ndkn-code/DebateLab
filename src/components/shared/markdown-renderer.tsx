"use client";

import dynamic from "next/dynamic";
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import type { Components } from "react-markdown";
import { cn } from "@/lib/utils";
import type { MarkdownRendererProps } from "@/types";

const MermaidBlock = dynamic(
  () =>
    import("@/components/shared/mermaid-block").then((mod) => ({
      default: mod.MermaidBlock,
    })),
  { ssr: false }
);

const SIZE_CLASSES = {
  sm: "prose-sm",
  base: "prose-base",
  lg: "prose-lg",
  xl: "prose-xl",
} as const;

const markdownComponents: Components = {
  h1: ({ className, ...props }) => (
    <h1
      className={cn("mb-4 text-2xl font-bold text-on-surface sm:text-3xl", className)}
      {...props}
    />
  ),
  h2: ({ className, ...props }) => (
    <h2
      className={cn("mb-3 mt-8 text-xl font-semibold text-on-surface sm:text-2xl", className)}
      {...props}
    />
  ),
  h3: ({ className, ...props }) => (
    <h3
      className={cn("mb-3 mt-6 text-lg font-semibold text-on-surface", className)}
      {...props}
    />
  ),
  p: ({ className, ...props }) => (
    <p
      className={cn("mb-4 leading-7 text-on-surface-variant last:mb-0", className)}
      {...props}
    />
  ),
  ul: ({ className, ...props }) => (
    <ul className={cn("mb-4 list-disc space-y-2 pl-6 text-on-surface-variant", className)} {...props} />
  ),
  ol: ({ className, ...props }) => (
    <ol className={cn("mb-4 list-decimal space-y-2 pl-6 text-on-surface-variant", className)} {...props} />
  ),
  li: ({ className, ...props }) => (
    <li className={cn("pl-1", className)} {...props} />
  ),
  blockquote: ({ className, ...props }) => (
    <blockquote
      className={cn(
        "mb-4 border-l-4 border-primary/30 bg-primary/5 px-4 py-3 italic text-on-surface-variant",
        className
      )}
      {...props}
    />
  ),
  table: ({ className, ...props }) => (
    <div className="mb-4 overflow-x-auto rounded-xl border border-outline-variant/20">
      <table className={cn("w-full border-collapse bg-surface-container-lowest", className)} {...props} />
    </div>
  ),
  th: ({ className, ...props }) => (
    <th
      className={cn(
        "border-b border-outline-variant/20 bg-surface-container px-4 py-3 text-left text-sm font-semibold text-on-surface",
        className
      )}
      {...props}
    />
  ),
  td: ({ className, ...props }) => (
    <td
      className={cn(
        "border-b border-outline-variant/10 px-4 py-3 text-sm text-on-surface-variant last:border-b-0",
        className
      )}
      {...props}
    />
  ),
  hr: ({ className, ...props }) => (
    <hr className={cn("my-8 border-outline-variant/20", className)} {...props} />
  ),
  a: ({ className, ...props }) => (
    <a
      className={cn("font-medium text-primary underline underline-offset-4 hover:text-primary-dim", className)}
      {...props}
    />
  ),
  pre: ({ children, className, ...props }) => {
    const child = React.Children.toArray(children)[0];
    if (React.isValidElement(child)) {
      const childProps = child.props as { className?: string; children?: React.ReactNode };
      if (childProps.className?.includes("language-mermaid")) {
        const code = String(childProps.children ?? "").trim();
        return <MermaidBlock chart={code} />;
      }
    }

    return (
      <pre
        className={cn(
          "mb-4 overflow-x-auto rounded-xl bg-[#10162f] p-4 text-sm text-slate-100",
          className
        )}
        {...props}
      >
        {children}
      </pre>
    );
  },
  code: ({ className, children, ...props }) => {
    const isBlockCode = !!className?.includes("language-");

    if (isBlockCode) {
      return (
        <code className={cn("font-mono text-sm", className)} {...props}>
          {children}
        </code>
      );
    }

    return (
      <code
        className={cn(
          "rounded-md bg-surface-container px-1.5 py-0.5 font-mono text-[0.9em] text-on-surface",
          className
        )}
        {...props}
      >
        {children}
      </code>
    );
  },
};

export function MarkdownRenderer({
  content,
  size = "base",
  className,
}: MarkdownRendererProps) {
  return (
    <div
      className={cn(
        "prose max-w-none prose-headings:scroll-mt-24 prose-strong:text-on-surface prose-em:text-on-surface-variant prose-code:before:content-none prose-code:after:content-none",
        SIZE_CLASSES[size],
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[
          [
            rehypeKatex,
            {
              strict: false,
              throwOnError: false,
            },
          ],
        ]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
