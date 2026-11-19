import Phaser from 'phaser';
import { COLOR_PALETTE, type BusColor } from '../types/game';

const S = 2; // 2x HiDPI texture oversampling for razor-sharp mobile rendering

/**
 * Generates crisp 2x HiDPI stylized 3D-look procedural textures using Phaser Graphics.
 * Textures are isolated behind clean keys so external sprite sheets can replace them later.
 */
export class TextureFactory {
  private static generated = false;

  public static ensureAll(scene: Phaser.Scene): void {
    if (this.generated && scene.textures.exists('bus-blue')) {
      return;
    }

    const colors = Object.keys(COLOR_PALETTE) as BusColor[];
    for (const color of colors) {
      this.createBusTexture(scene, color);
      this.createPassengerTexture(scene, color);
    }

    this.createMysteryBusTexture(scene);
    this.createObstacleTexture(scene);
    this.createWhiteArrowTexture(scene);
    this.createDustTexture(scene);
    this.createConfettiTexture(scene);
    this.createTutorialHandTexture(scene);
    this.createBoosterIcons(scene);

    this.generated = true;
  }

  private static createBusTexture(scene: Phaser.Scene, color: BusColor): void {
    const key = `bus-${color}`;
    if (scene.textures.exists(key)) return;

    const style = COLOR_PALETTE[color];
    const w = 180;
    const h = 96;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);

    // Wheels
    g.fillStyle(0x252d3d, 1);
    g.fillRoundedRect(34 * S, 6 * S, 26 * S, 12 * S, 5 * S);
    g.fillRoundedRect(114 * S, 6 * S, 26 * S, 12 * S, 5 * S);
    g.fillRoundedRect(34 * S, (h - 18) * S, 26 * S, 12 * S, 5 * S);
    g.fillRoundedRect(114 * S, (h - 18) * S, 26 * S, 12 * S, 5 * S);

    // Soft drop shadow
    g.fillStyle(0x0d1b33, 0.24);
    g.fillRoundedRect(12 * S, 16 * S, 156 * S, 74 * S, 22 * S);

    // Lower 3D extrusion
    g.fillStyle(style.darkNum, 1);
    g.fillRoundedRect(10 * S, 14 * S, 156 * S, 68 * S, 20 * S);

    // Main bright body
    g.fillStyle(style.num, 1);
    g.fillRoundedRect(10 * S, 10 * S, 156 * S, 62 * S, 20 * S);

    // Raised roof panel
    g.fillStyle(style.lightNum, 0.9);
    g.fillRoundedRect(24 * S, 17 * S, 104 * S, 46 * S, 14 * S);

    // Glossy roof specular highlight strip
    g.fillStyle(0xffffff, 0.35);
    g.fillRoundedRect(32 * S, 20 * S, 86 * S, 10 * S, 5 * S);

    // Front panoramic windshield
    g.fillStyle(0x24344d, 1);
    g.fillRoundedRect(132 * S, 16 * S, 24 * S, 48 * S, 9 * S);
    g.fillStyle(0x8fd6ff, 0.5);
    g.fillRoundedRect(136 * S, 20 * S, 8 * S, 22 * S, 4 * S);
    g.fillStyle(0xffffff, 0.55);
    g.fillRoundedRect(136 * S, 46 * S, 6 * S, 10 * S, 3 * S);

    // Rear window
    g.fillStyle(0x24344d, 0.85);
    g.fillRoundedRect(15 * S, 22 * S, 10 * S, 36 * S, 4 * S);

    // Headlights
    g.fillStyle(0xfff3a1, 1);
    g.fillRoundedRect(160 * S, 18 * S, 6 * S, 12 * S, 3 * S);
    g.fillRoundedRect(160 * S, 50 * S, 6 * S, 12 * S, 3 * S);

    // Outer highlight rim
    g.lineStyle(2 * S, 0xffffff, 0.25);
    g.strokeRoundedRect(11 * S, 11 * S, 154 * S, 60 * S, 19 * S);

    g.generateTexture(key, w * S, h * S);
    g.destroy();
  }

  private static createMysteryBusTexture(scene: Phaser.Scene): void {
    const key = 'bus-mystery';
    if (scene.textures.exists(key)) return;

    const w = 180;
    const h = 96;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);

    g.fillStyle(0x0d1b33, 0.24);
    g.fillRoundedRect(12 * S, 16 * S, 156 * S, 74 * S, 22 * S);

    g.fillStyle(0x414a63, 1);
    g.fillRoundedRect(10 * S, 14 * S, 156 * S, 68 * S, 20 * S);

    g.fillStyle(0x697494, 1);
    g.fillRoundedRect(10 * S, 10 * S, 156 * S, 62 * S, 20 * S);

    g.fillStyle(0x525c78, 1);
    g.fillRoundedRect(36 * S, 12 * S, 12 * S, 58 * S, 4 * S);
    g.fillRoundedRect(124 * S, 12 * S, 12 * S, 58 * S, 4 * S);

    g.fillStyle(0x2c344a, 0.85);
    g.fillCircle(88 * S, 41 * S, 24 * S);
    g.lineStyle(3 * S, 0xb8c4e0, 0.65);
    g.strokeCircle(88 * S, 41 * S, 24 * S);

    g.generateTexture(key, w * S, h * S);
    g.destroy();
  }

  private static createObstacleTexture(scene: Phaser.Scene): void {
    const key = 'obstacle-wood';
    if (scene.textures.exists(key)) return;

    const size = 100;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);

    g.fillStyle(0x132038, 0.22);
    g.fillRoundedRect(8 * S, 14 * S, 84 * S, 82 * S, 16 * S);

    g.fillStyle(0xa87c49, 1);
    g.fillRoundedRect(6 * S, 10 * S, 88 * S, 84 * S, 16 * S);

    g.fillStyle(0xe8c594, 1);
    g.fillRoundedRect(6 * S, 4 * S, 88 * S, 80 * S, 16 * S);

    g.fillStyle(0xd9b079, 1);
    g.fillRoundedRect(14 * S, 12 * S, 72 * S, 64 * S, 10 * S);

    g.lineStyle(3 * S, 0xb88b54, 0.65);
    g.lineBetween(16 * S, 34 * S, 84 * S, 34 * S);
    g.lineBetween(16 * S, 54 * S, 84 * S, 54 * S);

    g.lineStyle(5 * S, 0x9e713c, 0.45);
    g.lineBetween(24 * S, 22 * S, 76 * S, 66 * S);
    g.lineBetween(76 * S, 22 * S, 24 * S, 66 * S);

    g.fillStyle(0x8c6230, 0.75);
    g.fillCircle(19 * S, 17 * S, 3.5 * S);
    g.fillCircle(81 * S, 17 * S, 3.5 * S);
    g.fillCircle(19 * S, 71 * S, 3.5 * S);
    g.fillCircle(81 * S, 71 * S, 3.5 * S);

    g.generateTexture(key, size * S, size * S);
    g.destroy();
  }

  private static createWhiteArrowTexture(scene: Phaser.Scene): void {
    const key = 'arrow-white';
    if (scene.textures.exists(key)) return;

    const w = 68;
    const h = 44;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);

    g.fillStyle(0x000000, 0.2);
    g.fillRoundedRect(8 * S, 16 * S, 30 * S, 14 * S, 5 * S);
    g.fillTriangle(34 * S, 7 * S, 62 * S, 23 * S, 34 * S, 39 * S);

    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(8 * S, 14 * S, 30 * S, 14 * S, 5 * S);
    g.fillTriangle(34 * S, 5 * S, 62 * S, 21 * S, 34 * S, 37 * S);

    g.generateTexture(key, w * S, h * S);
    g.destroy();
  }

  private static createPassengerTexture(scene: Phaser.Scene, color: BusColor): void {
    const key = `passenger-${color}`;
    if (scene.textures.exists(key)) return;

    const style = COLOR_PALETTE[color];
    const size = 48;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);

    g.fillStyle(0x0e182b, 0.25);
    g.fillEllipse(24 * S, 39 * S, 28 * S, 12 * S);

    g.fillStyle(style.darkNum, 1);
    g.fillRoundedRect(9 * S, 20 * S, 30 * S, 19 * S, 10 * S);

    g.fillStyle(style.num, 1);
    g.fillRoundedRect(10 * S, 18 * S, 28 * S, 17 * S, 9 * S);

    g.fillStyle(style.darkNum, 1);
    g.fillCircle(24 * S, 16 * S, 12 * S);
    g.fillStyle(style.num, 1);
    g.fillCircle(24 * S, 14.5 * S, 11.5 * S);

    g.fillStyle(0xffffff, 0.42);
    g.fillEllipse(20 * S, 10 * S, 9 * S, 5 * S);

    g.fillStyle(0x1d2538, 0.8);
    g.fillCircle(20.5 * S, 16 * S, 1.7 * S);
    g.fillCircle(27.5 * S, 16 * S, 1.7 * S);

    g.generateTexture(key, size * S, size * S);
    g.destroy();
  }

  private static createDustTexture(scene: Phaser.Scene): void {
    const key = 'dust-puff';
    if (scene.textures.exists(key)) return;

    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(16 * S, 16 * S, 11 * S);
    g.fillCircle(10 * S, 18 * S, 7 * S);
    g.fillCircle(22 * S, 18 * S, 7 * S);
    g.generateTexture(key, 32 * S, 32 * S);
    g.destroy();
  }

  private static createConfettiTexture(scene: Phaser.Scene): void {
    const key = 'confetti-piece';
    if (scene.textures.exists(key)) return;

    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(0, 0, 14 * S, 9 * S, 3 * S);
    g.generateTexture(key, 14 * S, 9 * S);
    g.destroy();
  }

  private static createTutorialHandTexture(scene: Phaser.Scene): void {
    const key = 'tutorial-hand';
    if (scene.textures.exists(key)) return;

    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x0d1b33, 0.25);
    g.fillRoundedRect(18 * S, 22 * S, 36 * S, 40 * S, 14 * S);
    g.fillRoundedRect(24 * S, 6 * S, 14 * S, 30 * S, 7 * S);

    g.fillStyle(0xffffff, 1);
    g.lineStyle(3 * S, 0x304569, 1);
    g.fillRoundedRect(16 * S, 20 * S, 36 * S, 38 * S, 13 * S);
    g.strokeRoundedRect(16 * S, 20 * S, 36 * S, 38 * S, 13 * S);
    g.fillRoundedRect(22 * S, 4 * S, 14 * S, 30 * S, 7 * S);
    g.strokeRoundedRect(22 * S, 4 * S, 14 * S, 30 * S, 7 * S);
    g.lineStyle(2.5 * S, 0x7b93b8, 0.8);
    g.lineBetween(24 * S, 33 * S, 24 * S, 45 * S);
    g.lineBetween(33 * S, 33 * S, 33 * S, 45 * S);
    g.lineBetween(42 * S, 35 * S, 42 * S, 45 * S);

    g.generateTexture(key, 70 * S, 70 * S);
    g.destroy();
  }

  private static createBoosterIcons(scene: Phaser.Scene): void {
    if (!scene.textures.exists('icon-lock')) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      g.lineStyle(5 * S, 0xffd24d, 1);
      g.strokeRoundedRect(14 * S, 6 * S, 20 * S, 20 * S, 10 * S);
      g.fillStyle(0xc98300, 1);
      g.fillRoundedRect(10 * S, 21 * S, 28 * S, 22 * S, 6 * S);
      g.fillStyle(0xffc814, 1);
      g.fillRoundedRect(10 * S, 18 * S, 28 * S, 21 * S, 6 * S);
      g.fillStyle(0x523400, 1);
      g.fillCircle(24 * S, 27 * S, 3.2 * S);
      g.fillRoundedRect(22.5 * S, 28 * S, 3 * S, 6 * S, 1.5 * S);
      g.generateTexture('icon-lock', 48 * S, 48 * S);
      g.destroy();
    }

    if (!scene.textures.exists('icon-vip')) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xc75600, 1);
      g.fillRoundedRect(6 * S, 17 * S, 42 * S, 24 * S, 8 * S);
      g.fillStyle(0xff9b1f, 1);
      g.fillRoundedRect(6 * S, 13 * S, 42 * S, 22 * S, 8 * S);
      g.fillStyle(0xffe169, 1);
      g.fillRoundedRect(11 * S, 16 * S, 24 * S, 15 * S, 5 * S);
      g.fillStyle(0x24344d, 1);
      g.fillRoundedRect(37 * S, 16 * S, 7 * S, 15 * S, 3 * S);
      g.fillStyle(0xffdf4d, 1);
      g.fillCircle(42 * S, 10 * S, 6 * S);
      g.generateTexture('icon-vip', 54 * S, 46 * S);
      g.destroy();
    }

    if (!scene.textures.exists('icon-arrange')) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0x2e86ff, 1);
      g.fillRoundedRect(5 * S, 20 * S, 24 * S, 14 * S, 5 * S);
      g.fillStyle(0x34d349, 1);
      g.fillRoundedRect(15 * S, 11 * S, 24 * S, 14 * S, 5 * S);
      g.fillStyle(0xffc814, 1);
      g.fillRoundedRect(25 * S, 22 * S, 24 * S, 14 * S, 5 * S);
      g.lineStyle(3 * S, 0xffffff, 0.95);
      g.lineBetween(10 * S, 9 * S, 44 * S, 9 * S);
      g.fillStyle(0xffffff, 1);
      g.fillTriangle(40 * S, 4 * S, 48 * S, 9 * S, 40 * S, 14 * S);
      g.generateTexture('icon-arrange', 54 * S, 46 * S);
      g.destroy();
    }

    if (!scene.textures.exists('icon-jumble')) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0x1f2d47, 0.25);
      g.fillCircle(27 * S, 25 * S, 18 * S);
      g.fillStyle(0xff4f9a, 1);
      g.slice(27 * S, 22 * S, 17 * S, 0, Math.PI * 0.5, false);
      g.fillPath();
      g.fillStyle(0x2e86ff, 1);
      g.slice(27 * S, 22 * S, 17 * S, Math.PI * 0.5, Math.PI, false);
      g.fillPath();
      g.fillStyle(0xffc814, 1);
      g.slice(27 * S, 22 * S, 17 * S, Math.PI, Math.PI * 1.5, false);
      g.fillPath();
      g.fillStyle(0x34d349, 1);
      g.slice(27 * S, 22 * S, 17 * S, Math.PI * 1.5, Math.PI * 2, false);
      g.fillPath();
      g.lineStyle(2.5 * S, 0xffffff, 0.9);
      g.strokeCircle(27 * S, 22 * S, 17 * S);
      g.fillStyle(0xffffff, 0.55);
      g.fillCircle(21 * S, 15 * S, 4 * S);
      g.generateTexture('icon-jumble', 54 * S, 46 * S);
      g.destroy();
    }
  }
}
