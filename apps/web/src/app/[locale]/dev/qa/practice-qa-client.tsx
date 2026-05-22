"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { DuelCreatePage } from "@/components/debates/duel-create-page";
import { DuelMatchmakingPage } from "@/components/debates/duel-matchmaking-page";
import { DuelResultContent } from "@/components/debates/duel-result-page";
import { DebateClashMapPanel } from "@/components/feedback/debate-clash-map-panel";
import { DebateVerdictPanel } from "@/components/feedback/debate-verdict-panel";
import { SessionReviewShell } from "@/components/feedback/session-review-shell";
import { SessionResultDashboard } from "@/components/feedback/session-result-dashboard";
import { SessionTranscriptPanel } from "@/components/feedback/session-transcript-panel";
import { PrepPhase } from "@/components/practice/prep-phase";
import { SessionConfig } from "@/components/practice/session-config";
import { SpeakingPhase } from "@/components/practice/speaking-phase";
import type { DebateDuelRoomView, DebateSession, DebateTopic } from "@/types";
import { cn } from "@/lib/utils";

type QaTab =
  | "setup"
  | "prep"
  | "speaking"
  | "feedback"
  | "history"
  | "duels"
  | "duel-result"
  | "ai-debate";
type HistoryQaTab = "overall" | "verdict" | "transcript" | "clash";

const mockTopic: DebateTopic = {
  id: "dev-motion-phone-ban",
  title: "This House would ban smartphones in secondary school classrooms",
  category: "Education & School Life",
  difficulty: "intermediate",
  context:
    "Schools are deciding whether phones should be locked away during class, allowed for learning tasks, or managed by individual teachers.",
  suggestedPoints: {
    proposition: [
      "Phones interrupt attention during hard tasks",
      "A shared rule is easier to enforce fairly",
      "Students need protected offline space",
    ],
    opposition: [
      "Phones can support research and accessibility",
      "Blanket bans punish responsible students",
      "Digital discipline should be taught, not avoided",
    ],
  },
};

const transcript =
  "I believe we should ban phones because they distract students from deep learning. First, when a notification appears, students lose focus and the teacher has to restart the explanation. This matters because classroom time is already limited. My second argument is fairness, because some students cannot control phone use while others can. But I need to explain why a school-wide rule is better than teacher discretion. In conclusion, the ban protects attention and makes learning time more equal.";

const annotatedSession: DebateSession = {
  id: "dev-annotated-feedback",
  date: new Date("2026-05-02T14:00:00-04:00").toISOString(),
  topic: mockTopic,
  side: "proposition",
  practiceTrack: "debate",
  practiceLanguage: "en",
  mode: "quick",
  prepTime: 420,
  speechTime: 420,
  transcript,
  duration: 388,
  feedback: {
    content: {
      claimClarity: 8,
      evidenceSupport: 6,
      logicCoherence: 7,
      counterArgument: 5,
      score: 26,
    },
    structure: {
      introduction: 7,
      bodyOrganization: 7,
      conclusion: 6,
      score: 20,
    },
    language: {
      vocabulary: 7,
      grammar: 8,
      fluency: 7,
      score: 22,
    },
    persuasion: {
      audienceAwareness: 4,
      impactfulness: 4,
      score: 8,
    },
    totalScore: 76,
    overallBand: "Proficient",
    scoreRationale: {
      overall:
        "The score rewards a clear stance and usable case line, but it is capped because the mechanism and comparative weighing are still underdeveloped.",
      content: {
        score: 26,
        maxScore: 40,
        rationale:
          "The student explains the attention harm and names fairness, so the core content is understandable.",
        whyNotHigher:
          "The causal chain from notification to repeated learning loss needs more proof and scale.",
        nextStep:
          "Build one full mechanism before moving to the next claim: trigger, behavior change, learning harm, and impact.",
      },
      structure: {
        score: 20,
        maxScore: 25,
        rationale:
          "The speech moves from stance to two arguments and ends with a clear conclusion.",
        whyNotHigher:
          "The second argument is introduced before the first argument is fully weighed.",
        nextStep:
          "Use signposting to separate attention, fairness, and final weighing.",
      },
      language: {
        score: 22,
        maxScore: 25,
        rationale:
          "The wording is simple, direct, and easy for a judge to follow.",
        whyNotHigher:
          "Some debate terms like teacher discretion and school-wide rule need sharper definition.",
        nextStep:
          "Define the key policy terms in one short sentence before applying them.",
      },
      persuasion: {
        score: 8,
        maxScore: 10,
        rationale:
          "The judge can see why attention matters, and the conclusion links back to equal learning time.",
        whyNotHigher:
          "The speech does not yet compare the ban world against responsible educational phone use.",
        nextStep:
          "Add one weighing sentence that says why protected class time outweighs limited phone convenience.",
      },
    },
    practiceTrack: "debate",
    practiceLanguage: "en",
    summary:
      "The stance is clear and the case has a usable attention/fairness line. The next jump is to prove the mechanism and compare why a school-wide rule beats softer alternatives.",
    strengths: [
      "The opening stance is immediate and judge-friendly.",
      "The attention impact is easy to understand.",
      "The conclusion links back to the motion.",
    ],
    improvements: [
      "Add a concrete classroom example or evidence trend.",
      "Explain why teacher discretion is weaker than a school-wide rule.",
      "Weigh attention loss against digital-learning benefits.",
    ],
    sampleArguments: [
      "A school-wide ban creates predictable norms, which reduces enforcement conflict and preserves class time.",
      "The fairest policy protects students who struggle with impulse control instead of assuming everyone can self-regulate.",
      "Limited classroom time means even small distractions compound into lost learning across a term.",
    ],
    caseSummary:
      "The case argues that phone bans protect attention and fairness, but the policy mechanism needs more depth.",
    stanceFeedback:
      "The stance is clear from the first sentence and remains stable throughout the speech.",
    argumentBreakdowns: [
      {
        name: "Attention protection",
        summary:
          "Phones create interruptions that pull students and teachers away from learning.",
        whatWorked:
          "The argument names a concrete classroom harm and links it to limited class time.",
        missingLayer:
          "The mechanism needs a fuller chain from notification to lost explanation time to lower learning outcomes.",
        betterVersion:
          "Attention protection: notifications break concentration, teachers spend time resetting the room, and repeated resets reduce learning time for everyone; because the motion is about classrooms, preserving attention should outweigh convenience.",
      },
      {
        name: "Fair enforcement",
        summary:
          "A shared rule may be fairer than leaving phone control to individual students.",
        whatWorked:
          "The speaker notices that students have different levels of self-control.",
        missingLayer:
          "The speech does not yet explain why school-wide rules beat teacher discretion.",
        betterVersion:
          "Fair enforcement: one consistent rule prevents unequal teacher-by-teacher enforcement, protects students with weaker self-control, and makes expectations predictable for the whole school.",
      },
    ],
    missingLayers: [
      "Mechanism from distraction to learning loss",
      "Comparison against teacher discretion",
      "Evidence for scale of the harm",
    ],
    weighingFeedback:
      "The speech starts weighing classroom time, but it needs a direct comparison against the benefits of phone-based learning.",
    clashFeedback:
      "The opposition's best reply is responsible educational phone use, so the case should answer why that benefit is smaller or can happen outside class.",
    strongerRebuilds: [
      "A stronger rebuild would compare worlds: in the ban world, attention is protected by a consistent norm; in the no-ban world, every teacher negotiates distractions alone, which makes learning less predictable.",
    ],
    transcriptAnnotations: [
      {
        quote:
          "we should ban phones because they distract students from deep learning",
        tag: "stance",
        severity: "strength",
        feedback:
          "This states the side and core burden immediately, so the judge knows what the speech is trying to prove.",
        suggestion:
          "Keep this first, then add one sentence previewing the two mechanisms: attention and fairness.",
      },
      {
        quote:
          "when a notification appears, students lose focus and the teacher has to restart the explanation",
        tag: "mechanism",
        severity: "improvement",
        feedback:
          "The mechanism is visible, but it stops before proving how often this harm happens or how big the learning loss becomes.",
        suggestion:
          "Add a concrete example: one interruption becomes a two-minute reset, repeated across classes and weeks.",
      },
      {
        quote:
          "I need to explain why a school-wide rule is better than teacher discretion",
        tag: "clash",
        severity: "warning",
        feedback:
          "This correctly identifies the missing comparison, but it remains meta-commentary instead of an argued rebuttal.",
        suggestion:
          "Turn it into clash: teacher discretion creates unequal rules, while a school-wide policy creates predictable expectations.",
      },
      {
        quote: "phones are harmless during every lesson",
        tag: "evidence",
        severity: "warning",
        feedback:
          "This quote is intentionally absent from the QA transcript so unmatched annotation fallback cards are covered.",
        suggestion:
          "When the quote cannot be highlighted, keep the feedback visible as a standalone card.",
      },
    ],
    detailedFeedback: {
      contentFeedback:
        "Your content has a clear stance and two usable arguments, but the warrants need one more layer of proof.",
      structureFeedback:
        "The speech moves cleanly from stance to arguments to conclusion. Add clearer signposting before the second argument.",
      languageFeedback:
        "The language is simple and easy to follow, which helps the judge track your case.",
      persuasionFeedback:
        "The case will sound more persuasive once you compare your policy against the opposition's likely alternative.",
    },
  },
};

const legacySession: DebateSession = {
  ...annotatedSession,
  id: "dev-legacy-feedback",
  feedback: annotatedSession.feedback
    ? {
        ...annotatedSession.feedback,
        summary:
          "Legacy feedback still renders without transcript annotations, so older saved sessions stay readable.",
        transcriptAnnotations: undefined,
        argumentBreakdowns: [],
        missingLayers: [],
        strongerRebuilds: [],
        caseSummary: undefined,
        stanceFeedback: undefined,
        weighingFeedback: undefined,
        clashFeedback: undefined,
      }
    : null,
};

const fullRoundSession: DebateSession = {
  ...annotatedSession,
  id: "dev-ai-full-round-feedback",
  mode: "full",
  transcript:
    "Phones distract students from deep learning. Schools can provide controlled devices or accommodations without opening every classroom to notifications. Teacher discretion creates unequal enforcement.",
  duration: 612,
  aiDifficulty: "medium",
  rounds: [
    {
      roundNumber: 1,
      type: "user-speech",
      label: "Opening Statement",
      transcript:
        "Phones distract students from deep learning. A classroom ban creates one clear rule for every teacher and gives students protected offline space.",
      duration: 176,
    },
    {
      roundNumber: 2,
      type: "ai-rebuttal",
      label: "AI Rebuttal",
      aiResponse: JSON.stringify(
        {
          rebuttal:
            "Phones can support research and accessibility for students who need translation, reminders, or assistive tools. A school should teach responsible use instead of removing the device entirely.",
          highlights: [
            {
              type: "claim",
              quote:
                "Phones can support research and accessibility for students",
              note: "Legacy JSON fixture verifies the UI renders only the rebuttal text.",
            },
          ],
        },
        null,
        2
      ),
      duration: 151,
    },
    {
      roundNumber: 3,
      type: "user-speech",
      label: "Counter-Rebuttal",
      transcript:
        "Schools can provide controlled devices or accommodations without opening every classroom to notifications. Responsible use can be taught outside active lessons, while classroom attention needs a consistent norm.",
      duration: 142,
    },
    {
      roundNumber: 4,
      type: "ai-rebuttal",
      label: "AI Closing",
      aiResponse:
        "Blanket bans punish responsible students who use phones appropriately. Teacher discretion can solve classroom distraction without a school-wide rule.",
      duration: 118,
    },
    {
      roundNumber: 5,
      type: "user-speech",
      label: "Closing Statement",
      transcript:
        "Teacher discretion creates unequal enforcement, while a school-wide rule protects learning time for everyone. Even small negotiations repeated every period become a real learning loss.",
      duration: 125,
    },
  ],
  feedback: annotatedSession.feedback
    ? {
        ...annotatedSession.feedback,
        practiceTrack: "debate",
        summary:
          "Your full-round case stayed organized across opening, rebuttal, and closing. The strongest work was narrowing the AI's accessibility objection into controlled accommodations and then comparing enforcement models clearly.",
        debateVerdict: {
          winner: "user",
          confidence: 0.78,
          summary:
            "The student wins narrowly. The AI raised real accessibility and responsible-use concerns, but the student preserved the phone-ban world by explaining controlled accommodations and consistent enforcement.",
          decidingReasons: [
            "The accessibility claim was answered with controlled devices and accommodations.",
            "The closing compared teacher discretion against a school-wide rule.",
            "The AI kept a fairness objection, but it was less weighed than the student's learning-time impact.",
          ],
          nextMove:
            "Make the weighing sentence earlier: access needs are real, but accommodations solve them without reopening daily classroom distraction.",
        },
        clashLinks: [
          {
            id: "ai-full-accessibility-answer",
            sourceRoundNumber: 2,
            sourceSpeaker: "ai",
            responseRoundNumber: 3,
            responseSpeaker: "user",
            sourceQuote:
              "Phones can support research and accessibility for students who need translation, reminders, or assistive tools.",
            responseQuote:
              "Schools can provide controlled devices or accommodations without opening every classroom to notifications",
            outcome: "answered",
            judgeRead:
              "This is the student's cleanest answer because it preserves the access benefit without conceding open phone use.",
            suggestion:
              "Add one weighing sentence explaining why controlled access beats unrestricted classroom phones.",
            tag: "logic",
          },
          {
            id: "ai-full-responsible-use-misanswered",
            sourceRoundNumber: 2,
            sourceSpeaker: "ai",
            responseRoundNumber: 3,
            responseSpeaker: "user",
            sourceQuote:
              "A school should teach responsible use instead of removing the device entirely.",
            responseQuote:
              "Responsible use can be taught outside active lessons",
            outcome: "weighed",
            judgeRead:
              "The student answers by separating digital education from active lesson time, which gives the judge a workable policy distinction.",
            suggestion:
              "Name both worlds directly: teach responsible use in advisory or computer labs, but protect core lesson time.",
            tag: "weighing",
          },
          {
            id: "ai-full-responsible-students-dropped",
            sourceRoundNumber: 4,
            sourceSpeaker: "ai",
            responseRoundNumber: null,
            responseSpeaker: null,
            sourceQuote:
              "Blanket bans punish responsible students who use phones appropriately.",
            responseQuote: null,
            outcome: "dropped",
            judgeRead:
              "The student did not directly answer the responsible-student fairness claim, so the AI keeps some ground here.",
            suggestion:
              "Answer that one rule is fairer because it prevents peer distraction and inconsistent teacher enforcement.",
            tag: "rebuttal",
          },
          {
            id: "ai-full-discretion-weighed",
            sourceRoundNumber: 4,
            sourceSpeaker: "ai",
            responseRoundNumber: 5,
            responseSpeaker: "user",
            sourceQuote:
              "Teacher discretion can solve classroom distraction without a school-wide rule.",
            responseQuote:
              "Teacher discretion creates unequal enforcement, while a school-wide rule protects learning time for everyone",
            outcome: "weighed",
            judgeRead:
              "The student wins this exchange by comparing predictable rules against repeated teacher-by-teacher negotiation.",
            suggestion:
              "Quantify the time loss to make this weighing even harder for the AI to answer.",
            tag: "clash",
          },
        ],
        transcriptAnnotations: [
          {
            quote: "Phones distract students from deep learning",
            roundNumber: 1,
            speaker: "user",
            tag: "stance",
            severity: "strength",
            feedback:
              "This opening gives the judge a clear burden for the ban world.",
            suggestion:
              "Keep this, then preview accessibility and enforcement as the two likely clashes.",
          },
          {
            quote:
              "Phones can support research and accessibility for students who need translation",
            roundNumber: 2,
            speaker: "ai",
            tag: "evidence",
            severity: "warning",
            feedback:
              "This is the AI's strongest benefit and needs direct coverage.",
            suggestion:
              "Treat this as the first clash in rebuttal instead of waiting until later.",
          },
          {
            quote:
              "Schools can provide controlled devices or accommodations without opening every classroom",
            roundNumber: 3,
            speaker: "user",
            tag: "logic",
            severity: "strength",
            feedback:
              "This is a strong narrowing answer because it solves access without conceding the whole policy.",
            suggestion:
              "Add one sentence weighing why controlled access is safer than open phone use.",
          },
          {
            quote:
              "Blanket bans punish responsible students who use phones appropriately",
            roundNumber: 4,
            speaker: "ai",
            tag: "clash",
            severity: "warning",
            feedback:
              "The AI creates a fairness claim that the student only partly answers.",
            suggestion:
              "Answer with collective fairness: predictable rules protect all students from peer distraction.",
          },
          {
            quote:
              "Teacher discretion creates unequal enforcement, while a school-wide rule protects learning time",
            roundNumber: 5,
            speaker: "user",
            tag: "weighing",
            severity: "strength",
            feedback:
              "This is the clearest comparative sentence in the round.",
            suggestion:
              "Move this comparison earlier so the judge hears the weighing before closing.",
          },
        ],
      }
    : null,
};

const mockDuelRoom: DebateDuelRoomView = {
  id: "dev-duel-room",
  shareCode: "DEVCLASH",
  topicKey: "dev-duel-topic",
  topicTitle: "This House would ban smartphones in secondary school classrooms",
  topicCategory: "Education & School Life",
  topicCategoryKey: "education",
  topicDifficulty: "intermediate",
  topicDescription:
    "A full classroom phone ban is being compared against flexible teacher-managed phone use.",
  practiceLanguage: "en",
  duelKind: "custom",
  rated: false,
  integrityStatus: "clean",
  status: "completed",
  currentPhase: "completed",
  sideAssignmentMode: "choose",
  creatorSidePreference: "proposition",
  config: {
    prepTimeSeconds: 420,
    openingTimeSeconds: 360,
    rebuttalTimeSeconds: 240,
    entryCost: 0,
  },
  phaseStartedAt: null,
  startedAt: new Date("2026-05-02T14:00:00-04:00").toISOString(),
  completedAt: new Date("2026-05-02T14:24:00-04:00").toISOString(),
  expiresAt: new Date("2026-05-03T14:00:00-04:00").toISOString(),
  createdAt: new Date("2026-05-02T13:50:00-04:00").toISOString(),
  creatorId: "dev-user",
  participants: [
    {
      id: "dev-prop-participant",
      userId: "dev-user",
      displayName: "You",
      avatarUrl: null,
      role: "proposition",
      joinedAt: new Date("2026-05-02T13:50:00-04:00").toISOString(),
      readyAt: new Date("2026-05-02T13:55:00-04:00").toISOString(),
      creditsChargedAt: null,
      completedAt: new Date("2026-05-02T14:24:00-04:00").toISOString(),
    },
    {
      id: "dev-opp-participant",
      userId: "dev-ai-opponent",
      displayName: "AI Opponent",
      avatarUrl: null,
      role: "opposition",
      joinedAt: new Date("2026-05-02T13:51:00-04:00").toISOString(),
      readyAt: new Date("2026-05-02T13:55:00-04:00").toISOString(),
      creditsChargedAt: null,
      completedAt: new Date("2026-05-02T14:24:00-04:00").toISOString(),
    },
  ],
  speeches: [
    {
      id: "dev-prop-opening",
      participantId: "dev-prop-participant",
      roundNumber: 1,
      speechType: "opening",
      side: "proposition",
      transcript:
        "Phones distract students from deep learning. A classroom ban protects attention, creates one clear rule for every teacher, and gives students an offline space where they can focus on difficult work.",
      audioStoragePath: null,
      durationSeconds: 214,
      submittedAt: new Date("2026-05-02T14:05:00-04:00").toISOString(),
      metadata: {},
    },
    {
      id: "dev-opp-opening",
      participantId: "dev-opp-participant",
      roundNumber: 2,
      speechType: "opening",
      side: "opposition",
      transcript:
        "Phones can support research and accessibility for students who need translation, reminders, or assistive tools. A school should teach responsible use instead of removing the device entirely. Blanket bans punish responsible students who use phones appropriately.",
      audioStoragePath: null,
      durationSeconds: 226,
      submittedAt: new Date("2026-05-02T14:10:00-04:00").toISOString(),
      metadata: {},
    },
    {
      id: "dev-prop-rebuttal",
      participantId: "dev-prop-participant",
      roundNumber: 3,
      speechType: "rebuttal",
      side: "proposition",
      transcript:
        "The opposition is right that phones can help with accessibility, but schools can provide controlled devices or accommodations without opening every classroom to notifications. Notifications steal attention even from students who intend to be responsible. A shared rule is fairer because everyone knows when phones are away and teachers do not negotiate the same conflict every period.",
      audioStoragePath: null,
      durationSeconds: 203,
      submittedAt: new Date("2026-05-02T14:17:00-04:00").toISOString(),
      metadata: {},
    },
    {
      id: "dev-opp-rebuttal",
      participantId: "dev-opp-participant",
      roundNumber: 4,
      speechType: "rebuttal",
      side: "opposition",
      transcript:
        "The proposition treats every student as irresponsible. Teacher discretion can solve classroom distraction without a blanket rule. Phones are already part of modern learning, so students need guided practice instead of sudden removal.",
      audioStoragePath: null,
      durationSeconds: 188,
      submittedAt: new Date("2026-05-02T14:23:00-04:00").toISOString(),
      metadata: {},
    },
  ],
  judgment: {
    winnerSide: "proposition",
    winnerParticipantId: "dev-prop-participant",
    confidence: 0.78,
    decisionSummary:
      "Proposition wins because it answers the strongest accessibility point while giving the judge a clearer classroom-management mechanism.",
    comparativeBallot: {
      caseQuality: {
        winnerSide: "proposition",
        reason: "The proposition built a more direct policy mechanism around attention and consistency.",
      },
      logic: {
        winnerSide: "proposition",
        reason: "The proposition explained why controlled accommodations can preserve access without open phone use.",
      },
      rebuttal: {
        winnerSide: "proposition",
        reason: "The key accessibility claim was answered, though the responsible-student point was only partially handled.",
      },
      weighing: {
        winnerSide: "proposition",
        reason: "Attention loss was weighed as a repeated classroom harm.",
      },
      evidence: {
        winnerSide: "tie",
        reason: "Both sides used plausible examples but neither side gave outside evidence.",
      },
      delivery: {
        winnerSide: "opposition",
        reason: "Opposition was more concise, even though its strategic coverage was thinner.",
      },
    },
    participantFeedback: {
      proposition: {
        summary:
          "Your best work was isolating accessibility and then offering a narrower accommodation answer.",
        strengths: [
          "You answered the strongest opposition benefit directly.",
          "You gave the judge a clear fairness mechanism.",
        ],
        improvements: [
          "Do more explicit weighing against responsible-use education.",
          "Use one concrete classroom example to prove scale.",
        ],
      },
      opposition: {
        summary:
          "Your accessibility benefit was strong, but the rebuttal needed to compare it against repeated attention loss.",
        strengths: [
          "You chose a sympathetic benefit around access.",
          "You challenged blanket bans with a reasonable alternative.",
        ],
        improvements: [
          "Explain why teacher discretion is enough in hard classrooms.",
          "Answer the consistency/fairness mechanism more directly.",
        ],
      },
    },
    roundBreakdown: [
      {
        roundNumber: 1,
        label: "Opening cases",
        winnerSide: "proposition",
        reason: "The proposition set a clearer burden around attention and school-wide rules.",
      },
      {
        roundNumber: 2,
        label: "Rebuttals",
        winnerSide: "proposition",
        reason: "The proposition's accessibility answer was the cleanest direct response.",
      },
    ],
    clashLinks: [
      {
        id: "dev-clash-accessibility-answer",
        sourceSpeechId: "dev-opp-opening",
        responseSpeechId: "dev-prop-rebuttal",
        sourceQuote:
          "Phones can support research and accessibility for students who need translation, reminders, or assistive tools.",
        responseQuote:
          "schools can provide controlled devices or accommodations without opening every classroom to notifications",
        outcome: "answered",
        judgeRead:
          "This is the cleanest exchange for proposition: it concedes the access benefit, then narrows the solution so the ban still survives.",
        suggestion:
          "Make the weighing explicit: access needs are real, but they can be met through accommodations while general phone use keeps harming attention.",
        tag: "logic",
      },
      {
        id: "dev-clash-responsible-use-misanswered",
        sourceSpeechId: "dev-opp-opening",
        responseSpeechId: "dev-prop-rebuttal",
        sourceQuote:
          "A school should teach responsible use instead of removing the device entirely.",
        responseQuote:
          "Notifications steal attention even from students who intend to be responsible.",
        outcome: "misanswered",
        judgeRead:
          "The response proves distraction, but it does not fully answer the education argument about teaching self-control.",
        suggestion:
          "Add a direct comparison: responsible-use lessons can happen outside class, while active lessons need a distraction-free norm.",
        tag: "clash",
      },
      {
        id: "dev-clash-responsible-students-dropped",
        sourceSpeechId: "dev-opp-opening",
        responseSpeechId: null,
        sourceQuote:
          "Blanket bans punish responsible students who use phones appropriately.",
        responseQuote: null,
        outcome: "dropped",
        judgeRead:
          "This fairness claim was left mostly unanswered, so opposition keeps a small equity argument.",
        suggestion:
          "Answer it with collective fairness: one rule protects everyone from peer distraction and prevents teacher-by-teacher inconsistency.",
        tag: "rebuttal",
      },
      {
        id: "dev-clash-discretion-weighed",
        sourceSpeechId: "dev-opp-rebuttal",
        responseSpeechId: "dev-prop-rebuttal",
        sourceQuote:
          "Teacher discretion can solve classroom distraction without a blanket rule.",
        responseQuote:
          "teachers do not negotiate the same conflict every period",
        outcome: "weighed",
        judgeRead:
          "Proposition gives the judge a comparative reason to prefer a school-wide rule: predictable enforcement saves recurring class time.",
        suggestion:
          "Quantify the tradeoff: even two minutes of negotiation per class compounds into major learning loss over a semester.",
        tag: "weighing",
      },
      {
        id: "dev-clash-modern-learning-turned",
        sourceSpeechId: "dev-opp-rebuttal",
        responseSpeechId: "dev-prop-opening",
        sourceQuote:
          "Phones are already part of modern learning, so students need guided practice instead of sudden removal.",
        responseQuote:
          "gives students an offline space where they can focus on difficult work",
        outcome: "turned",
        judgeRead:
          "The proposition reframes modern learning as needing protected deep-work time, which turns the opposition's education framing.",
        suggestion:
          "Extend the turn by saying digital skills matter, but classroom attention is the foundation for using those tools well later.",
        tag: "evidence",
      },
    ],
    summary:
      "Proposition wins on the classroom-management mechanism and stronger comparison of worlds.",
    qualityWarnings: [],
    model: "dev-fixture",
    judgedAt: new Date("2026-05-02T14:24:00-04:00").toISOString(),
  },
  viewer: {
    id: "dev-user",
    isCreator: true,
    isParticipant: true,
    participantId: "dev-prop-participant",
    role: "proposition",
  },
  canJoin: false,
  canReady: false,
  canStart: false,
};

const legacyDuelRoom: DebateDuelRoomView = {
  ...mockDuelRoom,
  id: "dev-duel-room-legacy",
  shareCode: "DEVOLD",
  judgment: mockDuelRoom.judgment
    ? {
        ...mockDuelRoom.judgment,
        clashLinks: undefined,
      }
    : null,
};

const tabs: Array<{ key: QaTab; label: string }> = [
  { key: "setup", label: "Solo setup" },
  { key: "prep", label: "Prep layout" },
  { key: "speaking", label: "Speaking layout" },
  { key: "feedback", label: "Feedback" },
  { key: "history", label: "History tabs" },
  { key: "duels", label: "Duel timers" },
  { key: "duel-result", label: "Duel result" },
  { key: "ai-debate", label: "AI debate result" },
];

function isQaTab(value: string | null): value is QaTab {
  return tabs.some((tab) => tab.key === value);
}

export function DevPracticeQaPage() {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const initialTab: QaTab = isQaTab(requestedTab) ? requestedTab : "setup";
  const requestedHistoryTab = searchParams.get("historyTab");
  const initialHistoryTab: HistoryQaTab =
    requestedHistoryTab === "transcript" ||
    requestedHistoryTab === "clash" ||
    requestedHistoryTab === "verdict"
      ? requestedHistoryTab
      : "overall";
  const defaultShowTranscript = searchParams.get("openTranscript") === "1";
  const showLegacyDuel = searchParams.get("duelLegacy") === "1";
  const [activeTab, setActiveTab] = useState<QaTab>(initialTab);
  const [prepNotes, setPrepNotes] = useState(
    "Define the clash: attention protection vs flexible educational phone use."
  );

  return (
    <main className="min-h-screen bg-[#F7FAFE]">
      <div className="mx-auto max-w-[1560px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-[#DEE8F8] bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#4D86F7]">
            Localhost QA
          </p>
          <h1 className="mt-2 text-2xl font-bold text-[#0B1424]">
            Practice timing, layout, and feedback verification
          </h1>
          <div className="mt-4 flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "rounded-md border px-3 py-2 text-sm font-semibold",
                  activeTab === tab.key
                    ? "border-[#4D86F7] bg-[#EEF4FF] text-[#3E78EC]"
                    : "border-[#DEE8F8] bg-white text-[#415069] hover:bg-[#F7FAFE]"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeTab === "setup" && (
        <div className="mx-auto max-w-xl px-4 pb-10 sm:px-6 lg:px-8">
          <SessionConfig
            topic={mockTopic}
            isBookmarked={false}
            onToggleBookmark={() => undefined}
            orbBalance={9999}
            referralCode="LOCALQA"
            onBalanceChange={() => undefined}
          />
        </div>
      )}

      {activeTab === "prep" && (
        <PrepPhase
          topic={mockTopic}
          side="proposition"
          practiceTrack="debate"
          aiHintsEnabled
          timeLeft={420}
          totalTime={420}
          progress={0.38}
          isRunning
          prepNotes={prepNotes}
          onNotesChange={setPrepNotes}
          onSkip={() => undefined}
        />
      )}

      {activeTab === "speaking" && (
        <SpeakingPhase
          topic={mockTopic}
          side="proposition"
          timeLeft={392}
          totalTime={420}
          progress={0.42}
          isRunning
          isRecording
          transcript="I believe we should ban phones because they distract students from deep learning. First, when a notification appears, students lose focus"
          interimTranscript=" and the teacher has to restart the explanation."
          prepNotes={prepNotes}
          onNotesChange={setPrepNotes}
          audioStream={null}
          speechError={null}
          onPause={() => undefined}
          onResume={() => undefined}
          onEnd={() => undefined}
          isPaused={false}
          hasReceivedSpeech
        />
      )}

      {activeTab === "feedback" && (
        <div className="space-y-8 pb-12">
          <SessionReviewShell
            overall={
              <SessionResultDashboard
                session={annotatedSession}
                backHref="/practice"
                backLabel="Back to Practice"
                showInlineReviewControls={false}
                className="max-w-none px-0 py-0"
              />
            }
            transcript={
              <SessionTranscriptPanel
                session={annotatedSession}
                annotations={annotatedSession.feedback?.transcriptAnnotations}
                backHref="/practice"
                backLabel="Back to Practice"
                emptyLabel="No transcript was recorded for this session."
                suggestionLabel="Try this"
                unmatchedLabel="Quote not found"
                roundLabel={(round) => `Round ${round}`}
              />
            }
          />
          <div className="mx-auto max-w-[1560px] px-4 sm:px-6 lg:px-8">
            <div className="rounded-lg border border-[#DEE8F8] bg-white p-4">
              <h2 className="text-lg font-bold text-[#0B1424]">
                Legacy feedback compatibility
              </h2>
              <p className="mt-1 text-sm text-[#415069]">
                This second dashboard has no transcriptAnnotations field.
              </p>
            </div>
          </div>
          <SessionResultDashboard
            session={legacySession}
            backHref="/practice"
            backLabel="Back to Practice"
            defaultShowTranscript={defaultShowTranscript}
            showInlineReviewControls={false}
          />
        </div>
      )}

      {activeTab === "history" && (
        <SessionReviewShell
          initialTab={initialHistoryTab}
          className="pb-12"
          overall={
            <SessionResultDashboard
              session={annotatedSession}
              backHref="/history"
              backLabel="Back to History"
              showInlineReviewControls={false}
              className="max-w-none px-0 py-0"
            />
          }
          transcript={
            <SessionTranscriptPanel
              session={annotatedSession}
              annotations={annotatedSession.feedback?.transcriptAnnotations}
              backHref="/history"
              backLabel="Back to History"
              emptyLabel="No transcript was recorded for this session."
              suggestionLabel="Try this"
              unmatchedLabel="Quote not found"
              roundLabel={(round) => `Round ${round}`}
            />
          }
        />
      )}

      {activeTab === "duels" && (
        <div className="space-y-8 pb-12">
          <DuelCreatePage initialTopics={[mockTopic]} />
          <DuelMatchmakingPage initialTopics={[mockTopic]} />
        </div>
      )}

      {activeTab === "duel-result" && (
        <DuelResultContent
          room={showLegacyDuel ? legacyDuelRoom : mockDuelRoom}
          initialTab={initialHistoryTab}
        />
      )}

      {activeTab === "ai-debate" && (
        <SessionReviewShell
          initialTab={initialHistoryTab}
          className="pb-12"
          verdict={<DebateVerdictPanel session={fullRoundSession} />}
          overall={
            <SessionResultDashboard
              session={fullRoundSession}
              backHref="/history"
              backLabel="Back to History"
              showInlineReviewControls={false}
              className="max-w-none px-0 py-0"
            />
          }
          transcript={
            <SessionTranscriptPanel
              session={fullRoundSession}
              annotations={fullRoundSession.feedback?.transcriptAnnotations}
              backHref="/history"
              backLabel="Back to History"
              emptyLabel="No transcript was recorded for this session."
              suggestionLabel="Try this"
              unmatchedLabel="Quote not found"
              roundLabel={(round) => `Round ${round}`}
            />
          }
          clashMap={<DebateClashMapPanel session={fullRoundSession} />}
        />
      )}
    </main>
  );
}
