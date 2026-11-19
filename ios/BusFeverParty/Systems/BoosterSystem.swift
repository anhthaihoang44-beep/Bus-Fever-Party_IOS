import Foundation

struct BoosterActionResult {
    var success: Bool
    var message: String
    var slotIndex: Int?
}

/// Handles level-gated booster availability and deterministic execution for VIP, Arrange, Jumble, and '+' Extra Slots.
enum BoosterSystem {
    static func isUnlockedForLevel(_ type: BoosterType, level: LevelConfig) -> Bool {
        let override: Bool?
        switch type {
        case .vip: override = level.boostersAvailable.vip
        case .arrange: override = level.boostersAvailable.arrange
        case .jumble: override = level.boostersAvailable.jumble
        }
        if override == true { return true }
        if override == false && level.id < type.unlockLevel { return false }
        return (level.isEvent ?? false) || level.id >= type.unlockLevel
    }

    static func applyVip(_ engine: GameEngine) -> BoosterActionResult {
        if engine.parkingLot.isVipUnlocked() {
            return BoosterActionResult(success: false, message: "VIP slot is already unlocked!")
        }
        engine.captureSnapshot()
        engine.parkingLot.unlockVipSlot()
        engine.markBoosterUsed()
        return BoosterActionResult(success: true, message: "VIP slot unlocked!", slotIndex: 0)
    }

    static func applyJumble(_ engine: GameEngine) -> BoosterActionResult {
        if engine.passengerSystem.getRemainingCount() <= 1 {
            return BoosterActionResult(success: false, message: "Not enough passengers to jumble!")
        }
        engine.captureSnapshot()
        let parked = engine.busSystem.getBuses().filter { $0.state == .parked && $0.boarded < $0.capacity }
        engine.passengerSystem.jumbleSegments(preferredFrontColor: parked.first?.color)
        engine.markBoosterUsed()
        return BoosterActionResult(success: true, message: "Passenger queue jumbled!")
    }

    static func applyArrange(_ engine: GameEngine) -> BoosterActionResult {
        let boardBuses = engine.busSystem.getBoardBuses()
        if boardBuses.isEmpty {
            return BoosterActionResult(success: false, message: "No buses left on the board!")
        }

        engine.captureSnapshot()

        let queue = engine.passengerSystem.getQueue()
        var firstPos: [BusColor: Int] = [:]
        for (idx, p) in queue.enumerated() where firstPos[p.color] == nil {
            firstPos[p.color] = idx
        }

        let sortedBuses = boardBuses.sorted {
            (firstPos[$0.color] ?? Int.max) < (firstPos[$1.color] ?? Int.max)
        }

        let obsOBBs = engine.busSystem.getObstacles().map { BusSystem.obstacleToOBB($0) }
        let cols = engine.busSystem.cols
        let rows = engine.busSystem.rows

        var centers: [Vec2] = boardBuses.map { Vec2(x: $0.x, y: $0.y) }
        var r = 0.5
        while r <= Double(rows) - 0.5 + 1e-6 {
            var c = 0.5
            while c <= Double(cols) - 0.5 + 1e-6 {
                centers.append(Vec2(x: c, y: r))
                c += 0.5
            }
            r += 0.5
        }

        var placed: [BusRuntime] = []
        var placedOBBs: [OBB] = []

        for var bus in sortedBuses {
            let best = findBestClearPlacement(
                bus: bus,
                centers: centers,
                cols: cols,
                rows: rows,
                obstacleOBBs: obsOBBs,
                alreadyPlaced: placed,
                alreadyPlacedOBBs: placedOBBs
            )
            bus.x = best.x
            bus.y = best.y
            bus.direction = best.dir
            placed.append(bus)
            placedOBBs.append(BusSystem.busToOBB(bus))
        }

        let nonBoard = engine.busSystem.getBuses().filter { $0.state != .board }
        engine.busSystem.restoreBuses(nonBoard + placed, exitedCount: engine.busSystem.getExitedCount())
        engine.markBoosterUsed()
        return BoosterActionResult(success: true, message: "Buses arranged to clear paths!")
    }

    static func applyUnlockExtraSlot(_ engine: GameEngine, preferredIndex: Int? = nil) -> BoosterActionResult {
        guard let idx = engine.parkingLot.unlockExtraSlot(preferredIndex) else {
            return BoosterActionResult(success: false, message: "No locked slots remaining!")
        }
        engine.markBoosterUsed()
        return BoosterActionResult(success: true, message: "Extra parking slot unlocked!", slotIndex: idx)
    }

    static func obbsOverlap(_ a: OBB, _ b: OBB) -> Bool {
        let axes = [a.axisU, a.axisV, b.axisU, b.axisV]
        let dx = b.center.x - a.center.x
        let dy = b.center.y - a.center.y

        for axis in axes {
            let projDist = abs(dx * axis.x + dy * axis.y)
            let rA = a.halfU * abs(a.axisU.x * axis.x + a.axisU.y * axis.y)
                + a.halfV * abs(a.axisV.x * axis.x + a.axisV.y * axis.y)
            let rB = b.halfU * abs(b.axisU.x * axis.x + b.axisU.y * axis.y)
                + b.halfV * abs(b.axisV.x * axis.x + b.axisV.y * axis.y)
            if projDist >= rA + rB - 1e-4 {
                return false
            }
        }
        return true
    }

    private static func findBestClearPlacement(
        bus: BusRuntime,
        centers: [Vec2],
        cols: Int,
        rows: Int,
        obstacleOBBs: [OBB],
        alreadyPlaced: [BusRuntime],
        alreadyPlacedOBBs: [OBB]
    ) -> (x: Double, y: Double, dir: Direction) {
        let dirs: [Direction] = [.up, .down, .left, .right]
        var fallback: (x: Double, y: Double, dir: Direction)?

        let scored = centers.sorted {
            hypot($0.x - bus.x, $0.y - bus.y) < hypot($1.x - bus.x, $1.y - bus.y)
        }

        for pt in scored {
            guard pt.x >= 0.25 && pt.x <= Double(cols) - 0.25 && pt.y >= 0.25 && pt.y <= Double(rows) - 0.25 else {
                continue
            }
            let sortedDirs = dirs.sorted { d1, d2 in
                edgeDistance(dir: d1, pt: pt, cols: cols, rows: rows) < edgeDistance(dir: d2, pt: pt, cols: cols, rows: rows)
            }

            for dir in sortedDirs {
                let probeOBB = BusSystem.busToOBB(x: pt.x, y: pt.y, direction: dir, length: bus.length, width: bus.width)
                if obstacleOBBs.contains(where: { obbsOverlap(probeOBB, $0) }) { continue }
                if alreadyPlacedOBBs.contains(where: { obbsOverlap(probeOBB, $0) }) { continue }

                let dirVec = dir.unitVector
                if obstacleOBBs.contains(where: { BusSystem.sweptOBBCollision(moving: probeOBB, dir: dirVec, target: $0) != nil }) {
                    continue
                }

                if fallback == nil {
                    fallback = (pt.x, pt.y, dir)
                }

                let blockedByPlaced = alreadyPlacedOBBs.contains {
                    BusSystem.sweptOBBCollision(moving: probeOBB, dir: dirVec, target: $0) != nil
                }
                let blocksPlaced = zip(alreadyPlaced, alreadyPlacedOBBs).contains { prev, prevOBB in
                    BusSystem.sweptOBBCollision(moving: prevOBB, dir: prev.direction.unitVector, target: probeOBB) != nil
                }

                if !blockedByPlaced && !blocksPlaced {
                    return (pt.x, pt.y, dir)
                }
            }
        }

        return fallback ?? (bus.x, bus.y, bus.direction)
    }

    private static func edgeDistance(dir: Direction, pt: Vec2, cols: Int, rows: Int) -> Double {
        switch dir {
        case .up: return pt.y
        case .down: return Double(rows) - pt.y
        case .left: return pt.x
        case .right: return Double(cols) - pt.x
        default: return Double(cols + rows)
        }
    }
}
