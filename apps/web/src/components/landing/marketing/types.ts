/**
 * Copy contract for the public marketing site.
 *
 * The two products share one shell (header, footer, audience split, FAQ, CTA)
 * but tell structurally different stories, so the page copy is a discriminated
 * union rather than one shape with swapped strings. Anything the route needs
 * for SEO/structured data lives on the common half.
 */

export type MarketingLocale = "en" | "vi";
export type MarketingProduct = "debate" | "ielts";

/** Subset of the ProductIcon registry the marketing surface is allowed to use. */
export type MarketingIcon =
  | "target"
  | "mic"
  | "scale"
  | "chart"
  | "book"
  | "timer"
  | "sparkles"
  | "listChecks"
  | "waves"
  | "penLine"
  | "usersGroup"
  | "shieldCheck"
  | "compass"
  | "clipboard"
  | "repeat"
  | "quote";

export interface MarketingNavCopy {
  productLabel: string;
  debate: string;
  ielts: string;
  pageNav: string;
  sections: ReadonlyArray<{ id: string; label: string }>;
  signIn: string;
  openMenu: string;
  closeMenu: string;
  localeLabel: string;
}

export interface MarketingFooterCopy {
  description: string;
  productsLabel: string;
  guidesLabel: string;
  legalLabel: string;
  guides: ReadonlyArray<{ label: string; path: string }>;
  privacy: string;
  terms: string;
  cookies: string;
  copyright: string;
  disclaimer: string;
  backToTop: string;
}

export interface MarketingHeroCopy {
  eyebrow: string;
  title: string;
  lede: string;
  primary: string;
  primaryLoggedIn: string;
  teacher: string;
  note: string;
  /** Accessible name for the in-product visual beside the headline. */
  panelLabel: string;
}

/** Practice → feedback → improvement, told as one artifact moving through three states. */
export interface MarketingLoopCopy {
  eyebrow: string;
  title: string;
  lede: string;
  threadLabel: string;
  steps: ReadonlyArray<{
    kicker: string;
    title: string;
    body: string;
    /** The same artifact, restated at this stage of the loop. */
    artifact: string;
  }>;
}

export type MarketingGridSpan = "feature" | "tall" | "wide" | "standard";

export interface MarketingGridCard {
  id: string;
  kicker: string;
  title: string;
  body: string;
  icon: MarketingIcon;
  span: MarketingGridSpan;
  /** Small in-card data rendered as a rail, ladder, or meter. */
  rail?: ReadonlyArray<{ label: string; value: string; fill?: number }>;
}

export interface MarketingGridCopy {
  eyebrow: string;
  title: string;
  lede: string;
  cards: ReadonlyArray<MarketingGridCard>;
}

export interface MarketingAudienceCopy {
  eyebrow: string;
  title: string;
  lede: string;
  chooserLabel: string;
  student: MarketingAudiencePanel;
  teacher: MarketingAudiencePanel;
}

export interface MarketingAudiencePanel {
  chooser: string;
  role: string;
  title: string;
  body: string;
  points: ReadonlyArray<string>;
  cta: string;
  /** Miniature of the real surface this audience lands in. */
  sample: {
    label: string;
    rows: ReadonlyArray<{ primary: string; secondary: string; state: string }>;
  };
}

export interface MarketingHonestyCopy {
  eyebrow: string;
  title: string;
  lede: string;
  items: ReadonlyArray<{ label: string; value: string; body: string }>;
}

export interface MarketingFaqCopy {
  eyebrow: string;
  title: string;
  lede: string;
  items: ReadonlyArray<{ question: string; answer: string }>;
}

export interface MarketingFinalCtaCopy {
  eyebrow: string;
  title: string;
  body: string;
  student: string;
  teacher: string;
  note: string;
}

/** Shared across both product stories. */
export interface MarketingCommonCopy {
  productName: string;
  navigation: MarketingNavCopy;
  hero: MarketingHeroCopy;
  loop: MarketingLoopCopy;
  grid: MarketingGridCopy;
  audiences: MarketingAudienceCopy;
  honesty: MarketingHonestyCopy;
  faq: MarketingFaqCopy;
  finalCta: MarketingFinalCtaCopy;
  footer: MarketingFooterCopy;
  teacherSubject: string;
}

/* ── Debate: the hero panel is a real practice review ─────────────────────── */

export interface DebateReviewPanelCopy {
  reviewLabel: string;
  motionLabel: string;
  motion: string;
  speechMeta: string;
  scoreLabel: string;
  score: number;
  scoreMax: number;
  band: string;
  /** Mirrors the four scored categories in the debate feedback surface. */
  categories: ReadonlyArray<{ label: string; score: number; max: number }>;
  nextMoveLabel: string;
  nextMoveQuote: string;
  nextMove: string;
  footnote: string;
}

/** Annotated transcript — the artifact the debate reviewer actually produces. */
export interface DebateProofCopy {
  eyebrow: string;
  title: string;
  lede: string;
  transcriptLabel: string;
  speaker: string;
  /** Speech split into segments; marked segments carry a margin annotation. */
  segments: ReadonlyArray<{ text: string; mark?: "strength" | "improvement" }>;
  annotations: ReadonlyArray<{
    tag: string;
    severity: "strength" | "improvement";
    feedback: string;
    suggestion: string;
    suggestionLabel: string;
  }>;
  legend: { strength: string; improvement: string };
  footnote: string;
}

/* ── IELTS: the hero panel is a study plan with a band ladder ─────────────── */

export type IeltsPanelSkill = "listening" | "reading" | "writing" | "speaking";
export type IeltsMode = "simulation" | "rehearsal";

export interface IeltsPlanPanelCopy {
  planLabel: string;
  targetLabel: string;
  target: string;
  estimateLabel: string;
  estimate: string;
  estimateNote: string;
  skillsLabel: string;
  skills: ReadonlyArray<{
    skill: IeltsPanelSkill;
    label: string;
    band: string;
    /** 0–1 of the band scale, for the meter width. */
    progress: number;
    mode: IeltsMode;
  }>;
  taskLabel: string;
  task: string;
  taskMeta: string;
  modeLabels: Record<IeltsMode, string>;
  /** Status word for the overall estimate — it is not a mode, it is a caveat. */
  provisionalLabel: string;
  footnote: string;
}

/** The honesty diptych: what Exam Simulation is, and what AI Rehearsal is not. */
export interface IeltsProofCopy {
  eyebrow: string;
  title: string;
  lede: string;
  columns: ReadonlyArray<{
    id: IeltsMode;
    label: string;
    scope: string;
    summary: string;
    includesLabel: string;
    includes: ReadonlyArray<string>;
    excludesLabel: string;
    excludes: ReadonlyArray<string>;
  }>;
  footnote: string;
}

export type MarketingPageCopy =
  | (MarketingCommonCopy & {
      product: "debate";
      panel: DebateReviewPanelCopy;
      proof: DebateProofCopy;
    })
  | (MarketingCommonCopy & {
      product: "ielts";
      panel: IeltsPlanPanelCopy;
      proof: IeltsProofCopy;
    });
