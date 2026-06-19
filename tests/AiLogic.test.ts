import { describe, it, expect, vi } from 'vitest';
import { decideAiAction, AiContext, AiUnit } from '../src/game/AiLogic';

// Helper: create a mock unit
function makeUnit(opts: Partial<AiUnit> & { x: number; y: number }): AiUnit {
  return {
    id: opts.id ?? 1,
    x: opts.x,
    y: opts.y,
    w: opts.w ?? 10,
    h: opts.h ?? 10,
    player: opts.player ?? 2,
    type: opts.type ?? 'infantry',
    state: opts.state ?? 'idle',
    targetPos: opts.targetPos ?? null,
    targetEntity: opts.targetEntity ?? null,
    distanceTo: vi.fn().mockReturnValue(0),
  };
}

function makeCtx(overrides: Partial<AiContext> = {}): AiContext {
  return {
    playerId: 2 as any,
    military: overrides.military ?? [],
    enemyUnits: overrides.enemyUnits ?? [],
    enemyBuildings: overrides.enemyBuildings ?? [],
    conyard: overrides.conyard ?? { x: 1800, y: 1800, w: 96, h: 96 },
    aiScoutedBase: overrides.aiScoutedBase ?? false,
    baseX: overrides.baseX ?? 200,
    baseY: overrides.baseY ?? 200,
  };
}

describe('decideAiAction', () => {
  const fixedRandom = () => 0.5;

  describe('military.length === 0', () => {
    it('returns none when no military', () => {
      const ctx = makeCtx({ military: [] });
      const action = decideAiAction(ctx, fixedRandom);
      expect(action.type).toBe('none');
    });
  });

  describe('base defense (highest priority)', () => {
    it('defends when enemy unit within 800px of conyard', () => {
      const enemyUnit = makeUnit({ x: 1850, y: 1850, player: 1 });
      const scout = makeUnit({ x: 1700, y: 1700 });

      const ctx = makeCtx({
        military: [scout],
        enemyUnits: [enemyUnit],
        enemyBuildings: [],
      });

      const action = decideAiAction(ctx, fixedRandom);
      expect(action.type).toBe('defend');
      expect(action.targetEntity).toBe(enemyUnit);
    });

    it('defends when enemy building within 800px of conyard', () => {
      const enemyBuilding = makeUnit({ x: 1820, y: 1820, w: 64, h: 64, player: 1, type: 'powerplant' });
      const scout = makeUnit({ x: 1700, y: 1700 });

      const ctx = makeCtx({
        military: [scout],
        enemyUnits: [],
        enemyBuildings: [enemyBuilding],
      });

      const action = decideAiAction(ctx, fixedRandom);
      expect(action.type).toBe('defend');
    });

    it('does NOT defend when enemy is far from conyard', () => {
      const enemyUnit = makeUnit({ x: 200, y: 200, player: 1 });
      const scout = makeUnit({ x: 1700, y: 1700 });

      const ctx = makeCtx({
        military: [scout],
        enemyUnits: [enemyUnit],
        enemyBuildings: [],
      });

      const action = decideAiAction(ctx, fixedRandom);
      // Should be scout (not defend) since enemy is far
      expect(action.type).toBe('scout');
    });

    it('picks nearest threat when multiple enemies near base', () => {
      const closeEnemy = makeUnit({ x: 1810, y: 1810, player: 1 });
      const farEnemy = makeUnit({ x: 1900, y: 1900, player: 1 });
      const scout = makeUnit({ x: 1700, y: 1700 });

      const ctx = makeCtx({
        military: [scout],
        enemyUnits: [farEnemy, closeEnemy],
        enemyBuildings: [],
      });

      const action = decideAiAction(ctx, fixedRandom);
      expect(action.type).toBe('defend');
      expect(action.targetEntity).toBe(closeEnemy);
    });
  });

  describe('scout (military < 5 and not scouted)', () => {
    it('sends scout when 1 military unit', () => {
      const scout = makeUnit({ x: 1700, y: 1700 });

      const ctx = makeCtx({
        military: [scout],
        enemyUnits: [],
        enemyBuildings: [],
        aiScoutedBase: false,
      });

      const action = decideAiAction(ctx, () => 0.3);
      expect(action.type).toBe('scout');
      expect(action.targetPos).toBeDefined();
    });

    it('sends scout when 4 military units', () => {
      const military = Array.from({ length: 4 }, (_, i) => makeUnit({ x: 1700 + i * 10, y: 1700 }));

      const ctx = makeCtx({
        military,
        enemyUnits: [],
        enemyBuildings: [],
        aiScoutedBase: false,
      });

      const action = decideAiAction(ctx, fixedRandom);
      expect(action.type).toBe('scout');
    });

    it('scout target is near enemy base', () => {
      const scout = makeUnit({ x: 1700, y: 1700 });

      const ctx = makeCtx({
        military: [scout],
        enemyUnits: [],
        enemyBuildings: [],
        aiScoutedBase: false,
        baseX: 200,
        baseY: 200,
      });

      // random=0.3 → offset = (0.3-0.5)*800 = -160 → target = 200-160 = 40
      const action = decideAiAction(ctx, () => 0.3);
      expect(action.type).toBe('scout');
      expect(action.targetPos!.x).toBe(40);
      expect(action.targetPos!.y).toBe(40);
    });

    it('scout target is clamped to map bounds', () => {
      const scout = makeUnit({ x: 1700, y: 1700 });

      const ctx = makeCtx({
        military: [scout],
        enemyUnits: [],
        enemyBuildings: [],
        aiScoutedBase: false,
        baseX: 1900,
        baseY: 1900,
      });

      // random=0.9 → offset = (0.9-0.5)*800 = 320 → target = 1900+320 = 2220 → clamped to 2000
      const action = decideAiAction(ctx, () => 0.9);
      expect(action.type).toBe('scout');
      expect(action.targetPos!.x).toBeLessThanOrEqual(2000);
      expect(action.targetPos!.y).toBeLessThanOrEqual(2000);
    });

    it('does NOT scout when base is scouted', () => {
      const scout = makeUnit({ x: 1700, y: 1700 });

      const ctx = makeCtx({
        military: [scout],
        enemyUnits: [],
        enemyBuildings: [makeUnit({ x: 200, y: 200, w: 96, h: 96, type: 'conyard' })],
        aiScoutedBase: true,
      });

      // With scouted base and mil < 5, falls through to none
      const action = decideAiAction(ctx, fixedRandom);
      // mil=1 < 5 but scouted → none (patrol logic is in Engine, not here)
      expect(action.type).toBe('none');
    });
  });

  describe('attack (military >= 5 and scouted)', () => {
    it('attacks enemy conyard when 5+ military and scouted', () => {
      const military = Array.from({ length: 5 }, (_, i) => makeUnit({ x: 1700 + i * 10, y: 1700 }));
      const enemyConyard = makeUnit({ x: 200, y: 200, w: 96, h: 96, type: 'conyard' });

      const ctx = makeCtx({
        military,
        enemyUnits: [],
        enemyBuildings: [enemyConyard],
        aiScoutedBase: true,
      });

      const action = decideAiAction(ctx, fixedRandom);
      expect(action.type).toBe('attack');
      expect(action.targetEntity).toBe(enemyConyard);
    });

    it('attacks first available building if no conyard', () => {
      const military = Array.from({ length: 5 }, (_, i) => makeUnit({ x: 1700 + i * 10, y: 1700 }));
      const enemyBuilding = makeUnit({ x: 200, y: 200, w: 64, h: 64, type: 'powerplant' });

      const ctx = makeCtx({
        military,
        enemyUnits: [],
        enemyBuildings: [enemyBuilding],
        aiScoutedBase: true,
      });

      const action = decideAiAction(ctx, fixedRandom);
      expect(action.type).toBe('attack');
      expect(action.targetEntity).toBe(enemyBuilding);
    });

    it('does NOT attack when not scouted', () => {
      const military = Array.from({ length: 5 }, (_, i) => makeUnit({ x: 1700 + i * 10, y: 1700 }));

      const ctx = makeCtx({
        military,
        enemyUnits: [],
        enemyBuildings: [],
        aiScoutedBase: false,
      });

      // Should be search, not attack
      const action = decideAiAction(ctx, fixedRandom);
      expect(action.type).toBe('search');
    });
  });

  describe('search (military >= 5 and not scouted)', () => {
    it('searches when 5+ military and not scouted', () => {
      const military = Array.from({ length: 5 }, (_, i) => makeUnit({ x: 1700 + i * 10, y: 1700 }));

      const ctx = makeCtx({
        military,
        enemyUnits: [],
        enemyBuildings: [],
        aiScoutedBase: false,
      });

      const action = decideAiAction(ctx, () => 0.3);
      expect(action.type).toBe('search');
      expect(action.targetPos).toBeDefined();
    });

    it('search target is near enemy base', () => {
      const military = Array.from({ length: 5 }, (_, i) => makeUnit({ x: 1700 + i * 10, y: 1700 }));

      const ctx = makeCtx({
        military,
        enemyUnits: [],
        enemyBuildings: [],
        aiScoutedBase: false,
        baseX: 200,
        baseY: 200,
      });

      const action = decideAiAction(ctx, () => 0.3);
      expect(action.type).toBe('search');
      expect(action.targetPos!.x).toBe(40);
      expect(action.targetPos!.y).toBe(40);
    });
  });

  describe('priority order', () => {
    it('defend takes priority over scout', () => {
      const enemyThreat = makeUnit({ x: 1850, y: 1850, player: 1 });
      const scout = makeUnit({ x: 1700, y: 1700 });

      const ctx = makeCtx({
        military: [scout],
        enemyUnits: [enemyThreat],
        enemyBuildings: [],
        aiScoutedBase: false,
      });

      const action = decideAiAction(ctx, fixedRandom);
      expect(action.type).toBe('defend');
    });

    it('defend takes priority over attack', () => {
      const enemyThreat = makeUnit({ x: 1850, y: 1850, player: 1 });
      const military = Array.from({ length: 5 }, (_, i) => makeUnit({ x: 1700 + i * 10, y: 1700 }));
      const enemyConyard = makeUnit({ x: 200, y: 200, w: 96, h: 96, type: 'conyard' });

      const ctx = makeCtx({
        military,
        enemyUnits: [enemyThreat],
        enemyBuildings: [enemyConyard],
        aiScoutedBase: true,
      });

      const action = decideAiAction(ctx, fixedRandom);
      expect(action.type).toBe('defend');
    });

    it('scout takes priority over none', () => {
      const scout = makeUnit({ x: 1700, y: 1700 });

      const ctx = makeCtx({
        military: [scout],
        enemyUnits: [],
        enemyBuildings: [],
        aiScoutedBase: false,
      });

      const action = decideAiAction(ctx, fixedRandom);
      expect(action.type).toBe('scout');
    });
  });

  describe('edge cases', () => {
    it('handles exactly 4 military (scout boundary)', () => {
      const military = Array.from({ length: 4 }, (_, i) => makeUnit({ x: 1700 + i * 10, y: 1700 }));

      const ctx = makeCtx({
        military,
        enemyUnits: [],
        enemyBuildings: [],
        aiScoutedBase: false,
      });

      const action = decideAiAction(ctx, fixedRandom);
      expect(action.type).toBe('scout');
    });

    it('handles exactly 5 military (attack boundary)', () => {
      const military = Array.from({ length: 5 }, (_, i) => makeUnit({ x: 1700 + i * 10, y: 1700 }));

      const ctx = makeCtx({
        military,
        enemyUnits: [],
        enemyBuildings: [makeUnit({ x: 200, y: 200, w: 96, h: 96, type: 'conyard' })],
        aiScoutedBase: true,
      });

      const action = decideAiAction(ctx, fixedRandom);
      expect(action.type).toBe('attack');
    });

    it('handles 6 military', () => {
      const military = Array.from({ length: 6 }, (_, i) => makeUnit({ x: 1700 + i * 10, y: 1700 }));

      const ctx = makeCtx({
        military,
        enemyUnits: [],
        enemyBuildings: [makeUnit({ x: 200, y: 200, w: 96, h: 96, type: 'conyard' })],
        aiScoutedBase: true,
      });

      const action = decideAiAction(ctx, fixedRandom);
      expect(action.type).toBe('attack');
    });

    it('returns attack with undefined target when scouted but no enemy buildings', () => {
      const military = Array.from({ length: 5 }, (_, i) => makeUnit({ x: 1700 + i * 10, y: 1700 }));

      const ctx = makeCtx({
        military,
        enemyUnits: [],
        enemyBuildings: [],
        aiScoutedBase: true,
      });

      const action = decideAiAction(ctx, fixedRandom);
      // attack branch entered but no buildings → targetEntity undefined
      expect(action.type).toBe('attack');
      expect(action.targetEntity).toBeUndefined();
    });
  });
});
