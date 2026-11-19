import XCTest
@testable import BusFeverParty

final class BusFeverPartyTests: XCTestCase {
    func testAllBundledLevelsValidAndSolvableBoosterFree() {
        let regular = LevelRepository.shared.getAllLevels()
        let events = LevelRepository.shared.getEventLevels()
        XCTAssertEqual(regular.count, 25, "Expected 25 regular handcrafted levels")
        XCTAssertGreaterThanOrEqual(events.count, 1, "Expected seasonal event level")

        for lvl in regular + events {
            let report = LevelSolver.solve(lvl)
            XCTAssertTrue(report.issues.isEmpty, "Level \(lvl.id) issues: \(report.issues)")
            XCTAssertTrue(report.solvable, "Level \(lvl.id) should be solvable booster-free")
            XCTAssertEqual(report.solutionMoves.count, lvl.buses.count)
        }
    }

    func testEndlessGeneratorLevels26To45ValidAndSolvable() {
        for id in 26...45 {
            let lvl = InfiniteLevelGenerator.generate(levelId: id)
            XCTAssertEqual(lvl.id, id)
            let report = LevelSolver.solve(lvl, maxStates: 45_000)
            XCTAssertTrue(report.issues.isEmpty, "Endless level \(id) issues: \(report.issues)")
            XCTAssertTrue(report.solvable, "Endless level \(id) should be solvable booster-free")
        }
    }

    func testGameEngineWinDeadlockAndUndo() {
        guard let lv1 = LevelRepository.shared.getLevel(1) else {
            return XCTFail("Missing Level 1")
        }
        let report = LevelSolver.solve(lv1)
        XCTAssertTrue(report.solvable)

        let engine = GameEngine(level: lv1)
        XCTAssertEqual(engine.evaluateOutcome(), .playing)

        // Tap first bus, board 1 passenger, then undo
        let firstMove = report.solutionMoves[0]
        XCTAssertTrue(engine.tapBus(firstMove, immediatePark: true).accepted)
        _ = engine.stepBoarding()
        XCTAssertTrue(engine.undo())
        XCTAssertEqual(engine.getUndoRemaining(), (lv1.undoLimit ?? 3) - 1)

        // Replay cleanly to win
        for busId in report.solutionMoves {
            XCTAssertTrue(engine.tapBus(busId, immediatePark: true).accepted)
            while let res = engine.stepBoarding() {
                if res.busFull, var bus = engine.busSystem.getBus(res.busId) {
                    if let slotIdx = bus.slotIndex {
                        engine.parkingLot.freeSlot(slotIdx)
                    }
                    bus.slotIndex = nil
                    bus.state = .departed
                    engine.busSystem.updateBus(bus)
                }
            }
        }
        XCTAssertEqual(engine.evaluateOutcome(), .won)
    }

    func testBoostersVipArrangeAndJumble() {
        guard let lv8 = LevelRepository.shared.getLevel(8) else {
            return XCTFail("Missing Level 8")
        }
        let engine = GameEngine(level: lv8)
        XCTAssertTrue(BoosterSystem.applyVip(engine).success)
        XCTAssertTrue(engine.parkingLot.isVipUnlocked())
        XCTAssertTrue(BoosterSystem.applyArrange(engine).success)
        XCTAssertTrue(engine.busSystem.hasAnyMovableBus())
        XCTAssertTrue(BoosterSystem.applyJumble(engine).success)
    }
}
