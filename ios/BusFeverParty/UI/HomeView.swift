import SwiftUI

struct HomeView: View {
    @ObservedObject private var save = SaveManager.shared
    let onPlayLevel: (Int, Bool) -> Void

    @State private var activeSheet: HomeModalKind?
    @State private var levelPage: Int = 0
    @State private var floatLogo = false
    @State private var pulsePlay = false
    @State private var busRoll = false

    enum HomeModalKind: Identifiable {
        case levels, missions, leaders, settings
        var id: Int { hashValue }
    }

    private let rivals: [(name: String, score: Int, color: BusColor)] = [
        ("MapleQueen", 2650, .pink),
        ("BusMaster99", 2140, .green),
        ("SunnyDriver", 1780, .purple),
        ("CandyLoop", 1320, .yellow),
        ("SpeedyMinh", 980, .cyan),
        ("PixelCommute", 620, .blue),
        ("CityHopper", 340, .red),
        ("RookieRider", 150, .brown)
    ]

    var body: some View {
        GeometryReader { geo in
            let safeTop = max(geo.safeAreaInsets.top, 16)
            let safeBot = max(geo.safeAreaInsets.bottom, 16)
            let targetLevel = save.data.currentLevel

            ZStack {
                VStack(spacing: 0) {
                    Color(UIColor(hex: 0x62B6FF))
                    Color(UIColor(hex: 0xA6D8FF))
                }
                .ignoresSafeArea()

                // Ambient clouds
                HStack {
                    cloudCluster.offset(x: -10, y: -geo.size.height * 0.22)
                    Spacer()
                    cloudCluster.offset(x: 15, y: -geo.size.height * 0.14)
                }

                // Bottom scenic hills, road & bottom nav
                VStack {
                    Spacer()
                    scenicRoadFooter(width: geo.size.width)
                        .padding(.bottom, 76 + safeBot)
                }
                .ignoresSafeArea(edges: .bottom)

                VStack(spacing: 14) {
                    // Top Bar: Coins + Settings
                    HStack {
                        HStack(spacing: 7) {
                            Text("🪙")
                            Text("\(save.data.coins)")
                                .font(.system(size: 18, weight: .heavy, design: .rounded))
                                .foregroundColor(Color(UIColor(hex: 0x5C3A00)))
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(Color.white.opacity(0.95))
                        .clipShape(Capsule())
                        .overlay(Capsule().stroke(Color(UIColor(hex: 0xFFC814)), lineWidth: 2.5))

                        Spacer()

                        Button {
                            SoundEngine.shared.playTap()
                            activeSheet = .settings
                        } label: {
                            Image(systemName: "gearshape.fill")
                                .font(.system(size: 19, weight: .bold))
                                .foregroundColor(.white)
                                .frame(width: 44, height: 44)
                                .background(Color(UIColor(hex: 0x3B8EFF)))
                                .clipShape(Circle())
                                .overlay(Circle().stroke(Color.white, lineWidth: 2.5))
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, safeTop + 6)

                    // Title Logo Badge
                    ZStack {
                        RoundedRectangle(cornerRadius: 24)
                            .fill(Color(UIColor(hex: 0x1E4FA8)))
                            .frame(width: 310, height: 102)
                            .offset(y: 5)
                        RoundedRectangle(cornerRadius: 24)
                            .fill(Color(UIColor(hex: 0x388EFF)))
                            .frame(width: 310, height: 100)
                            .overlay(RoundedRectangle(cornerRadius: 24).stroke(Color.white, lineWidth: 3.5))

                        VStack(spacing: 4) {
                            Text("BUS FEVER")
                                .font(.system(size: 36, weight: .black, design: .rounded))
                                .foregroundColor(Color(UIColor(hex: 0xFFE047)))
                                .shadow(color: Color(UIColor(hex: 0x163570)), radius: 0, x: 0, y: 2.5)
                            Text("PARTY PASSENGER LOOP")
                                .font(.system(size: 15, weight: .heavy, design: .rounded))
                                .foregroundColor(.white)
                        }
                    }
                    .offset(y: floatLogo ? -5 : 0)

                    // Seasonal Event Banner
                    seasonalCard

                    Spacer(minLength: 6)

                    // Milestone / Endless Roadmap Card
                    milestoneCard(targetLevel: targetLevel)

                    // Primary PLAY CTA
                    Button {
                        SoundEngine.shared.playTap()
                        onPlayLevel(targetLevel, false)
                    } label: {
                        ZStack {
                            Capsule()
                                .fill(Color(UIColor(hex: 0x158C24)))
                                .frame(width: 278, height: 68)
                                .offset(y: 4)
                            Capsule()
                                .fill(Color(UIColor(hex: 0x34D349)))
                                .frame(width: 278, height: 66)
                                .overlay(Capsule().stroke(Color.white, lineWidth: 3))
                            Text("PLAY  LEVEL \(targetLevel)")
                                .font(.system(size: 22, weight: .black, design: .rounded))
                                .foregroundColor(.white)
                        }
                    }
                    .scaleEffect(pulsePlay ? 1.03 : 1.0)
                    .padding(.top, 4)

                    Spacer(minLength: 10)

                    // Bottom 3-tab Nav
                    HStack(spacing: 12) {
                        navButton(title: "Levels", icon: "🗺️", topColor: 0x3B8EFF, botColor: 0x1A5FC2) {
                            levelPage = max(0, (save.data.currentLevel - 1) / 20)
                            activeSheet = .levels
                        }
                        navButton(title: "Missions", icon: "🎯", topColor: 0x9B51E0, botColor: 0x6724AB) {
                            activeSheet = .missions
                        }
                        navButton(title: "Leaders", icon: "🏆", topColor: 0xFF8A1F, botColor: 0xC75600) {
                            activeSheet = .leaders
                        }
                    }
                    .padding(.horizontal, 18)
                    .padding(.bottom, safeBot + 8)
                }

                if let modal = activeSheet {
                    modalOverlay(modal)
                }
            }
            .onAppear {
                withAnimation(.easeInOut(duration: 1.7).repeatForever(autoreverses: true)) {
                    floatLogo = true
                }
                withAnimation(.easeInOut(duration: 0.95).repeatForever(autoreverses: true)) {
                    pulsePlay = true
                }
                withAnimation(.linear(duration: 6.5).repeatForever(autoreverses: false)) {
                    busRoll = true
                }
            }
        }
    }

    private var cloudCluster: some View {
        ZStack {
            Circle().fill(Color.white.opacity(0.65)).frame(width: 58, height: 58)
            Circle().fill(Color.white.opacity(0.65)).frame(width: 44, height: 44).offset(x: 28, y: 6)
            Circle().fill(Color.white.opacity(0.65)).frame(width: 40, height: 40).offset(x: -24, y: 8)
        }
    }

    private var seasonalCard: some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 4) {
                Text(save.data.stats.eventCompleted ? "🍁 SEASONAL EVENT • CLEARED ✓" : "🍁 SEASONAL EVENT")
                    .font(.system(size: 11.5, weight: .bold, design: .rounded))
                    .foregroundColor(Color(UIColor(hex: 0xFFF2BD)))
                Text("Maple Bus Escape Challenge")
                    .font(.system(size: 18, weight: .black, design: .rounded))
                    .foregroundColor(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                Text("Autumn maple loop • Bonus coins!")
                    .font(.system(size: 12.5, weight: .semibold, design: .rounded))
                    .foregroundColor(Color(UIColor(hex: 0xFFEBD1)))
            }
            Spacer()
            Button {
                SoundEngine.shared.playTap()
                onPlayLevel(101, true)
            } label: {
                Text("Play Event")
                    .font(.system(size: 14, weight: .heavy, design: .rounded))
                    .foregroundColor(.white)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(Color(UIColor(hex: 0x34D349)))
                    .clipShape(Capsule())
                    .overlay(Capsule().stroke(Color.white, lineWidth: 2))
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(
            LinearGradient(
                colors: [Color(UIColor(hex: 0xFF8E36)), Color(UIColor(hex: 0xF26B26))],
                startPoint: .top,
                endPoint: .bottom
            )
        )
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(Color(UIColor(hex: 0xFFE49E)), lineWidth: 3))
        .padding(.horizontal, 20)
    }

    private func milestoneCard(targetLevel: Int) -> some View {
        let startNode = max(1, targetLevel - 2)
        let badgeText = targetLevel > 25 ? "∞ ENDLESS MODE ACTIVE" : "NEXT MILESTONE ROADMAP"
        let hintText: String
        if targetLevel < 4 { hintText = "Unlock VIP Parking Slot at Level 4!" }
        else if targetLevel < 8 { hintText = "Unlock Arrange Booster at Level 8!" }
        else if targetLevel < 11 { hintText = "Park Theme & Wooden Obstacles at Level 11!" }
        else if targetLevel < 13 { hintText = "Unlock Jumble Booster at Level 13!" }
        else if targetLevel < 20 { hintText = "Diagonal Diamond Challenges at Level 20!" }
        else if targetLevel <= 25 { hintText = "Endless Auto-Generated Levels unlock after Level 25!" }
        else { hintText = "Endless Level \(targetLevel) • Procedurally generated & verified!" }

        return VStack(spacing: 10) {
            Text("\(badgeText)   •   ★ \(save.totalStars()) Stars")
                .font(.system(size: 12, weight: .bold, design: .rounded))
                .foregroundColor(Color(UIColor(hex: 0x2E6CC4)))

            HStack(spacing: 0) {
                ForEach(0..<5, id: \.self) { i in
                    let lv = startNode + i
                    let isDone = lv < save.data.highestUnlockedLevel
                    let isCurr = lv == targetLevel
                    ZStack {
                        Circle()
                            .fill(Color(UIColor(hex: isCurr ? 0x34D349 : (isDone ? 0x3B8EFF : 0x9AA8BF))))
                            .frame(width: isCurr ? 42 : 34, height: isCurr ? 42 : 34)
                            .overlay(Circle().stroke(Color(UIColor(hex: isCurr ? 0xFFE047 : 0xFFFFFF)), lineWidth: 2.5))
                        Text("\(lv)")
                            .font(.system(size: isCurr ? 15 : 13, weight: .black, design: .rounded))
                            .foregroundColor(.white)
                    }
                    if i < 4 {
                        Rectangle()
                            .fill(Color(UIColor(hex: isDone ? 0x34D349 : 0xCBD6E8)))
                            .frame(height: 5)
                    }
                }
            }
            .padding(.horizontal, 8)

            Text(hintText)
                .font(.system(size: 12, weight: .bold, design: .rounded))
                .foregroundColor(Color(UIColor(hex: 0x4C5F80)))
                .multilineTextAlignment(.center)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Color.white.opacity(0.94))
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(Color(UIColor(hex: 0x7CB8FF)), lineWidth: 2.5))
        .padding(.horizontal, 20)
    }

    private func scenicRoadFooter(width: CGFloat) -> some View {
        ZStack(alignment: .bottom) {
            HStack(spacing: -40) {
                Ellipse().fill(Color(UIColor(hex: 0x79D457))).frame(width: 220, height: 90)
                Ellipse().fill(Color(UIColor(hex: 0x5DBB42))).frame(width: 240, height: 76)
            }
            .offset(y: -26)

            Rectangle()
                .fill(Color(UIColor(hex: 0x4E596E)))
                .frame(width: width, height: 50)

            HStack(spacing: 46) {
                ForEach([BusColor.pink, .green, .blue, .yellow, .orange], id: \.self) { color in
                    Image(uiImage: UIImage(cgImage: VectorTextures.shared.busTexture(for: color).cgImage()))
                        .resizable()
                        .frame(width: 58, height: 38)
                }
            }
            .offset(x: busRoll ? -width * 0.45 : width * 0.45, y: -12)
        }
        .frame(height: 92)
        .clipped()
    }

    private func navButton(title: String, icon: String, topColor: UInt32, botColor: UInt32, action: @escaping () -> Void) -> some View {
        Button {
            SoundEngine.shared.playTap()
            action()
        } label: {
            ZStack {
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color(UIColor(hex: botColor)))
                    .frame(height: 64)
                    .offset(y: 4)
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color(UIColor(hex: topColor)))
                    .frame(height: 62)
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.white, lineWidth: 2.5))
                VStack(spacing: 2) {
                    Text(icon).font(.system(size: 20))
                    Text(title)
                        .font(.system(size: 13.5, weight: .heavy, design: .rounded))
                        .foregroundColor(.white)
                }
            }
        }
    }

    // MARK: - Home Modals

    @ViewBuilder
    private func modalOverlay(_ kind: HomeModalKind) -> some View {
        ZStack {
            Color(UIColor(hex: 0x0C162B, alpha: 0.62))
                .ignoresSafeArea()
                .onTapGesture {
                    SoundEngine.shared.playTap()
                    activeSheet = nil
                }

            VStack(spacing: 0) {
                switch kind {
                case .levels: levelsModalContent
                case .missions: missionsModalContent
                case .leaders: leadersModalContent
                case .settings: settingsModalContent
                }
            }
            .padding(20)
            .background(Color(UIColor(hex: 0xFFF9ED)))
            .clipShape(RoundedRectangle(cornerRadius: 24))
            .overlay(RoundedRectangle(cornerRadius: 24).stroke(Color(UIColor(hex: modalAccent(kind))), lineWidth: 4))
            .padding(.horizontal, 20)
        }
    }

    private func modalAccent(_ kind: HomeModalKind) -> UInt32 {
        switch kind {
        case .levels: return 0x3B8EFF
        case .missions: return 0x9B51E0
        case .leaders: return 0xFF8A1F
        case .settings: return 0x3B8EFF
        }
    }

    private func modalHeader(title: String, accent: UInt32) -> some View {
        HStack {
            Text(title)
                .font(.system(size: 20, weight: .black, design: .rounded))
                .foregroundColor(.white)
                .padding(.horizontal, 18)
                .padding(.vertical, 8)
                .background(Color(UIColor(hex: accent)))
                .clipShape(Capsule())
            Spacer()
            Button {
                SoundEngine.shared.playTap()
                activeSheet = nil
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(Color(UIColor(hex: 0x6E7E99)))
                    .frame(width: 40, height: 40)
                    .background(Color(UIColor(hex: 0xE8EFFA)))
                    .clipShape(Circle())
            }
        }
        .padding(.bottom, 14)
    }

    private var levelsModalContent: some View {
        let startId = levelPage * 20 + 1
        let endId = startId + 19
        let title = startId > 25 ? "Endless (\(startId)–\(endId))" : "Levels \(startId)–\(endId)"
        let columns = Array(repeating: GridItem(.flexible(), spacing: 8), count: 5)

        return VStack(spacing: 12) {
            modalHeader(title: title, accent: 0x3B8EFF)

            LazyVGrid(columns: columns, spacing: 10) {
                ForEach(startId...endId, id: \.self) { lv in
                    let unlocked = lv <= save.data.highestUnlockedLevel
                    let stars = save.data.starsByLevel[lv] ?? 0
                    Button {
                        guard unlocked else { return }
                        SoundEngine.shared.playTap()
                        activeSheet = nil
                        onPlayLevel(lv, false)
                    } label: {
                        VStack(spacing: 3) {
                            Text(unlocked ? "\(lv)" : "🔒")
                                .font(.system(size: unlocked ? 17 : 15, weight: .black, design: .rounded))
                                .foregroundColor(.white)
                            Text(unlocked ? (stars > 0 ? String(repeating: "★", count: stars) : (lv > 25 ? "∞" : "")) : "Lv.\(lv)")
                                .font(.system(size: 10, weight: .bold, design: .rounded))
                                .foregroundColor(Color(UIColor(hex: stars > 0 ? 0xFFE259 : 0xE2ECFF)))
                        }
                        .frame(height: 56)
                        .frame(maxWidth: .infinity)
                        .background(Color(UIColor(hex: unlocked ? 0x4CA6FF : 0x9AA8BF)))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color(UIColor(hex: lv == save.data.currentLevel ? 0xFFD24D : 0xFFFFFF)), lineWidth: lv == save.data.currentLevel ? 3 : 1)
                        )
                    }
                    .disabled(!unlocked)
                }
            }

            HStack(spacing: 14) {
                Button {
                    guard levelPage > 0 else { return }
                    SoundEngine.shared.playTap()
                    levelPage -= 1
                } label: {
                    Text("◀ Prev")
                        .font(.system(size: 14, weight: .heavy, design: .rounded))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(Color(UIColor(hex: levelPage > 0 ? 0x3B8EFF : 0x9AA8BF)))
                        .clipShape(Capsule())
                }
                .disabled(levelPage <= 0)

                Button {
                    SoundEngine.shared.playTap()
                    levelPage += 1
                } label: {
                    Text("Next ▶")
                        .font(.system(size: 14, weight: .heavy, design: .rounded))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(Color(UIColor(hex: 0x3B8EFF)))
                        .clipShape(Capsule())
                }
            }
            .padding(.top, 6)
        }
    }

    private var missionsModalContent: some View {
        VStack(spacing: 10) {
            modalHeader(title: "Daily & Weekly Missions", accent: 0x9B51E0)
            ForEach(save.data.missions) { m in
                let done = m.progress >= m.target
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(m.period.rawValue.uppercased()) • \(m.title)")
                            .font(.system(size: 11, weight: .heavy, design: .rounded))
                            .foregroundColor(Color(UIColor(hex: m.period == .daily ? 0x2E86FF : 0x9B51E0)))
                        Text("\(m.description) (\(m.progress)/\(m.target))")
                            .font(.system(size: 13, weight: .bold, design: .rounded))
                            .foregroundColor(Color(UIColor(hex: 0x344769)))
                    }
                    Spacer()
                    if m.claimed {
                        Text("Claimed ✓")
                            .font(.system(size: 13, weight: .heavy, design: .rounded))
                            .foregroundColor(Color(UIColor(hex: 0x34A853)))
                    } else if done {
                        Button {
                            if SaveManager.shared.claimMission(m.id) {
                                SoundEngine.shared.playCoin()
                            }
                        } label: {
                            Text("+\(m.rewardCoins) 🪙")
                                .font(.system(size: 13, weight: .heavy, design: .rounded))
                                .foregroundColor(.white)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 7)
                                .background(Color(UIColor(hex: 0x34D349)))
                                .clipShape(Capsule())
                        }
                    } else {
                        Text("🪙 \(m.rewardCoins)")
                            .font(.system(size: 13.5, weight: .bold, design: .rounded))
                            .foregroundColor(Color(UIColor(hex: 0x8F6200)))
                    }
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .background(Color(UIColor(hex: 0xF0F4FC)))
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(UIColor(hex: done ? 0x34D349 : 0xD0DCED)), lineWidth: 1.8))
            }
        }
    }

    private var leadersModalContent: some View {
        let playerScore = save.data.stats.levelsWon * 140 + save.totalStars() * 45 + save.data.coins
        let allRows: [(name: String, score: Int, color: BusColor, isMe: Bool)] = (
            rivals.map { ($0.name, $0.score, $0.color, false) } +
            [("You (Player)", playerScore, .orange, true)]
        ).sorted { $0.score > $1.score }

        return VStack(spacing: 8) {
            modalHeader(title: "Party Leaderboard", accent: 0xFF8A1F)
            ForEach(Array(allRows.enumerated()), id: \.offset) { idx, r in
                let rankText = idx == 0 ? "🥇" : (idx == 1 ? "🥈" : (idx == 2 ? "🥉" : "#\(idx + 1)"))
                HStack(spacing: 10) {
                    Text(rankText)
                        .font(.system(size: 15, weight: .bold, design: .rounded))
                        .frame(width: 30)
                    Circle()
                        .fill(Color(r.color.style.main))
                        .frame(width: 14, height: 14)
                    Text(r.name)
                        .font(.system(size: 14, weight: r.isMe ? .black : .semibold, design: .rounded))
                        .foregroundColor(Color(UIColor(hex: 0x263859)))
                    Spacer()
                    Text("\(r.score) pts")
                        .font(.system(size: 14, weight: .bold, design: .rounded))
                        .foregroundColor(Color(UIColor(hex: 0x2E6CC4)))
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background(Color(UIColor(hex: r.isMe ? 0xFFF0BD : 0xF1F5FC)))
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(Color(UIColor(hex: 0xFFAA00)), lineWidth: r.isMe ? 2 : 0)
                )
            }
        }
    }

    private var settingsModalContent: some View {
        VStack(spacing: 14) {
            modalHeader(title: "Settings", accent: 0x3B8EFF)

            HStack {
                Text("🔊 Sound Effects")
                    .font(.system(size: 16, weight: .bold, design: .rounded))
                    .foregroundColor(Color(UIColor(hex: 0x263859)))
                Spacer()
                Toggle("", isOn: Binding(
                    get: { save.data.settings.soundEnabled },
                    set: { SaveManager.shared.setSoundEnabled($0) }
                ))
                .labelsHidden()
            }
            .padding()
            .background(Color(UIColor(hex: 0xF0F4FC)))
            .clipShape(RoundedRectangle(cornerRadius: 14))

            HStack {
                Text("📳 Haptic Vibration")
                    .font(.system(size: 16, weight: .bold, design: .rounded))
                    .foregroundColor(Color(UIColor(hex: 0x263859)))
                Spacer()
                Toggle("", isOn: Binding(
                    get: { save.data.settings.vibrationEnabled },
                    set: { SaveManager.shared.setVibrationEnabled($0) }
                ))
                .labelsHidden()
            }
            .padding()
            .background(Color(UIColor(hex: 0xF0F4FC)))
            .clipShape(RoundedRectangle(cornerRadius: 14))

            Text("Stats: \(save.data.stats.levelsWon) Wins • \(save.data.stats.passengersBoarded) Boarded")
                .font(.system(size: 13, weight: .semibold, design: .rounded))
                .foregroundColor(Color(UIColor(hex: 0x5B6E8F)))
                .padding(.top, 4)
        }
    }
}
