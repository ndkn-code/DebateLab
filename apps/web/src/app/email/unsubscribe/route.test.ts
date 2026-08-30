import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./route.ts", import.meta.url), "utf8");
const getHandler = source.slice(
  source.indexOf("export async function GET"),
  source.indexOf("export async function POST"),
);
const postHandler = source.slice(source.indexOf("export async function POST"));

assert.match(getHandler, /verifyUnsubscribeToken\(token\)/);
assert.match(getHandler, /<form method=\\?"post\\?"/i);
assert.doesNotMatch(getHandler, /applyEmailUnsubscribe\(/);
assert.match(postHandler, /applyEmailUnsubscribe\(/);
assert.match(source, /<html lang="\$\{input\.locale\}" dir="ltr">/);

console.log("unsubscribe confirmation route tests passed");
