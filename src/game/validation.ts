import { PlayerId, Position } from './types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ActionCommand {
  type: 'move' | 'attack' | 'build' | 'spawn' | 'harvest';
  unitId?: number;
  buildingId?: number;
  targetId?: number;
  targetPos?: Position;
  unitType?: string;
  buildingType?: string;
  playerId: PlayerId;
  timestamp: number;
}

export function validateAction(
  command: ActionCommand,
  getEntity: (id: number) => { player: PlayerId; x: number; y: number; dead: boolean } | null,
  getCredits: (playerId: PlayerId) => number,
  getBuildingAt: (x: number, y: number) => boolean,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate player
  if (command.playerId !== 1 && command.playerId !== 2) {
    errors.push(`Invalid player ID: ${command.playerId}`);
  }

  // Validate timestamp (prevent future-dated commands)
  if (command.timestamp > Date.now() + 1000) {
    errors.push('Command timestamp is in the future');
  }

  switch (command.type) {
    case 'move': {
      if (!command.targetPos) {
        errors.push('Move command requires target position');
      }
      if (command.unitId === undefined) {
        errors.push('Move command requires unit ID');
      }
      if (command.unitId !== undefined) {
        const unit = getEntity(command.unitId);
        if (!unit) errors.push(`Unit ${command.unitId} not found`);
        else if (unit.dead) errors.push(`Unit ${command.unitId} is dead`);
        else if (unit.player !== command.playerId) errors.push(`Unit ${command.unitId} does not belong to player ${command.playerId}`);
      }
      // Validate position bounds
      if (command.targetPos) {
        if (command.targetPos.x < 0 || command.targetPos.x > 2000 || command.targetPos.y < 0 || command.targetPos.y > 2000) {
          warnings.push('Target position is outside map bounds');
        }
      }
      break;
    }

    case 'attack': {
      if (command.unitId === undefined || command.targetId === undefined) {
        errors.push('Attack command requires both unit ID and target ID');
      }
      if (command.unitId !== undefined) {
        const unit = getEntity(command.unitId);
        if (!unit) errors.push(`Unit ${command.unitId} not found`);
        else if (unit.dead) errors.push(`Unit ${command.unitId} is dead`);
        else if (unit.player !== command.playerId) errors.push(`Unit ${command.unitId} does not belong to player`);
      }
      if (command.targetId !== undefined) {
        const target = getEntity(command.targetId);
        if (!target) errors.push(`Target ${command.targetId} not found`);
        else if (target.dead) errors.push(`Target ${command.targetId} is already dead`);
        else if (target.player === command.playerId) errors.push('Cannot attack own entity');
      }
      break;
    }

    case 'build': {
      if (!command.buildingType) {
        errors.push('Build command requires building type');
      }
      if (command.targetPos) {
        if (getBuildingAt(command.targetPos.x, command.targetPos.y)) {
          errors.push('Cannot build on existing building');
        }
      }
      break;
    }

    case 'spawn': {
      if (!command.unitType) {
        errors.push('Spawn command requires unit type');
      }
      break;
    }

    case 'harvest': {
      if (command.unitId === undefined) {
        errors.push('Harvest command requires unit ID');
      }
      break;
    }

    default:
      errors.push(`Unknown command type: ${command.type}`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateGameState(
  players: Record<PlayerId, { credits: number; power: number; maxPower: number }>,
  entityCount: number,
  maxEntities: number = 1000,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check credits are non-negative
  for (const pid of [1, 2] as PlayerId[]) {
    const player = players[pid];
    if (!player) {
      errors.push(`Player ${pid} state missing`);
      continue;
    }
    if (player.credits < 0) {
      errors.push(`Player ${pid} has negative credits: ${player.credits}`);
    }
    if (player.credits > 1000000) {
      warnings.push(`Player ${pid} has unusually high credits: ${player.credits}`);
    }
    if (player.maxPower < 0) {
      errors.push(`Player ${pid} has negative maxPower`);
    }
    if (player.power < 0) {
      errors.push(`Player ${pid} has negative power consumption`);
    }
  }

  // Check entity count
  if (entityCount > maxEntities) {
    warnings.push(`High entity count: ${entityCount} (max recommended: ${maxEntities})`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

// Anti-cheat: rate limiting for commands
export class CommandRateLimiter {
  private commandCounts: Map<string, number[]> = new Map();
  private windowMs: number;
  private maxCommands: number;

  constructor(windowMs: number = 1000, maxCommands: number = 30) {
    this.windowMs = windowMs;
    this.maxCommands = maxCommands;
  }

  check(playerId: PlayerId, commandType: string): boolean {
    const key = `${playerId}:${commandType}`;
    const now = Date.now();
    const timestamps = this.commandCounts.get(key) || [];

    // Remove old entries
    const valid = timestamps.filter(t => now - t < this.windowMs);
    this.commandCounts.set(key, valid);

    if (valid.length >= this.maxCommands) {
      return false; // Rate limit exceeded
    }

    valid.push(now);
    return true;
  }

  reset(): void {
    this.commandCounts.clear();
  }
}
