import { readFileSync } from "node:fs";
import path from "node:path";
import { reviewPlan, samplePlan, type FloorplanIR, type RulePack, type VerificationReport } from "@plixa/kernel";

const pack = JSON.parse(
  readFileSync(path.join(process.cwd(), "packages/kernel/packs/us-irc-2021.json"), "utf8"),
) as RulePack;

export type PerceptionMode = "calibrated-sample" | "uploaded-ir" | "captured-plan";

export type ReviewResult = {
  ir: FloorplanIR;
  report: VerificationReport;
  perception: { mode: PerceptionMode; note: string };
};

export function reviewSource(source: PerceptionMode, uploaded?: unknown): ReviewResult {
  if (source === "calibrated-sample") {
    return {
      ir: samplePlan,
      report: reviewPlan(samplePlan, pack),
      perception: {
        mode: source,
        note: "Geometry is a calibrated residential IR. The kernel evaluated it directly. Image perception stays in the Python worker until that service is connected.",
      },
    };
  }

  if (source === "captured-plan") {
    const file = path.join(process.cwd(), "public/samples/captured-plan.ir.json");
    const ir = normalizeIr(JSON.parse(readFileSync(file, "utf8")));
    return {
      ir,
      report: reviewPlan(ir, pack),
      perception: {
        mode: source,
        note: "This IR was produced by the existing Pixa perception pipeline and reviewed here without re-running the vision model.",
      },
    };
  }

  const ir = normalizeIr(uploaded);
  return {
    ir,
    report: reviewPlan(ir, pack),
    perception: {
      mode: "uploaded-ir",
      note: "Reviewed from the IR you uploaded. Verdicts come from the deterministic kernel, not from a language model.",
    },
  };
}

export function normalizeIr(input: unknown): FloorplanIR {
  if (!input || typeof input !== "object") {
    throw new Error("IR must be a JSON object.");
  }
  const raw = input as Partial<FloorplanIR>;
  if (!Array.isArray(raw.levels) || raw.levels.length === 0) {
    throw new Error("IR needs at least one level.");
  }
  return {
    irVersion: raw.irVersion ?? "1.0.0",
    id: raw.id ?? crypto.randomUUID(),
    revision: raw.revision ?? 0,
    units: raw.units ?? "ft",
    scale: typeof raw.scale === "number" ? raw.scale : 1,
    graph: raw.graph?.edges ? raw.graph : { edges: [] },
    levels: raw.levels.map((level, index) => ({
      index: level.index ?? index,
      name: level.name ?? `Level ${index + 1}`,
      rooms: level.rooms ?? [],
      openings: level.openings ?? [],
      walls: level.walls ?? [],
      stairs: level.stairs ?? [],
      fixtures: level.fixtures ?? [],
    })),
  };
}
