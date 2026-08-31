export const DSA_NOTE_DRAWING_VERSION = 2 as const;
export const MAX_DSA_NOTE_PAGES = 20;
export const MAX_DSA_NOTE_STROKES = 600;
export const MAX_DSA_NOTE_POINTS_PER_STROKE = 2_000;
export const MAX_DSA_NOTE_POINTS = 60_000;

export interface DsaNotePoint {
  x: number;
  y: number;
  pressure: number;
}

export interface DsaNoteStroke {
  id: string;
  color: string;
  width: number;
  opacity: number;
  points: DsaNotePoint[];
}

export interface DsaNotePage {
  id: string;
  strokes: DsaNoteStroke[];
}

export interface DsaNoteDrawing {
  version: typeof DSA_NOTE_DRAWING_VERSION;
  pages: DsaNotePage[];
}

export function emptyDsaNoteDrawing(): DsaNoteDrawing {
  return {
    version: DSA_NOTE_DRAWING_VERSION,
    pages: [{ id: "page-1", strokes: [] }]
  };
}

/** Treat persisted drawing data as untrusted so a malformed note cannot break the canvas. */
export function normalizeDsaNoteDrawing(value: unknown): DsaNoteDrawing {
  if (!isRecord(value)) return emptyDsaNoteDrawing();

  // Drawings saved before sketchbook pages were introduced become page one.
  if (value.version === 1 && Array.isArray(value.strokes)) {
    const limits = { strokes: 0, points: 0 };
    return {
      version: DSA_NOTE_DRAWING_VERSION,
      pages: [{ id: "page-1", strokes: normalizeStrokes(value.strokes, limits) }]
    };
  }

  if (value.version !== DSA_NOTE_DRAWING_VERSION || !Array.isArray(value.pages)) {
    return emptyDsaNoteDrawing();
  }

  const limits = { strokes: 0, points: 0 };
  const pages: DsaNotePage[] = [];
  for (const candidate of value.pages.slice(0, MAX_DSA_NOTE_PAGES)) {
    if (!isRecord(candidate) || !Array.isArray(candidate.strokes)) continue;
    const id =
      typeof candidate.id === "string" && candidate.id.length > 0 && candidate.id.length <= 80
        ? candidate.id
        : `page-${pages.length + 1}`;
    pages.push({ id, strokes: normalizeStrokes(candidate.strokes, limits) });
    if (limits.strokes >= MAX_DSA_NOTE_STROKES || limits.points >= MAX_DSA_NOTE_POINTS) break;
  }

  return pages.length > 0 ? { version: DSA_NOTE_DRAWING_VERSION, pages } : emptyDsaNoteDrawing();
}

function normalizeStrokes(
  value: unknown[],
  limits: { strokes: number; points: number }
): DsaNoteStroke[] {
  const strokes: DsaNoteStroke[] = [];
  for (const candidate of value) {
    if (limits.strokes >= MAX_DSA_NOTE_STROKES || limits.points >= MAX_DSA_NOTE_POINTS) break;
    if (!isRecord(candidate) || !Array.isArray(candidate.points)) continue;
    if (
      typeof candidate.id !== "string" ||
      candidate.id.length === 0 ||
      candidate.id.length > 80 ||
      typeof candidate.color !== "string" ||
      !/^#[0-9a-f]{6}$/i.test(candidate.color) ||
      typeof candidate.width !== "number" ||
      candidate.width < 1 ||
      candidate.width > 24 ||
      typeof candidate.opacity !== "number" ||
      candidate.opacity < 0.05 ||
      candidate.opacity > 1
    ) {
      continue;
    }

    const points: DsaNotePoint[] = [];
    for (const point of candidate.points.slice(0, MAX_DSA_NOTE_POINTS_PER_STROKE)) {
      if (limits.points >= MAX_DSA_NOTE_POINTS) break;
      if (
        !isRecord(point) ||
        typeof point.x !== "number" ||
        !Number.isFinite(point.x) ||
        point.x < 0 ||
        point.x > 1 ||
        typeof point.y !== "number" ||
        !Number.isFinite(point.y) ||
        point.y < 0 ||
        point.y > 1 ||
        typeof point.pressure !== "number" ||
        !Number.isFinite(point.pressure) ||
        point.pressure < 0 ||
        point.pressure > 1
      ) {
        continue;
      }
      points.push({ x: point.x, y: point.y, pressure: point.pressure });
      limits.points += 1;
    }

    if (points.length > 0) {
      strokes.push({
        id: candidate.id,
        color: candidate.color,
        width: candidate.width,
        opacity: candidate.opacity,
        points
      });
      limits.strokes += 1;
    }
  }
  return strokes;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
