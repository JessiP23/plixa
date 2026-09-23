import type { FloorplanIR } from "./types.ts";

const rect = (x: number, y: number, w: number, h: number): [number, number][] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];

/**
 * A small orthogonal residence with deliberate IRC failures:
 * BEDROOM 2 is under 70 sq ft and under 7 ft wide, its window is not an
 * egress opening, and it has no smoke or CO alarm. The egress door has no
 * height, so that check stays inconclusive instead of being guessed.
 */
export const samplePlan: FloorplanIR = {
  irVersion: "1.0.0",
  id: "ir_cedar_court",
  revision: 1,
  units: "ft",
  scale: 1,
  levels: [
    {
      index: 0,
      name: "Level 1",
      rooms: [
        {
          id: "living",
          label: "LIVING",
          use: "habitable",
          polygon: rect(0, 0, 16, 14),
          areaSqft: 224,
          ceilingHeight: 9,
          confidence: 0.94,
        },
        {
          id: "kitchen",
          label: "KITCHEN",
          use: "kitchen",
          polygon: rect(16, 0, 12, 10),
          areaSqft: 120,
          ceilingHeight: 9,
          confidence: 0.93,
        },
        {
          id: "hall",
          label: "HALL",
          use: "hallway",
          polygon: rect(16, 10, 12, 3.5),
          areaSqft: 42,
          ceilingHeight: 8,
          confidence: 0.91,
        },
        {
          id: "bed1",
          label: "BEDROOM 1",
          use: "habitable",
          polygon: rect(0, 14, 12.4, 9.5),
          areaSqft: 117.8,
          ceilingHeight: 8,
          confidence: 0.92,
        },
        {
          id: "bed2",
          label: "BEDROOM 2",
          use: "habitable",
          polygon: rect(28, 0, 6, 8),
          areaSqft: 48,
          ceilingHeight: 8,
          confidence: 0.9,
        },
        {
          id: "bath",
          label: "BATH",
          use: "bathroom",
          polygon: rect(28, 8, 6, 7),
          areaSqft: 42,
          ceilingHeight: 7,
          confidence: 0.9,
        },
      ],
      walls: [
        { id: "wall-front", type: "exterior" },
        { id: "wall-bed", type: "exterior" },
      ],
      openings: [
        { id: "door-front", kind: "door", width: 3, egress: true, wallId: "wall-front", confidence: 0.95 },
        { id: "door-kitchen", kind: "door", width: 2.667, confidence: 0.9 },
        { id: "door-hall", kind: "door", width: 2.667, confidence: 0.9 },
        { id: "door-bed1", kind: "door", width: 2.667, confidence: 0.9 },
        { id: "door-bed2", kind: "door", width: 2.333, confidence: 0.88 },
        { id: "door-bath", kind: "door", width: 2.333, confidence: 0.88 },
        {
          id: "win-living",
          kind: "window",
          width: 6,
          egress: false,
          openableArea: 20,
          sillHeight: 2.5,
          wallId: "wall-front",
          confidence: 0.9,
        },
        {
          id: "win-bed1",
          kind: "window",
          width: 4,
          egress: true,
          openableArea: 12,
          sillHeight: 3,
          wallId: "wall-bed",
          confidence: 0.9,
        },
        {
          id: "win-bed2",
          kind: "window",
          width: 2,
          egress: false,
          openableArea: 2,
          sillHeight: 3,
          confidence: 0.86,
        },
        {
          id: "win-kitchen",
          kind: "window",
          width: 3,
          egress: false,
          openableArea: 8,
          sillHeight: 3,
          confidence: 0.9,
        },
      ],
      stairs: [{ id: "stair-1", riseIn: 8, runIn: 11, confidence: 0.8 }],
      fixtures: [
        ...Array.from({ length: 6 }, (_, index) => ({
          id: `out-living-${index}`,
          kind: "outlet",
          roomId: "living",
        })),
        ...Array.from({ length: 4 }, (_, index) => ({
          id: `out-kitchen-${index}`,
          kind: "outlet",
          roomId: "kitchen",
        })),
        ...Array.from({ length: 4 }, (_, index) => ({
          id: `out-bed1-${index}`,
          kind: "outlet",
          roomId: "bed1",
        })),
        { id: "smoke-bed1", kind: "smoke", roomId: "bed1" },
        { id: "co-bed1", kind: "co", roomId: "bed1" },
      ],
    },
  ],
  graph: {
    edges: [
      { kind: "room-opening", from: "living", to: "door-front" },
      { kind: "room-opening", from: "living", to: "door-hall" },
      { kind: "room-opening", from: "hall", to: "door-hall" },
      { kind: "room-opening", from: "hall", to: "door-kitchen" },
      { kind: "room-opening", from: "kitchen", to: "door-kitchen" },
      { kind: "room-opening", from: "living", to: "door-bed1" },
      { kind: "room-opening", from: "bed1", to: "door-bed1" },
      { kind: "room-opening", from: "hall", to: "door-bed2" },
      { kind: "room-opening", from: "bed2", to: "door-bed2" },
      { kind: "room-opening", from: "hall", to: "door-bath" },
      { kind: "room-opening", from: "bath", to: "door-bath" },
      { kind: "room-opening", from: "living", to: "win-living" },
      { kind: "room-opening", from: "bed1", to: "win-bed1" },
      { kind: "room-opening", from: "bed2", to: "win-bed2" },
      { kind: "room-opening", from: "kitchen", to: "win-kitchen" },
    ],
  },
};
