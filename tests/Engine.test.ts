import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Entity, Building, Unit, Ore, Projectile } from '../src/game/Engine';
import { SIZES, STATS } from '../src/game/constants';

// Mock audio
vi.mock('../src/game/Audio', () => ({
  audio: {
    playExplosion: vi.fn(),
    playClick: vi.fn(),
    playError: vi.fn(),
    init: vi.fn(),
  },
}));

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
