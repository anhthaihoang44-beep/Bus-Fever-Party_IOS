import { TOTAL_PARKING_SLOTS, type ParkingSlotState, type SlotKind } from '../types/game';

/**
 * Manages the 7-slot parking lot strip:
 * - Slot 0: VIP slot (far left, unlocked via VIP booster or level config)
 * - Slots 1..N: Normal slots (`slotsUnlocked`, default 3)
 * - Remaining slots up to index 6: Locked extra '+' slots (unlockable via reward/coins)
 */
export class ParkingLot {
  private slots: ParkingSlotState[] = [];

  constructor(slotsUnlocked = 3, vipUnlocked = false) {
    const clampedNormal = Math.max(1, Math.min(TOTAL_PARKING_SLOTS - 1, slotsUnlocked));

    for (let i = 0; i < TOTAL_PARKING_SLOTS; i++) {
      let kind: SlotKind = 'extra';
      let unlocked = false;

      if (i === 0) {
        kind = 'vip';
        unlocked = vipUnlocked;
      } else if (i <= clampedNormal) {
        kind = 'normal';
        unlocked = true;
      } else {
        kind = 'extra';
        unlocked = false;
      }

      this.slots.push({
        index: i,
        kind,
        unlocked,
        busId: null,
      });
    }
  }

  public getSlots(): ParkingSlotState[] {
    return this.slots.map((s) => ({ ...s }));
  }

  public getSlot(index: number): ParkingSlotState | undefined {
    return this.slots[index];
  }

  /**
   * Returns the first free unlocked slot index, preferring normal/extra slots
   * before overflowing into the VIP slot (or returns null if lot is full).
   */
  public getFirstFreeSlot(): number | null {
    for (let i = 1; i < this.slots.length; i++) {
      if (this.slots[i].unlocked && this.slots[i].busId === null) {
        return i;
      }
    }
    if (this.slots[0].unlocked && this.slots[0].busId === null) {
      return 0;
    }
    return null;
  }

  public hasFreeSlot(): boolean {
    return this.getFirstFreeSlot() !== null;
  }

  public getFreeSlotCount(): number {
    return this.slots.filter((s) => s.unlocked && s.busId === null).length;
  }

  public getUnlockedSlotCount(): number {
    return this.slots.filter((s) => s.unlocked).length;
  }

  public getOccupiedBusIds(): string[] {
    return this.slots
      .map((s) => s.busId)
      .filter((id): id is string => id !== null);
  }

  public occupySlot(slotIndex: number, busId: string): boolean {
    const slot = this.slots[slotIndex];
    if (!slot || !slot.unlocked || slot.busId !== null) {
      return false;
    }
    slot.busId = busId;
    return true;
  }

  public freeSlot(slotIndex: number): void {
    const slot = this.slots[slotIndex];
    if (slot) {
      slot.busId = null;
    }
  }

  public freeBusSlot(busId: string): number | null {
    const slot = this.slots.find((s) => s.busId === busId);
    if (!slot) return null;
    slot.busId = null;
    return slot.index;
  }

  public isVipUnlocked(): boolean {
    return this.slots[0].unlocked;
  }

  public unlockVipSlot(): boolean {
    if (this.slots[0].unlocked) return false;
    this.slots[0].unlocked = true;
    return true;
  }

  public hasLockedExtraSlot(): boolean {
    return this.slots.some((s) => s.kind === 'extra' && !s.unlocked);
  }

  public unlockExtraSlot(slotIndex?: number): number | null {
    if (slotIndex !== undefined) {
      const target = this.slots[slotIndex];
      if (target && target.kind === 'extra' && !target.unlocked) {
        target.unlocked = true;
        return target.index;
      }
      return null;
    }
    const firstLocked = this.slots.find((s) => s.kind === 'extra' && !s.unlocked);
    if (!firstLocked) return null;
    firstLocked.unlocked = true;
    return firstLocked.index;
  }

  public snapshot(): ParkingSlotState[] {
    return this.slots.map((s) => ({ ...s }));
  }

  public restore(snapshot: ParkingSlotState[]): void {
    this.slots = snapshot.map((s) => ({ ...s }));
  }
}
