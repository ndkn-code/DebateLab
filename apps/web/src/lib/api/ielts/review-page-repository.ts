import "server-only";

import {
  buildIeltsReviewSessionView,
  type IeltsReviewSessionView,
} from "@/lib/ielts/review";
import { resolveIeltsClient, type IeltsDbClient } from "./client";
import { listDueIeltsReviewItems } from "./review-repository";

export interface IeltsReviewPageData {
  view: IeltsReviewSessionView;
}

export async function getIeltsReviewPageData(
  userId: string,
  client?: IeltsDbClient,
): Promise<IeltsReviewPageData> {
  const supabase = await resolveIeltsClient(client);
  const now = new Date();
  const items = await listDueIeltsReviewItems(
    { userId, dueAt: now, limit: 100 },
    supabase,
  );

  return {
    view: buildIeltsReviewSessionView(items, { now: now.toISOString() }),
  };
}
