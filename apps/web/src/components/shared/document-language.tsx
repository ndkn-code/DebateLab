"use client";

import { useLayoutEffect } from "react";

type DocumentLanguageProps = {
  locale: string;
};

export function DocumentLanguage({ locale }: DocumentLanguageProps) {
  useLayoutEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}
