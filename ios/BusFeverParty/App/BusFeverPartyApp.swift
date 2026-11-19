import SwiftUI

@main
struct BusFeverPartyApp: App {
    @State private var activeLevel: LevelConfig?

    var body: some Scene {
        WindowGroup {
            Group {
                if let level = activeLevel {
                    GameContainerView(initialLevel: level) {
                        activeLevel = nil
                    }
                    .id(level.id)
                } else {
                    HomeView { levelId, isEvent in
                        if isEvent {
                            activeLevel = LevelRepository.shared.getEventLevel(levelId)
                        } else {
                            activeLevel = LevelRepository.shared.getLevel(levelId)
                        }
                    }
                }
            }
            .statusBar(hidden: true)
            .preferredColorScheme(.light)
        }
    }
}
