"use client";

import { useRef, useState, type ChangeEvent } from "react";
import {
  Menu,
  MessageSquare,
  PanelLeftClose,
  Paperclip,
  Plus,
  Send,
  Shield,
  UserRound,
} from "@/components/ui/icons";
import { ChatBubble } from "@/components/chat/chat-bubble";
import { TypingIndicator } from "@/components/chat/typing-indicator";
import type { ChatMessageLocal } from "@/components/chat/chat-shell";
import type { CoachMessageMetadata } from "@/types";

const openingMetadata: CoachMessageMetadata = {
  renderVersion: 1,
  summary:
    "Absolutely. Let's build the opening like a debate coach would: first lock the motion, then make the team line obvious, then preview the case.",
  blocks: [
    {
      id: "opening-formula",
      type: "opening_formula",
      title: "Use a 4-part opening",
      body: "A clear opening should tell the judge exactly what debate they are watching and why your side has the better world.",
      items: [
        "**Motion:** name the exact debate topic.",
        "**Stance:** say whether you support or oppose it.",
        "**Thesis:** explain your main reason in one sentence.",
        "**Roadmap:** preview your 2 strongest arguments.",
      ],
    },
    {
      id: "template",
      type: "template",
      title: "Try this template",
      body: "Today, we are debating whether [motion]. Our side believes [stance]. We support this because [reason 1] and [reason 2]. By the end of this debate, we will show that [main claim].",
    },
    {
      id: "tip",
      type: "coach_tip",
      title: "Make the thesis do real work",
      body: "Do not just say your side is correct. Say the main mechanism: what changes, who is affected, and why that matters.",
    },
    {
      id: "mistake",
      type: "common_mistake",
      title: "Do not start with vague background",
      body: "Avoid openings like 'This issue is very important in society today.' Judges hear this constantly, and it does not reveal your case.",
    },
    {
      id: "example",
      type: "example",
      title: "Example opening",
      body: 'If the motion is "Schools should ban homework," your opening could start: "We oppose this motion because homework, when designed well, gives students spaced practice and lets teachers find learning gaps before exams."',
    },
    {
      id: "next",
      type: "clarifying_question",
      title:
        "Send me your motion and side, and I'll draft the opening with you.",
    },
  ],
  suggestedActions: [],
  visualizable: true,
  visualExplainer: {
    version: 1,
    template: "argument_chain",
    title: "Claim + Mechanism → Weighing",
    subtitle: "Show how the argument works, then compare why it matters more.",
    plannerModel: "dev-reference",
    steps: [
      {
        id: "claim",
        label: "Claim",
        text: "State the point you want the judge to accept.",
        accent: "primary",
      },
      {
        id: "mechanism",
        label: "Mechanism",
        text: "Show how the claim works in the real world.",
        accent: "warning",
      },
      {
        id: "weighing",
        label: "Weighing",
        text: "Prove why this impact outweighs the other side.",
        accent: "primary",
      },
    ],
    connectors: [
      { from: "claim", to: "mechanism", label: "because" },
      { from: "mechanism", to: "weighing", label: "therefore" },
    ],
    takeaway: "Make the comparison explicit.",
  },
  visualTemplate: "argument_chain",
  visualPlannerModel: "dev-reference",
};

const drillMetadata: CoachMessageMetadata = {
  renderVersion: 1,
  summary:
    "Here is how that answer turns into a quick practice drill you can run before a round.",
  blocks: [
    {
      id: "drill",
      type: "drill",
      title: "5-minute opening drill",
      items: [
        "Minute 1: write the motion in your own words.",
        "Minute 2: write your stance in one sentence.",
        "Minute 3: name two arguments only.",
        "Minute 4: say the opening out loud once.",
        "Minute 5: remove filler and make the thesis sharper.",
      ],
    },
    {
      id: "next-steps",
      type: "next_steps",
      title: "What to send next",
      body: "Paste your draft opening, and I will mark the weak sentence, the strongest sentence, and the one thing to fix first.",
    },
  ],
  suggestedActions: [
    {
      label: "Draft opening",
      prompt: "Draft a full opening using my motion and side.",
      variant: "primary",
    },
    {
      label: "Sharpen thesis",
      prompt: "Make my thesis sharper and more debate-ready.",
      variant: "secondary",
    },
    {
      label: "Practice delivery",
      prompt: "Turn this opening into a short speaking practice drill.",
      variant: "secondary",
    },
  ],
};

const initialMessages: ChatMessageLocal[] = [
  {
    id: "user-1",
    role: "user",
    content: "Help me build a clear debate opening.",
    metadata: null,
    created_at: new Date().toISOString(),
  },
  {
    id: "assistant-1",
    role: "assistant",
    content:
      "Absolutely. Let's build the opening like a debate coach would.\n\nUse a 4-part opening: motion, stance, thesis, and roadmap.",
    metadata: openingMetadata,
    created_at: new Date().toISOString(),
  },
];

export function CoachChatMockupClient() {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [showTyping, setShowTyping] = useState(false);
  const messageIdRef = useRef(2);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const resizeAndFocusComposer = () => {
    window.requestAnimationFrame(() => {
      if (!inputRef.current) return;
      inputRef.current.focus();
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(
        inputRef.current.scrollHeight,
        160
      )}px`;
    });
  };

  const draftMockMessage = (text: string) => {
    setInput((current) => (current.length > 0 ? current : text));
    resizeAndFocusComposer();
  };

  const handleMockInput = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
    event.target.style.height = "auto";
    event.target.style.height = `${Math.min(event.target.scrollHeight, 160)}px`;
  };

  const sendMockMessage = (text?: string) => {
    const value = (text ?? input).trim();
    if (!value || showTyping) return;

    messageIdRef.current += 1;
    const messageId = messageIdRef.current;
    setMessages((current) => [
      ...current,
      {
        id: `user-${messageId}`,
        role: "user",
        content: value,
        metadata: null,
        created_at: new Date().toISOString(),
      },
    ]);
    setInput("");
    setShowTyping(true);

    window.setTimeout(() => {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${messageId}`,
          role: "assistant",
          content:
            "Here is a drill version of the coach reply so you can see another card layout.",
          metadata: drillMetadata,
          created_at: new Date().toISOString(),
        },
      ]);
      setShowTyping(false);
    }, 900);
  };

  return (
    <main className="min-h-screen bg-background text-on-surface">
      <div className="flex min-h-screen w-full">
        <aside className="hidden w-[286px] shrink-0 flex-col border-r border-outline-variant bg-white/88 lg:flex">
          <div className="flex h-[76px] items-center justify-between border-b border-outline-variant px-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-token-primary">
                <Shield className="h-5 w-5" />
              </div>
              <div className="text-xl font-semibold tracking-[-0.01em] text-on-surface">
                Thinkfy
              </div>
            </div>
            <button className="flex h-9 w-9 items-center justify-center rounded-xl text-on-surface-variant hover:bg-primary/5 hover:text-primary">
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>

          <div className="border-b border-outline-variant px-5 py-5">
            <button className="flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-primary px-4 text-sm font-semibold text-on-primary shadow-token-primary">
              <Plus className="h-4 w-4" />
              New chat
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-5 px-4 py-5">
            <div>
              <div className="px-1 text-xs font-semibold text-on-surface-variant">
                Today
              </div>
              <div className="mt-2 rounded-[12px] border-l-2 border-primary bg-primary/10 px-3 py-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1 truncate text-sm font-semibold text-primary">
                    Clear debate opening
                  </div>
                  <div className="text-xs text-on-surface-variant">2:34 PM</div>
                </div>
              </div>
            </div>

            <div>
              <div className="px-1 text-xs font-semibold text-on-surface-variant">
                Yesterday
              </div>
              <div className="mt-2 space-y-1">
                {["Impact weighing help", "Rebuttal drill"].map((title) => (
                <div
                  key={title}
                  className="flex items-center gap-3 rounded-[12px] px-3 py-3 text-on-surface-variant hover:bg-primary/5"
                >
                  <MessageSquare className="h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1 truncate text-sm font-medium">
                    {title}
                  </div>
                  <div className="text-xs">Tue</div>
                </div>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-outline-variant p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-on-surface-variant text-sm font-semibold text-white">
                N
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-on-surface">nguyen</div>
                <div className="text-xs text-on-surface-variant">View profile</div>
              </div>
              <span className="text-on-surface-variant">&gt;</span>
            </div>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-[68px] shrink-0 items-center justify-between border-b border-outline-variant bg-white/72 px-4 backdrop-blur sm:px-6">
            <div className="flex items-center gap-3">
              <button className="flex h-10 w-10 items-center justify-center rounded-xl text-on-surface-variant lg:hidden">
                <Menu className="h-5 w-5" />
              </button>
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-primary/12 bg-primary/5 text-primary">
                <Shield className="h-5 w-5" />
              </div>
              <div className="text-lg font-semibold text-on-surface">AI Coach</div>
            </div>
            <button className="hidden items-center gap-2 rounded-[12px] border border-primary/18 bg-white px-4 py-2 text-sm font-semibold text-primary shadow-token-primary sm:flex">
              <UserRound className="h-4 w-4" />
              Coach profile
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-8">
            <div className="mx-auto w-full max-w-[1040px] pb-6">
              <div className="space-y-6">
                {messages.map((message) => (
                  <ChatBubble
                    key={message.id}
                    message={message}
                    onSendMessage={sendMockMessage}
                    onDraftMessage={draftMockMessage}
                    actionsDisabled={showTyping}
                    renderStructuredMetadata
                  />
                ))}
                {showTyping && <TypingIndicator />}
              </div>
            </div>
          </div>

          <div className="px-4 pb-4 pt-2 sm:px-6 sm:pb-6">
            <div className="mx-auto w-full max-w-[920px]">
              <div className="flex items-end gap-3 rounded-[24px] border border-primary/14 bg-white px-4 py-3 shadow-token-card">
                <button className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-on-surface-variant hover:bg-primary/5 hover:text-primary sm:flex">
                  <Paperclip className="h-4 w-4" />
                </button>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={handleMockInput}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      sendMockMessage();
                    }
                  }}
                  placeholder="Ask your AI Coach anything..."
                  rows={1}
                  className="min-h-[28px] flex-1 resize-none bg-transparent px-1 py-1 text-[15px] text-on-surface placeholder:text-on-surface-variant/60 outline-none"
                />
                <button
                  onClick={() => sendMockMessage()}
                  disabled={!input.trim() || showTyping}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-token-primary disabled:bg-primary-fixed"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
