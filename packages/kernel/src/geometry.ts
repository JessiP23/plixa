import { MissingField } from "./expr.ts";
import type { Fixture, FloorplanIR, Level, Opening, Point, Room } from "./types.ts";

type GraphEdge = { to: string; length: number; doorWidthIn?: number };

/**
 * Geometry functions the rule packs call. Axis-aligned minimum dimension is
 * exact for orthogonal rooms. Outlet spacing uses perimeter divided by outlet
 * count, which is the conservative reading of NEC 210.52 when exact wall
 * projections are not in the IR.
 */
export class GeomRegistry {
  private readonly ir: FloorplanIR;
  private readonly level: Level;
  private readonly rooms: Map<string, Room>;
  private readonly openings: Map<string, Opening>;
  private readonly walls: Map<string, { id: string; type?: string | null }>;
  private readonly graph: Map<string, GraphEdge[]>;

  constructor(ir: FloorplanIR, level: Level) {
    this.ir = ir;
    this.level = level;
    this.rooms = new Map(level.rooms.map((room) => [room.id, room]));
    this.openings = new Map(level.openings.map((opening) => [opening.id, opening]));
    this.walls = new Map(level.walls.map((wall) => [wall.id, wall]));
    this.graph = this.buildEgressGraph();
  }

  area_sqft(room: Room): number {
    if (typeof room.areaSqft === "number") return room.areaSqft;
    const polygon = room.polygon;
    if (!polygon || polygon.length < 3) throw new MissingField(`room.polygon[${room.id}]`);
    const area = Math.abs(shoelace(polygon)) * this.ir.scale ** 2;
    return area * (this.ir.units === "m" ? 10.7639 : 1);
  }

  min_horizontal_dimension_ft(room: Room): number {
    const polygon = room.polygon;
    if (!polygon || polygon.length < 2) throw new MissingField(`room.polygon[${room.id}]`);
    const xs = polygon.map((point) => point[0]);
    const ys = polygon.map((point) => point[1]);
    const width = Math.max(...xs) - Math.min(...xs);
    const depth = Math.max(...ys) - Math.min(...ys);
    return Math.min(width, depth) * this.ir.scale;
  }

  window_area_ratio(room: Room): number {
    const windows = this.roomOpenings(room, "window");
    if (windows.length === 0) return 0;
    let total = 0;
    for (const window of windows) {
      if (window.openableArea == null) throw new MissingField(`opening.openableArea[${window.id}]`);
      total += window.openableArea;
    }
    return total / this.area_sqft(room);
  }

  has_egress_opening(room: Room): boolean {
    for (const opening of this.roomOpenings(room)) {
      if (!opening.egress) continue;
      if (opening.openableArea == null || opening.sillHeight == null) {
        throw new MissingField(`opening.openableArea/sillHeight[${opening.id}]`);
      }
      if (opening.openableArea >= 5.7 && opening.sillHeight <= 44 / 12) return true;
    }
    return false;
  }

  door_clear_width_in(opening: Opening): number {
    if (opening.width == null) throw new MissingField(`opening.width[${opening.id}]`);
    return opening.width * this.ir.scale * 12;
  }

  door_clear_height_in(opening: Opening): number {
    if (opening.height == null) throw new MissingField(`opening.height[${opening.id}]`);
    return opening.height * this.ir.scale * 12;
  }

  egress_path_length_ft(room: Room): number {
    const path = this.shortestPath(room.id);
    if (!path) return 1_000_000_000;
    return path.length;
  }

  egress_path_min_width_in(room: Room): number {
    const path = this.shortestPath(room.id);
    if (!path || path.widths.length === 0) throw new MissingField(`graph.path[${room.id}]`);
    return Math.min(...path.widths);
  }

  max_outlet_gap_ft(room: Room): number {
    const polygon = room.polygon;
    if (!polygon || polygon.length < 3) throw new MissingField(`room.polygon[${room.id}]`);
    const perimeter = polygonPerimeter(polygon) * this.ir.scale;
    const outlets = this.roomFixtures(room, "outlet");
    if (outlets.length === 0) return perimeter;
    return perimeter / outlets.length;
  }

  detector_count(room: Room, kind = "smoke"): number {
    return this.roomFixtures(room, kind).length;
  }

  private roomOpenings(room: Room, kind?: string): Opening[] {
    const ids = new Set<string>();
    for (const edge of this.ir.graph.edges) {
      if (edge.kind !== "room-opening") continue;
      if (edge.from === room.id) ids.add(edge.to);
      if (edge.to === room.id) ids.add(edge.from);
    }
    const openings = [...ids].map((id) => this.openings.get(id)).filter((item): item is Opening => Boolean(item));
    return kind ? openings.filter((opening) => opening.kind === kind) : openings;
  }

  private roomFixtures(room: Room, kind: string): Fixture[] {
    return this.level.fixtures.filter((fixture) => fixture.kind.includes(kind) && fixture.roomId === room.id);
  }

  private buildEgressGraph(): Map<string, GraphEdge[]> {
    const graph = new Map<string, GraphEdge[]>();
    const add = (from: string, edge: GraphEdge) => {
      const list = graph.get(from) ?? [];
      list.push(edge);
      graph.set(from, list);
    };
    graph.set("EXTERIOR", []);
    for (const room of this.level.rooms) graph.set(room.id, []);

    const openingRooms = new Map<string, string[]>();
    for (const edge of this.ir.graph.edges) {
      if (edge.kind === "room-opening") {
        const roomId = this.rooms.has(edge.from) ? edge.from : edge.to;
        const openingId = roomId === edge.from ? edge.to : edge.from;
        const rooms = openingRooms.get(openingId) ?? [];
        rooms.push(roomId);
        openingRooms.set(openingId, rooms);
      }
      if (edge.kind === "room-exterior") {
        const roomId = this.rooms.has(edge.from) ? edge.from : edge.to;
        add(roomId, { to: "EXTERIOR", length: 0 });
        add("EXTERIOR", { to: roomId, length: 0 });
      }
    }

    for (const [openingId, rooms] of openingRooms) {
      const opening = this.openings.get(openingId);
      if (!opening || opening.kind !== "door" || opening.width == null) continue;
      const widthIn = opening.width * this.ir.scale * 12;
      if (rooms.length === 2) {
        const [a, b] = rooms;
        add(a, { to: b, length: 1, doorWidthIn: widthIn });
        add(b, { to: a, length: 1, doorWidthIn: widthIn });
      } else if (rooms.length === 1 && (opening.egress || this.walls.get(opening.wallId ?? "")?.type === "exterior")) {
        add(rooms[0], { to: "EXTERIOR", length: 1, doorWidthIn: widthIn });
      }
    }
    return graph;
  }

  private shortestPath(start: string): { length: number; widths: number[] } | null {
    const dist = new Map<string, number>([[start, 0]]);
    const prev = new Map<string, { node: string; width?: number }>();
    const queue = new Set(this.graph.keys());
    while (queue.size > 0) {
      let current: string | null = null;
      let best = Infinity;
      for (const node of queue) {
        const weight = dist.get(node);
        if (weight !== undefined && weight < best) {
          best = weight;
          current = node;
        }
      }
      if (current === null) break;
      queue.delete(current);
      if (current === "EXTERIOR") break;
      for (const edge of this.graph.get(current) ?? []) {
        const next = best + edge.length;
        if (next < (dist.get(edge.to) ?? Infinity)) {
          dist.set(edge.to, next);
          prev.set(edge.to, { node: current, width: edge.doorWidthIn });
        }
      }
    }
    if (!prev.has("EXTERIOR") && start !== "EXTERIOR") return null;
    const widths: number[] = [];
    let cursor = "EXTERIOR";
    while (cursor !== start) {
      const step = prev.get(cursor);
      if (!step) return null;
      if (step.width !== undefined) widths.push(step.width);
      cursor = step.node;
    }
    return { length: dist.get("EXTERIOR") ?? 0, widths };
  }
}

function shoelace(polygon: Point[]): number {
  let sum = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const [x1, y1] = polygon[i];
    const [x2, y2] = polygon[(i + 1) % polygon.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

function polygonPerimeter(polygon: Point[]): number {
  let length = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const [x1, y1] = polygon[i];
    const [x2, y2] = polygon[(i + 1) % polygon.length];
    length += Math.hypot(x2 - x1, y2 - y1);
  }
  return length;
}
