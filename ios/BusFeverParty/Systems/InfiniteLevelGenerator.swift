import Foundation

private struct Mulberry32 {
    private var state: UInt32

    init(seed: Int) {
        self.state = UInt32(truncatingIfNeeded: seed)
    }

    mutating func next() -> Double {
        state = state &+ 0x6D2B79F5
        var t = (state ^ (state >> 15)) &* (1 | state)
        t = (t &+ ((t ^ (t >> 7)) &* (61 | t))) ^ t
        let out = t ^ (t >> 14)
        return Double(out) / 4_294_967_296.0
    }

    mutating func nextInt(_ bound: Int) -> Int {
        Int(next() * Double(bound))
    }

    mutating func shuffle<T>(_ array: inout [T]) {
        guard array.count > 1 else { return }
        for i in stride(from: array.count - 1, through: 1, by: -1) {
            let j = nextInt(i + 1)
            array.swapAt(i, j)
        }
    }
}

private struct RawEndlessBus {
    var x: Double
    var y: Double
    var dir: Direction
    var len: Double?
    var wid: Double?
}

/// Deterministically generates endless, validated, booster-free solvable levels for any levelId > 25.
final class InfiniteLevelGenerator {
    private static var cache: [Int: LevelConfig] = [:]
    private static let lock = NSLock()

    private static let adjectives = [
        "Sunny", "Neon", "Maple", "Emerald", "Turbo",
        "Candy", "Royal", "Starlight", "Grand", "Cosmic"
    ]
    private static let nouns = [
        "Station", "Crosswalk", "Junction", "Loop",
        "Boulevard", "Terminal", "Plaza", "Parkway"
    ]

    static func generate(levelId: Int) -> LevelConfig {
        lock.lock()
        if let hit = cache[levelId] {
            lock.unlock()
            return hit
        }
        lock.unlock()

        let isBoss = levelId % 5 == 0
        var rng = Mulberry32(seed: Int(Int64(levelId) &* 2_654_435_761 + 17))

        let shapes = TrackShape.allCases
        let themes = ThemeId.allCases
        let trackShape = shapes[(levelId + rng.nextInt(2)) % shapes.count]
        let theme = themes[((levelId - 1) / 5) % themes.count]
        let name = "\(adjectives[levelId % adjectives.count]) \(nouns[(levelId * 3) % nouns.count])"

        let level: LevelConfig
        if isBoss || rng.next() < 0.4 {
            level = buildDiagonalClusterLevel(levelId: levelId, name: name, trackShape: trackShape, theme: theme, isBoss: isBoss, rng: &rng)
        } else {
            level = buildTiledGridLevel(levelId: levelId, name: name, trackShape: trackShape, theme: theme, isBoss: isBoss, rng: &rng)
        }

        lock.lock()
        cache[levelId] = level
        lock.unlock()
        return level
    }

    private static func buildTiledGridLevel(
        levelId: Int,
        name: String,
        trackShape: TrackShape,
        theme: ThemeId,
        isBoss: Bool,
        rng: inout Mulberry32
    ) -> LevelConfig {
        let cols = isBoss ? 7 : 6
        let rows = 6
        var occupied = [[Bool]](repeating: [Bool](repeating: false, count: cols), count: rows)

        var obstacles: [ObstacleConfig] = []
        let targetObs = isBoss ? 4 : 2 + (levelId % 3)
        var attempts = 0
        while obstacles.count < targetObs && attempts < 40 {
            attempts += 1
            let c = 1 + rng.nextInt(max(1, cols - 2))
            let r = 1 + rng.nextInt(max(1, rows - 2))
            if !occupied[r][c] {
                occupied[r][c] = true
                obstacles.append(ObstacleConfig(id: "o\(obstacles.count + 1)", x: Double(c), y: Double(r)))
            }
        }

        var rawBuses: [RawEndlessBus] = []
        let targetBuses = isBoss ? 16 : 12 + (levelId % 4)
        var cells: [(Int, Int)] = []
        for r in 0..<rows {
            for c in 0..<cols {
                cells.append((c, r))
            }
        }
        rng.shuffle(&cells)

        for (c, r) in cells {
            if rawBuses.count >= targetBuses { break }
            if occupied[r][c] { continue }

            let tryHoriz = rng.next() < 0.5
            let modes = tryHoriz ? [true, false] : [false, true]
            for horiz in modes {
                if horiz && c + 1 < cols && !occupied[r][c + 1] {
                    occupied[r][c] = true
                    occupied[r][c + 1] = true
                    let dir: Direction = Double(c) < Double(cols) * 0.45 ? .left : (Double(c) > Double(cols) * 0.45 ? .right : (rng.next() < 0.5 ? .left : .right))
                    rawBuses.append(RawEndlessBus(x: Double(c) + 0.5, y: Double(r), dir: dir))
                    break
                }
                if !horiz && r + 1 < rows && !occupied[r + 1][c] {
                    occupied[r][c] = true
                    occupied[r + 1][c] = true
                    let dir: Direction = Double(r) < Double(rows) * 0.45 ? .up : (Double(r) > Double(rows) * 0.45 ? .down : (rng.next() < 0.5 ? .up : .down))
                    rawBuses.append(RawEndlessBus(x: Double(c), y: Double(r) + 0.5, dir: dir))
                    break
                }
            }
        }

        ensurePeelable(cols: cols, rows: rows, rawBuses: &rawBuses, obstacles: obstacles, rng: &rng)

        var pool = BusColor.allCases
        rng.shuffle(&pool)
        let colorCount = min(pool.count, isBoss ? 8 : 6 + (levelId % 2))
        let colorPool = Array(pool.prefix(colorCount))

        return finalizeLevel(
            levelId: levelId,
            name: name,
            cols: cols,
            rows: rows,
            rawBuses: rawBuses,
            obstacles: obstacles,
            colorPool: colorPool,
            trackShape: trackShape,
            theme: theme,
            mysteryTargetCount: isBoss ? 3 : 2,
            rng: &rng
        )
    }

    private static func buildDiagonalClusterLevel(
        levelId: Int,
        name: String,
        trackShape: TrackShape,
        theme: ThemeId,
        isBoss: Bool,
        rng: inout Mulberry32
    ) -> LevelConfig {
        let cols = 8
        let rows = 8
        let uCount = isBoss ? 4 : 3
        let vCount = 4
        let step = 1.78
        let s = sqrt(0.5)
        let origin = 3.5

        var rawBuses: [RawEndlessBus] = []
        let diags: [Direction] = [.upLeft, .upRight, .downLeft, .downRight]

        for u in 0..<uCount {
            for v in 0..<vCount {
                let du = (Double(u) - Double(uCount - 1) / 2.0) * step
                let dv = (Double(v) - Double(vCount - 1) / 2.0) * step
                let x = ((origin + du * s + dv * (-s)) * 100.0).rounded() / 100.0
                let y = ((origin + du * s + dv * s) * 100.0).rounded() / 100.0

                let dir: Direction
                if u == 0 && v < vCount - 1 { dir = .upLeft }
                else if u == uCount - 1 && v > 0 { dir = .downRight }
                else if v == 0 { dir = .upRight }
                else if v == vCount - 1 { dir = .downLeft }
                else { dir = diags[rng.nextInt(diags.count)] }

                rawBuses.append(RawEndlessBus(x: x, y: y, dir: dir, len: 1.5, wid: 0.72))
            }
        }

        let obstacles = [
            ObstacleConfig(id: "o1", x: -1.4, y: 3.5, width: 0.72, height: 0.72, angle: 45),
            ObstacleConfig(id: "o2", x: 8.4, y: 3.5, width: 0.72, height: 0.72, angle: 45)
        ]

        ensurePeelable(cols: cols, rows: rows, rawBuses: &rawBuses, obstacles: obstacles, rng: &rng)

        var pool = BusColor.allCases
        rng.shuffle(&pool)
        let colorCount = min(pool.count, isBoss ? 8 : 7)
        let colorPool = Array(pool.prefix(colorCount))

        return finalizeLevel(
            levelId: levelId,
            name: name,
            cols: cols,
            rows: rows,
            rawBuses: rawBuses,
            obstacles: obstacles,
            colorPool: colorPool,
            trackShape: trackShape,
            theme: theme,
            mysteryTargetCount: isBoss ? 3 : 2,
            rng: &rng
        )
    }

    private static func ensurePeelable(
        cols: Int,
        rows: Int,
        rawBuses: inout [RawEndlessBus],
        obstacles: [ObstacleConfig],
        rng: inout Mulberry32
    ) {
        for _ in 0..<30 {
            let cfgs = rawBuses.enumerated().map { idx, b in
                BusConfig(
                    id: "t\(idx)",
                    color: .blue,
                    capacity: 6,
                    x: b.x,
                    y: b.y,
                    direction: b.dir,
                    type: .normal,
                    length: b.len,
                    width: b.wid
                )
            }
            let sim = BusSystem(cols: cols, rows: rows, busConfigs: cfgs, obstacles: obstacles)
            while !sim.getBoardBuses().isEmpty {
                let movable = sim.getMovableBuses()
                if movable.isEmpty { break }
                sim.markBusExitedBoard(movable[0].id, nextState: .departed)
            }
            let stuck = sim.getBoardBuses()
            if stuck.isEmpty { return }
            let target = stuck[rng.nextInt(stuck.count)]
            if let idx = Int(target.id.dropFirst()), idx < rawBuses.count {
                rawBuses[idx].dir = rawBuses[idx].dir.opposite
            }
        }
    }

    private static func finalizeLevel(
        levelId: Int,
        name: String,
        cols: Int,
        rows: Int,
        rawBuses: [RawEndlessBus],
        obstacles: [ObstacleConfig],
        colorPool: [BusColor],
        trackShape: TrackShape,
        theme: ThemeId,
        mysteryTargetCount: Int,
        rng: inout Mulberry32
    ) -> LevelConfig {
        let capChoices = [6, 8, 9, 10, 12]
        let obsOBBs = obstacles.map { BusSystem.obstacleToOBB($0) }

        var buses: [BusConfig] = []
        for (i, b) in rawBuses.enumerated() {
            let candidate = BusConfig(
                id: "b\(buses.count + 1)",
                color: colorPool[i % colorPool.count],
                capacity: capChoices[(i + levelId) % capChoices.count],
                x: b.x,
                y: b.y,
                direction: b.dir,
                type: .normal,
                length: b.len,
                width: b.wid
            )
            let obb = BusSystem.busToOBB(candidate)
            if obsOBBs.contains(where: { BoosterSystem.obbsOverlap(obb, $0) }) { continue }
            if buses.contains(where: { BoosterSystem.obbsOverlap(obb, BusSystem.busToOBB($0)) }) { continue }
            buses.append(candidate)
        }

        let sim = BusSystem(cols: cols, rows: rows, busConfigs: buses, obstacles: obstacles)
        var exitOrder: [Int] = []
        while !sim.getBoardBuses().isEmpty {
            let movable = sim.getMovableBuses()
            if movable.isEmpty { break }
            let pick = movable[rng.nextInt(movable.count)]
            if let origIdx = buses.firstIndex(where: { $0.id == pick.id }) {
                exitOrder.append(origIdx)
            }
            sim.markBusExitedBoard(pick.id, nextState: .departed)
        }

        let mysteryStart = max(4, Int(Double(exitOrder.count) * 0.45))
        var assignedMystery = 0
        var k = mysteryStart
        while k < exitOrder.count && assignedMystery < mysteryTargetCount {
            let busIdx = exitOrder[k]
            buses[busIdx].type = .mystery
            buses[busIdx].unlockAfter = min(k, 4 + assignedMystery * 2)
            assignedMystery += 1
            k += 2
        }

        var scheduled = exitOrder
        var i = 0
        while i < scheduled.count - 1 {
            if rng.next() < 0.6 {
                scheduled.swapAt(i, i + 1)
            }
            i += 2
        }

        let segments = compressSegments(order: scheduled, buses: buses)
        var level = LevelConfig(
            id: levelId,
            name: name,
            isEvent: nil,
            eventName: nil,
            gridSize: GridSize(cols: cols, rows: rows),
            buses: buses,
            obstacles: obstacles,
            passengerQueue: segments,
            trackShape: trackShape,
            theme: theme,
            slotsUnlocked: 3,
            vipUnlocked: nil,
            boostersAvailable: BoostersAvailableConfig(vip: true, arrange: true, jumble: true),
            undoLimit: 4,
            tutorialHint: nil
        )

        if !LevelSolver.solve(level, maxStates: 35_000).solvable {
            level.passengerQueue = compressSegments(order: exitOrder, buses: buses)
        }
        return level
    }

    private static func compressSegments(order: [Int], buses: [BusConfig]) -> [PassengerSegment] {
        var segs: [PassengerSegment] = []
        for idx in order {
            let b = buses[idx]
            if let last = segs.last, last.color == b.color {
                segs[segs.count - 1].count += b.capacity
            } else {
                segs.append(PassengerSegment(color: b.color, count: b.capacity))
            }
        }
        return segs
    }
}
