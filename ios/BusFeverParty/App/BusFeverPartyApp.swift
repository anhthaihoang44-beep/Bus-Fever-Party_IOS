import SwiftUI
import UIKit

final class AppOrientationDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, supportedInterfaceOrientationsFor window: UIWindow?) -> UIInterfaceOrientationMask {
        .portrait
    }
}

@main
struct BusFeverPartyApp: App {
    @UIApplicationDelegateAdaptor(AppOrientationDelegate.self) var orientationDelegate
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
