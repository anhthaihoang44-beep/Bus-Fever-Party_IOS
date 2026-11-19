import XCTest

final class BusFeverPartyUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    private func saveShot(_ name: String) {
        let shot = XCUIScreen.main.screenshot()
        let attachment = XCTAttachment(screenshot: shot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)

        let filename = "\(name).png"
        let tmpURL = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent(filename)
        try? shot.pngRepresentation.write(to: tmpURL)
    }

    func testCaptureAndVerifyAllMainScreens() throws {
        XCUIDevice.shared.orientation = .portrait

        let app = XCUIApplication()
        app.launch()

        let playBtn = app.buttons["home_play_button"]
        XCTAssertTrue(playBtn.waitForExistence(timeout: 12), "Home PLAY button should be visible")
        Thread.sleep(forTimeInterval: 1.0)

        let win = app.windows.element(boundBy: 0).frame
        XCTAssertGreaterThan(win.width, 300)
        for id in [
            "home_settings_button",
            "home_event_button",
            "home_play_button",
            "home_levels_button",
            "home_missions_button",
            "home_leaders_button"
        ] {
            let el = app.buttons[id]
            XCTAssertTrue(el.waitForExistence(timeout: 5), "\(id) should exist")
            XCTAssertGreaterThanOrEqual(el.frame.minX, win.minX + 4, "\(id) clipped left: \(el.frame) vs \(win)")
            XCTAssertLessThanOrEqual(el.frame.maxX, win.maxX - 4, "\(id) clipped right: \(el.frame) vs \(win)")
            XCTAssertGreaterThanOrEqual(el.frame.minY, win.minY + 4, "\(id) clipped top: \(el.frame) vs \(win)")
            XCTAssertLessThanOrEqual(el.frame.maxY, win.maxY - 4, "\(id) clipped bottom: \(el.frame) vs \(win)")
        }
        XCTAssertLessThan(abs(playBtn.frame.midX - win.midX), 4.0, "PLAY CTA must be horizontally centered")
        XCTAssertLessThan(abs(app.buttons["home_missions_button"].frame.midX - win.midX), 4.0, "Missions tab must be horizontally centered")

        saveShot("ios_sim_01_home")

        // Open Levels Modal
        let levelsBtn = app.buttons["home_levels_button"]
        XCTAssertTrue(levelsBtn.waitForExistence(timeout: 5), "Levels tab should be visible")
        levelsBtn.tap()
        Thread.sleep(forTimeInterval: 0.6)
        saveShot("ios_sim_02_levels")

        let closeBtn = app.buttons["modal_close_button"]
        XCTAssertTrue(closeBtn.waitForExistence(timeout: 5), "Modal close button should be visible")
        closeBtn.tap()
        Thread.sleep(forTimeInterval: 0.4)

        // Start Level 1
        XCTAssertTrue(playBtn.waitForExistence(timeout: 5))
        playBtn.tap()

        let pauseBtn = app.buttons["game_pause_button"]
        XCTAssertTrue(pauseBtn.waitForExistence(timeout: 10), "Game HUD pause button should be visible")
        for gid in ["game_undo_button", "game_restart_button", "game_pause_button"] {
            let el = app.buttons[gid]
            XCTAssertTrue(el.exists, "\(gid) should exist")
            XCTAssertGreaterThanOrEqual(el.frame.minX, win.minX + 4, "\(gid) clipped left")
            XCTAssertLessThanOrEqual(el.frame.maxX, win.maxX - 4, "\(gid) clipped right")
        }
        Thread.sleep(forTimeInterval: 1.0)
        saveShot("ios_sim_03_level1_start")

        // Tap clear movable bus b2 (red, right) at (2, 0.5) so it parks tilted in slot 0 with capacity badge
        let clearBusB2 = app.coordinate(withNormalizedOffset: CGVector(dx: 0.58, dy: 0.56))
        clearBusB2.tap()
        Thread.sleep(forTimeInterval: 0.9)
        saveShot("ios_sim_04_level1_parked")

        // Open Pause Modal
        pauseBtn.tap()
        Thread.sleep(forTimeInterval: 0.5)
        saveShot("ios_sim_05_pause")
    }
}
