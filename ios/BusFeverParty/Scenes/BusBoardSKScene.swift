import SpriteKit
import UIKit

struct LayoutMetrics {
    let width: CGFloat = 540
    let height: CGFloat
    let safeTop: CGFloat
    let safeBottom: CGFloat
    let trackOffsetY: CGFloat
    let stripTop: CGFloat
    let slotY: CGFloat
    let stripBottom: CGFloat
    let boosterDockTop: CGFloat
    let boardTop: CGFloat
    let boardBottom: CGFloat
    let boardCenterY: CGFloat

    init(screenSize: CGSize, safeTopPts: CGFloat, safeBotPts: CGFloat) {
        let screenW = max(320, min(screenSize.width, screenSize.height))
        let screenH = max(screenW, max(screenSize.width, screenSize.height))
        let aspect = screenH / screenW
        let h = max(860, min(1320, round(540 * aspect)))
        let logicalPerPt = 540.0 / screenW
        let tall = aspect >= 1.92
        let sTop = max(12, safeTopPts * logicalPerPt)
        let sBot = max(10, safeBotPts * logicalPerPt)
        let topReserve = round((safeTopPts + (tall ? 58 : 52)) * logicalPerPt)
        let botReserve = round((safeBotPts + (tall ? 128 : 112)) * logicalPerPt)
        let tOff = max(54, topReserve - 44)
        let sTopY = 322 + tOff
        let sBotY = sTopY + 108
        let dockTop = h - botReserve
        let bTop = sBotY + 8
        let bBot = max(bTop + 240, dockTop - 8)

        self.height = h
        self.safeTop = sTop
        self.safeBottom = sBot
        self.trackOffsetY = tOff
        self.stripTop = sTopY
        self.slotY = sTopY + 56
        self.stripBottom = sBotY
        self.boosterDockTop = dockTop
        self.boardTop = bTop
        self.boardBottom = bBot
        self.boardCenterY = round((bTop + bBot) * 0.5)
    }
}

protocol GameSceneDelegate: AnyObject {
    func gameSceneDidUpdateHUD(canUndo: Bool, undoRemaining: Int)
    func gameSceneDidShowToast(_ message: String)
    func gameSceneDidDismissTutorial()
    func gameSceneDidWin(stars: Int, coinsEarned: Int, hasNextLevel: Bool)
    func gameSceneDidLose(outcome: EngineOutcome)
    func gameSceneDidRequestUnlockSlot(_ slotIndex: Int)
    func gameSceneDidRequestGetBooster(_ type: BoosterType)
}

private final class BoardBusNode: SKNode {
    let busId: String
    let bodySprite: SKSpriteNode
    let arrowSprite: SKSpriteNode
    var mysteryLabel: SKLabelNode?
    var mysteryDot: SKShapeNode?

    init(busId: String, body: SKSpriteNode, arrow: SKSpriteNode) {
        self.busId = busId
        self.bodySprite = body
        self.arrowSprite = arrow
        super.init()
        self.name = "bus:\(busId)"
    }

    @available(*, unavailable)
    required init?(coder aDecoder: NSCoder) { nil }
}

private final class ParkedBusNode: SKNode {
    let busId: String
    let bodySprite: SKSpriteNode
    let capBg: SKShapeNode
    let capLabel: SKLabelNode

    init(busId: String, body: SKSpriteNode, capBg: SKShapeNode, capLabel: SKLabelNode) {
        self.busId = busId
        self.bodySprite = body
        self.capBg = capBg
        self.capLabel = capLabel
        super.init()
    }

    @available(*, unavailable)
    required init?(coder aDecoder: NSCoder) { nil }
}

/// Pure SpriteKit 60/120fps gameplay canvas rendering track, passengers, slanted slots, buses, obstacles, and VFX.
final class BusBoardSKScene: SKScene {
    weak var gameDelegate: GameSceneDelegate?

    private(set) var engine: GameEngine
    private(set) var layout: LayoutMetrics
    private var track: TrackGeometry!

    private var worldLayer = SKNode()
    private var boardLayer = SKNode()
    private var passengerLayer = SKNode()
    private var parkedLayer = SKNode()
    private var fxLayer = SKNode()

    private var slotNodes: [SKNode] = []
    private var boardBusNodes: [String: BoardBusNode] = [:]
    private var parkedBusNodes: [String: ParkedBusNode] = [:]
    private var passengerSprites: [Int: SKSpriteNode] = [:]
    private var waitingBubble = SKNode()
    private var tutorialHand: SKSpriteNode?

    private var cellSize: CGFloat = 76
    private var boardOriginX: CGFloat = 0
    private var boardOriginY: CGFloat = 0

    private var lastUpdateTime: TimeInterval = 0
    private var boardingTimer: TimeInterval = 0
    private var noMatchElapsed: TimeInterval = 0
    private var status: GameStatus = .playing

    private let maxVisiblePassengers = 68
    private let boardingInterval: TimeInterval = 0.075
    private let slotAngleDeg: CGFloat = -12

    private var slotTiltedRadians: CGFloat { -slotAngleDeg * .pi / 180.0 }
    private var parkedBusRotationRadians: CGFloat { slotTiltedRadians + .pi * 0.5 }
    private var appliedScreenSize: CGSize
    private var appliedSafeTopPts: CGFloat
    private var appliedSafeBotPts: CGFloat

    init(level: LevelConfig, screenSize: CGSize, safeTopPts: CGFloat, safeBotPts: CGFloat) {
        self.engine = GameEngine(level: level)
        self.appliedScreenSize = screenSize
        self.appliedSafeTopPts = safeTopPts
        self.appliedSafeBotPts = safeBotPts
        self.layout = LayoutMetrics(screenSize: screenSize, safeTopPts: safeTopPts, safeBotPts: safeBotPts)
        super.init(size: CGSize(width: 540, height: layout.height))
        self.scaleMode = .aspectFit
    }

    @available(*, unavailable)
    required init?(coder aDecoder: NSCoder) { nil }

    override func didMove(to view: SKView) {
        view.ignoresSiblingOrder = false
        backgroundColor = UIColor(hex: 0xC5D6EC)
        setupScene()
    }

    func syncViewportMetricsIfNeeded(screenSize: CGSize, safeTopPts: CGFloat, safeBotPts: CGFloat) {
        guard screenSize.width > 100, screenSize.height > 100 else { return }
        let dw = abs(screenSize.width - appliedScreenSize.width)
        let dh = abs(screenSize.height - appliedScreenSize.height)
        let dt = abs(safeTopPts - appliedSafeTopPts)
        let db = abs(safeBotPts - appliedSafeBotPts)
        guard dw > 1 || dh > 1 || dt > 1 || db > 1 else { return }

        appliedScreenSize = screenSize
        appliedSafeTopPts = safeTopPts
        appliedSafeBotPts = safeBotPts
        layout = LayoutMetrics(screenSize: screenSize, safeTopPts: safeTopPts, safeBotPts: safeBotPts)
        self.size = CGSize(width: 540, height: layout.height)
        if view != nil {
            worldLayer.removeAllChildren()
            slotNodes.removeAll()
            track = TrackGeometry(shape: engine.level.trackShape, offsetY: layout.trackOffsetY)
            drawThemeAndTrack()
            createParkingStrip()
            rebuildVisualsFromEngine()
        }
    }

    func setPausedByModal(_ paused: Bool) {
        if status == .won || status == .lost { return }
        status = paused ? .paused : .playing
    }

    private func skPt(_ lx: CGFloat, _ ly: CGFloat) -> CGPoint {
        CGPoint(x: lx, y: layout.height - ly)
    }

    private func gridToLogical(_ gx: Double, _ gy: Double) -> CGPoint {
        CGPoint(x: boardOriginX + CGFloat(gx) * cellSize, y: boardOriginY + CGFloat(gy) * cellSize)
    }

    private func setupScene() {
        removeAllChildren()
        boardBusNodes.removeAll()
        parkedBusNodes.removeAll()
        passengerSprites.removeAll()
        slotNodes.removeAll()

        worldLayer = SKNode()
        boardLayer = SKNode()
        passengerLayer = SKNode()
        parkedLayer = SKNode()
        fxLayer = SKNode()

        worldLayer.zPosition = 0
        passengerLayer.zPosition = 10
        parkedLayer.zPosition = 12
        boardLayer.zPosition = 15
        fxLayer.zPosition = 30

        addChild(worldLayer)
        addChild(passengerLayer)
        addChild(parkedLayer)
        addChild(boardLayer)
        addChild(fxLayer)

        track = TrackGeometry(shape: engine.level.trackShape, offsetY: layout.trackOffsetY)
        drawThemeAndTrack()
        createParkingStrip()
        createPassengers()
        createBoard()
        createWaitingBubble()
        createTutorialHandIfNeeded()
        notifyHUD()
    }

    private func drawThemeAndTrack() {
        let theme = engine.level.theme
        let topH = layout.stripTop + 4
        let topColor: UIColor
        let bushDark: UIColor
        let bushLight: UIColor
        let hillColor: UIColor

        switch theme {
        case .park:
            topColor = UIColor(hex: 0x9ED972)
            hillColor = UIColor(hex: 0xB3E588, alpha: 0.75)
            bushDark = UIColor(hex: 0x4EA32A)
            bushLight = UIColor(hex: 0x67C73E)
        case .maple:
            topColor = UIColor(hex: 0xF2CF8A)
            hillColor = UIColor(hex: 0xFADDA2, alpha: 0.75)
            bushDark = UIColor(hex: 0xC4491D)
            bushLight = UIColor(hex: 0xED7626)
        case .city:
            topColor = UIColor(hex: 0xDFE8F5)
            hillColor = UIColor(hex: 0xE8F0FC, alpha: 0.8)
            bushDark = UIColor(hex: 0x5DBB42)
            bushLight = UIColor(hex: 0x7FE05B)
        }

        // Top backdrop
        let topBg = SKSpriteNode(color: topColor, size: CGSize(width: layout.width, height: topH))
        topBg.position = skPt(layout.width * 0.5, topH * 0.5)
        topBg.zPosition = 0
        worldLayer.addChild(topBg)

        // Subtle soft hill ellipses
        let hills: [(CGFloat, CGFloat, CGFloat, CGFloat)] = [
            (95, 145, 150, 90),
            (450, 210, 160, 96)
        ]
        for (ex, ey, ew, eh) in hills {
            let hill = SKShapeNode(ellipseOf: CGSize(width: ew, height: eh))
            hill.fillColor = hillColor
            hill.strokeColor = .clear
            hill.position = skPt(ex, ey + layout.trackOffsetY)
            hill.zPosition = 1
            worldLayer.addChild(hill)
        }

        if theme == .city {
            let linePath = CGMutablePath()
            var x: CGFloat = 0
            while x <= layout.width {
                linePath.move(to: skPt(x, 0))
                linePath.addLine(to: skPt(x, layout.stripTop))
                x += 36
            }
            var y: CGFloat = 0
            while y <= layout.stripTop {
                linePath.move(to: skPt(0, y))
                linePath.addLine(to: skPt(layout.width, y))
                y += 36
            }
            let gridNode = SKShapeNode(path: linePath)
            gridNode.strokeColor = UIColor(hex: 0xC8D6EB, alpha: 0.45)
            gridNode.lineWidth = 1
            gridNode.zPosition = 1
            worldLayer.addChild(gridNode)
        }

        // Bottom board zone backdrop
        let bottomH = layout.height - layout.stripBottom
        let bottomBg = SKSpriteNode(color: UIColor(hex: 0xC5D6EC), size: CGSize(width: layout.width, height: bottomH))
        bottomBg.position = skPt(layout.width * 0.5, layout.stripBottom + bottomH * 0.5)
        bottomBg.zPosition = 0
        worldLayer.addChild(bottomBg)

        // Scenery props (bushes & benches)
        let bushCoords: [(CGFloat, CGFloat)] = [(72, 286), (470, 286)]
        for (bx, by) in bushCoords {
            let c1 = SKShapeNode(circleOfRadius: 15)
            c1.fillColor = bushDark
            c1.strokeColor = .clear
            c1.position = skPt(bx, by + layout.trackOffsetY)
            c1.zPosition = 2
            let c2 = SKShapeNode(circleOfRadius: 12)
            c2.fillColor = bushLight
            c2.strokeColor = .clear
            c2.position = skPt(bx + 11, by + 3 + layout.trackOffsetY)
            c2.zPosition = 2.1
            worldLayer.addChild(c1)
            worldLayer.addChild(c2)
        }

        let propCoords: [(CGFloat, CGFloat)] = [(48, 240), (492, 240)]
        for (px, py) in propCoords {
            let prop = SKShapeNode(rectOf: CGSize(width: 48, height: 18), cornerRadius: 5)
            prop.fillColor = UIColor(hex: 0x5D8EC4)
            prop.strokeColor = .clear
            prop.position = skPt(px, py + layout.trackOffsetY)
            prop.zPosition = 2
            worldLayer.addChild(prop)
        }

        // Curved asphalt track
        let trackPath = CGMutablePath()
        if let first = track.points.first {
            trackPath.move(to: skPt(first.x, first.y))
            for pt in track.points.dropFirst() {
                trackPath.addLine(to: skPt(pt.x, pt.y))
            }
        }

        let borderStroke = SKShapeNode(path: trackPath)
        borderStroke.strokeColor = UIColor.white
        borderStroke.lineWidth = 60
        borderStroke.lineCap = .round
        borderStroke.lineJoin = .round
        borderStroke.zPosition = 3
        worldLayer.addChild(borderStroke)

        let roadStroke = SKShapeNode(path: trackPath)
        roadStroke.strokeColor = UIColor(hex: 0x6A7388)
        roadStroke.lineWidth = 52
        roadStroke.lineCap = .round
        roadStroke.lineJoin = .round
        roadStroke.zPosition = 4
        worldLayer.addChild(roadStroke)

        // Dashed center markings
        let dashPath = CGMutablePath()
        let pts = track.points
        var idx = 0
        while idx < pts.count - 2 {
            dashPath.move(to: skPt(pts[idx].x, pts[idx].y))
            dashPath.addLine(to: skPt(pts[idx + 1].x, pts[idx + 1].y))
            idx += 3
        }
        let dashNode = SKShapeNode(path: dashPath)
        dashNode.strokeColor = UIColor(hex: 0x9AA6BD, alpha: 0.45)
        dashNode.lineWidth = 2.5
        dashNode.zPosition = 4.5
        worldLayer.addChild(dashNode)

        // Front bus stop ramp
        let stopPad = SKShapeNode(rectOf: CGSize(width: 68, height: 54), cornerRadius: 12)
        stopPad.fillColor = UIColor(hex: 0x6A7388)
        stopPad.strokeColor = .clear
        stopPad.position = skPt(270, 300 + layout.trackOffsetY)
        stopPad.zPosition = 4.2
        worldLayer.addChild(stopPad)

        let markXs: [CGFloat] = [250, 270, 290]
        for sx in markXs {
            let mark = SKShapeNode(rectOf: CGSize(width: 12, height: 4), cornerRadius: 2)
            mark.fillColor = UIColor(hex: 0xFFD24D, alpha: 0.9)
            mark.strokeColor = .clear
            mark.position = skPt(sx, 310 + layout.trackOffsetY)
            mark.zPosition = 4.6
            worldLayer.addChild(mark)
        }
    }

    private func createParkingStrip() {
        let topTrim = SKSpriteNode(color: UIColor(hex: 0x9CA8BF), size: CGSize(width: layout.width, height: 8))
        topTrim.position = skPt(layout.width * 0.5, layout.stripTop + 4)
        topTrim.zPosition = 5
        worldLayer.addChild(topTrim)

        let asphalt = SKSpriteNode(color: UIColor(hex: 0x5B6478), size: CGSize(width: layout.width, height: 96))
        asphalt.position = skPt(layout.width * 0.5, layout.stripTop + 56)
        asphalt.zPosition = 5
        worldLayer.addChild(asphalt)

        let botTrim = SKSpriteNode(color: UIColor(hex: 0x3F4759), size: CGSize(width: layout.width, height: 4))
        botTrim.position = skPt(layout.width * 0.5, layout.stripTop + 106)
        botTrim.zPosition = 5
        worldLayer.addChild(botTrim)

        for i in 0..<GameConstants.totalParkingSlots {
            let sx = CGFloat(54 + i * 72)
            let node = SKNode()
            node.position = skPt(sx, layout.slotY)
            node.zPosition = 6
            node.name = "slot:\(i)"
            worldLayer.addChild(node)
            slotNodes.append(node)
        }
        refreshSlotVisuals()
    }

    private func refreshSlotVisuals() {
        let w: CGFloat = 44
        let h: CGFloat = 68
        let rad = slotTiltedRadians

        for i in 0..<slotNodes.count {
            guard let slot = engine.parkingLot.getSlot(i) else { continue }
            let node = slotNodes[i]
            node.removeAllChildren()

            if slot.kind == .vip {
                let box = SKShapeNode(rectOf: CGSize(width: w, height: h), cornerRadius: 9)
                box.fillColor = slot.unlocked ? UIColor(hex: 0x3B4760, alpha: 0.88) : UIColor(hex: 0x454C5E, alpha: 0.88)
                box.strokeColor = slot.unlocked ? UIColor(hex: 0xFFDF6B) : UIColor(hex: 0xFFBE2E)
                box.lineWidth = 2.5
                box.zRotation = rad
                box.zPosition = 0
                node.addChild(box)

                let lbl = SKLabelNode(text: "VIP")
                lbl.fontName = "AvenirNext-Bold"
                lbl.fontSize = 14
                lbl.fontColor = UIColor(hex: 0xFFD24D)
                lbl.verticalAlignmentMode = .center
                lbl.zRotation = rad + .pi * 0.5
                lbl.zPosition = 1
                node.addChild(lbl)
                continue
            }

            let box = SKShapeNode(rectOf: CGSize(width: w, height: h), cornerRadius: 9)
            if slot.unlocked {
                box.fillColor = UIColor(hex: 0x4B5366, alpha: 0.72)
                box.strokeColor = UIColor(hex: 0xCBD6EB, alpha: 0.75)
                box.lineWidth = 2.2
                box.zRotation = rad
                box.zPosition = 0
                node.addChild(box)
            } else {
                box.fillColor = UIColor(hex: 0x475063, alpha: 0.55)
                box.strokeColor = UIColor(hex: 0xA8B7D1, alpha: 0.55)
                box.lineWidth = 2.0
                box.zRotation = rad
                box.zPosition = 0
                node.addChild(box)

                let circle = SKShapeNode(circleOfRadius: 14)
                circle.fillColor = UIColor(hex: 0x34D349)
                circle.strokeColor = .white
                circle.lineWidth = 2
                circle.zPosition = 1
                circle.name = "slot:\(i)"
                let plus = SKLabelNode(text: "+")
                plus.fontName = "AvenirNext-Bold"
                plus.fontSize = 20
                plus.fontColor = .white
                plus.verticalAlignmentMode = .center
                plus.position = CGPoint(x: 0, y: 1)
                plus.zPosition = 2
                plus.name = "slot:\(i)"
                node.addChild(circle)
                node.addChild(plus)
            }
        }
    }

    private func createPassengers() {
        for sprite in passengerSprites.values {
            sprite.removeFromParent()
        }
        passengerSprites.removeAll()

        let queue = engine.passengerSystem.getQueue()
        for (i, p) in queue.enumerated() {
            let tex = VectorTextures.shared.passengerTexture(for: p.color)
            let sprite = SKSpriteNode(texture: tex, size: CGSize(width: 24, height: 28))
            let pt = track.getPassengerPosition(index: i)
            sprite.position = skPt(pt.x, pt.y)
            sprite.isHidden = i >= maxVisiblePassengers
            sprite.zPosition = pt.y * 0.1
            passengerLayer.addChild(sprite)
            passengerSprites[p.id] = sprite
        }
    }

    private func createWaitingBubble() {
        waitingBubble.removeFromParent()
        waitingBubble = SKNode()
        waitingBubble.isHidden = true
        waitingBubble.zPosition = 20

        let pill = SKShapeNode(circleOfRadius: 14)
        pill.fillColor = .white
        pill.strokeColor = UIColor(hex: 0x3B4863)
        pill.lineWidth = 2
        pill.zPosition = 0
        let icon = SKLabelNode(text: "⏳")
        icon.fontSize = 14
        icon.verticalAlignmentMode = .center
        icon.zPosition = 1
        waitingBubble.addChild(pill)
        waitingBubble.addChild(icon)
        fxLayer.addChild(waitingBubble)

        let bob = SKAction.sequence([
            SKAction.moveBy(x: 0, y: 6, duration: 0.55),
            SKAction.moveBy(x: 0, y: -6, duration: 0.55)
        ])
        bob.timingMode = .easeInEaseOut
        waitingBubble.run(SKAction.repeatForever(bob))
    }

    private func createBoard() {
        boardLayer.removeAllChildren()
        boardBusNodes.removeAll()

        let availH = max(320, layout.boardBottom - layout.boardTop - 24)
        let maxW: CGFloat = 476
        let maxH: CGFloat = min(460, availH)
        let cols = max(engine.level.gridSize.cols, 3)
        let rows = max(engine.level.gridSize.rows, 3)

        var minX = 0.0
        var maxX = Double(cols - 1)
        var minY = 0.0
        var maxY = Double(rows - 1)

        for b in engine.busSystem.getBoardBuses() {
            minX = min(minX, b.x - 0.95)
            maxX = max(maxX, b.x + 0.95)
            minY = min(minY, b.y - 0.95)
            maxY = max(maxY, b.y + 0.95)
        }
        for o in engine.busSystem.getObstacles() {
            minX = min(minX, o.x - 0.6)
            maxX = max(maxX, o.x + 0.6)
            minY = min(minY, o.y - 0.6)
            maxY = max(maxY, o.y + 0.6)
        }

        let spanX = max(CGFloat(cols), CGFloat(maxX - minX))
        let spanY = max(CGFloat(rows), CGFloat(maxY - minY))
        cellSize = min(92, floor(min(maxW / spanX, maxH / spanY)))

        let centerGX = CGFloat(minX + maxX) * 0.5
        let centerGY = CGFloat(minY + maxY) * 0.5
        boardOriginX = 270 - centerGX * cellSize
        boardOriginY = layout.boardCenterY - centerGY * cellSize

        for r in 0..<rows {
            for c in 0..<cols {
                let pt = gridToLogical(Double(c), Double(r))
                let dot = SKShapeNode(circleOfRadius: 3.5)
                dot.fillColor = UIColor(hex: 0x9FB3D1, alpha: 0.4)
                dot.strokeColor = .clear
                dot.position = skPt(pt.x, pt.y)
                dot.zPosition = 0
                boardLayer.addChild(dot)
            }
        }

        for obs in engine.busSystem.getObstacles() {
            let pt = gridToLogical(obs.x, obs.y)
            let w = CGFloat(obs.width ?? 0.86) * cellSize
            let h = CGFloat(obs.height ?? 0.86) * cellSize
            let sprite = SKSpriteNode(texture: VectorTextures.shared.woodCrate, size: CGSize(width: w, height: h))
            sprite.position = skPt(pt.x, pt.y)
            sprite.zRotation = -CGFloat((obs.angle ?? 0) * .pi / 180.0)
            sprite.zPosition = 2
            boardLayer.addChild(sprite)
        }

        for bus in engine.busSystem.getBoardBuses() {
            spawnBoardBus(bus)
        }
    }

    private func spawnBoardBus(_ bus: BusRuntime) {
        let logical = gridToLogical(bus.x, bus.y)
        let lenPx = CGFloat(bus.length ?? GameConstants.defaultBusLength) * cellSize
        let widPx = CGFloat(bus.width ?? GameConstants.defaultBusWidth) * cellSize

        let bodyTex = bus.unlocked ? VectorTextures.shared.busTexture(for: bus.color) : VectorTextures.shared.mysteryBus
        let body = SKSpriteNode(texture: bodyTex, size: CGSize(width: lenPx * 1.08, height: widPx * 1.15))
        body.zPosition = 0
        body.name = "bus:\(bus.id)"

        let arrow = SKSpriteNode(texture: VectorTextures.shared.arrowWhite, size: CGSize(width: 48 * (cellSize / 76) * 0.56, height: 34 * (cellSize / 76) * 0.56))
        arrow.position = CGPoint(x: -4, y: 0)
        arrow.zPosition = 1
        arrow.isHidden = !bus.unlocked
        arrow.name = "bus:\(bus.id)"

        let node = BoardBusNode(busId: bus.id, body: body, arrow: arrow)
        node.position = skPt(logical.x, logical.y)
        node.zRotation = bus.direction.spriteKitRadians
        node.zPosition = 5
        node.addChild(body)
        node.addChild(arrow)

        if !bus.unlocked {
            let dot = SKShapeNode(circleOfRadius: max(13, cellSize * 0.19))
            dot.fillColor = UIColor(hex: 0x1E293B, alpha: 0.92)
            dot.strokeColor = .white
            dot.lineWidth = 2.2
            dot.zRotation = -node.zRotation
            dot.zPosition = 2
            dot.name = "bus:\(bus.id)"

            let lbl = SKLabelNode(text: "\(bus.mysteryRemaining)")
            lbl.fontName = "AvenirNext-Bold"
            lbl.fontSize = round(cellSize * 0.24)
            lbl.fontColor = .white
            lbl.verticalAlignmentMode = .center
            lbl.zRotation = -node.zRotation
            lbl.zPosition = 3
            lbl.name = "bus:\(bus.id)"

            node.mysteryDot = dot
            node.mysteryLabel = lbl
            node.addChild(dot)
            node.addChild(lbl)
        }

        boardLayer.addChild(node)
        boardBusNodes[bus.id] = node
    }

    private func createTutorialHandIfNeeded() {
        tutorialHand?.removeFromParent()
        tutorialHand = nil
        guard engine.level.id <= 4 || engine.level.tutorialHint != nil else { return }
        guard let movable = engine.busSystem.getMovableBuses().first else { return }
        let pt = gridToLogical(movable.x, movable.y)
        let hand = SKSpriteNode(texture: VectorTextures.shared.tutorialHand, size: CGSize(width: 40, height: 42))
        hand.position = skPt(pt.x + 18, pt.y + 24)
        hand.zPosition = 28
        fxLayer.addChild(hand)
        tutorialHand = hand

        let tapAnim = SKAction.repeatForever(SKAction.sequence([
            SKAction.group([
                SKAction.move(to: skPt(pt.x + 8, pt.y + 12), duration: 0.42),
                SKAction.scale(to: 0.85, duration: 0.42)
            ]),
            SKAction.group([
                SKAction.move(to: skPt(pt.x + 18, pt.y + 24), duration: 0.42),
                SKAction.scale(to: 1.0, duration: 0.42)
            ])
        ]))
        hand.run(tapAnim)
    }

    private func dismissTutorial() {
        if let hand = tutorialHand {
            tutorialHand = nil
            hand.run(SKAction.sequence([SKAction.fadeOut(withDuration: 0.18), SKAction.removeFromParent()]))
        }
        gameDelegate?.gameSceneDidDismissTutorial()
    }

    // MARK: - Touch Handling

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard status == .playing, let touch = touches.first else { return }
        let location = touch.location(in: self)
        let hitNodes = nodes(at: location)

        for node in hitNodes {
            guard let name = node.name else { continue }
            if name.hasPrefix("bus:") {
                let busId = String(name.dropFirst(4))
                handleBoardBusTapped(busId)
                return
            }
            if name.hasPrefix("slot:") {
                if let idx = Int(name.dropFirst(5)),
                   let slot = engine.parkingLot.getSlot(idx),
                   !slot.unlocked && slot.kind == .extra {
                    SoundEngine.shared.playTap()
                    gameDelegate?.gameSceneDidRequestUnlockSlot(idx)
                }
                return
            }
        }
    }

    private func handleBoardBusTapped(_ busId: String) {
        guard status == .playing else { return }
        dismissTutorial()

        let result = engine.tapBus(busId)
        guard result.accepted, let slotIndex = result.slotIndex else {
            if let busNode = boardBusNodes[busId] {
                bumpAnimation(node: busNode, busId: busId)
            }
            SoundEngine.shared.playBump()
            switch result.reason {
            case .lockedMystery:
                let rem = engine.busSystem.getBus(busId)?.mysteryRemaining ?? 1
                gameDelegate?.gameSceneDidShowToast("Finish \(rem) more bus\(rem > 1 ? "es" : "") first!")
            case .lotFull:
                gameDelegate?.gameSceneDidShowToast("Parking lot is full! Unlock VIP or '+' slot!")
            case .blocked:
                gameDelegate?.gameSceneDidShowToast("Path blocked! Clear front vehicles first.")
            default:
                break
            }
            return
        }

        SoundEngine.shared.playDrive()
        SaveManager.shared.recordBusExited(1)
        notifyHUD()

        if let bus = engine.busSystem.getBus(busId) {
            animateBusExitingBoard(bus: bus, slotIndex: slotIndex)
        }
        refreshMysteryOverlays(newlyUnlocked: Set(result.newlyUnlockedIds))
    }

    private func bumpAnimation(node: BoardBusNode, busId: String) {
        guard let bus = engine.busSystem.getBus(busId) else { return }
        let v = bus.direction.unitVector
        let dx = CGFloat(v.x) * 8
        let dy = -CGFloat(v.y) * 8
        node.run(SKAction.sequence([
            SKAction.moveBy(x: dx, y: dy, duration: 0.06),
            SKAction.moveBy(x: -dx, y: -dy, duration: 0.08)
        ]))
        spawnDust(at: node.position, scale: 0.7)
    }

    private func refreshMysteryOverlays(newlyUnlocked: Set<String>) {
        for (id, node) in boardBusNodes {
            guard let bus = engine.busSystem.getBus(id), bus.type == .mystery else { continue }
            if newlyUnlocked.contains(id) {
                node.bodySprite.texture = VectorTextures.shared.busTexture(for: bus.color)
                node.arrowSprite.isHidden = false
                node.mysteryDot?.removeFromParent()
                node.mysteryLabel?.removeFromParent()
                node.mysteryDot = nil
                node.mysteryLabel = nil
                node.run(SKAction.sequence([SKAction.scale(to: 1.15, duration: 0.14), SKAction.scale(to: 1.0, duration: 0.12)]))
                spawnMiniConfetti(at: node.position, count: 10)
            } else if !bus.unlocked {
                node.mysteryLabel?.text = "\(bus.mysteryRemaining)"
            }
        }
    }

    private func animateBusExitingBoard(bus: BusRuntime, slotIndex: Int) {
        guard let node = boardBusNodes.removeValue(forKey: bus.id) else { return }
        let slotX = CGFloat(54 + slotIndex * 72)
        let slotPt = skPt(slotX, layout.slotY)
        let v = bus.direction.unitVector
        let stepOut = CGPoint(x: node.position.x + CGFloat(v.x) * 75, y: node.position.y - CGFloat(v.y) * 75)

        let parked = createParkedBusNode(bus: bus, at: node.position, rotation: node.zRotation)
        parkedLayer.addChild(parked)
        parkedBusNodes[bus.id] = parked
        node.removeFromParent()

        spawnDust(at: parked.position, scale: 0.9)

        let driveOut = SKAction.move(to: stepOut, duration: 0.14)
        driveOut.timingMode = .easeIn
        let targetRot = parkedBusRotationRadians
        let intoSlot = SKAction.group([
            SKAction.move(to: slotPt, duration: 0.28),
            SKAction.rotate(toAngle: targetRot, duration: 0.24, shortestUnitArc: true)
        ])
        intoSlot.timingMode = .easeOut

        parked.run(SKAction.sequence([driveOut, intoSlot])) { [weak self] in
            guard let self else { return }
            if var b = self.engine.busSystem.getBus(bus.id) {
                b.state = .parked
                self.engine.busSystem.updateBus(b)
            }
            parked.capBg.position = CGPoint(x: -24, y: 0)
            parked.capBg.zRotation = -targetRot
            parked.capBg.isHidden = false
            self.evaluateDeadlockState()
        }
    }

    private func createParkedBusNode(bus: BusRuntime, at pos: CGPoint, rotation: CGFloat, parkedImmediately: Bool = false) -> ParkedBusNode {
        let body = SKSpriteNode(texture: VectorTextures.shared.busTexture(for: bus.color), size: CGSize(width: 66, height: 36))
        body.zPosition = 0
        let capBg = SKShapeNode(rectOf: CGSize(width: 28, height: 18), cornerRadius: 7)
        capBg.fillColor = bus.color.style.dark
        capBg.strokeColor = .white
        capBg.lineWidth = 2
        capBg.position = CGPoint(x: -24, y: 0)
        capBg.zPosition = 2
        capBg.isHidden = !parkedImmediately

        let remaining = max(0, bus.capacity - bus.boarded)
        let capLbl = SKLabelNode(text: "\(remaining)")
        capLbl.fontName = "AvenirNext-Bold"
        capLbl.fontSize = 12
        capLbl.fontColor = .white
        capLbl.verticalAlignmentMode = .center
        capLbl.zPosition = 1
        capBg.addChild(capLbl)

        let node = ParkedBusNode(busId: bus.id, body: body, capBg: capBg, capLabel: capLbl)
        node.position = pos
        node.zRotation = rotation
        node.addChild(body)
        node.addChild(capBg)
        return node
    }

    // MARK: - Frame Loop

    override func update(_ currentTime: TimeInterval) {
        if lastUpdateTime == 0 {
            lastUpdateTime = currentTime
            return
        }
        let dt = min(0.05, currentTime - lastUpdateTime)
        lastUpdateTime = currentTime
        guard status == .playing else { return }

        updatePassengerPositions(dt: dt)
        updateBoardingLoop(dt: dt)
    }

    private func updatePassengerPositions(dt: TimeInterval) {
        let queue = engine.passengerSystem.getQueue()
        let alpha = CGFloat(1.0 - exp(-dt * 15.0))

        for (i, p) in queue.enumerated() {
            guard let sprite = passengerSprites[p.id] else { continue }
            if i >= maxVisiblePassengers {
                sprite.isHidden = true
                continue
            }
            let target = skPt(track.getPassengerPosition(index: i).x, track.getPassengerPosition(index: i).y)
            if sprite.isHidden {
                sprite.position = target
                sprite.isHidden = false
            } else {
                sprite.position.x += (target.x - sprite.position.x) * alpha
                sprite.position.y += (target.y - sprite.position.y) * alpha
            }
            sprite.zPosition = (layout.height - sprite.position.y) * 0.1
        }
    }

    private func updateBoardingLoop(dt: TimeInterval) {
        if engine.passengerSystem.isEmpty() {
            waitingBubble.isHidden = true
            return
        }

        let parked = engine.busSystem.getBuses().filter { $0.state == .parked }
        if engine.passengerSystem.findMatchingParkedBus(parked) == nil {
            noMatchElapsed += dt
            if let frontId = engine.passengerSystem.peekFront()?.id,
               let frontSprite = passengerSprites[frontId],
               noMatchElapsed > 0.45 && !parked.isEmpty {
                waitingBubble.position = CGPoint(x: frontSprite.position.x, y: frontSprite.position.y + 22)
                waitingBubble.isHidden = false
            } else {
                waitingBubble.isHidden = true
            }
            return
        }

        noMatchElapsed = 0
        waitingBubble.isHidden = true
        boardingTimer += dt
        guard boardingTimer >= boardingInterval else { return }
        boardingTimer = 0

        guard let res = engine.stepBoarding() else { return }
        SaveManager.shared.recordPassengersBoarded(1)
        animatePassengerBoard(passengerId: res.passenger.id, busId: res.busId, busFull: res.busFull)
    }

    private func animatePassengerBoard(passengerId: Int, busId: String, busFull: Bool) {
        let bus = engine.busSystem.getBus(busId)
        let parkedNode = parkedBusNodes[busId]

        if let sprite = passengerSprites.removeValue(forKey: passengerId) {
            if let target = parkedNode?.position {
                sprite.zPosition = 28
                let hop = SKAction.group([
                    SKAction.move(to: target, duration: 0.14),
                    SKAction.scale(to: 0.35, duration: 0.14),
                    SKAction.fadeAlpha(to: 0.25, duration: 0.14)
                ])
                hop.timingMode = .easeIn
                sprite.run(SKAction.sequence([hop, SKAction.removeFromParent()]))
            } else {
                sprite.removeFromParent()
            }
        }

        if let bus, let node = parkedNode {
            SoundEngine.shared.playBoard(comboIndex: bus.boarded)
            node.capLabel.text = "\(max(0, bus.capacity - bus.boarded))"
            node.bodySprite.run(SKAction.sequence([
                SKAction.scaleX(to: 1.08, y: 0.92, duration: 0.055),
                SKAction.scaleX(to: 1.0, y: 1.0, duration: 0.055)
            ]))
            if busFull {
                departParkedBus(bus: bus, node: node)
            }
        }
    }

    private func departParkedBus(bus: BusRuntime, node: ParkedBusNode) {
        var mutable = bus
        mutable.state = .departing
        let freedIdx = mutable.slotIndex
        mutable.slotIndex = nil
        engine.busSystem.updateBus(mutable)
        if let freedIdx {
            engine.parkingLot.freeSlot(freedIdx)
        }

        SoundEngine.shared.playDepart()
        spawnMiniConfetti(at: CGPoint(x: node.position.x, y: node.position.y + 18), count: 12)

        let driveAway = SKAction.group([
            SKAction.moveTo(x: 615, duration: 0.34),
            SKAction.rotate(toAngle: 0, duration: 0.22, shortestUnitArc: true)
        ])
        driveAway.timingMode = .easeIn

        node.run(SKAction.sequence([
            SKAction.scale(to: 1.1, duration: 0.08),
            SKAction.scale(to: 1.0, duration: 0.08),
            driveAway
        ])) { [weak self] in
            guard let self else { return }
            if var done = self.engine.busSystem.getBus(bus.id) {
                done.state = .departed
                self.engine.busSystem.updateBus(done)
            }
            node.removeFromParent()
            self.parkedBusNodes.removeValue(forKey: bus.id)
            self.evaluateDeadlockState()
        }
    }

    private func evaluateDeadlockState() {
        guard status == .playing else { return }
        let outcome = engine.evaluateOutcome()
        switch outcome {
        case .won:
            status = .won
            SaveManager.shared.flushStats()
            SoundEngine.shared.playWin()
            let stars = engine.calculateStars()
            let isEvent = engine.level.isEvent == true
            let coins = isEvent ? 80 : (engine.level.id % 5 == 0 ? 50 : 35)
            SaveManager.shared.recordLevelWin(levelId: engine.level.id, stars: stars, coinsEarned: coins, isEvent: isEvent)
            let hasNext = !isEvent
            spawnCelebrationConfetti()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.55) { [weak self] in
                self?.gameDelegate?.gameSceneDidWin(stars: stars, coinsEarned: coins, hasNextLevel: hasNext)
            }
        case .lostLotDeadlock, .lostBoardBlocked:
            status = .lost
            SaveManager.shared.flushStats()
            SoundEngine.shared.playLose()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { [weak self] in
                self?.gameDelegate?.gameSceneDidLose(outcome: outcome)
            }
        case .playing:
            break
        }
    }

    // MARK: - Actions from SwiftUI HUD / Modals

    func handleUndo() {
        guard status == .playing, engine.undo() else {
            SoundEngine.shared.playBump()
            return
        }
        SoundEngine.shared.playTap()
        rebuildVisualsFromEngine()
        notifyHUD()
        gameDelegate?.gameSceneDidShowToast("Move undone!")
    }

    func handleBooster(_ type: BoosterType) {
        guard status == .playing else { return }
        guard BoosterSystem.isUnlockedForLevel(type, level: engine.level) else {
            gameDelegate?.gameSceneDidShowToast("Unlocks at Level \(type.unlockLevel)!")
            return
        }
        guard SaveManager.shared.boosterCount(type) > 0 else {
            gameDelegate?.gameSceneDidRequestGetBooster(type)
            return
        }

        let res: BoosterActionResult
        switch type {
        case .vip:
            res = BoosterSystem.applyVip(engine)
            if res.success {
                SaveManager.shared.consumeBooster(.vip)
                refreshSlotVisuals()
                if let sv = slotNodes.first {
                    spawnMiniConfetti(at: sv.position, count: 16)
                }
            }
        case .arrange:
            res = BoosterSystem.applyArrange(engine)
            if res.success {
                SaveManager.shared.consumeBooster(.arrange)
                rebuildVisualsFromEngine()
                spawnMiniConfetti(at: skPt(270, layout.boardCenterY), count: 22)
            }
        case .jumble:
            res = BoosterSystem.applyJumble(engine)
            if res.success {
                SaveManager.shared.consumeBooster(.jumble)
                spawnMiniConfetti(at: skPt(270, 180 + layout.trackOffsetY), count: 18)
            }
        }

        if res.success {
            SoundEngine.shared.playBooster()
        } else {
            SoundEngine.shared.playBump()
        }
        notifyHUD()
        gameDelegate?.gameSceneDidShowToast(res.message)
    }

    func unlockExtraSlot(_ index: Int) {
        let res = BoosterSystem.applyUnlockExtraSlot(engine, preferredIndex: index)
        if res.success {
            SoundEngine.shared.playBooster()
            refreshSlotVisuals()
            if index < slotNodes.count {
                spawnMiniConfetti(at: slotNodes[index].position, count: 14)
            }
            gameDelegate?.gameSceneDidShowToast(res.message)
        }
    }

    func handleRevive() {
        status = .playing
        let slotRes = BoosterSystem.applyUnlockExtraSlot(engine)
        if slotRes.success {
            refreshSlotVisuals()
            gameDelegate?.gameSceneDidShowToast("Extra parking slot unlocked! Keep going!")
        } else {
            let parked = engine.busSystem.getBuses().filter { $0.state == .parked }
            engine.passengerSystem.jumbleSegments(preferredFrontColor: parked.first?.color)
            gameDelegate?.gameSceneDidShowToast("Passengers jumbled!")
        }
        SoundEngine.shared.playBooster()
        notifyHUD()
    }

    func restart(with level: LevelConfig) {
        engine = GameEngine(level: level)
        status = .playing
        boardingTimer = 0
        noMatchElapsed = 0
        setupScene()
    }

    private func rebuildVisualsFromEngine() {
        for n in boardBusNodes.values { n.removeAllActions(); n.removeFromParent() }
        boardBusNodes.removeAll()
        for n in parkedBusNodes.values { n.removeAllActions(); n.removeFromParent() }
        parkedBusNodes.removeAll()

        refreshSlotVisuals()
        createPassengers()
        createBoard()

        for var bus in engine.busSystem.getBuses() {
            if bus.state == .drivingToSlot {
                bus.state = .parked
                engine.busSystem.updateBus(bus)
            }
            if bus.state == .parked, let slotIdx = bus.slotIndex {
                let pt = skPt(CGFloat(54 + slotIdx * 72), layout.slotY)
                let rad = parkedBusRotationRadians
                let parked = createParkedBusNode(bus: bus, at: pt, rotation: rad, parkedImmediately: true)
                parked.capBg.zRotation = -rad
                parkedLayer.addChild(parked)
                parkedBusNodes[bus.id] = parked
            }
        }
    }

    private func notifyHUD() {
        gameDelegate?.gameSceneDidUpdateHUD(canUndo: engine.canUndo(), undoRemaining: engine.getUndoRemaining())
    }

    // MARK: - Particles

    private func spawnDust(at pos: CGPoint, scale: CGFloat) {
        for _ in 0..<4 {
            let puff = SKSpriteNode(texture: VectorTextures.shared.dustPuff, size: CGSize(width: 14 * scale, height: 14 * scale))
            puff.position = CGPoint(x: pos.x + CGFloat.random(in: -10...10), y: pos.y + CGFloat.random(in: -8...8))
            puff.alpha = 0.75
            fxLayer.addChild(puff)
            puff.run(SKAction.sequence([
                SKAction.group([
                    SKAction.scale(to: 1.9, duration: 0.28),
                    SKAction.fadeOut(withDuration: 0.28)
                ]),
                SKAction.removeFromParent()
            ]))
        }
    }

    private func spawnMiniConfetti(at pos: CGPoint, count: Int) {
        let colors = BusColor.allCases.map { $0.style.main }
        for i in 0..<count {
            let piece = SKSpriteNode(texture: VectorTextures.shared.confettiPiece, size: CGSize(width: 10, height: 6))
            piece.color = colors[i % colors.count]
            piece.colorBlendFactor = 1.0
            piece.position = pos
            fxLayer.addChild(piece)
            let dx = CGFloat.random(in: -48...48)
            let dy = CGFloat.random(in: 12...75)
            piece.run(SKAction.sequence([
                SKAction.group([
                    SKAction.moveBy(x: dx, y: dy, duration: 0.48),
                    SKAction.rotate(byAngle: CGFloat.random(in: -4...4), duration: 0.48),
                    SKAction.fadeOut(withDuration: 0.48)
                ]),
                SKAction.removeFromParent()
            ]))
        }
    }

    private func spawnCelebrationConfetti() {
        let colors = BusColor.allCases.map { $0.style.main }
        for i in 0..<44 {
            let piece = SKSpriteNode(texture: VectorTextures.shared.confettiPiece, size: CGSize(width: 11, height: 7))
            piece.color = colors[i % colors.count]
            piece.colorBlendFactor = 1.0
            piece.position = CGPoint(x: CGFloat.random(in: 24...516), y: layout.height + CGFloat.random(in: 10...60))
            fxLayer.addChild(piece)
            let fall = SKAction.group([
                SKAction.moveTo(y: 40, duration: Double.random(in: 0.9...1.7)),
                SKAction.moveBy(x: CGFloat.random(in: -70...70), y: 0, duration: 1.3),
                SKAction.rotate(byAngle: CGFloat.random(in: -6...6), duration: 1.3),
                SKAction.fadeOut(withDuration: 1.6)
            ])
            piece.run(SKAction.sequence([SKAction.wait(forDuration: Double(i) * 0.02), fall, SKAction.removeFromParent()]))
        }
    }
}
