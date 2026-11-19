import SpriteKit
import SwiftUI

final class GameCoordinator: ObservableObject, GameSceneDelegate {
    @Published var level: LevelConfig
    @Published var canUndo = false
    @Published var undoRemaining = 3
    @Published var toastMessage: String?
    @Published var showTutorialHint = true

    @Published var winResult: (stars: Int, coins: Int, hasNext: Bool)?
    @Published var loseOutcome: EngineOutcome?
    @Published var showPauseModal = false
    @Published var unlockSlotIndex: Int?
    @Published var getBoosterType: BoosterType?

    var scene: BusBoardSKScene?
    private var toastWorkItem: DispatchWorkItem?

    init(level: LevelConfig) {
        self.level = level
        self.undoRemaining = level.undoLimit ?? 3
    }

    func makeScene(aspect: CGFloat) -> BusBoardSKScene {
        if let existing = scene { return existing }
        let skScene = BusBoardSKScene(level: level, aspect: aspect)
        skScene.gameDelegate = self
        self.scene = skScene
        return skScene
    }

    func restart(with nextLevel: LevelConfig) {
        self.level = nextLevel
        self.winResult = nil
        self.loseOutcome = nil
        self.showPauseModal = false
        self.unlockSlotIndex = nil
        self.getBoosterType = nil
        self.showTutorialHint = nextLevel.tutorialHint != nil
        self.scene?.restart(with: nextLevel)
    }

    // MARK: - GameSceneDelegate

    func gameSceneDidUpdateHUD(canUndo: Bool, undoRemaining: Int) {
        DispatchQueue.main.async {
            self.canUndo = canUndo
            self.undoRemaining = undoRemaining
        }
    }

    func gameSceneDidShowToast(_ message: String) {
        DispatchQueue.main.async {
            self.toastWorkItem?.cancel()
            self.toastMessage = message
            let item = DispatchWorkItem { [weak self] in
                withAnimation(.easeOut(duration: 0.25)) {
                    self?.toastMessage = nil
                }
            }
            self.toastWorkItem = item
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.35, execute: item)
        }
    }

    func gameSceneDidDismissTutorial() {
        DispatchQueue.main.async {
            withAnimation(.easeOut(duration: 0.2)) {
                self.showTutorialHint = false
            }
        }
    }

    func gameSceneDidWin(stars: Int, coinsEarned: Int, hasNextLevel: Bool) {
        DispatchQueue.main.async {
            self.winResult = (stars, coinsEarned, hasNextLevel)
        }
    }

    func gameSceneDidLose(outcome: EngineOutcome) {
        DispatchQueue.main.async {
            self.loseOutcome = outcome
        }
    }

    func gameSceneDidRequestUnlockSlot(_ slotIndex: Int) {
        DispatchQueue.main.async {
            self.scene?.setPausedByModal(true)
            self.unlockSlotIndex = slotIndex
        }
    }

    func gameSceneDidRequestGetBooster(_ type: BoosterType) {
        DispatchQueue.main.async {
            self.scene?.setPausedByModal(true)
            self.getBoosterType = type
        }
    }
}

struct SpriteKitBoardRepresentable: UIViewRepresentable {
    let scene: BusBoardSKScene

    func makeUIView(context: Context) -> SKView {
        let view = SKView()
        view.ignoresSiblingOrder = true
        view.preferredFramesPerSecond = 60
        view.allowsTransparency = false
        view.presentScene(scene)
        return view
    }

    func updateUIView(_ uiView: SKView, context: Context) {
        if uiView.scene !== scene {
            uiView.presentScene(scene)
        }
    }
}

struct GameContainerView: View {
    @StateObject private var coordinator: GameCoordinator
    @ObservedObject private var save = SaveManager.shared
    let onExitToHome: () -> Void

    init(initialLevel: LevelConfig, onExitToHome: @escaping () -> Void) {
        _coordinator = StateObject(wrappedValue: GameCoordinator(level: initialLevel))
        self.onExitToHome = onExitToHome
    }

    var body: some View {
        GeometryReader { geo in
            let safeTop = max(geo.safeAreaInsets.top, 12)
            let safeBot = max(geo.safeAreaInsets.bottom, 12)
            let aspect = geo.size.height / max(1, geo.size.width)
            let skScene = coordinator.makeScene(aspect: aspect)

            ZStack {
                SpriteKitBoardRepresentable(scene: skScene)
                    .ignoresSafeArea()

                VStack {
                    // Header Bar
                    HStack(spacing: 10) {
                        Button {
                            coordinator.scene?.handleUndo()
                        } label: {
                            ZStack(alignment: .topTrailing) {
                                Image(systemName: "arrow.uturn.backward")
                                    .font(.system(size: 18, weight: .bold))
                                    .foregroundColor(.white)
                                    .frame(width: 44, height: 44)
                                    .background(Color(UIColor(hex: 0x3B8EFF)))
                                    .clipShape(Circle())
                                    .overlay(Circle().stroke(Color.white, lineWidth: 2.5))

                                Text("\(coordinator.undoRemaining)")
                                    .font(.system(size: 11, weight: .black, design: .rounded))
                                    .foregroundColor(.white)
                                    .frame(width: 20, height: 20)
                                    .background(Color(UIColor(hex: coordinator.undoRemaining > 0 ? 0xF53B45 : 0x7B889E)))
                                    .clipShape(Circle())
                                    .overlay(Circle().stroke(Color.white, lineWidth: 1.5))
                                    .offset(x: 4, y: -4)
                            }
                        }
                        .opacity(coordinator.canUndo ? 1.0 : 0.62)

                        Button {
                            SoundEngine.shared.playTap()
                            coordinator.restart(with: coordinator.level)
                        } label: {
                            Image(systemName: "arrow.clockwise")
                                .font(.system(size: 17, weight: .bold))
                                .foregroundColor(.white)
                                .frame(width: 40, height: 40)
                                .background(Color(UIColor(hex: 0x4CA6FF)))
                                .clipShape(Circle())
                                .overlay(Circle().stroke(Color.white, lineWidth: 2.5))
                        }

                        Spacer()

                        VStack(spacing: 1) {
                            Text(coordinator.level.isEvent == true ? (coordinator.level.eventName ?? "Maple Event") : "Level \(coordinator.level.id)")
                                .font(.system(size: coordinator.level.isEvent == true ? 18 : 24, weight: .black, design: .rounded))
                                .foregroundColor(.white)
                                .shadow(color: Color(UIColor(hex: 0x2C4166)), radius: 0, x: 0, y: 2)
                                .lineLimit(1)
                                .minimumScaleFactor(0.7)
                            if coordinator.level.isEvent != true && coordinator.level.id > 25 {
                                Text("∞ Endless Mode")
                                    .font(.system(size: 11.5, weight: .heavy, design: .rounded))
                                    .foregroundColor(Color(UIColor(hex: 0x2E5EA8)))
                            }
                        }

                        Spacer()

                        Button {
                            SoundEngine.shared.playTap()
                            coordinator.scene?.setPausedByModal(true)
                            coordinator.showPauseModal = true
                        } label: {
                            Image(systemName: "pause.fill")
                                .font(.system(size: 17, weight: .bold))
                                .foregroundColor(.white)
                                .frame(width: 44, height: 44)
                                .background(Color(UIColor(hex: 0x3B8EFF)))
                                .clipShape(Circle())
                                .overlay(Circle().stroke(Color.white, lineWidth: 2.5))
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, safeTop + 4)

                    if let toast = coordinator.toastMessage {
                        Text(toast)
                            .font(.system(size: 14.5, weight: .bold, design: .rounded))
                            .foregroundColor(.white)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 8)
                            .background(Color(UIColor(hex: 0x25314A, alpha: 0.88)))
                            .clipShape(Capsule())
                            .transition(.opacity.combined(with: .move(edge: .top)))
                            .padding(.top, 6)
                    }

                    Spacer()

                    if coordinator.showTutorialHint, let hint = coordinator.level.tutorialHint {
                        Text(hint)
                            .font(.system(size: 13.5, weight: .bold, design: .rounded))
                            .foregroundColor(Color(UIColor(hex: 0x2B3E5E)))
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 10)
                            .background(Color.white.opacity(0.95))
                            .clipShape(RoundedRectangle(cornerRadius: 14))
                            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color(UIColor(hex: 0x3B8EFF)), lineWidth: 2.5))
                            .padding(.horizontal, 24)
                            .padding(.bottom, 6)
                    }

                    // Bottom 3 Booster Dock
                    HStack(spacing: 12) {
                        boosterButton(.vip, icon: "🎟️", label: "VIP")
                        boosterButton(.arrange, icon: "🔀", label: "Arrange")
                        boosterButton(.jumble, icon: "🎨", label: "Jumble")
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(Color.white.opacity(0.45))
                    .clipShape(RoundedRectangle(cornerRadius: 22))
                    .padding(.horizontal, 14)
                    .padding(.bottom, safeBot + 4)
                }

                // Modals
                if let win = coordinator.winResult {
                    winModal(stars: win.stars, coins: win.coins, hasNext: win.hasNext)
                } else if let lose = coordinator.loseOutcome {
                    loseModal(outcome: lose)
                } else if coordinator.showPauseModal {
                    pauseModal
                } else if let bType = coordinator.getBoosterType {
                    getBoosterModal(bType)
                } else if let slotIdx = coordinator.unlockSlotIndex {
                    unlockSlotModal(slotIdx)
                }
            }
        }
    }

    private func boosterButton(_ type: BoosterType, icon: String, label: String) -> some View {
        let unlocked = BoosterSystem.isUnlockedForLevel(type, level: coordinator.level)
        let count = save.boosterCount(type)
        return Button {
            coordinator.scene?.handleBooster(type)
        } label: {
            ZStack(alignment: .topTrailing) {
                VStack(spacing: 2) {
                    Text(unlocked ? icon : "🔒")
                        .font(.system(size: 20))
                    Text(unlocked ? label : "Level \(type.unlockLevel)")
                        .font(.system(size: 13, weight: .heavy, design: .rounded))
                        .foregroundColor(.white)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 62)
                .background(Color(UIColor(hex: unlocked ? 0x5AAEFF : 0x6296D9)))
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.white, lineWidth: 2.5))

                if unlocked {
                    Text(count > 0 ? "\(count)" : "+")
                        .font(.system(size: 12, weight: .black, design: .rounded))
                        .foregroundColor(.white)
                        .frame(width: 22, height: 22)
                        .background(Color(UIColor(hex: count > 0 ? 0xF53B45 : 0x34D349)))
                        .clipShape(Circle())
                        .overlay(Circle().stroke(Color.white, lineWidth: 2))
                        .offset(x: 4, y: -6)
                }
            }
        }
    }

    private func winModal(stars: Int, coins: Int, hasNext: Bool) -> some View {
        modalShell(accent: 0xFFD04D, ribbonTitle: "GREAT JOB!", ribbonColor: 0x34D349) {
            HStack(spacing: 12) {
                ForEach(0..<3, id: \.self) { i in
                    Text("★")
                        .font(.system(size: i == 1 ? 52 : 42))
                        .foregroundColor(Color(UIColor(hex: i < stars ? 0xFFC814 : 0xD2DAE8)))
                        .offset(y: i == 1 ? -6 : 0)
                }
            }

            Text("🪙  +\(coins) Coins")
                .font(.system(size: 18, weight: .black, design: .rounded))
                .foregroundColor(Color(UIColor(hex: 0x7A4B00)))
                .padding(.horizontal, 18)
                .padding(.vertical, 8)
                .background(Color(UIColor(hex: 0xFFF0C2)))
                .clipShape(Capsule())
                .overlay(Capsule().stroke(Color(UIColor(hex: 0xFFC814)), lineWidth: 2))

            pillAction(title: hasNext ? "Next Level ▶" : "Back to Home", color: 0x34D349) {
                if hasNext, let next = LevelRepository.shared.getLevel(coordinator.level.id + 1) {
                    coordinator.restart(with: next)
                } else {
                    onExitToHome()
                }
            }

            HStack(spacing: 10) {
                pillAction(title: "Replay", color: 0x3B8EFF) {
                    coordinator.restart(with: coordinator.level)
                }
                pillAction(title: "Home", color: 0xFF8A1F) {
                    onExitToHome()
                }
            }
        }
    }

    private func loseModal(outcome: EngineOutcome) -> some View {
        let reason = outcome == .lostLotDeadlock
            ? "All parking slots are full and\nno parked bus matches the queue!"
            : "No buses on the board can move\nand the front passenger cannot board!"
        return modalShell(accent: 0xF53B45, ribbonTitle: "STUCK!", ribbonColor: 0xF53B45) {
            Text(reason)
                .font(.system(size: 15, weight: .bold, design: .rounded))
                .foregroundColor(Color(UIColor(hex: 0x43536E)))
                .multilineTextAlignment(.center)
                .padding(.vertical, 6)

            pillAction(title: "Revive (Use Booster)", color: 0x9B51E0) {
                coordinator.loseOutcome = nil
                coordinator.scene?.handleRevive()
            }

            pillAction(title: "Retry", color: 0xFF8A1F) {
                coordinator.restart(with: coordinator.level)
            }
        }
    }

    private var pauseModal: some View {
        modalShell(accent: 0x3B8EFF, ribbonTitle: "Settings", ribbonColor: 0x3B8EFF) {
            HStack {
                Text("🔊 Sound Effects")
                    .font(.system(size: 15, weight: .bold, design: .rounded))
                Spacer()
                Toggle("", isOn: Binding(
                    get: { save.data.settings.soundEnabled },
                    set: { SaveManager.shared.setSoundEnabled($0) }
                )).labelsHidden()
            }
            .padding(.horizontal, 14).padding(.vertical, 8)
            .background(Color(UIColor(hex: 0xF0F4FC))).clipShape(RoundedRectangle(cornerRadius: 12))

            HStack {
                Text("📳 Vibration")
                    .font(.system(size: 15, weight: .bold, design: .rounded))
                Spacer()
                Toggle("", isOn: Binding(
                    get: { save.data.settings.vibrationEnabled },
                    set: { SaveManager.shared.setVibrationEnabled($0) }
                )).labelsHidden()
            }
            .padding(.horizontal, 14).padding(.vertical, 8)
            .background(Color(UIColor(hex: 0xF0F4FC))).clipShape(RoundedRectangle(cornerRadius: 12))

            pillAction(title: "Restart Level", color: 0xFF8A1F) {
                coordinator.restart(with: coordinator.level)
            }
            pillAction(title: "🏠 Home", color: 0x6C7D9C) {
                SaveManager.shared.flushStats()
                onExitToHome()
            }
            pillAction(title: "Resume", color: 0x34D349) {
                coordinator.showPauseModal = false
                coordinator.scene?.setPausedByModal(false)
            }
        }
    }

    private func getBoosterModal(_ type: BoosterType) -> some View {
        modalShell(accent: 0x3B8EFF, ribbonTitle: "Get \(type.title)", ribbonColor: 0x3B8EFF) {
            Text("🪙 Coins: \(save.data.coins)")
                .font(.system(size: 16, weight: .bold, design: .rounded))
                .foregroundColor(Color(UIColor(hex: 0x7A4B00)))

            pillAction(title: "Watch Ad (Free +1)", color: 0x9B51E0) {
                SaveManager.shared.addBooster(type, amount: 1)
                SoundEngine.shared.playCoin()
                coordinator.getBoosterType = nil
                coordinator.scene?.setPausedByModal(false)
                coordinator.gameSceneDidShowToast("Claimed +1 \(type.title)!")
            }

            pillAction(title: "Buy (+1) • 🪙 \(type.coinCost)", color: 0x34D349) {
                if SaveManager.shared.spendCoins(type.coinCost) {
                    SaveManager.shared.addBooster(type, amount: 1)
                    SoundEngine.shared.playCoin()
                    coordinator.getBoosterType = nil
                    coordinator.scene?.setPausedByModal(false)
                    coordinator.gameSceneDidShowToast("Purchased +1 \(type.title)!")
                } else {
                    SoundEngine.shared.playBump()
                    coordinator.gameSceneDidShowToast("Not enough coins!")
                }
            }

            pillAction(title: "Cancel", color: 0x6C7D9C) {
                coordinator.getBoosterType = nil
                coordinator.scene?.setPausedByModal(false)
            }
        }
    }

    private func unlockSlotModal(_ slotIndex: Int) -> some View {
        modalShell(accent: 0x34D349, ribbonTitle: "Extra Parking Slot", ribbonColor: 0x34D349) {
            Text("Unlock an extra waiting bay\nso more buses can park at once!")
                .font(.system(size: 15, weight: .bold, design: .rounded))
                .foregroundColor(Color(UIColor(hex: 0x4A5B7A)))
                .multilineTextAlignment(.center)

            pillAction(title: "Watch Ad (Unlock)", color: 0x9B51E0) {
                coordinator.unlockSlotIndex = nil
                coordinator.scene?.setPausedByModal(false)
                coordinator.scene?.unlockExtraSlot(slotIndex)
            }

            pillAction(title: "Unlock • 🪙 50", color: 0x34D349) {
                if SaveManager.shared.spendCoins(50) {
                    coordinator.unlockSlotIndex = nil
                    coordinator.scene?.setPausedByModal(false)
                    coordinator.scene?.unlockExtraSlot(slotIndex)
                } else {
                    SoundEngine.shared.playBump()
                    coordinator.gameSceneDidShowToast("Need 50 coins!")
                }
            }

            pillAction(title: "Cancel", color: 0x6C7D9C) {
                coordinator.unlockSlotIndex = nil
                coordinator.scene?.setPausedByModal(false)
            }
        }
    }

    private func modalShell<Content: View>(accent: UInt32, ribbonTitle: String, ribbonColor: UInt32, @ViewBuilder content: () -> Content) -> some View {
        ZStack {
            Color(UIColor(hex: 0x0C162B, alpha: 0.58)).ignoresSafeArea()
            VStack(spacing: 14) {
                Text(ribbonTitle)
                    .font(.system(size: 24, weight: .black, design: .rounded))
                    .foregroundColor(.white)
                    .padding(.horizontal, 26)
                    .padding(.vertical, 10)
                    .background(Color(UIColor(hex: ribbonColor)))
                    .clipShape(Capsule())
                    .overlay(Capsule().stroke(Color.white, lineWidth: 3))
                    .offset(y: -26)
                    .padding(.bottom, -16)

                content()
            }
            .padding(22)
            .frame(maxWidth: 340)
            .background(Color(UIColor(hex: 0xFFF9ED)))
            .clipShape(RoundedRectangle(cornerRadius: 26))
            .overlay(RoundedRectangle(cornerRadius: 26).stroke(Color(UIColor(hex: accent)), lineWidth: 4))
            .padding(.horizontal, 24)
        }
    }

    private func pillAction(title: String, color: UInt32, action: @escaping () -> Void) -> some View {
        Button {
            SoundEngine.shared.playTap()
            action()
        } label: {
            Text(title)
                .font(.system(size: 16.5, weight: .black, design: .rounded))
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 13)
                .background(Color(UIColor(hex: color)))
                .clipShape(Capsule())
                .overlay(Capsule().stroke(Color.white, lineWidth: 2))
        }
    }
}
