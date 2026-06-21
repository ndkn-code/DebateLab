"use client";

import type {
  ActivityContent,
  DragOrderContent,
  FillBlankContent,
  FlashcardContent,
  LessonContent,
  MatchingContent,
  QuizContent,
} from "@/lib/types/admin";
import {
  getActivityDefinition,
  type ActivityDefinition,
  type ActivityPlayer,
  type ActivityPlayerProps,
} from "@/lib/activity/registry";
import { DragOrderPlayer } from "./DragOrderPlayer";
import { FillBlankPlayer } from "./FillBlankPlayer";
import { FlashcardPlayer } from "./FlashcardPlayer";
import { IeltsTextMicroActivityPlayer } from "./IeltsTextMicroActivityPlayer";
import { LessonPlayer } from "./LessonPlayer";
import { MatchingPlayer } from "./MatchingPlayer";
import { QuizPlayer } from "./QuizPlayer";

export type ActivityPlayerDefinition = ActivityDefinition<string, unknown> & {
  Player?: ActivityPlayer<unknown>;
};

const PLAYERS = new Map<string, ActivityPlayer<unknown>>();

export function registerActivityPlayer<TContent>(
  type: string,
  Player: ActivityPlayer<TContent>,
): void {
  PLAYERS.set(type, Player as ActivityPlayer<unknown>);
}

export function getActivityPlayerDefinition(
  type: string,
): ActivityPlayerDefinition | undefined {
  const definition = getActivityDefinition(type);
  if (!definition) return undefined;
  return { ...definition, Player: PLAYERS.get(type) };
}

function QuizRegistryPlayer({
  content,
  onComplete,
}: ActivityPlayerProps<QuizContent>) {
  return (
    <QuizPlayer
      content={content as ActivityContent}
      onComplete={(score, maxScore, responses) => {
        void onComplete(score, maxScore, responses);
      }}
    />
  );
}

function MatchingRegistryPlayer({
  content,
  onComplete,
}: ActivityPlayerProps<MatchingContent>) {
  return (
    <MatchingPlayer
      content={content as ActivityContent}
      onComplete={(score, maxScore, responses) => {
        void onComplete(score, maxScore, responses);
      }}
    />
  );
}

function FillBlankRegistryPlayer({
  content,
  onComplete,
}: ActivityPlayerProps<FillBlankContent>) {
  return (
    <FillBlankPlayer
      content={content as ActivityContent}
      onComplete={(score, maxScore, responses) => {
        void onComplete(score, maxScore, responses);
      }}
    />
  );
}

function DragOrderRegistryPlayer({
  content,
  onComplete,
}: ActivityPlayerProps<DragOrderContent>) {
  return (
    <DragOrderPlayer
      content={content as ActivityContent}
      onComplete={(score, maxScore, responses) => {
        void onComplete(score, maxScore, responses);
      }}
    />
  );
}

function FlashcardRegistryPlayer({
  content,
  onComplete,
}: ActivityPlayerProps<FlashcardContent>) {
  return (
    <FlashcardPlayer
      content={content as ActivityContent}
      onComplete={(score, maxScore, responses) => {
        void onComplete(score, maxScore, responses);
      }}
    />
  );
}

function LessonRegistryPlayer({
  content,
  onComplete,
}: ActivityPlayerProps<LessonContent>) {
  return (
    <LessonPlayer
      content={content as ActivityContent}
      onComplete={() => {
        void onComplete(1, 1, {});
      }}
    />
  );
}

registerActivityPlayer("quiz", QuizRegistryPlayer);
registerActivityPlayer("matching", MatchingRegistryPlayer);
registerActivityPlayer("fill_blank", FillBlankRegistryPlayer);
registerActivityPlayer("drag_order", DragOrderRegistryPlayer);
registerActivityPlayer("flashcard", FlashcardRegistryPlayer);
registerActivityPlayer("lesson", LessonRegistryPlayer);
registerActivityPlayer("ielts_vocab_collocation", IeltsTextMicroActivityPlayer);
registerActivityPlayer("ielts_paraphrase_transform", IeltsTextMicroActivityPlayer);
registerActivityPlayer("ielts_gap_fill", IeltsTextMicroActivityPlayer);
registerActivityPlayer("ielts_tfng_reasoning", IeltsTextMicroActivityPlayer);
registerActivityPlayer("ielts_scan_detail", IeltsTextMicroActivityPlayer);
registerActivityPlayer("ielts_sentence_transform", IeltsTextMicroActivityPlayer);
registerActivityPlayer("ielts_cohesion_linker", IeltsTextMicroActivityPlayer);
