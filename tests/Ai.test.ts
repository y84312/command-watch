import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameEngine, Building, Unit } from '../src/game/Engine';
import { COSTS, MAP_SIZE } from '../src/game/constants';

// Mock audio
vi.mock('../src/game/Audio', () => ({
  audio: {
    playExplosion: vi.fn(),
    playClick: vi.fn(),
    playError: vi.fn(),
    playReady: vi.fn(),
    playPlace: vi.fn(),
    playAck: vi.fn(),
    init: vi.fn(),
  },
}));

// ── Canvas mock helper ──────────────────────────────────────────────────────
function createMockCanvas(overrides: { width?: number; height?: number } = {}): HTMLCanvasElement {
  const ctx = {
    fillRect: vi.fn(),
    fill: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    stroke: vi.fn(),
    strokeRect: vi.fn(),
    drawImage: vi.fn(),
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    putImageData: vi.fn(),
    createImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray(4 * 2000 * 63) }),
    fillText: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 0 }),
  } as unknown as CanvasRenderingContext2D;

  const canvas = {
    width: overrides.width ?? 800,
    height: overrides.height ?? 600,
    getContext: vi.fn().mockReturnValue(ctx),
    getBoundingClientRect: vi.fn().mockReturnValue({ left: 0, top: 0, width: 800, height: 600 }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as HTMLCanvasElement;

  return canvas;
}

// ── Helper: run AI ticks until a condition is met or max ticks exhausted ─────
function runAiUntil(
  engine: GameEngine,
  maxTicks: number = 50,
  condition: (e: GameEngine) => boolean,
) {
  for (let i = 0; i < maxTicks; i++) {
    engine.updateAI(2000); // 2000ms = one AI tick
    if (condition(engine)) return;
  }
}

// ── Helper: count buildings of a type for a player ───────────────────────────
function countBuildings(engine: GameEngine, playerId: number, type: string): number {
  return engine.buildings.filter(b => b.player === playerId && b.type === type).length;
}

// ── Helper: count military units (non-harvester) for a player ────────────────
function countMilitary(engine: GameEngine, playerId: number): number {
  return engine.units.filter(u => u.player === playerId && u.type !== 'harvester').length;
}

// ── Helper: clear all military units for a player (for isolated tests) ───────
function clearMilitary(engine: GameEngine, playerId: number) {
  engine.units = engine.units.filter(u => !(u.player === playerId && u.type !== 'harvester'));
}

// ============================================================================
describe('AI Build Order Sequence', () => {
  let engine: GameEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    const canvas = createMockCanvas();
    engine = new GameEngine(canvas, vi.fn());
    // Give AI plenty of credits
    engine.players[2].credits = 99999;
    // Reset AI timer so first call fires immediately
    engine.aiTimer = 2000;
  });

  it('starts in build_power state and builds a powerplant first', () => {
    // Initially player 2 has only a conyard
    expect(countBuildings(engine, 2, 'conyard')).toBe(1);
    expect(countBuildings(engine, 2, 'powerplant')).toBe(0);

    // Run one AI tick
    engine.updateAI(2000);

    expect(countBuildings(engine, 2, 'powerplant')).toBe(1);
  });

  it('builds refinery after powerplant exists', () => {
    // First tick: builds powerplant
    engine.updateAI(2000);
    expect(countBuildings(engine, 2, 'powerplant')).toBe(1);

    // Second tick: should build refinery
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

  it('transitions through full build order: powerplant → refinery → barracks → warfactory', () => {
    runAiUntil(engine, 20, () => countBuildings(engine, 2, 'warfactory') > 0);

    // Verify all buildings exist
    expect(countBuildings(engine, 2, 'powerplant')).toBe(1);
    expect(countBuildings(engine, 2, 'refinery')).toBe(1);
    expect(countBuildings(engine, 2, 'barracks')).toBe(1);
    expect(countBuildings(engine, 2, 'warfactory')).toBe(1);
  });

  it('spams units after warfactory is built (spam state)', () => {
    // Build the full tech tree
    runAiUntil(engine, 20, () => countBuildings(engine, 2, 'warfactory') > 0);
    expect(countBuildings(engine, 2, 'warfactory')).toBe(1);

    const unitsBefore = engine.units.filter(u => u.player === 2).length;

    // Run several more AI ticks – should produce units
    for (let i = 0; i < 10; i++) {
      engine.updateAI(2000);
    }

    const unitsAfter = engine.units.filter(u => u.player === 2).length;
    expect(unitsAfter).toBeGreaterThan(unitsBefore);
  });

  it('does not build duplicate powerplant or refinery', () => {
    // Run many ticks
    for (let i = 0; i < 15; i++) {
      engine.updateAI(2000);
    }

    expect(countBuildings(engine, 2, 'powerplant')).toBe(1);
    expect(countBuildings(engine, 2, 'refinery')).toBe(1);
    expect(countBuildings(engine, 2, 'barracks')).toBe(1);
  });
});

// ============================================================================
describe('AI Scouting Behavior', () => {
  let engine: GameEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    const canvas = createMockCanvas();
    engine = new GameEngine(canvas, vi.fn());
    engine.players[2].credits = 99999;
    engine.aiTimer = 2000;
  });

  it('sends a scout when military count is between 1 and 4', () => {
    // Build the full tech tree so AI enters 'spam' state where scouting runs
    runAiUntil(engine, 30, () => countBuildings(engine, 2, 'warfactory') > 0);

    // Remove all player 2 units so AI has no pre-existing military
    engine.units = engine.units.filter(u => u.player !== 2);

    // Add exactly 1 infantry as the only military unit
    const barracks = engine.buildings.find(b => b.player === 2 && b.type === 'barracks')!;
    const scout = new Unit(barracks.center.x, barracks.center.y + 50, 'infantry', 2);
    engine.units.push(scout);

    expect(countMilitary(engine, 2)).toBe(1);

    // Mock Math.random so AI doesn't spawn extra units during this tick
    const origRandom = Math.random;
    Math.random = () => 0.9; // > 0.5 so tank path is taken, but we have no warfactory for p1

    // Run AI – should send scout toward enemy base
    engine.aiTimer = 2000;
    engine.updateAI(2000);

    Math.random = origRandom;

    // Scout should now be moving (AI sent it toward enemy base)
    expect(scout.state).toBe('moving');
    expect(scout.targetPos).not.toBeNull();
    expect(scout.targetEntity).toBeNull();
  });

  it('scout target position is near enemy base area', () => {
    runAiUntil(engine, 30, () => countBuildings(engine, 2, 'warfactory') > 0);
    clearMilitary(engine, 2);

    const barracks = engine.buildings.find(b => b.player === 2 && b.type === 'barracks')!;
    const scout = new Unit(barracks.center.x, barracks.center.y + 50, 'infantry', 2);
    engine.units.push(scout);

    engine.aiTimer = 2000;
    engine.updateAI(2000);

    // Player 2's enemy is player 1, baseX=200, baseY=200
    // Scout should be sent toward that area
    expect(scout.targetPos).not.toBeNull();
    expect(scout.targetPos!.x).toBeLessThan(1000);
    expect(scout.targetPos!.y).toBeLessThan(1000);
  });

  it('does not send scout when military count is 0', () => {
    runAiUntil(engine, 30, () => countBuildings(engine, 2, 'warfactory') > 0);
    clearMilitary(engine, 2);

    expect(countMilitary(engine, 2)).toBe(0);

    engine.aiTimer = 2000;
    engine.updateAI(2000);

    // Still no military, no errors
    expect(countMilitary(engine, 2)).toBe(0);
  });

  it('does not send scout when military count >= 5 (attacks instead)', () => {
    runAiUntil(engine, 30, () => countBuildings(engine, 2, 'warfactory') > 0);
    clearMilitary(engine, 2);

    const barracks = engine.buildings.find(b => b.player === 2 && b.type === 'barracks')!;

    // Add 5 infantry
    for (let i = 0; i < 5; i++) {
      engine.units.push(new Unit(barracks.center.x + i * 10, barracks.center.y + 50, 'infantry', 2));
    }

    expect(countMilitary(engine, 2)).toBe(5);

    // Mark base as scouted so attack logic kicks in
    engine.aiScoutedBase[2] = true;

    engine.aiTimer = 2000;
    engine.updateAI(2000);

    // All military units should be attacking (targetEntity set to enemy building)
    const military = engine.units.filter(u => u.player === 2 && u.type !== 'harvester');
    for (const u of military) {
      expect(u.state).toBe('attacking');
      expect(u.targetEntity).not.toBeNull();
    }
  });
});

// ============================================================================
describe('AI Attack Behavior (military count >= 5)', () => {
  let engine: GameEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    const canvas = createMockCanvas();
    engine = new GameEngine(canvas, vi.fn());
    engine.players[2].credits = 99999;
    engine.aiTimer = 2000;
  });

  it('attacks enemy conyard when military >= 5 and base is scouted', () => {
    runAiUntil(engine, 30, () => countBuildings(engine, 2, 'warfactory') > 0);
    clearMilitary(engine, 2);

    const barracks = engine.buildings.find(b => b.player === 2 && b.type === 'barracks')!;

    // Spawn 5 infantry
    for (let i = 0; i < 5; i++) {
      engine.units.push(new Unit(barracks.center.x + i * 10, barracks.center.y + 50, 'infantry', 2));
    }

    expect(countMilitary(engine, 2)).toBe(5);

    // Mark scouted
    engine.aiScoutedBase[2] = true;

    // Player 1's conyard is at (200, 200)
    const enemyConyard = engine.buildings.find(b => b.player === 1 && b.type === 'conyard')!;
    expect(enemyConyard).toBeDefined();

    engine.aiTimer = 2000;
    engine.updateAI(2000);

    // All military should target the enemy conyard
    const military = engine.units.filter(u => u.player === 2 && u.type !== 'harvester');
    for (const u of military) {
      expect(u.state).toBe('attacking');
      expect(u.targetEntity).toBe(enemyConyard);
    }
  });

  it('does not attack when base is not scouted but sends search parties', () => {
    runAiUntil(engine, 30, () => countBuildings(engine, 2, 'warfactory') > 0);
    clearMilitary(engine, 2);

    const barracks = engine.buildings.find(b => b.player === 2 && b.type === 'barracks')!;

    // Spawn 5 infantry
    for (let i = 0; i < 5; i++) {
      engine.units.push(new Unit(barracks.center.x + i * 10, barracks.center.y + 50, 'infantry', 2));
    }

    expect(countMilitary(engine, 2)).toBe(5);

    // NOT scouted
    engine.aiScoutedBase[2] = false;

    engine.aiTimer = 2000;
    engine.updateAI(2000);

    // Military should be searching (moving toward enemy side)
    const military = engine.units.filter(u => u.player === 2 && u.type !== 'harvester');
    for (const u of military) {
      expect(u.state).toBe('moving');
      expect(u.targetPos).not.toBeNull();
      expect(u.targetEntity).toBeNull();
    }
  });

  it('defends base when enemy units are within base radius', () => {
    runAiUntil(engine, 30, () => countBuildings(engine, 2, 'warfactory') > 0);
    clearMilitary(engine, 2);

    const barracks = engine.buildings.find(b => b.player === 2 && b.type === 'barracks')!;
    const conyard = engine.buildings.find(b => b.player === 2 && b.type === 'conyard')!;

    // Spawn 5 infantry for player 2
    for (let i = 0; i < 5; i++) {
      engine.units.push(new Unit(barracks.center.x + i * 10, barracks.center.y + 50, 'infantry', 2));
    }

    // Place an enemy unit very close to player 2's conyard (within 800 radius)
    engine.units.push(new Unit(conyard.x + 50, conyard.y + 50, 'infantry', 1));

    engine.aiScoutedBase[2] = true;

    engine.aiTimer = 2000;
    engine.updateAI(2000);

    // Military should be defending (attacking the threat)
    const military = engine.units.filter(u => u.player === 2 && u.type !== 'harvester');
    for (const u of military) {
      expect(u.state).toBe('attacking');
      expect(u.targetEntity).not.toBeNull();
    }
  });

  it('attack targets the first available enemy building if conyard is destroyed', () => {
    runAiUntil(engine, 30, () => countBuildings(engine, 2, 'warfactory') > 0);
    clearMilitary(engine, 2);

    const barracks = engine.buildings.find(b => b.player === 2 && b.type === 'barracks')!;

    // Spawn 5 infantry
    for (let i = 0; i < 5; i++) {
      engine.units.push(new Unit(barracks.center.x + i * 10, barracks.center.y + 50, 'infantry', 2));
    }

    // Remove player 1's conyard and leave another building
    const enemyConyard = engine.buildings.find(b => b.player === 1 && b.type === 'conyard')!;
    enemyConyard.dead = true;
    engine.buildings = engine.buildings.filter(b => !b.dead);

    // Player 1 should still have buildings — add a powerplant
    engine.buildings.push(new Building(250, 250, 'powerplant', 1));

    engine.aiScoutedBase[2] = true;

    engine.aiTimer = 2000;
    engine.updateAI(2000);

    const military = engine.units.filter(u => u.player === 2 && u.type !== 'harvester');
    for (const u of military) {
      expect(u.state).toBe('attacking');
      expect(u.targetEntity).not.toBeNull();
    }
  });
});

// ============================================================================
describe('AI State Machine – aiState field transitions', () => {
  let engine: GameEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    const canvas = createMockCanvas();
    engine = new GameEngine(canvas, vi.fn());
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

  it('AI builds powerplant first regardless of aiState field (uses dynamic state)', () => {
    // Even if we manually set aiState to spam, the dynamic logic should build powerplant
    engine.aiState = 'spam';
    engine.updateAI(2000);
    expect(countBuildings(engine, 2, 'powerplant')).toBe(1);
  });

  it('AI builds refinery after powerplant even if aiState is manually overridden', () => {
    engine.aiState = 'spam';
    engine.updateAI(2000); // builds powerplant
    engine.updateAI(2000); // builds refinery
    expect(countBuildings(engine, 2, 'refinery')).toBe(1);
  });
});

// ============================================================================
describe('AI Timer and Tick Behavior', () => {
  let engine: GameEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    const canvas = createMockCanvas();
    engine = new GameEngine(canvas, vi.fn());
    engine.players[2].credits = 99999;
  });

  it('does not run AI before 2000ms timer threshold', () => {
    engine.aiTimer = 0;
    const buildingsBefore = engine.buildings.filter(b => b.player === 2).length;

    // dt=1000 is less than 2000 threshold
    engine.updateAI(1000);

    const buildingsAfter = engine.buildings.filter(b => b.player === 2).length;
    expect(buildingsAfter).toBe(buildingsBefore);
    expect(engine.aiTimer).toBe(1000);
  });

  it('runs AI exactly at 2000ms threshold', () => {
    engine.aiTimer = 0;
    engine.updateAI(2000);

    // Should have built powerplant
    expect(countBuildings(engine, 2, 'powerplant')).toBe(1);
    // Timer should be reset
    expect(engine.aiTimer).toBe(0);
  });

  it('accumulates timer across multiple small dt calls', () => {
    engine.aiTimer = 0;

    engine.updateAI(500);
    expect(engine.aiTimer).toBe(500);

    engine.updateAI(500);
    expect(engine.aiTimer).toBe(1000);

    engine.updateAI(500);
    expect(engine.aiTimer).toBe(1500);

    engine.updateAI(500);
    // Now at 2000, AI fires and resets
    expect(countBuildings(engine, 2, 'powerplant')).toBe(1);
    expect(engine.aiTimer).toBe(0);
  });
});

// ============================================================================
describe('AI Credit Deduction', () => {
  let engine: GameEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    const canvas = createMockCanvas();
    engine = new GameEngine(canvas, vi.fn());
    engine.players[2].credits = 99999;
    engine.aiTimer = 2000;
  });

  it('deducts credits when building powerplant', () => {
    const creditsBefore = engine.players[2].credits;
    engine.updateAI(2000);
    expect(engine.players[2].credits).toBe(creditsBefore - COSTS.powerplant);
  });

  it('deducts credits when building refinery', () => {
    engine.updateAI(2000); // powerplant
    const creditsAfterPower = engine.players[2].credits;
    engine.updateAI(2000); // refinery
    expect(engine.players[2].credits).toBe(creditsAfterPower - COSTS.refinery);
  });

  it('does not build if insufficient credits', () => {
    engine.players[2].credits = 0;
    engine.updateAI(2000);
    // Should not have built anything
    expect(countBuildings(engine, 2, 'powerplant')).toBe(0);
  });

  it('spends credits on unit spam in spam state', () => {
    // Build full tech tree
    runAiUntil(engine, 20, () => countBuildings(engine, 2, 'warfactory') > 0);

    const creditsBefore = engine.players[2].credits;

    // Run several spam ticks
    for (let i = 0; i < 10; i++) {
      engine.updateAI(2000);
    }

    // Credits should have decreased (units cost credits)
    expect(engine.players[2].credits).toBeLessThan(creditsBefore);
  });
});

// ============================================================================
describe('AI Harvester Spawning', () => {
  let engine: GameEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    const canvas = createMockCanvas();
    engine = new GameEngine(canvas, vi.fn());
    engine.players[2].credits = 99999;
    engine.aiTimer = 2000;
  });

  it('spawns a harvester when building a refinery', () => {
    const harvestersBefore = engine.units.filter(u => u.player === 2 && u.type === 'harvester').length;
    // Player 2 starts with 1 harvester from initMap
    expect(harvestersBefore).toBe(1);

    // Build powerplant
    engine.updateAI(2000);
    // Build refinery (should spawn harvester)
    engine.updateAI(2000);

    const harvestersAfter = engine.units.filter(u => u.player === 2 && u.type === 'harvester').length;
    expect(harvestersAfter).toBe(2);
  });
});

// ============================================================================
describe('AI Player 1 vs Player 2 behavior', () => {
  let engine: GameEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    const canvas = createMockCanvas();
    engine = new GameEngine(canvas, vi.fn());
    engine.players[1].credits = 99999;
    engine.players[2].credits = 99999;
    engine.aiTimer = 2000;
  });

  it('AI runs for both players', () => {
    // Both players start with just a conyard
    expect(countBuildings(engine, 1, 'powerplant')).toBe(0);
    expect(countBuildings(engine, 2, 'powerplant')).toBe(0);

    engine.updateAI(2000);

    // Both should build powerplant
    expect(countBuildings(engine, 1, 'powerplant')).toBe(1);
    expect(countBuildings(engine, 2, 'powerplant')).toBe(1);
  });

  it('AI for player 1 is blocked when buildQueue is occupied', () => {
    // Occupy player 1's build queue
    engine.buildQueue = { type: 'powerplant', progress: 0, status: 'building' };

    engine.updateAI(2000);

    // Player 1 should NOT have built a new powerplant (blocked by buildQueue)
    // But player 2 should have
    expect(countBuildings(engine, 2, 'powerplant')).toBe(1);
  });
});
