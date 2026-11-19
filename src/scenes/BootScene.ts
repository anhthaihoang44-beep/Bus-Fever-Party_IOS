import Phaser from 'phaser';
import { LevelLoader } from '../utils/LevelLoader';
import { applyHiDpiCamera, createCrispText } from '../utils/ResponsiveLayout';
import { TextureFactory } from '../utils/TextureFactory';

/**
 * Branded mobile splash & texture warm-up scene displayed on app launch.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  public create(): void {
    const m = applyHiDpiCamera(this);
    TextureFactory.ensureAll(this);

    const params =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams();
    const holdSplash = params.get('holdSplash') === '1';

    if (!holdSplash) {
      const directLevel = Number(params.get('level'));
      if (Number.isInteger(directLevel) && directLevel >= 1 && LevelLoader.getLevel(directLevel)) {
        this.scene.start('GameScene', { levelId: directLevel });
        return;
      }
      if (params.get('event') === '1') {
        const evt = LevelLoader.getEventLevel();
        if (evt) {
          this.scene.start('GameScene', { levelId: evt.id, isEvent: true });
          return;
        }
      }
      if (params.get('skipSplash') === '1' || params.get('modal')) {
        this.scene.start('HomeScene', { modal: params.get('modal') ?? undefined });
        return;
      }
    }

    const H = m.height;
    const g = this.add.graphics();
    g.fillStyle(0x6ab9ff, 1);
    g.fillRect(0, 0, m.width, H);
    g.fillStyle(0x47a4ff, 1);
    g.fillRect(0, 0, m.width, Math.round(H * 0.45));

    // Stylized green hills filling bottom cleanly for any screen height
    const hillY = Math.round(H * 0.78);
    g.fillStyle(0x7be061, 1);
    g.fillEllipse(270, hillY, 820, Math.round(H * 0.58));
    g.fillStyle(0x5ec746, 1);
    g.fillEllipse(270, hillY + 35, 760, Math.round(H * 0.52));

    // Curved highway ribbon extending edge-to-edge
    const arcCenterY = Math.round(H * 0.84);
    g.lineStyle(58, 0x5c667a, 1);
    g.beginPath();
    g.arc(270, arcCenterY, 336, Math.PI * 1.06, Math.PI * 1.94, false);
    g.strokePath();

    g.lineStyle(4, 0xffd24d, 0.9);
    g.beginPath();
    g.arc(270, arcCenterY, 336, Math.PI * 1.07, Math.PI * 1.93, false);
    g.strokePath();

    const logoY = Math.round(H * 0.22);
    const logo = this.add.container(270, logoY);
    const pill = this.add.graphics();
    pill.fillStyle(0x173566, 0.35);
    pill.fillRoundedRect(-182, -58, 364, 128, 30);
    pill.fillStyle(0x2e86ff, 1);
    pill.fillRoundedRect(-182, -64, 364, 126, 30);
    pill.lineStyle(4.5, 0xffffff, 1);
    pill.strokeRoundedRect(-182, -64, 364, 126, 30);

    const title = createCrispText(this, 0, -18, 'BUS FEVER', {
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: '44px',
      fontStyle: 'bold',
      color: '#ffe047',
      stroke: '#163570',
      strokeThickness: 8,
    }).setOrigin(0.5);

    const sub = createCrispText(this, 0, 30, 'PARTY PASSENGER LOOP', {
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#163570',
      strokeThickness: 4,
    }).setOrigin(0.5);

    logo.add([pill, title, sub]);

    const busY = arcCenterY - 322;
    const bus1 = this.add.image(270, busY, 'bus-orange').setDisplaySize(172, 92).setAngle(-5);
    const bus2 = this.add.image(152, busY + 46, 'bus-pink').setDisplaySize(102, 56).setAngle(-18);
    const bus3 = this.add.image(388, busY + 46, 'bus-cyan').setDisplaySize(102, 56).setAngle(16).setFlipX(true);

    this.tweens.add({
      targets: bus1,
      y: busY - 10,
      duration: 520,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const barW = 320;
    const barH = 26;
    const barX = 270 - barW / 2;
    const barY = H - m.safeBottom - 96;

    const barBg = this.add.graphics();
    barBg.fillStyle(0x1a3057, 0.78);
    barBg.fillRoundedRect(barX, barY, barW, barH, 13);
    barBg.lineStyle(3, 0xffffff, 0.9);
    barBg.strokeRoundedRect(barX, barY, barW, barH, 13);

    const barFill = this.add.graphics();
    const pctText = createCrispText(this, 270, barY - 22, 'Loading... 0%', {
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: '17px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#1a3057',
      strokeThickness: 4,
    }).setOrigin(0.5);

    const progressObj = { value: 0 };
    this.tweens.add({
      targets: progressObj,
      value: holdSplash ? 0.85 : 1,
      duration: holdSplash ? 200 : 650,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        const pct = Math.round(progressObj.value * 100);
        pctText.setText(`Loading... ${pct}%`);
        barFill.clear();
        const fillW = Math.max(18, (barW - 8) * progressObj.value);
        barFill.fillStyle(0x34d349, 1);
        barFill.fillRoundedRect(barX + 4, barY + 4, fillW, barH - 8, 9);
      },
      onComplete: () => {
        if (holdSplash) return;
        this.scene.start('HomeScene');
      },
    });

    void [bus2, bus3];
  }
}
