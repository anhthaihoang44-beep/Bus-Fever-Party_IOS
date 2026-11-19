import { SaveManager } from '../utils/SaveManager';

/**
 * Lightweight Web Audio synthesizer for crisp tactile SFX + optional mobile haptics.
 * Requires zero external audio files and respects user Sound/Vibration preferences.
 */
export class SoundManager {
  private static ctx: AudioContext | null = null;

  private static getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const save = SaveManager.load();
    if (!save.settings.soundEnabled) return null;

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public static vibrate(pattern: number | number[]): void {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
      return;
    }
    const save = SaveManager.load();
    if (!save.settings.vibrationEnabled) return;
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore unsupported environments
    }
  }

  public static playTap(): void {
    this.tone(540, 720, 0.06, 'sine', 0.12);
  }

  public static playDrive(): void {
    this.tone(240, 480, 0.14, 'triangle', 0.11);
  }

  public static playBump(): void {
    this.tone(150, 75, 0.14, 'sawtooth', 0.14);
    this.vibrate(35);
  }

  public static playBoard(streakIndex = 0): void {
    const pentatonic = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    const freq = pentatonic[streakIndex % pentatonic.length];
    this.tone(freq, freq * 1.15, 0.065, 'sine', 0.1);
  }

  public static playDepart(): void {
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((f, idx) => {
      this.tone(f, f * 1.04, 0.11, 'triangle', 0.12, idx * 0.06);
    });
  }

  public static playBooster(): void {
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((f, idx) => {
      this.tone(f, f * 1.06, 0.1, 'sine', 0.11, idx * 0.05);
    });
  }

  public static playCoin(): void {
    this.tone(987.77, 1318.51, 0.12, 'sine', 0.12);
  }

  public static playWin(): void {
    const chord = [523.25, 659.25, 783.99, 1046.5];
    chord.forEach((f, idx) => {
      this.tone(f, f, 0.28, 'triangle', 0.13, idx * 0.08);
    });
    this.vibrate([30, 40, 60]);
  }

  public static playFail(): void {
    const notes = [330, 293.66, 246.94];
    notes.forEach((f, idx) => {
      this.tone(f, f * 0.94, 0.18, 'sawtooth', 0.09, idx * 0.12);
    });
    this.vibrate([45, 35, 70]);
  }

  private static tone(
    freqStart: number,
    freqEnd: number,
    durationSec: number,
    type: OscillatorType,
    volume: number,
    delaySec = 0,
  ): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + durationSec);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  }
}
