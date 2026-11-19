import type {
  BusColor,
  BusRuntime,
  PassengerEntity,
  PassengerSegment,
} from '../types/game';

export interface BoardResult {
  passenger: PassengerEntity;
  busId: string;
  busFull: boolean;
}

/**
 * Pure passenger queue & color-matching boarding system.
 * Only the front-most passenger (`queue[0]`) can board a matching parked bus.
 */
export class PassengerSystem {
  private queue: PassengerEntity[] = [];
  private totalCount = 0;

  constructor(segments: PassengerSegment[]) {
    let nextId = 0;
    for (const seg of segments) {
      for (let i = 0; i < seg.count; i++) {
        this.queue.push({ id: nextId++, color: seg.color });
      }
    }
    this.totalCount = this.queue.length;
  }

  public getTotalCount(): number {
    return this.totalCount;
  }

  public getRemainingCount(): number {
    return this.queue.length;
  }

  public getQueue(): readonly PassengerEntity[] {
    return this.queue;
  }

  public peekFront(): PassengerEntity | undefined {
    return this.queue[0];
  }

  public getFrontColor(): BusColor | null {
    return this.queue[0]?.color ?? null;
  }

  public isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Returns the parked bus that can accept the current front passenger, if any.
   * Prefers the matching bus closest to full capacity so it finishes & departs sooner.
   */
  public findMatchingParkedBus(parkedBuses: BusRuntime[]): BusRuntime | undefined {
    const front = this.queue[0];
    if (!front) return undefined;

    let best: BusRuntime | undefined;
    for (const bus of parkedBuses) {
      if (bus.state !== 'parked') continue;
      if (bus.color !== front.color) continue;
      if (bus.boarded >= bus.capacity) continue;

      if (!best || bus.capacity - bus.boarded < best.capacity - best.boarded) {
        best = bus;
      }
    }
    return best;
  }

  /**
   * Attempts to board the front passenger onto a matching parked bus.
   */
  public tryBoardOne(parkedBuses: BusRuntime[]): BoardResult | null {
    const bus = this.findMatchingParkedBus(parkedBuses);
    if (!bus) return null;

    const passenger = this.queue.shift();
    if (!passenger) return null;

    bus.boarded += 1;
    return {
      passenger,
      busId: bus.id,
      busFull: bus.boarded >= bus.capacity,
    };
  }

  /**
   * Shuffles remaining colored segments in the queue (used by Jumble booster).
   * If `preferredFrontColor` is present among remaining passengers, brings one segment
   * of that color to the front so parked buses can immediately board.
   */
  public jumbleSegments(preferredFrontColor?: BusColor | null, rng = Math.random): void {
    if (this.queue.length <= 1) return;

    // Split remaining queue into contiguous color segments
    const segments: PassengerEntity[][] = [];
    for (const p of this.queue) {
      const last = segments[segments.length - 1];
      if (last && last[0].color === p.color) {
        last.push(p);
      } else {
        segments.push([p]);
      }
    }

    if (segments.length <= 1) return;

    // Fisher-Yates shuffle on segments
    const originalFirstColor = segments[0][0].color;
    for (let i = segments.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = segments[i];
      segments[i] = segments[j];
      segments[j] = tmp;
    }

    // Prioritize a matching parked bus color at the front if available
    if (preferredFrontColor) {
      const matchIdx = segments.findIndex((seg) => seg[0].color === preferredFrontColor);
      if (matchIdx > 0) {
        const [picked] = segments.splice(matchIdx, 1);
        segments.unshift(picked);
      }
    } else if (segments[0][0].color === originalFirstColor) {
      // Ensure visible change if possible
      const diffIdx = segments.findIndex((seg) => seg[0].color !== originalFirstColor);
      if (diffIdx > 0) {
        const tmp = segments[0];
        segments[0] = segments[diffIdx];
        segments[diffIdx] = tmp;
      }
    }

    this.queue = segments.flat();
  }

  public snapshot(): PassengerEntity[] {
    return this.queue.map((p) => ({ ...p }));
  }

  public restore(snapshot: PassengerEntity[]): void {
    this.queue = snapshot.map((p) => ({ ...p }));
  }
}
