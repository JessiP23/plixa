import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { verify } from "./engine.ts";
import { samplePlan } from "./sample-ir.ts";
import type { FloorplanIR, RulePack, VerificationReport } from "./types.ts";

export { verify } from "./engine.ts";
export { samplePlan } from "./sample-ir.ts";
export type { FloorplanIR, RulePack, VerificationReport, Verdict } from "./types.ts";

let cachedPack: RulePack | null = null;

export function loadIrcPack(): RulePack {
  if (cachedPack) return cachedPack;
  const path = join(dirname(fileURLToPath(import.meta.url)), "../packs/us-irc-2021.json");
  cachedPack = JSON.parse(readFileSync(path, "utf8")) as RulePack;
  return cachedPack;
}

export function reviewPlan(ir: FloorplanIR, pack: RulePack = loadIrcPack()): VerificationReport {
  return verify(ir, pack);
}
