export type Point = [number, number];

export type Room = {
  id: string;
  label?: string | null;
  use?: string | null;
  polygon?: Point[] | null;
  areaSqft?: number | null;
  ceilingHeight?: number | null;
  confidence?: number;
};

export type Opening = {
  id: string;
  kind: "door" | "window" | string;
  width?: number | null;
  height?: number | null;
  egress?: boolean | null;
  openableArea?: number | null;
  sillHeight?: number | null;
  wallId?: string | null;
  confidence?: number;
};

export type Wall = {
  id: string;
  type?: string | null;
  polyline?: Point[] | null;
  confidence?: number;
};

export type Stair = {
  id: string;
  riseIn?: number | null;
  runIn?: number | null;
  confidence?: number;
};

export type Fixture = {
  id: string;
  kind: string;
  roomId?: string | null;
  position?: Point | null;
};

export type GraphEdge = {
  kind: string;
  from: string;
  to: string;
};

export type Level = {
  index: number;
  name: string;
  rooms: Room[];
  openings: Opening[];
  walls: Wall[];
  stairs: Stair[];
  fixtures: Fixture[];
};

export type FloorplanIR = {
  irVersion: string;
  id: string;
  revision: number;
  units: "ft" | "m" | string;
  scale: number;
  levels: Level[];
  graph: { edges: GraphEdge[] };
};

export type Citation = {
  code: string;
  section: string;
  textHash: string;
  url?: string;
};

export type Rule = {
  id: string;
  title: string;
  citation: Citation;
  scope: "room" | "opening" | "wall" | "stair" | "fixture" | "plan";
  applies: string;
  check: {
    op: ">=" | "<=" | ">" | "<" | "==" | "!=" | "in" | "not_in";
    left: string;
    right: number | string | boolean | Array<string | number>;
  };
  severity: "violation" | "warning";
  needs: string[];
  fixHints: string[];
  requirementText: string;
};

export type RulePack = {
  jurisdiction: string;
  base: string;
  amendments?: string;
  version: string;
  certifiedBy?: string;
  certification?: {
    status?: string;
    sourceManifestHash?: string;
  };
  rules: Rule[];
};

export type Verdict = {
  ruleId: string;
  title: string;
  requirementText: string;
  status: "pass" | "fail" | "inconclusive";
  measured: number | string | boolean | null;
  required: Rule["check"]["right"];
  citation: Citation;
  elements: string[];
  missing: string[];
  severity: "violation" | "warning";
  evidenceConfidence: number;
};

export type VerificationReport = {
  irId: string;
  irRevision: number;
  pack: {
    jurisdiction: string;
    version: string;
    base: string;
    certificationStatus: string;
  };
  verdicts: Verdict[];
  summary: { pass: number; fail: number; inconclusive: number };
  durationMs: number;
};
