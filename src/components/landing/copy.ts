export type LandingLocale = "en" | "vi";

export type LandingCopy = {
  nav: {
    features: string;
    howItWorks: string;
    pricing: string;
    resources: string;
    about: string;
    login: string;
    signup: string;
    dashboard: string;
  };
  hero: {
    badge: string;
    line1: string;
    line2: string;
    description: string;
    primaryCta: string;
    primaryCtaLoggedIn: string;
    secondaryCta: string;
    lovedByPrefix: string;
    lovedByCount: string;
    lovedBySuffix: string;
  };
  stats: Array<{
    icon: "users" | "message" | "star" | "clock";
    value: string;
    label: string;
  }>;
  features: {
    eyebrow: string;
    title: string;
    items: Array<{
      icon: "mic" | "book" | "users" | "chart" | "message" | "trophy";
      title: string;
      description: string;
    }>;
  };
  steps: {
    eyebrow: string;
    title: string;
    items: Array<{
      icon: "book" | "users" | "chart";
      title: string;
      description: string;
    }>;
  };
  testimonials: {
    eyebrow: string;
    title: string;
    items: Array<{
      quote: string;
      name: string;
      role: string;
      initials: string;
    }>;
  };
  cta: {
    title: string;
    description: string;
    button: string;
    buttonLoggedIn: string;
  };
  footer: {
    brandDescription: string;
    product: {
      title: string;
      links: Array<{ label: string; href: string }>;
    };
    resources: {
      title: string;
      links: Array<{ label: string; href: string }>;
    };
    company: {
      title: string;
      links: Array<{ label: string; href: string }>;
    };
    newsletter: {
      title: string;
      description: string;
      placeholder: string;
      button: string;
    };
    copyright: string;
  };
};

const landingCopy: Record<LandingLocale, LandingCopy> = {
  en: {
    nav: {
      features: "Features",
      howItWorks: "How it Works",
      pricing: "Pricing",
      resources: "Resources",
      about: "About",
      login: "Log in",
      signup: "Get Started Free",
      dashboard: "Go to Dashboard",
    },
    hero: {
      badge: "AI-Powered Debate Learning",
      line1: "Think sharper.",
      line2: "Debate better.",
      description:
        "AI-powered tools, real-time feedback, and guided practice to help you build arguments, refute with confidence, and win.",
      primaryCta: "Start Practicing Now",
      primaryCtaLoggedIn: "Go to Dashboard",
      secondaryCta: "Explore Features",
      lovedByPrefix: "Loved by",
      lovedByCount: "10,000+",
      lovedBySuffix: "learners",
    },
    stats: [
      { icon: "users", value: "10,000+", label: "Active Learners" },
      { icon: "message", value: "50,000+", label: "Debates Completed" },
      { icon: "star", value: "95%", label: "Satisfaction Rate" },
      { icon: "clock", value: "24/7", label: "AI Feedback" },
    ],
    features: {
      eyebrow: "FEATURES",
      title: "Everything you need to level up your debating skills",
      items: [
        {
          icon: "mic",
          title: "AI Practice Coach",
          description:
            "Get instant feedback on your arguments, clarity, and reasoning.",
        },
        {
          icon: "book",
          title: "Topic Library",
          description:
            "Explore hundreds of debate topics across various categories.",
        },
        {
          icon: "users",
          title: "Live Debates",
          description:
            "Compete in real-time debates and challenge learners worldwide.",
        },
        {
          icon: "chart",
          title: "Performance Analytics",
          description:
            "Track your progress and identify strengths and areas to improve.",
        },
        {
          icon: "message",
          title: "Smart Feedback",
          description:
            "AI analyzes your debates and gives actionable improvement tips.",
        },
        {
          icon: "trophy",
          title: "Build Your Streak",
          description:
            "Stay consistent and unlock rewards as you keep practicing.",
        },
      ],
    },
    steps: {
      eyebrow: "HOW IT WORKS",
      title: "Start improving in 3 simple steps",
      items: [
        {
          icon: "book",
          title: "Learn & Practice",
          description:
            "Pick a topic, learn key arguments, and practice with AI or solo.",
        },
        {
          icon: "users",
          title: "Debate & Refine",
          description:
            "Debate with others or AI and get instant, personalized feedback.",
        },
        {
          icon: "chart",
          title: "Improve & Win",
          description:
            "Track your progress, refine your skills, and become a top debater.",
        },
      ],
    },
    testimonials: {
      eyebrow: "TRUSTED BY LEARNERS",
      title: "Loved by debaters worldwide",
      items: [
        {
          quote:
            "Debate Lab helped me organize my thoughts and speak with so much more confidence.",
          name: "Sarah Kim",
          role: "High School Debater",
          initials: "SK",
        },
        {
          quote:
            "The AI feedback is incredibly detailed and helps me improve faster than ever before.",
          name: "Alex Chen",
          role: "University Debater",
          initials: "AC",
        },
        {
          quote:
            "I love the live debates! It pushes me to think on my feet and spot different perspectives.",
          name: "Priya Sharma",
          role: "Debate Club President",
          initials: "PS",
        },
      ],
    },
    cta: {
      title: "Ready to become a better debater?",
      description:
        "Join Debate Lab today and start your journey to stronger arguments and greater confidence.",
      button: "Get Started Free",
      buttonLoggedIn: "Go to Dashboard",
    },
    footer: {
      brandDescription:
        "AI-powered debate learning platform to help you think critically, argue clearly, and win with confidence.",
      product: {
        title: "Product",
        links: [
          { label: "Features", href: "#features" },
          { label: "Practice", href: "/practice" },
          { label: "Live Debates", href: "/practice?track=debate&mode=full&difficulty=medium" },
          { label: "Pricing", href: "#pricing" },
          { label: "Changelog", href: "#" },
        ],
      },
      resources: {
        title: "Resources",
        links: [
          { label: "Blog", href: "#" },
          { label: "Debate Topics", href: "/practice" },
          { label: "Guides", href: "#" },
          { label: "Help Center", href: "#" },
          { label: "Community", href: "#" },
        ],
      },
      company: {
        title: "Company",
        links: [
          { label: "About Us", href: "#about" },
          { label: "Careers", href: "#" },
          { label: "Contact", href: "#" },
          { label: "Privacy Policy", href: "#" },
          { label: "Terms of Service", href: "#" },
        ],
      },
      newsletter: {
        title: "Newsletter",
        description:
          "Get debate tips, new topics, and updates delivered to your inbox.",
        placeholder: "Enter your email",
        button: "Subscribe",
      },
      copyright: "© 2025 Debate Lab. All rights reserved.",
    },
  },
  vi: {
    nav: {
      features: "Tính năng",
      howItWorks: "Cách hoạt động",
      pricing: "Bảng giá",
      resources: "Tài nguyên",
      about: "Giới thiệu",
      login: "Đăng nhập",
      signup: "Bắt đầu miễn phí",
      dashboard: "Vào Dashboard",
    },
    hero: {
      badge: "Học Debate với AI",
      line1: "Sắc bén hơn.",
      line2: "Debate tốt hơn.",
      description:
        "Công cụ AI, feedback theo thời gian thực, và lộ trình luyện tập rõ ràng để giúp bạn xây dựng lập luận, phản biện chắc tay, và thi đấu tự tin hơn.",
      primaryCta: "Bắt đầu luyện ngay",
      primaryCtaLoggedIn: "Vào Dashboard",
      secondaryCta: "Khám phá tính năng",
      lovedByPrefix: "Được",
      lovedByCount: "10,000+",
      lovedBySuffix: "người học yêu thích",
    },
    stats: [
      { icon: "users", value: "10,000+", label: "Người học đang hoạt động" },
      { icon: "message", value: "50,000+", label: "Lượt debate đã hoàn thành" },
      { icon: "star", value: "95%", label: "Tỉ lệ hài lòng" },
      { icon: "clock", value: "24/7", label: "AI phản hồi liên tục" },
    ],
    features: {
      eyebrow: "TÍNH NĂNG",
      title: "Mọi thứ bạn cần để nâng cấp kỹ năng debate",
      items: [
        {
          icon: "mic",
          title: "AI Practice Coach",
          description:
            "Nhận feedback tức thì về lập luận, độ rõ ràng và chiều sâu phân tích.",
        },
        {
          icon: "book",
          title: "Kho chủ đề",
          description:
            "Khám phá hàng trăm chủ đề debate thuộc nhiều nhóm khác nhau.",
        },
        {
          icon: "users",
          title: "Debate trực tiếp",
          description:
            "Tham gia debate thời gian thực và luyện cùng người học khác.",
        },
        {
          icon: "chart",
          title: "Phân tích hiệu suất",
          description:
            "Theo dõi tiến bộ và xác định rõ điểm mạnh, điểm cần cải thiện.",
        },
        {
          icon: "message",
          title: "Feedback thông minh",
          description:
            "AI phân tích bài debate và đưa ra gợi ý cải thiện cụ thể.",
        },
        {
          icon: "trophy",
          title: "Giữ chuỗi luyện tập",
          description:
            "Duy trì thói quen luyện đều và mở khóa phần thưởng theo tiến độ.",
        },
      ],
    },
    steps: {
      eyebrow: "CÁCH HOẠT ĐỘNG",
      title: "Bắt đầu tiến bộ chỉ với 3 bước đơn giản",
      items: [
        {
          icon: "book",
          title: "Học & luyện",
          description:
            "Chọn topic, nắm ý chính, rồi luyện tập với AI hoặc tự luyện.",
        },
        {
          icon: "users",
          title: "Debate & tinh chỉnh",
          description:
            "Tranh biện với AI hoặc người khác và nhận feedback cá nhân hóa ngay.",
        },
        {
          icon: "chart",
          title: "Tiến bộ & chiến thắng",
          description:
            "Theo dõi quá trình, mài sắc kỹ năng và trở thành debater nổi bật.",
        },
      ],
    },
    testimonials: {
      eyebrow: "ĐƯỢC NGƯỜI HỌC TIN DÙNG",
      title: "Được debater khắp nơi yêu thích",
      items: [
        {
          quote:
            "Debate Lab giúp mình sắp xếp suy nghĩ rõ hơn và nói tự tin hơn rất nhiều.",
          name: "Sarah Kim",
          role: "Debater trung học",
          initials: "SK",
        },
        {
          quote:
            "Feedback của AI cực kỳ chi tiết và giúp mình cải thiện nhanh hơn hẳn.",
          name: "Alex Chen",
          role: "Debater đại học",
          initials: "AC",
        },
        {
          quote:
            "Mình rất thích phần live debates. Nó buộc mình phải phản xạ nhanh và nhìn vấn đề đa chiều hơn.",
          name: "Priya Sharma",
          role: "Chủ nhiệm CLB Debate",
          initials: "PS",
        },
      ],
    },
    cta: {
      title: "Sẵn sàng trở thành debater tốt hơn?",
      description:
        "Tham gia Debate Lab ngay hôm nay để bắt đầu hành trình xây lập luận chắc hơn và nói tự tin hơn.",
      button: "Bắt đầu miễn phí",
      buttonLoggedIn: "Vào Dashboard",
    },
    footer: {
      brandDescription:
        "Nền tảng học debate bằng AI giúp bạn tư duy sắc bén, lập luận rõ ràng, và tự tin hơn khi tranh biện.",
      product: {
        title: "Sản phẩm",
        links: [
          { label: "Tính năng", href: "#features" },
          { label: "Luyện tập", href: "/practice" },
          { label: "Debate trực tiếp", href: "/practice?track=debate&mode=full&difficulty=medium" },
          { label: "Bảng giá", href: "#pricing" },
          { label: "Cập nhật", href: "#" },
        ],
      },
      resources: {
        title: "Tài nguyên",
        links: [
          { label: "Blog", href: "#" },
          { label: "Chủ đề debate", href: "/practice" },
          { label: "Hướng dẫn", href: "#" },
          { label: "Trung tâm trợ giúp", href: "#" },
          { label: "Cộng đồng", href: "#" },
        ],
      },
      company: {
        title: "Công ty",
        links: [
          { label: "Về chúng tôi", href: "#about" },
          { label: "Tuyển dụng", href: "#" },
          { label: "Liên hệ", href: "#" },
          { label: "Chính sách bảo mật", href: "#" },
          { label: "Điều khoản dịch vụ", href: "#" },
        ],
      },
      newsletter: {
        title: "Bản tin",
        description:
          "Nhận tips debate, topic mới và cập nhật sản phẩm qua email.",
        placeholder: "Nhập email của bạn",
        button: "Đăng ký",
      },
      copyright: "© 2025 Debate Lab. Tất cả quyền được bảo lưu.",
    },
  },
};

export function getLandingCopy(locale: string): LandingCopy {
  return locale === "vi" ? landingCopy.vi : landingCopy.en;
}
