import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Entity, Building, Unit, Ore, Projectile } from '../src/game/entities';
import { GameEngine } from '../src/game/Engine';
import { SIZES, STATS, POWER, COSTS, MAP_SIZE } from '../src/game/constants';

// Mock audio
vi.mock('../src/game/Audio', () => ({
  audio: {
    playExplosion: vi.fn(),
    playClick: vi.fn(),
    playError: vi.fn(),
    playPlace: vi.fn(),
    playReady: vi.fn(),
    playShoot: vi.fn(),
    playAck: vi.fn(),
    init: vi.fn(),
  },
}));

// ─── Canvas / Context2D mock ────────────────────────────────────────────────
function createMockCanvas(width = 800, height = 600): HTMLCanvasElement {
  const ctx: any = {
    // state
    _fillStyle: '#000000',
    _strokeStyle: '#000000',
    _lineWidth: 1,
    _globalAlpha: 1,
    _imageSmoothingEnabled: true,
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    globalAlpha: 1,
    imageSmoothingEnabled: true,
    font: '',
    textAlign: '',
    textBaseline: '',
    lineCap: '',
    lineJoin: '',
    lineDashOffset: '',
    miterLimit: '',
    shadowBlur: '',
    shadowColor: '',
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    direction: 'ltr',
    // transforms
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    transform: vi.fn(),
    setTransform: vi.fn(),
    resetTransform: vi.fn(),
    // drawing
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    arcTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    ellipse: vi.fn(),
    rect: vi.fn(),
    roundRect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    clip: vi.fn(),
    // images
    drawImage: vi.fn(),
    createImageData: vi.fn(() => ({ data: new Uint8ClampedArray(width * height * 4) })),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(width * height * 4) })),
    putImageData: vi.fn(),
    // text
    fillText: vi.fn(),
    strokeText: vi.fn(),
    measureText: vi.fn(() => ({ width: 0 })),
    // gradients / patterns
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createPattern: vi.fn(),
    // line dash
    setLineDash: vi.fn(),
    getLineDash: vi.fn(() => []),
    // canvas ref
    canvas: {} as any,
  };

  const canvas: any = {
    width,
    height,
    style: {},
    getContext: vi.fn(() => ctx),
    getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0, width, height, right: width, bottom: height })),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  return canvas as unknown as HTMLCanvasElement;
}

function createEngine(): GameEngine {
  const canvas = createMockCanvas();
  const onStateChange = vi.fn();
  return new GameEngine(canvas, onStateChange);
}

// Mock document.createElement so internal canvas creation (fowCanvas, terrainCanvas)
// also returns mock canvases with working 2d contexts — jsdom returns null for canvas.getContext('2d')
const originalCreateElement = document.createElement.bind(document);
vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
  if (tagName === 'canvas') {
    return createMockCanvas();
  }
  return originalCreateElement(tagName);
});

describe('Entity', () => {
  it('creates entity with correct default values', () => {
    const e = new Entity(10, 20, 32, 32, 1, 100, 'none');
    expect(e.x).toBe(10);
    expect(e.y).toBe(20);
    expect(e.w).toBe(32);
    expect(e.h).toBe(32);
    expect(e.player).toBe(1);
    expect(e.hp).toBe(100);
    expect(e.maxHp).toBe(100);
    expect(e.armor).toBe('none');
    expect(e.selected).toBe(false);
    expect(e.dead).toBe(false);
  });

  it('center returns midpoint', () => {
    const e = new Entity(10, 20, 32, 32, 1, 100, 'none');
    expect(e.center).toEqual({ x: 26, y: 36 });
  });

  it('distanceTo calculates distance to another entity', () => {
    const a = new Entity(0, 0, 10, 10, 1, 100, 'none');
    const b = new Entity(30, 40, 10, 10, 1, 100, 'none');
    // a.center = (5,5), b.center = (35,45), dist = sqrt(30²+40²) = 50
    expect(a.distanceTo(b)).toBeCloseTo(50, 0);
  });

  it('distanceTo calculates distance to a position', () => {
    const e = new Entity(0, 0, 10, 10, 1, 100, 'none');
    // e.center = (5,5), target = (30,40), dist = sqrt(25²+35²) ≈ 43.01
    expect(e.distanceTo({ x: 30, y: 40 })).toBeCloseTo(43.01, 1);
  });

  describe('takeDamage', () => {
    it('bullet vs no armor = full damage', () => {
      const e = new Entity(0, 0, 10, 10, 1, 100, 'none');
      e.takeDamage(50, 'bullet');
      expect(e.hp).toBe(50);
    });

    it('bullet vs light armor = half damage', () => {
      const e = new Entity(0, 0, 10, 10, 1, 100, 'light');
      e.takeDamage(50, 'bullet');
      expect(e.hp).toBe(75);
    });

    it('bullet vs heavy armor = 20% damage', () => {
      const e = new Entity(0, 0, 10, 10, 1, 100, 'heavy');
      e.takeDamage(50, 'bullet');
      expect(e.hp).toBe(90);
    });

    it('bullet vs concrete = 10% damage', () => {
      const e = new Entity(0, 0, 10, 10, 1, 100, 'concrete');
      e.takeDamage(50, 'bullet');
      expect(e.hp).toBe(95);
    });

    it('cannon vs heavy armor = full damage', () => {
      const e = new Entity(0, 0, 10, 10, 1, 100, 'heavy');
      e.takeDamage(50, 'cannon');
      expect(e.hp).toBe(50);
    });

    it('cannon vs concrete = full damage', () => {
      const e = new Entity(0, 0, 10, 10, 1, 100, 'concrete');
      e.takeDamage(50, 'cannon');
      expect(e.hp).toBe(50);
    });

    it('kills entity at 0 hp', () => {
      const e = new Entity(0, 0, 10, 10, 1, 100, 'none');
      e.takeDamage(100, 'bullet');
      expect(e.hp).toBe(0);
      expect(e.dead).toBe(true);
    });

    it('overkill still marks dead', () => {
      const e = new Entity(0, 0, 10, 10, 1, 100, 'none');
      e.takeDamage(200, 'bullet');
      expect(e.hp).toBe(0);
      expect(e.dead).toBe(true);
    });

    it('negative hp clamped to 0', () => {
      const e = new Entity(0, 0, 10, 10, 1, 10, 'none');
      e.takeDamage(50, 'bullet');
      expect(e.hp).toBe(0);
    });
  });
});

describe('Building', () => {
  it('creates building with correct size from constants', () => {
    const b = new Building(100, 100, 'powerplant', 1);
    expect(b.type).toBe('powerplant');
    expect(b.w).toBe(SIZES.powerplant.w);
    expect(b.h).toBe(SIZES.powerplant.h);
    expect(b.player).toBe(1);
  });

  it('has correct HP from STATS', () => {
    const b = new Building(0, 0, 'conyard', 1);
    expect(b.maxHp).toBe(1000);
    expect(b.hp).toBe(1000);
  });

  it('has correct armor concrete', () => {
    const b = new Building(0, 0, 'barracks', 1);
    expect(b.armor).toBe('concrete');
  });

  it('starts active with no target', () => {
    const b = new Building(0, 0, 'turret', 2);
    expect(b.active).toBe(true);
    expect(b.targetEntity).toBeNull();
    expect(b.cooldown).toBe(0);
  });

  it('all building types can be created', () => {
    const types: Array<'conyard' | 'powerplant' | 'refinery' | 'barracks' | 'warfactory' | 'turret'> = [
      'conyard', 'powerplant', 'refinery', 'barracks', 'warfactory', 'turret',
    ];
    for (const type of types) {
      const b = new Building(0, 0, type, 1);
      expect(b.type).toBe(type);
      expect(b.hp).toBeGreaterThan(0);
    }
  });
});

describe('Unit', () => {
  it('creates unit with correct properties', () => {
    const u = new Unit(50, 50, 'infantry', 1);
    expect(u.type).toBe('infantry');
    expect(u.player).toBe(1);
    expect(u.state).toBe('idle');
    expect(u.load).toBe(0);
    expect(u.cooldown).toBe(0);
  });

  it('main unit types have correct stats', () => {
    const inf = new Unit(0, 0, 'infantry', 1);
    expect(inf.maxHp).toBe(100);
    expect(inf.armor).toBe('none');

    const tank = new Unit(0, 0, 'tank', 1);
    expect(tank.maxHp).toBe(400);
    expect(tank.armor).toBe('heavy');

    const harv = new Unit(0, 0, 'harvester', 1);
    expect(harv.maxHp).toBe(500);
    expect(harv.armor).toBe('heavy');
  });

  it('starts with no targets', () => {
    const u = new Unit(0, 0, 'tank', 2);
    expect(u.targetPos).toBeNull();
    expect(u.targetEntity).toBeNull();
  });
});

describe('Ore', () => {
  it('creates ore with default amount', () => {
    const o = new Ore(100, 200);
    expect(o.amount).toBe(500);
    expect(o.player).toBe(0);
    expect(o.w).toBe(32);
    expect(o.h).toBe(32);
  });
});

describe('Projectile', () => {
  it('creates projectile targeting entity', () => {
    const target = new Entity(100, 100, 10, 10, 2, 100, 'none');
    const p = new Projectile(0, 0, target, 25, 'bullet');
    expect(p.damage).toBe(25);
    expect(p.weapon).toBe('bullet');
    expect(p.speed).toBe(15);
    expect(p.dead).toBe(false);
  });

  it('cannon projectile is slower', () => {
    const target = new Entity(100, 100, 10, 10, 2, 100, 'none');
    const p = new Projectile(0, 0, target, 40, 'cannon');
    expect(p.speed).toBe(5);
  });

  it('update moves toward target', () => {
    const target = new Entity(100, 0, 10, 10, 2, 100, 'none');
    const p = new Projectile(0, 0, target, 25, 'bullet');
    p.update();
    expect(p.x).toBeGreaterThan(0);
    // target is at y=0, projectile moves along x-axis but center offset causes small y drift
    expect(Math.abs(p.y)).toBeLessThan(1);
  });

  it('update kills projectile on hit', () => {
    const target = new Entity(1, 0, 10, 10, 2, 100, 'none');
    const p = new Projectile(0, 0, target, 25, 'bullet');
    p.update();
    expect(p.dead).toBe(true);
  });

  it('update kills projectile if target dead', () => {
    const target = new Entity(100, 100, 10, 10, 2, 100, 'none');
    target.dead = true;
    const p = new Projectile(0, 0, target, 25, 'bullet');
    p.update();
    expect(p.dead).toBe(true);
  });

  it('deals damage on hit', () => {
    const target = new Entity(1, 0, 10, 10, 2, 100, 'none');
    const p = new Projectile(0, 0, target, 30, 'bullet');
    p.update();
    expect(target.hp).toBe(70);
  });
});

// ─── GameEngine integration tests ───────────────────────────────────────────

describe('GameEngine', () => {
  describe('constructor', () => {
    it('initializes with two players', () => {
      const engine = createEngine();
      expect(engine.players[1]).toBeDefined();
      expect(engine.players[2]).toBeDefined();
      expect(engine.players[1].credits).toBe(5000);
      expect(engine.players[2].credits).toBe(5000);
    });

    it('starts with buildings for both players', () => {
      const engine = createEngine();
      const p1Buildings = engine.buildings.filter(b => b.player === 1);
      const p2Buildings = engine.buildings.filter(b => b.player === 2);
      expect(p1Buildings.length).toBeGreaterThan(0);
      expect(p2Buildings.length).toBeGreaterThan(0);
    });

    it('starts with units for both players', () => {
      const engine = createEngine();
      const p1Units = engine.units.filter(u => u.player === 1);
      const p2Units = engine.units.filter(u => u.player === 2);
      expect(p1Units.length).toBeGreaterThan(0);
      expect(p2Units.length).toBeGreaterThan(0);
    });

    it('starts with ore on the map', () => {
      const engine = createEngine();
      expect(engine.ores.length).toBeGreaterThan(0);
    });

    it('calls onStateChange after init', () => {
      const canvas = createMockCanvas();
      const onStateChange = vi.fn();
      new GameEngine(canvas, onStateChange);
      expect(onStateChange).toHaveBeenCalled();
    });
  });

  describe('recalculatePower', () => {
    it('starts with zero power for both players (no powerplants)', () => {
      const engine = createEngine();
      // initMap only adds conyards which have POWER 0
      expect(engine.players[1].power).toBe(0);
      expect(engine.players[1].maxPower).toBe(0);
      expect(engine.players[2].power).toBe(0);
      expect(engine.players[2].maxPower).toBe(0);
    });

    it('calculates maxPower when powerplant exists', () => {
      const engine = createEngine();
      engine.buildings.push(new Building(500, 500, 'powerplant', 1));
      engine.recalculatePower();
      expect(engine.players[1].maxPower).toBe(POWER.powerplant);
    });

    it('calculates power consumption for buildings', () => {
      const engine = createEngine();
      engine.buildings.push(new Building(500, 500, 'powerplant', 1));
      engine.buildings.push(new Building(600, 600, 'barracks', 1));
      engine.recalculatePower();
      // barracks consumes 10 power
      expect(engine.players[1].power).toBe(10);
      // powerplant produces 100
      expect(engine.players[1].maxPower).toBe(100);
    });

    it('handles multiple powerplants', () => {
      const engine = createEngine();
      engine.buildings.push(new Building(500, 500, 'powerplant', 1));
      engine.buildings.push(new Building(600, 500, 'powerplant', 1));
      engine.recalculatePower();
      expect(engine.players[1].maxPower).toBe(200);
    });

    it('calculates power independently per player', () => {
      const engine = createEngine();
      engine.buildings.push(new Building(500, 500, 'powerplant', 1));
      engine.buildings.push(new Building(700, 700, 'barracks', 1));
      engine.buildings.push(new Building(500, 1500, 'powerplant', 2));
      engine.buildings.push(new Building(700, 1700, 'warfactory', 2));
      engine.recalculatePower();
      // P1: powerplant=100 max, barracks=10 consumed
      expect(engine.players[1].maxPower).toBe(100);
      expect(engine.players[1].power).toBe(10);
      // P2: powerplant=100 max, warfactory=30 consumed
      expect(engine.players[2].maxPower).toBe(100);
      expect(engine.players[2].power).toBe(30);
    });

    it('conyard has zero power contribution', () => {
      const engine = createEngine();
      // initMap already adds conyards for both players
      engine.recalculatePower();
      // conyard POWER is 0, so no contribution
      const conyardPower = POWER.conyard;
      expect(conyardPower).toBe(0);
    });

    it('refinery consumes 30 power', () => {
      const engine = createEngine();
      engine.buildings.push(new Building(500, 500, 'powerplant', 1));
      engine.buildings.push(new Building(600, 600, 'refinery', 1));
      engine.recalculatePower();
      expect(engine.players[1].power).toBe(30);
      expect(engine.players[1].maxPower).toBe(100);
    });

    it('turret consumes 20 power', () => {
      const engine = createEngine();
      engine.buildings.push(new Building(500, 500, 'powerplant', 1));
      engine.buildings.push(new Building(600, 600, 'turret', 1));
      engine.recalculatePower();
      expect(engine.players[1].power).toBe(20);
    });

    it('calls onStateChange after recalculation', () => {
      const engine = createEngine();
      const callCount = (engine as any as { onStateChange: ReturnType<typeof vi.fn> }).onStateChange.mock.calls.length;
      engine.buildings.push(new Building(500, 500, 'powerplant', 1));
      engine.recalculatePower();
      const onState = engine.onStateChange as unknown as ReturnType<typeof vi.fn>;
      expect(onState.mock.calls.length).toBeGreaterThan(callCount);
    });
  });

  describe('startBuilding', () => {
    it('deducts credits and creates build queue', () => {
      const engine = createEngine();
      const initialCredits = engine.players[1].credits; // 5000
      engine.startBuilding('infantry');
      expect(engine.players[1].credits).toBe(initialCredits - COSTS.infantry);
      expect(engine.buildQueue).not.toBeNull();
      expect(engine.buildQueue!.type).toBe('infantry');
      expect(engine.buildQueue!.status).toBe('building');
      expect(engine.buildQueue!.progress).toBe(0);
    });

    it('does not start if not enough credits', () => {
      const engine = createEngine();
      engine.players[1].credits = 50;
      engine.startBuilding('tank'); // tank costs 600
      expect(engine.buildQueue).toBeNull();
      expect(engine.players[1].credits).toBe(50);
    });

    it('does not start if build queue already exists', () => {
      const engine = createEngine();
      engine.startBuilding('infantry');
      const creditsAfterFirst = engine.players[1].credits;
      engine.startBuilding('infantry');
      // Second call should be ignored
      expect(engine.players[1].credits).toBe(creditsAfterFirst);
    });

    it('can queue different building types', () => {
      const engine = createEngine();
      engine.startBuilding('powerplant');
      expect(engine.buildQueue!.type).toBe('powerplant');
    });

    it('can queue turret', () => {
      const engine = createEngine();
      engine.startBuilding('turret');
      expect(engine.buildQueue!.type).toBe('turret');
      expect(engine.players[1].credits).toBe(5000 - COSTS.turret);
    });

    it('calls onStateChange after starting', () => {
      const engine = createEngine();
      const onState = engine.onStateChange as unknown as ReturnType<typeof vi.fn>;
      const callCount = onState.mock.calls.length;
      engine.startBuilding('infantry');
      expect(onState.mock.calls.length).toBeGreaterThan(callCount);
    });
  });

  describe('spawnUnit', () => {
    it('spawns unit near warfactory for tanks', () => {
      const engine = createEngine();
      const wf = new Building(800, 800, 'warfactory', 1);
      engine.buildings.push(wf);
      const initialUnitCount = engine.units.length;
      engine.spawnUnit('tank', 1);
      expect(engine.units.length).toBe(initialUnitCount + 1);
      const spawned = engine.units[engine.units.length - 1];
      expect(spawned.type).toBe('tank');
      expect(spawned.player).toBe(1);
    });

    it('spawns unit near barracks for infantry', () => {
      const engine = createEngine();
      const barracks = new Building(800, 800, 'barracks', 1);
      engine.buildings.push(barracks);
      engine.spawnUnit('infantry', 1);
      const spawned = engine.units[engine.units.length - 1];
      expect(spawned.type).toBe('infantry');
      expect(spawned.player).toBe(1);
    });

    it('spawns harvester near warfactory', () => {
      const engine = createEngine();
      const wf = new Building(800, 800, 'warfactory', 1);
      engine.buildings.push(wf);
      engine.spawnUnit('harvester', 1);
      const spawned = engine.units[engine.units.length - 1];
      expect(spawned.type).toBe('harvester');
    });

    it('falls back to conyard if no spawner found', () => {
      const engine = createEngine();
      // Remove all buildings except conyards
      engine.buildings = engine.buildings.filter(b => b.type === 'conyard');
      const initialCount = engine.units.length;
      engine.spawnUnit('tank', 1);
      expect(engine.units.length).toBe(initialCount + 1);
      const spawned = engine.units[engine.units.length - 1];
      expect(spawned.type).toBe('tank');
    });

    it('does nothing if no spawner and no conyard', () => {
      const engine = createEngine();
      // Remove all P1 buildings
      engine.buildings = engine.buildings.filter(b => b.player !== 1);
      const initialCount = engine.units.length;
      engine.spawnUnit('tank', 1);
      expect(engine.units.length).toBe(initialCount);
    });

    it('spawns for player 2', () => {
      const engine = createEngine();
      const wf = new Building(1500, 1500, 'warfactory', 2);
      engine.buildings.push(wf);
      const initialCount = engine.units.length;
      engine.spawnUnit('tank', 2);
      expect(engine.units.length).toBe(initialCount + 1);
      const spawned = engine.units[engine.units.length - 1];
      expect(spawned.player).toBe(2);
    });
  });

  describe('canPlaceBuilding', () => {
    it('returns true for empty space', () => {
      const engine = createEngine();
      // Clear ores/units near the test area to guarantee empty space
      engine.ores = engine.ores.filter(o => o.x < 900 || o.x > 1100 || o.y < 900 || o.y > 1100);
      engine.units = engine.units.filter(u => u.x < 900 || u.x > 1100 || u.y < 900 || u.y > 1100);
      engine.buildings = engine.buildings.filter(b => b.x < 900 || b.x > 1200 || b.y < 900 || b.y > 1200);
      const result = engine.canPlaceBuilding(1000, 1000, 'powerplant');
      expect(result).toBe(true);
    });

    it('returns false when overlapping a building', () => {
      const engine = createEngine();
      // Place a building at known location
      engine.buildings.push(new Building(500, 500, 'powerplant', 1));
      const result = engine.canPlaceBuilding(500, 500, 'barracks');
      expect(result).toBe(false);
    });

    it('returns false when overlapping a unit', () => {
      const engine = createEngine();
      engine.units.push(new Unit(600, 600, 'infantry', 1));
      const result = engine.canPlaceBuilding(600, 600, 'turret');
      expect(result).toBe(false);
    });

    it('returns false when overlapping an ore', () => {
      const engine = createEngine();
      engine.ores.push(new Ore(700, 700));
      const result = engine.canPlaceBuilding(700, 700, 'turret');
      expect(result).toBe(false);
    });

    it('returns true when adjacent but not overlapping', () => {
      const engine = createEngine();
      // Place a powerplant (64x64) at 500,500
      engine.buildings.push(new Building(500, 500, 'powerplant', 1));
      // Place barracks at 564,500 (exactly adjacent, no overlap)
      const result = engine.canPlaceBuilding(564, 500, 'barracks');
      expect(result).toBe(true);
    });

    it('works for all building types', () => {
      const engine = createEngine();
      const types: Array<'conyard' | 'powerplant' | 'refinery' | 'barracks' | 'warfactory' | 'turret'> = [
        'conyard', 'powerplant', 'refinery', 'barracks', 'warfactory', 'turret',
      ];
      for (const type of types) {
        // Use a far-away clear position for each
        // Sizes are at most 96, so spacing by 200 is safe
        const x = 1000;
        const y = 1000;
        // Clear everything near that area for this test
        const engine2 = createEngine();
        // Remove ores near the test area
        engine2.ores = engine2.ores.filter(o => o.x < 900 || o.x > 1100 || o.y < 900 || o.y > 1100);
        // Remove buildings near the test area
        engine2.buildings = engine2.buildings.filter(b => b.x < 900 || b.x > 1200 || b.y < 900 || b.y > 1200);
        // Remove units near the test area
        engine2.units = engine2.units.filter(u => u.x < 900 || u.x > 1100 || u.y < 900 || u.y > 1100);
        const result = engine2.canPlaceBuilding(x, y, type);
        expect(result).toBe(true);
      }
    });

    it('detects partial overlap', () => {
      const engine = createEngine();
      // Place a 64x64 powerplant at 500,500
      engine.buildings.push(new Building(500, 500, 'powerplant', 1));
      // Place a 64x64 barracks overlapping by 1 pixel
      const result = engine.canPlaceBuilding(563, 500, 'barracks');
      expect(result).toBe(false);
    });
  });
});
