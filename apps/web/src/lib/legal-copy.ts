import type { PublicLocale } from "@/lib/public-site";

export type LegalDocumentKind = "privacy" | "terms" | "cookies";

export type LegalSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type LegalDocument = {
  title: string;
  description: string;
  effectiveLabel: string;
  effectiveDate: string;
  draftNotice: string;
  sections: LegalSection[];
};

const EFFECTIVE_DATE = "30 August 2026";

const EN: Record<LegalDocumentKind, LegalDocument> = {
  privacy: {
    title: "Privacy Policy",
    description:
      "How Thinkfy collects, uses, protects, and deletes personal data.",
    effectiveLabel: "Effective date",
    effectiveDate: EFFECTIVE_DATE,
    draftNotice:
      "Pre-launch legal draft. Operator identity and governing-law details must be completed and reviewed before commercial launch.",
    sections: [
      {
        title: "Who is responsible for your data",
        paragraphs: [
          "Thinkfy is an educational service for Debate and IELTS practice. The operator identified below is responsible for the personal data described in this policy.",
        ],
      },
      {
        title: "Data we collect",
        bullets: [
          "Account and profile details, including name, email address, role, language, goals, and class membership.",
          "Debate and IELTS work, including prompts, written answers, audio recordings, transcriptions, annotations, scores, feedback, and study-plan activity.",
          "Technical and usage data such as device, browser, approximate location derived from network information, pages viewed, feature interactions, and reliability logs.",
          "Teacher and organization data such as classes, assignments, reviews, attendance, and learner progress where those features are used.",
          "Support messages, consent records, and privacy requests.",
        ],
      },
      {
        title: "How we use data",
        bullets: [
          "Provide authentication, practice, feedback, scoring, study plans, classes, and support.",
          "Run AI-assisted transcription, analysis, feedback, and personalization. AI output can be incomplete or incorrect and is not an official exam result.",
          "Protect accounts, prevent misuse, diagnose failures, and improve service quality.",
          "Send service messages and optional communications selected by the user.",
          "Measure product performance only when analytics consent has been granted.",
        ],
      },
      {
        title: "Service providers and international transfers",
        paragraphs: [
          "Thinkfy uses service providers for cloud hosting and databases, Google authentication, AI and speech processing, email, support forms, payments when enabled, product analytics, and performance monitoring. Data may be processed outside Vietnam. Providers may process data only for contracted purposes and subject to appropriate safeguards.",
        ],
      },
      {
        title: "Children and guardian consent",
        paragraphs: [
          "Thinkfy is designed for students, including some who may be below the applicable digital-consent age. We use neutral age screening. Where consent is legally required, voice recordings, written practice, AI processing, and optional analytics remain unavailable until a parent or legal guardian provides verifiable consent. A guardian may withdraw consent and request deletion.",
        ],
      },
      {
        title: "Retention and deletion",
        paragraphs: [
          "We keep personal data only for the purpose and period needed to provide the service, meet legal obligations, resolve disputes, and protect the service. Practice content and recordings follow documented retention periods; expired data is deleted or irreversibly de-identified. We do not retain children’s personal data indefinitely.",
        ],
      },
      {
        title: "Your choices and rights",
        bullets: [
          "Access, correct, download, restrict, object to, or request deletion of personal data, subject to applicable law.",
          "Withdraw optional consent without affecting earlier lawful processing.",
          "Disable analytics cookies and optional communications.",
          "Contact us about automated feedback, a privacy concern, or a guardian request.",
        ],
      },
      {
        title: "Security and incidents",
        paragraphs: [
          "We use access controls, encrypted transport, least-privilege service access, logging, backups, and incident procedures appropriate to the data we process. No system is perfectly secure. We will notify affected people and authorities when required by law.",
        ],
      },
      {
        title: "Contact and updates",
        paragraphs: [
          "Contact the privacy address below to exercise a right or ask a question. Material policy changes will be dated and communicated through the service when required.",
        ],
      },
    ],
  },
  terms: {
    title: "Terms of Service",
    description:
      "The rules for using Thinkfy Debate, IELTS, class, and AI-assisted services.",
    effectiveLabel: "Effective date",
    effectiveDate: EFFECTIVE_DATE,
    draftNotice:
      "Pre-launch legal draft. Operator identity, governing law, dispute terms, and any commercial terms must be completed and reviewed by qualified counsel before commercial launch.",
    sections: [
      {
        title: "Agreement and eligibility",
        paragraphs: [
          "By using Thinkfy, you agree to these terms and the Privacy Policy. You must be legally able to accept them. Users below the applicable age require a parent, guardian, or authorized school arrangement before using data-processing practice features.",
        ],
      },
      {
        title: "Educational service and AI limitations",
        paragraphs: [
          "Thinkfy provides practice, educational feedback, and study tools. AI-generated feedback, transcriptions, predicted bands, scores, and recommendations may be incomplete or incorrect and must not be treated as professional advice, an official competition judgment, or an official IELTS result.",
          "IELTS is a trademark of its respective owners. Thinkfy is an independent preparation service and is not endorsed by or affiliated with the organizations that own or administer IELTS.",
        ],
      },
      {
        title: "Accounts and acceptable use",
        bullets: [
          "Keep account access secure and provide accurate information.",
          "Do not harass others, cheat, impersonate, upload unlawful material, probe security, disrupt the service, or use automated access without permission.",
          "Do not submit another person’s voice, work, or personal information without authority.",
          "Teachers and organization managers may access learner work only within their authorized class scope.",
        ],
      },
      {
        title: "Your content",
        paragraphs: [
          "You retain ownership of content you create. You grant Thinkfy a limited license to host, process, reproduce, and transform it only as needed to operate, secure, and improve the service according to your settings and the Privacy Policy. You confirm that you have the rights needed to submit it.",
        ],
      },
      {
        title: "Thinkfy content and intellectual property",
        paragraphs: [
          "The service, software, branding, original learning materials, and interface are protected by applicable intellectual-property laws. These terms grant a personal, limited, revocable right to use the service; they do not transfer ownership.",
        ],
      },
      {
        title: "Paid features, refunds, and changes",
        paragraphs: [
          "If paid features are introduced, price, billing period, renewal, cancellation, and refund terms will be shown for acceptance before purchase. We may change or discontinue features while taking reasonable steps to protect active learners and required data access.",
        ],
      },
      {
        title: "Suspension and termination",
        paragraphs: [
          "You may stop using Thinkfy and request account deletion. We may restrict or terminate access for serious misuse, security risk, legal requirements, or repeated violations, with notice and an opportunity to appeal when appropriate.",
        ],
      },
      {
        title: "Disclaimers and liability",
        paragraphs: [
          "The service is provided on an as-available basis to the extent permitted by law. Nothing in these terms excludes consumer rights or liabilities that cannot legally be excluded. To the fullest extent permitted by law, Thinkfy is not responsible for indirect, incidental, special, or consequential losses arising from use of the service. This limitation does not apply where prohibited by law or to liability caused by fraud or willful misconduct.",
        ],
      },
      {
        title: "Contact",
        paragraphs: [
          "Questions, complaints, and notices may be sent to the contact details below.",
        ],
      },
    ],
  },
  cookies: {
    title: "Cookie Policy",
    description:
      "How Thinkfy uses essential storage and optional analytics cookies.",
    effectiveLabel: "Effective date",
    effectiveDate: EFFECTIVE_DATE,
    draftNotice:
      "Pre-launch legal draft. The deployed cookie inventory must be verified before commercial launch and whenever a provider changes.",
    sections: [
      {
        title: "What cookies and local storage do",
        paragraphs: [
          "Cookies and browser storage remember authentication, language, theme, consent, and other settings. Similar technologies may also help measure performance when you consent.",
        ],
      },
      {
        title: "Essential storage",
        bullets: [
          "Authentication and security tokens required to sign in and protect sessions.",
          "Language, theme, accessibility, draft-recovery, and consent preferences.",
          "Reliability controls needed to complete requested practice and prevent duplicate actions.",
        ],
      },
      {
        title: "Optional analytics",
        paragraphs: [
          "With consent, Thinkfy enables PostHog product analytics, Grafana error diagnostics, Vercel Web Analytics, Speed Insights, and related performance measurements. These help us understand page use, conversion, errors, and responsiveness. Optional analytics are disabled unless consent is granted.",
        ],
      },
      {
        title: "Managing your choice",
        paragraphs: [
          "You can accept or reject optional analytics from the consent prompt and change the setting later. Rejecting analytics does not disable core learning features. Browser controls can also remove stored data, although clearing essential cookies may sign you out.",
        ],
      },
      {
        title: "Contact",
        paragraphs: [
          "Contact us if you want the current deployed cookie inventory or have a question about tracking technologies.",
        ],
      },
    ],
  },
};

const VI: Record<LegalDocumentKind, LegalDocument> = {
  privacy: {
    title: "Chính sách quyền riêng tư",
    description:
      "Cách Thinkfy thu thập, sử dụng, bảo vệ và xóa dữ liệu cá nhân.",
    effectiveLabel: "Ngày hiệu lực",
    effectiveDate: "30 tháng 8 năm 2026",
    draftNotice:
      "Bản dự thảo pháp lý trước khi ra mắt. Danh tính đơn vị vận hành và luật điều chỉnh phải được hoàn thiện và rà soát trước khi thương mại hóa.",
    sections: [
      {
        title: "Ai chịu trách nhiệm về dữ liệu",
        paragraphs: [
          "Thinkfy là dịch vụ giáo dục hỗ trợ luyện Tranh biện và IELTS. Đơn vị vận hành được nêu bên dưới chịu trách nhiệm đối với dữ liệu cá nhân trong chính sách này.",
        ],
      },
      {
        title: "Dữ liệu chúng tôi thu thập",
        bullets: [
          "Thông tin tài khoản và hồ sơ như tên, email, vai trò, ngôn ngữ, mục tiêu và lớp học.",
          "Bài luyện Tranh biện và IELTS, gồm câu trả lời viết, bản ghi âm, bản chép lời, chú thích, điểm số, phản hồi và hoạt động lộ trình học.",
          "Dữ liệu kỹ thuật và sử dụng như thiết bị, trình duyệt, vị trí gần đúng từ thông tin mạng, trang đã xem, tương tác tính năng và nhật ký độ tin cậy.",
          "Dữ liệu giáo viên và tổ chức như lớp, bài giao, nhận xét, điểm danh và tiến độ học viên.",
          "Tin nhắn hỗ trợ, hồ sơ đồng ý và yêu cầu quyền riêng tư.",
        ],
      },
      {
        title: "Cách chúng tôi sử dụng dữ liệu",
        bullets: [
          "Cung cấp đăng nhập, bài luyện, phản hồi, chấm điểm, lộ trình học, lớp học và hỗ trợ.",
          "Thực hiện chép lời, phân tích, phản hồi và cá nhân hóa có AI hỗ trợ. Kết quả AI có thể thiếu hoặc sai và không phải kết quả thi chính thức.",
          "Bảo vệ tài khoản, ngăn lạm dụng, chẩn đoán lỗi và cải thiện chất lượng.",
          "Gửi thông báo dịch vụ và nội dung tùy chọn do người dùng lựa chọn.",
          "Đo lường sản phẩm chỉ khi người dùng đã đồng ý cookie phân tích.",
        ],
      },
      {
        title: "Nhà cung cấp dịch vụ và chuyển dữ liệu quốc tế",
        paragraphs: [
          "Thinkfy sử dụng nhà cung cấp cho lưu trữ đám mây và cơ sở dữ liệu, đăng nhập Google, xử lý AI và giọng nói, email, biểu mẫu hỗ trợ, thanh toán khi được bật, phân tích sản phẩm và theo dõi hiệu năng. Dữ liệu có thể được xử lý ngoài Việt Nam và chỉ cho các mục đích đã thỏa thuận với biện pháp bảo vệ phù hợp.",
        ],
      },
      {
        title: "Trẻ em và sự đồng ý của người giám hộ",
        paragraphs: [
          "Thinkfy phục vụ học sinh, bao gồm người có thể chưa đủ tuổi tự đồng ý theo luật áp dụng. Chúng tôi hỏi tuổi theo cách trung lập. Khi pháp luật yêu cầu, ghi âm, bài viết, xử lý AI và phân tích tùy chọn sẽ chưa hoạt động cho đến khi cha mẹ hoặc người giám hộ hợp pháp xác minh sự đồng ý. Người giám hộ có thể rút lại đồng ý và yêu cầu xóa dữ liệu.",
        ],
      },
      {
        title: "Lưu giữ và xóa dữ liệu",
        paragraphs: [
          "Chúng tôi chỉ giữ dữ liệu trong thời gian cần thiết để cung cấp dịch vụ, tuân thủ pháp luật, xử lý tranh chấp và bảo vệ hệ thống. Nội dung luyện tập và bản ghi âm tuân theo thời hạn lưu giữ được lập thành tài liệu; dữ liệu hết hạn sẽ bị xóa hoặc khử định danh không thể đảo ngược. Dữ liệu trẻ em không được lưu vô thời hạn.",
        ],
      },
      {
        title: "Lựa chọn và quyền của bạn",
        bullets: [
          "Truy cập, sửa, tải xuống, hạn chế, phản đối hoặc yêu cầu xóa dữ liệu theo luật áp dụng.",
          "Rút lại sự đồng ý tùy chọn mà không ảnh hưởng việc xử lý hợp pháp trước đó.",
          "Tắt cookie phân tích và thông báo tùy chọn.",
          "Liên hệ về phản hồi tự động, vấn đề riêng tư hoặc yêu cầu của người giám hộ.",
        ],
      },
      {
        title: "Bảo mật và sự cố",
        paragraphs: [
          "Chúng tôi sử dụng kiểm soát truy cập, mã hóa khi truyền, quyền truy cập tối thiểu, ghi nhật ký, sao lưu và quy trình xử lý sự cố phù hợp. Không hệ thống nào an toàn tuyệt đối. Chúng tôi sẽ thông báo cho người bị ảnh hưởng và cơ quan có thẩm quyền khi pháp luật yêu cầu.",
        ],
      },
      {
        title: "Liên hệ và cập nhật",
        paragraphs: [
          "Hãy dùng địa chỉ quyền riêng tư bên dưới để thực hiện quyền hoặc đặt câu hỏi. Thay đổi quan trọng sẽ được ghi ngày và thông báo trong dịch vụ khi cần.",
        ],
      },
    ],
  },
  terms: {
    title: "Điều khoản dịch vụ",
    description:
      "Quy tắc sử dụng các dịch vụ Tranh biện, IELTS, lớp học và AI của Thinkfy.",
    effectiveLabel: "Ngày hiệu lực",
    effectiveDate: "30 tháng 8 năm 2026",
    draftNotice:
      "Bản dự thảo trước khi ra mắt. Danh tính đơn vị vận hành, luật điều chỉnh, giải quyết tranh chấp và điều khoản thương mại phải được luật sư rà soát trước khi thương mại hóa.",
    sections: [
      {
        title: "Thỏa thuận và điều kiện sử dụng",
        paragraphs: [
          "Khi sử dụng Thinkfy, bạn đồng ý với các điều khoản này và Chính sách quyền riêng tư. Bạn phải có năng lực pháp lý để đồng ý. Người chưa đủ tuổi theo luật áp dụng cần cha mẹ, người giám hộ hoặc cơ chế được nhà trường cho phép trước khi sử dụng tính năng luyện tập có xử lý dữ liệu.",
        ],
      },
      {
        title: "Dịch vụ giáo dục và giới hạn AI",
        paragraphs: [
          "Thinkfy cung cấp công cụ luyện tập, phản hồi giáo dục và lập kế hoạch học. Phản hồi AI, bản chép lời, band dự đoán, điểm và gợi ý có thể thiếu hoặc sai; không phải tư vấn chuyên môn, phán quyết thi đấu hay kết quả IELTS chính thức.",
          "IELTS là nhãn hiệu của các chủ sở hữu tương ứng. Thinkfy là dịch vụ luyện thi độc lập, không được bảo trợ và không liên kết với các tổ chức sở hữu hoặc tổ chức kỳ thi IELTS.",
        ],
      },
      {
        title: "Tài khoản và sử dụng chấp nhận được",
        bullets: [
          "Bảo vệ quyền truy cập tài khoản và cung cấp thông tin chính xác.",
          "Không quấy rối, gian lận, mạo danh, tải nội dung trái pháp luật, dò quét bảo mật, phá hoại dịch vụ hoặc tự động truy cập khi chưa được phép.",
          "Không gửi giọng nói, bài làm hoặc dữ liệu cá nhân của người khác khi chưa có thẩm quyền.",
          "Giáo viên và quản lý chỉ được truy cập bài làm trong phạm vi lớp được ủy quyền.",
        ],
      },
      {
        title: "Nội dung của bạn",
        paragraphs: [
          "Bạn giữ quyền sở hữu nội dung do mình tạo. Bạn cấp cho Thinkfy giấy phép giới hạn để lưu trữ, xử lý, sao chép và biến đổi nội dung chỉ trong phạm vi cần thiết để vận hành, bảo vệ và cải thiện dịch vụ theo cài đặt và Chính sách quyền riêng tư. Bạn xác nhận có đủ quyền để gửi nội dung.",
        ],
      },
      {
        title: "Nội dung và sở hữu trí tuệ của Thinkfy",
        paragraphs: [
          "Dịch vụ, phần mềm, thương hiệu, học liệu gốc và giao diện được luật sở hữu trí tuệ bảo vệ. Điều khoản này chỉ cấp quyền sử dụng cá nhân, giới hạn và có thể thu hồi; không chuyển quyền sở hữu.",
        ],
      },
      {
        title: "Tính năng trả phí, hoàn tiền và thay đổi",
        paragraphs: [
          "Nếu có tính năng trả phí, giá, chu kỳ thanh toán, gia hạn, hủy và hoàn tiền sẽ được hiển thị để bạn chấp nhận trước khi mua. Chúng tôi có thể thay đổi tính năng nhưng sẽ thực hiện các bước hợp lý để bảo vệ người học đang hoạt động và quyền truy cập dữ liệu bắt buộc.",
        ],
      },
      {
        title: "Tạm ngưng và chấm dứt",
        paragraphs: [
          "Bạn có thể ngừng sử dụng và yêu cầu xóa tài khoản. Chúng tôi có thể hạn chế hoặc chấm dứt truy cập do lạm dụng nghiêm trọng, rủi ro bảo mật, yêu cầu pháp luật hoặc vi phạm lặp lại; sẽ thông báo và cho phép khiếu nại khi phù hợp.",
        ],
      },
      {
        title: "Tuyên bố miễn trừ và trách nhiệm",
        paragraphs: [
          "Dịch vụ được cung cấp theo khả năng sẵn có trong giới hạn pháp luật. Không nội dung nào trong điều khoản này loại trừ quyền của người tiêu dùng hoặc trách nhiệm không thể bị loại trừ theo luật. Trong phạm vi tối đa pháp luật cho phép, Thinkfy không chịu trách nhiệm đối với tổn thất gián tiếp, ngẫu nhiên, đặc biệt hoặc hệ quả phát sinh từ việc sử dụng dịch vụ. Giới hạn này không áp dụng khi pháp luật cấm hoặc đối với trách nhiệm do gian lận hay hành vi cố ý gây ra.",
        ],
      },
      {
        title: "Liên hệ",
        paragraphs: [
          "Câu hỏi, khiếu nại và thông báo có thể gửi đến thông tin liên hệ bên dưới.",
        ],
      },
    ],
  },
  cookies: {
    title: "Chính sách cookie",
    description:
      "Cách Thinkfy sử dụng lưu trữ thiết yếu và cookie phân tích tùy chọn.",
    effectiveLabel: "Ngày hiệu lực",
    effectiveDate: "30 tháng 8 năm 2026",
    draftNotice:
      "Bản dự thảo trước khi ra mắt. Danh mục cookie thực tế phải được xác minh trước khi thương mại hóa và mỗi khi thay đổi nhà cung cấp.",
    sections: [
      {
        title: "Cookie và lưu trữ trình duyệt dùng để làm gì",
        paragraphs: [
          "Cookie và bộ nhớ trình duyệt ghi nhớ đăng nhập, ngôn ngữ, giao diện, sự đồng ý và cài đặt khác. Công nghệ tương tự có thể đo hiệu năng khi bạn đồng ý.",
        ],
      },
      {
        title: "Lưu trữ thiết yếu",
        bullets: [
          "Token xác thực và bảo mật cần để đăng nhập và bảo vệ phiên.",
          "Tùy chọn ngôn ngữ, giao diện, trợ năng, khôi phục bản nháp và sự đồng ý.",
          "Kiểm soát độ tin cậy cần để hoàn thành bài luyện và tránh thao tác trùng lặp.",
        ],
      },
      {
        title: "Phân tích tùy chọn",
        paragraphs: [
          "Khi bạn đồng ý, Thinkfy bật phân tích sản phẩm PostHog, chẩn đoán lỗi Grafana, Vercel Web Analytics, Speed Insights và đo lường hiệu năng liên quan để hiểu việc sử dụng, chuyển đổi, lỗi và tốc độ. Phân tích tùy chọn mặc định bị tắt cho đến khi có sự đồng ý.",
        ],
      },
      {
        title: "Quản lý lựa chọn",
        paragraphs: [
          "Bạn có thể chấp nhận hoặc từ chối phân tích trong lời nhắc đồng ý và thay đổi sau. Từ chối không làm mất tính năng học cốt lõi. Trình duyệt cũng có thể xóa dữ liệu lưu, nhưng xóa cookie thiết yếu có thể đăng xuất tài khoản.",
        ],
      },
      {
        title: "Liên hệ",
        paragraphs: [
          "Liên hệ với chúng tôi để nhận danh mục cookie đang triển khai hoặc hỏi về công nghệ theo dõi.",
        ],
      },
    ],
  },
};

export function getLegalDocument(
  locale: PublicLocale,
  kind: LegalDocumentKind,
) {
  return (locale === "vi" ? VI : EN)[kind];
}
