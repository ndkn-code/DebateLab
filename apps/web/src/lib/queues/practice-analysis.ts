import "server-only";

import { publishAiGradingJob } from "@/lib/ai/grading/publisher";
import type { PracticeAnalysisQueueMessage } from "@/lib/practice-analysis/types";

export async function enqueuePracticeAnalysis(
  message: PracticeAnalysisQueueMessage
) {
  return publishAiGradingJob({
    userId: message.userId,
    source: {
      kind: "practice_analysis",
      analysisJobId: message.jobId,
    },
  });
}
