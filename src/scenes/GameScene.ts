import Phaser from 'phaser';
import { SoundManager } from '../audio/SoundManager';
import {
  DIRECTION_VECTORS,
  directionToRadians,
} from '../systems/BusSystem';
import { BoosterSystem } from '../systems/BoosterSystem';
import { GameEngine } from '../systems/GameEngine';
import {
  COLOR_PALETTE,
  TOTAL_PARKING_SLOTS,
  type BoosterType,
  type BusRuntime,
  type GameStatus,
  type LevelConfig,
  type ThemeId,
} from '../types/game';
import { LevelLoader } from '../utils/LevelLoader';
import {
  applyHiDpiCamera,
  createCrispText,
  getGameLayoutMetrics,
  type GameLayoutMetrics,
} from '../utils/ResponsiveLayout';
import { SaveManager } from '../utils/SaveManager';
import { TextureFactory } from '../utils/TextureFactory';
import { TrackGeometry } from '../utils/TrackGeometry';
import type { UIScene } from './UIScene';

interface BoardBusVisual {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Image;
  arrow: Phaser.GameObjects.Image;
  mysteryText?: Phaser.GameObjects.Text;
  isAnimating: boolean;
}

interface ParkedBusVisual {
  busId: string;
  slotIndex: number;
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Image;
  capPill: Phaser.GameObjects.Graphics;
  capText: Phaser.GameObjects.Text;
}

interface SlotVisual {
  index: number;
  x: number;
  y: number;
  angleDeg: number;
  graphics: Phaser.GameObjects.Graphics;
  label?: Phaser.GameObjects.Text;
  plusBadge?: Phaser.GameObjects.Container;
}

const SLOT_ANGLE_DEG = -12;
const BOARDING_INTERVAL_MS = 75;
const MAX_VISIBLE_PASSENGERS = 68;
const LOSE_SETTLE_DELAY_MS = 450;

/**
 * Responsive gameplay scene managing the Top Passenger Loop, Middle Parking Strip,
 * and Bottom Parking Jam Board via GameEngine.
 */
export class GameScene extends Phaser.Scene {
  private level!: LevelConfig;
  private layout!: GameLayoutMetrics;
  private engine!: GameEngine;
  private track!: TrackGeometry;
  private status: GameStatus = 'playing';

  private boardVisuals: Map<string, BoardBusVisual> = new Map();
  private parkedVisuals: Map<string, ParkedBusVisual> = new Map();
  private passengerSprites: Map<number, Phaser.GameObjects.Image> = new Map();
  private slotVisuals: SlotVisual[] = [];

  private boardContainer!: Phaser.GameObjects.Container;
  private passengerLayer!: Phaser.GameObjects.Layer;
  private parkingLayer!: Phaser.GameObjects.Layer;
  private fxLayer!: Phaser.GameObjects.Layer;
  private waitingBubble!: Phaser.GameObjects.Container;
  private toastText!: Phaser.GameObjects.Text;

  private cellSize = 68;
  private boardOriginX = 270;
  private boardOriginY = 640;
  private boardingTimerMs = 0;
  private noMatchElapsedMs = 0;
  private loseCheckTimerMs = 0;
  private pendingLoseModal = false;

  constructor() {
    super({ key: 'GameScene' });
  }

  public init(data?: { levelId?: number; isEvent?: boolean }): void {
    const levelId = data?.levelId ?? 1;
    const loaded = data?.isEvent
      ? LevelLoader.getEventLevel(levelId)
      : LevelLoader.getLevel(levelId);
    if (!loaded) {
      throw new Error(`Level ${levelId} not found`);
    }
    this.level = loaded;
  }

  public create(): void {
    const metrics = applyHiDpiCamera(this);
    this.layout = getGameLayoutMetrics(metrics);
    TextureFactory.ensureAll(this);

    this.status = 'playing';
    this.boardVisuals.clear();
    this.parkedVisuals.clear();
    this.passengerSprites.clear();
    this.slotVisuals = [];
    this.boardingTimerMs = 0;
    this.noMatchElapsedMs = 0;
    this.loseCheckTimerMs = 0;
    this.pendingLoseModal = false;

    this.engine = new GameEngine(this.level);
    this.track = new TrackGeometry(this.level.trackShape, this.layout.trackOffsetY);

    this.drawThemeAndTrack();
    this.createParkingStrip();

    this.passengerLayer = this.add.layer().setDepth(10);
    this.parkingLayer = this.add.layer().setDepth(20);
    this.boardContainer = this.add.container(0, 0).setDepth(30);
    this.fxLayer = this.add.layer().setDepth(40);

    this.createPassengers();
    this.createWaitingBubble();
    this.createBoard();
    this.createToast();

    if (this.scene.isActive('UIScene')) {
      this.scene.stop('UIScene');
    }
    this.scene.launch('UIScene', { gameScene: this });
  }

  public getLayout(): GameLayoutMetrics {
    return this.layout;
  }

  public getLevel(): LevelConfig {
    return this.level;
  }

  public getEngine(): GameEngine {
    return this.engine;
  }

  public getUIScene(): UIScene | undefined {
    return this.scene.isActive('UIScene')
      ? (this.scene.get('UIScene') as UIScene)
      : undefined;
  }

  public setPaused(paused: boolean): void {
    if (this.status === 'won' || this.status === 'lost') return;
    this.status = paused ? 'paused' : 'playing';
  }

  public update(_time: number, delta: number): void {
    if (this.status !== 'playing') return;

    this.updatePassengerPositions(delta);
    this.updateBoardingLoop(delta);
    this.evaluateOutcomeTick(delta);
  }

  private evaluateOutcomeTick(delta: number): void {
    const outcome = this.engine.evaluateOutcome();

    if (outcome === 'won') {
      this.status = 'won';
      this.waitingBubble.setVisible(false);
      SaveManager.flushStats();
      const stars = this.engine.calculateStars();
      const coinsEarned = 20 + stars * 5;
      SaveManager.recordLevelWin(
        this.level.id,
        stars,
        coinsEarned,
        Boolean(this.level.isEvent),
      );
      const hasNext = !this.level.isEvent;

      this.time.delayedCall(350, () => {
        SoundManager.playWin();
        this.getUIScene()?.showWinModal(stars, coinsEarned, hasNext);
      });
      return;
    }

    if (outcome === 'lost_lot_deadlock' || outcome === 'lost_board_blocked') {
      if (!this.pendingLoseModal) {
        this.loseCheckTimerMs += delta;
        if (this.loseCheckTimerMs >= LOSE_SETTLE_DELAY_MS) {
          this.pendingLoseModal = true;
          this.status = 'lost';
          SaveManager.flushStats();
          SoundManager.playFail();
          this.getUIScene()?.showFailModal(outcome);
        }
      }
    } else {
      this.loseCheckTimerMs = 0;
      this.pendingLoseModal = false;
    }
  }

  public handleUndo(): void {
    if (this.status !== 'playing') return;
    if (!this.engine.canUndo()) {
      this.showToast(
        this.engine.getUndoRemaining() <= 0 ? 'No undos left!' : 'Nothing to undo!',
      );
      return;
    }

    const ok = this.engine.undo();
    if (!ok) return;

    SoundManager.playTap();
    this.loseCheckTimerMs = 0;
    this.pendingLoseModal = false;
    this.rebuildVisualsFromEngine();
    this.getUIScene()?.syncHeader();
    this.showToast('Move undone!');
  }

  public handleRevive(): void {
    this.loseCheckTimerMs = 0;
    this.pendingLoseModal = false;
    this.status = 'playing';

    if (!this.engine.parkingLot.isVipUnlocked()) {
      this.engine.parkingLot.unlockVipSlot();
      this.refreshSlotVisuals();
      this.showToast('VIP slot unlocked!');
    } else if (this.engine.parkingLot.hasLockedExtraSlot()) {
      this.engine.parkingLot.unlockExtraSlot();
      this.refreshSlotVisuals();
      this.showToast('Extra slot unlocked!');
    } else {
      const parked = this.engine.busSystem
        .getBuses()
        .filter((b) => b.state === 'parked');
      const prefer = parked[0]?.color ?? null;
      this.engine.passengerSystem.jumbleSegments(prefer);
      this.showToast('Passengers jumbled!');
    }

    SoundManager.playBooster();
    this.engine.markBoosterUsed();
    this.getUIScene()?.syncHeader();
    this.getUIScene()?.syncBoosterBar();
  }

  public handleBooster(type: BoosterType): void {
    if (this.status !== 'playing') return;

    if (!BoosterSystem.isUnlockedForLevel(type, this.level)) {
      this.showToast(`Unlocks at Level ${BoosterSystem.getUnlockLevel(type)}!`);
      return;
    }

    const save = SaveManager.load();
    if ((save.boosterCounts[type] ?? 0) <= 0) {
      this.getUIScene()?.showGetBoosterModal(type);
      return;
    }

    let res;
    if (type === 'vip') {
      res = BoosterSystem.applyVip(this.engine);
      if (res.success) {
        SaveManager.consumeBooster('vip');
        this.refreshSlotVisuals();
        this.spawnMiniConfetti(this.slotVisuals[0].x, this.slotVisuals[0].y, 16);
      }
    } else if (type === 'arrange') {
      res = BoosterSystem.applyArrange(this.engine);
      if (res.success) {
        SaveManager.consumeBooster('arrange');
        this.rebuildVisualsFromEngine();
        this.spawnMiniConfetti(270, this.layout.boardCenterY, 22);
      }
    } else {
      res = BoosterSystem.applyJumble(this.engine);
      if (res.success) {
        SaveManager.consumeBooster('jumble');
        this.spawnMiniConfetti(270, 180 + this.layout.trackOffsetY, 18);
      }
    }

    if (res.success) {
      SoundManager.playBooster();
    } else {
      SoundManager.playBump();
    }
    this.showToast(res.message);
    this.getUIScene()?.syncHeader();
    this.getUIScene()?.syncBoosterBar();
  }

  public unlockExtraParkingSlot(slotIndex: number): void {
    const res = BoosterSystem.applyUnlockExtraSlot(this.engine, slotIndex);
    if (res.success) {
      SoundManager.playBooster();
      this.refreshSlotVisuals();
      const sv = this.slotVisuals[slotIndex];
      if (sv) {
        this.spawnMiniConfetti(sv.x, sv.y, 14);
      }
      this.showToast(res.message);
    }
  }

  public goToHome(): void {
    SaveManager.flushStats();
    if (this.scene.isActive('UIScene')) {
      this.scene.stop('UIScene');
    }
    this.scene.start('HomeScene');
  }

  public restartLevel(): void {
    SaveManager.flushStats();
    this.scene.restart({
      levelId: this.level.id,
      isEvent: this.level.isEvent,
    });
  }

  public goToNextLevel(): void {
    const next = LevelLoader.getLevel(this.level.id + 1);
    if (next) {
      this.scene.restart({ levelId: next.id });
    } else {
      this.restartLevel();
    }
  }

  public getFirstMovableBusScreenPos(): { x: number; y: number } | null {
    const movable = this.engine.busSystem.getMovableBuses()[0];
    if (!movable) return null;
    return this.gridToScreen(movable.x, movable.y);
  }

  private rebuildVisualsFromEngine(): void {
    this.tweens.killAll();

    for (const vis of this.boardVisuals.values()) {
      vis.container.destroy();
    }
    this.boardVisuals.clear();

    for (const vis of this.parkedVisuals.values()) {
      vis.container.destroy();
    }
    this.parkedVisuals.clear();

    for (const sprite of this.passengerSprites.values()) {
      sprite.destroy();
    }
    this.passengerSprites.clear();

    this.boardContainer.removeAll(true);

    this.refreshSlotVisuals();
    this.createPassengers();
    this.createBoard();

    for (const bus of this.engine.busSystem.getBuses()) {
      if (bus.state === 'driving_to_slot') {
        bus.state = 'parked';
      }
      if (bus.state === 'parked' && bus.slotIndex !== null) {
        this.spawnParkedBusImmediate(bus, bus.slotIndex);
      }
    }

    this.tweens.add({
      targets: this.waitingBubble,
      y: 252 + this.layout.trackOffsetY,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private refreshSlotVisuals(): void {
    for (const sv of this.slotVisuals) {
      this.redrawSlotVisual(sv);
    }
  }

  private drawThemeAndTrack(): void {
    const theme: ThemeId = this.level.theme;
    const { width, height, stripTop, stripBottom, trackOffsetY, boosterDockTop } = this.layout;
    const g = this.add.graphics().setDepth(0);

    // Top zone backdrop from y=0 down to stripTop
    const topH = stripTop + 4;
    if (theme === 'park') {
      g.fillStyle(0x9ed972, 1);
      g.fillRect(0, 0, width, topH);
      g.fillStyle(0xb3e588, 0.7);
      g.fillEllipse(90, 140 + trackOffsetY, 140, 90);
      g.fillEllipse(455, 210 + trackOffsetY, 150, 95);
    } else if (theme === 'maple') {
      g.fillStyle(0xf2cf8a, 1);
      g.fillRect(0, 0, width, topH);
      g.fillStyle(0xf7dc9e, 0.75);
      g.fillEllipse(100, 150 + trackOffsetY, 150, 95);
      g.fillEllipse(445, 220 + trackOffsetY, 160, 100);
    } else {
      g.fillStyle(0xdce6f2, 1);
      g.fillRect(0, 0, width, topH);
      g.lineStyle(1, 0xc7d4e6, 0.65);
      for (let x = 0; x <= width; x += 36) {
        g.lineBetween(x, 0, x, topH);
      }
      for (let y = 0; y <= topH; y += 36) {
        g.lineBetween(0, y, width, y);
      }
    }

    this.drawThemeDecorations(g, theme, trackOffsetY);
    this.drawTrackRoad(g, theme, trackOffsetY);

    // Bottom board backdrop extending smoothly to very bottom of screen
    g.fillStyle(0xc5d6ec, 1);
    g.fillRect(0, stripBottom, width, height - stripBottom);

    // Booster bar dock anchored nicely above safeBottom
    g.fillStyle(0xa5bad8, 0.55);
    g.fillRoundedRect(20, boosterDockTop, 500, 92, 22);
  }

  private drawThemeDecorations(
    g: Phaser.GameObjects.Graphics,
    theme: ThemeId,
    oy: number,
  ): void {
    const drawBush = (bx: number, by: number, leafColor: number) => {
      g.fillStyle(0x0f2035, 0.14);
      g.fillEllipse(bx, by + 10, 42, 16);
      g.fillStyle(leafColor, 1);
      g.fillCircle(bx - 10, by, 13);
      g.fillCircle(bx + 10, by + 2, 12);
      g.fillCircle(bx, by - 7, 14);
    };

    if (theme === 'city') {
      for (const sx of [28, 490]) {
        g.fillStyle(0x0f2035, 0.14);
        g.fillRoundedRect(sx - 18, 250 + oy, 44, 18, 6);
        g.fillStyle(0x6995c9, 1);
        g.fillRoundedRect(sx - 20, 224 + oy, 44, 28, 6);
        g.fillStyle(0x9bc4f2, 0.85);
        g.fillRoundedRect(sx - 15, 228 + oy, 34, 8, 3);
      }
      drawBush(64, 294 + oy, 0x62bd58);
      drawBush(476, 294 + oy, 0x62bd58);
    } else if (theme === 'park') {
      drawBush(42, 120 + oy, 0x4ca848);
      drawBush(48, 282 + oy, 0x5cc454);
      drawBush(492, 276 + oy, 0x4ca848);
      drawBush(498, 178 + oy, 0x67cf5d);
    } else {
      drawBush(42, 124 + oy, 0xd95f2b);
      drawBush(48, 282 + oy, 0xe88b2e);
      drawBush(492, 276 + oy, 0xc94228);
      drawBush(498, 178 + oy, 0xe88b2e);
    }
  }

  private drawTrackRoad(
    g: Phaser.GameObjects.Graphics,
    theme: ThemeId,
    oy: number,
  ): void {
    const curbColor = theme === 'city' ? 0xf2f6fc : 0xe9efe0;
    const pts = this.track.points;

    g.lineStyle(62, curbColor, 1);
    if (this.level.trackShape === 'ring') {
      g.strokeEllipse(270, 190 + oy, 326, 166);
    }
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      g.lineTo(pts[i].x, pts[i].y);
    }
    g.strokePath();
    g.fillStyle(curbColor, 1);
    g.fillRoundedRect(230, 270 + oy, 80, 56, 16);

    g.lineStyle(50, 0x6a7388, 1);
    if (this.level.trackShape === 'ring') {
      g.strokeEllipse(270, 190 + oy, 326, 166);
    }
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      g.lineTo(pts[i].x, pts[i].y);
    }
    g.strokePath();

    g.fillStyle(0x6a7388, 1);
    g.fillRoundedRect(236, 274 + oy, 68, 56, 12);

    g.fillStyle(0xffd24d, 0.85);
    g.fillRoundedRect(244, 308 + oy, 12, 4, 2);
    g.fillRoundedRect(264, 308 + oy, 12, 4, 2);
    g.fillRoundedRect(284, 308 + oy, 12, 4, 2);

    g.lineStyle(2.5, 0x9aa6bd, 0.42);
    for (let i = 0; i < pts.length - 2; i += 3) {
      g.lineBetween(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
    }
  }

  private createParkingStrip(): void {
    const { width, stripTop, slotY } = this.layout;
    const stripGfx = this.add.graphics().setDepth(5);
    stripGfx.fillStyle(0x9ca8bf, 1);
    stripGfx.fillRect(0, stripTop, width, 8);
    stripGfx.fillStyle(0x5b6478, 1);
    stripGfx.fillRect(0, stripTop + 8, width, 96);
    stripGfx.fillStyle(0x3f4759, 1);
    stripGfx.fillRect(0, stripTop + 104, width, 4);

    const startX = 54;
    const stepX = 72;
    for (let i = 0; i < TOTAL_PARKING_SLOTS; i++) {
      const sx = startX + i * stepX;
      const gfx = this.add.graphics({ x: sx, y: slotY }).setDepth(6);
      gfx.setAngle(SLOT_ANGLE_DEG);

      const sv: SlotVisual = {
        index: i,
        x: sx,
        y: slotY,
        angleDeg: SLOT_ANGLE_DEG,
        graphics: gfx,
      };
      this.slotVisuals.push(sv);
      this.redrawSlotVisual(sv);
    }
  }

  private redrawSlotVisual(sv: SlotVisual): void {
    const slot = this.engine.parkingLot.getSlot(sv.index);
    if (!slot) return;

    const g = sv.graphics;
    g.clear();
    sv.label?.destroy();
    sv.label = undefined;
    sv.plusBadge?.destroy();
    sv.plusBadge = undefined;

    const w = 44;
    const h = 68;

    if (slot.kind === 'vip') {
      const strokeColor = slot.unlocked ? 0xffdf6b : 0xffbe2e;
      g.fillStyle(slot.unlocked ? 0x3b4760 : 0x454c5e, 0.85);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, 9);
      g.lineStyle(2.5, strokeColor, 0.95);
      this.strokeDashedRoundedRect(g, -w / 2, -h / 2, w, h);

      sv.label = createCrispText(this, sv.x, sv.y, 'VIP', {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#ffd24d',
      })
        .setOrigin(0.5)
        .setAngle(sv.angleDeg - 90)
        .setDepth(7);
      return;
    }

    if (slot.unlocked) {
      g.fillStyle(0x4b5366, 0.7);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, 9);
      g.lineStyle(2.2, 0xcbd6eb, 0.72);
      g.strokeRoundedRect(-w / 2, -h / 2, w, h, 9);
    } else {
      g.fillStyle(0x475063, 0.55);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, 9);
      g.lineStyle(2, 0xa8b7d1, 0.55);
      g.strokeRoundedRect(-w / 2, -h / 2, w, h, 9);

      const badge = this.add.container(sv.x, sv.y).setDepth(7);
      const circle = this.add.circle(0, 0, 14, 0x34d349).setStrokeStyle(2, 0xffffff);
      const plus = createCrispText(this, 0, -1, '+', {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: '19px',
        fontStyle: 'bold',
        color: '#ffffff',
      }).setOrigin(0.5);
      badge.add([circle, plus]);
      badge.setSize(42, 62);
      badge.setInteractive({ useHandCursor: true });
      badge.on('pointerdown', () => {
        if (this.status !== 'playing') return;
        SoundManager.playTap();
        this.getUIScene()?.showUnlockSlotModal(sv.index);
      });
      sv.plusBadge = badge;
    }
  }

  private strokeDashedRoundedRect(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    const dash = 7;
    const gap = 5;
    for (let dx = x + 4; dx < x + w - 4; dx += dash + gap) {
      g.lineBetween(dx, y, Math.min(dx + dash, x + w - 4), y);
      g.lineBetween(dx, y + h, Math.min(dx + dash, x + w - 4), y + h);
    }
    for (let dy = y + 4; dy < y + h - 4; dy += dash + gap) {
      g.lineBetween(x, dy, x, Math.min(dy + dash, y + h - 4));
      g.lineBetween(x + w, dy, x + w, Math.min(dy + dash, y + h - 4));
    }
  }

  private createPassengers(): void {
    const queue = this.engine.passengerSystem.getQueue();
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i];
      const pos = this.track.getPassengerPosition(i);
      const sprite = this.add.image(pos.x, pos.y, `passenger-${p.color}`);
      sprite.setDisplaySize(26, 26);
      sprite.setVisible(i < MAX_VISIBLE_PASSENGERS);
      sprite.setDepth(pos.y);
      this.passengerLayer.add(sprite);
      this.passengerSprites.set(p.id, sprite);
    }
  }

  private createWaitingBubble(): void {
    const baseY = 258 + this.layout.trackOffsetY;
    const bubble = this.add.container(268, baseY).setDepth(19).setVisible(false);
    const pill = this.add.circle(0, 0, 14, 0xffffff).setStrokeStyle(2, 0x3b4863);
    const face = createCrispText(this, 0, 0, '⏳', { fontSize: '14px' }).setOrigin(0.5);
    bubble.add([pill, face]);
    this.waitingBubble = bubble;

    this.tweens.add({
      targets: bubble,
      y: baseY - 6,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private updatePassengerPositions(delta: number): void {
    const queue = this.engine.passengerSystem.getQueue();
    const lerpAlpha = 1 - Math.exp(-delta * 0.015);

    for (let i = 0; i < queue.length; i++) {
      const p = queue[i];
      const sprite = this.passengerSprites.get(p.id);
      if (!sprite) continue;

      if (i >= MAX_VISIBLE_PASSENGERS) {
        sprite.setVisible(false);
        continue;
      }

      const target = this.track.getPassengerPosition(i);
      if (!sprite.visible) {
        sprite.setPosition(target.x, target.y);
        sprite.setVisible(true);
      } else {
        sprite.x = Phaser.Math.Linear(sprite.x, target.x, lerpAlpha);
        sprite.y = Phaser.Math.Linear(sprite.y, target.y, lerpAlpha);
      }
      sprite.setDepth(sprite.y);
    }
  }

  private updateBoardingLoop(delta: number): void {
    if (this.engine.passengerSystem.isEmpty()) {
      this.waitingBubble.setVisible(false);
      return;
    }

    const parkedBuses = this.engine.busSystem
      .getBuses()
      .filter((b) => b.state === 'parked');

    const matching = this.engine.passengerSystem.findMatchingParkedBus(parkedBuses);
    if (!matching) {
      this.noMatchElapsedMs += delta;
      const frontSprite = this.passengerSprites.get(
        this.engine.passengerSystem.peekFront()?.id ?? -1,
      );
      if (frontSprite && this.noMatchElapsedMs > 450 && parkedBuses.length > 0) {
        this.waitingBubble.setPosition(frontSprite.x, frontSprite.y - 22);
        this.waitingBubble.setVisible(true);
      } else {
        this.waitingBubble.setVisible(false);
      }
      return;
    }

    this.noMatchElapsedMs = 0;
    this.waitingBubble.setVisible(false);
    this.boardingTimerMs += delta;

    if (this.boardingTimerMs < BOARDING_INTERVAL_MS) return;
    this.boardingTimerMs = 0;

    const result = this.engine.stepBoarding();
    if (!result) return;

    SaveManager.recordPassengersBoarded(1);
    this.animatePassengerBoard(result.passenger.id, result.busId, result.busFull);
  }

  private animatePassengerBoard(
    passengerId: number,
    busId: string,
    busFull: boolean,
  ): void {
    const sprite = this.passengerSprites.get(passengerId);
    const bus = this.engine.busSystem.getBus(busId);
    const parkedVisual = this.parkedVisuals.get(busId);

    if (sprite) {
      this.passengerSprites.delete(passengerId);
      if (parkedVisual) {
        this.fxLayer.add(sprite);
        sprite.setDepth(45);
        const startX = sprite.x;
        const startY = sprite.y;
        const targetX = parkedVisual.container.x;
        const targetY = parkedVisual.container.y - 8;

        this.spawnDustPuff(startX, startY, 0.55);

        this.tweens.add({
          targets: sprite,
          x: (startX + targetX) * 0.5,
          y: Math.min(startY, targetY) - 24,
          displayWidth: 30,
          displayHeight: 30,
          duration: 95,
          ease: 'Quad.easeOut',
          onComplete: () => {
            this.tweens.add({
              targets: sprite,
              x: targetX,
              y: targetY,
              displayWidth: 10,
              displayHeight: 10,
              alpha: 0.2,
              duration: 95,
              ease: 'Quad.easeIn',
              onComplete: () => sprite.destroy(),
            });
          },
        });
      } else {
        sprite.destroy();
      }
    }

    if (bus && parkedVisual) {
      SoundManager.playBoard(bus.boarded);
      const remaining = Math.max(0, bus.capacity - bus.boarded);
      parkedVisual.capText.setText(`${remaining}`);

      this.tweens.killTweensOf(parkedVisual.body);
      parkedVisual.body.setDisplaySize(66, 36);
      this.tweens.add({
        targets: parkedVisual.body,
        displayWidth: 71,
        displayHeight: 33.5,
        duration: 60,
        yoyo: true,
      });

      if (busFull) {
        this.departParkedBus(bus, parkedVisual);
      }
    }
  }

  private departParkedBus(bus: BusRuntime, visual: ParkedBusVisual): void {
    bus.state = 'departing';
    SoundManager.playDepart();
    this.spawnMiniConfetti(visual.container.x, visual.container.y - 18, 12);

    const slotIdx = bus.slotIndex;
    bus.slotIndex = null;
    if (slotIdx !== null) {
      this.engine.parkingLot.freeSlot(slotIdx);
    }

    const puffTimer = this.time.addEvent({
      delay: 55,
      repeat: 5,
      callback: () => {
        if (!visual.container.scene) return;
        this.spawnDustPuff(visual.container.x - 16, visual.container.y + 12, 0.7);
      },
    });

    this.tweens.add({
      targets: visual.container,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 90,
      yoyo: true,
      onComplete: () => {
        if (!visual.container.scene) {
          puffTimer.remove();
          bus.state = 'departed';
          return;
        }
        this.tweens.add({
          targets: visual.container,
          x: 610,
          angle: 0,
          duration: 340,
          ease: 'Cubic.easeIn',
          onComplete: () => {
            puffTimer.remove();
            bus.state = 'departed';
            visual.container.destroy();
            this.parkedVisuals.delete(bus.id);
          },
        });
      },
    });
  }

  private createToast(): void {
    this.toastText = createCrispText(this, 270, this.layout.stripBottom + 8, '', {
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: '17px',
      fontStyle: 'bold',
      color: '#ffffff',
      backgroundColor: '#25314ad9',
      padding: { x: 16, y: 8 },
    })
      .setOrigin(0.5)
      .setDepth(60)
      .setAlpha(0);
  }

  public showToast(msg: string): void {
    const baseY = this.layout.stripBottom + 8;
    this.tweens.killTweensOf(this.toastText);
    this.toastText.setText(msg).setAlpha(1).setY(baseY);
    this.tweens.add({
      targets: this.toastText,
      alpha: 0,
      y: baseY - 18,
      delay: 900,
      duration: 280,
    });
  }

  private createBoard(): void {
    const { boardTop, boardBottom, boardCenterY } = this.layout;
    const availH = Math.max(320, boardBottom - boardTop - 24);
    const maxBoardW = 476;
    const maxBoardH = Math.min(460, availH);
    const cols = Math.max(this.level.gridSize.cols, 3);
    const rows = Math.max(this.level.gridSize.rows, 3);

    let minX = 0;
    let maxX = cols - 1;
    let minY = 0;
    let maxY = rows - 1;

    for (const b of this.engine.busSystem.getBoardBuses()) {
      minX = Math.min(minX, b.x - 0.95);
      maxX = Math.max(maxX, b.x + 0.95);
      minY = Math.min(minY, b.y - 0.95);
      maxY = Math.max(maxY, b.y + 0.95);
    }
    for (const o of this.engine.busSystem.getObstacles()) {
      minX = Math.min(minX, o.x - 0.6);
      maxX = Math.max(maxX, o.x + 0.6);
      minY = Math.min(minY, o.y - 0.6);
      maxY = Math.max(maxY, o.y + 0.6);
    }

    const spanX = Math.max(cols, maxX - minX);
    const spanY = Math.max(rows, maxY - minY);
    this.cellSize = Math.min(92, Math.floor(Math.min(maxBoardW / spanX, maxBoardH / spanY)));

    const centerGridX = (minX + maxX) * 0.5;
    const centerGridY = (minY + maxY) * 0.5;
    this.boardOriginX = 270 - centerGridX * this.cellSize;
    this.boardOriginY = boardCenterY - centerGridY * this.cellSize;

    const gridGfx = this.add.graphics();
    gridGfx.fillStyle(0x9fb3d1, 0.36);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const pt = this.gridToScreen(c, r);
        gridGfx.fillCircle(pt.x, pt.y, 3.5);
      }
    }
    this.boardContainer.add(gridGfx);

    for (const obs of this.engine.busSystem.getObstacles()) {
      const pos = this.gridToScreen(obs.x, obs.y);
      const sprite = this.add.image(pos.x, pos.y, 'obstacle-wood');
      const obsW = (obs.width ?? 0.86) * this.cellSize;
      const obsH = (obs.height ?? 0.86) * this.cellSize;
      sprite.setDisplaySize(obsW, obsH);
      sprite.setAngle(obs.angle ?? 0);
      this.boardContainer.add(sprite);
    }

    for (const bus of this.engine.busSystem.getBoardBuses()) {
      this.spawnBoardBusVisual(bus);
    }
  }

  private spawnBoardBusVisual(bus: BusRuntime): void {
    const pos = this.gridToScreen(bus.x, bus.y);
    const container = this.add.container(pos.x, pos.y);

    const busLenPx = (bus.length ?? 1.66) * this.cellSize;
    const busWidPx = (bus.width ?? 0.78) * this.cellSize;

    const texKey = bus.unlocked ? `bus-${bus.color}` : 'bus-mystery';
    const body = this.add.image(0, 0, texKey);
    body.setDisplaySize(busLenPx * 1.08, busWidPx * 1.15);

    const arrow = this.add.image(-4, -2, 'arrow-white');
    // Texture is 2x oversampled (136x88), so divide base scale by 2
    arrow.setScale((this.cellSize / 76) * 0.34);
    arrow.setVisible(bus.unlocked);

    container.rotation = directionToRadians(bus.direction);
    container.add([body, arrow]);

    let mysteryText: Phaser.GameObjects.Text | undefined;
    if (!bus.unlocked) {
      mysteryText = createCrispText(this, 0, -1, `${bus.mysteryRemaining}`, {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: `${Math.round(this.cellSize * 0.36)}px`,
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#242b3d',
        strokeThickness: 4,
      }).setOrigin(0.5);
      mysteryText.rotation = -container.rotation;
      container.add(mysteryText);
    }

    const hitW = Math.max(busLenPx, 58);
    const hitH = Math.max(busWidPx, 52);
    container.setSize(hitW, hitH);
    container.setInteractive({ useHandCursor: true });

    container.on('pointerdown', () => {
      this.onBusTapped(bus.id);
    });

    this.boardContainer.add(container);
    this.boardVisuals.set(bus.id, {
      container,
      body,
      arrow,
      mysteryText,
      isAnimating: false,
    });
  }

  private onBusTapped(busId: string): void {
    if (this.status !== 'playing') return;

    const visual = this.boardVisuals.get(busId);
    const bus = this.engine.busSystem.getBus(busId);
    if (!visual || !bus || visual.isAnimating || bus.state !== 'board') return;

    const result = this.engine.tapBus(busId);
    if (!result.accepted) {
      SoundManager.playBump();
      if (result.reason === 'lot_full') {
        this.showToast('No empty parking slot!');
        this.animateBlockedBus(bus, visual, 0.1);
      } else {
        this.animateBlockedBus(bus, visual, result.exitCheck?.hitDistance ?? 0.15);
      }
      return;
    }

    SoundManager.playDrive();
    this.getUIScene()?.dismissTutorial();
    this.getUIScene()?.syncHeader();
    SaveManager.recordBusExited(1);

    visual.isAnimating = true;
    for (const unlockedId of result.newlyUnlockedIds ?? []) {
      this.unlockMysteryVisual(unlockedId);
    }
    this.updateMysteryCountdowns();

    this.driveBusToParkingSlot(bus, visual, result.slotIndex!);
  }

  private driveBusToParkingSlot(
    bus: BusRuntime,
    visual: BoardBusVisual,
    slotIndex: number,
  ): void {
    const dir = DIRECTION_VECTORS[bus.direction];
    const startX = visual.container.x;
    const startY = visual.container.y;

    this.tweens.add({
      targets: visual.container,
      scaleX: 1.08,
      scaleY: 0.92,
      duration: 85,
      yoyo: true,
    });

    const puffTimer = this.time.addEvent({
      delay: 42,
      repeat: 5,
      callback: () => {
        this.spawnDustPuff(
          visual.container.x - dir.x * 22,
          visual.container.y - dir.y * 22,
          0.6,
        );
      },
    });

    const exitDist = 230;
    this.tweens.add({
      targets: visual.container,
      x: startX + dir.x * exitDist,
      y: startY + dir.y * exitDist,
      duration: 210,
      ease: 'Quad.easeIn',
      onComplete: () => {
        puffTimer.remove();
        visual.container.destroy();
        this.boardVisuals.delete(bus.id);
        this.spawnDrivingIntoSlot(bus, slotIndex);
      },
    });
  }

  private spawnDrivingIntoSlot(bus: BusRuntime, slotIndex: number): void {
    const sv = this.slotVisuals[slotIndex];
    if (!sv) return;

    const entryY = this.layout.stripBottom + 28;
    const parkedVisual = this.buildParkedBusVisual(bus, sv.x, entryY, sv.angleDeg, slotIndex);
    this.tweens.add({
      targets: parkedVisual.container,
      y: sv.y - 3,
      duration: 180,
      ease: 'Back.easeOut',
      onComplete: () => {
        bus.state = 'parked';
        this.spawnDustPuff(sv.x, sv.y + 22, 0.55);
      },
    });
  }

  private spawnParkedBusImmediate(bus: BusRuntime, slotIndex: number): void {
    const sv = this.slotVisuals[slotIndex];
    if (!sv) return;
    this.buildParkedBusVisual(bus, sv.x, sv.y - 3, sv.angleDeg, slotIndex);
  }

  private buildParkedBusVisual(
    bus: BusRuntime,
    x: number,
    y: number,
    angleDeg: number,
    slotIndex: number,
  ): ParkedBusVisual {
    const style = COLOR_PALETTE[bus.color];
    const container = this.add.container(x, y);
    container.setAngle(angleDeg);

    const body = this.add.image(0, 0, `bus-${bus.color}`);
    body.setDisplaySize(66, 36);
    body.setAngle(-90);

    const capPill = this.add.graphics();
    capPill.fillStyle(style.num, 1);
    capPill.fillRoundedRect(-17, 25, 34, 19, 7);
    capPill.lineStyle(2, 0xffffff, 0.9);
    capPill.strokeRoundedRect(-17, 25, 34, 19, 7);

    const capText = createCrispText(this, 0, 34.5, `${Math.max(0, bus.capacity - bus.boarded)}`, {
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
      color: style.textHex,
    })
      .setOrigin(0.5)
      .setAngle(-angleDeg);

    container.add([body, capPill, capText]);
    this.parkingLayer.add(container);

    const pv: ParkedBusVisual = {
      busId: bus.id,
      slotIndex,
      container,
      body,
      capPill,
      capText,
    };
    this.parkedVisuals.set(bus.id, pv);
    return pv;
  }

  private animateBlockedBus(
    bus: BusRuntime,
    visual: BoardBusVisual,
    hitDistanceGrid: number,
  ): void {
    visual.isAnimating = true;
    const dir = DIRECTION_VECTORS[bus.direction];
    const origin = this.gridToScreen(bus.x, bus.y);
    const bumpPx = Phaser.Math.Clamp(hitDistanceGrid * this.cellSize * 0.7, 6, 18);

    this.cameras.main.shake(120, 0.004);

    this.tweens.add({
      targets: visual.container,
      x: origin.x + dir.x * bumpPx,
      y: origin.y + dir.y * bumpPx,
      scaleX: 0.92,
      scaleY: 1.08,
      duration: 75,
      ease: 'Quad.easeOut',
      yoyo: true,
      onComplete: () => {
        visual.container.setPosition(origin.x, origin.y);
        visual.container.setScale(1, 1);
        visual.isAnimating = false;
      },
    });
  }

  private updateMysteryCountdowns(): void {
    for (const bus of this.engine.busSystem.getBoardBuses()) {
      if (!bus.unlocked) {
        const vis = this.boardVisuals.get(bus.id);
        vis?.mysteryText?.setText(`${bus.mysteryRemaining}`);
      }
    }
  }

  private unlockMysteryVisual(busId: string): void {
    const bus = this.busSystemGet(busId);
    const visual = this.boardVisuals.get(busId);
    if (!bus || !visual) return;

    visual.body.setTexture(`bus-${bus.color}`);
    visual.arrow.setVisible(true);
    visual.mysteryText?.destroy();
    visual.mysteryText = undefined;

    this.tweens.add({
      targets: visual.container,
      scaleX: 1.18,
      scaleY: 1.18,
      duration: 140,
      yoyo: true,
      ease: 'Back.easeOut',
    });
  }

  private busSystemGet(busId: string): BusRuntime | undefined {
    return this.engine.busSystem.getBus(busId);
  }

  private spawnDustPuff(x: number, y: number, baseScale = 0.65): void {
    const startScale = baseScale * 0.5;
    const puff = this.add
      .image(x + Phaser.Math.Between(-5, 5), y + Phaser.Math.Between(-5, 5), 'dust-puff')
      .setAlpha(0.78)
      .setScale(startScale);
    this.fxLayer.add(puff);

    this.tweens.add({
      targets: puff,
      scale: startScale * 1.75,
      alpha: 0,
      duration: 260,
      onComplete: () => puff.destroy(),
    });
  }

  private spawnMiniConfetti(x: number, y: number, count: number): void {
    const colors = Object.values(COLOR_PALETTE).map((c) => c.num);
    for (let i = 0; i < count; i++) {
      const piece = this.add
        .image(x, y, 'confetti-piece')
        .setTint(colors[i % colors.length])
        .setScale(Phaser.Math.FloatBetween(0.3, 0.5));
      this.fxLayer.add(piece);

      const angle = Phaser.Math.FloatBetween(-Math.PI, 0);
      const speed = Phaser.Math.FloatBetween(35, 95);
      this.tweens.add({
        targets: piece,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed + 24,
        angle: Phaser.Math.Between(-240, 240),
        alpha: 0,
        duration: 420,
        ease: 'Quad.easeOut',
        onComplete: () => piece.destroy(),
      });
    }
  }

  private gridToScreen(gx: number, gy: number): { x: number; y: number } {
    return {
      x: this.boardOriginX + gx * this.cellSize,
      y: this.boardOriginY + gy * this.cellSize,
    };
  }
}
