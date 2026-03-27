export type PlayerId = 1 | 2;

export type BuildingType = 'conyard' | 'powerplant' | 'refinery' | 'barracks' | 'warfactory' | 'turret';
export type UnitType = 'harvester' | 'infantry' | 'tank';

export type ArmorType = 'none' | 'light' | 'heavy' | 'concrete';
export type WeaponType = 'bullet' | 'cannon';

export interface Position {
  x: number;
  y: number;
}

export interface Rect extends Position {
  w: number;
  h: number;
}

export interface PlayerState {
  id: PlayerId;
  credits: number;
  power: number;
  maxPower: number;
  color: string;
}

export interface GameState {
  players: Record<PlayerId, PlayerState>;
  buildQueue: {
    type: BuildingType | UnitType;
    progress: number;
    status: 'building' | 'ready';
  } | null;
  placingBuilding: BuildingType | null;
}
