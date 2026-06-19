import { BuildingType, UnitType, PlayerId, ArmorType, WeaponType, Position } from './types';
import { COSTS, MAP_SIZE } from './constants';

export interface AiUnit {
  id: number; x: number; y: number; w: number; h: number;
  player: number; type: string; state: string;
  targetPos: Position | null;
  targetEntity: { x: number; y: number; w: number; h: number; type?: string } | null;
  distanceTo(other: { x: number; y: number }): number;
}

export interface AiContext {
  playerId: PlayerId;
  military: AiUnit[];
  enemyUnits: AiUnit[];
  enemyBuildings: AiUnit[];
  conyard: { x: number; y: number; w: number; h: number };
  aiScoutedBase: boolean;
  baseX: number;
  baseY: number;
}

export interface AiAction {
  type: 'scout' | 'attack' | 'search' | 'defend' | 'none';
  targetEntity?: { x: number; y: number; w: number; h: number; type?: string };
  targetPos?: Position;
}

export function decideAiAction(ctx: AiContext, random: () => number): AiAction {
  const { military, enemyUnits, enemyBuildings, conyard, aiScoutedBase, baseX, baseY } = ctx;

  if (military.length === 0) return { type: 'none' };

  // Base defense: enemy within 800px of conyard
  const baseRadius = 800;
  let nearestThreat: AiUnit | null = null;
  let minThreatDist = Infinity;
  for (const e of [...enemyUnits, ...enemyBuildings]) {
    const cx = e.x + (e.w / 2);
    const cy = e.y + (e.h / 2);
    const ccx = conyard.x + (conyard.w / 2);
    const ccy = conyard.y + (conyard.h / 2);
    const dist = Math.sqrt((cx - ccx) ** 2 + (cy - ccy) ** 2);
    if (dist < baseRadius && dist < minThreatDist) {
      minThreatDist = dist;
      nearestThreat = e;
    }
  }
  if (nearestThreat) {
    return { type: 'defend', targetEntity: nearestThreat as any };
  }

  // Scout: military < 5 and not scouted
  if (military.length > 0 && military.length < 5 && !aiScoutedBase) {
    return {
      type: 'scout',
      targetPos: {
        x: Math.max(0, Math.min(MAP_SIZE.w, baseX + (random() - 0.5) * 800)),
        y: Math.max(0, Math.min(MAP_SIZE.h, baseY + (random() - 0.5) * 800)),
      },
    };
  }

  // Attack: military >= 5 and scouted
  if (military.length >= 5 && aiScoutedBase) {
    const target = enemyBuildings.find(b => (b as any).type === 'conyard') || enemyBuildings[0];
    return { type: 'attack' as const, targetEntity: target as any };
  }

  // Search: military >= 5 and not scouted
  if (military.length >= 5 && !aiScoutedBase) {
    return {
      type: 'search',
      targetPos: {
        x: Math.max(0, Math.min(MAP_SIZE.w, baseX + (random() - 0.5) * 800)),
        y: Math.max(0, Math.min(MAP_SIZE.h, baseY + (random() - 0.5) * 800)),
      },
    };
  }

  return { type: 'none' };
}
