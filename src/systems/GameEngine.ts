import { BusSystem, type ExitCheckResult } from './BusSystem';
import { ParkingLot } from './ParkingLot';
import { PassengerSystem, type BoardResult } from './PassengerSystem';
import type {
  BusRuntime,
  LevelConfig,
  ParkingSlotState,
  PassengerEntity,
} from '../types/game';

export type EngineOutcome =
  | 'playing'
  | 'won'
  | 'lost_lot_deadlock'
  | 'lost_board_blocked';

export interface UndoSnapshot {
  buses: BusRuntime[];
  exitedCount: number;
  parkingSlots: ParkingSlotState[];
  passengers: PassengerEntity[];
}

export interface TapBusActionResult {
  accepted: boolean;
  reason?: ExitCheckResult['reason'] | 'lot_full';
  exitCheck?: ExitCheckResult;
  slotIndex?: number;
  newlyUnlockedIds?: string[];
}

/**
 * Pure deterministic gameplay engine tying together BusSystem, ParkingLot,
 * PassengerSystem, Undo snapshots, and Win/Lose deadlock evaluation.
 */
export class GameEngine {
  public readonly level: LevelConfig;
  public readonly busSystem: BusSystem;
  public readonly parkingLot: ParkingLot;
  public readonly passengerSystem: PassengerSystem;

  public readonly undoLimit: number;
  private undoRemaining: number;
  private history: UndoSnapshot[] = [];
  private boostersUsedThisLevel = 0;
  private undosUsedThisLevel = 0;

  constructor(level: LevelConfig) {
    this.level = level;
    this.busSystem = new BusSystem(
      level.gridSize.cols,
      level.gridSize.rows,
      level.buses,
      level.obstacles,
    );
    this.parkingLot = new ParkingLot(
      level.slotsUnlocked ?? 3,
      Boolean(level.vipUnlocked),
    );
    this.passengerSystem = new PassengerSystem(level.passengerQueue);
    this.undoLimit = level.undoLimit ?? 3;
    this.undoRemaining = this.undoLimit;
  }

  public getUndoRemaining(): number {
    return this.undoRemaining;
  }

  public canUndo(): boolean {
    return this.undoRemaining > 0 && this.history.length > 0;
  }

  public captureSnapshot(): void {
    this.history.push({
      buses: this.busSystem.getBuses().map((b) => ({ ...b })),
      exitedCount: this.busSystem.getExitedCount(),
      parkingSlots: this.parkingLot.snapshot(),
      passengers: this.passengerSystem.snapshot(),
    });
  }

  /**
   * Attempts to move a bus off the board and reserve the first free parking slot.
   * Captures an undo snapshot immediately before mutating state.
   */
  public tapBus(busId: string, immediatePark = false): TapBusActionResult {
    const check = this.busSystem.checkExit(busId);
    if (!check.canExit) {
      return {
        accepted: false,
        reason: check.reason,
        exitCheck: check,
      };
    }

    const slotIndex = this.parkingLot.getFirstFreeSlot();
    if (slotIndex === null) {
      return {
        accepted: false,
        reason: 'lot_full',
      };
    }

    this.captureSnapshot();

    const bus = this.busSystem.getBus(busId)!;
    this.parkingLot.occupySlot(slotIndex, busId);
    bus.slotIndex = slotIndex;

    const newlyUnlockedIds = this.busSystem.markBusExitedBoard(
      busId,
      immediatePark ? 'parked' : 'driving_to_slot',
    );

    return {
      accepted: true,
      slotIndex,
      newlyUnlockedIds,
    };
  }

  /**
   * Reverts state to before the last successful bus move (or booster).
   */
  public undo(): boolean {
    if (!this.canUndo()) return false;
    const snap = this.history.pop()!;
    this.undoRemaining -= 1;
    this.undosUsedThisLevel += 1;
    this.busSystem.restoreBuses(snap.buses, snap.exitedCount);
    this.parkingLot.restore(snap.parkingSlots);
    this.passengerSystem.restore(snap.passengers);
    return true;
  }

  /**
   * Executes a single passenger boarding step across parked buses.
   */
  public stepBoarding(): BoardResult | null {
    const parked = this.busSystem.getBuses().filter((b) => b.state === 'parked');
    return this.passengerSystem.tryBoardOne(parked);
  }

  /**
   * Evaluates win or deadlock/blocked loss states.
   */
  public evaluateOutcome(): EngineOutcome {
    if (this.passengerSystem.isEmpty()) {
      return 'won';
    }

    const allBuses = this.busSystem.getBuses();

    // Never declare loss while a bus is still driving into a slot or departing
    if (allBuses.some((b) => b.state === 'driving_to_slot' || b.state === 'departing')) {
      return 'playing';
    }

    // If any parked bus can currently accept the front passenger, progress continues
    const parkedBuses = allBuses.filter((b) => b.state === 'parked');
    if (this.passengerSystem.findMatchingParkedBus(parkedBuses)) {
      return 'playing';
    }

    // No parked bus matches front passenger
    if (!this.parkingLot.hasFreeSlot()) {
      return 'lost_lot_deadlock';
    }

    if (!this.busSystem.hasAnyMovableBus()) {
      return 'lost_board_blocked';
    }

    return 'playing';
  }

  public markBoosterUsed(): void {
    this.boostersUsedThisLevel += 1;
  }

  public calculateStars(): number {
    if (this.undosUsedThisLevel === 0 && this.boostersUsedThisLevel === 0) {
      return 3;
    }
    if (this.undosUsedThisLevel + this.boostersUsedThisLevel <= 2) {
      return 2;
    }
    return 1;
  }
}
