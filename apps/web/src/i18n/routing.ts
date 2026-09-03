import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["vi", "en"],
  defaultLocale: "vi",
  localePrefix: "always",
  localeCookie: {
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  },
});
