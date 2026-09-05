import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { ResultsActions } from "./ResultsActions";
import { PendingNote } from "./SkillFeedbackPanels";
import { resultsNextStep } from "@/lib/ielts/results/next-step";
import type { ReactNode } from "react";

function render(locale: string, children: ReactNode) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={{}} timeZone="UTC">
      <AppRouterContext.Provider
        value={{
          bfcacheId: "synthetic",
          back() {},
          forward() {},
          refresh() {},
          push() {},
          replace() {},
          prefetch() {},
        }}
      >
        {children}
      </AppRouterContext.Provider>
    </NextIntlClientProvider>,
  );
}

test("completed results pair one continuation with optional review, in both locales", () => {
  for (const locale of ["en", "vi"]) {
    const html = render(
      locale,
      <ResultsActions
        nextStep={resultsNextStep(locale)}
        hasReview
        awaitingScores={false}
      />,
    );
    assert.match(html, new RegExp(`href="/${locale}/ielts/study-plan"`));
    assert.match(html, /href="#results-review"/);
    assert.doesNotMatch(html, /Refresh scores|Cập nhật điểm/);
    assert.equal(
      (html.match(/bg-primary text-primary-foreground/g) ?? []).length,
      1,
    );
  }
});

test("pending and failed results retain context and refresh without promising a grading retry", () => {
  for (const locale of ["en", "vi"]) {
    const nextStep = resultsNextStep(locale, {
      assignmentId: "a-1",
      title: "Week 1",
      className: "Class A",
    });
    const html = render(
      locale,
      <ResultsActions
        nextStep={nextStep}
        hasReview
        awaitingScores
        hasFailedScores
      />,
    );
    assert.match(html, /Class A · Week 1/);
    assert.match(html, new RegExp(`/${locale}/ielts/assigned#assignment-a-1`));
    assert.match(
      html,
      locale === "vi"
        ? /Một số kỹ năng chưa chấm được/
        : /Some skills could not be scored/,
    );
    assert.match(html, locale === "vi" ? /Cập nhật điểm/ : /Refresh scores/);
    assert.doesNotMatch(html, /Retry grading/);
  }
});

test("empty reviews omit the review anchor", () => {
  const html = render(
    "en",
    <ResultsActions
      nextStep={resultsNextStep("en")}
      hasReview={false}
      awaitingScores={false}
    />,
  );
  assert.doesNotMatch(html, /#results-review/);
});

test("failed review copy is distinct from pending marking", () => {
  for (const locale of ["en", "vi"]) {
    const failed = render(locale, <PendingNote skill="Writing" failed />);
    const pending = render(locale, <PendingNote skill="Writing" />);
    assert.match(
      failed,
      locale === "vi" ? /chưa chấm được/ : /could not be scored/,
    );
    assert.match(
      pending,
      locale === "vi" ? /vẫn đang được chấm/ : /still being scored/,
    );
  }
});
