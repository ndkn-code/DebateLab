import assert from "node:assert/strict";
import { getThinkfyTheme, type ThinkfyThemeMode } from "@thinkfy/shared/design-system";

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  assert.match(clean, /^[0-9A-Fa-f]{6}$/);
  return {
    r: Number.parseInt(clean.slice(0, 2), 16) / 255,
    g: Number.parseInt(clean.slice(2, 4), 16) / 255,
    b: Number.parseInt(clean.slice(4, 6), 16) / 255,
  };
}

function luminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const channel = (value: number) =>
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(a: string, b: string) {
  const first = luminance(a);
  const second = luminance(b);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

function assertContrast(mode: ThinkfyThemeMode, foreground: string, background: string, label: string, minimum = 3) {
  const ratio = contrastRatio(foreground, background);
  assert.ok(
    ratio >= minimum,
    `${mode} ${label} contrast ${ratio.toFixed(2)} is below the ${minimum}:1 minimum`
  );
}

for (const mode of ["light", "dark"] as const) {
  const theme = getThinkfyTheme(mode);
  const { colors, components, webCssVariables } = theme;

  assert.equal(webCssVariables["--color-primary"], colors.primary);
  assert.equal(webCssVariables["--color-surface"], colors.surface);
  assert.equal(webCssVariables["--button-primary-bg"], components.button.primary.background);
  assert.equal(webCssVariables["--button-reward-bg"], components.button.reward.background);
  assert.equal(webCssVariables["--input-focus-border"], components.input.focusBorder);
  assert.equal(webCssVariables["--progress-fill"], components.progress.fill);
  assert.equal(webCssVariables["--sidebar-bg"], components.sidebar.background);
  assert.equal(webCssVariables["--sidebar-selected-bg"], components.sidebar.selectedBackground);

  if (mode === "light") {
    assert.equal(colors.primary, "#00B8D9");
    assert.equal(colors.primaryFixed, "#00B8D9");
    assert.equal(colors.primaryDepth, "#0788A0");
    assert.equal(colors.reward, "#FFD166");
    assert.equal(colors.info, "#00B8D9");
    assert.equal(colors.success, "#34C759");
    assert.equal(components.sidebar.background, "#102936");
  }

  assertContrast(mode, colors.onPrimary, colors.primary, "primary/onPrimary", mode === "light" ? 2.3 : 3);
  assertContrast(mode, colors.foreground, colors.surface, "surface/onSurface");
  assertContrast(mode, colors.onReward, colors.reward, "reward/onReward");
  assertContrast(mode, colors.onSuccess, colors.success, "success/onSuccess");
  assertContrast(mode, colors.onWarningContainer, colors.warningContainer, "warning container");
  assertContrast(mode, colors.errorDim, colors.errorContainer, "error container");
}

console.log("Design-system token tests passed.");
