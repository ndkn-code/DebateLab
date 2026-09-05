import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import en from "@/i18n/messages/en.json";
import vi from "@/i18n/messages/vi.json";
import { getDashboardData } from "@/lib/api/dashboard";
import {
  createDashboardFixtureClient,
  DASHBOARD_FIXTURE_USER,
  DASHBOARD_FIXTURE_NOW,
} from "@/lib/api/__fixtures__/dashboard";
import { DashboardContent } from "./dashboard-content";

const router = {
  bfcacheId: "fixture",
  back() {},
  forward() {},
  refresh() {},
  push() {},
  replace() {},
  prefetch() {},
  hmrRefresh() {},
};
for (const locale of ["en", "vi"] as const) {
  for (const unavailable of [false, true]) {
    test(`${locale} actual home composition: ${unavailable ? "unavailable" : "empty"} copy and one dominant action`, async () => {
      const data = await getDashboardData(
        DASHBOARD_FIXTURE_USER,
        createDashboardFixtureClient(
          unavailable
            ? {
                failures: [
                  "profile",
                  "enrollments",
                  "recentSessions",
                  "scoredSessions",
                  "stats",
                  "activityLog",
                ],
              }
            : {},
        ).client,
        { now: DASHBOARD_FIXTURE_NOW, timezone: "UTC" },
      );
      const messages = locale === "vi" ? vi : en;
      const markup = renderToStaticMarkup(
        <AppRouterContext.Provider value={router}>
          <PathnameContext.Provider value={`/${locale}/dashboard`}>
            <NextIntlClientProvider
              locale={locale}
              messages={messages}
              timeZone="UTC"
              now={DASHBOARD_FIXTURE_NOW}
            >
              <DashboardContent
                data={data}
                displayName="Minh Nguyễn"
                greetingKey="greeting_morning"
                userId={DASHBOARD_FIXTURE_USER}
                showWelcome
              />
            </NextIntlClientProvider>
          </PathnameContext.Provider>
        </AppRouterContext.Provider>,
      );
      const actions = markup.match(/<(?:a|button)\b[^>]*>/g) ?? [];
      const primary = actions.filter((tag) =>
        /class="([^"]*)"/.exec(tag)?.[1].split(" ").includes("bg-primary"),
      );
      assert.equal(
        primary.length,
        1,
        "welcome, history, and alternate plan rows cannot compete with the hero",
      );
      assert.match(primary[0], /data-testid="dashboard-recommended-cta"/);
      assert.ok(markup.includes(messages.dashboard.home.dismiss_welcome));
      assert.ok(
        markup.includes(
          unavailable
            ? messages.dashboard.home.recent_practice_unavailable
            : messages.dashboard.home.recent_practice_empty_title,
        ),
      );
      assert.equal(
        markup.includes('data-testid="dashboard-retry"'),
        unavailable,
      );
      assert.equal(markup.includes('role="progressbar"'), !unavailable);
      if (locale === "vi") {
        assert.ok(!markup.includes('aria-label="Dismiss welcome message"'));
        assert.ok(!markup.includes('aria-label="Notifications"'));
        assert.ok(!markup.includes(">Level<"));
      }
    });
  }
}
