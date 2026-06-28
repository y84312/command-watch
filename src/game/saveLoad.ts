import { GameState, PlayerId, BuildingType, UnitType } from './types';
import { Building, Unit, Ore } from './entities';

const SAVE_PREFIX = 'commandwatch_save_';
const AUTOSAVE_KEY = 'commandwatch_autosave';
const SETTINGS_KEY = 'commandwatch_settings';

export interface SaveMeta {
  name: string;
  timestamp: number;
  gameTime: number;
  playerCredits: number;
  aiCredits: number;
}

export interface SerializedGameState {
  version: number;
  timestamp: number;
  gameTime: number;
  players: GameState['players'];
  buildings: Array<{
    id: number; x: number; y: number; w: number; h: number;
    player: PlayerId; hp: number; maxHp: number; type: BuildingType;
    active: boolean; cooldown: number;
  }>;
  units: Array<{
    id: number; x: number; y: number; w: number; h: number;
    player: PlayerId; hp: number; maxHp: number; type: UnitType;
    state: string; cooldown: number; load: number;
    targetPos: { x: number; y: number } | null;
    targetEntityId: number | null;
  }>;
  ores: Array<{
    id: number; x: number; y: number; w: number; h: number;
    amount: number;
  }>;
  buildQueue: {
    type: BuildingType | UnitType;
    progress: number;
    status: 'building' | 'ready';
  } | null;
  placingBuilding: BuildingType | null;
  aiState: string;
  aiTimer: number;
  aiScoutedBase: Record<PlayerId, boolean>;
  camera: { x: number; y: number };
}

export interface GameSettings {
  soundEnabled: boolean;
  musicEnabled: boolean;
  volume: number;
  showFps: boolean;
  showMinimap: boolean;
  difficulty: 'easy' | 'normal' | 'hard';
  gameSpeed: number;
  keyboardLayout: 'default' | 'custom';
}

const DEFAULT_SETTINGS: GameSettings = {
  soundEnabled: true,
  musicEnabled: true,
  volume: 0.5,
  showFps: true,
  showMinimap: true,
  difficulty: 'normal',
  gameSpeed: 1.0,
  keyboardLayout: 'default',
};

export function serializeGameState(
  gameState: GameState,
  buildings: Building[],
  units: Unit[],
  ores: Ore[],
  buildQueue: SerializedGameState['buildQueue'],
  placingBuilding: BuildingType | null,
  aiState: string,
  aiTimer: number,
  aiScoutedBase: Record<PlayerId, boolean>,
  camera: { x: number; y: number },
  gameTime: number,
): SerializedGameState {
  // Build entity ID map for target references
  const entityMap = new Map<string, number>();
  buildings.forEach(b => entityMap.set(`b_${b.id}`, b.id));
  units.forEach(u => entityMap.set(`u_${u.id}`, u.id));

  return {
    version: 1,
    timestamp: Date.now(),
    gameTime,
    players: {
      1: { ...gameState.players[1] },
      2: { ...gameState.players[2] },
    },
    buildings: buildings.map(b => ({
      id: b.id, x: b.x, y: b.y, w: b.w, h: b.h,
      player: b.player, hp: b.hp, maxHp: b.maxHp, type: b.type,
      active: b.active, cooldown: b.cooldown,
    })),
    units: units.map(u => ({
      id: u.id, x: u.x, y: u.y, w: u.w, h: u.h,
      player: u.player, hp: u.hp, maxHp: u.maxHp, type: u.type,
      state: u.state, cooldown: u.cooldown, load: u.load,
      targetPos: u.targetPos ? { ...u.targetPos } : null,
      targetEntityId: u.targetEntity?.id ?? null,
    })),
    ores: ores.map(o => ({
      id: o.id, x: o.x, y: o.y, w: o.w, h: o.h, amount: o.amount,
    })),
    buildQueue: buildQueue ? { ...buildQueue } : null,
    placingBuilding,
    aiState,
    aiTimer,
    aiScoutedBase: { ...aiScoutedBase },
    camera: { ...camera },
  };
}

export function saveGame(
  name: string,
  serialized: SerializedGameState,
): void {
  try {
    localStorage.setItem(SAVE_PREFIX + name, JSON.stringify(serialized));
    // Update save list
    const list = getSaveList();
    list.push({
      name,
      timestamp: serialized.timestamp,
      gameTime: serialized.gameTime,
      playerCredits: serialized.players[1].credits,
      aiCredits: serialized.players[2].credits,
    });
    localStorage.setItem(SAVE_PREFIX + 'list', JSON.stringify(list));
  } catch (e) {
    console.error('Failed to save game:', e);
    throw new Error('Failed to save game. Storage may be full.');
  }
}

export function loadGame(name: string): SerializedGameState {
  const data = localStorage.getItem(SAVE_PREFIX + name);
  if (!data) throw new Error(`Save "${name}" not found`);
  return JSON.parse(data) as SerializedGameState;
}

export function deleteSave(name: string): void {
  localStorage.removeItem(SAVE_PREFIX + name);
  const list = getSaveList().filter(s => s.name !== name);
  localStorage.setItem(SAVE_PREFIX + 'list', JSON.stringify(list));
}

export function getSaveList(): SaveMeta[] {
  try {
    const data = localStorage.getItem(SAVE_PREFIX + 'list');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function autoSave(serialized: SerializedGameState): void {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(serialized));
  } catch (e) {
    console.error('Autosave failed:', e);
  }
}

export function loadAutoSave(): SerializedGameState | null {
  try {
    const data = localStorage.getItem(AUTOSAVE_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function hasAutoSave(): boolean {
  return localStorage.getItem(AUTOSAVE_KEY) !== null;
}

// Settings persistence
export function saveSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

export function loadSettings(): GameSettings {
  try {
    const data = localStorage.getItem(SETTINGS_KEY);
    return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function clearAllData(): void {
  const keys = Object.keys(localStorage).filter(k => k.startsWith(SAVE_PREFIX) || k === AUTOSAVE_KEY || k === SETTINGS_KEY);
  keys.forEach(k => localStorage.removeItem(k));
}
