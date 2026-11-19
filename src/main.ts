import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { HomeScene } from './scenes/HomeScene';
import { UIScene } from './scenes/UIScene';
import { RENDER_SCALE, getScreenMetrics } from './utils/ResponsiveLayout';

const metrics = getScreenMetrics();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.CANVAS,
  parent: 'app',
  width: Math.round(metrics.width * RENDER_SCALE),
  height: Math.round(metrics.height * RENDER_SCALE),
  backgroundColor: '#47a4ff',
  antialias: true,
  roundPixels: false,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, HomeScene, GameScene, UIScene],
};

const game = new Phaser.Game(config);

if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    const next = getScreenMetrics();
    const targetW = Math.round(next.width * RENDER_SCALE);
    const targetH = Math.round(next.height * RENDER_SCALE);
    if (Math.abs(game.scale.gameSize.height - targetH) > 8) {
      game.scale.setGameSize(targetW, targetH);
    }
  });
}
