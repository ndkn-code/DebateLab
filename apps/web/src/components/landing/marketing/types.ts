export type MarketingLocale = "en" | "vi";
export type MarketingProduct = "debate" | "ielts";

export type MarketingFeatureIcon =
  | "target"
  | "microphone"
  | "scales"
  | "chart"
  | "book"
  | "timer";

export interface MarketingPageCopy {
  product: MarketingProduct;
  productName: string;
  navigation: {
    productLabel: string;
    debate: string;
    ielts: string;
    howItWorks: string;
    features: string;
    audiences: string;
    faq: string;
    signIn: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    description: string;
    primary: string;
    primaryLoggedIn: string;
    teacher: string;
    note: string;
  };
  preview: {
    eyebrow: string;
    title: string;
    subtitle: string;
    action: string;
    metricLabel: string;
    metricValue: string;
    secondaryLabel: string;
    secondaryValue: string;
    feedbackTitle: string;
    feedbackBody: string;
    steps: Array<{ label: string; value: string }>;
  };
  process: {
    eyebrow: string;
    title: string;
    description: string;
    steps: Array<{ title: string; body: string }>;
  };
  features: {
    eyebrow: string;
    title: string;
    description: string;
    items: Array<{
      title: string;
      body: string;
      icon: MarketingFeatureIcon;
      detail: string;
      size: "wide" | "standard";
    }>;
  };
  productProof: {
    eyebrow: string;
    title: string;
    description: string;
    labels: string[];
    insightTitle: string;
    insightBody: string;
    status: string;
  };
  audiences: {
    eyebrow: string;
    title: string;
    studentTab: string;
    teacherTab: string;
    student: {
      title: string;
      body: string;
      points: string[];
      cta: string;
    };
    teacher: {
      title: string;
      body: string;
      points: string[];
      cta: string;
    };
  };
  proof: {
    eyebrow: string;
    title: string;
    description: string;
    items: Array<{ label: string; value: string; body: string }>;
  };
  faq: {
    eyebrow: string;
    title: string;
    items: Array<{ question: string; answer: string }>;
  };
  finalCta: {
    title: string;
    body: string;
    student: string;
    teacher: string;
  };
  footer: {
    description: string;
    product: string;
    guidesLabel: string;
    guides: Array<{ label: string; path: string }>;
    legal: string;
    privacy: string;
    terms: string;
    cookies: string;
    copyright: string;
  };
  teacherSubject: string;
}
