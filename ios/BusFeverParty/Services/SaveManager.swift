import Combine
import Foundation

/// Persists progression, coins, stars, boosters, missions, and settings via UserDefaults
/// with batched gameplay stat updates so passenger boarding never stalls frames.
final class SaveManager: ObservableObject {
    static let shared = SaveManager()
    private static let storageKey = "bus_fever_party_save_v1"

    @Published private(set) var data: SaveData

    private var pendingPassengers = 0
    private var pendingBuses = 0

    private init() {
        self.data = Self.loadFromDefaults()
    }

    static func defaultMissions() -> [MissionProgress] {
        [
            MissionProgress(id: "daily_win_3", title: "Daily Commuter", description: "Complete 3 levels", period: .daily, target: 3, progress: 0, rewardCoins: 60, claimed: false),
            MissionProgress(id: "daily_board_60", title: "Full House", description: "Board 60 passengers", period: .daily, target: 60, progress: 0, rewardCoins: 50, claimed: false),
            MissionProgress(id: "daily_buses_15", title: "Traffic Master", description: "Clear 15 buses from boards", period: .daily, target: 15, progress: 0, rewardCoins: 45, claimed: false),
            MissionProgress(id: "weekly_win_10", title: "Party Bus Legend", description: "Win 10 levels this week", period: .weekly, target: 10, progress: 0, rewardCoins: 180, claimed: false),
            MissionProgress(id: "weekly_boosters_3", title: "Power Driver", description: "Use 3 boosters", period: .weekly, target: 3, progress: 0, rewardCoins: 120, claimed: false)
        ]
    }

    static func createDefaultSave() -> SaveData {
        SaveData(
            highestUnlockedLevel: 1,
            currentLevel: 1,
            coins: 120,
            starsByLevel: [:],
            boosterCounts: [
                BoosterType.vip.rawValue: 2,
                BoosterType.arrange.rawValue: 2,
                BoosterType.jumble.rawValue: 2
            ],
            settings: PlayerSettings(soundEnabled: true, vibrationEnabled: true),
            stats: PlayerStats(levelsWon: 0, busesExited: 0, passengersBoarded: 0, boostersUsed: 0, eventCompleted: false),
            missions: defaultMissions()
        )
    }

    private static func loadFromDefaults() -> SaveData {
        guard let raw = UserDefaults.standard.data(forKey: storageKey),
              let decoded = try? JSONDecoder().decode(SaveData.self, from: raw) else {
            return createDefaultSave()
        }
        return decoded
    }

    private func persist() {
        if let encoded = try? JSONEncoder().encode(data) {
            UserDefaults.standard.set(encoded, forKey: Self.storageKey)
        }
    }

    func boosterCount(_ type: BoosterType) -> Int {
        data.boosterCounts[type.rawValue] ?? 0
    }

    func totalStars() -> Int {
        data.starsByLevel.values.reduce(0, +)
    }

    func recordLevelWin(levelId: Int, stars: Int, coinsEarned: Int, isEvent: Bool = false) {
        data.coins += coinsEarned
        data.stats.levelsWon += 1

        if isEvent {
            data.stats.eventCompleted = true
        } else {
            let prev = data.starsByLevel[levelId] ?? 0
            data.starsByLevel[levelId] = max(prev, stars)
            if levelId >= data.highestUnlockedLevel {
                data.highestUnlockedLevel = levelId + 1
            }
            data.currentLevel = max(data.currentLevel, levelId + 1)
        }

        advanceMission(id: "daily_win_3", delta: 1)
        advanceMission(id: "weekly_win_10", delta: 1)
        flushStats()
        persist()
    }

    func recordBusExited(_ count: Int = 1) {
        pendingBuses += count
        if pendingBuses >= 5 {
            flushStats()
        }
    }

    func recordPassengersBoarded(_ count: Int = 1) {
        guard count > 0 else { return }
        pendingPassengers += count
        if pendingPassengers >= 15 {
            flushStats()
        }
    }

    func flushStats() {
        guard pendingBuses > 0 || pendingPassengers > 0 else { return }
        if pendingBuses > 0 {
            data.stats.busesExited += pendingBuses
            advanceMission(id: "daily_buses_15", delta: pendingBuses)
            pendingBuses = 0
        }
        if pendingPassengers > 0 {
            data.stats.passengersBoarded += pendingPassengers
            advanceMission(id: "daily_board_60", delta: pendingPassengers)
            pendingPassengers = 0
        }
        persist()
    }

    @discardableResult
    func consumeBooster(_ type: BoosterType) -> Bool {
        let cur = boosterCount(type)
        guard cur > 0 else { return false }
        data.boosterCounts[type.rawValue] = cur - 1
        data.stats.boostersUsed += 1
        advanceMission(id: "weekly_boosters_3", delta: 1)
        persist()
        return true
    }

    func addBooster(_ type: BoosterType, amount: Int = 1) {
        data.boosterCounts[type.rawValue] = boosterCount(type) + amount
        persist()
    }

    @discardableResult
    func spendCoins(_ amount: Int) -> Bool {
        guard data.coins >= amount else { return false }
        data.coins -= amount
        persist()
        return true
    }

    func addCoins(_ amount: Int) {
        data.coins += amount
        persist()
    }

    @discardableResult
    func claimMission(_ missionId: String) -> Bool {
        guard let idx = data.missions.firstIndex(where: { $0.id == missionId }),
              !data.missions[idx].claimed,
              data.missions[idx].progress >= data.missions[idx].target else {
            return false
        }
        data.missions[idx].claimed = true
        data.coins += data.missions[idx].rewardCoins
        persist()
        return true
    }

    func setSoundEnabled(_ enabled: Bool) {
        data.settings.soundEnabled = enabled
        persist()
    }

    func setVibrationEnabled(_ enabled: Bool) {
        data.settings.vibrationEnabled = enabled
        persist()
    }

    private func advanceMission(id: String, delta: Int) {
        guard let idx = data.missions.firstIndex(where: { $0.id == id }), !data.missions[idx].claimed else {
            return
        }
        data.missions[idx].progress = min(data.missions[idx].target, data.missions[idx].progress + delta)
    }
}
