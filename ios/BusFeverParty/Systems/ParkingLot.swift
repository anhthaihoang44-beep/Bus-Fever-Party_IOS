import Foundation

/// Manages 7 slanted parking slots:
/// index 0 = VIP slot, index 1..3 = unlocked normal slots, index 4..6 = extra '+' unlockable slots.
final class ParkingLot {
    private var slots: [ParkingSlotState]

    init(initialNormalUnlocked: Int = 3, vipUnlocked: Bool = false) {
        let normalCount = max(1, min(6, initialNormalUnlocked))
        var arr: [ParkingSlotState] = []
        for i in 0..<GameConstants.totalParkingSlots {
            if i == 0 {
                arr.append(ParkingSlotState(index: 0, kind: .vip, unlocked: vipUnlocked, busId: nil))
            } else if i <= 3 {
                arr.append(ParkingSlotState(index: i, kind: .normal, unlocked: i <= normalCount, busId: nil))
            } else {
                arr.append(ParkingSlotState(index: i, kind: .extra, unlocked: i <= normalCount, busId: nil))
            }
        }
        self.slots = arr
    }

    func getSlots() -> [ParkingSlotState] {
        slots
    }

    func getSlot(_ index: Int) -> ParkingSlotState? {
        guard index >= 0 && index < slots.count else { return nil }
        return slots[index]
    }

    /// Prefers regular/extra unlocked empty slots first so the VIP reserve remains free until needed.
    func getFirstFreeSlot() -> Int? {
        for i in 1..<slots.count where slots[i].unlocked && slots[i].busId == nil {
            return i
        }
        if slots[0].unlocked && slots[0].busId == nil {
            return 0
        }
        return nil
    }

    func hasFreeSlot() -> Bool {
        getFirstFreeSlot() != nil
    }

    func getFreeSlotCount() -> Int {
        slots.filter { $0.unlocked && $0.busId == nil }.count
    }

    func isVipUnlocked() -> Bool {
        slots[0].unlocked
    }

    @discardableResult
    func occupySlot(_ slotIndex: Int, busId: String) -> Bool {
        guard slotIndex >= 0 && slotIndex < slots.count else { return false }
        guard slots[slotIndex].unlocked && slots[slotIndex].busId == nil else { return false }
        slots[slotIndex].busId = busId
        return true
    }

    func freeSlot(_ slotIndex: Int) {
        guard slotIndex >= 0 && slotIndex < slots.count else { return }
        slots[slotIndex].busId = nil
    }

    @discardableResult
    func unlockVipSlot() -> Bool {
        guard !slots[0].unlocked else { return false }
        slots[0].unlocked = true
        return true
    }

    @discardableResult
    func unlockExtraSlot(_ preferredIndex: Int? = nil) -> Int? {
        if let idx = preferredIndex, idx > 0 && idx < slots.count, !slots[idx].unlocked {
            slots[idx].unlocked = true
            return idx
        }
        for i in 1..<slots.count where !slots[i].unlocked {
            slots[i].unlocked = true
            return i
        }
        return nil
    }

    func snapshot() -> [ParkingSlotState] {
        slots
    }

    func restore(_ snap: [ParkingSlotState]) {
        slots = snap
    }
}
