import SpriteKit
import UIKit

/// Procedural Retina vector texture generator for buses, passengers, obstacles, arrows, confetti, and tutorial hand.
final class VectorTextures {
    static let shared = VectorTextures()

    private var busCache: [BusColor: SKTexture] = [:]
    private var passengerCache: [BusColor: SKTexture] = [:]
    private(set) lazy var mysteryBus: SKTexture = makeMysteryBusTexture()
    private(set) lazy var woodCrate: SKTexture = makeObstacleTexture()
    private(set) lazy var arrowWhite: SKTexture = makeArrowTexture()
    private(set) lazy var tutorialHand: SKTexture = makeTutorialHandTexture()
    private(set) lazy var dustPuff: SKTexture = makeDustTexture()
    private(set) lazy var confettiPiece: SKTexture = makeConfettiTexture()

    private init() {}

    func busTexture(for color: BusColor) -> SKTexture {
        if let hit = busCache[color] { return hit }
        let tex = makeBusTexture(style: color.style)
        busCache[color] = tex
        return tex
    }

    func passengerTexture(for color: BusColor) -> SKTexture {
        if let hit = passengerCache[color] { return hit }
        let tex = makePassengerTexture(style: color.style)
        passengerCache[color] = tex
        return tex
    }

    private func renderTexture(size: CGSize, draw: (CGContext) -> Void) -> SKTexture {
        let fmt = UIGraphicsImageRendererFormat()
        fmt.scale = 3.0
        fmt.opaque = false
        let renderer = UIGraphicsImageRenderer(size: size, format: fmt)
        let img = renderer.image { ctx in
            draw(ctx.cgContext)
        }
        let tex = SKTexture(image: img)
        tex.filteringMode = .linear
        return tex
    }

    private func fillRoundedRect(_ cg: CGContext, rect: CGRect, radius: CGFloat, color: UIColor) {
        cg.setFillColor(color.cgColor)
        let path = UIBezierPath(roundedRect: rect, cornerRadius: radius)
        cg.addPath(path.cgPath)
        cg.fillPath()
    }

    private func strokeRoundedRect(_ cg: CGContext, rect: CGRect, radius: CGFloat, color: UIColor, width: CGFloat) {
        cg.setStrokeColor(color.cgColor)
        cg.setLineWidth(width)
        let path = UIBezierPath(roundedRect: rect, cornerRadius: radius)
        cg.addPath(path.cgPath)
        cg.strokePath()
    }

    private func makeBusTexture(style: BusColor.Style) -> SKTexture {
        renderTexture(size: CGSize(width: 136, height: 88)) { cg in
            // Drop shadow
            fillRoundedRect(cg, rect: CGRect(x: 8, y: 20, width: 120, height: 64), radius: 16, color: UIColor(white: 0, alpha: 0.16))

            // 4 dark wheels
            let wheelColor = UIColor(hex: 0x1F2736)
            for rect in [
                CGRect(x: 20, y: 10, width: 22, height: 10),
                CGRect(x: 92, y: 10, width: 22, height: 10),
                CGRect(x: 20, y: 74, width: 22, height: 10),
                CGRect(x: 92, y: 74, width: 22, height: 10)
            ] {
                fillRoundedRect(cg, rect: rect, radius: 4, color: wheelColor)
            }

            // Base dark skirt & main body (front points +X right)
            fillRoundedRect(cg, rect: CGRect(x: 8, y: 17, width: 120, height: 62), radius: 16, color: style.dark)
            fillRoundedRect(cg, rect: CGRect(x: 8, y: 13, width: 120, height: 60), radius: 16, color: style.main)
            fillRoundedRect(cg, rect: CGRect(x: 18, y: 19, width: 92, height: 48), radius: 12, color: style.light)

            // Front panoramic windshield (+X right edge)
            let glass = UIColor(hex: 0x1E2E48)
            fillRoundedRect(cg, rect: CGRect(x: 104, y: 20, width: 17, height: 46), radius: 6, color: glass)
            fillRoundedRect(cg, rect: CGRect(x: 111, y: 24, width: 6, height: 18), radius: 3, color: UIColor(hex: 0x89C6FF, alpha: 0.6))

            // Rear window & side strips
            fillRoundedRect(cg, rect: CGRect(x: 12, y: 26, width: 8, height: 34), radius: 4, color: UIColor(hex: 0x243654))
            fillRoundedRect(cg, rect: CGRect(x: 26, y: 15, width: 72, height: 5), radius: 2, color: glass)
            fillRoundedRect(cg, rect: CGRect(x: 26, y: 66, width: 72, height: 5), radius: 2, color: glass)

            // Headlights
            let bulb = UIColor(hex: 0xFFF3A8)
            fillRoundedRect(cg, rect: CGRect(x: 122, y: 22, width: 6, height: 10), radius: 3, color: bulb)
            fillRoundedRect(cg, rect: CGRect(x: 122, y: 54, width: 6, height: 10), radius: 3, color: bulb)
        }
    }

    private func makeMysteryBusTexture() -> SKTexture {
        renderTexture(size: CGSize(width: 136, height: 88)) { cg in
            fillRoundedRect(cg, rect: CGRect(x: 8, y: 20, width: 120, height: 64), radius: 16, color: UIColor(white: 0, alpha: 0.16))
            fillRoundedRect(cg, rect: CGRect(x: 8, y: 15, width: 120, height: 60), radius: 16, color: UIColor(hex: 0x5C6475))
            fillRoundedRect(cg, rect: CGRect(x: 8, y: 12, width: 120, height: 58), radius: 16, color: UIColor(hex: 0x8C96AA))
            fillRoundedRect(cg, rect: CGRect(x: 14, y: 18, width: 108, height: 46), radius: 12, color: UIColor(hex: 0x737D91))
            strokeRoundedRect(cg, rect: CGRect(x: 14, y: 18, width: 108, height: 46), radius: 12, color: UIColor(hex: 0xCED7E6, alpha: 0.7), width: 2.5)
        }
    }

    private func makeObstacleTexture() -> SKTexture {
        renderTexture(size: CGSize(width: 72, height: 72)) { cg in
            fillRoundedRect(cg, rect: CGRect(x: 4, y: 6, width: 64, height: 64), radius: 12, color: UIColor(hex: 0x8F5E38))
            fillRoundedRect(cg, rect: CGRect(x: 4, y: 2, width: 64, height: 62), radius: 12, color: UIColor(hex: 0xCC9866))
            fillRoundedRect(cg, rect: CGRect(x: 10, y: 8, width: 52, height: 50), radius: 8, color: UIColor(hex: 0xE6B98A))

            cg.setStrokeColor(UIColor(hex: 0xA36F43).cgColor)
            cg.setLineWidth(4)
            cg.move(to: CGPoint(x: 14, y: 12))
            cg.addLine(to: CGPoint(x: 58, y: 54))
            cg.move(to: CGPoint(x: 58, y: 12))
            cg.addLine(to: CGPoint(x: 14, y: 54))
            cg.strokePath()
            strokeRoundedRect(cg, rect: CGRect(x: 10, y: 8, width: 52, height: 50), radius: 8, color: UIColor(hex: 0x99653C), width: 3)
        }
    }

    private func makePassengerTexture(style: BusColor.Style) -> SKTexture {
        renderTexture(size: CGSize(width: 34, height: 40)) { cg in
            // Shadow
            cg.setFillColor(UIColor(white: 0, alpha: 0.18).cgColor)
            cg.fillEllipse(in: CGRect(x: 5, y: 31, width: 24, height: 8))

            // Torso
            fillRoundedRect(cg, rect: CGRect(x: 6, y: 18, width: 22, height: 18), radius: 9, color: style.dark)
            fillRoundedRect(cg, rect: CGRect(x: 6, y: 16, width: 22, height: 16), radius: 9, color: style.main)

            // Head
            cg.setFillColor(style.main.cgColor)
            cg.fillEllipse(in: CGRect(x: 7, y: 3, width: 20, height: 20))
            cg.setStrokeColor(UIColor(white: 1, alpha: 0.55).cgColor)
            cg.setLineWidth(1.5)
            cg.strokeEllipse(in: CGRect(x: 7, y: 3, width: 20, height: 20))

            // Highlight
            cg.setFillColor(style.light.withAlphaComponent(0.75).cgColor)
            cg.fillEllipse(in: CGRect(x: 9.5, y: 5, width: 8, height: 6))

            // Eyes & smile
            let darkFace = UIColor(hex: 0x1F2736)
            cg.setFillColor(darkFace.cgColor)
            cg.fillEllipse(in: CGRect(x: 12.2, y: 11.2, width: 2.8, height: 2.8))
            cg.fillEllipse(in: CGRect(x: 19.0, y: 11.2, width: 2.8, height: 2.8))

            cg.setStrokeColor(darkFace.cgColor)
            cg.setLineWidth(1.8)
            cg.setLineCap(.round)
            cg.move(to: CGPoint(x: 13.5, y: 16.5))
            cg.addQuadCurve(to: CGPoint(x: 20.5, y: 16.5), control: CGPoint(x: 17, y: 19))
            cg.strokePath()
        }
    }

    private func makeArrowTexture() -> SKTexture {
        renderTexture(size: CGSize(width: 48, height: 34)) { cg in
            cg.setFillColor(UIColor.white.cgColor)
            cg.beginPath()
            cg.move(to: CGPoint(x: 4, y: 11))
            cg.addLine(to: CGPoint(x: 24, y: 11))
            cg.addLine(to: CGPoint(x: 24, y: 3))
            cg.addLine(to: CGPoint(x: 44, y: 17))
            cg.addLine(to: CGPoint(x: 24, y: 31))
            cg.addLine(to: CGPoint(x: 24, y: 23))
            cg.addLine(to: CGPoint(x: 4, y: 23))
            cg.closePath()
            cg.fillPath()
        }
    }

    private func makeTutorialHandTexture() -> SKTexture {
        renderTexture(size: CGSize(width: 60, height: 64)) { cg in
            fillRoundedRect(cg, rect: CGRect(x: 18, y: 6, width: 12, height: 28), radius: 6, color: .white)
            fillRoundedRect(cg, rect: CGRect(x: 14, y: 24, width: 32, height: 28), radius: 12, color: .white)
            strokeRoundedRect(cg, rect: CGRect(x: 14, y: 24, width: 32, height: 28), radius: 12, color: UIColor(hex: 0x2E4369), width: 3)
            strokeRoundedRect(cg, rect: CGRect(x: 18, y: 6, width: 12, height: 28), radius: 6, color: UIColor(hex: 0x2E4369), width: 3)
        }
    }

    private func makeDustTexture() -> SKTexture {
        renderTexture(size: CGSize(width: 24, height: 24)) { cg in
            cg.setFillColor(UIColor(white: 1, alpha: 0.78).cgColor)
            cg.fillEllipse(in: CGRect(x: 2, y: 2, width: 20, height: 20))
        }
    }

    private func makeConfettiTexture() -> SKTexture {
        renderTexture(size: CGSize(width: 12, height: 8)) { cg in
            fillRoundedRect(cg, rect: CGRect(x: 0, y: 0, width: 12, height: 8), radius: 2, color: .white)
        }
    }
}
