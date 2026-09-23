import assert from "node:assert/strict";
import test from "node:test";
import { reviewPlan, samplePlan } from "./index.ts";

test("IRC kernel flags the undersized bedroom and leaves door height inconclusive", () => {
  const report = reviewPlan(samplePlan);
  const byRule = (id: string, element: string) =>
    report.verdicts.find((verdict) => verdict.ruleId === id && verdict.elements.includes(element));

  assert.equal(byRule("IRC-R304.1-habitable-area", "bed2")?.status, "fail");
  assert.equal(byRule("IRC-R304.1-habitable-area", "bed2")?.measured, 48);
  assert.equal(byRule("IRC-R304.2-habitable-dimension", "bed2")?.status, "fail");
  assert.equal(byRule("IRC-R310.1-egress-opening", "bed2")?.status, "fail");
  assert.equal(byRule("IRC-R314.3-smoke-detector", "bed2")?.status, "fail");
  assert.equal(byRule("IRC-R304.1-habitable-area", "bed1")?.status, "pass");
  assert.equal(byRule("IRC-R310.1-egress-opening", "bed1")?.status, "pass");
  assert.equal(byRule("IRC-R311.2-egress-door-width", "door-front")?.status, "pass");
  assert.equal(byRule("IRC-R311.2-egress-door-height", "door-front")?.status, "inconclusive");
  assert.equal(byRule("IRC-R311.7.5-stair-rise", "stair-1")?.status, "fail");
  assert.equal(byRule("IRC-R311.7.5-stair-run", "stair-1")?.status, "pass");
  assert.equal(byRule("IRC-R311.6-hallway-width", "hall")?.status, "pass");
  assert.equal(report.pack.certificationStatus, "pending_human_certification");
  assert.ok(report.summary.fail > 0);
  assert.ok(report.summary.pass > 0);
  assert.ok(report.summary.inconclusive > 0);
});
