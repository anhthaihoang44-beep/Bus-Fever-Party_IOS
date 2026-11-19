/**
 * Core types and visual constants for Bus Fever: Party Passenger Loop.
 */

export type BusColor =
  | 'pink'
  | 'orange'
  | 'green'
  | 'purple'
  | 'yellow'
  | 'cyan'
  | 'blue'
  | 'red'
  | 'brown'
  | 'navy';

export type Direction =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'up-left'
  | 'up-right'
  | 'down-left'
  | 'down-right';

export type BusType = 'normal' | 'mystery';

export type TrackShape = 'ring' | 'heart' | 'snake' | 'figure8';

export type ThemeId = 'city' | 'park' | 'maple';

export type BoosterType = 'vip' | 'arrange' | 'jumble';

export type GameStatus = 'playing' | 'won' | 'lost' | 'paused';

export interface BusConfig {
  id: string;
  color: BusColor;
  capacity: number;
  x: number;
  y: number;
  direction: Direction;
  type: BusType;
  /** Number of buses that must exit the board before a mystery bus unlocks. */
  unlockAfter?: number;
  /** Optional footprint length along direction in grid units (default 1.72). */
  length?: number;
  /** Optional footprint width perpendicular to direction in grid units (default 0.82). */
  width?: number;
}

export interface ObstacleConfig {
  id: string;
  x: number;
  y: number;
  /** Width in grid units (default 0.88). */
  width?: number;
  /** Height in grid units (default 0.88). */
  height?: number;
  /** Rotation angle in degrees (default 0). */
  angle?: number;
}

export interface PassengerSegment {
  color: BusColor;
  count: number;
}

export interface BoostersAvailableConfig {
  vip?: boolean;
  arrange?: boolean;
  jumble?: boolean;
}

export interface LevelConfig {
  id: number;
  name?: string;
  isEvent?: boolean;
  eventName?: string;
  gridSize: {
    cols: number;
    rows: number;
  };
  buses: BusConfig[];
  obstacles: ObstacleConfig[];
  passengerQueue: PassengerSegment[];
  trackShape: TrackShape;
  theme: ThemeId;
  /** Number of normal parking slots initially unlocked (default 3). */
  slotsUnlocked: number;
  /** Whether VIP slot starts unlocked (default false). */
  vipUnlocked?: boolean;
  boostersAvailable: BoostersAvailableConfig;
  undoLimit?: number;
  tutorialHint?: string;
}

export type BusLocationState = 'board' | 'driving_to_slot' | 'parked' | 'departing' | 'departed';

export interface BusRuntime extends BusConfig {
  /** Remaining buses needed to exit before this mystery bus unlocks (0 = unlocked). */
  mysteryRemaining: number;
  /** True once unlocked (always true for 'normal' buses). */
  unlocked: boolean;
  /** Current lifecycle state. */
  state: BusLocationState;
  /** Number of passengers currently seated. */
  boarded: number;
  /** Assigned parking slot index if driving_to_slot or parked. */
  slotIndex: number | null;
}

export type SlotKind = 'vip' | 'normal' | 'extra';

export interface ParkingSlotState {
  index: number;
  kind: SlotKind;
  unlocked: boolean;
  busId: string | null;
}

export interface PassengerEntity {
  id: number;
  color: BusColor;
}

export interface ColorStyle {
  id: BusColor;
  label: string;
  hex: string;
  num: number;
  lightNum: number;
  darkNum: number;
  textHex: string;
}

export const COLOR_PALETTE: Record<BusColor, ColorStyle> = {
  pink: {
    id: 'pink',
    label: 'Pink',
    hex: '#FF4F9A',
    num: 0xff4f9a,
    lightNum: 0xff8ec0,
    darkNum: 0xc21e66,
    textHex: '#FFFFFF',
  },
  orange: {
    id: 'orange',
    label: 'Orange',
    hex: '#FF8A1F',
    num: 0xff8a1f,
    lightNum: 0xffb866,
    darkNum: 0xc75600,
    textHex: '#FFFFFF',
  },
  green: {
    id: 'green',
    label: 'Green',
    hex: '#34D349',
    num: 0x34d349,
    lightNum: 0x77f084,
    darkNum: 0x159427,
    textHex: '#FFFFFF',
  },
  purple: {
    id: 'purple',
    label: 'Purple',
    hex: '#9B51E0',
    num: 0x9b51e0,
    lightNum: 0xc48df7,
    darkNum: 0x6724ab,
    textHex: '#FFFFFF',
  },
  yellow: {
    id: 'yellow',
    label: 'Yellow',
    hex: '#FFC814',
    num: 0xffc814,
    lightNum: 0xffe26b,
    darkNum: 0xc78f00,
    textHex: '#432B00',
  },
  cyan: {
    id: 'cyan',
    label: 'Cyan',
    hex: '#1BD3E8',
    num: 0x1bd3e8,
    lightNum: 0x74ecfa,
    darkNum: 0x0794a8,
    textHex: '#043840',
  },
  blue: {
    id: 'blue',
    label: 'Blue',
    hex: '#2E86FF',
    num: 0x2e86ff,
    lightNum: 0x75b2ff,
    darkNum: 0x1153bf,
    textHex: '#FFFFFF',
  },
  red: {
    id: 'red',
    label: 'Red',
    hex: '#F53B45',
    num: 0xf53b45,
    lightNum: 0xff7b82,
    darkNum: 0xb31420,
    textHex: '#FFFFFF',
  },
  brown: {
    id: 'brown',
    label: 'Brown',
    hex: '#8D5534',
    num: 0x8d5534,
    lightNum: 0xb87e5b,
    darkNum: 0x593018,
    textHex: '#FFFFFF',
  },
  navy: {
    id: 'navy',
    label: 'Navy',
    hex: '#344B7E',
    num: 0x344b7e,
    lightNum: 0x5d78b5,
    darkNum: 0x1c2b4f,
    textHex: '#FFFFFF',
  },
};

export interface MissionProgress {
  id: string;
  title: string;
  description: string;
  period: 'daily' | 'weekly';
  target: number;
  progress: number;
  rewardCoins: number;
  claimed: boolean;
}

export interface SaveData {
  highestUnlockedLevel: number;
  currentLevel: number;
  coins: number;
  starsByLevel: Record<number, number>;
  boosterCounts: Record<BoosterType, number>;
  settings: {
    soundEnabled: boolean;
    vibrationEnabled: boolean;
  };
  stats: {
    levelsWon: number;
    busesExited: number;
    passengersBoarded: number;
    boostersUsed: number;
    eventCompleted: boolean;
  };
  missions: MissionProgress[];
}

export const BOOSTER_UNLOCK_LEVEL: Record<BoosterType, number> = {
  vip: 4,
  arrange: 8,
  jumble: 13,
};

export const BOOSTER_COST_COINS: Record<BoosterType, number> = {
  vip: 60,
  arrange: 80,
  jumble: 80,
};

export const TOTAL_PARKING_SLOTS = 7; // Index 0 = VIP, 1..3 = normal, 4..6 = locked '+'
