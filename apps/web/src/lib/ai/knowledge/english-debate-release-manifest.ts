import officialV2 from "../../../scripts/manifests/ai-knowledge-english-debate-official.v2.json";
import videoCandidatesV3 from "../../../scripts/manifests/ai-knowledge-english-debate-video-candidates.v3.json";
import combinedV4 from "../../../scripts/manifests/ai-knowledge-english-debate-combined.v4.json";

import type { buildKnowledgeIngestionPlan } from "./ingestion";

type ManifestInput = Parameters<typeof buildKnowledgeIngestionPlan>[0];

export const ENGLISH_DEBATE_COMBINED_DRAFT_VERSION = 4;

function component(value: unknown) {
  return value as Pick<ManifestInput, "collection" | "sources" | "items">;
}

/**
 * Future release v4 combines official derived rules with coaching-only video
 * annotations. It contains locators and paraphrases, never copied transcripts
 * or excerpts, and remains a draft until every existing release gate passes.
 */
export function buildEnglishDebateCombinedDraftManifest(
  version = ENGLISH_DEBATE_COMBINED_DRAFT_VERSION,
): ManifestInput {
  const official = component(officialV2);
  const videos = component(videoCandidatesV3);
  if (
    combinedV4.manifestKind !== "composed_review_gated_draft" ||
    combinedV4.collectionVersion !== ENGLISH_DEBATE_COMBINED_DRAFT_VERSION ||
    combinedV4.releaseControls.publishOnPrepare !== false ||
    combinedV4.componentManifests.length !== 2 ||
    official.collection !== "debate.en.competitive" ||
    videos.collection !== "debate.en.competitive"
  ) {
    throw new Error("english_debate_component_collection_mismatch");
  }
  const manifest: ManifestInput = {
    collection: "debate.en.competitive",
    collectionVersion: version,
    sources: [...official.sources, ...videos.sources],
    items: [...official.items, ...videos.items],
  };
  assertEnglishDebateCombinedDraftSafety(manifest);
  return manifest;
}

export function assertEnglishDebateCombinedDraftSafety(
  manifest: ManifestInput,
) {
  if (manifest.collectionVersion < ENGLISH_DEBATE_COMBINED_DRAFT_VERSION) {
    throw new Error("english_debate_combined_version_not_future");
  }
  for (const source of manifest.sources) {
    if (source.metadata?.derivedOnly !== true) {
      throw new Error("english_debate_source_not_derived_only");
    }
    if (
      source.authorityTier !== "official" &&
      source.metadata?.noFullTranscript !== true
    ) {
      throw new Error("english_debate_video_source_missing_transcript_guard");
    }
    if (source.reviewStatus === "approved") {
      throw new Error("english_debate_combined_source_bypasses_review");
    }
  }
  for (const item of manifest.items) {
    if (item.permittedExcerpt !== undefined || hasRawTextPayload(item)) {
      throw new Error("english_debate_combined_contains_copied_text");
    }
    const videoCandidate = item.metadata?.noTranscriptStored === true;
    if (videoCandidate) {
      if (
        item.usableFor.length !== 1 ||
        item.usableFor[0] !== "coaching" ||
        item.reviewStatus === "approved"
      ) {
        throw new Error("english_debate_video_candidate_policy_invalid");
      }
    } else if (
      item.metadata?.derivedOnly !== true ||
      !item.usableFor.includes("grading") ||
      !item.usableFor.includes("coaching")
    ) {
      throw new Error("english_debate_official_derived_policy_invalid");
    }
  }
}

function hasRawTextPayload(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, nested]) => {
    if (["transcript", "excerpt", "fullText", "rawText"].includes(key)) {
      return typeof nested === "string" && nested.trim().length > 0;
    }
    return hasRawTextPayload(nested);
  });
}
