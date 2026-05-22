import type { DebateRound, PracticeLanguage, PracticeTrack } from "@/types";
import {
  getBoolean,
  getEnum,
  getNumber,
  getString,
  getJsonRecord,
  isPlainRecord,
  RequestValidationError,
  type JsonRecord,
} from "@/lib/api/request-validation";
import { normalizeRebuttalText } from "@/lib/rebuttal/structured-response";
import type { PracticeAnalysisInput } from "./types";
import type { ClubPracticeContext, DebateMemory, MotionBrief } from "@/types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseRound(value: unknown, index: number): DebateRound {
  if (!isPlainRecord(value)) {
    throw new RequestValidationError(`rounds[${index}] is invalid.`);
  }

  const roundNumber =
    typeof value.roundNumber === "number" && Number.isFinite(value.roundNumber)
      ? Math.max(1, Math.floor(value.roundNumber))
      : index + 1;
  const type =
    value.type === "ai-rebuttal" || value.type === "user-speech"
      ? value.type
      : "user-speech";
  const label =
    typeof value.label === "string"
      ? value.label.trim().slice(0, 80)
      : `Round ${roundNumber}`;
  const transcript =
    typeof value.transcript === "string"
      ? value.transcript.trim().slice(0, 12000)
      : undefined;
  const aiResponse =
    typeof value.aiResponse === "string"
      ? normalizeRebuttalText(value.aiResponse).slice(0, 12000)
      : undefined;
  const duration =
    typeof value.duration === "number" && Number.isFinite(value.duration)
      ? Math.max(0, Math.min(7200, Math.floor(value.duration)))
      : undefined;

  return { roundNumber, type, label, transcript, aiResponse, duration };
}

function getOptionalUuid(body: JsonRecord, key: string) {
  const value = getString(body, key, { maxLength: 64 });
  if (!value) return undefined;
  if (!UUID_PATTERN.test(value)) {
    throw new RequestValidationError(`${key} is invalid.`);
  }
  return value;
}

function getOptionalString(body: JsonRecord, key: string, maxLength: number) {
  return getString(body, key, { maxLength });
}

function readStringArray(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim().slice(0, maxLength) : ""))
    .filter(Boolean)
    .slice(0, maxItems);
}

function parseMotionBrief(value: unknown): MotionBrief | undefined {
  if (!isPlainRecord(value)) return undefined;
  const keyTerms = readStringArray(value.keyTerms, 8, 240);
  const scope = typeof value.scope === "string" ? value.scope.trim().slice(0, 1200) : "";
  const propositionBurden =
    typeof value.propositionBurden === "string"
      ? value.propositionBurden.trim().slice(0, 1200)
      : "";
  const oppositionBurden =
    typeof value.oppositionBurden === "string"
      ? value.oppositionBurden.trim().slice(0, 1200)
      : "";
  const modelClarification =
    typeof value.modelClarification === "string"
      ? value.modelClarification.trim().slice(0, 1200)
      : "";

  if (
    keyTerms.length === 0 ||
    !scope ||
    !propositionBurden ||
    !oppositionBurden ||
    !modelClarification
  ) {
    return undefined;
  }

  return {
    keyTerms,
    scope,
    propositionBurden,
    oppositionBurden,
    modelClarification,
  };
}

function parseDebateMemory(value: unknown): DebateMemory | undefined {
  if (!isPlainRecord(value)) return undefined;
  const aiSide =
    value.aiSide === "proposition" || value.aiSide === "opposition"
      ? value.aiSide
      : null;
  const studentSide =
    value.studentSide === "proposition" || value.studentSide === "opposition"
      ? value.studentSide
      : null;
  const policyModel =
    typeof value.policyModel === "string"
      ? value.policyModel.trim().slice(0, 1200)
      : "";

  if (!aiSide || !studentSide || !policyModel) return undefined;

  return {
    aiSide,
    studentSide,
    policyModel,
    priorAiClaims: readStringArray(value.priorAiClaims, 12, 500),
    concessions: readStringArray(value.concessions, 8, 500),
    activeClashes: readStringArray(value.activeClashes, 12, 500),
    droppedClaims: readStringArray(value.droppedClaims, 8, 500),
  };
}

function parseClubContext(body: JsonRecord): ClubPracticeContext | undefined {
  const raw = getJsonRecord(body, "clubContext", { maxBytes: 2048 });
  const context: ClubPracticeContext = {};
  if (typeof raw.clubId === "string" && UUID_PATTERN.test(raw.clubId)) {
    context.clubId = raw.clubId;
  }
  if (typeof raw.classId === "string" && UUID_PATTERN.test(raw.classId)) {
    context.classId = raw.classId;
  }
  if (typeof raw.assignmentId === "string" && UUID_PATTERN.test(raw.assignmentId)) {
    context.assignmentId = raw.assignmentId;
  }
  if (typeof raw.assignmentTitle === "string") {
    context.assignmentTitle = raw.assignmentTitle.trim().slice(0, 200);
  }
  return Object.keys(context).length > 0 ? context : undefined;
}

export function parsePracticeAnalysisInput(body: JsonRecord): PracticeAnalysisInput {
  const transcript = getString(body, "transcript", {
    required: true,
    minLength: 1,
    maxLength: 45000,
  })!;
  const topic = getString(body, "topic", {
    required: true,
    minLength: 2,
    maxLength: 300,
  })!;
  const side = getEnum(body, "side", ["proposition", "opposition"] as const, {
    required: true,
  })!;
  const practiceTrack = getEnum(
    body,
    "practiceTrack",
    ["speaking", "debate"] as const,
    { defaultValue: "debate" }
  ) as PracticeTrack;
  const practiceLanguage = getEnum(
    body,
    "practiceLanguage",
    ["en", "vi"] as const,
    { defaultValue: "en" }
  ) as PracticeLanguage;
  const mode = getEnum(body, "mode", ["quick", "full"] as const, {
    defaultValue: practiceTrack === "speaking" ? "quick" : "full",
  })!;
  const roundsValue = body.rounds;
  const rounds =
    roundsValue == null
      ? undefined
      : Array.isArray(roundsValue) && roundsValue.length <= 12
        ? roundsValue.map(parseRound)
        : (() => {
            throw new RequestValidationError("rounds is invalid.");
          })();

  return {
    attemptId: getOptionalUuid(body, "attemptId"),
    transcript,
    topic,
    side,
    speechType: getString(body, "speechType", {
      maxLength: 80,
      defaultValue: practiceTrack === "speaking" ? "Speaking Practice" : "Opening Statement",
    })!,
    timeLimit: getNumber(body, "timeLimit", {
      min: 0,
      max: 7200,
      defaultValue: 2,
    })!,
    actualDuration: getNumber(body, "actualDuration", {
      min: 0,
      max: 7200,
      defaultValue: 0,
    })!,
    practiceTrack,
    practiceLanguage,
    isFullRound: Boolean(getBoolean(body, "isFullRound", false)),
    rounds,
    motionBrief: parseMotionBrief(body.motionBrief),
    debateMemory: parseDebateMemory(body.debateMemory),
    mode,
    prepTime: getNumber(body, "prepTime", {
      min: 0,
      max: 7200,
      defaultValue: 0,
    })!,
    speechTime: getNumber(body, "speechTime", {
      min: 0,
      max: 7200,
      defaultValue: 0,
    })!,
    prepNotes: getOptionalString(body, "prepNotes", 12000),
    aiDifficulty: getEnum(body, "aiDifficulty", ["easy", "medium", "hard"] as const),
    topicId: getOptionalUuid(body, "topicId"),
    practiceTopicKey: getOptionalString(body, "practiceTopicKey", 160),
    topicCategory: getString(body, "topicCategory", {
      maxLength: 120,
      defaultValue: "Practice",
    })!,
    topicCategoryKey: getOptionalString(body, "topicCategoryKey", 160),
    topicDifficulty: getEnum(
      body,
      "topicDifficulty",
      ["beginner", "intermediate", "advanced"] as const,
      { defaultValue: "intermediate" }
    )!,
    audioStoragePath: getOptionalString(body, "audioStoragePath", 600),
    clubContext: parseClubContext(body),
  };
}

export function getPracticeAnalysisWordCount(input: Pick<PracticeAnalysisInput, "transcript">) {
  return input.transcript.split(/\s+/).filter((word) => word.length > 0).length;
}
