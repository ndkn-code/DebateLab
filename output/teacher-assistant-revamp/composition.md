# Teacher assistant composition and adoption

Surface: workbench. Primary action: ask about scoped teaching work.

References inspected: Lumist AgentConversationList.tsx, AgentComposer.tsx and ManagerAiAssistant source in /Users/jacknguyen/Developer/app-lumist-ai/features/manager-ai-agent; Thinkfy components/chat/chat-area.tsx and Beautiful UI chat-frame/prompt-bar/tool-chip. Mobbin screen references: https://mobbin.com/screens/2bc7b827-089b-4245-aea7-bca28d079e44 (Base44), https://mobbin.com/screens/cb65c41e-e7b6-4bd9-af40-cd92d768e90d (Zapier), https://mobbin.com/screens/f55821bf-0d53-4ae9-92e7-4c68fcf4fffe (Mistral AI).

Observed Mobbin compositions at 768px preview width: a narrow persistent rail, conversation occupying the central canvas, bottom composer; Zapier shows concise inline action status, Mistral a clear stop control. These are visual references only, not measured original CSS. Lumist screenshots 02/06/07/10 were described by the audit; no Thinkfy live assistant failure has been reproduced.

Target geometry: desktop 208px conversation rail plus flexible transcript, at least 320px transcript width; below 1024px rail becomes an explicit history toggle with a bounded panel. Workspace fills remaining viewport with minimum 420px height; transcript alone scrolls and composer remains in normal flex footer. No secondary proposal column: review sits beside the relevant answer in the transcript, preserving width at 1280px. Transcript readable max-w-3xl, gutters 12/16/24px. Spacing uses 4/8/12/16/24px steps. Controls rounded-control (12px), rows rounded-md (8px), borders 1px.

Type inventory: type-heading-md empty prompt; type-title workspace/title; type-body answer/composer; type-label controls; type-caption timestamps/status. Hierarchy from position and weight. Surface canvas/surface-container-low rail, on-surface ink, on-surface-variant secondary text, outline-variant borders, primary only selection/send. No new tokens.

Controls: BeautifulChatFrame reused; Lumist AgentComposer source partially forked with visible Send/Stop text instead of icon-only controls, retained editable drafts, IME-safe Enter/Shift+Enter. Conversation list source adapted to title/status rows and visible New conversation; no pin/rename/delete needed for initial scope. Existing Button, Textarea, Select, markdown renderer and icons. Proposal review uses existing field-to-name mapping, localized statuses, and receipt-driven completion.

Deliberate departures: no Lumist branding/raw colors, model internals, tool debug logs, full activity feed, or per-class retry loops. One bounded run with durable progress and explicit retry; elapsed time is actual wall time, stage labels describe actual server phases. External/shared changes remain confirmation-gated.
