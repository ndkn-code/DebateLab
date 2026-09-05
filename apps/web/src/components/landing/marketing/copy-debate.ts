import { SHARED_CHROME, SHARED_GUIDES } from "./copy-shared";
import type { MarketingLocale, MarketingPageCopy } from "./types";

/**
 * Debate is told as an argument: a claim is made, tested, and repaired.
 * Every number below mirrors the real practice-review surface
 * (four scored categories out of 100, band names from the score hero).
 * Quotes are illustrative samples, not student records.
 */
export const DEBATE_COPY: Record<
  MarketingLocale,
  Extract<MarketingPageCopy, { product: "debate" }>
> = {
  en: {
    product: "debate",
    productName: "Thinkfy Debate",
    navigation: SHARED_CHROME.en.navigation,
    hero: {
      eyebrow: "English argumentation, practised out loud",
      title: "Turn ideas into arguments people can follow.",
      lede: "Give a real speech under a real clock. Get feedback attached to the reasoning move it describes. Leave every session with one specific thing to fix.",
      primary: "Start practising",
      primaryLoggedIn: "Open Debate",
      teacher: "Bring Thinkfy to your class",
      note: "Focused English practice for students, clubs, and competition teams.",
      panelLabel: "Sample practice review with category scores and a next move",
    },
    panel: {
      reviewLabel: "Practice review",
      motionLabel: "Motion",
      motion:
        "This house would make school attendance optional after the age of sixteen.",
      speechMeta: "Rebuttal speech · 3:00 · English",
      scoreLabel: "Overall",
      score: 78,
      scoreMax: 100,
      band: "Proficient",
      categories: [
        { label: "Content & casework", score: 31, max: 40 },
        { label: "Structure & strategy", score: 19, max: 25 },
        { label: "Language & delivery", score: 19, max: 25 },
        { label: "Persuasion & weighing", score: 9, max: 10 },
      ],
      nextMoveLabel: "Next move",
      nextMoveQuote:
        "Students would lose the structure that keeps them learning.",
      nextMove:
        "You named the harm but never sized it. Say how many students, over how long — then weigh that against the freedom your opponent is claiming.",
      footnote:
        "AI-assisted review. Your teacher stays the judge of curriculum and competition strategy.",
    },
    loop: {
      eyebrow: "The loop",
      title: "One sentence, three passes.",
      lede: "Practice, feedback, and the retry are the same piece of work seen three times — not three separate products bolted together.",
      threadLabel: "The same claim, followed across the loop",
      steps: [
        {
          kicker: "Practise",
          title: "Say the argument out loud",
          body: "Answer a motion under a real clock, in English, as a speech rather than a form field.",
          artifact:
            "“Students would lose the structure that keeps them learning.”",
        },
        {
          kicker: "Review",
          title: "See what the claim is missing",
          body: "The note lands on the reasoning move it describes, with the sentence it came from attached.",
          artifact: "Impact asserted, not sized — no scale, no timeframe.",
        },
        {
          kicker: "Retry",
          title: "Say it again with the gap closed",
          body: "One recommendation carries into the next drill, so the change is something you can hear.",
          artifact:
            "“Around a third of sixteen-year-olds would leave within a year.”",
        },
      ],
    },
    grid: {
      eyebrow: "What you get",
      title: "The room around the round.",
      lede: "Every surface supports one real learning action — building a case, giving the speech, or reading the review afterwards.",
      cards: [
        {
          id: "speech",
          kicker: "Practice session",
          title: "Speak a whole speech, not a text box.",
          body: "Pick a motion, start the clock, and speak. Thinkfy transcribes as you go and reviews the speech you actually gave.",
          icon: "mic",
          span: "feature",
          rail: [
            { label: "Prepared speech", value: "3–7 min" },
            { label: "Rebuttal", value: "Clock-aware" },
            { label: "Motion bank", value: "Curated" },
          ],
        },
        {
          id: "signals",
          kicker: "Progress",
          title: "Five signals, never one number.",
          body: "A single total hides which move is weak, so these are tracked apart across every session.",
          icon: "chart",
          span: "tall",
          rail: [
            { label: "Clarity", value: "Strong", fill: 0.82 },
            { label: "Logic", value: "Steady", fill: 0.68 },
            { label: "Rebuttal", value: "Growing", fill: 0.55 },
            { label: "Evidence", value: "Focus", fill: 0.41 },
            { label: "Delivery", value: "Steady", fill: 0.64 },
          ],
        },
        {
          id: "clash",
          kicker: "Round analysis",
          title: "A clash map of the whole round.",
          body: "See which arguments were answered, dropped, turned, or weighed — and which one actually decided it.",
          icon: "scale",
          span: "wide",
        },
        {
          id: "motions",
          kicker: "Preparation",
          title: "A motion bank you can prepare from.",
          body: "Curated motions and case material, so a practice session starts with something worth arguing about.",
          icon: "book",
          span: "wide",
        },
        {
          id: "opponent",
          kicker: "Rehearsal",
          title: "An opponent that argues back.",
          body: "Practise against an AI speaker so rebuttal drills have something real to rebut.",
          icon: "usersGroup",
          span: "standard",
        },
        {
          id: "coach",
          kicker: "Coach",
          title: "Ask about your own transcript.",
          body: "The coach reads the speech you gave, so the answers are about your argument.",
          icon: "sparkles",
          span: "standard",
        },
      ],
    },
    proof: {
      eyebrow: "Product proof",
      title: "The feedback is attached to the sentence.",
      lede: "This is the artifact a practice session produces: your speech, marked where it worked and where it did not, with the fix written next to the line that needs it.",
      transcriptLabel: "Speech transcript",
      speaker: "Second speaker · Opposition",
      segments: [
        {
          text: "My opponent says optional attendance respects autonomy. ",
        },
        {
          text: "But autonomy without capacity is not a choice — a sixteen-year-old deciding to leave is deciding with the information they have today, not the information they will need at twenty-five.",
          mark: "strength",
        },
        { text: " " },
        {
          text: "Students would lose the structure that keeps them learning.",
          mark: "improvement",
        },
        {
          text: " That is why the harm falls hardest on exactly the students this policy claims to free.",
        },
      ],
      annotations: [
        {
          tag: "Clash",
          severity: "strength",
          feedback:
            "You answered the autonomy argument on its own terms instead of changing the subject.",
          suggestion:
            "Reuse this framing when you rebuild the case in your closing.",
          suggestionLabel: "Keep",
        },
        {
          tag: "Impact",
          severity: "improvement",
          feedback:
            "The harm is asserted but never sized, so a judge cannot weigh it against your opponent's benefit.",
          suggestion:
            "Add scale and timeframe — how many students, and over how long?",
          suggestionLabel: "Try",
        },
      ],
      legend: { strength: "What worked", improvement: "What to fix" },
      footnote:
        "Sample review. Speech text is illustrative, not a student record.",
    },
    audiences: {
      eyebrow: "Two ways in",
      title: "Personal for students. Operational for teachers.",
      lede: "The same practice system, doing two different jobs. Neither one is the other's dashboard.",
      chooserLabel: "Which one are you?",
      student: {
        chooser: "I'm a student",
        role: "Students",
        title: "Know exactly what to practise next",
        body: "Go from a focused drill to feedback to a visible next action, without navigating a maze of dashboards to find it.",
        points: [
          "A single practice focus each day",
          "Feedback split by debate skill",
          "Competition-ready rehearsal under time",
        ],
        cta: "Start student practice",
        sample: {
          label: "Today",
          rows: [
            {
              primary: "Rebuttal drill",
              secondary: "3 min · impact weighing",
              state: "Ready",
            },
            {
              primary: "Last review",
              secondary: "Clash & response 7/10",
              state: "Retry",
            },
            {
              primary: "Practice streak",
              secondary: "4 days",
              state: "Active",
            },
          ],
        },
      },
      teacher: {
        chooser: "I teach a class",
        role: "Teachers",
        title: "Guide a cohort without grading every draft alone",
        body: "Assign practice, see the patterns a class shares, and spend your own review time where it actually changes something.",
        points: [
          "Assign practice to a class or club",
          "One review queue instead of scattered files",
          "Progress context before you open a speech",
        ],
        cta: "Request teacher access",
        sample: {
          label: "Review queue",
          rows: [
            {
              primary: "Class 10A · Rebuttal",
              secondary: "12 submissions",
              state: "8 pending",
            },
            {
              primary: "Debate club · Motion set",
              secondary: "Due Friday",
              state: "Assigned",
            },
            {
              primary: "Nguyên · Closing speech",
              secondary: "Flagged: evidence",
              state: "Review",
            },
          ],
        },
      },
    },
    honesty: {
      eyebrow: "Straight answers",
      title: "Claims we can actually stand behind.",
      lede: "No scores we did not measure and no schools we did not work with. This is what the product does, stated plainly.",
      items: [
        {
          label: "Feedback",
          value: "Criterion-linked",
          body: "Every note is anchored to an observable choice in your speech, with the quote it came from.",
        },
        {
          label: "Progress",
          value: "Five separate signals",
          body: "Clarity, logic, rebuttal, evidence and delivery are tracked apart so one total never hides a weak move.",
        },
        {
          label: "Judgment",
          value: "Stays human",
          body: "AI supports frequent practice. Teachers and coaches keep curriculum, context, and competition strategy.",
        },
        {
          label: "Language",
          value: "Bilingual interface",
          body: "The product reads in Vietnamese or English. The practice itself is in English.",
        },
      ],
    },
    faq: {
      eyebrow: "Before the first round",
      title: "Questions worth asking first.",
      lede: "Short answers, no hedging.",
      items: [
        {
          question: "Is Thinkfy only for competition debaters?",
          answer:
            "No. You can use it for focused English argumentation practice before you ever join a team, and experienced debaters can use it to rehearse competition skills.",
        },
        {
          question: "Does AI feedback replace a coach or teacher?",
          answer:
            "No. It makes frequent practice possible and surfaces patterns across sessions. Curriculum, context and competition strategy stay with your teacher or coach.",
        },
        {
          question: "What does a student actually practise?",
          answer:
            "Claims, reasoning, evidence, rebuttal, weighing, and structured delivery — through spoken drills and written case work in English.",
        },
        {
          question: "Can a teacher use Thinkfy with a class?",
          answer:
            "Yes. Teachers can assign practice to a class or club and review submissions in one queue. Contact us for teacher access and class setup.",
        },
      ],
    },
    finalCta: {
      eyebrow: "Start",
      title: "Build the next argument with a clearer next step.",
      body: "Start a focused practice plan, or talk with us about a teacher workspace for your class.",
      student: "Start practising",
      teacher: "Request teacher access",
      note: "One motion, one speech, one review — that is a first session.",
    },
    footer: {
      ...SHARED_CHROME.en.footerChrome,
      description:
        "Focused English argumentation and debate practice for learners and teachers.",
      guides: [
        {
          label: "The debate practice loop",
          path: "/guides/debate-practice-loop",
        },
        SHARED_GUIDES.aiFeedback.en,
        SHARED_GUIDES.teacher.en,
      ],
      disclaimer:
        "Thinkfy is an independent practice product. AI feedback is assistive and does not replace a teacher or coach.",
    },
    teacherSubject: "Thinkfy Debate teacher access",
  },
  vi: {
    product: "debate",
    productName: "Thinkfy Tranh biện",
    navigation: SHARED_CHROME.vi.navigation,
    hero: {
      eyebrow: "Lập luận tiếng Anh, luyện bằng cách nói ra",
      title: "Biến ý tưởng thành lập luận người nghe theo được.",
      lede: "Nói trọn một bài trong thời gian thật. Nhận phản hồi gắn thẳng vào bước lập luận mà nó nói tới. Kết thúc buổi luyện với đúng một việc cần sửa.",
      primary: "Bắt đầu luyện",
      primaryLoggedIn: "Mở Tranh biện",
      teacher: "Đưa Thinkfy vào lớp của bạn",
      note: "Luyện tiếng Anh tập trung cho học sinh, câu lạc bộ và đội tuyển.",
      panelLabel: "Ví dụ bản nhận xét buổi luyện kèm điểm từng nhóm tiêu chí",
    },
    panel: {
      reviewLabel: "Nhận xét buổi luyện",
      motionLabel: "Kiến nghị",
      motion:
        "Nhà này cho rằng việc đến trường nên là tự nguyện sau tuổi mười sáu.",
      speechMeta: "Bài phản biện · 3:00 · Tiếng Anh",
      scoreLabel: "Tổng",
      score: 78,
      scoreMax: 100,
      band: "Proficient",
      categories: [
        { label: "Nội dung & xây dựng luận", score: 31, max: 40 },
        { label: "Cấu trúc & chiến lược", score: 19, max: 25 },
        { label: "Ngôn ngữ & trình bày", score: 19, max: 25 },
        { label: "Thuyết phục & cân tác động", score: 9, max: 10 },
      ],
      nextMoveLabel: "Bước tiếp theo",
      nextMoveQuote: "Học sinh sẽ mất đi cấu trúc giữ cho các em tiếp tục học.",
      nextMove:
        "Bạn đã nêu được tác hại nhưng chưa đo nó. Hãy nói bao nhiêu học sinh, trong bao lâu — rồi đặt lên bàn cân với quyền tự do mà phía kia đang viện dẫn.",
      footnote:
        "Nhận xét có AI hỗ trợ. Giáo viên vẫn là người quyết định về chương trình và chiến lược thi đấu.",
    },
    loop: {
      eyebrow: "Vòng luyện",
      title: "Một câu, ba lượt nhìn.",
      lede: "Luyện tập, phản hồi và lần thử lại là cùng một phần việc được nhìn ba lần — không phải ba sản phẩm ghép vào nhau.",
      threadLabel: "Cùng một luận điểm, đi hết vòng luyện",
      steps: [
        {
          kicker: "Nói",
          title: "Nói lập luận thành lời",
          body: "Trả lời một kiến nghị trong thời gian thật, bằng tiếng Anh, như một bài nói chứ không phải một ô nhập liệu.",
          artifact:
            "“Học sinh sẽ mất đi cấu trúc giữ cho các em tiếp tục học.”",
        },
        {
          kicker: "Xem lại",
          title: "Thấy luận điểm còn thiếu gì",
          body: "Ghi chú rơi đúng vào bước lập luận nó nói tới, kèm câu nói đã tạo ra ghi chú đó.",
          artifact:
            "Tác hại được khẳng định nhưng chưa đo — không quy mô, không mốc thời gian.",
        },
        {
          kicker: "Thử lại",
          title: "Nói lại khi khoảng trống đã được lấp",
          body: "Một khuyến nghị được mang sang bài luyện kế tiếp, để bạn nghe được sự thay đổi.",
          artifact:
            "“Khoảng một phần ba học sinh mười sáu tuổi sẽ nghỉ trong vòng một năm.”",
        },
      ],
    },
    grid: {
      eyebrow: "Bạn nhận được gì",
      title: "Cả căn phòng quanh vòng đấu.",
      lede: "Mỗi màn hình phục vụ một hành động học thật: dựng luận, nói bài, hoặc đọc lại nhận xét sau đó.",
      cards: [
        {
          id: "speech",
          kicker: "Buổi luyện",
          title: "Nói trọn một bài, không phải điền vào ô trống.",
          body: "Chọn kiến nghị, bấm giờ và nói. Thinkfy ghi lại lời bạn nói và nhận xét đúng bài bạn vừa trình bày.",
          icon: "mic",
          span: "feature",
          rail: [
            { label: "Bài chuẩn bị", value: "3–7 phút" },
            { label: "Phản biện", value: "Bám đồng hồ" },
            { label: "Kho kiến nghị", value: "Được tuyển chọn" },
          ],
        },
        {
          id: "signals",
          kicker: "Tiến bộ",
          title: "Năm tín hiệu, không phải một con số.",
          body: "Một điểm tổng che mất kỹ năng đang yếu, nên ở đây chúng được theo dõi riêng qua từng buổi.",
          icon: "chart",
          span: "tall",
          rail: [
            { label: "Độ rõ", value: "Tốt", fill: 0.82 },
            { label: "Logic", value: "Ổn định", fill: 0.68 },
            { label: "Phản biện", value: "Đang lên", fill: 0.55 },
            { label: "Bằng chứng", value: "Cần chú ý", fill: 0.41 },
            { label: "Trình bày", value: "Ổn định", fill: 0.64 },
          ],
        },
        {
          id: "clash",
          kicker: "Phân tích vòng đấu",
          title: "Bản đồ đối đầu của cả vòng.",
          body: "Thấy luận điểm nào được trả lời, bị bỏ qua, bị lật ngược hay đã được cân — và điểm nào thật sự quyết định vòng đấu.",
          icon: "scale",
          span: "wide",
        },
        {
          id: "motions",
          kicker: "Chuẩn bị",
          title: "Kho kiến nghị đủ để bạn chuẩn bị.",
          body: "Kiến nghị và tư liệu dựng luận được tuyển chọn, để mỗi buổi luyện bắt đầu bằng thứ đáng tranh luận.",
          icon: "book",
          span: "wide",
        },
        {
          id: "opponent",
          kicker: "Diễn tập",
          title: "Một đối thủ biết cãi lại.",
          body: "Luyện với người nói AI để bài phản biện có thứ thật sự để phản biện.",
          icon: "usersGroup",
          span: "standard",
        },
        {
          id: "coach",
          kicker: "Trợ giảng",
          title: "Hỏi về chính bài nói của bạn.",
          body: "Trợ giảng đọc bài bạn vừa nói, nên câu trả lời nói về lập luận của bạn.",
          icon: "sparkles",
          span: "standard",
        },
      ],
    },
    proof: {
      eyebrow: "Bằng chứng sản phẩm",
      title: "Phản hồi nằm ngay cạnh câu nói.",
      lede: "Đây là thứ một buổi luyện tạo ra: bài nói của bạn, được đánh dấu chỗ hiệu quả và chỗ chưa, với cách sửa viết ngay bên cạnh dòng cần sửa.",
      transcriptLabel: "Bản ghi bài nói",
      speaker: "Người nói thứ hai · Phe phản đối",
      segments: [
        {
          text: "Phía bên kia nói rằng đi học tự nguyện là tôn trọng quyền tự quyết. ",
        },
        {
          text: "Nhưng tự quyết mà không đủ năng lực thì không phải là lựa chọn — một em mười sáu tuổi quyết định nghỉ học đang quyết định bằng thông tin của hôm nay, không phải thông tin em sẽ cần ở tuổi hai mươi lăm.",
          mark: "strength",
        },
        { text: " " },
        {
          text: "Học sinh sẽ mất đi cấu trúc giữ cho các em tiếp tục học.",
          mark: "improvement",
        },
        {
          text: " Và vì thế tác hại rơi nặng nhất lên đúng những em mà chính sách này nói là đang giải phóng.",
        },
      ],
      annotations: [
        {
          tag: "Đối đầu",
          severity: "strength",
          feedback:
            "Bạn trả lời lập luận về quyền tự quyết ngay trên chính lý lẽ của nó, thay vì lái sang chuyện khác.",
          suggestion:
            "Dùng lại cách khung này khi dựng lại luận trong bài kết.",
          suggestionLabel: "Giữ",
        },
        {
          tag: "Tác động",
          severity: "improvement",
          feedback:
            "Tác hại được khẳng định nhưng chưa đo, nên giám khảo không thể cân nó với lợi ích phía bên kia.",
          suggestion:
            "Thêm quy mô và mốc thời gian — bao nhiêu học sinh, và trong bao lâu?",
          suggestionLabel: "Thử",
        },
      ],
      legend: { strength: "Điểm hiệu quả", improvement: "Điểm cần sửa" },
      footnote:
        "Nhận xét mẫu. Nội dung bài nói chỉ mang tính minh hoạ, không phải dữ liệu học sinh.",
    },
    audiences: {
      eyebrow: "Hai lối vào",
      title: "Riêng tư cho học viên. Vận hành cho giáo viên.",
      lede: "Cùng một hệ thống luyện tập, làm hai việc khác nhau. Bên này không phải là bảng điều khiển của bên kia.",
      chooserLabel: "Bạn là ai?",
      student: {
        chooser: "Tôi là học viên",
        role: "Học viên",
        title: "Biết chính xác cần luyện gì tiếp theo",
        body: "Đi thẳng từ bài luyện đến phản hồi rồi đến việc cần làm kế tiếp, không phải lần mò qua một rừng bảng điều khiển.",
        points: [
          "Mỗi ngày một trọng tâm luyện tập",
          "Phản hồi tách theo từng kỹ năng tranh biện",
          "Diễn tập có bấm giờ, sát thi đấu",
        ],
        cta: "Bắt đầu luyện",
        sample: {
          label: "Hôm nay",
          rows: [
            {
              primary: "Bài luyện phản biện",
              secondary: "3 phút · cân tác động",
              state: "Sẵn sàng",
            },
            {
              primary: "Nhận xét gần nhất",
              secondary: "Đối đầu & hồi đáp 7/10",
              state: "Làm lại",
            },
            {
              primary: "Chuỗi ngày luyện",
              secondary: "4 ngày",
              state: "Đang giữ",
            },
          ],
        },
      },
      teacher: {
        chooser: "Tôi dạy một lớp",
        role: "Giáo viên",
        title: "Dẫn cả lớp mà không phải chấm từng bài một mình",
        body: "Giao bài luyện, nhìn ra điểm chung của cả lớp, và dành thời gian xem bài vào đúng chỗ tạo ra thay đổi.",
        points: [
          "Giao bài luyện cho lớp hoặc câu lạc bộ",
          "Một hàng đợi xem bài thay vì tệp rải rác",
          "Biết bối cảnh tiến bộ trước khi mở bài nói",
        ],
        cta: "Yêu cầu quyền giáo viên",
        sample: {
          label: "Hàng đợi xem bài",
          rows: [
            {
              primary: "Lớp 10A · Phản biện",
              secondary: "12 bài nộp",
              state: "8 chờ xem",
            },
            {
              primary: "CLB Tranh biện · Bộ kiến nghị",
              secondary: "Hạn thứ Sáu",
              state: "Đã giao",
            },
            {
              primary: "Nguyên · Bài kết",
              secondary: "Đánh dấu: bằng chứng",
              state: "Cần xem",
            },
          ],
        },
      },
    },
    honesty: {
      eyebrow: "Nói thẳng",
      title: "Những điều chúng tôi dám đứng sau.",
      lede: "Không có con số chúng tôi chưa đo, cũng không có trường chúng tôi chưa làm việc cùng. Đây là những gì sản phẩm thật sự làm.",
      items: [
        {
          label: "Phản hồi",
          value: "Gắn với tiêu chí",
          body: "Mỗi ghi chú neo vào một lựa chọn quan sát được trong bài nói, kèm câu trích đã tạo ra nó.",
        },
        {
          label: "Tiến bộ",
          value: "Năm tín hiệu riêng",
          body: "Độ rõ, logic, phản biện, bằng chứng và trình bày được theo dõi tách rời, nên một điểm tổng không che được chỗ yếu.",
        },
        {
          label: "Phán đoán",
          value: "Vẫn thuộc về con người",
          body: "AI giúp luyện thường xuyên. Chương trình, bối cảnh và chiến lược thi đấu vẫn thuộc về giáo viên.",
        },
        {
          label: "Ngôn ngữ",
          value: "Giao diện song ngữ",
          body: "Sản phẩm đọc được bằng tiếng Việt hoặc tiếng Anh. Phần luyện tập diễn ra bằng tiếng Anh.",
        },
      ],
    },
    faq: {
      eyebrow: "Trước vòng đấu đầu tiên",
      title: "Những câu nên hỏi trước.",
      lede: "Trả lời ngắn, không vòng vo.",
      items: [
        {
          question: "Thinkfy có chỉ dành cho người đi thi tranh biện?",
          answer:
            "Không. Bạn có thể dùng để luyện lập luận tiếng Anh ngay cả khi chưa vào đội nào; người đã có kinh nghiệm thì dùng để diễn tập kỹ năng thi đấu.",
        },
        {
          question: "Phản hồi AI có thay thế giáo viên hay huấn luyện viên?",
          answer:
            "Không. AI giúp bạn luyện được thường xuyên và chỉ ra các mẫu lặp lại qua nhiều buổi. Chương trình, bối cảnh và chiến lược vẫn do giáo viên quyết định.",
        },
        {
          question: "Học viên thực sự luyện những gì?",
          answer:
            "Luận điểm, lập luận, bằng chứng, phản biện, cân tác động và cách trình bày có cấu trúc — qua bài nói và phần dựng luận bằng tiếng Anh.",
        },
        {
          question: "Giáo viên dùng Thinkfy với cả lớp được không?",
          answer:
            "Được. Giáo viên giao bài luyện cho lớp hoặc câu lạc bộ và xem bài nộp trong một hàng đợi. Hãy liên hệ để được cấp quyền giáo viên và thiết lập lớp.",
        },
      ],
    },
    finalCta: {
      eyebrow: "Bắt đầu",
      title: "Dựng lập luận tiếp theo với một bước đi rõ ràng hơn.",
      body: "Bắt đầu lộ trình luyện tập, hoặc trao đổi với chúng tôi về không gian giáo viên cho lớp của bạn.",
      student: "Bắt đầu luyện",
      teacher: "Yêu cầu quyền giáo viên",
      note: "Một kiến nghị, một bài nói, một bản nhận xét — vậy là xong buổi đầu tiên.",
    },
    footer: {
      ...SHARED_CHROME.vi.footerChrome,
      description:
        "Luyện lập luận và tranh biện tiếng Anh tập trung, cho học viên và giáo viên.",
      guides: [
        {
          label: "Vòng luyện tranh biện",
          path: "/guides/debate-practice-loop",
        },
        SHARED_GUIDES.aiFeedback.vi,
        SHARED_GUIDES.teacher.vi,
      ],
      disclaimer:
        "Thinkfy là sản phẩm luyện tập độc lập. Phản hồi AI mang tính hỗ trợ và không thay thế giáo viên hay huấn luyện viên.",
    },
    teacherSubject: "Quyền giáo viên Thinkfy Tranh biện",
  },
};
