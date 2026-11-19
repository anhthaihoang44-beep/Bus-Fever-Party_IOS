import AVFoundation
import Foundation
import UIKit

/// Procedural AVAudioEngine synthesizer & native UIKit haptic feedback engine (zero external audio files needed).
final class SoundEngine {
    static let shared = SoundEngine()

    private let engine = AVAudioEngine()
    private let player = AVAudioPlayerNode()
    private let format: AVAudioFormat?
    private let queue = DispatchQueue(label: "com.busfever.sound", qos: .userInitiated)
    private var engineReady = false

    private init() {
        self.format = AVAudioFormat(standardFormatWithSampleRate: 44_100, channels: 1)
    }

    private func prepareIfNeeded() -> Bool {
        guard SaveManager.shared.data.settings.soundEnabled, let fmt = format else { return false }
        if !engineReady {
            do {
                let session = AVAudioSession.sharedInstance()
                try session.setCategory(.ambient, mode: .default, options: [.mixWithOthers])
                try session.setActive(true)
                engine.attach(player)
                engine.connect(player, to: engine.mainMixerNode, format: fmt)
                try engine.start()
                player.play()
                engineReady = true
            } catch {
                return false
            }
        } else if !engine.isRunning {
            try? engine.start()
            player.play()
        }
        return true
    }

    private enum Wave {
        case sine, triangle, square
    }

    private func tone(startFreq: Double, endFreq: Double, duration: Double, wave: Wave, gain: Double) {
        queue.async { [weak self] in
            guard let self, self.prepareIfNeeded(), let fmt = self.format else { return }
            let sr = fmt.sampleRate
            let frameCount = AVAudioFrameCount(max(1, Int(sr * duration)))
            guard let buf = AVAudioPCMBuffer(pcmFormat: fmt, frameCapacity: frameCount) else { return }
            buf.frameLength = frameCount
            guard let samples = buf.floatChannelData?[0] else { return }

            var phase = 0.0
            let total = Int(frameCount)
            for i in 0..<total {
                let t = Double(i) / Double(max(1, total - 1))
                let freq = startFreq + (endFreq - startFreq) * t
                phase += (2.0 * .pi * freq) / sr
                let env = pow(1.0 - t, 1.4)
                let raw: Double
                switch wave {
                case .sine:
                    raw = sin(phase)
                case .triangle:
                    raw = 2.0 * abs(2.0 * ((phase / (2.0 * .pi)).truncatingRemainder(dividingBy: 1.0)) - 1.0) - 1.0
                case .square:
                    raw = sin(phase) >= 0 ? 1.0 : -1.0
                }
                samples[i] = Float(raw * env * gain)
            }
            self.player.scheduleBuffer(buf, completionHandler: nil)
        }
    }

    func playTap() {
        tone(startFreq: 540, endFreq: 720, duration: 0.06, wave: .sine, gain: 0.14)
        hapticLight()
    }

    func playDrive() {
        tone(startFreq: 240, endFreq: 480, duration: 0.14, wave: .triangle, gain: 0.12)
    }

    func playBump() {
        tone(startFreq: 160, endFreq: 85, duration: 0.12, wave: .square, gain: 0.10)
        hapticError()
    }

    func playBoard(comboIndex: Int = 0) {
        let freq = min(980, 440 + Double(comboIndex) * 28)
        tone(startFreq: freq, endFreq: freq * 1.18, duration: 0.055, wave: .sine, gain: 0.11)
    }

    func playDepart() {
        tone(startFreq: 523.25, endFreq: 659.25, duration: 0.10, wave: .triangle, gain: 0.13)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.07) {
            self.tone(startFreq: 659.25, endFreq: 783.99, duration: 0.14, wave: .triangle, gain: 0.13)
        }
        hapticSuccess()
    }

    func playWin() {
        let notes: [Double] = [523.25, 659.25, 783.99, 1046.5]
        for (i, n) in notes.enumerated() {
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(i) * 0.09) {
                self.tone(startFreq: n, endFreq: n * 1.04, duration: 0.18, wave: .triangle, gain: 0.15)
            }
        }
        hapticSuccess()
    }

    func playLose() {
        let notes: [Double] = [340, 280, 210]
        for (i, n) in notes.enumerated() {
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(i) * 0.11) {
                self.tone(startFreq: n, endFreq: n * 0.88, duration: 0.16, wave: .triangle, gain: 0.12)
            }
        }
        hapticError()
    }

    func playBooster() {
        tone(startFreq: 420, endFreq: 940, duration: 0.18, wave: .sine, gain: 0.15)
        hapticMedium()
    }

    func playCoin() {
        tone(startFreq: 988, endFreq: 1318, duration: 0.10, wave: .sine, gain: 0.12)
        hapticLight()
    }

    private func hapticLight() {
        guard SaveManager.shared.data.settings.vibrationEnabled else { return }
        DispatchQueue.main.async {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
        }
    }

    private func hapticMedium() {
        guard SaveManager.shared.data.settings.vibrationEnabled else { return }
        DispatchQueue.main.async {
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        }
    }

    private func hapticSuccess() {
        guard SaveManager.shared.data.settings.vibrationEnabled else { return }
        DispatchQueue.main.async {
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        }
    }

    private func hapticError() {
        guard SaveManager.shared.data.settings.vibrationEnabled else { return }
        DispatchQueue.main.async {
            UINotificationFeedbackGenerator().notificationOccurred(.error)
        }
    }
}
