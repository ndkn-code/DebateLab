"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  ProductIcon,
  type ProductIconName,
} from "@/components/ui/product-icon";
import { cn } from "@/lib/utils";
import {
  IELTS_PLAYER_EXPERIENCE_COPY,
  type IeltsPlayerExperience,
  type IeltsPlayerLocale,
} from "./player-experience";

type GuideItem = {
  title: string;
  description: string;
  icon: ProductIconName;
};

const GUIDE_ITEMS: Record<
  IeltsPlayerLocale,
  Record<IeltsPlayerExperience, GuideItem[]>
> = {
  en: {
    exam_simulation: [
      {
        title: "Fixed section order",
        description:
          "Complete Listening, Reading, then Writing. Submitted sections cannot be reopened.",
        icon: "listChecks",
      },
      {
        title: "Highlight",
        description: "Mark useful evidence in Reading passages while you work.",
        icon: "highlighter",
      },
      {
        title: "Flag and review",
        description:
          "Save uncertain questions and review them before submission.",
        icon: "bookmark",
      },
      {
        title: "Section timer",
        description:
          "The countdown stays visible. Listening audio plays once, and no feedback appears during the attempt.",
        icon: "timer",
      },
    ],
    guided_practice: [
      {
        title: "Work at your pace",
        description: "Pause and revisit questions while building the skill.",
        icon: "timer",
      },
      {
        title: "Use learning support",
        description:
          "Use hints or feedback when the activity makes them available.",
        icon: "info",
      },
      {
        title: "Review the result",
        description: "Check explanations and decide what to practise next.",
        icon: "checkCircle",
      },
    ],
    speaking_rehearsal: [
      {
        title: "Allow microphone access",
        description:
          "Your browser needs microphone permission to record an answer.",
        icon: "micStage",
      },
      {
        title: "Answer naturally",
        description:
          "Use the preparation cue, then record a complete spoken response.",
        icon: "messageCircle",
      },
      {
        title: "Use feedback carefully",
        description:
          "AI feedback supports practice; it is not an official IELTS result.",
        icon: "info",
      },
    ],
  },
  vi: {
    exam_simulation: [
      {
        title: "Thứ tự phần thi cố định",
        description:
          "Làm lần lượt Nghe, Đọc rồi Viết. Không thể mở lại phần đã nộp.",
        icon: "listChecks",
      },
      {
        title: "Đánh dấu",
        description: "Đánh dấu bằng chứng hữu ích trong bài Đọc khi làm bài.",
        icon: "highlighter",
      },
      {
        title: "Gắn cờ và xem lại",
        description: "Lưu câu chưa chắc và xem lại trước khi nộp.",
        icon: "bookmark",
      },
      {
        title: "Đồng hồ từng phần",
        description:
          "Thời gian còn lại luôn hiển thị. Bản ghi Nghe chỉ phát một lần và không có phản hồi trong lúc làm bài.",
        icon: "timer",
      },
    ],
    guided_practice: [
      {
        title: "Làm theo nhịp của bạn",
        description: "Tạm dừng và xem lại câu hỏi trong khi rèn kỹ năng.",
        icon: "timer",
      },
      {
        title: "Dùng hỗ trợ học tập",
        description: "Dùng gợi ý hoặc phản hồi khi hoạt động có cung cấp.",
        icon: "info",
      },
      {
        title: "Xem lại kết quả",
        description: "Đọc giải thích và chọn nội dung cần luyện tiếp.",
        icon: "checkCircle",
      },
    ],
    speaking_rehearsal: [
      {
        title: "Cho phép dùng micro",
        description: "Trình duyệt cần quyền dùng micro để ghi âm câu trả lời.",
        icon: "micStage",
      },
      {
        title: "Trả lời tự nhiên",
        description: "Dùng gợi ý chuẩn bị rồi ghi âm câu trả lời nói đầy đủ.",
        icon: "messageCircle",
      },
      {
        title: "Dùng phản hồi đúng cách",
        description:
          "Phản hồi AI hỗ trợ luyện tập, không phải kết quả IELTS chính thức.",
        icon: "info",
      },
    ],
  },
};

export function MockPreTestGuide({
  className,
  showHeading = true,
  experience = "exam_simulation",
  locale = "en",
}: {
  className?: string;
  showHeading?: boolean;
  experience?: IeltsPlayerExperience;
  locale?: IeltsPlayerLocale;
}) {
  const reducedMotion = useReducedMotion();
  const copy = IELTS_PLAYER_EXPERIENCE_COPY[locale][experience];
  const items = GUIDE_ITEMS[locale][experience];

  return (
    <section
      aria-label={showHeading ? undefined : copy.guideTitle}
      className={cn(
        "w-full rounded-xl border border-outline-variant bg-surface-container-low p-3 text-left",
        className,
      )}
      data-ielts-exam="guide"
    >
      {showHeading ? (
        <h2 className="type-title text-on-surface">{copy.guideTitle}</h2>
      ) : null}
      <motion.div
        initial={reducedMotion ? undefined : "hidden"}
        animate="open"
        variants={{
          open: {
            transition: { staggerChildren: reducedMotion ? 0 : 0.035 },
          },
        }}
        className={cn("grid gap-2", showHeading && "mt-3")}
      >
        {items.map((item) => (
          <motion.div
            key={item.title}
            variants={
              reducedMotion
                ? undefined
                : {
                    hidden: { opacity: 0, y: 8 },
                    open: { opacity: 1, y: 0 },
                  }
            }
            className="flex min-h-12 items-center gap-3 rounded-control border border-outline-variant bg-surface px-3 py-2 text-on-surface"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-container text-primary">
              <ProductIcon name={item.icon} size="sm" weight="duotone" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block type-label font-semibold text-on-surface">
                {item.title}
              </span>
              <span className="mt-0.5 block type-caption leading-5 text-on-surface-variant">
                {item.description}
              </span>
            </span>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
