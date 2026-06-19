import { describe, it, expect } from 'vitest';
import { SIZES, STATS, COSTS, BUILD_TIMES, POWER, MAP_SIZE } from '../src/game/constants';
import type { BuildingType, UnitType, ArmorType, WeaponType } from '../src/game/types';

describe('Constants', () => {
  describe('SIZES', () => {
    it('has all building types', () => {
      const types: BuildingType[] = ['conyard', 'powerplant', 'refinery', 'barracks', 'warfactory', 'turret'];
      for (const t of types) {
        expect(SIZES[t]).toBeDefined();
        expect(SIZES[t].w).toBeGreaterThan(0);
        expect(SIZES[t].h).toBeGreaterThan(0);
      }
    });

    it('has all unit types', () => {
      const types: UnitType[] = ['harvester', 'infantry', 'tank'];
      for (const t of types) {
        expect(SIZES[t]).toBeDefined();
        expect(SIZES[t].w).toBeGreaterThan(0);
        expect(SIZES[t].h).toBeGreaterThan(0);
      }
    });

    it('conyard is largest building', () => {
      expect(SIZES.conyard.w).toBe(96);
      expect(SIZES.conyard.h).toBe(96);
    });

    it('turret is smallest building', () => {
      expect(SIZES.turret.w).toBe(32);
      expect(SIZES.turret.h).toBe(32);
    });

    it('infantry is smallest unit', () => {
      expect(SIZES.infantry.w).toBe(12);
      expect(SIZES.infantry.h).toBe(12);
    });
  });

  describe('STATS', () => {
    it('has hp > 0 for all types', () => {
      const allTypes: Array<BuildingType | UnitType> = [
        'conyard', 'powerplant', 'refinery', 'barracks', 'warfactory', 'turret',
        'harvester', 'infantry', 'tank',
      ];
      for (const t of allTypes) {
        expect(STATS[t].hp).toBeGreaterThan(0);
      }
    });

    it('conyard has highest HP', () => {
      expect(STATS.conyard.hp).toBe(1000);
    });

    it('infantry has lowest HP', () => {
      expect(STATS.infantry.hp).toBe(100);
    });

    it('all have valid armor types', () => {
      const validArmors: ArmorType[] = ['none', 'light', 'heavy', 'concrete'];
      const allTypes: Array<BuildingType | UnitType> = [
        'conyard', 'powerplant', 'refinery', 'barracks', 'warfactory', 'turret',
        'harvester', 'infantry', 'tank',
      ];
      for (const t of allTypes) {
        expect(validArmors).toContain(STATS[t].armor);
      }
    });

    it('turret has range and weapon', () => {
      expect(STATS.turret.range).toBe(200);
      expect(STATS.turret.weapon).toBe('bullet');
      expect(STATS.turret.cooldown).toBe(40);
    });

    it('tank has cannon', () => {
      expect(STATS.tank.weapon).toBe('cannon');
      expect(STATS.tank.range).toBe(250);
    });

    it('infantry has bullet weapon', () => {
      expect(STATS.infantry.weapon).toBe('bullet');
      expect(STATS.infantry.range).toBe(150);
    });

    it('buildings except turret have no weapon', () => {
      const buildings: BuildingType[] = ['conyard', 'powerplant', 'refinery', 'barracks', 'warfactory'];
      for (const b of buildings) {
        expect(STATS[b].weapon).toBeUndefined();
      }
    });
  });

  describe('COSTS', () => {
    it('all costs are positive', () => {
      const allTypes: Array<BuildingType | UnitType> = [
        'conyard', 'powerplant', 'refinery', 'barracks', 'warfactory', 'turret',
        'harvester', 'infantry', 'tank',
      ];
      for (const t of allTypes) {
        expect(COSTS[t]).toBeGreaterThan(0);
      }
    });

    it('conyard is most expensive', () => {
      expect(COSTS.conyard).toBe(2500);
    });

    it('infantry is cheapest unit', () => {
      expect(COSTS.infantry).toBe(100);
    });

    it('tank costs more than infantry', () => {
      expect(COSTS.tank).toBeGreaterThan(COSTS.infantry);
    });

    it('warfactory costs more than barracks', () => {
      expect(COSTS.warfactory).toBeGreaterThan(COSTS.barracks);
    });
  });

  describe('BUILD_TIMES', () => {
    it('all build times are positive', () => {
      const allTypes: Array<BuildingType | UnitType> = [
        'conyard', 'powerplant', 'refinery', 'barracks', 'warfactory', 'turret',
        'harvester', 'infantry', 'tank',
      ];
      for (const t of allTypes) {
        expect(BUILD_TIMES[t]).toBeGreaterThan(0);
      }
    });
  });

  describe('POWER', () => {
    it('powerplant produces power', () => {
      expect(POWER.powerplant).toBe(100);
    });

    it('refinery consumes power', () => {
      expect(POWER.refinery).toBe(-30);
    });

    it('conyard has zero power', () => {
      expect(POWER.conyard).toBe(0);
    });

    it('all buildings have power values', () => {
      const buildings: BuildingType[] = ['conyard', 'powerplant', 'refinery', 'barracks', 'warfactory', 'turret'];
      for (const b of buildings) {
        expect(POWER[b]).toBeDefined();
        expect(typeof POWER[b]).toBe('number');
      }
    });
  });

  describe('MAP_SIZE', () => {
    it('map is larger than 0', () => {
      expect(MAP_SIZE.w).toBeGreaterThan(0);
      expect(MAP_SIZE.h).toBeGreaterThan(0);
    });
  });
});

describe('Type consistency', () => {
  it('all types in SIZES are in STATS', () => {
    for (const key of Object.keys(SIZES)) {
      expect(STATS[key as keyof typeof STATS]).toBeDefined();
    }
  });

  it('all types in COSTS are in BUILD_TIMES', () => {
    for (const key of Object.keys(COSTS)) {
      expect(BUILD_TIMES[key as keyof typeof BUILD_TIMES]).toBeDefined();
    }
  });

  it('total unit cost is affordable with starting credits (5000)', () => {
    const unitCosts: UnitType[] = ['harvester', 'infantry', 'tank'];
    for (const u of unitCosts) {
      expect(COSTS[u]).toBeLessThanOrEqual(5000);
    }
  });
});
