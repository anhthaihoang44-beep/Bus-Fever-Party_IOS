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
        XCTAssertTrue(app.buttons["game_restart_button"].exists, "Game HUD restart button should be visible")
        XCTAssertTrue(app.buttons["game_undo_button"].exists, "Game HUD undo button should be visible")
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
