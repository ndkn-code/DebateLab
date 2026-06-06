import { getThinkfyWebCssVariables, type ThinkfyThemeMode } from "@thinkfy/shared/design-system";

function cssBlock(selector: string, mode: ThinkfyThemeMode) {
  const declarations = Object.entries(getThinkfyWebCssVariables(mode))
    .map(([name, value]) => `  ${name}: ${value};`)
    .join("\n");

  return `${selector} {\n${declarations}\n}`;
}

export function ThinkfyThemeVariables() {
  const css = `${cssBlock(":root", "light")}\n${cssBlock(".dark", "dark")}`;

  return <style id="thinkfy-theme-variables" dangerouslySetInnerHTML={{ __html: css }} />;
}
