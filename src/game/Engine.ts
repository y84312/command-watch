import { PlayerId, BuildingType, UnitType, Position, Rect, PlayerState, GameState, ArmorType, WeaponType } from './types';
import { COSTS, BUILD_TIMES, POWER, SIZES, STATS, MAP_SIZE } from './constants';
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

export class GameEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  onStateChange: (state: GameState) => void;

  players: Record<PlayerId, PlayerState> = {
    1: { id: 1, credits: 5000, power: 0, maxPower: 0, color: '#3b82f6' }, // Blue
    2: { id: 2, credits: 5000, power: 0, maxPower: 0, color: '#ef4444' }, // Red
  };

  buildings: Building[] = [];
  units: Unit[] = [];
  ores: Ore[] = [];
  projectiles: Projectile[] = [];

  camera = { x: 0, y: 0 };
  mouse = { x: 0, y: 0, worldX: 0, worldY: 0, down: false, startX: 0, startY: 0 };
  selectionBox: Rect | null = null;

  buildQueue: { type: BuildingType | UnitType; progress: number; status: 'building' | 'ready' } | null = null;
  placingBuilding: BuildingType | null = null;

  lastTime: number = 0;
  running: boolean = false;

  terrainCanvas: HTMLCanvasElement;
  terrainCtx: CanvasRenderingContext2D;

  // AI State
  aiTimer: number = 0;
  aiState: 'build_power' | 'build_refinery' | 'build_barracks' | 'build_warfactory' | 'spam' = 'build_power';
  aiScoutedBase: Record<PlayerId, boolean> = { 1: false, 2: false };

  // FOW State
  fowCols: number;
  fowRows: number;
  fowCellSize = 32;
  fowGrid: Uint8Array;
  fowCanvas: HTMLCanvasElement;
  fowCtx: CanvasRenderingContext2D;
  fowData: ImageData;

  constructor(canvas: HTMLCanvasElement, onStateChange: (state: GameState) => void) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.onStateChange = onStateChange;

    this.fowCols = Math.ceil(MAP_SIZE.w / this.fowCellSize);
    this.fowRows = Math.ceil(MAP_SIZE.h / this.fowCellSize);
    this.fowGrid = new Uint8Array(this.fowCols * this.fowRows);
    this.fowCanvas = document.createElement('canvas');
    this.fowCanvas.width = this.fowCols;
    this.fowCanvas.height = this.fowRows;
    this.fowCtx = this.fowCanvas.getContext('2d')!;
    this.fowData = this.fowCtx.createImageData(this.fowCols, this.fowRows);

    this.terrainCanvas = document.createElement('canvas');
    this.terrainCanvas.width = MAP_SIZE.w;
    this.terrainCanvas.height = MAP_SIZE.h;
    this.terrainCtx = this.terrainCanvas.getContext('2d')!;
    this.generateTerrain();

    this.initMap();
    this.setupInputs();
    this.updateReactState();
  }

  generateTerrain() {
    const ctx = this.terrainCtx;
    // Base grass
    ctx.fillStyle = '#2a3324';
    ctx.fillRect(0, 0, MAP_SIZE.w, MAP_SIZE.h);

    // Dirt patches
    for (let i = 0; i < 3000; i++) {
      const x = Math.random() * MAP_SIZE.w;
      const y = Math.random() * MAP_SIZE.h;
      const r = 10 + Math.random() * 50;
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(34, 43, 26, 0.4)' : 'rgba(45, 40, 25, 0.3)';
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * (0.5 + Math.random() * 0.5), Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    // Craters / details
    for (let i = 0; i < 500; i++) {
      const x = Math.random() * MAP_SIZE.w;
      const y = Math.random() * MAP_SIZE.h;
      const r = 2 + Math.random() * 8;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.beginPath(); ctx.arc(x+1, y+1, r, 0, Math.PI * 2); ctx.fill();
    }
  }

  rectIntersect(r1: Rect, r2: Rect): boolean {
    return !(r2.x >= r1.x + r1.w || 
             r2.x + r2.w <= r1.x || 
             r2.y >= r1.y + r1.h || 
             r2.y + r2.h <= r1.y);
  }

  canPlaceBuilding(x: number, y: number, type: BuildingType): boolean {
    const w = SIZES[type].w;
    const h = SIZES[type].h;
    const rect = { x, y, w, h };
    
    // Check buildings
    for (const b of this.buildings) {
      if (this.rectIntersect(rect, b)) return false;
    }
    // Check units
    for (const u of this.units) {
      if (this.rectIntersect(rect, u)) return false;
    }
    // Check ores
    for (const o of this.ores) {
      if (this.rectIntersect(rect, o)) return false;
    }
    return true;
  }

  draw3DBox(x: number, y: number, w: number, h: number, depth: number, colorTop: string, colorFront: string, colorRight: string) {
    const dx = 0;
    const dy = -depth;

    // Front
    this.ctx.fillStyle = colorFront;
    this.ctx.fillRect(x, y, w, h);

    // Top
    this.ctx.fillStyle = colorTop;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.lineTo(x + dx, y + dy);
    this.ctx.lineTo(x + w + dx, y + dy);
    this.ctx.lineTo(x + w, y);
    this.ctx.fill();

    // Right
    this.ctx.fillStyle = colorRight;
    this.ctx.beginPath();
    this.ctx.moveTo(x + w, y);
    this.ctx.lineTo(x + w + dx, y + dy);
    this.ctx.lineTo(x + w + dx, y + h + dy);
    this.ctx.lineTo(x + w, y + h);
    this.ctx.fill();

    // Outlines
    this.ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x, y, w, h);
    this.ctx.beginPath();
    this.ctx.moveTo(x, y); this.ctx.lineTo(x + dx, y + dy);
    this.ctx.moveTo(x + w, y); this.ctx.lineTo(x + w + dx, y + dy);
    this.ctx.moveTo(x + w, y + h); this.ctx.lineTo(x + w + dx, y + h + dy);
    this.ctx.moveTo(x + dx, y + dy); this.ctx.lineTo(x + w + dx, y + dy);
    this.ctx.lineTo(x + w + dx, y + h + dy);
    this.ctx.stroke();
  }

  drawBevel(x: number, y: number, w: number, h: number, color: string) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
    
    // Top highlight
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.lineTo(x + w, y);
    this.ctx.lineTo(x + w - 4, y + 4);
    this.ctx.lineTo(x + 4, y + 4);
    this.ctx.fill();

    // Left highlight
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.lineTo(x + 4, y + 4);
    this.ctx.lineTo(x + 4, y + h - 4);
    this.ctx.lineTo(x, y + h);
    this.ctx.fill();

    // Bottom shadow
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    this.ctx.beginPath();
    this.ctx.moveTo(x, y + h);
    this.ctx.lineTo(x + w, y + h);
    this.ctx.lineTo(x + w - 4, y + h - 4);
    this.ctx.lineTo(x + 4, y + h - 4);
    this.ctx.fill();

    // Right shadow
    this.ctx.beginPath();
    this.ctx.moveTo(x + w, y);
    this.ctx.lineTo(x + w, y + h);
    this.ctx.lineTo(x + w - 4, y + h - 4);
    this.ctx.lineTo(x + w - 4, y + 4);
    this.ctx.fill();

    // Border
    this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x, y, w, h);
  }

  initMap() {
    // Generate Ore
    for (let i = 0; i < 100; i++) {
      this.ores.push(new Ore(Math.random() * MAP_SIZE.w, Math.random() * MAP_SIZE.h));
    }

    // Player 1 Base
    this.buildings.push(new Building(200, 200, 'conyard', 1));
    this.units.push(new Unit(300, 300, 'harvester', 1));

    // Player 2 Base (AI)
    this.buildings.push(new Building(MAP_SIZE.w - 300, MAP_SIZE.h - 300, 'conyard', 2));
    this.units.push(new Unit(MAP_SIZE.w - 400, MAP_SIZE.h - 400, 'harvester', 2));

    this.recalculatePower();
  }

  setupInputs() {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - rect.left;
      this.mouse.y = e.clientY - rect.top;
      this.mouse.worldX = this.mouse.x + this.camera.x;
      this.mouse.worldY = this.mouse.y + this.camera.y;

      if (this.mouse.down && !this.placingBuilding) {
        this.selectionBox = {
          x: Math.min(this.mouse.startX, this.mouse.worldX),
          y: Math.min(this.mouse.startY, this.mouse.worldY),
          w: Math.abs(this.mouse.worldX - this.mouse.startX),
          h: Math.abs(this.mouse.worldY - this.mouse.startY),
        };
      }
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { // Left click
        if (this.placingBuilding) {
          this.placeBuilding(this.mouse.worldX, this.mouse.worldY);
        } else {
          this.mouse.down = true;
          this.mouse.startX = this.mouse.worldX;
          this.mouse.startY = this.mouse.worldY;
          this.selectionBox = null;
        }
      } else if (e.button === 2) { // Right click
        e.preventDefault();
        this.placingBuilding = null;
        this.updateReactState();
        this.commandSelectedUnits(this.mouse.worldX, this.mouse.worldY);
      }
    });

    this.canvas.addEventListener('mouseup', (e) => {
      if (e.button === 0 && this.mouse.down) {
        this.mouse.down = false;
        this.selectUnitsInBox();
        this.selectionBox = null;
      }
    });

    this.canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  start() {
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  stop() {
    this.running = false;
  }

  loop(time: number) {
    if (!this.running) return;
    const dt = time - this.lastTime;
    this.lastTime = time;

    this.update(dt);
    this.draw();

    requestAnimationFrame((t) => this.loop(t));
  }

  distanceToCamera(entity: Entity): number {
    const cx = this.camera.x + this.canvas.width / 2;
    const cy = this.camera.y + this.canvas.height / 2;
    const dx = entity.center.x - cx;
    const dy = entity.center.y - cy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  update(dt: number) {
    this.handleCameraPan(dt);
    this.updateBuildQueue(dt);
    this.updateUnits(dt);
    this.updateBuildings(dt);
    this.updateProjectiles();
    this.updateAI(dt);
    this.updateFOW();

    // Cleanup dead entities
    this.units = this.units.filter(u => !u.dead);
    this.buildings = this.buildings.filter(b => !b.dead);
    this.ores = this.ores.filter(o => !o.dead);
    this.projectiles = this.projectiles.filter(p => !p.dead);
  }

  handleCameraPan(dt: number) {
    const panSpeed = 0.5 * dt;
    const edge = 50;
    if (this.mouse.x < edge) this.camera.x -= panSpeed;
    if (this.mouse.x > this.canvas.width - edge) this.camera.x += panSpeed;
    if (this.mouse.y < edge) this.camera.y -= panSpeed;
    if (this.mouse.y > this.canvas.height - edge) this.camera.y += panSpeed;

    this.camera.x = Math.max(0, Math.min(this.camera.x, MAP_SIZE.w - this.canvas.width));
    this.camera.y = Math.max(0, Math.min(this.camera.y, MAP_SIZE.h - this.canvas.height));
  }

  updateBuildQueue(dt: number) {
    if (this.buildQueue && this.buildQueue.status === 'building') {
      this.buildQueue.progress += dt;
      const totalTime = BUILD_TIMES[this.buildQueue.type];
      if (this.buildQueue.progress >= totalTime) {
        this.buildQueue.progress = totalTime;
        this.buildQueue.status = 'ready';
        audio.playReady();
        
        // Auto-spawn units
        if (['harvester', 'infantry', 'tank'].includes(this.buildQueue.type)) {
          this.spawnUnit(this.buildQueue.type as UnitType, 1);
          this.buildQueue = null;
        }
        this.updateReactState();
      } else if (Math.random() < 0.1) { // Throttle React updates
        this.updateReactState();
      }
    }
  }

  spawnUnit(type: UnitType, playerId: PlayerId) {
    const spawnerType = type === 'harvester' ? 'warfactory' : (type === 'infantry' ? 'barracks' : 'warfactory');
    const spawner = this.buildings.find(b => b.player === playerId && b.type === spawnerType);
    
    if (spawner) {
      this.units.push(new Unit(spawner.center.x, spawner.center.y + 50, type, playerId));
    } else {
      // Fallback to conyard
      const conyard = this.buildings.find(b => b.player === playerId && b.type === 'conyard');
      if (conyard) {
        this.units.push(new Unit(conyard.center.x, conyard.center.y + 50, type, playerId));
      }
    }
  }

  updateUnits(dt: number) {
    for (const unit of this.units) {
      if (unit.cooldown > 0) unit.cooldown -= dt / 16.66; // approx frames

      if (unit.type === 'harvester') {
        this.updateHarvester(unit);
      } else {
        this.updateMilitary(unit);
      }

      // Movement
      if (unit.targetPos) {
        const dx = unit.targetPos.x - unit.center.x;
        const dy = unit.targetPos.y - unit.center.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 5) {
          unit.targetPos = null;
          if (unit.state === 'moving') unit.state = 'idle';
        } else {
          const speed = STATS[unit.type].speed || 1;
          
          // Simple separation (boids)
          let sepX = 0, sepY = 0;
          for (const other of this.units) {
            if (other === unit) continue;
            const d = unit.distanceTo(other);
            if (d < 30) {
              sepX += (unit.center.x - other.center.x) / d;
              sepY += (unit.center.y - other.center.y) / d;
            }
          }

          unit.x += (dx / dist) * speed + sepX * 0.5;
          unit.y += (dy / dist) * speed + sepY * 0.5;
        }
      }
    }
  }

  updateHarvester(unit: Unit) {
    if (unit.state === 'idle') {
      if (unit.load >= 100) {
        unit.state = 'returning';
      } else {
        // Find nearest ore
        let nearest = null;
        let minDist = Infinity;
        for (const ore of this.ores) {
          const d = unit.distanceTo(ore);
          if (d < minDist) { minDist = d; nearest = ore; }
        }
        if (nearest) {
          unit.targetEntity = nearest;
          unit.state = 'moving';
        }
      }
    } else if (unit.state === 'moving' && unit.targetEntity instanceof Ore) {
      if (unit.targetEntity.dead) {
        unit.state = 'idle';
        unit.targetEntity = null;
        return;
      }
      unit.targetPos = { x: unit.targetEntity.center.x, y: unit.targetEntity.center.y };
      if (unit.distanceTo(unit.targetEntity) < 40) {
        unit.state = 'harvesting';
        unit.targetPos = null;
      }
    } else if (unit.state === 'harvesting') {
      if (!unit.targetEntity || unit.targetEntity.dead) {
        unit.state = 'idle';
      } else {
        const ore = unit.targetEntity as Ore;
        ore.amount -= 1;
        unit.load += 1;
        if (ore.amount <= 0) ore.dead = true;
        if (unit.load >= 100) {
          unit.state = 'returning';
          unit.targetEntity = null;
        }
      }
    } else if (unit.state === 'returning') {
      let nearest = null;
      let minDist = Infinity;
      for (const b of this.buildings) {
        if (b.player === unit.player && b.type === 'refinery') {
          const d = unit.distanceTo(b);
          if (d < minDist) { minDist = d; nearest = b; }
        }
      }
      if (nearest) {
        unit.targetPos = { x: nearest.center.x, y: nearest.center.y };
        if (unit.distanceTo(nearest) < 60) {
          this.players[unit.player].credits += unit.load * 2;
          unit.load = 0;
          unit.state = 'idle';
          this.updateReactState();
        }
      } else {
        // No refinery, just wait
        unit.state = 'idle';
      }
    }
  }

  updateBuildings(dt: number) {
    for (const b of this.buildings) {
      if (b.type === 'turret' && b.active) {
        if (b.cooldown > 0) b.cooldown -= dt / 16.66;

        // Auto-acquire targets
        if (!b.targetEntity || b.targetEntity.dead) {
          let nearest = null;
          let minDist = STATS.turret.range || 200;
          
          const enemies = [...this.units, ...this.buildings].filter(e => e.player !== 0 && e.player !== b.player);
          for (const e of enemies) {
            const d = b.distanceTo(e);
            if (d < minDist) { minDist = d; nearest = e; }
          }
          b.targetEntity = nearest;
        }

        if (b.targetEntity) {
          const dist = b.distanceTo(b.targetEntity);
          const range = STATS.turret.range || 200;
          
          if (dist <= range) {
            if (b.cooldown <= 0) {
              // Shoot
              this.projectiles.push(new Projectile(b.center.x, b.center.y, b.targetEntity, STATS.turret.damage!, STATS.turret.weapon!));
              if (b.player === 1 || this.distanceToCamera(b) < 800) audio.playShoot();
              b.cooldown = STATS.turret.cooldown || 40;
            }
          } else {
            b.targetEntity = null; // Target out of range
          }
        }
      }
    }
  }

  updateMilitary(unit: Unit) {
    // Auto-acquire targets
    if (!unit.targetEntity || unit.targetEntity.dead) {
      let nearest = null;
      let minDist = STATS[unit.type].range || 150;
      
      // Check enemies
      const enemies = [...this.units, ...this.buildings].filter(e => e.player !== 0 && e.player !== unit.player);
      for (const e of enemies) {
        const d = unit.distanceTo(e);
        if (d < minDist) { minDist = d; nearest = e; }
      }
      unit.targetEntity = nearest;
    }

    if (unit.targetEntity) {
      const dist = unit.distanceTo(unit.targetEntity);
      const range = STATS[unit.type].range || 150;
      
      if (dist <= range) {
        unit.targetPos = null; // Stop moving
        if (unit.cooldown <= 0) {
          // Shoot
          if (unit.type === 'tank') {
            this.projectiles.push(new Projectile(unit.center.x, unit.center.y, unit.targetEntity, STATS.tank.damage!, STATS.tank.weapon!));
            if (unit.player === 1 || this.distanceToCamera(unit) < 800) audio.playShoot();
          } else {
            // Infantry bullet
            this.projectiles.push(new Projectile(unit.center.x, unit.center.y, unit.targetEntity, STATS.infantry.damage!, STATS.infantry.weapon!));
            if (unit.player === 1 || this.distanceToCamera(unit) < 800) audio.playShoot();
          }
          unit.cooldown = STATS[unit.type].cooldown || 60;
        }
      } else if (unit.state === 'attacking') {
        // Move closer
        unit.targetPos = { x: unit.targetEntity.center.x, y: unit.targetEntity.center.y };
      }
    }
  }

  updateProjectiles() {
    for (const p of this.projectiles) {
      p.update();
    }
  }

  updateFOW() {
    // Reset visible to explored
    for (let i = 0; i < this.fowGrid.length; i++) {
      if (this.fowGrid[i] === 2) this.fowGrid[i] = 1;
    }

    // Reveal around Player 1 units and buildings
    const reveal = (x: number, y: number, radius: number) => {
      const cx = Math.floor(x / this.fowCellSize);
      const cy = Math.floor(y / this.fowCellSize);
      const r = Math.ceil(radius / this.fowCellSize);
      
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx*dx + dy*dy <= r*r) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx >= 0 && nx < this.fowCols && ny >= 0 && ny < this.fowRows) {
              this.fowGrid[ny * this.fowCols + nx] = 2;
            }
          }
        }
      }
    };

    for (const b of this.buildings) {
      if (b.player === 1) reveal(b.center.x, b.center.y, 400); // Buildings see further
    }
    for (const u of this.units) {
      if (u.player === 1) reveal(u.center.x, u.center.y, 300);
    }

    // Update ImageData
    for (let i = 0; i < this.fowGrid.length; i++) {
      const state = this.fowGrid[i];
      const idx = i * 4;
      this.fowData.data[idx] = 0; // R
      this.fowData.data[idx+1] = 0; // G
      this.fowData.data[idx+2] = 0; // B
      if (state === 0) {
        this.fowData.data[idx+3] = 255; // Solid black
      } else if (state === 1) {
        this.fowData.data[idx+3] = 128; // Half transparent
      } else {
        this.fowData.data[idx+3] = 0; // Fully transparent
      }
    }
    this.fowCtx.putImageData(this.fowData, 0, 0);
  }

  isVisible(x: number, y: number): boolean {
    const cx = Math.floor(x / this.fowCellSize);
    const cy = Math.floor(y / this.fowCellSize);
    if (cx >= 0 && cx < this.fowCols && cy >= 0 && cy < this.fowRows) {
      return this.fowGrid[cy * this.fowCols + cx] === 2;
    }
    return false;
  }
  
  isExplored(x: number, y: number): boolean {
    const cx = Math.floor(x / this.fowCellSize);
    const cy = Math.floor(y / this.fowCellSize);
    if (cx >= 0 && cx < this.fowCols && cy >= 0 && cy < this.fowRows) {
      return this.fowGrid[cy * this.fowCols + cx] >= 1;
    }
    return false;
  }

  updateAI(dt: number) {
    this.aiTimer += dt;
    if (this.aiTimer < 2000) return; // Run AI every 2s
    this.aiTimer = 0;

    this.runAIForPlayer(1);
    this.runAIForPlayer(2);
  }

  runAIForPlayer(playerId: PlayerId) {
    const ai = this.players[playerId];
    const aiBuildings = this.buildings.filter(b => b.player === playerId);
    const aiUnits = this.units.filter(u => u.player === playerId);
    const conyard = aiBuildings.find(b => b.type === 'conyard');

    if (!conyard) return; // AI is dead

    // Build logic
    const tryBuild = (type: BuildingType, cost: number, allowMultiple: boolean = false) => {
      // Don't build if Player 1 is currently building something manually
      if (playerId === 1 && this.buildQueue) return false;

      if (ai.credits >= cost && (allowMultiple || !aiBuildings.some(b => b.type === type))) {
        ai.credits -= cost;
        // Place near conyard
        let placed = false;
        for (let attempts = 0; attempts < 10; attempts++) {
          const x = conyard.x + (Math.random() - 0.5) * 400;
          const y = conyard.y + (Math.random() - 0.5) * 400;
          const snapX = Math.floor(x / 32) * 32;
          const snapY = Math.floor(y / 32) * 32;
          
          if (this.canPlaceBuilding(snapX, snapY, type)) {
            this.buildings.push(new Building(snapX, snapY, type, playerId));
            if (type === 'refinery') {
              this.units.push(new Unit(snapX, snapY + 100, 'harvester', playerId));
            }
            placed = true;
            break;
          }
        }
        
        if (!placed) {
          ai.credits += cost; // Refund if couldn't place
          return false;
        }

        this.recalculatePower();
        if (playerId === 1) this.updateReactState();
        return true;
      }
      return false;
    };

    // Determine state dynamically
    let state = 'spam';
    if (!aiBuildings.some(b => b.type === 'powerplant')) state = 'build_power';
    else if (!aiBuildings.some(b => b.type === 'refinery')) state = 'build_refinery';
    else if (!aiBuildings.some(b => b.type === 'barracks')) state = 'build_barracks';
    else if (!aiBuildings.some(b => b.type === 'warfactory')) state = 'build_warfactory';
    else if (aiBuildings.filter(b => b.type === 'turret').length < 3) state = 'build_turret';

    if (state === 'build_power') {
      tryBuild('powerplant', COSTS.powerplant);
    } else if (state === 'build_refinery') {
      tryBuild('refinery', COSTS.refinery);
    } else if (state === 'build_barracks') {
      tryBuild('barracks', COSTS.barracks);
    } else if (state === 'build_warfactory') {
      tryBuild('warfactory', COSTS.warfactory);
    } else if (state === 'build_turret') {
      tryBuild('turret', COSTS.turret, true);
    } else if (state === 'spam') {
      // Spam units
      const warfactory = aiBuildings.find(b => b.type === 'warfactory');
      const barracks = aiBuildings.find(b => b.type === 'barracks');
      
      if (warfactory && ai.credits >= COSTS.tank && Math.random() > 0.5) {
        ai.credits -= COSTS.tank;
        this.units.push(new Unit(warfactory.center.x, warfactory.center.y + 50, 'tank', playerId));
        if (playerId === 1) this.updateReactState();
      } else if (barracks && ai.credits >= COSTS.infantry) {
        ai.credits -= COSTS.infantry;
        this.units.push(new Unit(barracks.center.x, barracks.center.y + 50, 'infantry', playerId));
        if (playerId === 1) this.updateReactState();
      }

      // Attack enemy
      const military = aiUnits.filter(u => u.type !== 'harvester');
      const enemyId = playerId === 1 ? 2 : 1;
      const enemyBuildings = this.buildings.filter(b => b.player === enemyId);
      const enemyUnits = this.units.filter(u => u.player === enemyId);
      
      // Base Defense Logic
      const baseRadius = 800; // Radius around conyard to consider "base"
      let baseUnderAttack = false;
      let nearestThreat: Entity | null = null;
      let minThreatDist = Infinity;

      for (const e of [...enemyUnits, ...enemyBuildings]) {
        const dist = e.distanceTo(conyard);
        if (dist < baseRadius) {
          baseUnderAttack = true;
          if (dist < minThreatDist) {
            minThreatDist = dist;
            nearestThreat = e;
          }
        }
      }

      if (baseUnderAttack && nearestThreat) {
        // Pull back to defend!
        for (const u of military) {
          // Send military units to attack the threat in the base
          // For Player 1, only override if idle to allow manual control. For AI, always pull back.
          const canOverride = playerId === 2 || u.state === 'idle';
          if (canOverride && u.targetEntity !== nearestThreat) {
            u.targetEntity = nearestThreat;
            u.state = 'attacking';
            u.targetPos = null;
          }
        }
      } else {
        // Check if any military unit has found the enemy base
        const baseX = playerId === 1 ? MAP_SIZE.w - 200 : 200;
        const baseY = playerId === 1 ? MAP_SIZE.h - 200 : 200;
        if (!this.aiScoutedBase[playerId]) {
          for (const u of military) {
            if (u.distanceTo({ x: baseX, y: baseY }) < 600) {
              this.aiScoutedBase[playerId] = true;
              break;
            }
          }
        }

        // Scouting / Attacking logic
        const target = enemyBuildings.find(b => b.type === 'conyard') || enemyBuildings[0];

        if (military.length > 0 && military.length < 5) {
          // Send a scout
          const scout = military[0];
          const canOverrideScout = playerId === 2 || scout.state === 'idle';
          if (canOverrideScout) {
            if (!this.aiScoutedBase[playerId]) {
              // Send scout to the opposite corner (likely enemy base)
              if (scout.state === 'idle' || !scout.targetPos) {
                 scout.targetPos = {
                    x: Math.max(0, Math.min(MAP_SIZE.w, baseX + (Math.random() - 0.5) * 800)),
                    y: Math.max(0, Math.min(MAP_SIZE.h, baseY + (Math.random() - 0.5) * 800))
                 };
                 scout.targetEntity = null;
                 scout.state = 'moving';
              }
            } else if (scout.state === 'idle') {
              // Patrol around own base only when idle
              const patrolX = conyard.x + (Math.random() - 0.5) * 1000;
              const patrolY = conyard.y + (Math.random() - 0.5) * 1000;
              scout.targetPos = { x: Math.max(0, Math.min(MAP_SIZE.w, patrolX)), y: Math.max(0, Math.min(MAP_SIZE.h, patrolY)) };
              scout.targetEntity = null;
              scout.state = 'moving';
            }
          }
        } else if (military.length >= 5) {
          // Full attack only if base is scouted or we have a known target
          if (this.aiScoutedBase[playerId] && target) {
            for (const u of military) {
              const canOverrideAttack = playerId === 2 || u.state === 'idle';
              if (canOverrideAttack && u.targetEntity !== target) {
                u.targetEntity = target;
                u.state = 'attacking';
              }
            }
          } else if (!this.aiScoutedBase[playerId]) {
            // If we have an army but haven't found the base, send them to search
            for (const u of military) {
              const canOverrideAttack = playerId === 2 || u.state === 'idle';
              if (canOverrideAttack && u.state === 'idle') {
                const searchX = (playerId === 1 ? MAP_SIZE.w : 0) + (Math.random() - 0.5) * 1000;
                const searchY = (playerId === 1 ? MAP_SIZE.h : 0) + (Math.random() - 0.5) * 1000;
                u.targetPos = { x: Math.max(0, Math.min(MAP_SIZE.w, searchX)), y: Math.max(0, Math.min(MAP_SIZE.h, searchY)) };
                u.targetEntity = null;
                u.state = 'moving';
              }
            }
          }
        }
      }
    }
  }

  selectUnitsInBox() {
    if (!this.selectionBox) return;
    const { x, y, w, h } = this.selectionBox;
    for (const unit of this.units) {
      if (unit.player === 1) {
        unit.selected = (
          unit.center.x >= x && unit.center.x <= x + w &&
          unit.center.y >= y && unit.center.y <= y + h
        );
      }
    }
    // If clicked a single point, select unit under cursor
    if (w < 5 && h < 5) {
      let found = false;
      for (const unit of this.units) {
        if (unit.player === 1 && unit.distanceTo({ x, y }) < 20) {
          unit.selected = true;
          found = true;
          break;
        }
      }
      if (!found) {
        for (const b of this.buildings) {
          if (b.player === 1 && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
            b.selected = true;
            break;
          }
        }
      }
    }
  }

  commandSelectedUnits(x: number, y: number) {
    // Check if clicked an enemy
    let target: Entity | null = null;
    const enemies = [...this.units, ...this.buildings].filter(e => e.player === 2);
    for (const e of enemies) {
      // Only target if visible or explored (for buildings)
      const isVisible = this.isVisible(e.center.x, e.center.y);
      const isExplored = this.isExplored(e.center.x, e.center.y);
      
      if (e instanceof Unit && isVisible && e.distanceTo({ x, y }) < 20) target = e;
      if (e instanceof Building && isExplored && x >= e.x && x <= e.x + e.w && y >= e.y && y <= e.y + e.h) target = e;
    }

    for (const unit of this.units) {
      if (unit.player === 1 && unit.selected) {
        if (target) {
          unit.targetEntity = target;
          unit.state = 'attacking';
          audio.playAck();
        } else {
          unit.targetPos = { x, y };
          unit.targetEntity = null;
          unit.state = 'moving';
          audio.playAck();
        }
      }
    }
  }

  startBuilding(type: BuildingType | UnitType) {
    const cost = COSTS[type];
    if (this.players[1].credits >= cost && !this.buildQueue) {
      this.players[1].credits -= cost;
      this.buildQueue = { type, progress: 0, status: 'building' };
      this.updateReactState();
    }
  }

  placeBuilding(x: number, y: number) {
    if (!this.placingBuilding) return;
    
    // Snap to grid (32x32)
    const snapX = Math.floor(x / 32) * 32;
    const snapY = Math.floor(y / 32) * 32;

    if (!this.canPlaceBuilding(snapX, snapY, this.placingBuilding)) {
      audio.playError();
      return;
    }

    this.buildings.push(new Building(snapX, snapY, this.placingBuilding, 1));
    
    if (this.placingBuilding === 'refinery') {
      this.units.push(new Unit(snapX, snapY + 100, 'harvester', 1));
    }

    this.placingBuilding = null;
    this.buildQueue = null;
    this.recalculatePower();
    this.updateReactState();
    audio.playPlace();
  }

  recalculatePower() {
    for (const pid of [1, 2] as PlayerId[]) {
      let power = 0;
      let maxPower = 0;
      for (const b of this.buildings) {
        if (b.player === pid) {
          const p = POWER[b.type];
          if (p > 0) maxPower += p;
          else power += Math.abs(p);
        }
      }
      this.players[pid].power = power;
      this.players[pid].maxPower = maxPower;
    }
    this.updateReactState();
  }

  updateReactState() {
    this.onStateChange({
      players: { ...this.players },
      buildQueue: this.buildQueue ? { ...this.buildQueue } : null,
      placingBuilding: this.placingBuilding,
    });
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.save();
    this.ctx.translate(-this.camera.x, -this.camera.y);

    // Draw Map Terrain
    this.ctx.drawImage(this.terrainCanvas, 0, 0);
    
    // Subtle grid overlay
    this.ctx.strokeStyle = 'rgba(255,255,255,0.02)';
    this.ctx.lineWidth = 1;
    for (let x = 0; x < MAP_SIZE.w; x += 32) {
      this.ctx.beginPath(); this.ctx.moveTo(x, 0); this.ctx.lineTo(x, MAP_SIZE.h); this.ctx.stroke();
    }
    for (let y = 0; y < MAP_SIZE.h; y += 32) {
      this.ctx.beginPath(); this.ctx.moveTo(0, y); this.ctx.lineTo(MAP_SIZE.w, y); this.ctx.stroke();
    }

    // Draw Ore
    for (const ore of this.ores) {
      if (this.isExplored(ore.center.x, ore.center.y)) {
        this.drawOre(ore);
      }
    }

    // Draw Buildings
    for (const b of this.buildings) {
      if (b.player === 1 || this.isExplored(b.center.x, b.center.y)) {
        this.drawBuilding(b);
      }
    }

    // Draw Units
    for (const u of this.units) {
      if (u.player === 1 || this.isVisible(u.center.x, u.center.y)) {
        this.drawUnit(u);
      }
    }

    // Draw Projectiles
    for (const p of this.projectiles) {
      if (this.isVisible(p.x, p.y)) {
        if (p.weapon === 'cannon') {
          this.ctx.fillStyle = '#fbbf24';
          this.ctx.beginPath();
          this.ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
          this.ctx.fill();
          // Trail
          this.ctx.strokeStyle = 'rgba(251, 191, 36, 0.5)';
          this.ctx.lineWidth = 2;
          this.ctx.beginPath();
          this.ctx.moveTo(p.x, p.y);
          this.ctx.lineTo(p.x - (p.target.center.x - p.x) * 0.1, p.y - (p.target.center.y - p.y) * 0.1);
          this.ctx.stroke();
        } else {
          // Bullet
          this.ctx.fillStyle = '#fcd34d';
          this.ctx.beginPath();
          this.ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
          this.ctx.fill();
          // Trail
          this.ctx.strokeStyle = 'rgba(252, 211, 77, 0.3)';
          this.ctx.lineWidth = 1;
          this.ctx.beginPath();
          this.ctx.moveTo(p.x, p.y);
          this.ctx.lineTo(p.x - (p.target.center.x - p.x) * 0.05, p.y - (p.target.center.y - p.y) * 0.05);
          this.ctx.stroke();
        }
      }
    }

    // Draw FOW Overlay
    this.ctx.save();
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.drawImage(this.fowCanvas, 0, 0, MAP_SIZE.w, MAP_SIZE.h);
    this.ctx.restore();

    // Draw Selection Box
    if (this.selectionBox) {
      this.ctx.fillStyle = 'rgba(16, 185, 129, 0.1)';
      this.ctx.fillRect(this.selectionBox.x, this.selectionBox.y, this.selectionBox.w, this.selectionBox.h);
      this.ctx.strokeStyle = 'rgba(16, 185, 129, 0.8)';
      this.ctx.setLineDash([5, 5]);
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(this.selectionBox.x, this.selectionBox.y, this.selectionBox.w, this.selectionBox.h);
      this.ctx.setLineDash([]);
    }

    // Draw Placement Ghost
    if (this.placingBuilding) {
      const snapX = Math.floor(this.mouse.worldX / 32) * 32;
      const snapY = Math.floor(this.mouse.worldY / 32) * 32;
      const size = SIZES[this.placingBuilding];
      
      const canPlace = this.canPlaceBuilding(snapX, snapY, this.placingBuilding);

      this.ctx.globalAlpha = 0.5;
      this.drawBuilding({ x: snapX, y: snapY, w: size.w, h: size.h, type: this.placingBuilding, player: 1, hp: 1, maxHp: 1 } as any);
      this.ctx.globalAlpha = 1.0;
      
      this.ctx.strokeStyle = canPlace ? '#22c55e' : '#ef4444';
      this.ctx.fillStyle = canPlace ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)';
      this.ctx.lineWidth = 2;
      this.ctx.fillRect(snapX, snapY, size.w, size.h);
      this.ctx.strokeRect(snapX, snapY, size.w, size.h);
    }

    this.ctx.restore();
  }

  drawOre(ore: Ore) {
    const cx = ore.x + ore.w / 2;
    const cy = ore.y + ore.h / 2;
    
    // Shadow
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    this.ctx.beginPath();
    this.ctx.ellipse(cx + 2, cy + 2, ore.w/2, ore.h/2, 0, 0, Math.PI * 2);
    this.ctx.fill();

    // Draw a cluster of crystals based on amount
    const numCrystals = Math.min(8, Math.ceil(ore.amount / 60));
    
    // Use pseudo-random positions based on ore coordinates
    const seed = ore.x * 13 + ore.y * 7;
    
    for (let i = 0; i < numCrystals; i++) {
      const angle = (seed + i * 73) % (Math.PI * 2);
      const dist = (seed + i * 17) % (ore.w / 2.5);
      const x = cx + Math.cos(angle) * dist;
      const y = cy + Math.sin(angle) * dist;
      const size = 6 + ((seed + i * 11) % 10);
      
      // Crystal base
      this.ctx.fillStyle = '#047857';
      this.ctx.beginPath();
      this.ctx.moveTo(x, y);
      this.ctx.lineTo(x + size/2, y + size/2);
      this.ctx.lineTo(x - size/2, y + size/2);
      this.ctx.closePath();
      this.ctx.fill();

      // Crystal highlight
      this.ctx.fillStyle = '#10b981';
      this.ctx.beginPath();
      this.ctx.moveTo(x, y - size);
      this.ctx.lineTo(x + size/2, y + size/2);
      this.ctx.lineTo(x, y + size/4);
      this.ctx.closePath();
      this.ctx.fill();

      // Crystal shadow
      this.ctx.fillStyle = '#065f46';
      this.ctx.beginPath();
      this.ctx.moveTo(x, y - size);
      this.ctx.lineTo(x, y + size/4);
      this.ctx.lineTo(x - size/2, y + size/2);
      this.ctx.closePath();
      this.ctx.fill();
      
      // Glow
      this.ctx.fillStyle = 'rgba(52, 211, 153, 0.2)';
      this.ctx.beginPath();
      this.ctx.arc(x, y, size, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  drawBuilding(b: Building) {
    const color = this.players[b.player]?.color || '#888';
    
    this.ctx.save();
    this.ctx.translate(b.x, b.y);

    // Shadow
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    this.ctx.fillRect(4, 4, b.w, b.h);

    // Base concrete pad
    this.drawBevel(0, 0, b.w, b.h, '#5a5c55');
    
    // Grid pattern on pad
    this.ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    this.ctx.lineWidth = 1;
    for(let i=16; i<b.w; i+=16) {
      this.ctx.beginPath(); this.ctx.moveTo(i, 4); this.ctx.lineTo(i, b.h-4); this.ctx.stroke();
    }
    for(let i=16; i<b.h; i+=16) {
      this.ctx.beginPath(); this.ctx.moveTo(4, i); this.ctx.lineTo(b.w-4, i); this.ctx.stroke();
    }

    // Player color trim (hazard stripes style)
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(2, 2, b.w - 4, 6);
    this.ctx.clip();
    this.ctx.fillStyle = color;
    this.ctx.fillRect(2, 2, b.w - 4, 6);
    this.ctx.fillStyle = 'rgba(0,0,0,0.3)';
    for(let i=-10; i<b.w; i+=10) {
      this.ctx.beginPath();
      this.ctx.moveTo(i, 2);
      this.ctx.lineTo(i+10, 8);
      this.ctx.lineTo(i+15, 8);
      this.ctx.lineTo(i+5, 2);
      this.ctx.fill();
    }
    this.ctx.restore();

    switch (b.type) {
      case 'conyard':
        // Main structure
        this.draw3DBox(8, 12, b.w - 16, b.h - 20, 15, '#9ca3af', '#6b7280', '#4b5563');
        this.draw3DBox(12, 16, b.w - 36, b.h - 28, 10, '#6b7280', '#4b5563', '#374151');
        
        // Radar dish
        this.ctx.save();
        this.ctx.translate(b.w - 20, 25);
        this.ctx.rotate(Date.now() / 1000); // Rotating radar
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 12, 0, Math.PI, true);
        this.ctx.fillStyle = '#9ca3af';
        this.ctx.fill();
        this.ctx.strokeStyle = '#374151';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(0, -12);
        this.ctx.stroke();
        this.ctx.restore();

        // Crane arm
        this.ctx.strokeStyle = '#fbbf24';
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.moveTo(15, b.h - 15);
        this.ctx.lineTo(b.w / 2, b.h / 2);
        this.ctx.stroke();
        this.ctx.strokeStyle = '#f59e0b';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(15, b.h - 15);
        this.ctx.lineTo(b.w / 2, b.h / 2);
        this.ctx.stroke();
        
        // Crane hook
        this.ctx.strokeStyle = '#374151';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(b.w / 2, b.h / 2);
        this.ctx.lineTo(b.w / 2, b.h / 2 + 10);
        this.ctx.stroke();
        break;
        
      case 'powerplant':
        // Two cooling towers
        const drawTower = (x: number, y: number) => {
          this.ctx.fillStyle = '#9ca3af';
          this.ctx.beginPath();
          this.ctx.moveTo(x - 12, y + 15);
          this.ctx.lineTo(x - 8, y - 15);
          this.ctx.lineTo(x + 8, y - 15);
          this.ctx.lineTo(x + 12, y + 15);
          this.ctx.closePath();
          this.ctx.fill();
          this.ctx.strokeStyle = '#4b5563';
          this.ctx.lineWidth = 1;
          this.ctx.stroke();
          
          // Tower opening
          this.ctx.fillStyle = '#1f2937';
          this.ctx.beginPath();
          this.ctx.ellipse(x, y - 15, 8, 3, 0, 0, Math.PI * 2);
          this.ctx.fill();
        };
        
        drawTower(b.w / 3, b.h / 2 + 5);
        drawTower((b.w / 3) * 2, b.h / 2 + 5);
        
        // Glowing core
        const pulse = (Math.sin(Date.now() / 200) + 1) / 2;
        this.ctx.fillStyle = `rgba(59, 130, 246, ${0.5 + pulse * 0.5})`;
        this.ctx.beginPath();
        this.ctx.arc(b.w / 2, b.h / 2 - 15, 8 + pulse * 2, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.fillStyle = '#60a5fa';
        this.ctx.beginPath();
        this.ctx.arc(b.w / 2, b.h / 2 - 15, 4, 0, Math.PI * 2);
        this.ctx.fill();
        break;

      case 'refinery':
        // Main processing building
        this.draw3DBox(8, 10, b.w - 16, b.h / 2 + 5, 20, '#9ca3af', '#6b7280', '#4b5563');
        
        // Pipes
        this.draw3DBox(15, 15, b.w - 30, 8, 5, '#d1d5db', '#9ca3af', '#6b7280');
        this.draw3DBox(15, 28, b.w - 30, 8, 5, '#d1d5db', '#9ca3af', '#6b7280');
        
        // Smokestack
        this.ctx.fillStyle = '#4b5563';
        this.ctx.fillRect(b.w - 25, -15, 12, 30);
        this.ctx.fillStyle = '#1f2937';
        this.ctx.fillRect(b.w - 23, -15, 8, 4);
        
        // Smoke particles
        this.ctx.fillStyle = 'rgba(156, 163, 175, 0.5)';
        const smokeY = (Date.now() / 50) % 20;
        this.ctx.beginPath();
        this.ctx.arc(b.w - 19, -15 - smokeY, 4 + smokeY/3, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(b.w - 19, -15 - ((smokeY + 10) % 20), 4 + ((smokeY + 10) % 20)/3, 0, Math.PI * 2);
        this.ctx.fill();

        // Unloading pad
        this.ctx.fillStyle = '#374151';
        this.ctx.fillRect(10, b.h / 2 + 15, b.w - 20, b.h / 2 - 25);
        this.ctx.strokeStyle = '#10b981';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([4, 4]);
        this.ctx.strokeRect(15, b.h / 2 + 20, b.w - 30, b.h / 2 - 35);
        this.ctx.setLineDash([]);
        break;

      case 'barracks':
        // Bunker shape
        this.draw3DBox(8, b.h / 2, b.w - 16, b.h / 2 - 8, 15, '#4d533c', '#3f4431', '#2f3421');
        
        // Roof camo pattern
        this.ctx.fillStyle = '#3f4431';
        this.ctx.beginPath();
        this.ctx.moveTo(20, b.h / 2 - 15); this.ctx.lineTo(30, b.h / 2 - 10); this.ctx.lineTo(25, b.h / 2); this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.moveTo(b.w - 20, b.h / 2 - 10); this.ctx.lineTo(b.w - 35, b.h / 2 - 15); this.ctx.lineTo(b.w - 30, b.h / 2); this.ctx.fill();

        // Door
        this.ctx.fillStyle = '#111';
        this.ctx.fillRect(b.w / 2 - 10, b.h - 24, 20, 16);
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(b.w / 2 - 8, b.h - 22, 16, 14);
        
        // Sandbags
        this.ctx.fillStyle = '#d4d4d8';
        for(let i=0; i<3; i++) {
          this.ctx.beginPath(); this.ctx.ellipse(b.w/2 - 15, b.h - 10 - i*4, 6, 3, 0, 0, Math.PI*2); this.ctx.fill();
          this.ctx.beginPath(); this.ctx.ellipse(b.w/2 + 15, b.h - 10 - i*4, 6, 3, 0, 0, Math.PI*2); this.ctx.fill();
        }
        break;

      case 'warfactory':
        // Large garage
        this.draw3DBox(8, 16, b.w - 16, b.h - 24, 15, '#9ca3af', '#6b7280', '#4b5563');
        
        // Roof details
        this.draw3DBox(12, 20, b.w - 24, b.h / 2 - 16, 5, '#6b7280', '#4b5563', '#374151');
        
        // Vents
        this.ctx.fillStyle = '#1f2937';
        for(let i=0; i<4; i++) {
          this.ctx.fillRect(20 + i*12, 22, 8, 8);
        }

        // Garage door
        this.ctx.fillStyle = '#111';
        this.ctx.fillRect(b.w / 2 - 20, b.h - 28, 40, 20);
        
        // Door segments
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;
        for(let i=0; i<20; i+=4) {
          this.ctx.beginPath(); this.ctx.moveTo(b.w/2 - 20, b.h - 28 + i); this.ctx.lineTo(b.w/2 + 20, b.h - 28 + i); this.ctx.stroke();
        }

        // Ramp
        this.ctx.fillStyle = '#4a4c45';
        this.ctx.beginPath();
        this.ctx.moveTo(b.w / 2 - 20, b.h - 8);
        this.ctx.lineTo(b.w / 2 + 20, b.h - 8);
        this.ctx.lineTo(b.w / 2 + 24, b.h + 8);
        this.ctx.lineTo(b.w / 2 - 24, b.h + 8);
        this.ctx.fill();
        break;

      case 'turret':
        // Base
        this.draw3DBox(4, 4, b.w - 8, b.h - 8, 8, '#9ca3af', '#6b7280', '#4b5563');
        
        // Rotating top
        this.ctx.save();
        this.ctx.translate(b.w / 2, b.h / 2);
        
        let turretAngle = 0;
        if (b.targetEntity) {
          turretAngle = Math.atan2(b.targetEntity.center.y - (b.y + b.h / 2), b.targetEntity.center.x - (b.x + b.w / 2));
        } else {
          turretAngle = (Date.now() / 2000) % (Math.PI * 2); // Slow idle rotation
        }
        
        this.ctx.rotate(turretAngle);
        
        // Turret head
        this.ctx.fillStyle = '#4b5563';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 8, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.strokeStyle = '#374151';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
        
        // Gun barrel
        this.ctx.fillStyle = '#1f2937';
        this.ctx.fillRect(0, -2, 16, 4);
        
        this.ctx.restore();
        break;
    }

    this.ctx.restore();

    if (b.selected) {
      this.ctx.strokeStyle = '#10b981';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
    }

    this.drawHealthBar(b);
  }

  drawUnit(u: Unit) {
    const color = this.players[u.player]?.color || '#888';
    const cx = u.x + u.w / 2;
    const cy = u.y + u.h / 2;

    // Calculate rotation based on movement or target
    let angle = 0;
    if (u.targetEntity && u.state === 'attacking') {
      angle = Math.atan2(u.targetEntity.center.y - cy, u.targetEntity.center.x - cx);
    } else if (u.targetPos && u.state === 'moving') {
      angle = Math.atan2(u.targetPos.y - cy, u.targetPos.x - cx);
    } else {
      angle = (u as any).lastAngle || 0;
    }
    (u as any).lastAngle = angle;

    this.ctx.save();
    this.ctx.translate(cx, cy);

    // Shadow
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    this.ctx.beginPath();
    this.ctx.ellipse(2, 2, u.w/1.5, u.h/1.5, 0, 0, Math.PI * 2);
    this.ctx.fill();

    switch (u.type) {
      case 'harvester':
        this.ctx.rotate(angle);
        // Tracks
        this.ctx.fillStyle = '#1f2937';
        this.ctx.fillRect(-u.w/2 - 2, -u.h/2 - 2, u.w + 4, 6);
        this.ctx.fillRect(-u.w/2 - 2, u.h/2 - 4, u.w + 4, 6);
        
        // Track details
        this.ctx.fillStyle = '#374151';
        for(let i=-u.w/2; i<u.w/2; i+=4) {
          this.ctx.fillRect(i, -u.h/2 - 2, 2, 6);
          this.ctx.fillRect(i, u.h/2 - 4, 2, 6);
        }

        // Body
        this.draw3DBox(-u.w/2, -u.h/2, u.w, u.h, 8, color, '#4b5563', '#374151');
        
        // Body details
        this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
        this.ctx.fillRect(-u.w/2, -u.h/2, u.w/2, u.h);
        
        // Cab
        this.draw3DBox(-u.w/4 - 2, -u.h/4, u.w/2, u.h/2, 6, '#4b5563', '#374151', '#1f2937');
        this.ctx.fillStyle = '#9ca3af'; // Window
        this.ctx.fillRect(-u.w/4, -u.h/4 + 2, u.w/4, u.h/2 - 4);

        // Scoop arms
        this.ctx.fillStyle = '#4b5563';
        this.ctx.fillRect(u.w/4, -u.h/2 - 2, u.w/4 + 2, 4);
        this.ctx.fillRect(u.w/4, u.h/2 - 2, u.w/4 + 2, 4);

        // Scoop
        this.ctx.fillStyle = '#374151';
        this.ctx.beginPath();
        this.ctx.moveTo(u.w/2, -u.h/2 - 4);
        this.ctx.lineTo(u.w/2 + 8, -u.h/2 - 2);
        this.ctx.lineTo(u.w/2 + 8, u.h/2 + 2);
        this.ctx.lineTo(u.w/2, u.h/2 + 4);
        this.ctx.fill();
        
        // Load indicator
        if (u.load > 0) {
          this.ctx.fillStyle = '#10b981';
          this.ctx.fillRect(-u.w/2 + 2, -u.h/2 + 2, (u.w - 4) * (u.load / 100), u.h - 4);
          
          // Ore in scoop
          this.ctx.fillStyle = '#10b981';
          this.ctx.beginPath();
          this.ctx.arc(u.w/2 + 4, 0, 3 + (u.load/100)*2, 0, Math.PI*2);
          this.ctx.fill();
        }
        break;

      case 'tank':
        this.ctx.rotate(angle);
        // Tracks
        this.ctx.fillStyle = '#1f2937';
        this.ctx.fillRect(-u.w/2 - 2, -u.h/2 - 2, u.w + 4, 8);
        this.ctx.fillRect(-u.w/2 - 2, u.h/2 - 6, u.w + 4, 8);
        
        // Track details
        this.ctx.fillStyle = '#374151';
        for(let i=-u.w/2; i<u.w/2; i+=4) {
          this.ctx.fillRect(i, -u.h/2 - 2, 2, 8);
          this.ctx.fillRect(i, u.h/2 - 6, 2, 8);
        }

        // Hull
        this.draw3DBox(-u.w/2, -u.h/2 + 2, u.w, u.h - 4, 6, color, '#4b5563', '#374151');
        
        // Hull details
        this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
        this.ctx.fillRect(-u.w/2 + 2, -u.h/4, u.w/2, u.h/2);

        // Turret base
        this.ctx.fillStyle = '#4b5563';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, u.w/2.5, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.strokeStyle = '#111827';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        this.ctx.fillStyle = '#6b7280';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, u.w/3, 0, Math.PI * 2);
        this.ctx.fill();

        // Barrel
        this.ctx.fillStyle = '#1f2937';
        this.ctx.fillRect(0, -2, u.w/2 + 8, 4);
        this.ctx.fillStyle = '#374151';
        this.ctx.fillRect(u.w/2 + 4, -3, 4, 6); // Muzzle brake
        break;

      case 'infantry':
        this.ctx.rotate(angle);
        
        // Shoulders/Body
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, u.w/3, u.w/2, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Backpack
        this.drawBevel(-u.w/2, -u.w/3, u.w/3, u.w/1.5, '#3f4431');

        // Helmet
        this.ctx.fillStyle = '#4d533c';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, u.w/3.5, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Visor
        this.ctx.fillStyle = '#111';
        this.ctx.beginPath();
        this.ctx.arc(2, 0, u.w/4, -Math.PI/3, Math.PI/3);
        this.ctx.fill();

        // Rifle
        this.ctx.fillStyle = '#1f2937';
        this.ctx.fillRect(u.w/4, 2, u.w/1.5, 2);
        
        // Hands
        this.ctx.fillStyle = '#fca5a5'; // Skin tone
        this.ctx.beginPath(); this.ctx.arc(u.w/4, 3, 2, 0, Math.PI*2); this.ctx.fill();
        this.ctx.beginPath(); this.ctx.arc(u.w/2, 3, 2, 0, Math.PI*2); this.ctx.fill();
        break;
    }

    this.ctx.restore();

    if (u.selected) {
      this.ctx.strokeStyle = '#10b981';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(u.x - 2, u.y - 2, u.w + 4, u.h + 4);
    }

    this.drawHealthBar(u);
  }

  drawHealthBar(entity: Entity) {
    if (entity.hp >= entity.maxHp) return;
    const pct = entity.hp / entity.maxHp;
    
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(entity.x, entity.y - 8, entity.w, 5);
    
    let color = '#10b981'; // Green
    if (pct < 0.5) color = '#f59e0b'; // Yellow
    if (pct < 0.25) color = '#ef4444'; // Red
    
    this.ctx.fillStyle = color;
    this.ctx.fillRect(entity.x + 1, entity.y - 7, (entity.w - 2) * pct, 3);
  }
}
