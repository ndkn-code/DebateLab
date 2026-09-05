import type {
  MarketingFooterCopy,
  MarketingLocale,
  MarketingNavCopy,
} from "./types";

type SharedChrome = {
  navigation: MarketingNavCopy;
  footerChrome: Omit<
    MarketingFooterCopy,
    "description" | "guides" | "disclaimer"
  >;
};

const SECTIONS_EN = [
  { id: "loop", label: "How it works" },
  { id: "capabilities", label: "What you get" },
  { id: "proof", label: "Product proof" },
  { id: "audiences", label: "Students & teachers" },
  { id: "faq", label: "FAQ" },
] as const;

const SECTIONS_VI = [
  { id: "loop", label: "Cách hoạt động" },
  { id: "capabilities", label: "Bạn nhận được gì" },
  { id: "proof", label: "Bằng chứng sản phẩm" },
  { id: "audiences", label: "Học viên & giáo viên" },
  { id: "faq", label: "Câu hỏi thường gặp" },
] as const;

export const SHARED_CHROME: Record<MarketingLocale, SharedChrome> = {
  en: {
    navigation: {
      productLabel: "Choose a Thinkfy product",
      debate: "Debate",
      ielts: "IELTS",
      pageNav: "Page sections",
      sections: SECTIONS_EN,
      signIn: "Sign in",
      openMenu: "Open navigation",
      closeMenu: "Close navigation",
      localeLabel: "Xem bằng tiếng Việt",
    },
    footerChrome: {
      productsLabel: "Products",
      guidesLabel: "Guides",
      legalLabel: "Legal",
      privacy: "Privacy",
      terms: "Terms",
      cookies: "Cookies",
      copyright: "© 2026 Thinkfy. All rights reserved.",
      backToTop: "Back to top",
    },
  },
  vi: {
    navigation: {
      productLabel: "Chọn sản phẩm Thinkfy",
      debate: "Tranh biện",
      ielts: "IELTS",
      pageNav: "Các phần của trang",
      sections: SECTIONS_VI,
      signIn: "Đăng nhập",
      openMenu: "Mở điều hướng",
      closeMenu: "Đóng điều hướng",
      localeLabel: "Read in English",
    },
    footerChrome: {
      productsLabel: "Sản phẩm",
      guidesLabel: "Hướng dẫn",
      legalLabel: "Pháp lý",
      privacy: "Quyền riêng tư",
      terms: "Điều khoản",
      cookies: "Cookie",
      copyright: "© 2026 Thinkfy. Bảo lưu mọi quyền.",
      backToTop: "Về đầu trang",
    },
  },
};

export const SHARED_GUIDES = {
  aiFeedback: {
    en: { label: "How AI feedback works", path: "/guides/ai-feedback-method" },
    vi: {
      label: "Cách phản hồi AI hoạt động",
      path: "/guides/ai-feedback-method",
    },
  },
  teacher: {
    en: { label: "Teacher workflows", path: "/guides/teacher-workflows" },
    vi: { label: "Quy trình cho giáo viên", path: "/guides/teacher-workflows" },
  },
} as const;
