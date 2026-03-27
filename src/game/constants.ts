import { BuildingType, UnitType, ArmorType, WeaponType } from './types';

export const COSTS: Record<BuildingType | UnitType, number> = {
  conyard: 2500,
  powerplant: 300,
  refinery: 1000,
  barracks: 300,
  warfactory: 1500,
  turret: 500,
  harvester: 700,
  infantry: 100,
  tank: 600,
};

export const BUILD_TIMES: Record<BuildingType | UnitType, number> = {
  conyard: 10000,
  powerplant: 3000,
  refinery: 10000,
  barracks: 3000,
  warfactory: 15000,
  turret: 4000,
  harvester: 7000,
  infantry: 1000,
  tank: 6000,
};

export const POWER: Record<BuildingType, number> = {
  conyard: 0,
  powerplant: 100,
  refinery: -30,
  barracks: -10,
  warfactory: -30,
  turret: -20,
};

export const SIZES: Record<BuildingType | UnitType, { w: number; h: number }> = {
  conyard: { w: 96, h: 96 },
  powerplant: { w: 64, h: 64 },
  refinery: { w: 96, h: 96 },
  barracks: { w: 64, h: 64 },
  warfactory: { w: 96, h: 96 },
  turret: { w: 32, h: 32 },
  harvester: { w: 24, h: 24 },
  infantry: { w: 12, h: 12 },
  tank: { w: 32, h: 32 },
};

export const STATS: Record<UnitType | BuildingType, { hp: number; armor: ArmorType; speed?: number; range?: number; damage?: number; cooldown?: number; weapon?: WeaponType }> = {
  conyard: { hp: 1000, armor: 'concrete' },
  powerplant: { hp: 400, armor: 'concrete' },
  refinery: { hp: 800, armor: 'concrete' },
  barracks: { hp: 400, armor: 'concrete' },
  warfactory: { hp: 800, armor: 'concrete' },
  turret: { hp: 400, armor: 'concrete', range: 200, damage: 25, cooldown: 40, weapon: 'bullet' },
  harvester: { hp: 500, armor: 'heavy', speed: 1.5, range: 0, damage: 0, cooldown: 0 },
  infantry: { hp: 100, armor: 'none', speed: 1.2, range: 150, damage: 15, cooldown: 30, weapon: 'bullet' },
  tank: { hp: 400, armor: 'heavy', speed: 2.0, range: 250, damage: 40, cooldown: 120, weapon: 'cannon' },
};

export const MAP_SIZE = { w: 2000, h: 2000 };
