export function middleware() {
  return new Response(null, {
    status: 503,
    headers: {
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8",
    },
  });
}

export const config = {
  matcher: ["/:path*"],
};
