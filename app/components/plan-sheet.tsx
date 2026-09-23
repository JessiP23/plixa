"use client";

import type { FloorplanIR, VerificationReport } from "@plixa/kernel";

type Props = {
  ir: FloorplanIR;
  report: VerificationReport;
  selected: string | null;
  onSelect: (id: string) => void;
};

export function PlanSheet({ ir, report, selected, onSelect }: Props) {
  const rooms = ir.levels.flatMap((level) => level.rooms).filter((room) => (room.polygon?.length ?? 0) >= 3);
  const points = rooms.flatMap((room) => room.polygon ?? []);
  if (points.length === 0) return <p className="note">This IR has no room polygons to draw.</p>;

  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY);
  const pad = span * 0.06;

  return (
    <svg viewBox={`${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`}>
      {rooms.map((room) => {
        const tone = toneFor(room.id, report);
        const polygon = room.polygon ?? [];
        const centroid = average(polygon);
        return (
          <g key={room.id} onClick={() => onSelect(room.id)} style={{ cursor: "pointer" }}>
            <polygon
              points={polygon.map((point) => point.join(",")).join(" ")}
              fill={fill[tone]}
              stroke={selected === room.id ? "#14181d" : "rgba(20,24,29,0.45)"}
              strokeWidth={selected === room.id ? span * 0.012 : span * 0.004}
            />
            <text x={centroid[0]} y={centroid[1]} textAnchor="middle" fontSize={span * 0.035}>
              {room.label ?? room.use ?? room.id}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const fill = {
  violation: "rgba(194, 65, 58, 0.28)",
  warning: "rgba(161, 98, 7, 0.28)",
  inconclusive: "rgba(29, 78, 137, 0.16)",
  pass: "rgba(21, 115, 71, 0.16)",
  none: "rgba(20, 24, 29, 0.05)",
};

function toneFor(id: string, report: VerificationReport) {
  const related = report.verdicts.filter((verdict) => verdict.elements.includes(id));
  if (related.some((verdict) => verdict.status === "fail" && verdict.severity === "violation")) return "violation";
  if (related.some((verdict) => verdict.status === "fail")) return "warning";
  if (related.some((verdict) => verdict.status === "inconclusive")) return "inconclusive";
  if (related.some((verdict) => verdict.status === "pass")) return "pass";
  return "none";
}

function average(points: [number, number][]): [number, number] {
  const total = points.reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1]], [0, 0]);
  return [total[0] / points.length, total[1] / points.length];
}
