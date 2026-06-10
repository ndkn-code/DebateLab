export type LandingLocale = "en" | "vi";

type Highlighted = {
  /** Full text of the line; `highlight` must appear verbatim inside it. */
  text: string;
  highlight: string;
};

export type LandingV3Copy = {
  nav: {
    links: Array<{ label: string; href: string }>;
    login: string;
    signup: string;
    dashboard: string;
  };
  hero: {
    line1: string;
    line2: Highlighted;
    description: string;
    primaryCta: string;
    primaryCtaLoggedIn: string;
    secondaryCta: string;
    proBubble: string;
    conBubble: string;
    forLabel: string;
    againstLabel: string;
    lovedBy: { prefix: string; count: string; suffix: string };
  };
  proof: Array<{
    icon: "mic" | "users" | "bolt" | "trophy";
    value: { target: number; suffix: string } | { static: string };
    label: string;
  }>;
  features: {
    eyebrow: string;
    title: Highlighted;
    aside: string;
    coach: { title: string; caption: string; bubbleA: string; bubbleB: string };
    topics: { title: string; caption: string; badge: string; chips: string[] };
    live: { title: string; caption: string; liveLabel: string; you: string; rival: string };
    analytics: { title: string; caption: string; weeks: string[] };
  };
  showcase: {
    eyebrow: string;
    title: Highlighted;
    para1: string;
    para2: string;
    link: string;
    panel: {
      title: string;
      timer: string;
      transcript: Array<{ text: string; tone?: "good" | "fix"; tag?: string }>;
      scoreLabel: string;
      score: number;
      meters: Array<{ label: string; value: number }>;
      coachNote: string;
    };
  };
  journey: {
    title: Highlighted;
    description: string;
    waypoints: Array<{ icon: "book" | "mic" | "swords" | "trophy"; label: string }>;
  };
  gamification: {
    eyebrow: string;
    title: Highlighted;
    description: string;
    cta: string;
    streak: { title: string; caption: string };
    league: {
      title: string;
      rows: Array<{ name: string; xp: string; you?: boolean }>;
    };
    xp: { burst: string; level: string };
  };
  testimonials: {
    eyebrow: string;
    title: Highlighted;
    items: Array<{
      quote: string;
      name: string;
      role: string;
      initials: string;
      flame?: boolean;
    }>;
  };
  cta: {
    title: string;
    description: string;
    button: string;
    buttonLoggedIn: string;
    note: string;
  };
  footer: {
    brandDescription: string;
    columns: Array<{
      title: string;
      links: Array<{ label: string; href: string }>;
    }>;
    newsletter: {
      title: string;
      description: string;
      placeholder: string;
      button: string;
    };
    copyright: string;
  };
};

const en: LandingV3Copy = {
  nav: {
    links: [
      { label: "Features", href: "#features" },
      { label: "How it works", href: "#journey" },
      { label: "Stories", href: "#stories" },
      { label: "Pricing", href: "#pricing" },
    ],
    login: "Log in",
    signup: "Get started",
    dashboard: "Go to Dashboard",
  },
  hero: {
    line1: "Find your voice.",
    line2: { text: "Win the room.", highlight: "Win" },
    description:
      "AI-powered debate coaching that turns students into confident, persuasive speakers.",
    primaryCta: "Start for free",
    primaryCtaLoggedIn: "Go to Dashboard",
    secondaryCta: "Watch how it works",
    proBubble: "Strong claim!",
    conBubble: "Rebuttal incoming…",
    forLabel: "FOR",
    againstLabel: "AGAINST",
    lovedBy: { prefix: "Loved by", count: "10,000+", suffix: "student debaters" },
  },
  proof: [
    { icon: "mic", value: { target: 120, suffix: "k+" }, label: "speeches analyzed" },
    { icon: "users", value: { target: 10000, suffix: "+" }, label: "student debaters" },
    { icon: "bolt", value: { static: "24/7" }, label: "instant AI feedback" },
    { icon: "trophy", value: { target: 95, suffix: "%" }, label: "feel more confident" },
  ],
  features: {
    eyebrow: "EVERYTHING YOU NEED",
    title: { text: "Train like a champion debater", highlight: "champion" },
    aside: "Four tools. One goal: make you unstoppable on stage.",
    coach: {
      title: "AI Practice Coach",
      caption: "Speak, get scored, improve — your coach never sleeps.",
      bubbleA: "Strong rebuttal! Your logic chain held up.",
      bubbleB: "Try a concrete example next time.",
    },
    topics: {
      title: "500+ Debate Topics",
      caption: "From school uniforms to AI — always something to argue about.",
      badge: "500+",
      chips: ["School uniforms", "Social media", "AI in class", "Homework ban", "Space travel"],
    },
    live: {
      title: "Live Debates",
      caption: "Face real opponents in real time.",
      liveLabel: "LIVE",
      you: "You",
      rival: "Minh",
    },
    analytics: {
      title: "Progress Analytics",
      caption: "Watch your skills climb week after week.",
      weeks: ["W1", "W2", "W3", "W4", "W5"],
    },
  },
  showcase: {
    eyebrow: "SMART FEEDBACK",
    title: { text: "Feedback that actually makes you better", highlight: "better" },
    para1: "Every practice speech is scored on clarity, logic and delivery — in seconds.",
    para2: "No vague praise. You get the exact sentence to fix, and how to fix it.",
    link: "See a sample report",
    panel: {
      title: "Practice · Should homework be banned?",
      timer: "4:32",
      transcript: [
        { text: "Homework eats the hours students need for deep rest and real hobbies.", tone: "good", tag: "Strong claim" },
        { text: "Most teachers I know agree that less is more here." },
        { text: "Finland assigns less homework and still tops global rankings.", tone: "fix", tag: "Add evidence" },
        { text: "So banning homework isn't lazy — it's how modern learning works." },
      ],
      scoreLabel: "Overall",
      score: 82,
      meters: [
        { label: "Clarity", value: 86 },
        { label: "Logic", value: 78 },
        { label: "Delivery", value: 84 },
      ],
      coachNote: "Your rebuttal improved 12% this week!",
    },
  },
  journey: {
    title: { text: "Your journey to the final round", highlight: "journey" },
    description: "A guided path from your first speech to championship debates.",
    waypoints: [
      { icon: "book", label: "Learn the basics" },
      { icon: "mic", label: "Practice with AI" },
      { icon: "swords", label: "Compete live" },
      { icon: "trophy", label: "Win the final" },
    ],
  },
  gamification: {
    eyebrow: "STAY MOTIVATED",
    title: { text: "Practice that feels like play", highlight: "play" },
    description:
      "Streaks, XP and weekly leagues turn daily practice into a habit you'll actually keep.",
    cta: "Explore the app",
    streak: { title: "12-day streak!", caption: "Keep it burning" },
    league: {
      title: "Gold League",
      rows: [
        { name: "Minh Anh", xp: "980 XP" },
        { name: "Bảo", xp: "870 XP" },
        { name: "You", xp: "845 XP", you: true },
      ],
    },
    xp: { burst: "+40 XP", level: "Level 8" },
  },
  testimonials: {
    eyebrow: "LOVED BY STUDENT DEBATERS",
    title: { text: "Debaters can't stop talking", highlight: "talking" },
    items: [
      {
        quote:
          "Thinkfy got me to the national semifinals. The AI catches things even my coach missed.",
        name: "Linh",
        role: "Grade 11 · Hanoi",
        initials: "L",
      },
      {
        quote: "I used to freeze on stage. Now I ask to go first.",
        name: "Đức",
        role: "Grade 10 · Da Nang",
        initials: "Đ",
      },
      {
        quote: "Our debate club doubled in size after we started using it.",
        name: "Ms. Hương",
        role: "Club Advisor · HCMC",
        initials: "H",
      },
      {
        quote: "The streak kept me practicing every single day. 47 days now!",
        name: "Khánh",
        role: "Grade 12 · Hue",
        initials: "K",
        flame: true,
      },
    ],
  },
  cta: {
    title: "Ready to find your voice?",
    description: "Join 10,000+ students becoming fearless speakers — free.",
    button: "Start debating free",
    buttonLoggedIn: "Go to Dashboard",
    note: "No credit card needed",
  },
  footer: {
    brandDescription:
      "AI-powered debate learning platform to help you think critically, argue clearly, and win with confidence.",
    columns: [
      {
        title: "Product",
        links: [
          { label: "Features", href: "#features" },
          { label: "Practice", href: "/practice" },
          { label: "Live Debates", href: "/practice?track=debate&mode=full&difficulty=medium" },
          { label: "Pricing", href: "#pricing" },
        ],
      },
      {
        title: "Resources",
        links: [
          { label: "Blog", href: "#" },
          { label: "Debate Topics", href: "/practice" },
          { label: "Help Center", href: "#" },
          { label: "Community", href: "#" },
        ],
      },
      {
        title: "Company",
        links: [
          { label: "About Us", href: "#about" },
          { label: "Careers", href: "#" },
          { label: "Privacy Policy", href: "#" },
          { label: "Terms of Service", href: "#" },
        ],
      },
    ],
    newsletter: {
      title: "Newsletter",
      description: "Get debate tips, new topics, and updates delivered to your inbox.",
      placeholder: "Enter your email",
      button: "Subscribe",
    },
    copyright: "© 2026 Thinkfy. All rights reserved.",
  },
};

const vi: LandingV3Copy = {
  nav: {
    links: [
      { label: "Tính năng", href: "#features" },
      { label: "Cách hoạt động", href: "#journey" },
      { label: "Câu chuyện", href: "#stories" },
      { label: "Gói đăng kí", href: "#pricing" },
    ],
    login: "Đăng nhập",
    signup: "Bắt đầu ngay",
    dashboard: "Vào Dashboard",
  },
  hero: {
    line1: "Cất giọng tự tin.",
    line2: { text: "Thắng cả khán phòng.", highlight: "Thắng" },
    description:
      "Huấn luyện debate bằng AI — biến học sinh thành những người nói tự tin và thuyết phục.",
    primaryCta: "Bắt đầu miễn phí",
    primaryCtaLoggedIn: "Vào Dashboard",
    secondaryCta: "Xem cách hoạt động",
    proBubble: "Luận điểm chắc!",
    conBubble: "Phản biện tới…",
    forLabel: "ỦNG HỘ",
    againstLabel: "PHẢN ĐỐI",
    lovedBy: { prefix: "Được", count: "10,000+", suffix: "debater trẻ yêu thích" },
  },
  proof: [
    { icon: "mic", value: { target: 120, suffix: "k+" }, label: "bài nói đã phân tích" },
    { icon: "users", value: { target: 10000, suffix: "+" }, label: "học sinh đang luyện" },
    { icon: "bolt", value: { static: "24/7" }, label: "AI phản hồi tức thì" },
    { icon: "trophy", value: { target: 95, suffix: "%" }, label: "tự tin hơn khi nói" },
  ],
  features: {
    eyebrow: "TẤT CẢ TRONG MỘT",
    title: { text: "Luyện tập như một nhà vô địch", highlight: "vô địch" },
    aside: "Bốn công cụ. Một mục tiêu: giúp bạn làm chủ sân khấu.",
    coach: {
      title: "AI Practice Coach",
      caption: "Nói, nhận điểm, tiến bộ — coach của bạn không bao giờ ngủ.",
      bubbleA: "Phản biện tốt lắm! Chuỗi logic rất vững.",
      bubbleB: "Lần sau thử thêm ví dụ cụ thể nhé.",
    },
    topics: {
      title: "500+ chủ đề debate",
      caption: "Từ đồng phục đến AI — luôn có thứ để tranh biện.",
      badge: "500+",
      chips: ["Đồng phục", "Mạng xã hội", "AI trong lớp", "Cấm bài tập", "Du hành vũ trụ"],
    },
    live: {
      title: "Debate trực tiếp",
      caption: "Đối đầu đối thủ thật theo thời gian thực.",
      liveLabel: "LIVE",
      you: "Bạn",
      rival: "Minh",
    },
    analytics: {
      title: "Phân tích tiến bộ",
      caption: "Nhìn kỹ năng tăng theo từng tuần.",
      weeks: ["T1", "T2", "T3", "T4", "T5"],
    },
  },
  showcase: {
    eyebrow: "FEEDBACK THÔNG MINH",
    title: { text: "Feedback thực sự giúp bạn giỏi lên", highlight: "giỏi lên" },
    para1: "Mỗi bài nói được chấm về độ rõ ràng, logic và trình bày — chỉ trong vài giây.",
    para2: "Không khen chung chung. Bạn biết chính xác câu nào cần sửa, và sửa thế nào.",
    link: "Xem báo cáo mẫu",
    panel: {
      title: "Luyện tập · Có nên cấm bài tập về nhà?",
      timer: "4:32",
      transcript: [
        { text: "Bài tập về nhà chiếm mất thời gian nghỉ ngơi và sở thích thật sự của học sinh.", tone: "good", tag: "Luận điểm chắc" },
        { text: "Hầu hết giáo viên mình biết đều đồng ý rằng ít mà chất sẽ tốt hơn." },
        { text: "Phần Lan giao rất ít bài tập nhưng vẫn đứng đầu bảng xếp hạng toàn cầu.", tone: "fix", tag: "Cần dẫn chứng" },
        { text: "Vậy nên bỏ bài tập không phải lười — đó là cách học hiện đại." },
      ],
      scoreLabel: "Tổng điểm",
      score: 82,
      meters: [
        { label: "Rõ ràng", value: 86 },
        { label: "Logic", value: 78 },
        { label: "Trình bày", value: 84 },
      ],
      coachNote: "Phản biện của bạn tốt hơn 12% so với tuần trước!",
    },
  },
  journey: {
    title: { text: "Hành trình đến trận chung kết", highlight: "Hành trình" },
    description: "Lộ trình dẫn lối từ bài nói đầu tiên đến những trận debate vô địch.",
    waypoints: [
      { icon: "book", label: "Học nền tảng" },
      { icon: "mic", label: "Luyện với AI" },
      { icon: "swords", label: "Thi đấu trực tiếp" },
      { icon: "trophy", label: "Vô địch chung kết" },
    ],
  },
  gamification: {
    eyebrow: "GIỮ LỬA MỖI NGÀY",
    title: { text: "Luyện tập mà như đang chơi", highlight: "chơi" },
    description:
      "Chuỗi streak, điểm XP và giải đấu tuần biến việc luyện nói thành thói quen bạn thực sự giữ được.",
    cta: "Khám phá ứng dụng",
    streak: { title: "Chuỗi 12 ngày!", caption: "Giữ lửa nhé" },
    league: {
      title: "Giải đấu Vàng",
      rows: [
        { name: "Minh Anh", xp: "980 XP" },
        { name: "Bảo", xp: "870 XP" },
        { name: "Bạn", xp: "845 XP", you: true },
      ],
    },
    xp: { burst: "+40 XP", level: "Cấp 8" },
  },
  testimonials: {
    eyebrow: "ĐƯỢC HỌC SINH TIN YÊU",
    title: { text: "Debater khen không ngớt lời", highlight: "không ngớt" },
    items: [
      {
        quote:
          "Thinkfy đưa mình vào bán kết quốc gia. AI bắt được cả những lỗi mà coach của mình bỏ sót.",
        name: "Linh",
        role: "Lớp 11 · Hà Nội",
        initials: "L",
      },
      {
        quote: "Trước đây mình đứng hình mỗi lần lên sân khấu. Giờ mình xung phong nói trước.",
        name: "Đức",
        role: "Lớp 10 · Đà Nẵng",
        initials: "Đ",
      },
      {
        quote: "CLB debate của trường tăng gấp đôi thành viên từ khi dùng Thinkfy.",
        name: "Cô Hương",
        role: "Cố vấn CLB · TP.HCM",
        initials: "H",
      },
      {
        quote: "Chuỗi streak khiến mình luyện đều mỗi ngày. Đã 47 ngày rồi!",
        name: "Khánh",
        role: "Lớp 12 · Huế",
        initials: "K",
        flame: true,
      },
    ],
  },
  cta: {
    title: "Sẵn sàng cất tiếng nói?",
    description: "Cùng 10,000+ học sinh trở thành người nói không sợ sân khấu — miễn phí.",
    button: "Bắt đầu debate miễn phí",
    buttonLoggedIn: "Vào Dashboard",
    note: "Không cần thẻ tín dụng",
  },
  footer: {
    brandDescription:
      "Nền tảng học debate bằng AI giúp bạn tư duy sắc bén, lập luận rõ ràng, và tự tin hơn khi tranh biện.",
    columns: [
      {
        title: "Sản phẩm",
        links: [
          { label: "Tính năng", href: "#features" },
          { label: "Luyện tập", href: "/practice" },
          { label: "Debate trực tiếp", href: "/practice?track=debate&mode=full&difficulty=medium" },
          { label: "Gói đăng kí", href: "#pricing" },
        ],
      },
      {
        title: "Tài liệu",
        links: [
          { label: "Blog", href: "#" },
          { label: "Chủ đề debate", href: "/practice" },
          { label: "Trung tâm trợ giúp", href: "#" },
          { label: "Cộng đồng", href: "#" },
        ],
      },
      {
        title: "Công ty",
        links: [
          { label: "Về chúng tôi", href: "#about" },
          { label: "Tuyển dụng", href: "#" },
          { label: "Chính sách bảo mật", href: "#" },
          { label: "Điều khoản dịch vụ", href: "#" },
        ],
      },
    ],
    newsletter: {
      title: "Bản tin",
      description: "Nhận tips debate, topic mới và cập nhật sản phẩm qua email.",
      placeholder: "Nhập email của bạn",
      button: "Đăng ký",
    },
    copyright: "© 2026 Thinkfy. Tất cả quyền được bảo lưu.",
  },
};

const copies: Record<LandingLocale, LandingV3Copy> = { en, vi };

export function getLandingV3Copy(locale: string): LandingV3Copy {
  return locale === "en" ? copies.en : copies.vi;
}
