# Teacher assistant UI

This workbench is an **adaptation** of the Lumist manager agent composition. The source files consulted were:

- `/Users/jacknguyen/Developer/app-lumist-ai/features/manager-ai-agent/components/AgentComposer.tsx`
- `/Users/jacknguyen/Developer/app-lumist-ai/features/manager-ai-agent/components/AgentConversationList.tsx`
- Thinkfy `apps/web/src/components/beautifului/chat-frame.tsx` and `prompt-bar.tsx`

The Lumist structure was partially forked: persistent conversation history, a bounded transcript, IME-safe Enter handling, and explicit running/stop states remain. Thinkfy adaptations replace Lumist locale hooks, raw/source icon imports, icon-only controls, rename/pin/delete actions, debug details, and source-specific colors with Thinkfy tokens, local UI primitives, visible text actions, and the simple public props in `TeacherAssistantView`. The mobile rail is an explicit history toggle; prompts only fill the retained draft and do not submit automatically.

Source provenance: Lumist components are internal reference material supplied in the workspace. Thinkfy's Beautiful UI primitives are already adapted under `components/beautifului` and retain their MIT provenance comments.

Lumist source revision inspected: `73875b1267cb3a6e36a82af2cd1469285a57e9e1`.
Runtime reference: `manager-agent-conversation-control-server.service.ts`, the hook's failed-submission retention, and its bounded polling pattern. This adaptation uses Thinkfy's existing authenticated RPC and AI execution contracts; it does not copy Lumist's per-class retry loop.

## Runtime and release contract

Apply `20260905150000_teacher_workspace.sql` before enabling this UI revision. The migration extends the existing center chat tables with actor-owned runs and stop requests, adds a conversation index and run-aware history, and serializes guarded completion and automatic actions with stop through database row locks. No additional Vercel API entrypoint is introduced.

The UI uses authenticated Supabase calls for history/progress/stop because Next.js queues client Server Actions sequentially. Generation remains in the existing center server action, with a 90-second run lease, provider deadline and local late-work checkpoint guard. Reload reattaches to the stored run; if the server process disappears, lease expiry becomes a retryable timeout. Retries reuse the request key with a fresh lease. Stop prevents future completion/actions; it does not undo actions whose receipts were already committed.

Notes and unpublished drafts execute automatically. Shared trial evaluations, external messages, schedule, admission and financial changes require review. Failed automatic saves can be explicitly retried through the same idempotent proposal command. Existing completed/cancelled proposals remain terminal.

Browser QA uses the localhost/development-only `/[locale]/dev/teacher-assistant-preview` route and the production component with a persisted fixture API. This fixture is not the production runtime. Database tests execute the migration in isolated PGlite with mocked external command effects. See `output/teacher-assistant-revamp/evidence.md` for exact coverage and limitations.
