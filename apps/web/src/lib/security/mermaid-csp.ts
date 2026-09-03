const STYLE_ELEMENT_OPEN = /<style(?=[\s>])/giu;

/**
 * Mermaid emits a stylesheet inside its SVG. The SVG is inserted after page
 * hydration, so Next.js cannot apply the request nonce for us.
 */
export function nonceMermaidStyles(svg: string, nonce: string | undefined) {
  if (!nonce || !/^[A-Za-z0-9+/_-]+={0,2}$/u.test(nonce)) {
    return svg;
  }

  return svg.replace(STYLE_ELEMENT_OPEN, `<style nonce="${nonce}"`);
}
