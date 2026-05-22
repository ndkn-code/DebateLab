import { NextRequest, NextResponse } from "next/server";
import { applyEmailUnsubscribe, verifyUnsubscribeToken } from "@/lib/email/unsubscribe";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function htmlPage(input: { title: string; body: string; status?: number }) {
  return new NextResponse(
    `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${input.title}</title>
    <style>
      body { margin: 0; background: #f7fafe; color: #0b1424; font-family: Arial, Helvetica, sans-serif; }
      main { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
      section { width: min(100%, 520px); background: #fff; border: 1px solid #dee8f8; border-radius: 24px; padding: 32px; box-shadow: 0 22px 50px -38px rgba(11,20,36,.45); }
      h1 { margin: 0 0 12px; font-size: 28px; line-height: 1.18; }
      p { margin: 0; color: #415069; font-size: 16px; line-height: 1.6; }
      a { color: #3e78ec; font-weight: 800; text-decoration: none; }
    </style>
  </head>
  <body>
    <main>
      <section>
        <h1>${input.title}</h1>
        <p>${input.body}</p>
      </section>
    </main>
  </body>
</html>`,
    {
      status: input.status ?? 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    }
  );
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return htmlPage({
      title: "Thiếu mã hủy email",
      body: 'Đường link này không hợp lệ. Liên hệ <a href="mailto:support@thinkfy.net">support@thinkfy.net</a> nếu bạn cần trợ giúp.',
      status: 400,
    });
  }

  try {
    const payload = verifyUnsubscribeToken(token);
    await applyEmailUnsubscribe({
      supabase: createAdminClient(),
      payload,
      source: "footer_link",
    });

    return htmlPage({
      title: "Đã hủy nhận nhóm email này",
      body: 'Thinkfy đã ghi nhận yêu cầu của bạn. Nếu có gì cần chỉnh lại, nhắn <a href="mailto:support@thinkfy.net">support@thinkfy.net</a>.',
    });
  } catch {
    return htmlPage({
      title: "Link hủy email không hợp lệ",
      body: 'Link này đã hết hạn hoặc bị sai mã. Liên hệ <a href="mailto:support@thinkfy.net">support@thinkfy.net</a> nếu bạn cần trợ giúp.',
      status: 400,
    });
  }
}
