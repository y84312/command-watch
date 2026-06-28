import { BuildingType, UnitType, ArmorType, WeaponType } from './types';

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface UnitConfig {
  hp: number;
  armor: ArmorType;
  speed: number;
  range: number;
  damage: number;
  cooldown: number;
  weapon: WeaponType;
}

export interface BuildingConfig {
  hp: number;
  armor: ArmorType;
  power: number;
}

export interface GameBalanceConfig {
  startingCredits: number;
  buildTimeMultiplier: number;
  aiInterval: number;
  aiIntervalDemo: number;
  gameSpeed: number;
  demoSpeed: number;
}

export interface DifficultyConfig {
  aiCreditsMultiplier: number;
  aiBuildDelay: number;
  aiAggression: number;
  aiScoutFrequency: number;
  unitDamageMultiplier: number;
  unitSpeedMultiplier: number;
  resourceGatheringMultiplier: number;
}

export interface MapConfig {
  width: number;
  height: number;
  orePatches: number;
  oreAmount: number;
}

export interface FullGameConfig {
  balance: GameBalanceConfig;
  map: MapConfig;
  units: Record<UnitType, UnitConfig>;
  buildings: Record<BuildingType, BuildingConfig>;
  costs: Record<BuildingType | UnitType, number>;
  buildTimes: Record<BuildingType | UnitType, number>;
  sizes: Record<BuildingType | UnitType, { w: number; h: number }>;
  difficulties: Record<Difficulty, DifficultyConfig>;
}

export const DEFAULT_CONFIG: FullGameConfig = {
  balance: {
    startingCredits: 5000,
    buildTimeMultiplier: 1.0,
    aiInterval: 2000,
    aiIntervalDemo: 500,
    gameSpeed: 1.0,
    demoSpeed: 3,
  },
  map: {
    width: 2000,
    height: 2000,
    orePatches: 100,
    oreAmount: 500,
  },
  units: {
    harvester: { hp: 500, armor: 'heavy', speed: 1.5, range: 0, damage: 0, cooldown: 0, weapon: 'bullet' },
    infantry: { hp: 100, armor: 'none', speed: 1.2, range: 150, damage: 15, cooldown: 30, weapon: 'bullet' },
    tank: { hp: 400, armor: 'heavy', speed: 2.0, range: 250, damage: 40, cooldown: 120, weapon: 'cannon' },
  },
  buildings: {
    conyard: { hp: 1000, armor: 'concrete', power: 0 },
    powerplant: { hp: 400, armor: 'concrete', power: 100 },
    refinery: { hp: 800, armor: 'concrete', power: -30 },
    barracks: { hp: 400, armor: 'concrete', power: -10 },
    warfactory: { hp: 800, armor: 'concrete', power: -30 },
    turret: { hp: 400, armor: 'concrete', power: -20 },
  },
  costs: {
    conyard: 2500,
    powerplant: 300,
    refinery: 1000,
    barracks: 300,
    warfactory: 1500,
    turret: 500,
    harvester: 700,
    infantry: 100,
    tank: 600,
  },
  buildTimes: {
    conyard: 10000,
    powerplant: 3000,
    refinery: 10000,
    barracks: 3000,
    warfactory: 15000,
    turret: 4000,
    harvester: 7000,
    infantry: 1000,
    tank: 6000,
  },
  sizes: {
    conyard: { w: 96, h: 96 },
    powerplant: { w: 64, h: 64 },
    refinery: { w: 96, h: 96 },
    barracks: { w: 64, h: 64 },
    warfactory: { w: 96, h: 96 },
    turret: { w: 32, h: 32 },
    harvester: { w: 24, h: 24 },
    infantry: { w: 12, h: 12 },
    tank: { w: 32, h: 32 },
  },
  difficulties: {
    easy: {
      aiCreditsMultiplier: 0.5,
      aiBuildDelay: 2.0,
      aiAggression: 0.3,
      aiScoutFrequency: 0.5,
      unitDamageMultiplier: 0.7,
      unitSpeedMultiplier: 0.9,
      resourceGatheringMultiplier: 0.8,
    },
    normal: {
      aiCreditsMultiplier: 1.0,
      aiBuildDelay: 1.0,
      aiAggression: 0.6,
      aiScoutFrequency: 1.0,
      unitDamageMultiplier: 1.0,
      unitSpeedMultiplier: 1.0,
      resourceGatheringMultiplier: 1.0,
    },
    hard: {
      aiCreditsMultiplier: 1.5,
      aiBuildDelay: 0.5,
      aiAggression: 1.0,
      aiScoutFrequency: 1.5,
      unitDamageMultiplier: 1.3,
      unitSpeedMultiplier: 1.1,
      resourceGatheringMultiplier: 1.2,
    },
  },
};

let currentConfig: FullGameConfig = { ...DEFAULT_CONFIG };

export function getGameConfig(): FullGameConfig {
  return currentConfig;
}

export function setGameConfig(config: Partial<FullGameConfig>): void {
  if (config.balance) currentConfig.balance = { ...currentConfig.balance, ...config.balance };
  if (config.map) currentConfig.map = { ...currentConfig.map, ...config.map };
  if (config.units) currentConfig.units = { ...currentConfig.units, ...config.units };
  if (config.buildings) currentConfig.buildings = { ...currentConfig.buildings, ...config.buildings };
  if (config.costs) currentConfig.costs = { ...currentConfig.costs, ...config.costs };
  if (config.buildTimes) currentConfig.buildTimes = { ...currentConfig.buildTimes, ...config.buildTimes };
  if (config.sizes) currentConfig.sizes = { ...currentConfig.sizes, ...config.sizes };
  if (config.difficulties) currentConfig.difficulties = { ...currentConfig.difficulties, ...config.difficulties };
}

export function resetConfig(): void {
  currentConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}

export function getDifficultyConfig(difficulty: Difficulty): DifficultyConfig {
  return currentConfig.difficulties[difficulty];
}
