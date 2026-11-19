import Foundation

enum EngineOutcome: Equatable {
    case playing
    case won
    case lostLotDeadlock
    case lostBoardBlocked
}

struct UndoSnapshot {
    var buses: [BusRuntime]
    var exitedCount: Int
    var parkingSlots: [ParkingSlotState]
    var passengers: [PassengerEntity]
}

struct TapBusActionResult {
    enum RejectReason {
        case notFound
        case notOnBoard
        case lockedMystery
        case blocked
        case lotFull
    }

    var accepted: Bool
    var reason: RejectReason?
    var exitCheck: ExitCheckResult?
    var slotIndex: Int?
    var newlyUnlockedIds: [String] = []
}

/// Deterministic gameplay coordinator combining BusSystem, ParkingLot, PassengerSystem, Undo, and Win/Lose evaluation.
final class GameEngine {
    let level: LevelConfig
    let busSystem: BusSystem
    let parkingLot: ParkingLot
    let passengerSystem: PassengerSystem
    let undoLimit: Int

    private var undoRemaining: Int
    private var history: [UndoSnapshot] = []
    private var boostersUsedThisLevel = 0
    private var undosUsedThisLevel = 0

    init(level: LevelConfig) {
        self.level = level
        self.busSystem = BusSystem(
            cols: level.gridSize.cols,
            rows: level.gridSize.rows,
            busConfigs: level.buses,
            obstacles: level.obstacles
        )
        self.parkingLot = ParkingLot(
            initialNormalUnlocked: level.slotsUnlocked,
            vipUnlocked: level.vipUnlocked ?? false
        )
        self.passengerSystem = PassengerSystem(segments: level.passengerQueue)
        self.undoLimit = level.undoLimit ?? 3
        self.undoRemaining = self.undoLimit
    }

    func getUndoRemaining() -> Int {
        undoRemaining
    }

    func canUndo() -> Bool {
        undoRemaining > 0 && !history.isEmpty
    }

    func captureSnapshot() {
        history.append(UndoSnapshot(
            buses: busSystem.getBuses(),
            exitedCount: busSystem.getExitedCount(),
            parkingSlots: parkingLot.snapshot(),
            passengers: passengerSystem.snapshot()
        ))
    }

    func tapBus(_ busId: String, immediatePark: Bool = false) -> TapBusActionResult {
        let check = busSystem.checkExit(busId)
        guard check.canExit else {
            let reason: TapBusActionResult.RejectReason
            switch check.reason {
            case .notFound: reason = .notFound
            case .notOnBoard: reason = .notOnBoard
            case .lockedMystery: reason = .lockedMystery
            case .blocked, .none: reason = .blocked
            }
            return TapBusActionResult(accepted: false, reason: reason, exitCheck: check)
        }

        guard let slotIndex = parkingLot.getFirstFreeSlot() else {
            return TapBusActionResult(accepted: false, reason: .lotFull)
        }

        captureSnapshot()
        if var bus = busSystem.getBus(busId) {
            parkingLot.occupySlot(slotIndex, busId: busId)
            bus.slotIndex = slotIndex
            busSystem.updateBus(bus)
        }
        let unlocked = busSystem.markBusExitedBoard(busId, nextState: immediatePark ? .parked : .drivingToSlot)
        return TapBusActionResult(accepted: true, slotIndex: slotIndex, newlyUnlockedIds: unlocked)
    }

    @discardableResult
    func undo() -> Bool {
        guard canUndo(), let snap = history.popLast() else { return false }
        undoRemaining -= 1
        undosUsedThisLevel += 1
        busSystem.restoreBuses(snap.buses, exitedCount: snap.exitedCount)
        parkingLot.restore(snap.parkingSlots)
        passengerSystem.restore(snap.passengers)
        return true
    }

    func stepBoarding() -> BoardResult? {
        passengerSystem.tryBoardOne(busSystem: busSystem)
    }

    func evaluateOutcome() -> EngineOutcome {
        if passengerSystem.isEmpty() {
            return .won
        }

        let allBuses = busSystem.getBuses()
        if allBuses.contains(where: { $0.state == .drivingToSlot || $0.state == .departing }) {
            return .playing
        }

        let parked = allBuses.filter { $0.state == .parked }
        if passengerSystem.findMatchingParkedBus(parked) != nil {
            return .playing
        }

        if !parkingLot.hasFreeSlot() {
            return .lostLotDeadlock
        }

        if !busSystem.hasAnyMovableBus() {
            return .lostBoardBlocked
        }

        return .playing
    }

    func markBoosterUsed() {
        boostersUsedThisLevel += 1
    }

    func calculateStars() -> Int {
        if undosUsedThisLevel == 0 && boostersUsedThisLevel == 0 {
            return 3
        }
        if undosUsedThisLevel + boostersUsedThisLevel <= 2 {
            return 2
        }
        return 1
    }
}
