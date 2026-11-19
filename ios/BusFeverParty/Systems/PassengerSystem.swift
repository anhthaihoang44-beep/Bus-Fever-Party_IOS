import Foundation

struct BoardResult {
    var passenger: PassengerEntity
    var busId: String
    var busFull: Bool
}

/// Pure front-only passenger queue and matching bus boarding engine.
final class PassengerSystem {
    private var queue: [PassengerEntity] = []
    private let totalCount: Int

    init(segments: [PassengerSegment]) {
        var nextId = 0
        for seg in segments {
            for _ in 0..<seg.count {
                queue.append(PassengerEntity(id: nextId, color: seg.color))
                nextId += 1
            }
        }
        self.totalCount = queue.count
    }

    func getTotalCount() -> Int {
        totalCount
    }

    func getRemainingCount() -> Int {
        queue.count
    }

    func getQueue() -> [PassengerEntity] {
        queue
    }

    func peekFront() -> PassengerEntity? {
        queue.first
    }

    func getFrontColor() -> BusColor? {
        queue.first?.color
    }

    func isEmpty() -> Bool {
        queue.isEmpty
    }

    func findMatchingParkedBus(_ parkedBuses: [BusRuntime]) -> BusRuntime? {
        guard let front = queue.first else { return nil }
        var best: BusRuntime?
        for bus in parkedBuses {
            guard bus.state == .parked, bus.color == front.color, bus.boarded < bus.capacity else { continue }
            if best == nil || (bus.capacity - bus.boarded) < (best!.capacity - best!.boarded) {
                best = bus
            }
        }
        return best
    }

    func tryBoardOne(busSystem: BusSystem) -> BoardResult? {
        let parked = busSystem.getBuses().filter { $0.state == .parked }
        guard var bus = findMatchingParkedBus(parked), !queue.isEmpty else { return nil }
        let passenger = queue.removeFirst()
        bus.boarded += 1
        busSystem.updateBus(bus)
        return BoardResult(passenger: passenger, busId: bus.id, busFull: bus.boarded >= bus.capacity)
    }

    /// Jumbles contiguous color segments, bringing a parked bus color to the front when available.
    func jumbleSegments(preferredFrontColor: BusColor? = nil) {
        guard queue.count > 1 else { return }
        var segments: [[PassengerEntity]] = []
        for p in queue {
            if let last = segments.last, last[0].color == p.color {
                segments[segments.count - 1].append(p)
            } else {
                segments.append([p])
            }
        }
        guard segments.count > 1 else { return }

        segments.shuffle()
        if let prefer = preferredFrontColor,
           let idx = segments.firstIndex(where: { $0[0].color == prefer }),
           idx != 0 {
            segments.swapAt(0, idx)
        }
        queue = segments.flatMap { $0 }
    }

    func snapshot() -> [PassengerEntity] {
        queue
    }

    func restore(_ snap: [PassengerEntity]) {
        queue = snap
    }
}
