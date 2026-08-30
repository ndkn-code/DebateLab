import { BorderBeam } from "@/components/magicui/border-beam";
import { ProductIcon } from "@/components/ui/product-icon";
import type { MarketingPageCopy } from "./types";

export function HeroProductPreview({ copy }: { copy: MarketingPageCopy }) {
  return (
    <div className="relative overflow-hidden rounded-[12px] border border-outline-variant bg-surface p-px shadow-token-card">
      <BorderBeam duration={10} />
      <div className="relative z-10 rounded-[11px] bg-surface p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 border-b border-outline-variant pb-4">
          <div>
            <p className="type-caption font-semibold uppercase text-on-surface-variant">
              {copy.preview.eyebrow}
            </p>
            <p className="mt-1 type-label text-on-surface-variant">
              {copy.productName}
            </p>
          </div>
          <span className="inline-flex h-5 items-center rounded-[6px] bg-success-container px-2 type-caption font-semibold text-success-dim">
            {copy.product === "debate" ? "7 min" : "18 min"}
          </span>
        </div>

        <div className="py-5">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-primary text-on-primary">
              {copy.product === "debate" ? (
                <ProductIcon name="mic" size="md" />
              ) : (
                <ProductIcon name="target" size="md" />
              )}
            </span>
            <div className="min-w-0">
              <h2 className="type-title font-semibold text-on-surface">
                {copy.preview.title}
              </h2>
              <p className="mt-1 type-body-sm text-on-surface-variant">
                {copy.preview.subtitle}
              </p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="rounded-[10px] border border-outline-variant bg-surface-container-low p-3">
              <p className="type-caption text-on-surface-variant">
                {copy.preview.metricLabel}
              </p>
              <p className="mt-1 type-title font-semibold">
                {copy.preview.metricValue}
              </p>
            </div>
            <div className="rounded-[10px] border border-outline-variant bg-surface-container-low p-3">
              <p className="type-caption text-on-surface-variant">
                {copy.preview.secondaryLabel}
              </p>
              <p className="mt-1 type-title font-semibold">
                {copy.preview.secondaryValue}
              </p>
            </div>
          </div>
        </div>

        <div className="flex h-8 items-center justify-between rounded-[10px] bg-primary px-3 type-label font-semibold text-on-primary">
          <span>{copy.preview.action}</span>
          <ProductIcon name="arrowRight" size="sm" />
        </div>
      </div>
    </div>
  );
}

export function FeedbackProductPreview({ copy }: { copy: MarketingPageCopy }) {
  return (
    <div className="rounded-[12px] border border-outline-variant bg-surface p-4 shadow-token-card sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant pb-4">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-[10px] bg-primary text-on-primary">
            <ProductIcon name="sparkles" size="sm" />
          </span>
          <span className="type-label font-semibold">{copy.productName}</span>
        </div>
        <span className="inline-flex h-5 items-center rounded-[6px] bg-success-container px-2 type-caption font-semibold text-success-dim">
          {copy.productProof.status}
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        {copy.productProof.labels.map((label, index) => (
          <div
            key={label}
            className="rounded-[10px] border border-outline-variant bg-surface-container-low p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="type-caption text-on-surface-variant">
                {label}
              </span>
              {index < 2 ? (
                <ProductIcon
                  name="checkCircle"
                  size="xs"
                  weight="fill"
                  className="text-success"
                />
              ) : (
                <ProductIcon
                  name="trendingUp"
                  size="xs"
                  className="text-secondary"
                />
              )}
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-container-high">
              <div
                className={
                  index < 2 ? "h-full bg-success" : "h-full bg-secondary"
                }
                style={{ width: `${76 - index * 7}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-[10px] border border-secondary/20 bg-secondary-container p-4">
        <div className="flex items-start gap-3">
          <ProductIcon
            name="target"
            size="sm"
            className="mt-0.5 shrink-0 text-secondary"
          />
          <div>
            <h3 className="type-label font-semibold text-on-surface">
              {copy.productProof.insightTitle}
            </h3>
            <p className="mt-1 type-body-sm text-on-surface-variant">
              {copy.productProof.insightBody}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-outline-variant pt-3 type-caption text-on-surface-variant">
        <span className="inline-flex items-center gap-1.5">
          <ProductIcon name="clock" size="xs" />
          {copy.preview.subtitle}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ProductIcon name="target" size="xs" />
          {copy.preview.secondaryValue}
        </span>
      </div>
    </div>
  );
}
