import SwiftUI

private struct HomeSafeMetrics: Equatable {
    var top: CGFloat
    var bottom: CGFloat
    var usableHeight: CGFloat

    static func initial() -> HomeSafeMetrics {
        let windowScene = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first
        let window = windowScene?.windows.first(where: { $0.isKeyWindow }) ?? windowScene?.windows.first
        let insets = window?.safeAreaInsets ?? UIEdgeInsets(top: 47, left: 0, bottom: 34, right: 0)
        let screenH = UIScreen.main.bounds.height
        return HomeSafeMetrics(
            top: insets.top,
            bottom: insets.bottom,
            usableHeight: max(320, screenH - insets.top - insets.bottom)
        )
    }
}

private struct HomeSafeMetricsKey: PreferenceKey {
    static var defaultValue = HomeSafeMetrics()
    static func reduce(value: inout HomeSafeMetrics, nextValue: () -> HomeSafeMetrics) {
        value = nextValue()
    }
}

private struct ModalHeightKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = max(value, nextValue())
    }
}

private struct StrokedText: View {
    let text: String
    let font: Font
    let fillColor: Color
    let strokeColor: Color
    let strokeWidth: CGFloat

    var body: some View {
        ZStack {
            Text(text).font(font).foregroundColor(strokeColor).offset(x: -strokeWidth, y: -strokeWidth)
            Text(text).font(font).foregroundColor(strokeColor).offset(x: strokeWidth, y: -strokeWidth)
            Text(text).font(font).foregroundColor(strokeColor).offset(x: -strokeWidth, y: strokeWidth)
            Text(text).font(font).foregroundColor(strokeColor).offset(x: strokeWidth, y: strokeWidth)
            Text(text).font(font).foregroundColor(strokeColor).offset(x: 0, y: strokeWidth * 1.3)
            Text(text).font(font).foregroundColor(fillColor)
        }
    }
}

private struct GoldCoinBadge: View {
    var size: CGFloat = 22

    var body: some View {
        ZStack {
            Circle()
                .fill(
                    LinearGradient(
                        colors: [Color(UIColor(hex: 0xFFE869)), Color(UIColor(hex: 0xFFA800))],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: size, height: size)
                .overlay(Circle().stroke(Color(UIColor(hex: 0xD97706)), lineWidth: 1.5))
            Circle()
                .stroke(Color(UIColor(hex: 0xFFF7C2)), lineWidth: 1.2)
                .frame(width: size * 0.66, height: size * 0.66)
        }
    }
}

struct HomeView: View {
    @ObservedObject private var save = SaveManager.shared
    let onPlayLevel: (Int, Bool) -> Void

    @State private var activeSheet: HomeModalKind?
    @State private var levelPage: Int = 0
    @State private var floatLogo = false
    @State private var pulsePlay = false
    @State private var cloudDrift = false
    @State private var busRollOffset: CGFloat = -320
    @State private var measuredModalHeight: CGFloat = 0
    @State private var safeMetrics = HomeSafeMetrics.initial()

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
        let targetLevel = save.data.currentLevel
        let compact = safeMetrics.usableHeight < 700
        let roadBandH: CGFloat = compact ? 38 : 44
        let dockBodyH: CGFloat = compact ? 74 : 84

        ZStack {
            // Layer 1: Full-bleed sky, clouds, hills, road & dock matching full screen edge-to-edge
            GeometryReader { bgGeo in
                let w = bgGeo.size.width
                let h = bgGeo.size.height
                fullScreenBackdrop(
                    width: w,
                    fullHeight: h,
                    safeTop: safeMetrics.top,
                    dockHeight: dockBodyH + safeMetrics.bottom,
                    roadBandH: roadBandH
                )
                .frame(width: w, height: h)
                .clipped()
            }
            .ignoresSafeArea()

            // Layer 2: Safe-area interactive HUD & Cards
            GeometryReader { fgGeo in
                let w = fgGeo.size.width
                let h = fgGeo.size.height
                let isCompact = h < 700
                let roadH: CGFloat = isCompact ? 38 : 44

                VStack(spacing: isCompact ? 8 : 12) {
                    topBar(compact: isCompact)

                    heroLogoBadge(width: w, compact: isCompact)

                    seasonalCard(compact: isCompact)

                    Spacer(minLength: 8)

                    VStack(spacing: isCompact ? 12 : 16) {
                        milestoneCard(targetLevel: targetLevel, compact: isCompact)
                        playCTAButton(targetLevel: targetLevel, compact: isCompact)
                    }

                    Spacer(minLength: 8)

                    // Keep middle cluster cleanly above the rolling buses and road curb
                    Color.clear
                        .frame(height: roadH + (isCompact ? 16 : 24))

                    bottomNavDock(compact: isCompact)
                }
                .frame(width: w, height: h)
                .background(
                    Color.clear.preference(
                        key: HomeSafeMetricsKey.self,
                        value: HomeSafeMetrics(
                            top: fgGeo.safeAreaInsets.top,
                            bottom: fgGeo.safeAreaInsets.bottom,
                            usableHeight: h
                        )
                    )
                )
                .onAppear {
                    let span = w * 0.5 + 280
                    busRollOffset = -span
                    withAnimation(.linear(duration: 6.8).repeatForever(autoreverses: false)) {
                        busRollOffset = span
                    }
                }
            }
            .onPreferenceChange(HomeSafeMetricsKey.self) { metrics in
                if metrics != safeMetrics {
                    safeMetrics = metrics
                }
            }

            if let modal = activeSheet {
                GeometryReader { modalGeo in
                    modalOverlay(
                        modal,
                        screenH: modalGeo.size.height + modalGeo.safeAreaInsets.top + modalGeo.safeAreaInsets.bottom,
                        screenW: modalGeo.size.width
                    )
                }
                .ignoresSafeArea()
            }
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 1.7).repeatForever(autoreverses: true)) {
                floatLogo = true
            }
            withAnimation(.easeInOut(duration: 0.95).repeatForever(autoreverses: true)) {
                pulsePlay = true
            }
            withAnimation(.easeInOut(duration: 4.2).repeatForever(autoreverses: true)) {
                cloudDrift = true
            }
        }
    }

    // MARK: - Backdrop

    private func fullScreenBackdrop(
        width: CGFloat,
        fullHeight: CGFloat,
        safeTop: CGFloat,
        dockHeight: CGFloat,
        roadBandH: CGFloat
    ) -> some View {
        let topSkyH = round(fullHeight * 0.52)

        return ZStack(alignment: .top) {
            // 52/48 sky gradient bands
            VStack(spacing: 0) {
                Color(UIColor(hex: 0x69B8FF))
                    .frame(height: topSkyH)
                Color(UIColor(hex: 0x9BD4FF))
            }
            .frame(width: width, height: fullHeight)

            // Subtle drifting clouds placed cleanly below safe area top bar
            cloudCluster(scale: 0.92)
                .position(x: width * 0.14 + (cloudDrift ? 10 : -6), y: safeTop + 112)
            cloudCluster(scale: 0.68)
                .position(x: width * 0.50 + (cloudDrift ? -10 : 8), y: safeTop + 64)
            cloudCluster(scale: 0.84)
                .position(x: width * 0.86 + (cloudDrift ? 8 : -10), y: safeTop + 130)

            // Bottom hills, curb, asphalt, rolling buses, dark slate dock
            VStack(spacing: 0) {
                Spacer(minLength: 0)

                ZStack(alignment: .bottom) {
                    // Two rolling green hills behind road
                    HStack(spacing: -width * 0.24) {
                        Ellipse()
                            .fill(Color(UIColor(hex: 0x7EDB65)))
                            .frame(width: width * 0.78, height: 112)
                        Ellipse()
                            .fill(Color(UIColor(hex: 0x63C94B)))
                            .frame(width: width * 0.76, height: 100)
                    }
                    .frame(width: width)
                    .clipped()
                    .offset(y: -(dockHeight + roadBandH - 36))

                    // Roadway stack anchored to screen bottom
                    VStack(spacing: 0) {
                        Rectangle()
                            .fill(Color(UIColor(hex: 0x9AA6BF)))
                            .frame(width: width, height: 5)

                        Rectangle()
                            .fill(Color(UIColor(hex: 0x525C70)))
                            .frame(width: width, height: roadBandH)

                        Rectangle()
                            .fill(Color(UIColor(hex: 0x3F4759)))
                            .frame(width: width, height: dockHeight)
                    }

                    // Rolling buses riding right along middle/upper asphalt road cleanly above dock
                    ZStack {
                        HStack(spacing: 48) {
                            ForEach([BusColor.pink, .yellow, .blue, .green], id: \.self) { color in
                                Image(uiImage: VectorTextures.shared.busUIImage(for: color))
                                    .resizable()
                                    .aspectRatio(contentMode: .fit)
                                    .frame(width: 62, height: 35)
                            }
                        }
                        .offset(x: busRollOffset)
                    }
                    .frame(width: width, height: roadBandH + 22)
                    .clipped()
                    .offset(y: -(dockHeight + 14))
                }
                .frame(width: width)
            }
            .frame(width: width, height: fullHeight)
        }
    }

    private func cloudCluster(scale: CGFloat) -> some View {
        ZStack {
            Circle().fill(Color.white.opacity(0.65)).frame(width: 44 * scale, height: 44 * scale).offset(x: -16 * scale, y: 4 * scale)
            Circle().fill(Color.white.opacity(0.65)).frame(width: 54 * scale, height: 54 * scale).offset(x: 4 * scale, y: -4 * scale)
            Circle().fill(Color.white.opacity(0.65)).frame(width: 38 * scale, height: 38 * scale).offset(x: 24 * scale, y: 5 * scale)
        }
    }

    // MARK: - Foreground Sections

    private func topBar(compact: Bool) -> some View {
        HStack {
            HStack(spacing: 8) {
                GoldCoinBadge(size: compact ? 20 : 22)
                Text("\(save.data.coins)")
                    .font(.system(size: compact ? 16 : 17, weight: .black, design: .rounded))
                    .foregroundColor(Color(UIColor(hex: 0x6E4500)))
            }
            .padding(.horizontal, 14)
            .padding(.vertical, compact ? 7 : 8)
            .background(Color.white.opacity(0.96))
            .clipShape(Capsule())
            .overlay(Capsule().stroke(Color(UIColor(hex: 0xFFC814)), lineWidth: 2.5))
            .shadow(color: Color(UIColor(hex: 0x1F355C)).opacity(0.22), radius: 0, x: 0, y: 3)

            Spacer()

            Button {
                SoundEngine.shared.playTap()
                activeSheet = .settings
            } label: {
                Image(systemName: "gearshape.fill")
                    .font(.system(size: compact ? 16 : 18, weight: .bold))
                    .foregroundColor(.white)
                    .frame(width: compact ? 38 : 42, height: compact ? 38 : 42)
                    .background(Color(UIColor(hex: 0x3B8EFF)))
                    .clipShape(Circle())
                    .overlay(Circle().stroke(Color.white, lineWidth: 2.5))
                    .shadow(color: Color(UIColor(hex: 0x1A5FC2)), radius: 0, x: 0, y: 2.5)
            }
            .accessibilityIdentifier("home_settings_button")
        }
        .padding(.horizontal, 18)
        .padding(.top, compact ? 2 : 6)
    }

    private func heroLogoBadge(width: CGFloat, compact: Bool) -> some View {
        let badgeW = min(max(210, width - 104), 278)
        let badgeH: CGFloat = compact ? 76 : 86

        return ZStack {
            // Left orange bus peeking behind badge
            Image(uiImage: VectorTextures.shared.busUIImage(for: .orange))
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: 64, height: 36)
                .rotationEffect(.degrees(-18))
                .offset(x: -(badgeW * 0.5 + 14), y: 12)

            // Right cyan bus peeking & flipped behind badge
            Image(uiImage: VectorTextures.shared.busUIImage(for: .cyan))
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: 64, height: 36)
                .scaleEffect(x: -1, y: 1)
                .rotationEffect(.degrees(18))
                .offset(x: badgeW * 0.5 + 14, y: 12)

            RoundedRectangle(cornerRadius: 22)
                .fill(Color(UIColor(hex: 0x163570)).opacity(0.42))
                .frame(width: badgeW, height: badgeH)
                .offset(y: 6)

            RoundedRectangle(cornerRadius: 22)
                .fill(Color(UIColor(hex: 0x2E86FF)))
                .frame(width: badgeW, height: badgeH)
                .overlay(RoundedRectangle(cornerRadius: 22).stroke(Color.white, lineWidth: 3.5))

            VStack(spacing: compact ? 1 : 3) {
                StrokedText(
                    text: "BUS FEVER",
                    font: .system(size: compact ? 28 : 33, weight: .black, design: .rounded),
                    fillColor: Color(UIColor(hex: 0xFFE047)),
                    strokeColor: Color(UIColor(hex: 0x163570)),
                    strokeWidth: 1.8
                )
                StrokedText(
                    text: "PARTY PASSENGER LOOP",
                    font: .system(size: compact ? 12 : 14, weight: .heavy, design: .rounded),
                    fillColor: .white,
                    strokeColor: Color(UIColor(hex: 0x163570)),
                    strokeWidth: 1.1
                )
            }
        }
        .offset(y: floatLogo ? -4 : 0)
    }

    private func seasonalCard(compact: Bool) -> some View {
        ZStack {
            RoundedRectangle(cornerRadius: 20)
                .fill(Color(UIColor(hex: 0x8C2E0E)).opacity(0.38))
                .offset(y: 5)

            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(save.data.stats.eventCompleted ? "🍁 SEASONAL EVENT • CLEARED ✓" : "🍁 SEASONAL EVENT")
                        .font(.system(size: 10.5, weight: .heavy, design: .rounded))
                        .foregroundColor(Color(UIColor(hex: 0xFFF2BD)))
                    StrokedText(
                        text: "Maple Bus Escape Challenge",
                        font: .system(size: compact ? 15 : 16.5, weight: .black, design: .rounded),
                        fillColor: .white,
                        strokeColor: Color(UIColor(hex: 0x7A1F05)),
                        strokeWidth: 1.0
                    )
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                    Text("Autumn maple loop • Bonus coins!")
                        .font(.system(size: 11.5, weight: .bold, design: .rounded))
                        .foregroundColor(Color(UIColor(hex: 0xFFEBD1)))
                        .lineLimit(1)
                }
                Spacer(minLength: 4)
                Button {
                    SoundEngine.shared.playTap()
                    onPlayLevel(101, true)
                } label: {
                    ZStack {
                        Capsule()
                            .fill(Color(UIColor(hex: 0x189629)))
                            .offset(y: 3)
                        Text("Play Event")
                            .font(.system(size: 13, weight: .heavy, design: .rounded))
                            .foregroundColor(.white)
                            .padding(.horizontal, 13)
                            .padding(.vertical, 8)
                            .background(Color(UIColor(hex: 0x34D349)))
                            .clipShape(Capsule())
                            .overlay(Capsule().stroke(Color.white, lineWidth: 2))
                    }
                    .fixedSize()
                }
                .accessibilityIdentifier("home_event_button")
            }
            .padding(.horizontal, 14)
            .padding(.vertical, compact ? 10 : 12)
            .background(
                ZStack(alignment: .top) {
                    Color(UIColor(hex: 0xF26B26))
                    Color(UIColor(hex: 0xFF8E36))
                        .frame(height: compact ? 42 : 48)
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                        .padding(3)
                }
            )
            .clipShape(RoundedRectangle(cornerRadius: 20))
            .overlay(RoundedRectangle(cornerRadius: 20).stroke(Color(UIColor(hex: 0xFFE49E)), lineWidth: 2.5))
        }
        .fixedSize(horizontal: false, vertical: true)
        .padding(.horizontal, 18)
    }

    private func milestoneCard(targetLevel: Int, compact: Bool) -> some View {
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

        return ZStack {
            RoundedRectangle(cornerRadius: 18)
                .fill(Color(UIColor(hex: 0x1F3A63)).opacity(0.2))
                .offset(y: 4)

            VStack(spacing: compact ? 7 : 9) {
                Text("\(badgeText)   •   ★ \(save.totalStars()) Stars")
                    .font(.system(size: 11.5, weight: .bold, design: .rounded))
                    .foregroundColor(Color(UIColor(hex: 0x2E6CC4)))

                HStack(spacing: 0) {
                    ForEach(0..<5, id: \.self) { i in
                        let lv = startNode + i
                        let isDone = lv < save.data.highestUnlockedLevel
                        let isCurr = lv == targetLevel
                        ZStack {
                            Circle()
                                .fill(Color(UIColor(hex: isCurr ? 0x34D349 : (isDone ? 0x3B8EFF : 0x9AA8BF))))
                                .frame(width: isCurr ? (compact ? 34 : 38) : (compact ? 28 : 30),
                                       height: isCurr ? (compact ? 34 : 38) : (compact ? 28 : 30))
                                .overlay(Circle().stroke(Color(UIColor(hex: isCurr ? 0xFFE047 : 0xFFFFFF)), lineWidth: 2.5))
                            Text("\(lv)")
                                .font(.system(size: isCurr ? 14.5 : 12.5, weight: .black, design: .rounded))
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
                    .lineLimit(2)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, compact ? 9 : 11)
            .background(Color.white.opacity(0.95))
            .clipShape(RoundedRectangle(cornerRadius: 18))
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(Color(UIColor(hex: 0x7CB8FF)), lineWidth: 2.5))
        }
        .fixedSize(horizontal: false, vertical: true)
        .padding(.horizontal, 18)
    }

    private func playCTAButton(targetLevel: Int, compact: Bool) -> some View {
        let btnW: CGFloat = compact ? 236 : 260
        let btnH: CGFloat = compact ? 54 : 60

        return Button {
            SoundEngine.shared.playTap()
            onPlayLevel(targetLevel, false)
        } label: {
            ZStack {
                Capsule()
                    .fill(Color(UIColor(hex: 0x158C24)))
                    .frame(width: btnW, height: btnH)
                    .offset(y: 4)
                Capsule()
                    .fill(Color(UIColor(hex: 0x34D349)))
                    .frame(width: btnW, height: btnH - 2)
                    .overlay(Capsule().stroke(Color.white, lineWidth: 3))
                Text("PLAY  LEVEL \(targetLevel)")
                    .font(.system(size: compact ? 19 : 21, weight: .black, design: .rounded))
                    .foregroundColor(.white)
            }
        }
        .scaleEffect(pulsePlay ? 1.03 : 1.0)
        .accessibilityIdentifier("home_play_button")
    }

    private func bottomNavDock(compact: Bool) -> some View {
        HStack(spacing: 12) {
            navButton(title: "Levels", icon: "map.fill", topColor: 0x3B8EFF, botColor: 0x1A5FC2, compact: compact) {
                levelPage = max(0, (save.data.currentLevel - 1) / 20)
                activeSheet = .levels
            }
            .accessibilityIdentifier("home_levels_button")
            navButton(title: "Missions", icon: "target", topColor: 0x9B51E0, botColor: 0x6724AB, compact: compact) {
                activeSheet = .missions
            }
            .accessibilityIdentifier("home_missions_button")
            navButton(title: "Leaders", icon: "trophy.fill", topColor: 0xFF8A1F, botColor: 0xC75600, compact: compact) {
                activeSheet = .leaders
            }
            .accessibilityIdentifier("home_leaders_button")
        }
        .padding(.horizontal, 16)
        .padding(.top, compact ? 6 : 10)
        .padding(.bottom, compact ? 8 : 10)
    }

    private func navButton(
        title: String,
        icon: String,
        topColor: UInt32,
        botColor: UInt32,
        compact: Bool,
        action: @escaping () -> Void
    ) -> some View {
        let h: CGFloat = compact ? 52 : 58
        return Button {
            SoundEngine.shared.playTap()
            action()
        } label: {
            ZStack {
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color(UIColor(hex: botColor)))
                    .frame(height: h)
                    .offset(y: 4)
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color(UIColor(hex: topColor)))
                    .frame(height: h - 2)
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.white, lineWidth: 2.5))
                VStack(spacing: 2) {
                    Image(systemName: icon)
                        .font(.system(size: compact ? 16 : 18, weight: .bold))
                        .foregroundColor(.white)
                    Text(title)
                        .font(.system(size: compact ? 12 : 13, weight: .heavy, design: .rounded))
                        .foregroundColor(.white)
                }
            }
        }
    }

    // MARK: - Home Modals (Tight Auto-Fit + Scrollable Only When Needed)

    @ViewBuilder
    private func modalOverlay(_ kind: HomeModalKind, screenH: CGFloat, screenW: CGFloat) -> some View {
        let maxModalH = max(280, screenH * 0.78)
        let displayH = measuredModalHeight > 20 ? min(maxModalH, measuredModalHeight) : min(maxModalH, 420)

        ZStack {
            Color(UIColor(hex: 0x0C162B, alpha: 0.62))
                .onTapGesture {
                    SoundEngine.shared.playTap()
                    measuredModalHeight = 0
                    activeSheet = nil
                }

            ScrollView(.vertical, showsIndicators: measuredModalHeight > maxModalH) {
                VStack(spacing: 0) {
                    switch kind {
                    case .levels: levelsModalContent
                    case .missions: missionsModalContent
                    case .leaders: leadersModalContent
                    case .settings: settingsModalContent
                    }
                }
                .padding(18)
                .background(
                    GeometryReader { contentGeo in
                        Color.clear.preference(key: ModalHeightKey.self, value: contentGeo.size.height)
                    }
                )
            }
            .id(kind)
            .onPreferenceChange(ModalHeightKey.self) { h in
                if h > 80 {
                    measuredModalHeight = h
                }
            }
            .frame(maxWidth: min(screenW - 36, 400))
            .frame(height: displayH)
            .background(Color(UIColor(hex: 0xFFF9ED)))
            .clipShape(RoundedRectangle(cornerRadius: 24))
            .overlay(RoundedRectangle(cornerRadius: 24).stroke(Color(UIColor(hex: modalAccent(kind))), lineWidth: 4))
            .shadow(color: .black.opacity(0.28), radius: 18, x: 0, y: 8)
            .padding(.horizontal, 18)
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
                .font(.system(size: 18, weight: .black, design: .rounded))
                .foregroundColor(.white)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(Color(UIColor(hex: accent)))
                .clipShape(Capsule())
            Spacer()
            Button {
                SoundEngine.shared.playTap()
                measuredModalHeight = 0
                activeSheet = nil
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundColor(Color(UIColor(hex: 0x6E7E99)))
                    .frame(width: 38, height: 38)
                    .background(Color(UIColor(hex: 0xE8EFFA)))
                    .clipShape(Circle())
            }
            .accessibilityIdentifier("modal_close_button")
        }
        .padding(.bottom, 12)
    }

    private var levelsModalContent: some View {
        let startId = levelPage * 20 + 1
        let endId = startId + 19
        let title = startId > 25 ? "Endless (\(startId)–\(endId))" : "Levels \(startId)–\(endId)"
        let columns = Array(repeating: GridItem(.flexible(), spacing: 8), count: 5)

        return VStack(spacing: 12) {
            modalHeader(title: title, accent: 0x3B8EFF)

            LazyVGrid(columns: columns, spacing: 9) {
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
                            if unlocked {
                                Text("\(lv)")
                                    .font(.system(size: 17, weight: .black, design: .rounded))
                                    .foregroundColor(.white)
                            } else {
                                Image(systemName: "lock.fill")
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundColor(.white.opacity(0.92))
                            }
                            Text(unlocked ? (stars > 0 ? String(repeating: "★", count: stars) : (lv > 25 ? "∞" : "")) : "Lv.\(lv)")
                                .font(.system(size: 10, weight: .bold, design: .rounded))
                                .foregroundColor(Color(UIColor(hex: stars > 0 ? 0xFFE259 : 0xE2ECFF)))
                        }
                        .frame(height: 52)
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
            .padding(.top, 2)
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
                            HStack(spacing: 4) {
                                Text("+\(m.rewardCoins)")
                                    .font(.system(size: 13, weight: .heavy, design: .rounded))
                                    .foregroundColor(.white)
                                GoldCoinBadge(size: 14)
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 7)
                            .background(Color(UIColor(hex: 0x34D349)))
                            .clipShape(Capsule())
                        }
                    } else {
                        HStack(spacing: 4) {
                            GoldCoinBadge(size: 15)
                            Text("\(m.rewardCoins)")
                                .font(.system(size: 13.5, weight: .bold, design: .rounded))
                                .foregroundColor(Color(UIColor(hex: 0x8F6200)))
                        }
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
                .padding(.top, 2)
        }
    }
}
