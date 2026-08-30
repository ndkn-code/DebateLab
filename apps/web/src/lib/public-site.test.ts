import assert from "node:assert/strict";
import {
  absolutePublicUrl,
  asPublicLocale,
  legalOperatorDetails,
  legalPublicationReady,
  localizedAlternates,
  localizedPath,
} from "@/lib/public-site";
import {
  getPublicGuide,
  isPublicGuideSlug,
  PUBLIC_GUIDE_SLUGS,
} from "@/lib/public-guides";

assert.equal(asPublicLocale("en"), "en");
assert.equal(asPublicLocale("vi"), "vi");
assert.equal(asPublicLocale("unexpected"), "vi");
assert.equal(localizedPath("en", "/ielts"), "/en/ielts");
assert.equal(
  localizedPath("vi", "guides/ai-feedback-method"),
  "/vi/guides/ai-feedback-method",
);
assert.match(absolutePublicUrl("en", "/ielts"), /\/en\/ielts$/);

const alternates = localizedAlternates("en", "/ielts");
assert.match(String(alternates?.canonical), /\/en\/ielts$/);
assert.match(String(alternates?.languages?.vi), /\/vi\/ielts$/);
assert.match(String(alternates?.languages?.["x-default"]), /\/vi\/ielts$/);

const originalOperatorName = process.env.NEXT_PUBLIC_LEGAL_OPERATOR_NAME;
const originalOperatorAddress = process.env.NEXT_PUBLIC_LEGAL_OPERATOR_ADDRESS;
const originalGoverningLaw = process.env.NEXT_PUBLIC_LEGAL_GOVERNING_LAW;
process.env.NEXT_PUBLIC_LEGAL_OPERATOR_NAME = "Thinkfy Inc";
delete process.env.NEXT_PUBLIC_LEGAL_OPERATOR_ADDRESS;
process.env.NEXT_PUBLIC_LEGAL_GOVERNING_LAW = "Laws of Vietnam";
assert.equal(legalPublicationReady(), true);
assert.equal(legalOperatorDetails().address, null);
if (originalOperatorName === undefined) {
  delete process.env.NEXT_PUBLIC_LEGAL_OPERATOR_NAME;
} else {
  process.env.NEXT_PUBLIC_LEGAL_OPERATOR_NAME = originalOperatorName;
}
if (originalOperatorAddress === undefined) {
  delete process.env.NEXT_PUBLIC_LEGAL_OPERATOR_ADDRESS;
} else {
  process.env.NEXT_PUBLIC_LEGAL_OPERATOR_ADDRESS = originalOperatorAddress;
}
if (originalGoverningLaw === undefined) {
  delete process.env.NEXT_PUBLIC_LEGAL_GOVERNING_LAW;
} else {
  process.env.NEXT_PUBLIC_LEGAL_GOVERNING_LAW = originalGoverningLaw;
}

for (const slug of PUBLIC_GUIDE_SLUGS) {
  assert.equal(isPublicGuideSlug(slug), true);
  for (const locale of ["vi", "en"] as const) {
    const guide = getPublicGuide(locale, slug);
    assert.ok(guide.title.length > 10);
    assert.ok(guide.description.length > 20);
    assert.ok(guide.sections.length >= 4);
  }
}

assert.equal(isPublicGuideSlug("not-a-guide"), false);

console.log("public-site.test.ts passed");
