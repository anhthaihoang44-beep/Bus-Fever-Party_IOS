import Foundation

/// Loads handcrafted JSON levels (1–25 + events) bundled in the iOS app
/// and delegates levelId > 25 seamlessly to InfiniteLevelGenerator.
final class LevelRepository {
    static let shared = LevelRepository()

    private var regularLevels: [LevelConfig] = []
    private var eventLevels: [LevelConfig] = []
    private var loaded = false
    private let lock = NSLock()

    private init() {}

    private func ensureLoaded() {
        lock.lock()
        defer { lock.unlock() }
        guard !loaded else { return }
        loaded = true

        let decoder = JSONDecoder()
        var urls: [URL] = []

        if let folderUrls = Bundle.main.urls(forResourcesWithExtension: "json", subdirectory: "levels") {
            urls.append(contentsOf: folderUrls)
        }
        if urls.isEmpty, let flatUrls = Bundle.main.urls(forResourcesWithExtension: "json", subdirectory: nil) {
            urls.append(contentsOf: flatUrls.filter { $0.lastPathComponent.hasPrefix("level") })
        }

        var regs: [LevelConfig] = []
        var evts: [LevelConfig] = []

        for url in urls {
            guard let data = try? Data(contentsOf: url),
                  let cfg = try? decoder.decode(LevelConfig.self, from: data) else {
                continue
            }
            if cfg.isEvent == true {
                evts.append(cfg)
            } else {
                regs.append(cfg)
            }
        }

        regularLevels = regs.sorted { $0.id < $1.id }
        eventLevels = evts.sorted { $0.id < $1.id }
    }

    func getAllLevels() -> [LevelConfig] {
        ensureLoaded()
        return regularLevels
    }

    func getHandcraftedCount() -> Int {
        ensureLoaded()
        return regularLevels.count
    }

    func getLevel(_ levelId: Int) -> LevelConfig? {
        ensureLoaded()
        if let hit = regularLevels.first(where: { $0.id == levelId }) {
            return hit
        }
        guard levelId > 0 else { return nil }
        return InfiniteLevelGenerator.generate(levelId: levelId)
    }

    func getEventLevels() -> [LevelConfig] {
        ensureLoaded()
        return eventLevels
    }

    func getEventLevel(_ eventId: Int = 101) -> LevelConfig? {
        ensureLoaded()
        return eventLevels.first(where: { $0.id == eventId }) ?? eventLevels.first
    }
}
