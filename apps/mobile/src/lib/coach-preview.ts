import type {
  MobileCoachConversationResponse,
  MobileCoachHomeResponse,
  MobileCoachSendMessageResponse,
} from "@thinkfy/shared/coach";

const now = new Date().toISOString();

export const previewCoachHome: MobileCoachHomeResponse = {
  ok: true,
  profile: {
    displayName: "Nguyen",
    streak: 6,
    level: 4,
    credits: 1240,
    dailyGoalMinutes: 12,
    sessionsLast7: 4,
    sessionsLast30: 12,
    minutesLast7: 38,
    minutesLast30: 126,
    practiceMix: {
      speaking: 7,
      debate: 5,
      underusedTrack: "debate",
    },
    skillSnapshot: {
      metrics: [
        {
          key: "clarity",
          rawValue: 78,
          challengeAdjustedValue: 78,
          value: 78,
          effectiveSessions: 8,
          coverage: 0.9,
        },
        {
          key: "logic",
          rawValue: 71,
          challengeAdjustedValue: 71,
          value: 71,
          effectiveSessions: 7,
          coverage: 0.85,
        },
        {
          key: "rebuttal",
          rawValue: 58,
          challengeAdjustedValue: 58,
          value: 58,
          effectiveSessions: 5,
          coverage: 0.7,
        },
      ],
      overallScore: 72,
      strongestSkill: "clarity",
      weakestSkill: "rebuttal",
      sourceSessions: 12,
      confidence: 0.82,
    },
    recentTrend: {
      direction: "up",
      averageScore: 74,
      deltaFromPrevious: 6,
      sessionsAnalyzed: 6,
      summary: "Scores are rising, with stronger openings and clearer signposting.",
    },
    weaknessPatterns: [
      {
        key: "thin-rebuttal",
        label: "Thin rebuttal",
        count: 3,
        summary: "You often answer the claim but skip why your side wins the comparison.",
        relatedSkill: "rebuttal",
      },
    ],
    strengthPatterns: ["Clear opening stance", "Good examples"],
    recentSessions: [
      {
        id: "preview-session-1",
        topicTitle: "Should schools ban phones?",
        topicCategory: "Education",
        practiceTrack: "debate",
        mode: "quick",
        side: "proposition",
        totalScore: 76,
        overallBand: "B+",
        createdAt: now,
        strengths: ["Clear stance", "Good classroom example"],
        improvements: ["Compare impacts directly"],
        summary: "Strong setup; rebuttal needs one sharper weighing line.",
        transcriptExcerpt:
          "Schools should ban phones because they distract students from learning...",
        href: "/history/preview-session-1",
      },
    ],
    recommendations: [
      {
        id: "counterexample-drill",
        title: "Counterexample drill",
        description: "Practice one concession, one counterexample, and one comparison.",
        prompt:
          "Give me a 2-minute rebuttal drill for phone bans with one concession and one comparison.",
        track: "debate",
        skillKey: "rebuttal",
      },
    ],
    starterPrompts: [
      "What should I practice today based on my last feedback?",
      "Help me make my rebuttal more persuasive.",
      "Give me a short drill for clearer signposting.",
    ],
    brief: {
      strongestSkillLabel: "Clarity",
      weakestSkillLabel: "Rebuttal",
      trendSummary: "Your scores are trending up this week.",
      nextMove: "Add a direct comparison after every rebuttal.",
    },
  },
  envelope: {
    mode: "general-coaching",
    focusTitle: "Today coach plan",
    focusSummary:
      "Keep the confidence from your last session, then sharpen rebuttal comparison.",
    starterPrompts: [
      "Plan my next 10 minutes of practice.",
      "Rewrite my rebuttal into a stronger structure.",
    ],
    selectedSession: null,
  },
  conversations: [
    {
      id: "preview-conversation-1",
      title: "Rebuttal practice",
      contextType: "coach-home",
      contextId: null,
      preview: "Try concession, counterexample, comparison.",
      createdAt: now,
      updatedAt: now,
    },
  ],
};

export const previewCoachConversation: MobileCoachConversationResponse = {
  ok: true,
  conversation: previewCoachHome.conversations[0],
  messages: [
    {
      id: "preview-message-user-1",
      conversationId: "preview-conversation-1",
      role: "user",
      content: "How can I make my rebuttal sound less generic?",
      metadata: null,
      createdAt: now,
    },
    {
      id: "preview-message-assistant-1",
      conversationId: "preview-conversation-1",
      role: "assistant",
      content:
        "Use a three-part move: concede the strongest part of their claim, answer it with one concrete counterexample, then compare why your impact matters more.",
      metadata: {
        renderVersion: 1,
        summary: "Rebuttal structure",
        blocks: [
          {
            id: "formula",
            type: "opening_formula",
            title: "Use this formula",
            items: ["I agree that...", "However...", "This matters more because..."],
          },
          {
            id: "drill",
            type: "drill",
            title: "Two-minute drill",
            body: "Pick one opponent claim and write only the comparison line.",
            prompt: "Give me a new rebuttal claim to practice.",
          },
        ],
        suggestedActions: [
          {
            label: "Practice now",
            prompt: "Give me a new rebuttal claim to practice.",
            variant: "primary",
          },
        ],
      },
      createdAt: now,
    },
  ],
};

export function createPreviewCoachReply(
  message: string,
  conversationId = "preview-conversation-1",
): MobileCoachSendMessageResponse {
  const createdAt = new Date().toISOString();

  return {
    ok: true,
    conversation: {
      ...previewCoachConversation.conversation,
      id: conversationId,
      preview: "Start with concession, then compare impacts.",
      updatedAt: createdAt,
    },
    userMessage: {
      id: `preview-user-${Date.now()}`,
      conversationId,
      role: "user",
      content: message,
      metadata: null,
      createdAt,
    },
    assistantMessage: {
      id: `preview-assistant-${Date.now()}`,
      conversationId,
      role: "assistant",
      content:
        "Nice target. Make it specific: name the opponent's strongest claim, answer with one example, then close with a weighing line that starts with \"Even if...\".",
      metadata: previewCoachConversation.messages[1].metadata,
      createdAt,
    },
    envelope: previewCoachHome.envelope,
    finishReason: "stop",
  };
}
