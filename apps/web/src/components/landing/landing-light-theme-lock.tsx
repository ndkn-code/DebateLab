"use client";

import { useEffect } from "react";

export function LandingLightThemeLock() {
  useEffect(() => {
    const root = document.documentElement;
    const previousClassName = root.className;
    const previousColorScheme = root.style.colorScheme;
    let applying = false;

    const applyLightTheme = () => {
      if (applying) return;
      applying = true;
      root.classList.remove("dark");
      root.classList.add("light");
      root.style.colorScheme = "light";
      applying = false;
    };

    const observer = new MutationObserver(applyLightTheme);
    observer.observe(root, {
      attributeFilter: ["class", "style"],
      attributes: true,
    });

    applyLightTheme();

    return () => {
      observer.disconnect();
      root.className = previousClassName;
      root.style.colorScheme = previousColorScheme;
    };
  }, []);

  return null;
}
