import type {
  MarketingLocale,
  MarketingPageCopy,
  MarketingProduct,
} from "./types";

const shared = {
  en: {
    navigation: {
      productLabel: "Choose a Thinkfy product",
      debate: "Debate",
      ielts: "IELTS",
      howItWorks: "How it works",
      features: "Features",
      audiences: "For learners & teachers",
      faq: "FAQ",
      signIn: "Sign in",
    },
    footer: {
      product: "Products",
      guidesLabel: "Guides",
      legal: "Legal",
      privacy: "Privacy",
      terms: "Terms",
      cookies: "Cookies",
      copyright: "© 2026 Thinkfy. All rights reserved.",
    },
  },
  vi: {
    navigation: {
      productLabel: "Chọn sản phẩm Thinkfy",
      debate: "Tranh biện",
      ielts: "IELTS",
      howItWorks: "Cách hoạt động",
      features: "Tính năng",
      audiences: "Cho học viên & giáo viên",
      faq: "Câu hỏi thường gặp",
      signIn: "Đăng nhập",
    },
    footer: {
      product: "Sản phẩm",
      guidesLabel: "Hướng dẫn",
      legal: "Pháp lý",
      privacy: "Quyền riêng tư",
      terms: "Điều khoản",
      cookies: "Cookie",
      copyright: "© 2026 Thinkfy. Bảo lưu mọi quyền.",
    },
  },
} as const;

const debate: Record<MarketingLocale, MarketingPageCopy> = {
  en: {
    product: "debate",
    productName: "Thinkfy Debate",
    navigation: shared.en.navigation,
    hero: {
      eyebrow: "English argumentation, built through practice",
      title: "Turn ideas into arguments people can follow.",
      description:
        "Practice structured delivery, receive specific AI feedback, and build the reasoning habits that make competition speeches clearer and more persuasive.",
      primary: "Start practicing",
      primaryLoggedIn: "Open Debate",
      teacher: "Bring Thinkfy to your class",
      note: "Focused English practice for students, clubs, and competition teams.",
    },
    preview: {
      eyebrow: "TODAY'S PRACTICE",
      title: "Build a rebuttal that changes the round",
      subtitle: "7-minute drill · Intermediate",
      action: "Start practice",
      metricLabel: "Structure",
      metricValue: "4 / 5",
      secondaryLabel: "Next focus",
      secondaryValue: "Evidence link",
      feedbackTitle: "Your claim is clear. Make the impact explicit.",
      feedbackBody:
        "Connect the funding trade-off to what students lose, then weigh that impact against the opposing benefit.",
      steps: [
        { label: "Claim", value: "Clear" },
        { label: "Reasoning", value: "Developing" },
        { label: "Impact", value: "Next" },
      ],
    },
    process: {
      eyebrow: "A repeatable improvement loop",
      title: "Practice. Understand the feedback. Try again with purpose.",
      description:
        "Thinkfy keeps the next move visible, so students spend less time guessing what to improve.",
      steps: [
        {
          title: "Practice",
          body: "Respond to a focused motion or competition scenario.",
        },
        {
          title: "Get feedback",
          body: "See specific notes on logic, evidence, clarity, and delivery.",
        },
        {
          title: "Improve",
          body: "Apply one clear recommendation in the next drill.",
        },
      ],
    },
    features: {
      eyebrow: "Built for deliberate debate practice",
      title: "The tools around the round—not distractions around the tools.",
      description:
        "Each surface supports a real learning action, from building a case to reviewing a completed speech.",
      items: [
        {
          title: "Structured speaking drills",
          body: "Practice claims, rebuttals, weighing, and delivery in focused English tasks.",
          icon: "microphone",
          detail: "One skill at a time",
          size: "wide",
        },
        {
          title: "Actionable AI feedback",
          body: "Review what worked, what needs evidence, and the next sentence to strengthen.",
          icon: "target",
          detail: "Specific, not generic",
          size: "standard",
        },
        {
          title: "Competition rehearsal",
          body: "Prepare under realistic time pressure without turning practice into spectacle.",
          icon: "timer",
          detail: "Timed when it matters",
          size: "standard",
        },
        {
          title: "Progress by debate skill",
          body: "Track clarity, logic, evidence, rebuttal, and delivery as separate signals.",
          icon: "chart",
          detail: "Skill-level visibility",
          size: "wide",
        },
      ],
    },
    productProof: {
      eyebrow: "Inside a feedback review",
      title: "Students can see the argument—not just a score.",
      description:
        "Feedback is attached to the reasoning move it describes, with a clear distinction between strengths and the next improvement.",
      labels: ["Claim", "Evidence", "Reasoning", "Impact"],
      insightTitle: "Next improvement",
      insightBody:
        "Explain why the lost classroom time matters more than the short-term convenience your opponent describes.",
      status: "Ready to retry",
    },
    audiences: {
      eyebrow: "One practice system, two clear views",
      title: "Personal for students. Operational for teachers.",
      studentTab: "Students",
      teacherTab: "Teachers",
      student: {
        title: "Know exactly what to practice next",
        body: "Move from a focused drill to feedback and a visible next action without a maze of dashboards.",
        points: [
          "Daily practice focus",
          "Skill-by-skill feedback",
          "Competition-ready rehearsal",
        ],
        cta: "Start student practice",
      },
      teacher: {
        title: "Guide a cohort without grading every draft alone",
        body: "Assign practice, review shared patterns, and focus teacher attention where students need it most.",
        points: [
          "Class practice plans",
          "Review queues",
          "Student progress context",
        ],
        cta: "Request teacher access",
      },
    },
    proof: {
      eyebrow: "Product proof, not marketing theatre",
      title: "The learning evidence stays visible.",
      description:
        "Thinkfy shows where feedback came from, what the learner did, and which action follows.",
      items: [
        {
          label: "Feedback",
          value: "Criterion-linked",
          body: "Notes connect to observable argument and delivery choices.",
        },
        {
          label: "Progress",
          value: "Skill-specific",
          body: "A single total never hides which debate move needs work.",
        },
        {
          label: "Next action",
          value: "Practice-ready",
          body: "Every review ends with a concrete drill or retry.",
        },
      ],
    },
    faq: {
      eyebrow: "Questions before the first round",
      title: "A clear start for students and schools.",
      items: [
        {
          question: "Is Thinkfy only for competition debaters?",
          answer:
            "No. Students can use focused English argumentation practice before joining a team, while experienced debaters can rehearse competition skills.",
        },
        {
          question: "Does AI feedback replace a coach or teacher?",
          answer:
            "No. It supports frequent practice and surfaces patterns. Teachers and coaches retain the human judgment needed for curriculum, context, and competition strategy.",
        },
        {
          question: "What does a student practice?",
          answer:
            "Students work on claims, reasoning, evidence, rebuttal, weighing, and structured delivery through focused speaking and writing tasks.",
        },
        {
          question: "Can a teacher use Thinkfy with a class?",
          answer:
            "Yes. Contact Thinkfy for teacher access and class setup options.",
        },
      ],
    },
    finalCta: {
      title: "Build the next argument with a clearer next step.",
      body: "Start a focused Debate practice plan, or talk with Thinkfy about a teacher workspace.",
      student: "Start practicing",
      teacher: "Request teacher access",
    },
    footer: {
      ...shared.en.footer,
      description:
        "Focused English argumentation and debate practice for learners and teachers.",
      guides: [
        { label: "Debate practice loop", path: "/guides/debate-practice-loop" },
        { label: "How AI feedback works", path: "/guides/ai-feedback-method" },
        { label: "Teacher workflows", path: "/guides/teacher-workflows" },
      ],
    },
    teacherSubject: "Thinkfy Debate teacher access",
  },
  vi: {
    product: "debate",
    productName: "Thinkfy Tranh biện",
    navigation: shared.vi.navigation,
    hero: {
      eyebrow: "Rèn lập luận tiếng Anh qua thực hành",
      title: "Biến ý tưởng thành lập luận mà người nghe dễ theo dõi.",
      description:
        "Luyện trình bày có cấu trúc, nhận phản hồi AI cụ thể và xây dựng thói quen tư duy giúp bài nói thi đấu rõ ràng, thuyết phục hơn.",
      primary: "Bắt đầu luyện tập",
      primaryLoggedIn: "Mở Tranh biện",
      teacher: "Đưa Thinkfy vào lớp học",
      note: "Luyện tiếng Anh tập trung cho học viên, câu lạc bộ và đội thi đấu.",
    },
    preview: {
      eyebrow: "BÀI LUYỆN HÔM NAY",
      title: "Xây dựng phản biện có thể thay đổi vòng đấu",
      subtitle: "Bài luyện 7 phút · Trung cấp",
      action: "Bắt đầu luyện",
      metricLabel: "Cấu trúc",
      metricValue: "4 / 5",
      secondaryLabel: "Trọng tâm tiếp theo",
      secondaryValue: "Liên kết bằng chứng",
      feedbackTitle: "Luận điểm rõ. Hãy nêu tác động cụ thể.",
      feedbackBody:
        "Liên kết sự đánh đổi về ngân sách với điều học sinh mất đi, rồi cân tác động đó với lợi ích của phe đối lập.",
      steps: [
        { label: "Luận điểm", value: "Rõ" },
        { label: "Lập luận", value: "Đang phát triển" },
        { label: "Tác động", value: "Tiếp theo" },
      ],
    },
    process: {
      eyebrow: "Vòng lặp tiến bộ có thể lặp lại",
      title: "Luyện tập. Hiểu phản hồi. Thử lại có mục đích.",
      description:
        "Thinkfy luôn làm rõ bước tiếp theo để học viên không phải đoán mình nên cải thiện gì.",
      steps: [
        {
          title: "Luyện tập",
          body: "Trả lời một kiến nghị hoặc tình huống thi đấu tập trung.",
        },
        {
          title: "Nhận phản hồi",
          body: "Xem ghi chú cụ thể về logic, bằng chứng, độ rõ và cách trình bày.",
        },
        {
          title: "Cải thiện",
          body: "Áp dụng một khuyến nghị rõ ràng trong bài luyện kế tiếp.",
        },
      ],
    },
    features: {
      eyebrow: "Được xây cho việc luyện tranh biện có chủ đích",
      title: "Công cụ phục vụ vòng đấu, không tạo thêm xao nhãng.",
      description:
        "Mỗi bề mặt hỗ trợ một hành động học thật, từ xây dựng lập luận đến xem lại bài nói.",
      items: [
        {
          title: "Bài luyện nói có cấu trúc",
          body: "Luyện luận điểm, phản biện, cân tác động và trình bày trong các nhiệm vụ tiếng Anh tập trung.",
          icon: "microphone",
          detail: "Mỗi lần một kỹ năng",
          size: "wide",
        },
        {
          title: "Phản hồi AI có thể hành động",
          body: "Xem điểm mạnh, chỗ cần bằng chứng và câu tiếp theo nên cải thiện.",
          icon: "target",
          detail: "Cụ thể, không chung chung",
          size: "standard",
        },
        {
          title: "Diễn tập thi đấu",
          body: "Chuẩn bị với áp lực thời gian thực tế mà không biến việc luyện thành màn trình diễn.",
          icon: "timer",
          detail: "Bấm giờ đúng lúc",
          size: "standard",
        },
        {
          title: "Tiến bộ theo kỹ năng tranh biện",
          body: "Theo dõi riêng độ rõ, logic, bằng chứng, phản biện và trình bày.",
          icon: "chart",
          detail: "Nhìn rõ từng kỹ năng",
          size: "wide",
        },
      ],
    },
    productProof: {
      eyebrow: "Bên trong một lượt xem phản hồi",
      title: "Học viên nhìn thấy lập luận, không chỉ một con số.",
      description:
        "Phản hồi gắn với bước lập luận cụ thể và phân biệt rõ điểm mạnh với phần cần cải thiện.",
      labels: ["Luận điểm", "Bằng chứng", "Lập luận", "Tác động"],
      insightTitle: "Cải thiện tiếp theo",
      insightBody:
        "Giải thích vì sao thời gian học bị mất quan trọng hơn tiện ích ngắn hạn mà đối thủ nêu.",
      status: "Sẵn sàng làm lại",
    },
    audiences: {
      eyebrow: "Một hệ thống luyện tập, hai góc nhìn rõ ràng",
      title: "Cá nhân cho học viên. Vận hành cho giáo viên.",
      studentTab: "Học viên",
      teacherTab: "Giáo viên",
      student: {
        title: "Biết chính xác nên luyện gì tiếp theo",
        body: "Đi từ bài luyện tập trung đến phản hồi và hành động tiếp theo mà không lạc trong quá nhiều bảng điều khiển.",
        points: [
          "Trọng tâm luyện hằng ngày",
          "Phản hồi theo kỹ năng",
          "Diễn tập sẵn sàng thi đấu",
        ],
        cta: "Bắt đầu luyện cho học viên",
      },
      teacher: {
        title: "Hướng dẫn cả nhóm mà không phải chấm mọi bản nháp một mình",
        body: "Giao bài luyện, xem mẫu chung và tập trung sự chú ý của giáo viên đúng nơi cần thiết.",
        points: [
          "Kế hoạch luyện cho lớp",
          "Hàng đợi cần xem",
          "Bối cảnh tiến bộ của học viên",
        ],
        cta: "Yêu cầu quyền giáo viên",
      },
    },
    proof: {
      eyebrow: "Bằng chứng sản phẩm, không phải màn diễn marketing",
      title: "Bằng chứng học tập luôn được hiển thị.",
      description:
        "Thinkfy cho biết phản hồi đến từ đâu, học viên đã làm gì và hành động nào tiếp theo.",
      items: [
        {
          label: "Phản hồi",
          value: "Gắn tiêu chí",
          body: "Ghi chú liên kết với lựa chọn lập luận và trình bày quan sát được.",
        },
        {
          label: "Tiến bộ",
          value: "Theo kỹ năng",
          body: "Một điểm tổng không che mất kỹ năng tranh biện cần luyện.",
        },
        {
          label: "Hành động tiếp",
          value: "Sẵn sàng luyện",
          body: "Mỗi lượt xem kết thúc bằng một bài luyện hoặc lần thử lại cụ thể.",
        },
      ],
    },
    faq: {
      eyebrow: "Câu hỏi trước vòng đấu đầu tiên",
      title: "Khởi đầu rõ ràng cho học viên và trường học.",
      items: [
        {
          question: "Thinkfy chỉ dành cho người thi tranh biện?",
          answer:
            "Không. Học viên có thể luyện lập luận tiếng Anh trước khi tham gia đội; người có kinh nghiệm có thể diễn tập kỹ năng thi đấu.",
        },
        {
          question: "Phản hồi AI có thay thế huấn luyện viên hoặc giáo viên?",
          answer:
            "Không. AI hỗ trợ luyện thường xuyên và nêu mẫu cần chú ý; giáo viên vẫn giữ vai trò phán đoán về chương trình, bối cảnh và chiến lược.",
        },
        {
          question: "Học viên luyện những gì?",
          answer:
            "Luận điểm, lập luận, bằng chứng, phản biện, cân tác động và trình bày có cấu trúc qua bài nói và viết tập trung.",
        },
        {
          question: "Giáo viên có thể dùng Thinkfy với lớp học?",
          answer:
            "Có. Hãy liên hệ Thinkfy để trao đổi về quyền giáo viên và thiết lập lớp.",
        },
      ],
    },
    finalCta: {
      title: "Xây dựng lập luận tiếp theo với bước đi rõ ràng hơn.",
      body: "Bắt đầu lộ trình luyện Tranh biện hoặc trao đổi với Thinkfy về không gian giáo viên.",
      student: "Bắt đầu luyện tập",
      teacher: "Yêu cầu quyền giáo viên",
    },
    footer: {
      ...shared.vi.footer,
      description:
        "Luyện lập luận và tranh biện tiếng Anh tập trung cho học viên và giáo viên.",
      guides: [
        {
          label: "Vòng luyện tập tranh biện",
          path: "/guides/debate-practice-loop",
        },
        {
          label: "Cách phản hồi AI hoạt động",
          path: "/guides/ai-feedback-method",
        },
        {
          label: "Quy trình dành cho giáo viên",
          path: "/guides/teacher-workflows",
        },
      ],
    },
    teacherSubject: "Quyền giáo viên Thinkfy Tranh biện",
  },
};

const ielts: Record<MarketingLocale, MarketingPageCopy> = {
  en: {
    product: "ielts",
    productName: "Thinkfy IELTS",
    navigation: shared.en.navigation,
    hero: {
      eyebrow: "IELTS preparation with an honest next step",
      title: "Build every IELTS skill without blurring practice and test day.",
      description:
        "Follow a clear four-skill path, practice with useful feedback, and use realistic rehearsal modes with their limits explained before you begin.",
      primary: "Build my IELTS plan",
      primaryLoggedIn: "Open IELTS",
      teacher: "Use Thinkfy with learners",
      note: "Academic and General Training paths stay distinct where Reading and Writing differ.",
    },
    preview: {
      eyebrow: "TODAY'S IELTS PLAN",
      title: "Strengthen coherence in Writing Task 2",
      subtitle: "18-minute practice · Writing",
      action: "Continue practice",
      metricLabel: "Current estimate",
      metricValue: "Band 6.0",
      secondaryLabel: "Target",
      secondaryValue: "Band 6.5",
      feedbackTitle:
        "Your position is clear. Paragraph links need more control.",
      feedbackBody:
        "Use the final sentence of each paragraph to close the current reason before introducing the next one.",
      steps: [
        { label: "Task response", value: "6.0" },
        { label: "Coherence", value: "5.5" },
        { label: "Lexical", value: "6.0" },
      ],
    },
    process: {
      eyebrow: "A four-skill improvement loop",
      title: "Practice the skill. Review the evidence. Plan the next session.",
      description:
        "Thinkfy keeps practice feedback separate from the stricter conditions of an Exam Simulation.",
      steps: [
        {
          title: "Practice",
          body: "Work on Listening, Reading, Writing, or Speaking with the right task format.",
        },
        {
          title: "Review",
          body: "Understand criterion-level feedback, confidence, and limitations.",
        },
        {
          title: "Improve",
          body: "Continue with the skill and task most relevant to your target.",
        },
      ],
    },
    features: {
      eyebrow: "A complete path without false equivalence",
      title: "Four skills, with the right practice mode for each one.",
      description:
        "Thinkfy labels practice, simulation, and AI rehearsal clearly so learners know what every result means.",
      items: [
        {
          title: "Listening, Reading & Writing Simulation",
          body: "Rehearse L/R/W with timing, section navigation, review, and final submission rules.",
          icon: "timer",
          detail: "Exam Simulation · L/R/W",
          size: "wide",
        },
        {
          title: "AI Speaking Rehearsal",
          body: "Practice spoken responses and receive provisional AI feedback with visible confidence limits.",
          icon: "microphone",
          detail: "Not an official score",
          size: "standard",
        },
        {
          title: "Criterion-level feedback",
          body: "See the four relevant IELTS criteria and why each provisional estimate was produced.",
          icon: "scales",
          detail: "Rationale stays visible",
          size: "standard",
        },
        {
          title: "Adaptive study path",
          body: "Connect the target band, test date, recent evidence, and available study time to one next action.",
          icon: "target",
          detail: "One useful next step",
          size: "wide",
        },
      ],
    },
    productProof: {
      eyebrow: "Inside an IELTS feedback review",
      title: "A band estimate should explain itself.",
      description:
        "Criterion evidence, source status, confidence, and known limits stay beside the recommendation.",
      labels: ["Task response", "Coherence", "Lexical resource", "Grammar"],
      insightTitle: "Recommended next practice",
      insightBody:
        "Rewrite one body paragraph with a clearer topic sentence and a closing link to the essay position.",
      status: "AI provisional · confidence shown",
    },
    audiences: {
      eyebrow: "Personal preparation and teacher oversight",
      title: "A clear learner plan. A review-ready teacher workspace.",
      studentTab: "Learners",
      teacherTab: "Teachers",
      student: {
        title: "Keep the target, evidence, and next task together",
        body: "Move from today’s practice to criterion feedback and the next study session without confusing rehearsal with an official result.",
        points: [
          "Four-skill study path",
          "Practice and Simulation kept distinct",
          "Provisional AI labels and limits",
        ],
        cta: "Build my IELTS plan",
      },
      teacher: {
        title: "Review the work that needs human judgment",
        body: "See cohort progress, pending reviews, assignments, and teacher-published feedback in one operational workspace.",
        points: [
          "Unified review queue",
          "Teacher-published scores",
          "Class plan and materials",
        ],
        cta: "Request teacher access",
      },
    },
    proof: {
      eyebrow: "Evidence before confidence",
      title: "Every IELTS result states what it is—and what it is not.",
      description:
        "Thinkfy separates teacher-confirmed outcomes from provisional AI estimates and keeps limitations readable.",
      items: [
        {
          label: "Simulation",
          value: "L / R / W",
          body: "Timed Exam Simulation covers Listening, Reading, and Writing only.",
        },
        {
          label: "Speaking",
          value: "AI rehearsal",
          body: "Speaking feedback is provisional and is not an official IELTS score.",
        },
        {
          label: "Authority",
          value: "Status visible",
          body: "Teacher-published and AI-provisional results are never presented as equivalent.",
        },
      ],
    },
    faq: {
      eyebrow: "Know the mode before you begin",
      title: "Honest answers about IELTS practice.",
      items: [
        {
          question: "Is Thinkfy an official IELTS test provider?",
          answer:
            "No. Thinkfy is a preparation product. Practice, simulations, and AI feedback do not replace an official IELTS test or score.",
        },
        {
          question: "What is included in Exam Simulation?",
          answer:
            "The full simulation experience covers Listening, Reading, and Writing. Speaking remains a separate rehearsal experience.",
        },
        {
          question: "Is the Speaking Rehearsal score official?",
          answer:
            "No. Speaking feedback is AI-generated and provisional. Confidence and limitations are shown, especially when acoustic evidence is limited.",
        },
        {
          question: "Can I prepare for Academic and General Training?",
          answer:
            "Yes. Listening and Speaking share a format, while the Reading and Writing path changes for Academic or General Training.",
        },
      ],
    },
    finalCta: {
      title: "Start with the IELTS task that moves your plan forward.",
      body: "Build a focused learner path, or talk with Thinkfy about a teacher workspace.",
      student: "Build my IELTS plan",
      teacher: "Request teacher access",
    },
    footer: {
      ...shared.en.footer,
      description:
        "Honest IELTS preparation across Listening, Reading, Writing, and Speaking.",
      guides: [
        {
          label: "IELTS four-skill plan",
          path: "/guides/ielts-four-skill-plan",
        },
        { label: "How AI feedback works", path: "/guides/ai-feedback-method" },
        { label: "Teacher workflows", path: "/guides/teacher-workflows" },
      ],
    },
    teacherSubject: "Thinkfy IELTS teacher access",
  },
  vi: {
    product: "ielts",
    productName: "Thinkfy IELTS",
    navigation: shared.vi.navigation,
    hero: {
      eyebrow: "Luyện IELTS với bước tiếp theo trung thực",
      title:
        "Phát triển mọi kỹ năng IELTS mà không đánh đồng luyện tập với ngày thi.",
      description:
        "Theo lộ trình bốn kỹ năng rõ ràng, luyện với phản hồi hữu ích và dùng chế độ diễn tập thực tế với giới hạn được giải thích trước khi bắt đầu.",
      primary: "Xây dựng lộ trình IELTS",
      primaryLoggedIn: "Mở IELTS",
      teacher: "Dùng Thinkfy với học viên",
      note: "Lộ trình Academic và General Training tách biệt ở phần Đọc và Viết.",
    },
    preview: {
      eyebrow: "KẾ HOẠCH IELTS HÔM NAY",
      title: "Cải thiện tính mạch lạc trong Writing Task 2",
      subtitle: "Bài luyện 18 phút · Viết",
      action: "Tiếp tục luyện",
      metricLabel: "Ước tính hiện tại",
      metricValue: "Band 6.0",
      secondaryLabel: "Mục tiêu",
      secondaryValue: "Band 6.5",
      feedbackTitle: "Lập trường rõ. Liên kết đoạn cần kiểm soát tốt hơn.",
      feedbackBody:
        "Dùng câu cuối mỗi đoạn để khép lại lý do hiện tại trước khi mở sang lý do tiếp theo.",
      steps: [
        { label: "Đáp ứng đề", value: "6.0" },
        { label: "Mạch lạc", value: "5.5" },
        { label: "Từ vựng", value: "6.0" },
      ],
    },
    process: {
      eyebrow: "Vòng lặp tiến bộ bốn kỹ năng",
      title: "Luyện kỹ năng. Xem bằng chứng. Lập kế hoạch buổi tiếp theo.",
      description:
        "Thinkfy giữ phản hồi luyện tập tách biệt với điều kiện nghiêm ngặt hơn của Exam Simulation.",
      steps: [
        {
          title: "Luyện tập",
          body: "Làm bài Nghe, Đọc, Viết hoặc Nói với đúng định dạng nhiệm vụ.",
        },
        {
          title: "Xem lại",
          body: "Hiểu phản hồi theo tiêu chí, độ tin cậy và giới hạn.",
        },
        {
          title: "Cải thiện",
          body: "Tiếp tục với kỹ năng và nhiệm vụ phù hợp nhất với mục tiêu.",
        },
      ],
    },
    features: {
      eyebrow: "Lộ trình đầy đủ, không đánh đồng sai",
      title: "Bốn kỹ năng, với chế độ luyện phù hợp cho từng kỹ năng.",
      description:
        "Thinkfy ghi nhãn rõ luyện tập, mô phỏng và diễn tập AI để học viên hiểu mỗi kết quả có ý nghĩa gì.",
      items: [
        {
          title: "Mô phỏng Nghe, Đọc & Viết",
          body: "Diễn tập L/R/W với bấm giờ, điều hướng phần thi, xem lại và quy tắc nộp bài cuối.",
          icon: "timer",
          detail: "Exam Simulation · L/R/W",
          size: "wide",
        },
        {
          title: "Diễn tập Nói với AI",
          body: "Luyện trả lời nói và nhận phản hồi AI tạm thời với giới hạn độ tin cậy hiển thị rõ.",
          icon: "microphone",
          detail: "Không phải điểm chính thức",
          size: "standard",
        },
        {
          title: "Phản hồi theo tiêu chí",
          body: "Xem bốn tiêu chí IELTS liên quan và lý do tạo ra từng ước tính tạm thời.",
          icon: "scales",
          detail: "Luôn hiển thị lý do",
          size: "standard",
        },
        {
          title: "Lộ trình học thích ứng",
          body: "Kết nối band mục tiêu, ngày thi, bằng chứng gần đây và thời gian học với một hành động tiếp theo.",
          icon: "target",
          detail: "Một bước tiếp theo hữu ích",
          size: "wide",
        },
      ],
    },
    productProof: {
      eyebrow: "Bên trong lượt xem phản hồi IELTS",
      title: "Ước tính band cần tự giải thích được.",
      description:
        "Bằng chứng tiêu chí, trạng thái nguồn, độ tin cậy và giới hạn đã biết nằm cạnh khuyến nghị.",
      labels: ["Đáp ứng đề", "Mạch lạc", "Từ vựng", "Ngữ pháp"],
      insightTitle: "Bài luyện tiếp theo được đề xuất",
      insightBody:
        "Viết lại một đoạn thân bài với câu chủ đề rõ hơn và câu kết nối lại với lập trường bài viết.",
      status: "AI tạm thời · có độ tin cậy",
    },
    audiences: {
      eyebrow: "Chuẩn bị cá nhân và giám sát của giáo viên",
      title:
        "Lộ trình rõ cho học viên. Không gian sẵn sàng xem bài cho giáo viên.",
      studentTab: "Học viên",
      teacherTab: "Giáo viên",
      student: {
        title: "Giữ mục tiêu, bằng chứng và nhiệm vụ tiếp theo cùng một chỗ",
        body: "Đi từ bài luyện hôm nay đến phản hồi tiêu chí và buổi học tiếp theo mà không nhầm diễn tập với kết quả chính thức.",
        points: [
          "Lộ trình bốn kỹ năng",
          "Tách biệt Luyện tập và Mô phỏng",
          "Nhãn AI tạm thời và giới hạn",
        ],
        cta: "Xây dựng lộ trình IELTS",
      },
      teacher: {
        title: "Xem những bài cần phán đoán của con người",
        body: "Xem tiến bộ nhóm, bài chờ duyệt, bài tập và phản hồi do giáo viên công bố trong một không gian vận hành.",
        points: [
          "Hàng đợi xem bài thống nhất",
          "Điểm do giáo viên công bố",
          "Kế hoạch lớp và tài liệu",
        ],
        cta: "Yêu cầu quyền giáo viên",
      },
    },
    proof: {
      eyebrow: "Bằng chứng trước sự tự tin",
      title: "Mỗi kết quả IELTS đều nói rõ nó là gì và không phải gì.",
      description:
        "Thinkfy tách kết quả giáo viên xác nhận khỏi ước tính AI tạm thời và giữ giới hạn dễ đọc.",
      items: [
        {
          label: "Mô phỏng",
          value: "L / R / W",
          body: "Exam Simulation có bấm giờ chỉ bao gồm Nghe, Đọc và Viết.",
        },
        {
          label: "Nói",
          value: "Diễn tập AI",
          body: "Phản hồi Nói là tạm thời và không phải điểm IELTS chính thức.",
        },
        {
          label: "Thẩm quyền",
          value: "Hiện rõ trạng thái",
          body: "Kết quả giáo viên công bố và AI tạm thời không bao giờ được trình bày như tương đương.",
        },
      ],
    },
    faq: {
      eyebrow: "Hiểu chế độ trước khi bắt đầu",
      title: "Câu trả lời trung thực về luyện IELTS.",
      items: [
        {
          question: "Thinkfy có phải đơn vị tổ chức IELTS chính thức?",
          answer:
            "Không. Thinkfy là sản phẩm luyện thi. Bài luyện, mô phỏng và phản hồi AI không thay thế kỳ thi hoặc điểm IELTS chính thức.",
        },
        {
          question: "Exam Simulation gồm những gì?",
          answer:
            "Trải nghiệm mô phỏng đầy đủ bao gồm Nghe, Đọc và Viết. Nói là trải nghiệm diễn tập riêng.",
        },
        {
          question: "Điểm Diễn tập Nói có chính thức không?",
          answer:
            "Không. Phản hồi Nói do AI tạo và mang tính tạm thời. Độ tin cậy và giới hạn được hiển thị, đặc biệt khi bằng chứng âm học hạn chế.",
        },
        {
          question: "Tôi có thể luyện Academic và General Training?",
          answer:
            "Có. Nghe và Nói có cùng định dạng; lộ trình Đọc và Viết thay đổi theo Academic hoặc General Training.",
        },
      ],
    },
    finalCta: {
      title: "Bắt đầu với nhiệm vụ IELTS giúp lộ trình tiến về phía trước.",
      body: "Xây dựng lộ trình học tập trung hoặc trao đổi với Thinkfy về không gian giáo viên.",
      student: "Xây dựng lộ trình IELTS",
      teacher: "Yêu cầu quyền giáo viên",
    },
    footer: {
      ...shared.vi.footer,
      description: "Luyện IELTS trung thực cho Nghe, Đọc, Viết và Nói.",
      guides: [
        {
          label: "Lộ trình IELTS bốn kỹ năng",
          path: "/guides/ielts-four-skill-plan",
        },
        {
          label: "Cách phản hồi AI hoạt động",
          path: "/guides/ai-feedback-method",
        },
        {
          label: "Quy trình dành cho giáo viên",
          path: "/guides/teacher-workflows",
        },
      ],
    },
    teacherSubject: "Quyền giáo viên Thinkfy IELTS",
  },
};

export function getMarketingCopy(
  product: MarketingProduct,
  locale: MarketingLocale,
) {
  return product === "debate" ? debate[locale] : ielts[locale];
}
