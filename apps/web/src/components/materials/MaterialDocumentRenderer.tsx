import { Info, Lightbulb, Volume2 } from "@/components/ui/icons";
import type {
  MaterialDocumentV1,
  MaterialPreviewDescriptor,
} from "@/lib/api/class-lms/material-contracts";
import { materialCopy } from "./material-copy";
import { previewUrl } from "./material-ui-model";

type ResolvedRendition = {
  renditionId: string;
  preview: MaterialPreviewDescriptor;
  transcript: string | null;
};

function RenditionImage({
  renditionId,
  alt,
  renditions,
  unavailable,
}: {
  renditionId: string;
  alt: string;
  renditions: ResolvedRendition[];
  unavailable: string;
}) {
  const rendition = renditions.find((item) => item.renditionId === renditionId);
  const src = previewUrl(rendition?.preview);
  if (!src) {
    return (
      <p className="rounded-lg border border-dashed border-outline-variant bg-surface-container-low p-4 type-body-sm text-on-surface-variant">
        {unavailable}
      </p>
    );
  }
  return (
    // Authorized, short-lived rendition URL supplied by the learner projection.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className="mx-auto max-h-[70dvh] max-w-full rounded-control border border-outline-variant object-contain"
    />
  );
}

export function MaterialDocumentRenderer({
  document,
  renditions,
  locale,
}: {
  document: MaterialDocumentV1;
  renditions: ResolvedRendition[];
  locale: string;
}) {
  const copy = materialCopy(locale);
  return (
    <article className="mx-auto w-full max-w-3xl text-on-surface">
      <h1 className="type-heading-lg font-semibold">{document.title}</h1>
      {document.sections.map((section) => (
        <section key={section.id} className="mt-6 first:mt-4">
          {section.title ? (
            <h2 className="type-heading-md font-semibold">{section.title}</h2>
          ) : null}
          <div className="mt-3 space-y-4">
            {section.blocks.map((block) => {
              if (block.type === "heading") {
                const Heading =
                  block.level === 1 ? "h2" : block.level === 2 ? "h3" : "h4";
                return (
                  <Heading
                    key={block.id}
                    className="type-title font-semibold"
                  >
                    {block.text}
                  </Heading>
                );
              }
              if (block.type === "paragraph") {
                return (
                  <p key={block.id} className="whitespace-pre-wrap type-body">
                    {block.text}
                  </p>
                );
              }
              if (block.type === "instructions") {
                return (
                  <div
                    key={block.id}
                    className="rounded-control border border-info/25 bg-info-container p-4 type-body-sm text-on-info-container"
                  >
                    {block.text}
                  </div>
                );
              }
              if (block.type === "callout") {
                const tone =
                  block.tone === "warning"
                    ? "border-warning/25 bg-warning-container text-on-warning-container"
                    : block.tone === "tip"
                      ? "border-success/25 bg-success-container text-on-success-container"
                      : "border-info/25 bg-info-container text-on-info-container";
                return (
                  <aside
                    key={block.id}
                    className={`flex gap-3 rounded-control border p-4 type-body-sm ${tone}`}
                  >
                    {block.tone === "tip" ? (
                      <Lightbulb
                        className="mt-0.5 size-4 shrink-0"
                        aria-hidden="true"
                      />
                    ) : (
                      <Info
                        className="mt-0.5 size-4 shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    <p>{block.text}</p>
                  </aside>
                );
              }
              if (block.type === "divider")
                return <hr key={block.id} className="border-outline-variant" />;
              if (block.type === "image" || block.type === "page_preview") {
                return (
                  <figure key={block.id}>
                    <RenditionImage
                      renditionId={block.renditionId}
                      alt={block.alt}
                      renditions={renditions}
                      unavailable={copy.previewUnavailable}
                    />
                    {block.type === "page_preview" ? (
                      <figcaption className="mt-2 text-center type-caption text-on-surface-variant">
                        {copy.page} {block.pageNumber}
                      </figcaption>
                    ) : null}
                  </figure>
                );
              }
              if (block.type === "audio") {
                const rendition = renditions.find(
                  (item) => item.renditionId === block.renditionId,
                );
                const src = previewUrl(rendition?.preview);
                return (
                  <figure
                    key={block.id}
                    className="rounded-control border border-outline-variant bg-surface-container-low p-4"
                  >
                    <figcaption className="mb-3 flex items-center gap-2 type-label font-semibold">
                      <Volume2
                        className="size-4 text-primary"
                        aria-hidden="true"
                      />
                      {copy.audio}
                    </figcaption>
                    {src ? (
                      <audio
                        controls
                        preload="metadata"
                        className="w-full"
                        src={src}
                      />
                    ) : (
                      <p className="type-body-sm text-on-surface-variant">
                        {copy.previewUnavailable}
                      </p>
                    )}
                    <details className="mt-3">
                      <summary className="cursor-pointer type-label font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                        {copy.transcript}
                      </summary>
                      <p className="mt-2 whitespace-pre-wrap type-body-sm text-on-surface-variant">
                        {block.transcript ??
                          rendition?.transcript ??
                          copy.noTranscript}
                      </p>
                    </details>
                  </figure>
                );
              }
              if (block.type === "table") {
                return (
                  <div
                    key={block.id}
                    className="overflow-x-auto rounded-control border border-outline-variant"
                    tabIndex={0}
                    role="region"
                    aria-label={copy.table}
                  >
                    <table className="w-full min-w-[32rem] border-collapse type-body-sm">
                      <tbody className="divide-y divide-outline-variant">
                        {block.rows.map((row, rowIndex) => (
                          <tr
                            key={`${block.id}-${rowIndex}`}
                            className={
                              rowIndex === 0
                                ? "bg-surface-container-low font-semibold"
                                : ""
                            }
                          >
                            {row.map((cell, cellIndex) => (
                              <td
                                key={`${block.id}-${rowIndex}-${cellIndex}`}
                                className="border-r border-outline-variant px-3 py-2 last:border-r-0"
                              >
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              }
              if (block.type === "vocabulary") {
                return (
                  <dl
                    key={block.id}
                    className="divide-y divide-outline-variant rounded-control border border-outline-variant"
                  >
                    {block.terms.map((item) => (
                      <div
                        key={`${block.id}-${item.term}`}
                        className="grid gap-1 px-3 py-2 sm:grid-cols-[10rem_1fr]"
                      >
                        <dt className="type-label font-semibold">
                          {item.term}
                        </dt>
                        <dd className="type-body-sm text-on-surface-variant">
                          {item.definition}
                          {item.translation ? ` · ${item.translation}` : ""}
                        </dd>
                      </div>
                    ))}
                  </dl>
                );
              }
              return (
                <section
                  key={block.id}
                  aria-labelledby={`${block.id}-prompt`}
                  className="rounded-control border border-outline-variant p-4"
                >
                  <h3
                    id={`${block.id}-prompt`}
                    className="type-label font-semibold"
                  >
                    {block.prompt}
                  </h3>
                  {block.responseMode !== "none" ? (
                    <label className="mt-3 block type-caption text-on-surface-variant">
                      {copy.answer}
                      <textarea
                        disabled
                        rows={block.responseMode === "long_text" ? 5 : 2}
                        placeholder={copy.readonlyAnswer}
                        className="mt-1 w-full resize-none rounded-control border border-outline-variant bg-surface-container-low px-3 py-2 disabled:opacity-100"
                      />
                    </label>
                  ) : null}
                </section>
              );
            })}
          </div>
        </section>
      ))}
    </article>
  );
}
