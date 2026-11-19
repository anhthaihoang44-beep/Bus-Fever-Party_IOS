import Foundation

struct SolveReport {
    var solvable: Bool
    var solutionMoves: [String]
    var statesExplored: Int
    var issues: [String]
}

private struct ParkedSimBus {
    var color: BusColor
    var remaining: Int
}

/// Validates level geometry/parity and searches for a booster-free winning move sequence via memoized DFS.
enum LevelSolver {
    static func validateGeometryAndParity(_ level: LevelConfig) -> [String] {
        var issues: [String] = []
        guard !level.buses.isEmpty else {
            return ["Level has no buses."]
        }

        var busIds = Set<String>()
        var busOBBs: [(id: String, obb: OBB)] = []
        for b in level.buses {
            if !busIds.insert(b.id).inserted {
                issues.append("Duplicate bus id: \(b.id)")
            }
            if b.capacity <= 0 {
                issues.append("Bus \(b.id) has non-positive capacity \(b.capacity)")
            }
            busOBBs.append((b.id, BusSystem.busToOBB(b)))
        }

        let obsOBBs = level.obstacles.map { ($0.id, BusSystem.obstacleToOBB($0)) }

        for i in 0..<busOBBs.count {
            for j in (i + 1)..<busOBBs.count {
                if BoosterSystem.obbsOverlap(busOBBs[i].obb, busOBBs[j].obb) {
                    issues.append("Buses \(busOBBs[i].id) and \(busOBBs[j].id) overlap initially.")
                }
            }
        }

        for b in busOBBs {
            for o in obsOBBs {
                if BoosterSystem.obbsOverlap(b.obb, o.1) {
                    issues.append("Bus \(b.id) overlaps obstacle \(o.0).")
                }
            }
        }

        var busCapByColor: [BusColor: Int] = [:]
        for b in level.buses {
            busCapByColor[b.color, default: 0] += b.capacity
        }

        var paxByColor: [BusColor: Int] = [:]
        for seg in level.passengerQueue {
            if seg.count <= 0 {
                issues.append("Passenger segment \(seg.color.rawValue) has non-positive count.")
            }
            paxByColor[seg.color, default: 0] += seg.count
        }

        let allColors = Set(busCapByColor.keys).union(paxByColor.keys)
        for c in allColors {
            let cap = busCapByColor[c] ?? 0
            let pax = paxByColor[c] ?? 0
            if cap != pax {
                issues.append("Color \(c.rawValue) mismatch: bus capacity=\(cap), passengers=\(pax).")
            }
        }

        return issues
    }

    static func solve(_ level: LevelConfig, maxStates: Int = 80_000) -> SolveReport {
        let issues = validateGeometryAndParity(level)
        guard issues.isEmpty else {
            return SolveReport(solvable: false, solutionMoves: [], statesExplored: 0, issues: issues)
        }

        let buses = level.buses
        let n = buses.count
        guard n <= 64 else {
            return SolveReport(solvable: false, solutionMoves: [], statesExplored: 0, issues: ["Bus count exceeds solver mask width (64)."])
        }

        var flatQueue: [BusColor] = []
        for seg in level.passengerQueue {
            flatQueue.append(contentsOf: repeatElement(seg.color, count: seg.count))
        }

        let slotLimit = max(1, level.slotsUnlocked) + ((level.vipUnlocked ?? false) ? 1 : 0)
        let obsOBBs = level.obstacles.map { BusSystem.obstacleToOBB($0) }
        let busOBBs = buses.map { BusSystem.busToOBB($0) }

        var blockedByObstacle = [Bool](repeating: false, count: n)
        var busBlockers = [[Int]](repeating: [], count: n)

        for i in 0..<n {
            let dir = buses[i].direction.unitVector
            if obsOBBs.contains(where: { BusSystem.sweptOBBCollision(moving: busOBBs[i], dir: dir, target: $0) != nil }) {
                blockedByObstacle[i] = true
                continue
            }
            for j in 0..<n where i != j {
                if BusSystem.sweptOBBCollision(moving: busOBBs[i], dir: dir, target: busOBBs[j]) != nil {
                    busBlockers[i].append(j)
                }
            }
        }

        var visited = Set<String>()
        var statesExplored = 0
        var solutionPath: [String] = []

        func advanceBoarding(parked: [ParkedSimBus], qIdx: Int) -> ([ParkedSimBus], Int) {
            var nextParked = parked
            var curIdx = qIdx
            while curIdx < flatQueue.count {
                let frontColor = flatQueue[curIdx]
                var bestIdx = -1
                for k in 0..<nextParked.count where nextParked[k].color == frontColor && nextParked[k].remaining > 0 {
                    if bestIdx == -1 || nextParked[k].remaining < nextParked[bestIdx].remaining {
                        bestIdx = k
                    }
                }
                if bestIdx == -1 { break }
                nextParked[bestIdx].remaining -= 1
                curIdx += 1
                if nextParked[bestIdx].remaining == 0 {
                    nextParked.remove(at: bestIdx)
                }
            }
            return (nextParked, curIdx)
        }

        func dfs(boardMask: UInt64, exitedCount: Int, parked: [ParkedSimBus], qIdx: Int) -> Bool {
            if qIdx >= flatQueue.count { return true }
            if statesExplored >= maxStates { return false }
            if parked.count >= slotLimit { return false }

            let parkedKey = parked
                .map { "\($0.color.rawValue):\($0.remaining)" }
                .sorted()
                .joined(separator: ",")
            let key = "\(boardMask)|\(qIdx)|\(parkedKey)"
            if !visited.insert(key).inserted { return false }
            statesExplored += 1

            var movable: [Int] = []
            for i in 0..<n {
                let bit = UInt64(1) << i
                if (boardMask & bit) == 0 || blockedByObstacle[i] { continue }
                let b = buses[i]
                if b.type == .mystery {
                    let req = max(1, b.unlockAfter ?? 3)
                    if exitedCount < req { continue }
                }
                let blocked = busBlockers[i].contains { blockerIdx in
                    (boardMask & (UInt64(1) << blockerIdx)) != 0
                }
                if !blocked {
                    movable.append(i)
                }
            }

            if movable.isEmpty { return false }

            var lookahead: [BusColor: Int] = [:]
            let upper = min(32, flatQueue.count - qIdx)
            for off in 0..<upper {
                let c = flatQueue[qIdx + off]
                if lookahead[c] == nil {
                    lookahead[c] = off
                }
            }

            movable.sort { ia, ib in
                (lookahead[buses[ia].color] ?? 999) < (lookahead[buses[ib].color] ?? 999)
            }

            for idx in movable {
                let b = buses[idx]
                let nextMask = boardMask & ~(UInt64(1) << idx)
                let added = parked + [ParkedSimBus(color: b.color, remaining: b.capacity)]
                let (nextParked, nextQIdx) = advanceBoarding(parked: added, qIdx: qIdx)
                solutionPath.append(b.id)
                if dfs(boardMask: nextMask, exitedCount: exitedCount + 1, parked: nextParked, qIdx: nextQIdx) {
                    return true
                }
                solutionPath.removeLast()
            }

            return false
        }

        let fullMask: UInt64 = n == 64 ? UInt64.max : (UInt64(1) << n) - 1
        let solvable = dfs(boardMask: fullMask, exitedCount: 0, parked: [], qIdx: 0)
        return SolveReport(
            solvable: solvable,
            solutionMoves: solvable ? solutionPath : [],
            statesExplored: statesExplored,
            issues: solvable ? [] : ["No booster-free solution found within search budget."]
        )
    }
}
