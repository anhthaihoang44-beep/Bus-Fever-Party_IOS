import Foundation
import UIKit

enum BusColor: String, Codable, CaseIterable, Hashable {
    case pink, orange, green, purple, yellow, cyan, blue, red, brown, navy

    struct Style {
        let label: String
        let main: UIColor
        let light: UIColor
        let dark: UIColor
        let text: UIColor
    }

    var style: Style {
        switch self {
        case .pink:
            return Style(label: "Pink", main: UIColor(hex: 0xFF4F9A), light: UIColor(hex: 0xFF8EC0), dark: UIColor(hex: 0xC21E66), text: .white)
        case .orange:
            return Style(label: "Orange", main: UIColor(hex: 0xFF8A1F), light: UIColor(hex: 0xFFB866), dark: UIColor(hex: 0xC75600), text: .white)
        case .green:
            return Style(label: "Green", main: UIColor(hex: 0x34D349), light: UIColor(hex: 0x77F084), dark: UIColor(hex: 0x159427), text: .white)
        case .purple:
            return Style(label: "Purple", main: UIColor(hex: 0x9B51E0), light: UIColor(hex: 0xC48DF7), dark: UIColor(hex: 0x6724AB), text: .white)
        case .yellow:
            return Style(label: "Yellow", main: UIColor(hex: 0xFFC814), light: UIColor(hex: 0xFFE26B), dark: UIColor(hex: 0xC78F00), text: UIColor(hex: 0x432B00))
        case .cyan:
            return Style(label: "Cyan", main: UIColor(hex: 0x1BD3E8), light: UIColor(hex: 0x74ECFA), dark: UIColor(hex: 0x0794A8), text: UIColor(hex: 0x043840))
        case .blue:
            return Style(label: "Blue", main: UIColor(hex: 0x2E86FF), light: UIColor(hex: 0x75B2FF), dark: UIColor(hex: 0x1153BF), text: .white)
        case .red:
            return Style(label: "Red", main: UIColor(hex: 0xF53B45), light: UIColor(hex: 0xFF7B82), dark: UIColor(hex: 0xB31420), text: .white)
        case .brown:
            return Style(label: "Brown", main: UIColor(hex: 0x8D5534), light: UIColor(hex: 0xB87E5B), dark: UIColor(hex: 0x593018), text: .white)
        case .navy:
            return Style(label: "Navy", main: UIColor(hex: 0x344B7E), light: UIColor(hex: 0x5D78B5), dark: UIColor(hex: 0x1C2B4F), text: .white)
        }
    }
}

enum Direction: String, Codable, CaseIterable {
    case up, down, left, right
    case upLeft = "up-left"
    case upRight = "up-right"
    case downLeft = "down-left"
    case downRight = "down-right"

    var unitVector: Vec2 {
        let s = sqrt(0.5)
        switch self {
        case .up: return Vec2(x: 0, y: -1)
        case .down: return Vec2(x: 0, y: 1)
        case .left: return Vec2(x: -1, y: 0)
        case .right: return Vec2(x: 1, y: 0)
        case .upLeft: return Vec2(x: -s, y: -s)
        case .upRight: return Vec2(x: s, y: -s)
        case .downLeft: return Vec2(x: -s, y: s)
        case .downRight: return Vec2(x: s, y: s)
        }
    }

    var opposite: Direction {
        switch self {
        case .up: return .down
        case .down: return .up
        case .left: return .right
        case .right: return .left
        case .upLeft: return .downRight
        case .downRight: return .upLeft
        case .upRight: return .downLeft
        case .downLeft: return .upRight
        }
    }

    /// Radians in standard screen space where Y increases downward (0 = right, -PI/2 = up).
    var screenRadians: Double {
        let v = unitVector
        return atan2(v.y, v.x)
    }

    /// Radians in SpriteKit scene space where Y increases upward.
    var spriteKitRadians: CGFloat {
        CGFloat(-screenRadians)
    }
}

enum BusType: String, Codable {
    case normal
    case mystery
}

enum TrackShape: String, Codable, CaseIterable {
    case ring, heart, snake, figure8
}

enum ThemeId: String, Codable, CaseIterable {
    case city, park, maple
}

enum GameStatus {
    case playing, won, lost, paused
}

enum BoosterType: String, Codable, CaseIterable, Hashable {
    case vip, arrange, jumble

    var unlockLevel: Int {
        switch self {
        case .vip: return 4
        case .arrange: return 8
        case .jumble: return 13
        }
    }

    var coinCost: Int {
        switch self {
        case .vip: return 60
        case .arrange: return 80
        case .jumble: return 80
        }
    }

    var title: String {
        switch self {
        case .vip: return "VIP Slot"
        case .arrange: return "Arrange"
        case .jumble: return "Jumble"
        }
    }
}

struct Vec2: Equatable {
    var x: Double
    var y: Double
}

struct GridSize: Codable, Equatable {
    var cols: Int
    var rows: Int
}

struct BusConfig: Codable, Equatable {
    var id: String
    var color: BusColor
    var capacity: Int
    var x: Double
    var y: Double
    var direction: Direction
    var type: BusType
    var unlockAfter: Int?
    var length: Double?
    var width: Double?
}

struct ObstacleConfig: Codable, Equatable {
    var id: String
    var x: Double
    var y: Double
    var width: Double?
    var height: Double?
    var angle: Double?
}

struct PassengerSegment: Codable, Equatable {
    var color: BusColor
    var count: Int
}

struct BoostersAvailableConfig: Codable, Equatable {
    var vip: Bool?
    var arrange: Bool?
    var jumble: Bool?
}

struct LevelConfig: Codable, Equatable {
    var id: Int
    var name: String?
    var isEvent: Bool?
    var eventName: String?
    var gridSize: GridSize
    var buses: [BusConfig]
    var obstacles: [ObstacleConfig]
    var passengerQueue: [PassengerSegment]
    var trackShape: TrackShape
    var theme: ThemeId
    var slotsUnlocked: Int
    var vipUnlocked: Bool?
    var boostersAvailable: BoostersAvailableConfig
    var undoLimit: Int?
    var tutorialHint: String?
}

enum BusLocationState: String, Equatable {
    case board
    case drivingToSlot
    case parked
    case departing
    case departed
}

struct BusRuntime: Equatable {
    var id: String
    var color: BusColor
    var capacity: Int
    var x: Double
    var y: Double
    var direction: Direction
    var type: BusType
    var unlockAfter: Int?
    var length: Double?
    var width: Double?
    var mysteryRemaining: Int
    var unlocked: Bool
    var state: BusLocationState
    var boarded: Int
    var slotIndex: Int?

    init(config: BusConfig) {
        self.id = config.id
        self.color = config.color
        self.capacity = config.capacity
        self.x = config.x
        self.y = config.y
        self.direction = config.direction
        self.type = config.type
        self.unlockAfter = config.unlockAfter
        self.length = config.length
        self.width = config.width
        let req = config.type == .mystery ? max(1, config.unlockAfter ?? 3) : 0
        self.mysteryRemaining = req
        self.unlocked = config.type != .mystery
        self.state = .board
        self.boarded = 0
        self.slotIndex = nil
    }
}

enum SlotKind: String, Equatable {
    case vip, normal, extra
}

struct ParkingSlotState: Equatable {
    var index: Int
    var kind: SlotKind
    var unlocked: Bool
    var busId: String?
}

struct PassengerEntity: Equatable {
    var id: Int
    var color: BusColor
}

enum MissionPeriod: String, Codable {
    case daily, weekly
}

struct MissionProgress: Codable, Equatable, Identifiable {
    var id: String
    var title: String
    var description: String
    var period: MissionPeriod
    var target: Int
    var progress: Int
    var rewardCoins: Int
    var claimed: Bool
}

struct PlayerSettings: Codable, Equatable {
    var soundEnabled: Bool
    var vibrationEnabled: Bool
}

struct PlayerStats: Codable, Equatable {
    var levelsWon: Int
    var busesExited: Int
    var passengersBoarded: Int
    var boostersUsed: Int
    var eventCompleted: Bool
}

struct SaveData: Codable, Equatable {
    var highestUnlockedLevel: Int
    var currentLevel: Int
    var coins: Int
    var starsByLevel: [Int: Int]
    var boosterCounts: [String: Int]
    var settings: PlayerSettings
    var stats: PlayerStats
    var missions: [MissionProgress]
}

enum GameConstants {
    static let totalParkingSlots = 7
    static let defaultBusLength = 1.66
    static let defaultBusWidth = 0.78
    static let defaultObstacleSize = 0.86
    static let handcraftedLevelCount = 25
}

extension UIColor {
    convenience init(hex: UInt32, alpha: CGFloat = 1.0) {
        let r = CGFloat((hex >> 16) & 0xFF) / 255.0
        let g = CGFloat((hex >> 8) & 0xFF) / 255.0
        let b = CGFloat(hex & 0xFF) / 255.0
        self.init(red: r, green: g, blue: b, alpha: alpha)
    }
}
