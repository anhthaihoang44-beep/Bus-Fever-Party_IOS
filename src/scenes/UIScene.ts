import Phaser from 'phaser';
import { SoundManager } from '../audio/SoundManager';
import { BoosterSystem } from '../systems/BoosterSystem';
import type { EngineOutcome } from '../systems/GameEngine';
import {
  BOOSTER_COST_COINS,
  COLOR_PALETTE,
  type BoosterType,
} from '../types/game';
import {
  applyHiDpiCamera,
  createCrispText,
  type GameLayoutMetrics,
} from '../utils/ResponsiveLayout';
import { SaveManager } from '../utils/SaveManager';
import type { GameScene } from './GameScene';

export interface UISceneInitData {
  gameScene: GameScene;
}

interface BoosterButtonRefs {
  type: BoosterType;
  container: Phaser.GameObjects.Container;
  badgeBg?: Phaser.GameObjects.Arc;
  badgeText?: Phaser.GameObjects.Text;
}

/**
 * Responsive overlay HUD scene rendering the top header (Undo, Restart, Level title, Pause),
 * bottom 3-slot booster bar, tutorial pointer, and Win / Fail / Pause / Booster modals.
 */
export class UIScene extends Phaser.Scene {
  private gameScene!: GameScene;
  private layout!: GameLayoutMetrics;

  private undoBtn!: Phaser.GameObjects.Container;
  private undoBadgeBg!: Phaser.GameObjects.Arc;
  private undoBadgeText!: Phaser.GameObjects.Text;
  private boosterButtons: BoosterButtonRefs[] = [];

  private tutorialContainer?: Phaser.GameObjects.Container;
  private modalContainer?: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'UIScene' });
  }

  public init(data: UISceneInitData): void {
    this.gameScene = data.gameScene;
    this.layout = this.gameScene.getLayout();
  }

  public create(): void {
    applyHiDpiCamera(this);
    this.modalContainer = undefined;
    this.tutorialContainer = undefined;
    this.boosterButtons = [];

    this.createHeader();
    this.createBoosterBar();
    this.syncHeader();
    this.syncBoosterBar();
    this.createTutorialOverlayIfNeeded();
  }

  private createHeader(): void {
    const hy = this.layout.headerY;

    this.undoBtn = this.add.container(36, hy).setDepth(10);
    const undoBg = this.add.circle(0, 0, 21, 0x3b8eff).setStrokeStyle(3, 0xffffff);
    const undoIcon = createCrispText(this, 0, -1, '↶', {
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    this.undoBadgeBg = this.add
      .circle(16, -15, 10, 0xf53b45)
      .setStrokeStyle(2, 0xffffff);
    this.undoBadgeText = createCrispText(this, 16, -15, '3', {
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    this.undoBtn.add([undoBg, undoIcon, this.undoBadgeBg, this.undoBadgeText]);
    this.undoBtn.setSize(46, 46);
    this.undoBtn.setInteractive({ useHandCursor: true });
    this.undoBtn.on('pointerdown', () => {
      if (this.modalContainer) return;
      this.gameScene.handleUndo();
    });

    const restartBtn = this.add.container(86, hy).setDepth(10);
    const restartBg = this.add.circle(0, 0, 19, 0x4ca6ff).setStrokeStyle(2.5, 0xffffff);
    const restartIcon = createCrispText(this, 0, -1, '↻', {
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);
    restartBtn.add([restartBg, restartIcon]);
    restartBtn.setSize(42, 42);
    restartBtn.setInteractive({ useHandCursor: true });
    restartBtn.on('pointerdown', () => {
      if (this.modalContainer) return;
      SoundManager.playTap();
      this.gameScene.restartLevel();
    });

    const level = this.gameScene.getLevel();
    const titleStr = level.isEvent
      ? `${level.eventName ?? 'Special Event'}`
      : `Level ${level.id}`;

    createCrispText(this, 270, hy - 1, titleStr, {
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: level.isEvent ? '20px' : '27px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#2c4166',
      strokeThickness: 6,
    })
      .setOrigin(0.5)
      .setDepth(10);

    if (!level.isEvent && level.id > 25) {
      createCrispText(this, 270, hy + 20, '∞ Endless Mode', {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#2e5ea8',
      })
        .setOrigin(0.5)
        .setDepth(10);
    }

    const pauseBtn = this.add.container(504, hy).setDepth(10);
    const pauseBg = this.add.circle(0, 0, 21, 0x3b8eff).setStrokeStyle(3, 0xffffff);
    const bar1 = this.add.rectangle(-4.5, 0, 5, 16, 0xffffff);
    const bar2 = this.add.rectangle(4.5, 0, 5, 16, 0xffffff);
    pauseBtn.add([pauseBg, bar1, bar2]);
    pauseBtn.setSize(46, 46);
    pauseBtn.setInteractive({ useHandCursor: true });
    pauseBtn.on('pointerdown', () => {
      if (this.modalContainer) return;
      SoundManager.playTap();
      this.showPauseModal();
    });
  }

  public syncHeader(): void {
    const canUndo = this.gameScene.getEngine().canUndo();
    const rem = this.gameScene.getEngine().getUndoRemaining();
    this.undoBadgeText.setText(`${rem}`);
    this.undoBadgeBg.setFillStyle(rem > 0 ? 0xf53b45 : 0x7b889e);
    this.undoBtn.setAlpha(canUndo ? 1 : 0.62);
  }

  private createTutorialOverlayIfNeeded(): void {
    const level = this.gameScene.getLevel();
    if (level.id > 4 && !level.tutorialHint) return;

    const targetPos = this.gameScene.getFirstMovableBusScreenPos();
    if (!targetPos) return;

    const container = this.add.container(0, 0).setDepth(25);
    const hintY = this.layout.boosterDockTop - 36;

    if (level.tutorialHint) {
      const hintText = createCrispText(this, 270, hintY, level.tutorialHint, {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#2b3e5e',
        align: 'center',
        wordWrap: { width: 424 },
      }).setOrigin(0.5);

      const boxW = Math.max(320, Math.min(468, Math.ceil(hintText.width + 36)));
      const boxH = Math.max(44, Math.ceil(hintText.height + 20));
      const hintBg = this.add
        .graphics()
        .fillStyle(0xffffff, 0.94)
        .fillRoundedRect(270 - boxW / 2, hintY - boxH / 2, boxW, boxH, 16)
        .lineStyle(2.5, 0x3b8eff, 0.9)
        .strokeRoundedRect(270 - boxW / 2, hintY - boxH / 2, boxW, boxH, 16);

      container.add([hintBg, hintText]);
    }

    const hand = this.add
      .image(targetPos.x + 18, targetPos.y + 24, 'tutorial-hand')
      .setScale(0.38);
    container.add(hand);

    this.tweens.add({
      targets: hand,
      x: targetPos.x + 8,
      y: targetPos.y + 12,
      scale: 0.32,
      duration: 460,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.tutorialContainer = container;
  }

  public dismissTutorial(): void {
    if (!this.tutorialContainer) return;
    const target = this.tutorialContainer;
    this.tutorialContainer = undefined;
    this.tweens.add({
      targets: target,
      alpha: 0,
      duration: 200,
      onComplete: () => target.destroy(),
    });
  }

  public showWinModal(stars: number, coinsEarned: number, hasNextLevel: boolean): void {
    if (this.modalContainer) return;
    this.dismissTutorial();
    this.spawnCelebrationConfetti();

    const modal = this.createModalBackdrop();
    const card = this.add.graphics();
    card.fillStyle(0x1e2c4a, 0.3);
    card.fillRoundedRect(-176, -184, 352, 392, 28);
    card.fillStyle(0xfff9ed, 1);
    card.fillRoundedRect(-176, -190, 352, 386, 28);
    card.lineStyle(4, 0xffd04d, 1);
    card.strokeRoundedRect(-176, -190, 352, 386, 28);

    const ribbon = this.add.graphics();
    ribbon.fillStyle(0x34d349, 1);
    ribbon.fillRoundedRect(-146, -214, 292, 54, 18);
    ribbon.lineStyle(3, 0xffffff, 1);
    ribbon.strokeRoundedRect(-146, -214, 292, 54, 18);

    const title = createCrispText(this, 0, -187, 'GREAT JOB!', {
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: '28px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#167525',
      strokeThickness: 5,
    }).setOrigin(0.5);

    modal.add([card, ribbon, title]);

    for (let i = 0; i < 3; i++) {
      const sx = (i - 1) * 64;
      const sy = i === 1 ? -114 : -104;
      const earned = i < stars;
      const starText = createCrispText(this, sx, sy, '★', {
        fontSize: i === 1 ? '58px' : '48px',
        color: earned ? '#ffc814' : '#d2dae8',
        stroke: earned ? '#b57400' : '#a0acbf',
        strokeThickness: 5,
      })
        .setOrigin(0.5)
        .setScale(0);
      modal.add(starText);

      this.tweens.add({
        targets: starText,
        scale: 1,
        delay: 120 + i * 110,
        duration: 280,
        ease: 'Back.easeOut',
      });
    }

    const coinBg = this.add
      .graphics()
      .fillStyle(0xfff0c2, 1)
      .fillRoundedRect(-76, -42, 152, 46, 16)
      .lineStyle(2.5, 0xffc814, 1)
      .strokeRoundedRect(-76, -42, 152, 46, 16);

    const coinLabel = createCrispText(this, 0, -19, `🪙  +${coinsEarned} Coins`, {
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#7a4b00',
    }).setOrigin(0.5);

    modal.add([coinBg, coinLabel]);

    const nextBtn = this.createPillButton(
      0,
      62,
      244,
      58,
      0x34d349,
      0x189629,
      hasNextLevel ? 'Next Level ▶' : 'Back to Home',
      () => {
        this.closeModal();
        if (hasNextLevel) {
          this.gameScene.goToNextLevel();
        } else {
          this.gameScene.goToHome();
        }
      },
    );

    const replayBtn = this.createPillButton(
      -74,
      134,
      132,
      44,
      0x3b8eff,
      0x1d66cf,
      'Replay',
      () => {
        this.closeModal();
        this.gameScene.restartLevel();
      },
    );

    const homeBtn = this.createPillButton(
      74,
      134,
      132,
      44,
      0xff8a1f,
      0xc75600,
      'Home',
      () => {
        this.closeModal();
        this.gameScene.goToHome();
      },
    );

    modal.add([nextBtn, replayBtn, homeBtn]);
    this.animateModalIn(modal);
  }

  public showFailModal(outcome: Exclude<EngineOutcome, 'playing' | 'won'>): void {
    if (this.modalContainer) return;
    this.dismissTutorial();

    const modal = this.createModalBackdrop();
    const card = this.add.graphics();
    card.fillStyle(0x1e2c4a, 0.3);
    card.fillRoundedRect(-176, -174, 352, 368, 28);
    card.fillStyle(0xfff9f6, 1);
    card.fillRoundedRect(-176, -180, 352, 362, 28);
    card.lineStyle(4, 0xf53b45, 1);
    card.strokeRoundedRect(-176, -180, 352, 362, 28);

    const ribbon = this.add.graphics();
    ribbon.fillStyle(0xf53b45, 1);
    ribbon.fillRoundedRect(-142, -204, 284, 54, 18);
    ribbon.lineStyle(3, 0xffffff, 1);
    ribbon.strokeRoundedRect(-142, -204, 284, 54, 18);

    const title = createCrispText(this, 0, -177, 'STUCK!', {
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: '28px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#94141d',
      strokeThickness: 5,
    }).setOrigin(0.5);

    const reasonText =
      outcome === 'lost_lot_deadlock'
        ? 'All parking slots are full and\nno parked bus matches the queue!'
        : 'No buses on the board can move\nand the front passenger cannot board!';

    const sub = createCrispText(this, 0, -96, reasonText, {
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: '17px',
      fontStyle: 'bold',
      color: '#43536e',
      align: 'center',
      lineSpacing: 6,
    }).setOrigin(0.5);

    const reviveBtn = this.createPillButton(
      0,
      8,
      268,
      58,
      0x9b51e0,
      0x6724ab,
      'Revive (Use Booster)',
      () => {
        this.closeModal();
        this.gameScene.handleRevive();
      },
    );

    const retryBtn = this.createPillButton(
      0,
      82,
      220,
      52,
      0xff8a1f,
      0xc75600,
      'Retry',
      () => {
        this.closeModal();
        this.gameScene.restartLevel();
      },
    );

    modal.add([card, ribbon, title, sub, reviveBtn, retryBtn]);
    this.animateModalIn(modal);
  }

  public showPauseModal(): void {
    if (this.modalContainer) return;
    this.gameScene.setPaused(true);

    const modal = this.createModalBackdrop();
    const card = this.add.graphics();
    card.fillStyle(0xfff9ed, 1);
    card.fillRoundedRect(-168, -195, 336, 412, 26);
    card.lineStyle(4, 0x3b8eff, 1);
    card.strokeRoundedRect(-168, -195, 336, 412, 26);

    const ribbon = this.add.graphics();
    ribbon.fillStyle(0x3b8eff, 1);
    ribbon.fillRoundedRect(-118, -218, 236, 48, 16);
    ribbon.lineStyle(3, 0xffffff, 1);
    ribbon.strokeRoundedRect(-118, -218, 236, 48, 16);

    const title = createCrispText(this, 0, -194, 'Settings', {
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    modal.add([card, ribbon, title]);

    const save = SaveManager.load();

    const makeToggleRow = (
      y: number,
      label: string,
      initial: boolean,
      onToggle: (next: boolean) => void,
    ) => {
      let current = initial;
      const rowBg = this.add
        .graphics()
        .fillStyle(0xedf3fc, 1)
        .fillRoundedRect(-132, y - 24, 264, 48, 14);
      const txt = createCrispText(this, -110, y, label, {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#2e4163',
      }).setOrigin(0, 0.5);

      const pill = this.add.container(86, y);
      const pillBg = this.add
        .rectangle(0, 0, 68, 30, current ? 0x34d349 : 0x9aa8bf)
        .setStrokeStyle(2, 0xffffff);
      const pillText = createCrispText(this, 0, 0, current ? 'ON' : 'OFF', {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#ffffff',
      }).setOrigin(0.5);
      pill.add([pillBg, pillText]);
      pill.setSize(68, 30);
      pill.setInteractive({ useHandCursor: true });
      pill.on('pointerdown', () => {
        current = !current;
        pillBg.setFillStyle(current ? 0x34d349 : 0x9aa8bf);
        pillText.setText(current ? 'ON' : 'OFF');
        onToggle(current);
        SoundManager.playTap();
      });

      modal.add([rowBg, txt, pill]);
    };

    makeToggleRow(-114, '🔊  Sound FX', save.settings.soundEnabled, (val) => {
      SaveManager.updateSettings({ soundEnabled: val });
    });

    makeToggleRow(-54, '📳  Vibration', save.settings.vibrationEnabled, (val) => {
      SaveManager.updateSettings({ vibrationEnabled: val });
    });

    const restartBtn = this.createPillButton(
      0,
      24,
      228,
      46,
      0xff8a1f,
      0xc75600,
      'Restart Level',
      () => {
        this.closeModal();
        this.gameScene.restartLevel();
      },
    );

    const homeBtn = this.createPillButton(
      0,
      84,
      228,
      46,
      0x6c7d9c,
      0x47546e,
      '🏠  Level Select / Home',
      () => {
        this.closeModal();
        this.gameScene.goToHome();
      },
    );

    const resumeBtn = this.createPillButton(
      0,
      150,
      228,
      50,
      0x34d349,
      0x189629,
      'Resume',
      () => {
        this.closeModal();
        this.gameScene.setPaused(false);
      },
    );

    modal.add([restartBtn, homeBtn, resumeBtn]);
    this.animateModalIn(modal);
  }

  private createModalBackdrop(): Phaser.GameObjects.Container {
    const h = this.layout.height;
    const dim = this.add
      .rectangle(270, h * 0.5, 540, h, 0x0c162b, 0.58)
      .setDepth(80)
      .setInteractive();

    const container = this.add.container(270, h * 0.5).setDepth(81);
    container.setData('dim', dim);
    this.modalContainer = container;
    return container;
  }

  private animateModalIn(modal: Phaser.GameObjects.Container): void {
    modal.setScale(0.75).setAlpha(0);
    this.tweens.add({
      targets: modal,
      scale: 1,
      alpha: 1,
      duration: 220,
      ease: 'Back.easeOut',
    });
  }

  private closeModal(): void {
    if (!this.modalContainer) return;
    const dim = this.modalContainer.getData('dim') as Phaser.GameObjects.Rectangle | undefined;
    dim?.destroy();
    this.modalContainer.destroy();
    this.modalContainer = undefined;
  }

  private createPillButton(
    x: number,
    y: number,
    w: number,
    h: number,
    fill: number,
    dark: number,
    label: string,
    onClick: () => void,
  ): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(dark, 1);
    g.fillRoundedRect(-w / 2, -h / 2 + 4, w, h, h / 2);
    g.fillStyle(fill, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    g.lineStyle(2.5, 0xffffff, 0.9);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);

    const txt = createCrispText(this, 0, 0, label, {
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: '19px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    c.add([g, txt]);
    c.setSize(w, h);
    c.setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => {
      SoundManager.playTap();
      this.tweens.add({
        targets: c,
        scale: 0.94,
        duration: 60,
        yoyo: true,
        onComplete: onClick,
      });
    });

    return c;
  }

  private createBoosterBar(): void {
    const specs: Array<{ type: BoosterType; label: string; iconKey: string; x: number }> = [
      { type: 'vip', label: 'VIP', iconKey: 'icon-vip', x: 112 },
      { type: 'arrange', label: 'Arrange', iconKey: 'icon-arrange', x: 270 },
      { type: 'jumble', label: 'Jumble', iconKey: 'icon-jumble', x: 428 },
    ];

    const level = this.gameScene.getLevel();
    const by = this.layout.boosterY;

    for (const spec of specs) {
      const unlocked = BoosterSystem.isUnlockedForLevel(spec.type, level);
      const container = this.add.container(spec.x, by).setDepth(15);

      const bg = this.add.graphics();
      const w = 128;
      const h = 72;
      bg.fillStyle(unlocked ? 0x1e60ba : 0x2f5387, 1);
      bg.fillRoundedRect(-w / 2, -h / 2 + 4, w, h, 18);
      bg.fillStyle(unlocked ? 0x5aaeff : 0x6296d9, 1);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 18);
      bg.lineStyle(2.5, 0xffffff, 0.85);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 18);
      container.add(bg);

      if (!unlocked) {
        const lockIcon = this.add.image(0, -8, 'icon-lock').setScale(0.38);
        const lockText = createCrispText(
          this,
          0,
          21,
          `Level ${BoosterSystem.getUnlockLevel(spec.type)}`,
          {
            fontFamily: 'Segoe UI, system-ui, sans-serif',
            fontSize: '14px',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#24406b',
            strokeThickness: 3,
          },
        ).setOrigin(0.5);
        container.add([lockIcon, lockText]);
        this.boosterButtons.push({ type: spec.type, container });
      } else {
        const icon = this.add.image(0, -9, spec.iconKey).setScale(0.42);
        const label = createCrispText(this, 0, 22, spec.label, {
          fontFamily: 'Segoe UI, system-ui, sans-serif',
          fontSize: '14px',
          fontStyle: 'bold',
          color: '#ffffff',
          stroke: '#16468a',
          strokeThickness: 3,
        }).setOrigin(0.5);

        const badgeBg = this.add
          .circle(52, -28, 12, 0xf53b45)
          .setStrokeStyle(2, 0xffffff);
        const badgeText = createCrispText(this, 52, -28, '1', {
          fontFamily: 'Segoe UI, system-ui, sans-serif',
          fontSize: '13px',
          fontStyle: 'bold',
          color: '#ffffff',
        }).setOrigin(0.5);

        container.add([icon, label, badgeBg, badgeText]);
        this.boosterButtons.push({
          type: spec.type,
          container,
          badgeBg,
          badgeText,
        });
      }

      container.setSize(w, h);
      container.setInteractive({ useHandCursor: true });
      container.on('pointerdown', () => {
        if (this.modalContainer) return;
        this.tweens.add({
          targets: container,
          scale: 0.93,
          duration: 60,
          yoyo: true,
        });
        this.gameScene.handleBooster(spec.type);
      });
    }
  }

  public syncBoosterBar(): void {
    const save = SaveManager.load();
    for (const btn of this.boosterButtons) {
      if (!btn.badgeBg || !btn.badgeText) continue;
      const count = save.boosterCounts[btn.type] ?? 0;
      if (count > 0) {
        btn.badgeBg.setFillStyle(0xf53b45);
        btn.badgeText.setText(`${count}`);
      } else {
        btn.badgeBg.setFillStyle(0x34d349);
        btn.badgeText.setText('+');
      }
    }
  }

  public showGetBoosterModal(type: BoosterType): void {
    if (this.modalContainer) return;
    this.gameScene.setPaused(true);

    const names: Record<BoosterType, string> = {
      vip: 'VIP Slot',
      arrange: 'Arrange',
      jumble: 'Jumble',
    };
    const cost = BOOSTER_COST_COINS[type];
    const save = SaveManager.load();

    const modal = this.createModalBackdrop();
    const card = this.add.graphics();
    card.fillStyle(0xfff9ed, 1);
    card.fillRoundedRect(-168, -162, 336, 326, 26);
    card.lineStyle(4, 0x3b8eff, 1);
    card.strokeRoundedRect(-168, -162, 336, 326, 26);

    const title = createCrispText(this, 0, -124, `Get ${names[type]} +1`, {
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#25395c',
    }).setOrigin(0.5);

    const icon = this.add.image(0, -56, `icon-${type}`).setScale(0.72);
    const coinsTxt = createCrispText(this, 0, -2, `Your Coins: 🪙 ${save.coins}`, {
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#7a5200',
    }).setOrigin(0.5);

    const rewardBtn = this.createPillButton(
      0,
      54,
      252,
      48,
      0x34d349,
      0x189629,
      'Claim Free +1 (Reward)',
      () => {
        SaveManager.addBooster(type, 1);
        SoundManager.playCoin();
        this.syncBoosterBar();
        this.closeModal();
        this.gameScene.setPaused(false);
        this.gameScene.showToast(`Claimed +1 ${names[type]}!`);
      },
    );

    const buyBtn = this.createPillButton(
      0,
      114,
      252,
      44,
      save.coins >= cost ? 0xff8a1f : 0x9aa8bf,
      save.coins >= cost ? 0xc75600 : 0x6c798f,
      `Buy for 🪙 ${cost}`,
      () => {
        if (!SaveManager.spendCoins(cost)) {
          this.gameScene.showToast('Not enough coins!');
          return;
        }
        SaveManager.addBooster(type, 1);
        SoundManager.playCoin();
        this.syncBoosterBar();
        this.closeModal();
        this.gameScene.setPaused(false);
        this.gameScene.showToast(`Purchased +1 ${names[type]}!`);
      },
    );

    const closeBtn = createCrispText(this, 142, -138, '✕', {
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#7b8aa6',
      padding: { x: 12, y: 10 },
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => {
      SoundManager.playTap();
      this.closeModal();
      this.gameScene.setPaused(false);
    });

    modal.add([card, title, icon, coinsTxt, rewardBtn, buyBtn, closeBtn]);
    this.animateModalIn(modal);
  }

  public showUnlockSlotModal(slotIndex: number): void {
    if (this.modalContainer) return;
    this.gameScene.setPaused(true);

    const save = SaveManager.load();
    const slotCost = 50;

    const modal = this.createModalBackdrop();
    const card = this.add.graphics();
    card.fillStyle(0xfff9ed, 1);
    card.fillRoundedRect(-168, -148, 336, 298, 26);
    card.lineStyle(4, 0x34d349, 1);
    card.strokeRoundedRect(-168, -148, 336, 298, 26);

    const title = createCrispText(this, 0, -108, 'Unlock Parking Slot?', {
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: '23px',
      fontStyle: 'bold',
      color: '#25395c',
    }).setOrigin(0.5);

    const desc = createCrispText(
      this,
      0,
      -56,
      'Add an extra parking spot for this level.\nYour Coins: 🪙 ' + save.coins,
      {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#536580',
        align: 'center',
        lineSpacing: 6,
      },
    ).setOrigin(0.5);

    const rewardBtn = this.createPillButton(
      0,
      20,
      252,
      50,
      0x34d349,
      0x189629,
      'Watch Reward (Free)',
      () => {
        this.closeModal();
        this.gameScene.setPaused(false);
        this.gameScene.unlockExtraParkingSlot(slotIndex);
      },
    );

    const coinBtn = this.createPillButton(
      0,
      84,
      252,
      46,
      save.coins >= slotCost ? 0xff8a1f : 0x9aa8bf,
      save.coins >= slotCost ? 0xc75600 : 0x6c798f,
      `Unlock for 🪙 ${slotCost}`,
      () => {
        if (!SaveManager.spendCoins(slotCost)) {
          this.gameScene.showToast('Not enough coins!');
          return;
        }
        this.closeModal();
        this.gameScene.setPaused(false);
        this.gameScene.unlockExtraParkingSlot(slotIndex);
      },
    );

    const closeBtn = createCrispText(this, 142, -124, '✕', {
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#7b8aa6',
      padding: { x: 12, y: 10 },
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => {
      SoundManager.playTap();
      this.closeModal();
      this.gameScene.setPaused(false);
    });

    modal.add([card, title, desc, rewardBtn, coinBtn, closeBtn]);
    this.animateModalIn(modal);
  }

  private spawnCelebrationConfetti(): void {
    const palette = Object.values(COLOR_PALETTE).map((c) => c.num);
    const maxY = this.layout.height - 40;
    for (let i = 0; i < 42; i++) {
      const startX = Phaser.Math.Between(30, 510);
      const startY = Phaser.Math.Between(-40, 80);
      const piece = this.add
        .image(startX, startY, 'confetti-piece')
        .setTint(palette[i % palette.length])
        .setDepth(90)
        .setScale(Phaser.Math.FloatBetween(0.35, 0.65));

      this.tweens.add({
        targets: piece,
        x: startX + Phaser.Math.Between(-90, 90),
        y: Phaser.Math.Between(Math.round(maxY * 0.55), maxY),
        angle: Phaser.Math.Between(-360, 360),
        alpha: 0,
        delay: Phaser.Math.Between(0, 320),
        duration: Phaser.Math.Between(1100, 1750),
        ease: 'Quad.easeOut',
        onComplete: () => piece.destroy(),
      });
    }
  }
}
