import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { FloorplanIR, VerificationReport } from "@plixa/kernel";
import { reviewSource, type PerceptionMode } from "./pipeline.ts";

export const DEMO_ORG_ID = "org_northline";

export type ReviewProject = {
  id: string;
  orgId: string;
  name: string;
  jurisdiction: string;
  status: "ready";
  createdAt: string;
  perception: { mode: PerceptionMode; note: string };
  ir: FloorplanIR;
  report: VerificationReport;
};

type StudioFile = { projects: ReviewProject[] };

const filePath = path.join(process.cwd(), ".data", "studio.json");
let queue: Promise<unknown> = Promise.resolve();

function readFile(): StudioFile {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as StudioFile;
  } catch {
    return { projects: [] };
  }
}

function writeFile(data: StudioFile) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(data));
}

function withStore<T>(fn: (data: StudioFile) => T): Promise<T> {
  const run = queue.then(() => {
    const data = readFile();
    if (data.projects.length === 0) {
      data.projects.push(createProject("Cedar Court Residence", "calibrated-sample"));
      data.projects.push(createProject("Captured sheet 225", "captured-plan"));
      writeFile(data);
    }
    const result = fn(data);
    writeFile(data);
    return result;
  });
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function createProject(name: string, source: PerceptionMode, uploaded?: unknown): ReviewProject {
  const reviewed = reviewSource(source, uploaded);
  return {
    id: crypto.randomUUID(),
    orgId: DEMO_ORG_ID,
    name,
    jurisdiction: reviewed.report.pack.jurisdiction,
    status: "ready",
    createdAt: new Date().toISOString(),
    perception: reviewed.perception,
    ir: reviewed.ir,
    report: reviewed.report,
  };
}

export function listProjects(query: string) {
  return withStore((data) => {
    const needle = query.trim().toLowerCase();
    return data.projects
      .filter((project) => project.orgId === DEMO_ORG_ID)
      .filter((project) => {
        if (!needle) return true;
        const roomText = project.ir.levels
          .flatMap((level) => level.rooms.map((room) => `${room.label ?? ""} ${room.use ?? ""}`))
          .join(" ");
        const ruleText = project.report.verdicts.map((verdict) => `${verdict.title} ${verdict.ruleId}`).join(" ");
        return `${project.name} ${roomText} ${ruleText}`.toLowerCase().includes(needle);
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });
}

export function getProject(id: string) {
  return withStore((data) => data.projects.find((project) => project.id === id && project.orgId === DEMO_ORG_ID) ?? null);
}

export function addProject(name: string, source: PerceptionMode, uploaded?: unknown) {
  return withStore((data) => {
    const project = createProject(name.trim() || "Untitled residence", source, uploaded);
    data.projects.unshift(project);
    return project;
  });
}
