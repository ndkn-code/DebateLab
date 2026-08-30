import { z } from "zod";

const Band = z.number().min(0).max(9).multipleOf(0.5).nullable().optional();
export const TeacherReviewBandsSchema = z.union([
  z.object({ taskAchievement: Band, coherenceCohesion: Band, lexicalResource: Band, grammaticalRangeAccuracy: Band }).strict(),
  z.object({ taskResponse: Band, coherenceCohesion: Band, lexicalResource: Band, grammaticalRangeAccuracy: Band }).strict(),
  z.object({ fluencyCoherence: Band, lexicalResource: Band, grammaticalRangeAccuracy: Band, pronunciation: Band }).strict(),
]);

export const TeacherReviewExpectedRevisionSchema = z.number().int().nonnegative();
