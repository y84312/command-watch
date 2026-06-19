import { PlayerId, BuildingType, UnitType, Position, ArmorType, WeaponType } from './types';
import { SIZES, STATS } from './constants';
import { audio } from './Audio';

let nextId = 1;

export class Entity {
  id: number = nextId++;
  x: number;
  y: number;
  w: number;
  h: number;
  player: PlayerId | 0; // 0 for neutral
  hp: number;
  maxHp: number;
  armor: ArmorType;
  selected: boolean = false;
  dead: boolean = false;

  constructor(x: number, y: number, w: number, h: number, player: PlayerId | 0, maxHp: number, armor: ArmorType) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.player = player;
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.armor = armor;
  }

  get center(): Position {
    return { x: this.x + this.w / 2, y: this.y + this.h / 2 };
  }

  distanceTo(other: Entity | Position): number {
    const cx = 'center' in other ? other.center.x : other.x;
    const cy = 'center' in other ? other.center.y : other.y;
    const dx = this.center.x - cx;
    const dy = this.center.y - cy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  takeDamage(amount: number, weapon: WeaponType) {
    let multiplier = 1.0;

    if (weapon === 'bullet') {
      if (this.armor === 'none') multiplier = 1.0;
      else if (this.armor === 'light') multiplier = 0.5;
      else if (this.armor === 'heavy') multiplier = 0.2;
      else if (this.armor === 'concrete') multiplier = 0.1;
    } else if (weapon === 'cannon') {
      if (this.armor === 'none') multiplier = 0.5;
      else if (this.armor === 'light') multiplier = 0.8;
      else if (this.armor === 'heavy') multiplier = 1.0;
      else if (this.armor === 'concrete') multiplier = 1.0;
    }

    this.hp -= amount * multiplier;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      audio.playExplosion();
    }
  }
}

export class Building extends Entity {
  type: BuildingType;
  active: boolean = true;
  targetEntity: Entity | null = null;
  cooldown: number = 0;

  constructor(x: number, y: number, type: BuildingType, player: PlayerId) {
    super(x, y, SIZES[type].w, SIZES[type].h, player, STATS[type].hp, STATS[type].armor);
    this.type = type;
  }
}

export class Unit extends Entity {
  type: UnitType;
  targetPos: Position | null = null;
  targetEntity: Entity | null = null;
  state: 'idle' | 'moving' | 'attacking' | 'harvesting' | 'returning' = 'idle';
  cooldown: number = 0;
  load: number = 0; // For harvesters

  constructor(x: number, y: number, type: UnitType, player: PlayerId) {
    super(x, y, SIZES[type].w, SIZES[type].h, player, STATS[type].hp, STATS[type].armor);
    this.type = type;
  }
}

export class Ore extends Entity {
  amount: number = 500;
  constructor(x: number, y: number) {
    super(x, y, 32, 32, 0, 1, 'none'); // Neutral, 1 HP (not used)
  }
}

export class Projectile {
  x: number;
  y: number;
  target: Entity;
  damage: number;
  weapon: WeaponType;
  speed: number = 5;
  dead: boolean = false;

  constructor(x: number, y: number, target: Entity, damage: number, weapon: WeaponType) {
    this.x = x;
    this.y = y;
    this.target = target;
    this.damage = damage;
    this.weapon = weapon;
    this.speed = weapon === 'bullet' ? 15 : 5;
  }

  update() {
    if (this.target.dead) {
      this.dead = true;
      return;
    }
    const dx = this.target.center.x - this.x;
    const dy = this.target.center.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < this.speed) {
      this.target.takeDamage(this.damage, this.weapon);
      this.dead = true;
    } else {
      this.x += (dx / dist) * this.speed;
      this.y += (dy / dist) * this.speed;
    }
  }
}
