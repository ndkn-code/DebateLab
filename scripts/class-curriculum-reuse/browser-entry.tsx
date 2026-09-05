import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { ReuseClassDialog } from "../../apps/web/src/components/class-curriculum-reuse/ReuseClassDialog";
import { Button } from "../../apps/web/src/components/ui/button";
import { ThinkfyThemeVariables } from "../../apps/web/src/components/shared/theme-variables";
import { PageContainer } from "../../apps/web/src/components/shared/product-layout";
import type { ReuseSource } from "../../apps/web/src/lib/class-curriculum-reuse/contracts";

const locale =
  new URLSearchParams(location.search).get("locale") === "vi" ? "vi" : "en";
const dark = new URLSearchParams(location.search).get("theme") === "dark";
document.documentElement.lang = locale;
document.documentElement.classList.toggle("dark", dark);
async function call(operation: string, input?: unknown) {
  const response = await fetch(`/rpc/${operation}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input ?? {}),
  });
  return response.json();
}
function App({ sources }: { sources: ReuseSource[] }) {
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  return (
    <PageContainer size="standard">
      <ThinkfyThemeVariables />
      <p className="type-caption text-on-surface-variant">
        Isolated local QA · worktree 571d · PostgreSQL fixtures
      </p>
      <h1 className="my-4 type-heading-lg text-on-surface">
        {locale === "vi" ? "Lớp học" : "Classes"}
      </h1>
      <Button variant="outline" onClick={() => setOpen(true)}>
        {locale === "vi"
          ? "Tạo lớp từ lớp có sẵn"
          : "Create from existing class"}
      </Button>
      {created && (
        <p role="status" className="mt-4 type-body text-on-surface">
          {locale === "vi" ? "Đã tạo lớp nháp" : "Draft class created"}:{" "}
          {created}
        </p>
      )}
      <ReuseClassDialog
        open={open}
        onOpenChange={setOpen}
        sources={sources}
        locale={locale}
        loadPreview={(sourceClassId, dates) =>
          call("preview", { sourceClassId, dates })
        }
        createClass={(input) => call("create", input)}
        onCreated={(id) => {
          setCreated(id);
          setOpen(false);
          history.pushState(
            null,
            "",
            `?locale=${locale}&theme=${dark ? "dark" : "light"}&classId=${id}`,
          );
        }}
      />
    </PageContainer>
  );
}
call("sources").then((result) => {
  if (!result.ok) throw new Error(result.code);
  createRoot(document.getElementById("root")!).render(
    <App sources={result.data} />,
  );
});
