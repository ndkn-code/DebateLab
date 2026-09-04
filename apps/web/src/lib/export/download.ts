/**
 * Browser side of the export transport (B3).
 *
 * Exports cannot use a route handler (`scripts/ci/checks/no-new-vercel-functions.ts`),
 * so a server action returns an `ExportPayload` and this rebuilds the file from
 * base64 and hands it to the browser. DOM-only — never import it from a server
 * module; that is why `@/lib/export` does not re-export it.
 */
import { decodeExportPayload, type ExportPayload } from "./index";

export type { ExportPayload } from "./index";

/** Trigger a download for a payload returned by an export server action. */
export function downloadExportFile(payload: ExportPayload): void {
  const bytes = decodeExportPayload(payload);
  // Copy into a fresh ArrayBuffer so Blob never sees a SharedArrayBuffer view.
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const url = URL.createObjectURL(new Blob([buffer], { type: payload.mimeType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = payload.filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Safari needs the URL alive past the click tick.
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
