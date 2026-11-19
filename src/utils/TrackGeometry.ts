import type { TrackShape } from '../types/game';

export interface TrackSample {
  x: number;
  y: number;
  tx: number;
  ty: number;
  nx: number;
  ny: number;
  angle: number;
}

interface RawPoint {
  x: number;
  y: number;
}

/**
 * Parameterizes curved passenger tracks with uniform arc-length lookup.
 * Distance `s = 0` is the bus stop front at (270, 292); increasing `s`
 * moves backward along the loop toward the top-right entry ramp.
 */
export class TrackGeometry {
  public readonly shape: TrackShape;
  public readonly points: TrackSample[] = [];
  public readonly totalLength: number;

  private readonly cumulativeDist: number[] = [];

  constructor(shape: TrackShape, offsetY = 0) {
    this.shape = shape;
    const raw = TrackGeometry.buildControlSamples(shape).map((pt) => ({
      x: pt.x,
      y: pt.y + offsetY,
    }));
    this.cumulativeDist = [0];
    let acc = 0;

    for (let i = 0; i < raw.length; i++) {
      const p = raw[i];
      if (i > 0) {
        const prev = raw[i - 1];
        acc += Math.hypot(p.x - prev.x, p.y - prev.y);
        this.cumulativeDist.push(acc);
      }

      const pPrev = raw[Math.max(0, i - 1)];
      const pNext = raw[Math.min(raw.length - 1, i + 1)];
      const dx = pNext.x - pPrev.x;
      const dy = pNext.y - pPrev.y;
      const len = Math.hypot(dx, dy) || 1;
      const tx = dx / len;
      const ty = dy / len;
      this.points.push({
        x: p.x,
        y: p.y,
        tx,
        ty,
        nx: -ty,
        ny: tx,
        angle: Math.atan2(ty, tx),
      });
    }

    this.totalLength = acc;
  }

  /**
   * Samples world coordinates at arc-length `s` (clamped or extrapolated along entrance)
   * with optional perpendicular `lateralOffset`.
   */
  public sampleAt(s: number, lateralOffset = 0): TrackSample {
    if (s <= 0) {
      const first = this.points[0];
      return {
        ...first,
        x: first.x + first.nx * lateralOffset,
        y: first.y + first.ny * lateralOffset,
      };
    }

    if (s >= this.totalLength) {
      const last = this.points[this.points.length - 1];
      const extra = s - this.totalLength;
      return {
        ...last,
        x: last.x + last.tx * extra + last.nx * lateralOffset,
        y: last.y + last.ty * extra + last.ny * lateralOffset,
      };
    }

    // Binary search cumulativeDist
    let lo = 0;
    let hi = this.cumulativeDist.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (this.cumulativeDist[mid] <= s) {
        lo = mid;
      } else {
        hi = mid;
      }
    }

    const d0 = this.cumulativeDist[lo];
    const d1 = this.cumulativeDist[hi];
    const t = d1 > d0 ? (s - d0) / (d1 - d0) : 0;
    const a = this.points[lo];
    const b = this.points[hi];

    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    const tx = a.tx + (b.tx - a.tx) * t;
    const ty = a.ty + (b.ty - a.ty) * t;
    const norm = Math.hypot(tx, ty) || 1;
    const ux = tx / norm;
    const uy = ty / norm;
    const nx = -uy;
    const ny = ux;

    return {
      x: x + nx * lateralOffset,
      y: y + ny * lateralOffset,
      tx: ux,
      ty: uy,
      nx,
      ny,
      angle: Math.atan2(uy, ux),
    };
  }

  /**
   * Returns packed formation position for passenger at queue index `idx`.
   * Uses a neat 2-column staggered crowd formation along the track width.
   */
  public getPassengerPosition(idx: number): { x: number; y: number } {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const spacingPerRow = 22;
    const s = row * spacingPerRow + col * 5;
    const lateral = col === 0 ? -11 : 11;
    const sample = this.sampleAt(s, lateral);
    return { x: sample.x, y: sample.y };
  }

  private static buildControlSamples(shape: TrackShape): RawPoint[] {
    let anchors: RawPoint[];

    switch (shape) {
      case 'heart':
        // Non-intersecting heart-shaped scenic track: bus stop (270, 292) -> left lobe -> center dip -> right lobe -> exit ramp
        anchors = [
          { x: 266, y: 292 },
          { x: 214, y: 268 },
          { x: 144, y: 234 },
          { x: 102, y: 178 },
          { x: 118, y: 120 },
          { x: 180, y: 102 },
          { x: 242, y: 128 },
          { x: 270, y: 162 },
          { x: 302, y: 128 },
          { x: 368, y: 102 },
          { x: 432, y: 124 },
          { x: 486, y: 106 },
          { x: 562, y: 74 },
        ];
        break;

      case 'snake':
        // Serpentine S-curve track winding cleanly from top-right to bottom center
        anchors = [
          { x: 268, y: 292 },
          { x: 204, y: 272 },
          { x: 124, y: 256 },
          { x: 96, y: 212 },
          { x: 146, y: 176 },
          { x: 248, y: 180 },
          { x: 356, y: 196 },
          { x: 428, y: 172 },
          { x: 422, y: 124 },
          { x: 344, y: 106 },
          { x: 234, y: 112 },
          { x: 148, y: 106 },
          { x: 208, y: 80 },
          { x: 356, y: 80 },
          { x: 486, y: 80 },
          { x: 562, y: 74 },
        ];
        break;

      case 'figure8':
        // Braided double-bend loop curving cleanly without self-overlap
        anchors = [
          { x: 268, y: 292 },
          { x: 332, y: 268 },
          { x: 404, y: 242 },
          { x: 426, y: 188 },
          { x: 374, y: 144 },
          { x: 286, y: 168 },
          { x: 208, y: 218 },
          { x: 132, y: 232 },
          { x: 96, y: 182 },
          { x: 124, y: 124 },
          { x: 208, y: 108 },
          { x: 312, y: 112 },
          { x: 422, y: 110 },
          { x: 500, y: 90 },
          { x: 562, y: 74 },
        ];
        break;

      case 'ring':
      default:
        // Smooth stadium loop curving around left & top up to top-right feeder
        anchors = [
          { x: 268, y: 292 },
          { x: 202, y: 272 },
          { x: 130, y: 248 },
          { x: 96, y: 196 },
          { x: 112, y: 138 },
          { x: 178, y: 108 },
          { x: 274, y: 106 },
          { x: 372, y: 118 },
          { x: 446, y: 114 },
          { x: 506, y: 92 },
          { x: 562, y: 74 },
        ];
        break;
    }

    return TrackGeometry.catmullRomChain(anchors, 16);
  }

  private static catmullRomChain(anchors: RawPoint[], subdivisions: number): RawPoint[] {
    const out: RawPoint[] = [];
    for (let i = 0; i < anchors.length - 1; i++) {
      const p0 = anchors[Math.max(0, i - 1)];
      const p1 = anchors[i];
      const p2 = anchors[i + 1];
      const p3 = anchors[Math.min(anchors.length - 1, i + 2)];

      const steps = i === anchors.length - 2 ? subdivisions + 1 : subdivisions;
      for (let s = 0; s < steps; s++) {
        const t = s / subdivisions;
        const t2 = t * t;
        const t3 = t2 * t;
        const x =
          0.5 *
          (2 * p1.x +
            (-p0.x + p2.x) * t +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
        const y =
          0.5 *
          (2 * p1.y +
            (-p0.y + p2.y) * t +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
        out.push({ x, y });
      }
    }
    return out;
  }
}
