import { NextRequest, NextResponse } from "next/server";
import {
  applyEmailUnsubscribe,
  verifyUnsubscribeToken,
} from "@/lib/email/unsubscribe";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PageLocale = "en" | "vi";

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character]!,
  );
}

function requestLocale(request: NextRequest): PageLocale {
  const requested = request.nextUrl.searchParams.get("lang");
  if (requested === "en" || requested === "vi") return requested;
  return request.headers.get("accept-language")?.toLowerCase().startsWith("vi")
    ? "vi"
    : "en";
}

function htmlPage(input: {
  title: string;
  body: string;
  locale: PageLocale;
  nonce?: string;
  status?: number;
}) {
  return new NextResponse(
    `<!doctype html>
<html lang="${input.locale}" dir="ltr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${input.title}</title>
    <style nonce="${escapeHtml(input.nonce ?? "")}">
      body { margin: 0; background: #F5F5F2; color: #333333; font-family: Arial, Helvetica, sans-serif; }
      main { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
      section { width: min(100%, 520px); background: #fff; border: 1px solid #D9D9D4; border-radius: 12px; padding: 32px; box-shadow: 0 18px 42px -34px rgba(17,17,17,.35); }
      h1 { margin: 0 0 12px; font-size: 28px; line-height: 1.18; }
      .body { margin: 0; color: #555555; font-size: 16px; line-height: 1.6; }
      a { color: #005EA8; font-weight: 800; text-decoration: underline; text-underline-offset: 2px; }
      form { margin-top: 24px; }
      button { min-height: 44px; border: 1px solid #333333; border-radius: 10px; background: #333333; color: #FFFFFF; padding: 0 18px; font: inherit; font-weight: 700; cursor: pointer; }
      button:hover { background: #1F1F1F; }
      button:focus-visible, a:focus-visible { outline: 3px solid #0077E6; outline-offset: 3px; }
    </style>
  </head>
  <body>
    <main>
      <section>
        <h1>${input.title}</h1>
        <div class="body">${input.body}</div>
      </section>
    </main>
  </body>
</html>`,
    {
      status: input.status ?? 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    },
  );
}

export async function GET(request: NextRequest) {
  const locale = requestLocale(request);
  const nonce = request.headers.get("x-nonce") ?? undefined;
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return htmlPage({
      locale,
      nonce,
      title:
        locale === "vi" ? "Thiếu mã hủy email" : "Missing unsubscribe code",
      body:
        locale === "vi"
          ? 'Đường link này không hợp lệ. Liên hệ <a href="mailto:support@thinkfy.net">support@thinkfy.net</a> nếu bạn cần trợ giúp.'
          : 'This link is invalid. Contact <a href="mailto:support@thinkfy.net">support@thinkfy.net</a> if you need help.',
      status: 400,
    });
  }

  try {
    verifyUnsubscribeToken(token);
    const safeToken = escapeHtml(token);

    return htmlPage({
      locale,
      nonce,
      title:
        locale === "vi" ? "Xác nhận hủy nhận email" : "Confirm unsubscribe",
      body:
        locale === "vi"
          ? `Bạn sắp ngừng nhận nhóm email này từ Thinkfy. Email thiết yếu về tài khoản và bảo mật vẫn được gửi.<form method="post"><input type="hidden" name="token" value="${safeToken}" /><input type="hidden" name="lang" value="vi" /><button type="submit">Xác nhận hủy nhận</button></form>`
          : `You are about to stop receiving this category of Thinkfy emails. Essential account and security email will still be sent.<form method="post"><input type="hidden" name="token" value="${safeToken}" /><input type="hidden" name="lang" value="en" /><button type="submit">Confirm unsubscribe</button></form>`,
    });
  } catch {
    return htmlPage({
      locale,
      nonce,
      title:
        locale === "vi"
          ? "Link hủy email không hợp lệ"
          : "Invalid unsubscribe link",
      body:
        locale === "vi"
          ? 'Link này đã hết hạn hoặc bị sai mã. Liên hệ <a href="mailto:support@thinkfy.net">support@thinkfy.net</a> nếu bạn cần trợ giúp.'
          : 'This link has expired or is invalid. Contact <a href="mailto:support@thinkfy.net">support@thinkfy.net</a> if you need help.',
      status: 400,
    });
  }
}

export async function POST(request: NextRequest) {
  const nonce = request.headers.get("x-nonce") ?? undefined;
  const formData = await request.formData();
  const token = formData.get("token");
  const locale = formData.get("lang") === "vi" ? "vi" : "en";

  if (typeof token !== "string" || !token) {
    return htmlPage({
      locale,
      nonce,
      title:
        locale === "vi" ? "Thiếu mã hủy email" : "Missing unsubscribe code",
      body:
        locale === "vi"
          ? 'Yêu cầu này không hợp lệ. Liên hệ <a href="mailto:support@thinkfy.net">support@thinkfy.net</a> nếu bạn cần trợ giúp.'
          : 'This request is invalid. Contact <a href="mailto:support@thinkfy.net">support@thinkfy.net</a> if you need help.',
      status: 400,
    });
  }

  try {
    const payload = verifyUnsubscribeToken(token);
    await applyEmailUnsubscribe({
      supabase: createAdminClient(),
      payload,
      source: "footer_form",
    });

    return htmlPage({
      locale,
      nonce,
      title: locale === "vi" ? "Đã hủy nhận email" : "You are unsubscribed",
      body:
        locale === "vi"
          ? 'Thinkfy đã ghi nhận yêu cầu của bạn. Nếu cần trợ giúp, liên hệ <a href="mailto:support@thinkfy.net">support@thinkfy.net</a>.'
          : 'Thinkfy saved your choice. Contact <a href="mailto:support@thinkfy.net">support@thinkfy.net</a> if you need help.',
    });
  } catch {
    return htmlPage({
      locale,
      nonce,
      title:
        locale === "vi"
          ? "Link hủy email không hợp lệ"
          : "Invalid unsubscribe link",
      body:
        locale === "vi"
          ? 'Link này đã hết hạn hoặc bị sai mã. Liên hệ <a href="mailto:support@thinkfy.net">support@thinkfy.net</a> nếu bạn cần trợ giúp.'
          : 'This link has expired or is invalid. Contact <a href="mailto:support@thinkfy.net">support@thinkfy.net</a> if you need help.',
      status: 400,
    });
  }
}
