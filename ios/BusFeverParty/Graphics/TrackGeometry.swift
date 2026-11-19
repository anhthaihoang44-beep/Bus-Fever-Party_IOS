import CoreGraphics
import Foundation

struct TrackSample {
    var x: CGFloat
    var y: CGFloat
    var tx: CGFloat
    var ty: CGFloat
    var nx: CGFloat
    var ny: CGFloat
}

/// Uniform arc-length Catmull-Rom track sampler parameterized in logical top-down [0..540] coordinates.
final class TrackGeometry {
    let shape: TrackShape
    let points: [TrackSample]
    let totalLength: CGFloat
    private let cumulativeDist: [CGFloat]

    init(shape: TrackShape, offsetY: CGFloat = 0) {
        self.shape = shape
        let raw = Self.buildControlSamples(shape).map { CGPoint(x: $0.x, y: $0.y + offsetY) }

        var dists: [CGFloat] = [0]
        var samples: [TrackSample] = []
        var acc: CGFloat = 0

        for i in 0..<raw.count {
            let p = raw[i]
            if i > 0 {
                let prev = raw[i - 1]
                acc += hypot(p.x - prev.x, p.y - prev.y)
                dists.append(acc)
            }
            let pPrev = raw[max(0, i - 1)]
            let pNext = raw[min(raw.count - 1, i + 1)]
            let dx = pNext.x - pPrev.x
            let dy = pNext.y - pPrev.y
            let len = max(0.0001, hypot(dx, dy))
            let tx = dx / len
            let ty = dy / len
            samples.append(TrackSample(x: p.x, y: p.y, tx: tx, ty: ty, nx: -ty, ny: tx))
        }

        self.cumulativeDist = dists
        self.points = samples
        self.totalLength = acc
    }

    func sampleAt(s: CGFloat, lateralOffset: CGFloat = 0) -> TrackSample {
        if s <= 0 {
            let first = points[0]
            return TrackSample(
                x: first.x + first.nx * lateralOffset,
                y: first.y + first.ny * lateralOffset,
                tx: first.tx, ty: first.ty, nx: first.nx, ny: first.ny
            )
        }
        if s >= totalLength {
            let last = points[points.count - 1]
            let extra = s - totalLength
            return TrackSample(
                x: last.x + last.tx * extra + last.nx * lateralOffset,
                y: last.y + last.ty * extra + last.ny * lateralOffset,
                tx: last.tx, ty: last.ty, nx: last.nx, ny: last.ny
            )
        }

        var lo = 0
        var hi = cumulativeDist.count - 1
        while lo < hi - 1 {
            let mid = (lo + hi) >> 1
            if cumulativeDist[mid] <= s {
                lo = mid
            } else {
                hi = mid
            }
        }

        let d0 = cumulativeDist[lo]
        let d1 = cumulativeDist[hi]
        let t = d1 > d0 ? (s - d0) / (d1 - d0) : 0
        let a = points[lo]
        let b = points[hi]
        let x = a.x + (b.x - a.x) * t
        let y = a.y + (b.y - a.y) * t
        let tx = a.tx + (b.tx - a.tx) * t
        let ty = a.ty + (b.ty - a.ty) * t
        let norm = max(0.0001, hypot(tx, ty))
        let ux = tx / norm
        let uy = ty / norm
        let nx = -uy
        let ny = ux
        return TrackSample(x: x + nx * lateralOffset, y: y + ny * lateralOffset, tx: ux, ty: uy, nx: nx, ny: ny)
    }

    func getPassengerPosition(index: Int) -> CGPoint {
        let col = index % 2
        let row = index / 2
        let s = CGFloat(row) * 22.0 + CGFloat(col) * 5.0
        let lateral: CGFloat = col == 0 ? -11.0 : 11.0
        let pt = sampleAt(s: s, lateralOffset: lateral)
        return CGPoint(x: pt.x, y: pt.y)
    }

    private static func buildControlSamples(_ shape: TrackShape) -> [CGPoint] {
        let anchors: [CGPoint]
        switch shape {
        case .heart:
            anchors = [
                CGPoint(x: 266, y: 292), CGPoint(x: 214, y: 268), CGPoint(x: 144, y: 234),
                CGPoint(x: 102, y: 178), CGPoint(x: 118, y: 120), CGPoint(x: 180, y: 102),
                CGPoint(x: 242, y: 128), CGPoint(x: 270, y: 162), CGPoint(x: 302, y: 128),
                CGPoint(x: 368, y: 102), CGPoint(x: 432, y: 124), CGPoint(x: 486, y: 106),
                CGPoint(x: 562, y: 74)
            ]
        case .snake:
            anchors = [
                CGPoint(x: 268, y: 292), CGPoint(x: 204, y: 272), CGPoint(x: 124, y: 256),
                CGPoint(x: 96, y: 212), CGPoint(x: 146, y: 176), CGPoint(x: 248, y: 180),
                CGPoint(x: 356, y: 196), CGPoint(x: 428, y: 172), CGPoint(x: 422, y: 124),
                CGPoint(x: 344, y: 106), CGPoint(x: 234, y: 112), CGPoint(x: 148, y: 106),
                CGPoint(x: 208, y: 80), CGPoint(x: 356, y: 80), CGPoint(x: 486, y: 80),
                CGPoint(x: 562, y: 74)
            ]
        case .figure8:
            anchors = [
                CGPoint(x: 268, y: 292), CGPoint(x: 332, y: 268), CGPoint(x: 404, y: 242),
                CGPoint(x: 426, y: 188), CGPoint(x: 374, y: 144), CGPoint(x: 286, y: 168),
                CGPoint(x: 208, y: 218), CGPoint(x: 132, y: 232), CGPoint(x: 96, y: 182),
                CGPoint(x: 124, y: 124), CGPoint(x: 208, y: 108), CGPoint(x: 312, y: 112),
                CGPoint(x: 422, y: 110), CGPoint(x: 500, y: 90), CGPoint(x: 562, y: 74)
            ]
        case .ring:
            anchors = [
                CGPoint(x: 268, y: 292), CGPoint(x: 202, y: 272), CGPoint(x: 130, y: 248),
                CGPoint(x: 96, y: 196), CGPoint(x: 112, y: 138), CGPoint(x: 178, y: 108),
                CGPoint(x: 274, y: 106), CGPoint(x: 372, y: 118), CGPoint(x: 446, y: 114),
                CGPoint(x: 506, y: 92), CGPoint(x: 562, y: 74)
            ]
        }
        return catmullRomChain(anchors, subdivisions: 16)
    }

    private static func catmullRomChain(_ anchors: [CGPoint], subdivisions: Int) -> [CGPoint] {
        var out: [CGPoint] = []
        for i in 0..<(anchors.count - 1) {
            let p0 = anchors[max(0, i - 1)]
            let p1 = anchors[i]
            let p2 = anchors[i + 1]
            let p3 = anchors[min(anchors.count - 1, i + 2)]
            let steps = i == anchors.count - 2 ? subdivisions + 1 : subdivisions

            for s in 0..<steps {
                let t = CGFloat(s) / CGFloat(subdivisions)
                let t2 = t * t
                let t3 = t2 * t
                let x = 0.5 * (
                    2 * p1.x +
                    (-p0.x + p2.x) * t +
                    (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
                    (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
                )
                let y = 0.5 * (
                    2 * p1.y +
                    (-p0.y + p2.y) * t +
                    (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
                    (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
                )
                out.append(CGPoint(x: x, y: y))
            }
        }
        return out
    }
}
