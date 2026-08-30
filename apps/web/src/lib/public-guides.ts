import type { PublicLocale } from "@/lib/public-site";

export const PUBLIC_GUIDE_SLUGS = [
  "debate-practice-loop",
  "ielts-four-skill-plan",
  "ai-feedback-method",
  "teacher-workflows",
] as const;

export type PublicGuideSlug = (typeof PUBLIC_GUIDE_SLUGS)[number];

type Guide = {
  title: string;
  description: string;
  eyebrow: string;
  summary: string;
  sections: Array<{ title: string; paragraphs: string[]; steps?: string[] }>;
  sources: Array<{ label: string; href: string }>;
};

const guides: Record<PublicLocale, Record<PublicGuideSlug, Guide>> = {
  en: {
    "debate-practice-loop": {
      eyebrow: "Debate practice guide",
      title: "A repeatable loop for improving English debate",
      description:
        "Turn one motion into focused practice, specific feedback, and a better second attempt.",
      summary:
        "Debate improves fastest when practice isolates one skill, produces observable evidence, and immediately applies feedback in another attempt.",
      sections: [
        {
          title: "1. Frame the motion",
          paragraphs: [
            "Define the motion, stakeholders, burden, and the decision the adjudicator must make. Write one sentence for your position before collecting examples.",
          ],
          steps: [
            "State the claim",
            "Explain the mechanism",
            "Show the impact",
            "Compare against the other side",
          ],
        },
        {
          title: "2. Deliver under a realistic constraint",
          paragraphs: [
            "Use a short preparation window and a fixed speech time. The goal is not a perfect script; it is a clear chain of reasoning that survives time pressure.",
          ],
        },
        {
          title: "3. Review evidence, not a personality score",
          paragraphs: [
            "Thinkfy feedback focuses on the transcript and delivery signals available in the attempt. Treat it as a coaching hypothesis: verify the cited moment, decide whether it is useful, then choose one change.",
          ],
        },
        {
          title: "4. Re-run one segment",
          paragraphs: [
            "Repeat the weakest claim, rebuttal, or conclusion instead of restarting everything. Compare clarity, support, and delivery between attempts. A small verified improvement is more useful than a vague overall score.",
          ],
        },
      ],
      sources: [],
    },
    "ielts-four-skill-plan": {
      eyebrow: "IELTS study guide",
      title: "Build an IELTS plan across all four skills",
      description:
        "Balance exam simulation, targeted drills, and careful review without treating AI rehearsal as an official score.",
      summary:
        "IELTS reports separate Listening, Reading, Writing, and Speaking scores. A useful plan therefore tracks each skill separately and spends the next study block on the clearest constraint.",
      sections: [
        {
          title: "Start with four separate baselines",
          paragraphs: [
            "Use timed Listening and Reading work to identify question-type errors. For Writing and Speaking, review performance against the published criteria instead of relying only on an overall estimate.",
          ],
        },
        {
          title: "Alternate simulation and correction",
          paragraphs: [
            "Exam simulation tests pacing and endurance. Short drills are better for fixing one recurring error. A weekly plan needs both: simulate, diagnose, drill, then re-check.",
          ],
        },
        {
          title: "Use the official criteria",
          paragraphs: [
            "Writing is assessed through task achievement or response, coherence and cohesion, lexical resource, and grammatical range and accuracy. Speaking uses fluency and coherence, lexical resource, grammatical range and accuracy, and pronunciation.",
          ],
        },
        {
          title: "Understand Thinkfy's boundary",
          paragraphs: [
            "Thinkfy's Listening, Reading, and Writing exam simulations are practice experiences. AI Speaking Rehearsal is not an official IELTS test or examiner score. Use it to generate practice evidence and questions for a teacher, not as a guaranteed band result.",
          ],
        },
      ],
      sources: [
        {
          label: "IELTS scoring in detail",
          href: "https://ielts.org/take-a-test/your-results/ielts-scoring-in-detail",
        },
        {
          label: "British Council assessment guidance",
          href: "https://takeielts.britishcouncil.org/teach-ielts/test-information/assessment",
        },
      ],
    },
    "ai-feedback-method": {
      eyebrow: "Methodology",
      title: "How to use AI feedback responsibly",
      description:
        "A transparent method for turning automated feedback into a useful next practice step.",
      summary:
        "AI feedback is most useful as a fast second opinion tied to visible evidence. It should not replace an educator, certified examiner, adjudicator, or your own judgment.",
      sections: [
        {
          title: "What the system can inspect",
          paragraphs: [
            "Depending on the activity, Thinkfy may process your response text, transcript, timing, and selected task context. Feedback should point to something you can verify in that evidence.",
          ],
        },
        {
          title: "What it cannot guarantee",
          paragraphs: [
            "AI can misunderstand a response, miss context, or apply a rubric inconsistently. A predicted result is not an official IELTS score, tournament decision, or promise of future performance.",
          ],
        },
        {
          title: "The evidence-first review",
          paragraphs: [
            "For every recommendation, ask three questions: What exact evidence supports it? Which criterion does it affect? What small change can I test in the next attempt?",
          ],
        },
        {
          title: "Escalate consequential decisions",
          paragraphs: [
            "Ask a qualified teacher or coach to review disputed feedback, high-stakes submissions, accessibility needs, or a pattern that the system cannot explain. Report unsafe or clearly incorrect output to Thinkfy support.",
          ],
        },
      ],
      sources: [],
    },
    "teacher-workflows": {
      eyebrow: "For teachers",
      title: "Use Thinkfy as a practice layer around instruction",
      description:
        "Assign focused work, inspect student evidence, and reserve teacher time for the decisions that need human judgment.",
      summary:
        "The strongest classroom role for Thinkfy is repeated low-stakes practice between lessons, with teachers retaining control over goals, interpretation, and intervention.",
      sections: [
        {
          title: "Assign one observable outcome",
          paragraphs: [
            "Choose a narrow outcome such as a supported claim, a comparative rebuttal, one IELTS question type, or one speaking criterion. Students should know what evidence will demonstrate improvement.",
          ],
        },
        {
          title: "Review patterns before individual scores",
          paragraphs: [
            "Look for repeated misconceptions, incomplete attempts, and disagreement between automated feedback and student reasoning. Use those patterns to plan the next mini-lesson.",
          ],
        },
        {
          title: "Keep human checkpoints",
          paragraphs: [
            "Teacher review remains essential for official grades, safeguarding, accommodation decisions, and any result with a meaningful consequence. AI output is a draft signal, not an authority.",
          ],
        },
        {
          title: "Start with a small pilot",
          paragraphs: [
            "Use one class, one workflow, and a short review window. Contact Thinkfy to discuss teacher access, data handling, and the current classroom feature set before wider adoption.",
          ],
        },
      ],
      sources: [],
    },
  },
  vi: {
    "debate-practice-loop": {
      eyebrow: "Hướng dẫn luyện tranh biện",
      title: "Vòng lặp luyện tranh biện tiếng Anh có thể lặp lại",
      description:
        "Biến một motion thành bài luyện tập trung, phản hồi cụ thể và lần thử thứ hai tốt hơn.",
      summary:
        "Tranh biện tiến bộ nhanh hơn khi mỗi buổi luyện tách một kỹ năng, tạo bằng chứng quan sát được và áp dụng ngay phản hồi vào lần thử tiếp theo.",
      sections: [
        {
          title: "1. Định khung motion",
          paragraphs: [
            "Xác định motion, các bên liên quan, nghĩa vụ chứng minh và quyết định mà giám khảo cần đưa ra. Viết một câu thể hiện lập trường trước khi tìm ví dụ.",
          ],
          steps: [
            "Nêu luận điểm",
            "Giải thích cơ chế",
            "Chỉ ra tác động",
            "So sánh với phía đối lập",
          ],
        },
        {
          title: "2. Trình bày trong giới hạn thực tế",
          paragraphs: [
            "Dùng thời gian chuẩn bị ngắn và thời lượng bài nói cố định. Mục tiêu không phải kịch bản hoàn hảo mà là chuỗi lập luận rõ ràng dưới áp lực thời gian.",
          ],
        },
        {
          title: "3. Xem bằng chứng, không chấm tính cách",
          paragraphs: [
            "Phản hồi Thinkfy tập trung vào bản ghi lời nói và tín hiệu trình bày có trong lần thử. Hãy xem đó là giả thuyết huấn luyện: kiểm tra đoạn được dẫn, quyết định mức hữu ích rồi chọn một thay đổi.",
          ],
        },
        {
          title: "4. Luyện lại một đoạn",
          paragraphs: [
            "Lặp lại luận điểm, phản biện hoặc kết luận yếu nhất thay vì làm lại toàn bộ. So sánh độ rõ, bằng chứng và cách trình bày giữa hai lần.",
          ],
        },
      ],
      sources: [],
    },
    "ielts-four-skill-plan": {
      eyebrow: "Hướng dẫn học IELTS",
      title: "Xây dựng kế hoạch IELTS cho cả bốn kỹ năng",
      description:
        "Cân bằng mô phỏng thi, bài tập tập trung và xem lại cẩn thận mà không coi luyện tập AI là điểm chính thức.",
      summary:
        "IELTS báo điểm riêng cho Nghe, Đọc, Viết và Nói. Vì vậy kế hoạch hữu ích cần theo dõi từng kỹ năng và dành buổi học tiếp theo cho điểm nghẽn rõ nhất.",
      sections: [
        {
          title: "Bắt đầu với bốn đường cơ sở riêng",
          paragraphs: [
            "Dùng bài Nghe và Đọc có giới hạn thời gian để tìm lỗi theo dạng câu hỏi. Với Viết và Nói, xem bài theo tiêu chí công khai thay vì chỉ dựa vào một ước lượng tổng.",
          ],
        },
        {
          title: "Luân phiên mô phỏng và sửa lỗi",
          paragraphs: [
            "Mô phỏng thi kiểm tra nhịp độ và sức bền. Bài tập ngắn phù hợp hơn để sửa một lỗi lặp lại. Kế hoạch tuần cần cả hai: mô phỏng, chẩn đoán, luyện điểm yếu rồi kiểm tra lại.",
          ],
        },
        {
          title: "Dùng tiêu chí chính thức",
          paragraphs: [
            "Viết được đánh giá theo mức hoàn thành hoặc đáp ứng yêu cầu, mạch lạc và liên kết, vốn từ, phạm vi và độ chính xác ngữ pháp. Nói dùng độ trôi chảy và mạch lạc, vốn từ, ngữ pháp và phát âm.",
          ],
        },
        {
          title: "Hiểu giới hạn của Thinkfy",
          paragraphs: [
            "Mô phỏng Nghe, Đọc và Viết của Thinkfy là trải nghiệm luyện tập. AI Speaking Rehearsal không phải bài thi IELTS chính thức hay điểm của giám khảo. Hãy dùng nó để tạo bằng chứng luyện tập và câu hỏi cho giáo viên.",
          ],
        },
      ],
      sources: [
        {
          label: "IELTS giải thích cách tính điểm",
          href: "https://ielts.org/take-a-test/your-results/ielts-scoring-in-detail",
        },
        {
          label: "Hướng dẫn đánh giá của British Council",
          href: "https://takeielts.britishcouncil.org/teach-ielts/test-information/assessment",
        },
      ],
    },
    "ai-feedback-method": {
      eyebrow: "Phương pháp",
      title: "Cách dùng phản hồi AI có trách nhiệm",
      description:
        "Phương pháp minh bạch để biến phản hồi tự động thành bước luyện tập tiếp theo hữu ích.",
      summary:
        "Phản hồi AI hữu ích nhất khi là góc nhìn thứ hai nhanh, gắn với bằng chứng nhìn thấy được. Nó không thay thế giáo viên, giám khảo được chứng nhận, trọng tài hay phán đoán của bạn.",
      sections: [
        {
          title: "Hệ thống có thể xem gì",
          paragraphs: [
            "Tùy hoạt động, Thinkfy có thể xử lý nội dung trả lời, bản ghi lời nói, thời gian và ngữ cảnh bài tập đã chọn. Phản hồi nên chỉ tới điều bạn có thể kiểm tra trong bằng chứng đó.",
          ],
        },
        {
          title: "Điều hệ thống không thể bảo đảm",
          paragraphs: [
            "AI có thể hiểu sai câu trả lời, bỏ sót ngữ cảnh hoặc áp dụng rubric thiếu nhất quán. Kết quả dự đoán không phải điểm IELTS chính thức, quyết định giải đấu hay cam kết về thành tích tương lai.",
          ],
        },
        {
          title: "Xem lại theo bằng chứng",
          paragraphs: [
            "Với mỗi gợi ý, hãy hỏi: Bằng chứng cụ thể nào hỗ trợ? Nó ảnh hưởng tiêu chí nào? Thay đổi nhỏ nào có thể kiểm tra ở lần thử tiếp theo?",
          ],
        },
        {
          title: "Chuyển cho con người khi hệ quả quan trọng",
          paragraphs: [
            "Nhờ giáo viên hoặc huấn luyện viên có chuyên môn xem phản hồi gây tranh cãi, bài nộp quan trọng, nhu cầu hỗ trợ tiếp cận hoặc mẫu lỗi hệ thống không giải thích được.",
          ],
        },
      ],
      sources: [],
    },
    "teacher-workflows": {
      eyebrow: "Dành cho giáo viên",
      title: "Dùng Thinkfy như lớp luyện tập bổ sung cho giảng dạy",
      description:
        "Giao bài tập trung, xem bằng chứng của học sinh và dành thời gian giáo viên cho quyết định cần phán đoán con người.",
      summary:
        "Vai trò phù hợp nhất của Thinkfy trong lớp là luyện tập ít áp lực giữa các buổi học, trong khi giáo viên giữ quyền kiểm soát mục tiêu, diễn giải và can thiệp.",
      sections: [
        {
          title: "Giao một kết quả quan sát được",
          paragraphs: [
            "Chọn mục tiêu hẹp như một luận điểm có bằng chứng, phản biện so sánh, một dạng câu hỏi IELTS hoặc một tiêu chí Nói. Học sinh cần biết bằng chứng nào thể hiện tiến bộ.",
          ],
        },
        {
          title: "Xem mẫu hình trước điểm cá nhân",
          paragraphs: [
            "Tìm hiểu nhầm lặp lại, bài chưa hoàn thành và chỗ phản hồi tự động mâu thuẫn với lập luận của học sinh. Dùng các mẫu đó để lên bài giảng ngắn tiếp theo.",
          ],
        },
        {
          title: "Giữ điểm kiểm tra của con người",
          paragraphs: [
            "Giáo viên vẫn cần xem xét điểm chính thức, an toàn học sinh, quyết định hỗ trợ và mọi kết quả có hệ quả đáng kể. Đầu ra AI là tín hiệu nháp, không phải thẩm quyền.",
          ],
        },
        {
          title: "Bắt đầu bằng pilot nhỏ",
          paragraphs: [
            "Dùng một lớp, một quy trình và thời gian xem xét ngắn. Liên hệ Thinkfy để trao đổi quyền truy cập giáo viên, xử lý dữ liệu và bộ tính năng lớp học hiện tại trước khi mở rộng.",
          ],
        },
      ],
      sources: [],
    },
  },
};

export function getPublicGuide(locale: PublicLocale, slug: PublicGuideSlug) {
  return guides[locale][slug];
}

export function isPublicGuideSlug(value: string): value is PublicGuideSlug {
  return PUBLIC_GUIDE_SLUGS.includes(value as PublicGuideSlug);
}
