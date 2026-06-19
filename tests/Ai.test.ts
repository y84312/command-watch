import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameEngine, Building, Unit } from '../src/game/Engine';
import { COSTS, MAP_SIZE } from '../src/game/constants';
import { decideAiAction, AiContext, AiUnit } from '../src/game/AiLogic';

// Mock audio
vi.mock('../src/game/Audio', () => ({
  audio: {
    playExplosion: vi.fn(), playClick: vi.fn(), playError: vi.fn(),
    playReady: vi.fn(), playPlace: vi.fn(), playAck: vi.fn(), init: vi.fn(),
  },
}));

function createMockCanvas(): HTMLCanvasElement {
  const ctx = {
    fillRect: vi.fn(), fill: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(),
    lineTo: vi.fn(), arc: vi.fn(), ellipse: vi.fn(), stroke: vi.fn(),
    strokeRect: vi.fn(), drawImage: vi.fn(), clearRect: vi.fn(), save: vi.fn(),
    restore: vi.fn(), translate: vi.fn(), putImageData: vi.fn(),
    createImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray(4 * 2000 * 63) }),
    fillText: vi.fn(), measureText: vi.fn().mockReturnValue({ width: 0 }),
  } as unknown as CanvasRenderingContext2D;
  return {
    width: 800, height: 600, getContext: vi.fn().mockReturnValue(ctx),
    getBoundingClientRect: vi.fn().mockReturnValue({ left: 0, top: 0, width: 800, height: 600 }),
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
  } as unknown as HTMLCanvasElement;
}

function runAiUntil(engine: GameEngine, maxTicks: number, condition: (e: GameEngine) => boolean) {
  for (let i = 0; i < maxTicks; i++) {
    engine.updateAI(2000);
    if (condition(engine)) return;
  }
}

function countBuildings(engine: GameEngine, playerId: number, type: string): number {
  return engine.buildings.filter(b => b.player === playerId && b.type === type).length;
}

function countMilitary(engine: GameEngine, playerId: number): number {
  return engine.units.filter(u => u.player === playerId && u.type !== 'harvester').length;
}

// ── AiLogic pure function test helpers ──────────────────────────────────────
function makeAiUnit(opts: Partial<AiUnit> & { x: number; y: number }): AiUnit {
  return {
    id: opts.id ?? 1, x: opts.x, y: opts.y, w: opts.w ?? 10, h: opts.h ?? 10,
    player: opts.player ?? 2, type: opts.type ?? 'infantry', state: opts.state ?? 'idle',
    targetPos: opts.targetPos ?? null, targetEntity: opts.targetEntity ?? null,
    distanceTo: vi.fn().mockReturnValue(0),
  };
}

function makeAiCtx(overrides: Partial<AiContext> = {}): AiContext {
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

// ============================================================================
describe('AI Build Order Sequence (integration)', () => {
  let engine: GameEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new GameEngine(createMockCanvas(), vi.fn());
    engine.players[2].credits = 99999;
    engine.aiTimer = 2000;
  });

  it('starts in build_power state and builds a powerplant first', () => {
    expect(countBuildings(engine, 2, 'conyard')).toBe(1);
    expect(countBuildings(engine, 2, 'powerplant')).toBe(0);
    engine.updateAI(2000);
    expect(countBuildings(engine, 2, 'powerplant')).toBe(1);
  });

  it('builds refinery after powerplant exists', () => {
    engine.updateAI(2000);
    expect(countBuildings(engine, 2, 'powerplant')).toBe(1);
    engine.updateAI(2000);
    expect(countBuildings(engine, 2, 'refinery')).toBe(1);
  });

  it('builds barracks after refinery exists', () => {
    engine.updateAI(2000); // powerplant
    engine.updateAI(2000); // refinery
    expect(countBuildings(engine, 2, 'refinery')).toBe(1);
    engine.updateAI(2000); // barracks
    expect(countBuildings(engine, 2, 'barracks')).toBe(1);
  });

  it('builds warfactory after barracks exists', () => {
    engine.updateAI(2000); // powerplant
    engine.updateAI(2000); // refinery
    engine.updateAI(2000); // barracks
    expect(countBuildings(engine, 2, 'barracks')).toBe(1);
    engine.updateAI(2000); // warfactory
    expect(countBuildings(engine, 2, 'warfactory')).toBe(1);
  });

  it('transitions through full build order', () => {
    runAiUntil(engine, 20, () => countBuildings(engine, 2, 'warfactory') > 0);
    expect(countBuildings(engine, 2, 'powerplant')).toBe(1);
    expect(countBuildings(engine, 2, 'refinery')).toBe(1);
    expect(countBuildings(engine, 2, 'barracks')).toBe(1);
    expect(countBuildings(engine, 2, 'warfactory')).toBe(1);
  });

  it('spams units after warfactory is built', () => {
    runAiUntil(engine, 20, () => countBuildings(engine, 2, 'warfactory') > 0);
    const unitsBefore = engine.units.filter(u => u.player === 2).length;
    for (let i = 0; i < 10; i++) engine.updateAI(2000);
    expect(engine.units.filter(u => u.player === 2).length).toBeGreaterThan(unitsBefore);
  });

  it('does not build duplicate powerplant or refinery', () => {
    for (let i = 0; i < 15; i++) engine.updateAI(2000);
    expect(countBuildings(engine, 2, 'powerplant')).toBe(1);
    expect(countBuildings(engine, 2, 'refinery')).toBe(1);
    expect(countBuildings(engine, 2, 'barracks')).toBe(1);
  });
});

// ============================================================================
describe('AI Scout/Attack Logic (pure function)', () => {
  const fixedRandom = () => 0.5;

  it('scout: military < 5 and not scouted → scout action', () => {
    const scout = makeAiUnit({ x: 1700, y: 1700 });
    const ctx = makeAiCtx({ military: [scout], aiScoutedBase: false });
    const action = decideAiAction(ctx, () => 0.3);
    expect(action.type).toBe('scout');
    expect(action.targetPos).toEqual({ x: 40, y: 40 });
  });

  it('scout: 4 military units → scout', () => {
    const military = Array.from({ length: 4 }, (_, i) => makeAiUnit({ x: 1700 + i * 10, y: 1700 }));
    const ctx = makeAiCtx({ military, aiScoutedBase: false });
    expect(decideAiAction(ctx, fixedRandom).type).toBe('scout');
  });

  it('attack: military >= 5 and scouted → attack conyard', () => {
    const military = Array.from({ length: 5 }, (_, i) => makeAiUnit({ x: 1700 + i * 10, y: 1700 }));
    const enemyConyard = makeAiUnit({ x: 200, y: 200, w: 96, h: 96, type: 'conyard' });
    const ctx = makeAiCtx({ military, enemyBuildings: [enemyConyard], aiScoutedBase: true });
    const action = decideAiAction(ctx, fixedRandom);
    expect(action.type).toBe('attack');
    expect(action.targetEntity).toBe(enemyConyard);
  });

  it('attack: no conyard → attacks first building', () => {
    const military = Array.from({ length: 5 }, (_, i) => makeAiUnit({ x: 1700 + i * 10, y: 1700 }));
    const enemyBuilding = makeAiUnit({ x: 200, y: 200, w: 64, h: 64, type: 'powerplant' });
    const ctx = makeAiCtx({ military, enemyBuildings: [enemyBuilding], aiScoutedBase: true });
    const action = decideAiAction(ctx, fixedRandom);
    expect(action.type).toBe('attack');
    expect(action.targetEntity).toBe(enemyBuilding);
  });

  it('search: military >= 5 and not scouted → search', () => {
    const military = Array.from({ length: 5 }, (_, i) => makeAiUnit({ x: 1700 + i * 10, y: 1700 }));
    const ctx = makeAiCtx({ military, aiScoutedBase: false });
    const action = decideAiAction(ctx, () => 0.3);
    expect(action.type).toBe('search');
    expect(action.targetPos).toEqual({ x: 40, y: 40 });
  });

  it('defend: enemy within 800px of conyard → defend (highest priority)', () => {
    const enemyThreat = makeAiUnit({ x: 1850, y: 1850, player: 1 });
    const scout = makeAiUnit({ x: 1700, y: 1700 });
    const ctx = makeAiCtx({ military: [scout], enemyUnits: [enemyThreat], aiScoutedBase: false });
    const action = decideAiAction(ctx, fixedRandom);
    expect(action.type).toBe('defend');
    expect(action.targetEntity).toBe(enemyThreat);
  });

  it('defend takes priority over attack', () => {
    const enemyThreat = makeAiUnit({ x: 1850, y: 1850, player: 1 });
    const military = Array.from({ length: 5 }, (_, i) => makeAiUnit({ x: 1700 + i * 10, y: 1700 }));
    const enemyConyard = makeAiUnit({ x: 200, y: 200, w: 96, h: 96, type: 'conyard' });
    const ctx = makeAiCtx({ military, enemyUnits: [enemyThreat], enemyBuildings: [enemyConyard], aiScoutedBase: true });
    expect(decideAiAction(ctx, fixedRandom).type).toBe('defend');
  });

  it('none: no military → none', () => {
    const ctx = makeAiCtx({ military: [] });
    expect(decideAiAction(ctx, fixedRandom).type).toBe('none');
  });

  it('none: military < 5 but already scouted → none (patrol in Engine)', () => {
    const scout = makeAiUnit({ x: 1700, y: 1700 });
    const ctx = makeAiCtx({ military: [scout], aiScoutedBase: true });
    expect(decideAiAction(ctx, fixedRandom).type).toBe('none');
  });

  it('scout target clamped to map bounds', () => {
    const scout = makeAiUnit({ x: 1700, y: 1700 });
    const ctx = makeAiCtx({ military: [scout], aiScoutedBase: false, baseX: 1900, baseY: 1900 });
    // random=0.9 → offset=(0.9-0.5)*800=320 → 1900+320=2220 → clamped to 2000
    const action = decideAiAction(ctx, () => 0.9);
    expect(action.type).toBe('scout');
    expect(action.targetPos!.x).toBeLessThanOrEqual(2000);
    expect(action.targetPos!.y).toBeLessThanOrEqual(2000);
  });

  it('picks nearest threat when multiple enemies near base', () => {
    const closeEnemy = makeAiUnit({ x: 1810, y: 1810, player: 1 });
    const farEnemy = makeAiUnit({ x: 1900, y: 1900, player: 1 });
    const scout = makeAiUnit({ x: 1700, y: 1700 });
    const ctx = makeAiCtx({ military: [scout], enemyUnits: [farEnemy, closeEnemy] });
    const action = decideAiAction(ctx, fixedRandom);
    expect(action.type).toBe('defend');
    expect(action.targetEntity).toBe(closeEnemy);
  });
});

// ============================================================================
describe('AI State Machine – aiState field transitions', () => {
  let engine: GameEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new GameEngine(createMockCanvas(), vi.fn());
    engine.players[2].credits = 99999;
    engine.aiTimer = 2000;
  });

  it('initial aiState is build_power', () => {
    expect(engine.aiState).toBe('build_power');
  });

  it('aiState field exists and is one of the valid states', () => {
    const validStates = ['build_power', 'build_refinery', 'build_barracks', 'build_warfactory', 'spam'];
    expect(validStates).toContain(engine.aiState);
  });

  it('AI builds powerplant first regardless of aiState field', () => {
    engine.aiState = 'spam';
    engine.updateAI(2000);
    expect(countBuildings(engine, 2, 'powerplant')).toBe(1);
  });

  it('AI builds refinery after powerplant even if aiState is manually overridden', () => {
    engine.aiState = 'spam';
    engine.updateAI(2000);
    engine.updateAI(2000);
    expect(countBuildings(engine, 2, 'refinery')).toBe(1);
  });
});

// ============================================================================
describe('AI Timer and Tick Behavior', () => {
  let engine: GameEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new GameEngine(createMockCanvas(), vi.fn());
    engine.players[2].credits = 99999;
  });

  it('does not run AI before 2000ms timer threshold', () => {
    engine.aiTimer = 0;
    const before = engine.buildings.filter(b => b.player === 2).length;
    engine.updateAI(1000);
    expect(engine.buildings.filter(b => b.player === 2).length).toBe(before);
    expect(engine.aiTimer).toBe(1000);
  });

  it('runs AI exactly at 2000ms threshold', () => {
    engine.aiTimer = 0;
    engine.updateAI(2000);
    expect(countBuildings(engine, 2, 'powerplant')).toBe(1);
    expect(engine.aiTimer).toBe(0);
  });

  it('accumulates timer across multiple small dt calls', () => {
    engine.aiTimer = 0;
    engine.updateAI(500); expect(engine.aiTimer).toBe(500);
    engine.updateAI(500); expect(engine.aiTimer).toBe(1000);
    engine.updateAI(500); expect(engine.aiTimer).toBe(1500);
    engine.updateAI(500);
    expect(countBuildings(engine, 2, 'powerplant')).toBe(1);
    expect(engine.aiTimer).toBe(0);
  });
});

// ============================================================================
describe('AI Credit Deduction', () => {
  let engine: GameEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new GameEngine(createMockCanvas(), vi.fn());
    engine.players[2].credits = 99999;
    engine.aiTimer = 2000;
  });

  it('deducts credits when building powerplant', () => {
    const before = engine.players[2].credits;
    engine.updateAI(2000);
    expect(engine.players[2].credits).toBe(before - COSTS.powerplant);
  });

  it('deducts credits when building refinery', () => {
    engine.updateAI(2000);
    const afterPower = engine.players[2].credits;
    engine.updateAI(2000);
    expect(engine.players[2].credits).toBe(afterPower - COSTS.refinery);
  });

  it('does not build if insufficient credits', () => {
    engine.players[2].credits = 0;
    engine.updateAI(2000);
    expect(countBuildings(engine, 2, 'powerplant')).toBe(0);
  });

  it('spends credits on unit spam in spam state', () => {
    runAiUntil(engine, 20, () => countBuildings(engine, 2, 'warfactory') > 0);
    const before = engine.players[2].credits;
    for (let i = 0; i < 10; i++) engine.updateAI(2000);
    expect(engine.players[2].credits).toBeLessThan(before);
  });
});

// ============================================================================
describe('AI Harvester Spawning', () => {
  let engine: GameEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new GameEngine(createMockCanvas(), vi.fn());
    engine.players[2].credits = 99999;
    engine.aiTimer = 2000;
  });

  it('spawns a harvester when building a refinery', () => {
    const before = engine.units.filter(u => u.player === 2 && u.type === 'harvester').length;
    expect(before).toBe(1);
    engine.updateAI(2000); // powerplant
    engine.updateAI(2000); // refinery
    expect(engine.units.filter(u => u.player === 2 && u.type === 'harvester').length).toBe(2);
  });
});

// ============================================================================
describe('AI Player 1 vs Player 2 behavior', () => {
  let engine: GameEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new GameEngine(createMockCanvas(), vi.fn());
    engine.players[1].credits = 99999;
    engine.players[2].credits = 99999;
    engine.aiTimer = 2000;
  });

  it('AI runs for both players', () => {
    expect(countBuildings(engine, 1, 'powerplant')).toBe(0);
    expect(countBuildings(engine, 2, 'powerplant')).toBe(0);
    engine.updateAI(2000);
    expect(countBuildings(engine, 1, 'powerplant')).toBe(1);
    expect(countBuildings(engine, 2, 'powerplant')).toBe(1);
  });

  it('AI for player 1 is blocked when buildQueue is occupied', () => {
    engine.buildQueue = { type: 'powerplant', progress: 0, status: 'building' } as any;
    engine.updateAI(2000);
    expect(countBuildings(engine, 2, 'powerplant')).toBe(1);
  });
});
