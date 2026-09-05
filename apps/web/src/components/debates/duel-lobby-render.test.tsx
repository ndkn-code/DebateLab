import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import type { KeyedMutator } from "swr";
import { DuelLobbySetupView } from "./duel-setup-flow";
import type { DebateDuelRoomResponse, DebateDuelRoomView } from "@/types";
import vi from "@/i18n/messages/vi.json";
import en from "@/i18n/messages/en.json";

const room: DebateDuelRoomView = {
  view: "room",
  id: "qa-room",
  shareCode: "QA1234",
  topicKey: null,
  topicTitle: "An original English motion stays in English",
  topicDescription: null,
  topicCategory: "Education",
  topicCategoryKey: "education",
  topicDifficulty: "beginner",
  practiceLanguage: "en",
  duelKind: "custom",
  rated: false,
  integrityStatus: "clean",
  status: "lobby",
  currentPhase: "lobby",
  sideAssignmentMode: "random",
  creatorSidePreference: null,
  config: {
    prepTimeSeconds: 120,
    openingTimeSeconds: 180,
    rebuttalTimeSeconds: 120,
    entryCost: 200,
  },
  phaseStartedAt: null,
  startedAt: null,
  completedAt: null,
  expiresAt: "2099-01-01T00:00:00Z",
  createdAt: "2026-09-05T00:00:00Z",
  creatorId: "creator",
  participants: [
    {
      id: "p1",
      userId: "creator",
      displayName: "QA Linh",
      avatarUrl: null,
      role: null,
      joinedAt: "2026-09-05T00:00:00Z",
      readyAt: null,
      creditsChargedAt: null,
      completedAt: null,
    },
  ],
  speeches: [],
  judgment: null,
  viewer: {
    id: "creator",
    isCreator: true,
    isParticipant: true,
    participantId: "p1",
    role: null,
  },
  canJoin: false,
  canReady: true,
  canStart: false,
};
function render(view: DebateDuelRoomView, locale: "en" | "vi" = "vi") {
  const noop = () => {};
  return renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "vi" ? vi : en}
      timeZone="UTC"
    >
      <AppRouterContext.Provider
        value={{
          bfcacheId: "qa-render",
          back: noop,
          forward: noop,
          push: noop,
          replace: noop,
          refresh: noop,
          prefetch: async () => {},
        }}
      >
        <PathnameContext.Provider value={`/${locale}/debates/QA1234`}>
          <DuelLobbySetupView
            room={view}
            mutate={noop as unknown as KeyedMutator<DebateDuelRoomResponse>}
          />
        </PathnameContext.Provider>
      </AppRouterContext.Provider>
    </NextIntlClientProvider>,
  );
}

test("Vietnamese lobby retains authored motion and debate language, exposes selectable credentials", () => {
  const html = render(room);
  assert.match(html, /An original English motion stays in English/);
  assert.match(html, /Tranh biện bằng tiếng Anh/);
  assert.match(html, /Đánh dấu sẵn sàng/);
  assert.match(html, /Chưa sẵn sàng/);
  assert.match(html, /value="\/vi\/debates\/QA1234"/);
  assert.match(html, /value="QA1234"/);
  assert.doesNotMatch(
    html,
    /duelSetup\.|Mark ready|Side pending|Share code|\(You\)/,
  );
});

test("creator, participant, joiner and observer receive only their permitted primary action", () => {
  const ready = structuredClone(room);
  ready.participants[0].readyAt = "2026-09-05T00:00:00Z";
  assert.match(render(ready), /Bỏ sẵn sàng/);
  ready.participants.push({
    ...ready.participants[0],
    id: "p2",
    userId: "opponent",
    displayName: "QA Minh",
  });
  ready.canStart = true;
  assert.match(render(ready), /Bắt đầu trận/);
  ready.canStart = false;
  ready.canReady = false;
  ready.viewer = {
    id: "observer",
    isCreator: false,
    isParticipant: false,
    participantId: null,
    role: null,
  };
  assert.match(render(ready), /Đang chờ người tạo phòng/);
  assert.doesNotMatch(
    render(ready),
    />Bắt đầu trận<|>Đánh dấu sẵn sàng<|>Bỏ sẵn sàng</,
  );
  ready.canJoin = true;
  assert.match(render(ready), /Tham gia trận/);
});

test("English labels render without translation keys", () => {
  const html = render(room, "en");
  assert.match(html, /Mark ready/);
  assert.match(html, /Human debater/);
  assert.doesNotMatch(html, /duelSetup\./);
});
