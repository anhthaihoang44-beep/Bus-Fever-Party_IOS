import Phaser from 'phaser';

export const LOGICAL_WIDTH = 540;
export const RENDER_SCALE = 1.5;

export interface ScreenMetrics {
  width: number;
  height: number;
  safeTop: number;
  safeBottom: number;
  isTallScreen: boolean;
}

export interface GameLayoutMetrics extends ScreenMetrics {
  headerY: number;
  trackOffsetY: number;
  stripTop: number;
  slotY: number;
  stripBottom: number;
  boosterDockTop: number;
  boosterY: number;
  boardTop: number;
  boardBottom: number;
  boardCenterY: number;
}

/**
 * Computes responsive portrait logical dimensions anchored at 540px width
 * so the game fills 16:9, 19.5:9, and 20:9 mobile screens seamlessly.
 */
export function getScreenMetrics(): ScreenMetrics {
  let aspect = 960 / 540;
  if (typeof window !== 'undefined' && window.innerWidth > 0 && window.innerHeight > 0) {
    aspect = window.innerHeight / window.innerWidth;
  }
  const height = Math.max(860, Math.min(1320, Math.round(LOGICAL_WIDTH * aspect)));
  const isTallScreen = height >= 1040;
  return {
    width: LOGICAL_WIDTH,
    height,
    safeTop: isTallScreen ? 42 : 12,
    safeBottom: isTallScreen ? 26 : 10,
    isTallScreen,
  };
}

/**
 * Applies HiDPI 2x camera zoom mapped cleanly onto the Phaser gameSize [0..540] x [0..height].
 */
export function applyHiDpiCamera(scene: Phaser.Scene): ScreenMetrics {
  const gameW = Math.round(scene.scale.gameSize.width / RENDER_SCALE);
  const gameH = Math.round(scene.scale.gameSize.height / RENDER_SCALE);
  const isTallScreen = gameH >= 1040;

  const cam = scene.cameras.main;
  cam.setZoom(RENDER_SCALE);
  cam.centerOn(gameW * 0.5, gameH * 0.5);

  return {
    width: gameW,
    height: gameH,
    safeTop: isTallScreen ? 42 : 12,
    safeBottom: isTallScreen ? 26 : 10,
    isTallScreen,
  };
}

/**
 * Shared responsive layout metrics for GameScene and UIScene.
 */
export function getGameLayoutMetrics(m: ScreenMetrics): GameLayoutMetrics {
  const headerY = m.safeTop + 26;
  const extraSpace = Math.max(0, m.height - 960);
  const trackOffsetY = m.safeTop + Math.round(extraSpace * 0.14);
  const stripTop = 320 + trackOffsetY;
  const slotY = stripTop + 56;
  const stripBottom = stripTop + 108;

  const boosterDockTop = m.height - m.safeBottom - 92;
  const boosterY = m.height - m.safeBottom - 46;
  const boardTop = stripBottom + 8;
  const boardBottom = boosterDockTop - 10;
  const boardCenterY = Math.round((boardTop + boardBottom) * 0.5);

  return {
    ...m,
    headerY,
    trackOffsetY,
    stripTop,
    slotY,
    stripBottom,
    boosterDockTop,
    boosterY,
    boardTop,
    boardBottom,
    boardCenterY,
  };
}

/**
 * Creates crisp 2x-rasterized Phaser Text.
 */
export function createCrispText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  style: Phaser.Types.GameObjects.Text.TextStyle,
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, text, {
    ...style,
    resolution: RENDER_SCALE,
  } as Phaser.Types.GameObjects.Text.TextStyle);
}
