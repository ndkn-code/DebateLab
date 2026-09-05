import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { NextIntlClientProvider } from "next-intl";

// SSR alone ignores 'use client'. Model the client helper boundary explicitly so
// reverting the import to ui/button fails even though ordinary SSR would pass.
async function main() {
  const result = await build({
    stdin: {
      contents: `export { OrganizationAdminWorkbench } from './apps/web/src/components/admin/organizations/OrganizationAdminWorkbench'; export { OrganizationOverview } from './apps/web/src/components/organizations/organization-overview'; export { GlobalMap } from './apps/web/src/components/admin/overview/GlobalMap'; export { ApiUsageChart } from './apps/web/src/components/admin/overview/ApiUsageChart'; export { PopularCoursesList } from './apps/web/src/components/admin/overview/PopularCoursesList';`,
      resolveDir: process.cwd(),
      loader: "ts",
    },
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    packages: "external",
    tsconfig: "apps/web/tsconfig.json",
    plugins: [
      {
        name: "client-boundary",
        setup(builder) {
          builder.onLoad(
            { filter: /(CentreAnalyticsPanel|organization-switcher)\.tsx$/ },
            () => ({
              contents:
                "export const CentreAnalyticsPanel = () => null; export const OrganizationSwitcher = () => null;",
              loader: "tsx",
            }),
          );
          builder.onLoad({ filter: /components\/ui\/button\.tsx$/ }, () => ({
            contents: `import {createElement} from 'react'; export const Button = ({children, ...props}) => createElement('button', props, children); export function buttonVariants(){throw new Error('Attempted to call buttonVariants() from the server but buttonVariants is on the client.');}`,
            loader: "tsx",
          }));
        },
      },
    ],
  });
  const mod = {
    exports: {} as Record<
      string,
      (props: Record<string, unknown>) => ReturnType<typeof createElement>
    >,
  };
  new Function("require", "module", "exports", result.outputFiles[0].text)(
    createRequire(import.meta.url),
    mod,
    mod.exports,
  );
  const filters = { query: "", type: "all", status: "all" };
  for (const locale of ["en", "vi"]) {
    const render = (props: Record<string, unknown>) =>
      renderToStaticMarkup(
        createElement(mod.exports.OrganizationAdminWorkbench, {
          locale,
          filters,
          organizations: [],
          ...props,
        }),
      );
    const messages = JSON.parse(
      readFileSync(`apps/web/src/i18n/messages/${locale}.json`, "utf8"),
    );
    const localized = (component: string, props: Record<string, unknown>) =>
      renderToStaticMarkup(
        createElement(NextIntlClientProvider, {
          locale,
          messages,
          timeZone: "UTC",
          children: createElement(mod.exports[component], props),
        }),
      );
    const map = localized("GlobalMap", { geoData: [] });
    assert.ok(map.includes(messages.admin.overview.noGeoData));
    assert.ok(map.includes(messages.admin.overview.globalUsers));
    const costs = localized("ApiUsageChart", { data: [] });
    assert.ok(costs.includes(messages.admin.overview.totalCost));
    const courses = localized("PopularCoursesList", {
      courses: [
        {
          course_id: "qa-course",
          title: "User-authored English title",
          enrollment_count: 1,
        },
      ],
    });
    assert.ok(
      courses.includes("User-authored English title"),
      "user-authored course titles stay unchanged",
    );
    const empty = render({});
    assert.match(
      empty,
      new RegExp(
        locale === "vi" ? "Chưa có tổ chức nào" : "No organizations yet",
      ),
    );
    assert.ok(empty.includes(`/${locale}/dashboard/admin/organizations/new`));
    const rows = render({
      organizations: [
        {
          id: "qa-active",
          name: "QA School",
          type: "school",
          status: "active",
          memberCount: 3,
          classCount: 2,
        },
        {
          id: "qa-draft",
          name: "QA Draft",
          type: "club",
          status: "draft",
          memberCount: 0,
          classCount: 0,
        },
      ],
    });
    assert.ok(
      rows.includes(`/${locale}/dashboard/admin/organizations/qa-active`),
    );
    assert.ok(
      rows.includes(`/${locale}/dashboard/admin/organizations/qa-draft/setup`),
    );
    assert.ok(rows.includes("QA School"));
    const noMatches = render({ filters: { ...filters, query: "missing" } });
    assert.ok(
      noMatches.includes(
        locale === "vi"
          ? "Không có tổ chức phù hợp"
          : "No matching organizations",
      ),
    );
    const failed = render({
      loadError: true,
      filters: { query: "A & B", type: "school", status: "active" },
    });
    assert.ok(failed.includes('role="alert"'));
    assert.ok(failed.includes("q=A+%26+B"));
    assert.ok(
      !failed.includes(
        locale === "vi"
          ? "Không có tổ chức phù hợp"
          : "No matching organizations",
      ),
    );
    for (const state of ["empty", "error"]) {
      const detail = renderToStaticMarkup(
        createElement(mod.exports.OrganizationOverview, { locale, state }),
      );
      assert.ok(detail.includes(`/${locale}/dashboard/admin/organizations`));
    }
  }
  const boundary = readFileSync(
    path.resolve(
      "apps/web/src/app/[locale]/(protected)/dashboard/admin/error.tsx",
    ),
    "utf8",
  );
  assert.ok(
    !boundary.includes("error.message"),
    "raw diagnostics must not be visible",
  );
  assert.ok(
    boundary.includes("router.refresh()") && boundary.includes("reset()"),
  );
  console.log(
    "Admin rendering: EN/VI populated, empty, filtered, load-error, detail empty/error and client-helper boundary passed.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
