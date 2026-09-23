import { ExprError, MissingField, SafeEvaluator } from "./expr.ts";
import { GeomRegistry } from "./geometry.ts";
import type {
  FloorplanIR,
  Level,
  Rule,
  RulePack,
  Verdict,
  VerificationReport,
} from "./types";

const COLLECTIONS = {
  room: "rooms",
  opening: "openings",
  wall: "walls",
  stair: "stairs",
  fixture: "fixtures",
} as const;

type Element = { id: string; confidence?: number };

export function verify(ir: FloorplanIR, pack: RulePack): VerificationReport {
  const started = performance.now();
  const verdicts: Verdict[] = [];
  for (const level of ir.levels) {
    const geom = new GeomRegistry(ir, level);
    for (const rule of pack.rules) {
      verdicts.push(...evaluateRule(rule, ir, level, geom));
    }
  }
  const summary = {
    pass: verdicts.filter((verdict) => verdict.status === "pass").length,
    fail: verdicts.filter((verdict) => verdict.status === "fail").length,
    inconclusive: verdicts.filter((verdict) => verdict.status === "inconclusive").length,
  };
  return {
    irId: ir.id,
    irRevision: ir.revision,
    pack: {
      jurisdiction: pack.jurisdiction,
      version: pack.version,
      base: pack.base,
      certificationStatus:
        pack.certification?.status ??
        (pack.certifiedBy === "PENDING_HUMAN_CERTIFICATION" ? "pending_human_certification" : "draft"),
    },
    verdicts,
    summary,
    durationMs: Math.round((performance.now() - started) * 10) / 10,
  };
}

function evaluateRule(rule: Rule, ir: FloorplanIR, level: Level, geom: GeomRegistry): Verdict[] {
  const elements: Array<Element | null> =
    rule.scope === "plan" ? [null] : (level[COLLECTIONS[rule.scope]] as Element[]);
  const verdicts: Verdict[] = [];

  for (const element of elements) {
    const context: Record<string, unknown> = { geom, ir, level, plan: ir };
    if (element) context[rule.scope] = element;
    const evaluator = new SafeEvaluator(context);
    const confidence = element?.confidence ?? 1;

    try {
      if (element && !evaluator.eval(rule.applies)) continue;
    } catch (error) {
      if (error instanceof MissingField) {
        if (rule.needs.some((need) => error.field === need || error.field.includes(need))) {
          verdicts.push(inconclusive(rule, element?.id, [error.field], confidence));
        }
        continue;
      }
      if (error instanceof ExprError) {
        verdicts.push(inconclusive(rule, element?.id, ["<applies-expression>"], confidence));
        continue;
      }
      throw error;
    }

    const missing = missingNeeds(rule, context);
    if (missing.length > 0) {
      verdicts.push(inconclusive(rule, element?.id, missing, confidence));
      continue;
    }

    try {
      const measured = evaluator.eval(rule.check.left);
      const required = rule.check.right;
      const ok = compare(rule.check.op, measured, required);
      verdicts.push({
        ruleId: rule.id,
        title: rule.title,
        requirementText: rule.requirementText,
        status: ok ? "pass" : "fail",
        measured: serializeMeasured(measured),
        required,
        citation: rule.citation,
        elements: element ? [element.id] : [],
        missing: [],
        severity: rule.severity,
        evidenceConfidence: confidence,
      });
    } catch (error) {
      if (error instanceof MissingField) {
        verdicts.push(inconclusive(rule, element?.id, [error.field], confidence));
        continue;
      }
      if (error instanceof ExprError) {
        verdicts.push(inconclusive(rule, element?.id, ["<check-expression>"], confidence));
        continue;
      }
      throw error;
    }
  }
  return verdicts;
}

function missingNeeds(rule: Rule, context: Record<string, unknown>): string[] {
  const evaluator = new SafeEvaluator(context);
  const missing: string[] = [];
  for (const need of rule.needs) {
    try {
      evaluator.eval(need);
    } catch (error) {
      if (error instanceof MissingField || error instanceof ExprError) missing.push(need);
      else throw error;
    }
  }
  return missing;
}

function compare(op: Rule["check"]["op"], left: unknown, right: unknown): boolean {
  switch (op) {
    case ">=":
      return Number(left) >= Number(right);
    case "<=":
      return Number(left) <= Number(right);
    case ">":
      return Number(left) > Number(right);
    case "<":
      return Number(left) < Number(right);
    case "==":
      return left === right;
    case "!=":
      return left !== right;
    case "in":
      return Array.isArray(right) && right.includes(left as never);
    case "not_in":
      return Array.isArray(right) && !right.includes(left as never);
    default:
      return false;
  }
}

function serializeMeasured(value: unknown): Verdict["measured"] {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return Math.round(value * 1000) / 1000;
  }
  if (typeof value === "string" || typeof value === "boolean") return value;
  return null;
}

function inconclusive(rule: Rule, elementId: string | undefined, missing: string[], confidence: number): Verdict {
  return {
    ruleId: rule.id,
    title: rule.title,
    requirementText: rule.requirementText,
    status: "inconclusive",
    measured: null,
    required: rule.check.right,
    citation: rule.citation,
    elements: elementId ? [elementId] : [],
    missing,
    severity: rule.severity,
    evidenceConfidence: confidence,
  };
}
