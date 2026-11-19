import Foundation

struct OBB {
    var center: Vec2
    var axisU: Vec2
    var axisV: Vec2
    var halfU: Double
    var halfV: Double
}

struct ExitCheckResult {
    enum Reason: Equatable {
        case notFound
        case notOnBoard
        case lockedMystery
        case blocked
    }

    enum BlockerKind: Equatable {
        case bus
        case obstacle
    }

    var canExit: Bool
    var reason: Reason?
    var blockerId: String?
    var blockerKind: BlockerKind?
    var hitDistance: Double?
}

/// Deterministic board & 2D Swept Oriented Bounding Box (SAT) collision system.
final class BusSystem {
    let cols: Int
    let rows: Int
    private var orderedIds: [String] = []
    private var buses: [String: BusRuntime] = [:]
    private var obstacles: [ObstacleConfig] = []
    private var exitedCount: Int = 0

    init(cols: Int, rows: Int, busConfigs: [BusConfig], obstacles: [ObstacleConfig] = []) {
        self.cols = cols
        self.rows = rows
        self.obstacles = obstacles
        for cfg in busConfigs {
            orderedIds.append(cfg.id)
            buses[cfg.id] = BusRuntime(config: cfg)
        }
    }

    func getBuses() -> [BusRuntime] {
        orderedIds.compactMap { buses[$0] }
    }

    func getBoardBuses() -> [BusRuntime] {
        getBuses().filter { $0.state == .board }
    }

    func getBus(_ id: String) -> BusRuntime? {
        buses[id]
    }

    func updateBus(_ bus: BusRuntime) {
        if buses[bus.id] == nil {
            orderedIds.append(bus.id)
        }
        buses[bus.id] = bus
    }

    func getObstacles() -> [ObstacleConfig] {
        obstacles
    }

    func getExitedCount() -> Int {
        exitedCount
    }

    static func busToOBB(x: Double, y: Double, direction: Direction, length: Double?, width: Double?) -> OBB {
        let u = direction.unitVector
        let v = Vec2(x: -u.y, y: u.x)
        let halfU = (length ?? GameConstants.defaultBusLength) * 0.5
        let halfV = (width ?? GameConstants.defaultBusWidth) * 0.5
        return OBB(center: Vec2(x: x, y: y), axisU: u, axisV: v, halfU: halfU, halfV: halfV)
    }

    static func busToOBB(_ bus: BusConfig) -> OBB {
        busToOBB(x: bus.x, y: bus.y, direction: bus.direction, length: bus.length, width: bus.width)
    }

    static func busToOBB(_ bus: BusRuntime) -> OBB {
        busToOBB(x: bus.x, y: bus.y, direction: bus.direction, length: bus.length, width: bus.width)
    }

    static func obstacleToOBB(_ obs: ObstacleConfig) -> OBB {
        let rad = (obs.angle ?? 0.0) * .pi / 180.0
        let c = cos(rad)
        let s = sin(rad)
        return OBB(
            center: Vec2(x: obs.x, y: obs.y),
            axisU: Vec2(x: c, y: s),
            axisV: Vec2(x: -s, y: c),
            halfU: (obs.width ?? GameConstants.defaultObstacleSize) * 0.5,
            halfV: (obs.height ?? GameConstants.defaultObstacleSize) * 0.5
        )
    }

    /// 2D Swept OBB vs static OBB intersection along unit velocity vector `dir`.
    static func sweptOBBCollision(moving: OBB, dir: Vec2, target: OBB) -> Double? {
        let axes = [moving.axisU, moving.axisV, target.axisU, target.axisV]
        let relCenter = Vec2(x: target.center.x - moving.center.x, y: target.center.y - moving.center.y)

        var tEnter = 0.0
        var tExit = Double.infinity
        let eps = 1e-6

        for axis in axes {
            let rA = moving.halfU * abs(dot(moving.axisU, axis)) + moving.halfV * abs(dot(moving.axisV, axis))
            let rB = target.halfU * abs(dot(target.axisU, axis)) + target.halfV * abs(dot(target.axisV, axis))
            let combinedRadius = rA + rB
            let cDist = dot(relCenter, axis)
            let speed = dot(dir, axis)

            if abs(speed) < eps {
                if abs(cDist) >= combinedRadius - 1e-4 {
                    return nil
                }
            } else {
                var t1 = (cDist - combinedRadius + 1e-4) / speed
                var t2 = (cDist + combinedRadius - 1e-4) / speed
                if t1 > t2 {
                    swap(&t1, &t2)
                }
                tEnter = max(tEnter, t1)
                tExit = min(tExit, t2)
                if tEnter > tExit || tExit <= 0 {
                    return nil
                }
            }
        }

        if tExit > 0 && tEnter <= tExit {
            return max(0.0, tEnter)
        }
        return nil
    }

    func checkExit(_ busId: String) -> ExitCheckResult {
        guard let bus = buses[busId] else {
            return ExitCheckResult(canExit: false, reason: .notFound)
        }
        guard bus.state == .board else {
            return ExitCheckResult(canExit: false, reason: .notOnBoard)
        }
        guard bus.unlocked else {
            return ExitCheckResult(canExit: false, reason: .lockedMystery)
        }

        let movingOBB = Self.busToOBB(bus)
        let dir = bus.direction.unitVector

        var closestDist = Double.infinity
        var closestId: String?
        var closestKind: ExitCheckResult.BlockerKind?

        for otherId in orderedIds {
            guard let other = buses[otherId], other.id != bus.id, other.state == .board else { continue }
            if let hitDist = Self.sweptOBBCollision(moving: movingOBB, dir: dir, target: Self.busToOBB(other)),
               hitDist < closestDist {
                closestDist = hitDist
                closestId = other.id
                closestKind = .bus
            }
        }

        for obs in obstacles {
            if let hitDist = Self.sweptOBBCollision(moving: movingOBB, dir: dir, target: Self.obstacleToOBB(obs)),
               hitDist < closestDist {
                closestDist = hitDist
                closestId = obs.id
                closestKind = .obstacle
            }
        }

        if let blockerId = closestId, let kind = closestKind {
            return ExitCheckResult(canExit: false, reason: .blocked, blockerId: blockerId, blockerKind: kind, hitDistance: closestDist)
        }

        return ExitCheckResult(canExit: true)
    }

    @discardableResult
    func markBusExitedBoard(_ busId: String, nextState: BusLocationState = .drivingToSlot) -> [String] {
        guard var bus = buses[busId], bus.state == .board else { return [] }
        bus.state = nextState
        buses[busId] = bus
        exitedCount += 1

        var newlyUnlocked: [String] = []
        for id in orderedIds {
            guard var other = buses[id], other.state == .board, !other.unlocked else { continue }
            other.mysteryRemaining = max(0, other.mysteryRemaining - 1)
            if other.mysteryRemaining == 0 {
                other.unlocked = true
                newlyUnlocked.append(other.id)
            }
            buses[id] = other
        }
        return newlyUnlocked
    }

    func getMovableBuses() -> [BusRuntime] {
        getBoardBuses().filter { checkExit($0.id).canExit }
    }

    func hasAnyMovableBus() -> Bool {
        getBoardBuses().contains { checkExit($0.id).canExit }
    }

    func restoreBuses(_ snapshot: [BusRuntime], exitedCount: Int) {
        buses.removeAll()
        orderedIds.removeAll()
        for b in snapshot {
            orderedIds.append(b.id)
            buses[b.id] = b
        }
        self.exitedCount = exitedCount
    }

    private static func dot(_ a: Vec2, _ b: Vec2) -> Double {
        a.x * b.x + a.y * b.y
    }
}
