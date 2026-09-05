import { SHARED_CHROME, SHARED_GUIDES } from "./copy-shared";
import type { MarketingLocale, MarketingPageCopy } from "./types";

/**
 * IELTS is told as a ladder: a target, four skills, and an honest statement of
 * which number came from where. Criterion names mirror the real writing and
 * speaking scorers; bands shown are illustrative sample values.
 */
export const IELTS_COPY: Record<
  MarketingLocale,
  Extract<MarketingPageCopy, { product: "ielts" }>
> = {
  en: {
    product: "ielts",
    productName: "Thinkfy IELTS",
    navigation: SHARED_CHROME.en.navigation,
    hero: {
      eyebrow: "Four skills, every result labelled",
      title: "Raise the band you can actually defend.",
      lede: "A study plan that connects your target, your test date and your last few sessions into one task for today — and always tells you whether a number came from a timed simulation, a teacher, or an AI estimate.",
      primary: "Build my IELTS plan",
      primaryLoggedIn: "Open IELTS",
      teacher: "Use Thinkfy with your learners",
      note: "Academic and General Training stay separate wherever Reading and Writing differ.",
      panelLabel:
        "Sample study plan showing a target band, four skill estimates, and today's task",
    },
    panel: {
      planLabel: "Study plan · today",
      targetLabel: "Target",
      target: "Band 6.5",
      estimateLabel: "Current estimate",
      estimate: "Band 6.0",
      estimateNote: "Provisional · from your three most recent sessions",
      skillsLabel: "By skill",
      skills: [
        {
          skill: "listening",
          label: "Listening",
          band: "6.5",
          progress: 0.72,
          mode: "simulation",
        },
        {
          skill: "reading",
          label: "Reading",
          band: "6.0",
          progress: 0.67,
          mode: "simulation",
        },
        {
          skill: "writing",
          label: "Writing",
          band: "5.5",
          progress: 0.61,
          mode: "simulation",
        },
        {
          skill: "speaking",
          label: "Speaking",
          band: "6.0",
          progress: 0.67,
          mode: "rehearsal",
        },
      ],
      taskLabel: "Next task",
      task: "Writing Task 2 · paragraph coherence",
      taskMeta: "18 min · Academic",
      modeLabels: {
        simulation: "Exam Simulation",
        rehearsal: "AI Rehearsal",
      },
      provisionalLabel: "Provisional",
      footnote: "Provisional estimate. Not an official IELTS score.",
    },
    loop: {
      eyebrow: "The loop",
      title: "Practise. Read the evidence. Replan.",
      lede: "The plan only moves when there is something to move it — a timed section, a marked essay, a recorded answer.",
      threadLabel: "One weakness, followed through the plan",
      steps: [
        {
          kicker: "Practise",
          title: "Sit the section in its real format",
          body: "Listening, Reading and Writing run under Exam Simulation timing and submission rules. Speaking is a separate rehearsal.",
          artifact: "Writing Task 2 · 40:00 · submitted",
        },
        {
          kicker: "Review",
          title: "See which criterion the band came from",
          body: "Task response, coherence, lexical resource and grammar are scored apart, each with the evidence behind it.",
          artifact: "Coherence & cohesion · 5.5 — paragraph links unclear",
        },
        {
          kicker: "Replan",
          title: "Let the plan rewrite itself around the gap",
          body: "Upcoming sessions are rebuilt from the newest evidence, your target band and the time you have left.",
          artifact: "Next three sessions → paragraph structure",
        },
      ],
    },
    grid: {
      eyebrow: "What you get",
      title: "A full path, without false equivalence.",
      lede: "Four skills, each with the practice mode that suits it — and a label on every result so you know what it means.",
      cards: [
        {
          id: "simulation",
          kicker: "Exam Simulation",
          title: "A sitting that behaves like the test.",
          body: "Listening, Reading and Writing run with section timing, navigation, review before you submit, and a band converted from your raw score.",
          icon: "timer",
          span: "feature",
          rail: [
            { label: "Listening", value: "Timed sections" },
            { label: "Reading", value: "Navigate + review" },
            { label: "Writing", value: "Task 1 + Task 2" },
          ],
        },
        {
          id: "criteria",
          kicker: "Writing feedback",
          title: "Four criteria, four reasons.",
          body: "Each band arrives with the evidence that produced it, not just a number.",
          icon: "scale",
          span: "tall",
          rail: [
            { label: "Task response", value: "6.0", fill: 0.67 },
            { label: "Coherence & cohesion", value: "5.5", fill: 0.61 },
            { label: "Lexical resource", value: "6.0", fill: 0.67 },
            { label: "Grammar", value: "5.5", fill: 0.61 },
          ],
        },
        {
          id: "speaking",
          kicker: "AI Speaking Rehearsal",
          title: "Speak the answer, see the limits.",
          body: "Record Part 1, 2 and 3 responses and get provisional feedback on fluency, vocabulary, grammar and pronunciation — with its confidence shown when the audio evidence is thin.",
          icon: "mic",
          span: "wide",
        },
        {
          id: "review",
          kicker: "Spaced review",
          title: "What you got wrong comes back.",
          body: "Missed items return on a schedule instead of disappearing into a finished test you never reopen.",
          icon: "repeat",
          span: "wide",
        },
        {
          id: "plan",
          kicker: "Study plan",
          title: "One next task, not a menu.",
          body: "Target band, test date and recent evidence resolve to a single thing to do today.",
          icon: "compass",
          span: "standard",
        },
        {
          id: "authority",
          kicker: "Teacher review",
          title: "A teacher's mark outranks the AI's.",
          body: "Published teacher scores replace provisional estimates and are never shown as the same thing.",
          icon: "shieldCheck",
          span: "standard",
        },
      ],
    },
    proof: {
      eyebrow: "Product proof",
      title: "Two modes. Neither one pretends to be the other.",
      lede: "The most useful thing an IELTS product can tell you is what a result is not. Here is the line we draw, written out in full.",
      columns: [
        {
          id: "simulation",
          label: "Exam Simulation",
          scope: "Listening · Reading · Writing",
          summary:
            "A timed sitting under test-like rules, converted to a band from your raw score.",
          includesLabel: "What it does",
          includes: [
            "Section timing kept on a server clock",
            "Section navigation and review before you submit",
            "Objective marking for Listening and Reading",
            "Band conversion from the raw score you earned",
          ],
          excludesLabel: "What it is not",
          excludes: [
            "Not an official IELTS test",
            "Not a registered or reportable score",
            "Speaking is not part of the simulation",
          ],
        },
        {
          id: "rehearsal",
          label: "AI Speaking Rehearsal",
          scope: "Speaking",
          summary:
            "A recorded practice answer with provisional AI feedback and its confidence stated up front.",
          includesLabel: "What it does",
          includes: [
            "Part 1, 2 and 3 prompts with recording",
            "Fluency, lexical resource, grammar and pronunciation feedback",
            "Confidence shown when the acoustic evidence is limited",
          ],
          excludesLabel: "What it is not",
          excludes: [
            "Not an official IELTS score",
            "Not a human examiner",
            "Not equivalent to a teacher-published result",
          ],
        },
      ],
      footnote:
        "Thinkfy is a preparation product and is not affiliated with the organisations that own or administer IELTS.",
    },
    audiences: {
      eyebrow: "Two ways in",
      title: "A clear learner plan. A review-ready teacher workspace.",
      lede: "The same evidence, arranged for the person reading it.",
      chooserLabel: "Which one are you?",
      student: {
        chooser: "I'm preparing",
        role: "Learners",
        title: "Keep the target, the evidence and the next task together",
        body: "Move from today's practice to criterion feedback to the next session, without ever mistaking a rehearsal for an official result.",
        points: [
          "A four-skill path built around your target",
          "Practice and Exam Simulation kept distinct",
          "Provisional AI labels with their limits attached",
        ],
        cta: "Build my IELTS plan",
        sample: {
          label: "Today",
          rows: [
            {
              primary: "Writing Task 2",
              secondary: "18 min · coherence",
              state: "Next",
            },
            {
              primary: "Listening drill",
              secondary: "Map & plan labelling",
              state: "Review",
            },
            {
              primary: "Speaking Part 2",
              secondary: "AI rehearsal",
              state: "Provisional",
            },
          ],
        },
      },
      teacher: {
        chooser: "I teach learners",
        role: "Teachers",
        title: "Review the work that needs human judgment",
        body: "Cohort progress, pending reviews, assignments and published feedback in one operational workspace instead of a spreadsheet.",
        points: [
          "One unified review queue",
          "Teacher-published scores that supersede AI estimates",
          "Class assignments and materials in one place",
        ],
        cta: "Request teacher access",
        sample: {
          label: "Review queue",
          rows: [
            {
              primary: "IELTS 6.5 · Task 2",
              secondary: "9 essays",
              state: "6 pending",
            },
            {
              primary: "Evening class · Mock 3",
              secondary: "Listening + Reading",
              state: "Marked",
            },
            {
              primary: "Linh · Speaking Part 3",
              secondary: "AI provisional 6.0",
              state: "Confirm",
            },
          ],
        },
      },
    },
    honesty: {
      eyebrow: "Straight answers",
      title: "Every result states what it is.",
      lede: "Preparation products get believed or ignored on this one question, so we answer it in the interface, not only in the footer.",
      items: [
        {
          label: "Simulation",
          value: "L · R · W",
          body: "Timed Exam Simulation covers three skills. Speaking stays a separate rehearsal experience.",
        },
        {
          label: "Speaking",
          value: "AI, provisional",
          body: "Speaking feedback is AI-generated, labelled provisional, and shows its confidence.",
        },
        {
          label: "Authority",
          value: "Teacher outranks AI",
          body: "A teacher-published result and an AI estimate are never presented as equivalent.",
        },
        {
          label: "Paths",
          value: "Academic & General",
          body: "Listening and Speaking share a format; Reading and Writing follow the path you chose.",
        },
      ],
    },
    faq: {
      eyebrow: "Know the mode first",
      title: "Honest answers about IELTS practice.",
      lede: "Short answers, no hedging.",
      items: [
        {
          question: "Is Thinkfy an official IELTS test provider?",
          answer:
            "No. Thinkfy is a preparation product. Practice, simulations and AI feedback do not replace an official IELTS test or score.",
        },
        {
          question: "What is included in Exam Simulation?",
          answer:
            "Listening, Reading and Writing, with section timing, navigation, review and final submission rules. Speaking remains a separate rehearsal experience.",
        },
        {
          question: "Is the Speaking Rehearsal band official?",
          answer:
            "No. Speaking feedback is AI-generated and provisional. Confidence and limitations are shown, especially when the acoustic evidence is limited.",
        },
        {
          question: "Can I prepare for both Academic and General Training?",
          answer:
            "Yes. Listening and Speaking share a format, while the Reading and Writing path changes depending on which test you are taking.",
        },
      ],
    },
    finalCta: {
      eyebrow: "Start",
      title: "Start with the task that actually moves your band.",
      body: "Build a focused learner path, or talk with us about a teacher workspace.",
      student: "Build my IELTS plan",
      teacher: "Request teacher access",
      note: "Setting a target band and a test date takes about a minute.",
    },
    footer: {
      ...SHARED_CHROME.en.footerChrome,
      description:
        "Honest IELTS preparation across Listening, Reading, Writing and Speaking.",
      guides: [
        { label: "The four-skill plan", path: "/guides/ielts-four-skill-plan" },
        SHARED_GUIDES.aiFeedback.en,
        SHARED_GUIDES.teacher.en,
      ],
      disclaimer:
        "Thinkfy is an independent preparation product and is not affiliated with the organisations that own or administer IELTS. AI feedback is provisional and is not an official score.",
    },
    teacherSubject: "Thinkfy IELTS teacher access",
  },
  vi: {
    product: "ielts",
    productName: "Thinkfy IELTS",
    navigation: SHARED_CHROME.vi.navigation,
    hero: {
      eyebrow: "Bốn kỹ năng, mọi kết quả đều ghi rõ nguồn",
      title: "Nâng band mà bạn thật sự bảo vệ được.",
      lede: "Lộ trình học nối band mục tiêu, ngày thi và vài buổi gần nhất của bạn thành đúng một việc cần làm hôm nay — và luôn nói rõ con số đến từ bài mô phỏng bấm giờ, từ giáo viên, hay từ ước tính của AI.",
      primary: "Xây lộ trình IELTS",
      primaryLoggedIn: "Mở IELTS",
      teacher: "Dùng Thinkfy với học viên của bạn",
      note: "Academic và General Training tách riêng ở mọi chỗ mà Đọc và Viết khác nhau.",
      panelLabel:
        "Lộ trình học mẫu với band mục tiêu, ước tính bốn kỹ năng và việc cần làm hôm nay",
    },
    panel: {
      planLabel: "Lộ trình · hôm nay",
      targetLabel: "Mục tiêu",
      target: "Band 6.5",
      estimateLabel: "Ước tính hiện tại",
      estimate: "Band 6.0",
      estimateNote: "Tạm thời · từ ba buổi gần nhất của bạn",
      skillsLabel: "Theo kỹ năng",
      skills: [
        {
          skill: "listening",
          label: "Nghe",
          band: "6.5",
          progress: 0.72,
          mode: "simulation",
        },
        {
          skill: "reading",
          label: "Đọc",
          band: "6.0",
          progress: 0.67,
          mode: "simulation",
        },
        {
          skill: "writing",
          label: "Viết",
          band: "5.5",
          progress: 0.61,
          mode: "simulation",
        },
        {
          skill: "speaking",
          label: "Nói",
          band: "6.0",
          progress: 0.67,
          mode: "rehearsal",
        },
      ],
      taskLabel: "Việc tiếp theo",
      task: "Writing Task 2 · liên kết đoạn văn",
      taskMeta: "18 phút · Academic",
      modeLabels: {
        simulation: "Exam Simulation",
        rehearsal: "Diễn tập AI",
      },
      provisionalLabel: "Tạm thời",
      footnote: "Ước tính tạm thời. Không phải điểm IELTS chính thức.",
    },
    loop: {
      eyebrow: "Vòng học",
      title: "Luyện. Đọc bằng chứng. Lên lại kế hoạch.",
      lede: "Lộ trình chỉ dịch chuyển khi có thứ làm nó dịch chuyển — một phần thi bấm giờ, một bài viết đã chấm, một câu trả lời đã ghi âm.",
      threadLabel: "Một điểm yếu, đi hết lộ trình",
      steps: [
        {
          kicker: "Luyện",
          title: "Làm phần thi đúng định dạng thật",
          body: "Nghe, Đọc và Viết chạy theo quy tắc bấm giờ và nộp bài của Exam Simulation. Nói là phần diễn tập riêng.",
          artifact: "Writing Task 2 · 40:00 · đã nộp",
        },
        {
          kicker: "Xem lại",
          title: "Biết band đến từ tiêu chí nào",
          body: "Đáp ứng đề, mạch lạc, từ vựng và ngữ pháp được chấm tách rời, mỗi tiêu chí kèm bằng chứng phía sau.",
          artifact:
            "Mạch lạc & liên kết · 5.5 — liên kết giữa các đoạn chưa rõ",
        },
        {
          kicker: "Lên lại kế hoạch",
          title: "Để lộ trình tự viết lại quanh khoảng trống đó",
          body: "Các buổi sắp tới được dựng lại từ bằng chứng mới nhất, band mục tiêu và quỹ thời gian còn lại.",
          artifact: "Ba buổi tới → cấu trúc đoạn văn",
        },
      ],
    },
    grid: {
      eyebrow: "Bạn nhận được gì",
      title: "Lộ trình đầy đủ, không đánh đồng.",
      lede: "Bốn kỹ năng, mỗi kỹ năng một chế độ luyện phù hợp — và mọi kết quả đều có nhãn để bạn hiểu nó nghĩa là gì.",
      cards: [
        {
          id: "simulation",
          kicker: "Exam Simulation",
          title: "Một lượt làm bài hành xử như bài thi thật.",
          body: "Nghe, Đọc và Viết chạy với bấm giờ theo phần, điều hướng, xem lại trước khi nộp và band quy đổi từ điểm thô của bạn.",
          icon: "timer",
          span: "feature",
          rail: [
            { label: "Nghe", value: "Bấm giờ từng phần" },
            { label: "Đọc", value: "Điều hướng + xem lại" },
            { label: "Viết", value: "Task 1 + Task 2" },
          ],
        },
        {
          id: "criteria",
          kicker: "Phản hồi bài viết",
          title: "Bốn tiêu chí, bốn lý do.",
          body: "Mỗi band đi kèm bằng chứng đã tạo ra nó, không chỉ là một con số.",
          icon: "scale",
          span: "tall",
          rail: [
            { label: "Đáp ứng đề", value: "6.0", fill: 0.67 },
            { label: "Mạch lạc & liên kết", value: "5.5", fill: 0.61 },
            { label: "Từ vựng", value: "6.0", fill: 0.67 },
            { label: "Ngữ pháp", value: "5.5", fill: 0.61 },
          ],
        },
        {
          id: "speaking",
          kicker: "Diễn tập Nói với AI",
          title: "Nói ra câu trả lời, thấy rõ giới hạn.",
          body: "Ghi âm phần 1, 2 và 3 rồi nhận phản hồi tạm thời về độ trôi chảy, từ vựng, ngữ pháp và phát âm — kèm mức tin cậy khi bằng chứng âm thanh còn mỏng.",
          icon: "mic",
          span: "wide",
        },
        {
          id: "review",
          kicker: "Ôn lại có lịch",
          title: "Chỗ làm sai sẽ quay lại.",
          body: "Câu bị sai được đưa trở lại theo lịch, thay vì trôi vào một bài thi đã xong mà bạn không bao giờ mở lại.",
          icon: "repeat",
          span: "wide",
        },
        {
          id: "plan",
          kicker: "Lộ trình học",
          title: "Một việc tiếp theo, không phải một thực đơn.",
          body: "Band mục tiêu, ngày thi và bằng chứng gần đây quy về đúng một việc cần làm hôm nay.",
          icon: "compass",
          span: "standard",
        },
        {
          id: "authority",
          kicker: "Giáo viên chấm",
          title: "Điểm của giáo viên đứng trên điểm AI.",
          body: "Điểm giáo viên công bố thay thế ước tính tạm thời, và hai loại này không bao giờ hiển thị như nhau.",
          icon: "shieldCheck",
          span: "standard",
        },
      ],
    },
    proof: {
      eyebrow: "Bằng chứng sản phẩm",
      title: "Hai chế độ. Không chế độ nào giả làm chế độ kia.",
      lede: "Điều hữu ích nhất một sản phẩm luyện thi có thể nói với bạn là kết quả này *không phải* cái gì. Đây là ranh giới đó, viết ra đầy đủ.",
      columns: [
        {
          id: "simulation",
          label: "Exam Simulation",
          scope: "Nghe · Đọc · Viết",
          summary:
            "Một lượt làm bài bấm giờ theo quy tắc sát bài thi, quy đổi thành band từ điểm thô.",
          includesLabel: "Nó làm gì",
          includes: [
            "Bấm giờ từng phần theo đồng hồ máy chủ",
            "Điều hướng và xem lại trước khi bạn nộp",
            "Chấm khách quan cho Nghe và Đọc",
            "Quy đổi band từ điểm thô bạn đạt được",
          ],
          excludesLabel: "Nó không phải là gì",
          excludes: [
            "Không phải kỳ thi IELTS chính thức",
            "Không phải điểm được ghi nhận hay báo cáo",
            "Nói không nằm trong phần mô phỏng",
          ],
        },
        {
          id: "rehearsal",
          label: "Diễn tập Nói với AI",
          scope: "Nói",
          summary:
            "Một câu trả lời luyện tập có ghi âm, kèm phản hồi AI tạm thời và mức độ tin cậy nói rõ ngay từ đầu.",
          includesLabel: "Nó làm gì",
          includes: [
            "Đề phần 1, 2 và 3 có ghi âm",
            "Phản hồi về độ trôi chảy, từ vựng, ngữ pháp và phát âm",
            "Hiện mức tin cậy khi bằng chứng âm thanh hạn chế",
          ],
          excludesLabel: "Nó không phải là gì",
          excludes: [
            "Không phải điểm IELTS chính thức",
            "Không phải giám khảo là người thật",
            "Không tương đương điểm do giáo viên công bố",
          ],
        },
      ],
      footnote:
        "Thinkfy là sản phẩm luyện thi và không liên kết với các tổ chức sở hữu hay tổ chức kỳ thi IELTS.",
    },
    audiences: {
      eyebrow: "Hai lối vào",
      title:
        "Lộ trình rõ cho học viên. Không gian sẵn sàng chấm cho giáo viên.",
      lede: "Cùng một bằng chứng, sắp xếp theo người đang đọc nó.",
      chooserLabel: "Bạn là ai?",
      student: {
        chooser: "Tôi đang ôn thi",
        role: "Học viên",
        title: "Giữ mục tiêu, bằng chứng và việc tiếp theo ở cùng một chỗ",
        body: "Đi từ bài luyện hôm nay đến phản hồi theo tiêu chí rồi đến buổi kế tiếp, mà không bao giờ nhầm một buổi diễn tập với kết quả chính thức.",
        points: [
          "Lộ trình bốn kỹ năng dựng quanh mục tiêu của bạn",
          "Luyện tập và Exam Simulation tách bạch",
          "Nhãn AI tạm thời luôn kèm giới hạn",
        ],
        cta: "Xây lộ trình IELTS",
        sample: {
          label: "Hôm nay",
          rows: [
            {
              primary: "Writing Task 2",
              secondary: "18 phút · mạch lạc",
              state: "Tiếp theo",
            },
            {
              primary: "Bài luyện Nghe",
              secondary: "Điền nhãn bản đồ & sơ đồ",
              state: "Xem lại",
            },
            {
              primary: "Speaking Part 2",
              secondary: "Diễn tập AI",
              state: "Tạm thời",
            },
          ],
        },
      },
      teacher: {
        chooser: "Tôi dạy học viên",
        role: "Giáo viên",
        title: "Chấm đúng những bài cần con người phán đoán",
        body: "Tiến độ cả lớp, bài chờ chấm, bài giao và phản hồi đã công bố trong một không gian vận hành, thay vì một bảng tính.",
        points: [
          "Một hàng đợi chấm bài duy nhất",
          "Điểm giáo viên công bố thay thế ước tính AI",
          "Bài giao và tài liệu lớp ở cùng một nơi",
        ],
        cta: "Yêu cầu quyền giáo viên",
        sample: {
          label: "Hàng đợi chấm bài",
          rows: [
            {
              primary: "IELTS 6.5 · Task 2",
              secondary: "9 bài viết",
              state: "6 chờ chấm",
            },
            {
              primary: "Lớp tối · Mock 3",
              secondary: "Nghe + Đọc",
              state: "Đã chấm",
            },
            {
              primary: "Linh · Speaking Part 3",
              secondary: "AI tạm thời 6.0",
              state: "Xác nhận",
            },
          ],
        },
      },
    },
    honesty: {
      eyebrow: "Nói thẳng",
      title: "Mọi kết quả đều nói rõ nó là gì.",
      lede: "Sản phẩm luyện thi được tin hay bị bỏ qua chỉ vì câu hỏi này, nên chúng tôi trả lời ngay trong giao diện chứ không chỉ ở chân trang.",
      items: [
        {
          label: "Mô phỏng",
          value: "Nghe · Đọc · Viết",
          body: "Exam Simulation bấm giờ bao gồm ba kỹ năng. Nói vẫn là trải nghiệm diễn tập riêng.",
        },
        {
          label: "Nói",
          value: "AI, tạm thời",
          body: "Phản hồi Nói do AI tạo, được ghi nhãn tạm thời và hiển thị mức độ tin cậy.",
        },
        {
          label: "Thẩm quyền",
          value: "Giáo viên trên AI",
          body: "Kết quả giáo viên công bố và ước tính AI không bao giờ được trình bày như tương đương.",
        },
        {
          label: "Lộ trình",
          value: "Academic & General",
          body: "Nghe và Nói dùng chung định dạng; Đọc và Viết đi theo lộ trình bạn chọn.",
        },
      ],
    },
    faq: {
      eyebrow: "Hiểu chế độ trước đã",
      title: "Trả lời trung thực về luyện IELTS.",
      lede: "Trả lời ngắn, không vòng vo.",
      items: [
        {
          question: "Thinkfy có phải đơn vị tổ chức thi IELTS chính thức?",
          answer:
            "Không. Thinkfy là sản phẩm luyện thi. Bài luyện, bài mô phỏng và phản hồi AI không thay thế kỳ thi hay điểm IELTS chính thức.",
        },
        {
          question: "Exam Simulation gồm những gì?",
          answer:
            "Nghe, Đọc và Viết, với bấm giờ theo phần, điều hướng, xem lại và quy tắc nộp bài cuối. Nói vẫn là trải nghiệm diễn tập riêng.",
        },
        {
          question: "Band ở phần Diễn tập Nói có chính thức không?",
          answer:
            "Không. Phản hồi Nói do AI tạo và mang tính tạm thời. Mức tin cậy và giới hạn luôn được hiển thị, nhất là khi bằng chứng âm thanh hạn chế.",
        },
        {
          question: "Tôi ôn được cả Academic và General Training chứ?",
          answer:
            "Được. Nghe và Nói dùng chung định dạng, còn lộ trình Đọc và Viết thay đổi theo kỳ thi bạn sẽ tham dự.",
        },
      ],
    },
    finalCta: {
      eyebrow: "Bắt đầu",
      title: "Bắt đầu bằng đúng việc làm band của bạn nhích lên.",
      body: "Dựng lộ trình học tập trung, hoặc trao đổi với chúng tôi về không gian dành cho giáo viên.",
      student: "Xây lộ trình IELTS",
      teacher: "Yêu cầu quyền giáo viên",
      note: "Đặt band mục tiêu và ngày thi chỉ mất khoảng một phút.",
    },
    footer: {
      ...SHARED_CHROME.vi.footerChrome,
      description: "Luyện IELTS trung thực cho Nghe, Đọc, Viết và Nói.",
      guides: [
        {
          label: "Lộ trình bốn kỹ năng",
          path: "/guides/ielts-four-skill-plan",
        },
        SHARED_GUIDES.aiFeedback.vi,
        SHARED_GUIDES.teacher.vi,
      ],
      disclaimer:
        "Thinkfy là sản phẩm luyện thi độc lập, không liên kết với các tổ chức sở hữu hay tổ chức kỳ thi IELTS. Phản hồi AI mang tính tạm thời và không phải điểm chính thức.",
    },
    teacherSubject: "Quyền giáo viên Thinkfy IELTS",
  },
};
