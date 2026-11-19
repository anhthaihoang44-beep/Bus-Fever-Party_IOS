import Phaser from 'phaser';
import { SoundManager } from '../audio/SoundManager';
import { COLOR_PALETTE } from '../types/game';
import { LevelLoader } from '../utils/LevelLoader';
import {
  applyHiDpiCamera,
  createCrispText,
  type ScreenMetrics,
} from '../utils/ResponsiveLayout';
import { SaveManager } from '../utils/SaveManager';
import { TextureFactory } from '../utils/TextureFactory';

interface LeaderboardRow {
  name: string;
  score: number;
  isPlayer?: boolean;
}

const MOCK_RIVALS: LeaderboardRow[] = [
  { name: 'MapleQueen', score: 2650 },
  { name: 'BusMaster99', score: 2140 },
  { name: 'SunnyDriver', score: 1780 },
  { name: 'CandyLoop', score: 1320 },
  { name: 'SpeedyMinh', score: 980 },
  { name: 'PixelCommute', score: 620 },
  { name: 'CityHopper', score: 340 },
  { name: 'RookieRider', score: 150 },
];

/**
 * Responsive meta hub & title screen featuring Play CTA, Journey Milestone strip,
 * Endless Level Select map (1..∞), Seasonal Maple Event, Missions, Leaderboard, and Settings.
 */
export class HomeScene extends Phaser.Scene {
  private metrics!: ScreenMetrics;
  private coinsText!: Phaser.GameObjects.Text;
  private modalContainer?: Phaser.GameObjects.Container;
  private levelPage = 0;

  constructor() {
    super({ key: 'HomeScene' });
  }

  public create(data?: { modal?: string }): void {
    this.metrics = applyHiDpiCamera(this);
    TextureFactory.ensureAll(this);
    this.modalContainer = undefined;

    const save = SaveManager.load();
    this.levelPage = Math.floor(Math.max(0, save.currentLevel - 1) / 20);

    this.drawBackdrop();
    this.createTopBar();
    this.createHeroLogo();
    this.createSeasonalBanner();
    this.createJourneyAndPlaySection();
    this.createBottomNav();

    if (data?.modal === 'levels') this.showLevelSelectModal();
    else if (data?.modal === 'missions') this.showMissionsModal();
    else if (data?.modal === 'leaderboard') this.showLeaderboardModal();
  }

  private drawBackdrop(): void {
    const { width, height, safeBottom } = this.metrics;
    const dockHeight = 96 + safeBottom;
    const roadTop = height - dockHeight - 24;

    const g = this.add.graphics();
    g.fillStyle(0x9bd4ff, 1);
    g.fillRect(0, 0, width, height);
    g.fillStyle(0x69b8ff, 1);
    g.fillRect(0, 0, width, Math.round(height * 0.52));

    // Rolling hills anchored cleanly to bottom road
    g.fillStyle(0x7edb65, 1);
    g.fillEllipse(140, roadTop + 26, 430, 210);
    g.fillStyle(0x63c94b, 1);
    g.fillEllipse(420, roadTop + 40, 410, 220);

    // Roadway + bottom dock
    g.fillStyle(0x9aa6bf, 1);
    g.fillRect(0, roadTop - 6, width, 8);
    g.fillStyle(0x525c70, 1);
    g.fillRect(0, roadTop, width, height - roadTop);
    g.fillStyle(0x3f4759, 1);
    g.fillRect(0, height - dockHeight, width, dockHeight);

    // Soft drifting clouds
    const cloudBaseY = this.metrics.safeTop + 86;
    for (const [cx, cy, s] of [
      [88, cloudBaseY + 24, 1],
      [446, cloudBaseY + 56, 0.85],
      [252, cloudBaseY - 14, 0.7],
    ] as const) {
      const cloud = this.add.container(cx, cy).setAlpha(0.85);
      cloud.add([
        this.add.circle(-18 * s, 4 * s, 18 * s, 0xffffff),
        this.add.circle(4 * s, -4 * s, 23 * s, 0xffffff),
        this.add.circle(26 * s, 5 * s, 16 * s, 0xffffff),
      ]);
      this.tweens.add({
        targets: cloud,
        x: cx + 26,
        duration: 4200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // Animated parade of candy buses rolling across the road just above bottom dock
    const busColors = ['pink', 'yellow', 'blue', 'green'] as const;
    busColors.forEach((c, idx) => {
      const bus = this.add
        .image(-80 - idx * 150, roadTop - 16, `bus-${c}`)
        .setDisplaySize(86, 48);
      this.tweens.add({
        targets: bus,
        x: 640,
        duration: 5400,
        delay: idx * 1200,
        repeat: -1,
      });
    });
  }

  private createTopBar(): void {
    const save = SaveManager.load();
    const topY = this.metrics.safeTop + 26;

    const coinBg = this.add
      .graphics()
      .fillStyle(0x1f355c, 0.35)
      .fillRoundedRect(20, topY - 18, 136, 42, 21)
      .fillStyle(0xffffff, 0.96)
      .fillRoundedRect(20, topY - 20, 136, 40, 20)
      .lineStyle(2.5, 0xffc814, 1)
      .strokeRoundedRect(20, topY - 20, 136, 40, 20)
      .setDepth(5);
    void coinBg;

    this.coinsText = createCrispText(this, 88, topY, `🪙 ${save.coins}`, {
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#6e4500',
    })
      .setOrigin(0.5)
      .setDepth(6);

    const gearBtn = this.add.container(496, topY).setDepth(6);
    const gearBg = this.add.circle(0, 0, 22, 0x3b8eff).setStrokeStyle(3, 0xffffff);
    const gearTxt = createCrispText(this, 0, -1, '⚙', {
      fontSize: '23px',
      color: '#ffffff',
    }).setOrigin(0.5);
    gearBtn.add([gearBg, gearTxt]);
    gearBtn.setSize(48, 48);
    gearBtn.setInteractive({ useHandCursor: true });
    gearBtn.on('pointerdown', () => {
      SoundManager.playTap();
      this.showSettingsModal();
    });
  }

  private createHeroLogo(): void {
    const logoY = this.metrics.safeTop + 124;
    const c = this.add.container(270, logoY);

    const leftBus = this.add.image(-188, 14, 'bus-orange').setDisplaySize(76, 42).setAngle(-18);
    const rightBus = this.add.image(188, 14, 'bus-cyan').setDisplaySize(76, 42).setAngle(18).setFlipX(true);

    const badge = this.add.graphics();
    badge.fillStyle(0x1a396b, 0.35);
    badge.fillRoundedRect(-176, -54, 352, 120, 28);
    badge.fillStyle(0x2e86ff, 1);
    badge.fillRoundedRect(-176, -60, 352, 118, 28);
    badge.lineStyle(4, 0xffffff, 1);
    badge.strokeRoundedRect(-176, -60, 352, 118, 28);

    const mainTitle = createCrispText(this, 0, -17, 'BUS FEVER', {
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: '42px',
      fontStyle: 'bold',
      color: '#ffe047',
      stroke: '#163570',
      strokeThickness: 8,
    }).setOrigin(0.5);

    const subTitle = createCrispText(this, 0, 29, 'PARTY PASSENGER LOOP', {
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#163570',
      strokeThickness: 4,
    }).setOrigin(0.5);

    c.add([leftBus, rightBus, badge, mainTitle, subTitle]);
    this.tweens.add({
      targets: c,
      y: logoY - 6,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private createSeasonalBanner(): void {
    const save = SaveManager.load();
    const bannerY = this.metrics.safeTop + 266;
    const banner = this.add.container(270, bannerY);

    const card = this.add.graphics();
    card.fillStyle(0x8c2e0e, 0.35);
    card.fillRoundedRect(-224, -60, 448, 130, 24);
    card.fillStyle(0xf26b26, 1);
    card.fillRoundedRect(-224, -66, 448, 128, 24);
    card.fillStyle(0xff8e36, 1);
    card.fillRoundedRect(-220, -64, 440, 62, 20);
    card.lineStyle(3.5, 0xffe49e, 1);
    card.strokeRoundedRect(-224, -66, 448, 128, 24);

    const tag = createCrispText(
      this,
      -200,
      -44,
      save.stats.eventCompleted ? '🍁 SEASONAL EVENT • CLEARED ✓' : '🍁 SEASONAL EVENT',
      {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#fff2bd',
      },
    ).setOrigin(0, 0.5);

    const title = createCrispText(this, -200, -12, 'Maple Bus Escape Challenge', {
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: '21px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#7a1f05',
      strokeThickness: 4,
    }).setOrigin(0, 0.5);

    const desc = createCrispText(this, -200, 21, 'Autumn maple loop • Bonus coins!', {
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#ffebd1',
    }).setOrigin(0, 0.5);

    const playEventBtn = this.createPillButton(
      146,
      20,
      118,
      40,
      0x34d349,
      0x189629,
      'Play Event',
      () => {
        const evt = LevelLoader.getEventLevel();
        if (evt) {
          this.scene.start('GameScene', { levelId: evt.id, isEvent: true });
        }
      },
      '15px',
    );

    banner.add([card, tag, title, desc, playEventBtn]);
  }

  private createJourneyAndPlaySection(): void {
    const save = SaveManager.load();
    const targetLevel = save.currentLevel;
    const totalStars = Object.values(save.starsByLevel).reduce((s, v) => s + v, 0);

    const topBound = this.metrics.safeTop + 356;
    const bottomBound = this.metrics.height - this.metrics.safeBottom - 150;
    const midY = Math.round((topBound + bottomBound) * 0.5);

    // Compact Journey Milestone Card positioned symmetrically above Play CTA
    const cardY = midY - 62;
    const card = this.add.container(270, cardY);
    const bg = this.add.graphics();
    bg.fillStyle(0x1f3a63, 0.22);
    bg.fillRoundedRect(-224, -60, 448, 126, 22);
    bg.fillStyle(0xffffff, 0.94);
    bg.fillRoundedRect(-224, -64, 448, 124, 22);
    bg.lineStyle(3, 0x7cb8ff, 0.95);
    bg.strokeRoundedRect(-224, -64, 448, 124, 22);
    card.add(bg);

    const modeBadge = targetLevel > 25 ? '∞ ENDLESS MODE ACTIVE' : 'NEXT MILESTONE ROADMAP';
    const headerTxt = createCrispText(this, -200, -40, `${modeBadge}   •   ★ ${totalStars} Stars`, {
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#2e6cc4',
    }).setOrigin(0, 0.5);
    card.add(headerTxt);

    // 5-node level roadmap around currentLevel
    const startNode = Math.max(1, targetLevel - 2);
    for (let i = 0; i < 5; i++) {
      const lv = startNode + i;
      const nx = -156 + i * 78;
      const ny = 2;

      if (i < 4) {
        const line = this.add.graphics();
        line.lineStyle(5, lv < targetLevel ? 0x34d349 : 0xcad6ea, 1);
        line.lineBetween(nx + 20, ny, nx + 58, ny);
        card.add(line);
      }

      const isDone = lv < save.highestUnlockedLevel;
      const isCurr = lv === targetLevel;
      const nodeFill = isCurr ? 0x34d349 : isDone ? 0x3b8eff : 0x9aa8bf;
      const radius = isCurr ? 23 : 19;

      const circle = this.add
        .circle(nx, ny, radius, nodeFill)
        .setStrokeStyle(3, isCurr ? 0xffe047 : 0xffffff);
      const label = createCrispText(this, nx, ny, `${lv}`, {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: isCurr ? '17px' : '15px',
        fontStyle: 'bold',
        color: '#ffffff',
      }).setOrigin(0.5);
      card.add([circle, label]);
    }

    const hintStr =
      targetLevel < 4
        ? 'Unlock VIP Parking Slot at Level 4!'
        : targetLevel < 8
          ? 'Unlock Arrange Booster at Level 8!'
          : targetLevel < 11
            ? 'Park Theme & Wooden Obstacles at Level 11!'
            : targetLevel < 13
              ? 'Unlock Jumble Booster at Level 13!'
              : targetLevel < 20
                ? 'Diagonal Diamond Challenges at Level 20!'
                : targetLevel <= 25
                  ? 'Endless Auto-Generated Levels unlock after Level 25!'
                  : `Endless Level ${targetLevel} • Procedurally generated & verified!`;

    const hintTxt = createCrispText(this, 0, 40, hintStr, {
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#4c5f80',
    }).setOrigin(0.5);
    card.add(hintTxt);

    // Big glossy PLAY button right below milestone card
    const playY = midY + 62;
    const playBtn = this.createPillButton(
      270,
      playY,
      312,
      78,
      0x34d349,
      0x158c24,
      `PLAY  LEVEL ${targetLevel}`,
      () => {
        this.scene.start('GameScene', { levelId: targetLevel });
      },
      '25px',
    );

    this.tweens.add({
      targets: playBtn,
      scale: 1.03,
      duration: 950,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private createBottomNav(): void {
    const navY = this.metrics.height - this.metrics.safeBottom - 48;
    const navItems = [
      { label: 'Levels', icon: '🗺', x: 96, color: 0x3b8eff, dark: 0x1a5fc2, action: () => this.showLevelSelectModal() },
      { label: 'Missions', icon: '🎯', x: 270, color: 0x9b51e0, dark: 0x6724ab, action: () => this.showMissionsModal() },
      { label: 'Leaders', icon: '🏆', x: 444, color: 0xff8a1f, dark: 0xc75600, action: () => this.showLeaderboardModal() },
    ];

    for (const item of navItems) {
      const c = this.add.container(item.x, navY).setDepth(10);
      const bg = this.add.graphics();
      bg.fillStyle(item.dark, 1);
      bg.fillRoundedRect(-72, -34, 144, 72, 18);
      bg.fillStyle(item.color, 1);
      bg.fillRoundedRect(-72, -38, 144, 70, 18);
      bg.lineStyle(2.5, 0xffffff, 0.9);
      bg.strokeRoundedRect(-72, -38, 144, 70, 18);

      const icon = createCrispText(this, 0, -13, item.icon, { fontSize: '24px' }).setOrigin(0.5);
      const txt = createCrispText(this, 0, 17, item.label, {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#ffffff',
      }).setOrigin(0.5);

      c.add([bg, icon, txt]);
      c.setSize(144, 72);
      c.setInteractive({ useHandCursor: true });
      c.on('pointerdown', () => {
        if (this.modalContainer) return;
        SoundManager.playTap();
        item.action();
      });
    }
  }

  private showLevelSelectModal(): void {
    const save = SaveManager.load();
    const pageSize = 20;
    const startId = this.levelPage * pageSize + 1;
    const endId = startId + pageSize - 1;
    const titleLabel = startId > 25 ? `Endless (${startId}–${endId})` : `Levels ${startId}–${endId}`;

    const modal = this.createModal(titleLabel, 448, 560, 0x3b8eff);

    const cols = 5;
    const cellW = 76;
    const cellH = 84;
    const startX = -((cols - 1) * cellW) * 0.5;
    const startY = -146;

    for (let idx = 0; idx < pageSize; idx++) {
      const lvlId = startId + idx;
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const lx = startX + col * cellW;
      const ly = startY + row * cellH;

      const unlocked = lvlId <= save.highestUnlockedLevel;
      const stars = save.starsByLevel[lvlId] ?? 0;

      const tile = this.add.container(lx, ly);
      const bg = this.add.graphics();
      bg.fillStyle(unlocked ? 0x1f67c9 : 0x7a89a1, 1);
      bg.fillRoundedRect(-31, -29, 62, 66, 14);
      bg.fillStyle(unlocked ? 0x4ca6ff : 0x9aa8bf, 1);
      bg.fillRoundedRect(-31, -33, 62, 64, 14);
      if (lvlId === save.currentLevel) {
        bg.lineStyle(3, 0xffd24d, 1);
        bg.strokeRoundedRect(-31, -33, 62, 64, 14);
      }

      const numTxt = createCrispText(this, 0, -8, unlocked ? `${lvlId}` : '🔒', {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: unlocked ? '21px' : '18px',
        fontStyle: 'bold',
        color: '#ffffff',
      }).setOrigin(0.5);

      const starsStr = !unlocked
        ? `Lv.${lvlId}`
        : stars > 0
          ? '★'.repeat(stars) + '☆'.repeat(3 - stars)
          : 'Play';
      const starsTxt = createCrispText(this, 0, 16, starsStr, {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: '12px',
        fontStyle: 'bold',
        color: unlocked && stars > 0 ? '#ffe169' : '#e0e7f5',
      }).setOrigin(0.5);

      tile.add([bg, numTxt, starsTxt]);
      if (unlocked) {
        tile.setSize(62, 66);
        tile.setInteractive({ useHandCursor: true });
        tile.on('pointerdown', () => {
          SoundManager.playTap();
          this.closeModal();
          this.scene.start('GameScene', { levelId: lvlId });
        });
      }
      modal.add(tile);
    }

    // Endless pagination buttons at bottom of modal
    const prevBtn = this.createPillButton(
      -96,
      218,
      138,
      42,
      this.levelPage > 0 ? 0x3b8eff : 0x9aa8bf,
      this.levelPage > 0 ? 0x1a5fc2 : 0x6f7b91,
      '◀ Prev',
      () => {
        if (this.levelPage <= 0) return;
        this.levelPage -= 1;
        this.closeModal();
        this.showLevelSelectModal();
      },
      '15px',
      true,
    );

    const nextBtn = this.createPillButton(
      96,
      218,
      138,
      42,
      0x3b8eff,
      0x1a5fc2,
      'Next ▶',
      () => {
        this.levelPage += 1;
        this.closeModal();
        this.showLevelSelectModal();
      },
      '15px',
      true,
    );

    modal.add([prevBtn, nextBtn]);
  }

  private showMissionsModal(): void {
    const save = SaveManager.load();
    const modal = this.createModal('Daily & Weekly Missions', 444, 540, 0x9b51e0);

    save.missions.forEach((m, idx) => {
      const y = -168 + idx * 80;
      const done = m.progress >= m.target;
      const rowBg = this.add
        .graphics()
        .fillStyle(0xf0f4fc, 1)
        .fillRoundedRect(-194, y - 30, 388, 66, 14)
        .lineStyle(2, done ? 0x34d349 : 0xd0dced, 1)
        .strokeRoundedRect(-194, y - 30, 388, 66, 14);

      const badge = createCrispText(this, -178, y - 13, `${m.period.toUpperCase()} • ${m.title}`, {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: m.period === 'daily' ? '#2e86ff' : '#9b51e0',
      }).setOrigin(0, 0.5);

      const desc = createCrispText(this, -178, y + 10, `${m.description} (${m.progress}/${m.target})`, {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#344769',
      }).setOrigin(0, 0.5);

      modal.add([rowBg, badge, desc]);

      if (m.claimed) {
        const claimed = createCrispText(this, 136, y, 'Claimed ✓', {
          fontFamily: 'Segoe UI, system-ui, sans-serif',
          fontSize: '14px',
          fontStyle: 'bold',
          color: '#1f9e34',
        }).setOrigin(0.5);
        modal.add(claimed);
      } else if (done) {
        const claimBtn = this.createPillButton(
          132,
          y,
          104,
          36,
          0x34d349,
          0x189629,
          `+${m.rewardCoins} 🪙`,
          () => {
            const res = SaveManager.claimMission(m.id);
            if (res.success) {
              SoundManager.playCoin();
              this.coinsText.setText(`🪙 ${res.data.coins}`);
              this.closeModal();
              this.showMissionsModal();
            }
          },
          '14px',
          true,
        );
        modal.add(claimBtn);
      } else {
        const reward = createCrispText(this, 138, y, `🪙 ${m.rewardCoins}`, {
          fontFamily: 'Segoe UI, system-ui, sans-serif',
          fontSize: '15px',
          fontStyle: 'bold',
          color: '#8f6200',
        }).setOrigin(0.5);
        modal.add(reward);
      }
    });
  }

  private showLeaderboardModal(): void {
    const save = SaveManager.load();
    const totalStars = Object.values(save.starsByLevel).reduce((s, v) => s + v, 0);
    const playerScore = save.stats.levelsWon * 140 + totalStars * 45 + save.coins;

    const rows: LeaderboardRow[] = [
      ...MOCK_RIVALS,
      { name: 'You (Player)', score: playerScore, isPlayer: true },
    ].sort((a, b) => b.score - a.score);

    const modal = this.createModal('Party Leaderboard', 430, 560, 0xff8a1f);
    const colors = Object.values(COLOR_PALETTE).map((c) => c.num);

    rows.slice(0, 9).forEach((r, idx) => {
      const y = -182 + idx * 47;
      const bg = this.add
        .graphics()
        .fillStyle(r.isPlayer ? 0xfff0bd : 0xf1f5fc, 1)
        .fillRoundedRect(-186, y - 19, 372, 40, 12);
      if (r.isPlayer) {
        bg.lineStyle(2.5, 0xffaa00, 1);
        bg.strokeRoundedRect(-186, y - 19, 372, 40, 12);
      }

      const rank = createCrispText(
        this,
        -166,
        y,
        idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`,
        {
          fontFamily: 'Segoe UI, system-ui, sans-serif',
          fontSize: '16px',
          fontStyle: 'bold',
          color: '#344769',
        },
      ).setOrigin(0, 0.5);

      const dot = this.add.circle(-116, y, 10, colors[idx % colors.length]);

      const name = createCrispText(this, -96, y, r.name, {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: '16px',
        fontStyle: 'bold',
        color: r.isPlayer ? '#7a4900' : '#2c4166',
      }).setOrigin(0, 0.5);

      const score = createCrispText(this, 170, y, `${r.score} pts`, {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#1b6dc9',
      }).setOrigin(1, 0.5);

      modal.add([bg, rank, dot, name, score]);
    });
  }

  private showSettingsModal(): void {
    const save = SaveManager.load();
    const modal = this.createModal('Settings', 340, 290, 0x3b8eff);

    const makeToggle = (
      y: number,
      label: string,
      initial: boolean,
      onChange: (next: boolean) => void,
    ) => {
      let current = initial;
      const row = this.add
        .graphics()
        .fillStyle(0xedf3fc, 1)
        .fillRoundedRect(-132, y - 24, 264, 48, 14);
      const txt = createCrispText(this, -112, y, label, {
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
        onChange(current);
        SoundManager.playTap();
      });

      modal.add([row, txt, pill]);
    };

    makeToggle(-42, '🔊  Sound FX', save.settings.soundEnabled, (val) => {
      SaveManager.updateSettings({ soundEnabled: val });
    });
    makeToggle(26, '📳  Vibration', save.settings.vibrationEnabled, (val) => {
      SaveManager.updateSettings({ vibrationEnabled: val });
    });
  }

  private createModal(
    titleText: string,
    w: number,
    h: number,
    accent: number,
  ): Phaser.GameObjects.Container {
    if (this.modalContainer) {
      this.closeModal();
    }

    const dim = this.add
      .rectangle(270, this.metrics.height * 0.5, 540, this.metrics.height, 0x0c162b, 0.58)
      .setDepth(50)
      .setInteractive();

    const modal = this.add.container(270, this.metrics.height * 0.5).setDepth(51);
    modal.setData('dim', dim);

    const card = this.add.graphics();
    card.fillStyle(0xfff9ed, 1);
    card.fillRoundedRect(-w / 2, -h / 2, w, h, 26);
    card.lineStyle(4, accent, 1);
    card.strokeRoundedRect(-w / 2, -h / 2, w, h, 26);

    const ribbon = this.add.graphics();
    ribbon.fillStyle(accent, 1);
    ribbon.fillRoundedRect(-146, -h / 2 - 24, 292, 48, 16);
    ribbon.lineStyle(3, 0xffffff, 1);
    ribbon.strokeRoundedRect(-146, -h / 2 - 24, 292, 48, 16);

    const title = createCrispText(this, 0, -h / 2, titleText, {
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: '21px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    const closeBtn = createCrispText(this, w / 2 - 26, -h / 2 + 26, '✕', {
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#6e7e99',
      padding: { x: 12, y: 10 },
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => {
      SoundManager.playTap();
      this.closeModal();
    });

    modal.add([card, ribbon, title, closeBtn]);
    modal.setScale(0.8).setAlpha(0);
    this.tweens.add({
      targets: modal,
      scale: 1,
      alpha: 1,
      duration: 210,
      ease: 'Back.easeOut',
    });

    this.modalContainer = modal;
    return modal;
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
    fontSize = '18px',
    allowInsideModal = false,
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
      fontSize,
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    c.add([g, txt]);
    c.setSize(w, h);
    c.setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => {
      if (!allowInsideModal && this.modalContainer) return;
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
}
