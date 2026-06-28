import { PlayerId, Position } from './types';

export interface ReplayFrame {
  tick: number;
  timestamp: number;
  events: ReplayEvent[];
}

export interface ReplayEvent {
  type: 'move' | 'attack' | 'build' | 'spawn' | 'destroy' | 'harvest';
  entityId?: number;
  playerId?: PlayerId;
  targetId?: number;
  x?: number;
  y?: number;
  buildingType?: string;
  unitType?: string;
}

export interface Replay {
  version: number;
  timestamp: number;
  mapWidth: number;
  mapHeight: number;
  frames: ReplayFrame[];
  winner: PlayerId | null;
  duration: number;
}

const MAX_REPLAY_FRAMES = 10000;
const SNAPSHOT_INTERVAL = 30; // Capture a frame every 30 ticks

export class ReplayRecorder {
  private frames: ReplayFrame[] = [];
  private currentTick: number = 0;
  private recording: boolean = false;
  private mapWidth: number;
  private mapHeight: number;
  private startTime: number = 0;

  constructor(mapWidth: number, mapHeight: number) {
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
  }

  start(): void {
    this.frames = [];
    this.currentTick = 0;
    this.recording = true;
    this.startTime = Date.now();
  }

  stop(): void {
    this.recording = false;
  }

  isRecording(): boolean {
    return this.recording;
  }

  tick(events: ReplayEvent[]): void {
    if (!this.recording) return;
    this.currentTick++;

    if (events.length > 0 || this.currentTick % SNAPSHOT_INTERVAL === 0) {
      this.frames.push({
        tick: this.currentTick,
        timestamp: Date.now() - this.startTime,
        events,
      });

      // Prevent unbounded memory growth
      if (this.frames.length > MAX_REPLAY_FRAMES) {
        this.frames = this.frames.slice(-MAX_REPLAY_FRAMES * 0.8);
      }
    }
  }

  addEvent(event: ReplayEvent): void {
    if (!this.recording) return;
    // Add to current frame or create new one
    if (this.frames.length > 0 && this.frames[this.frames.length - 1].tick === this.currentTick) {
      this.frames[this.frames.length - 1].events.push(event);
    } else {
      this.frames.push({
        tick: this.currentTick,
        timestamp: Date.now() - this.startTime,
        events: [event],
      });
    }
  }

  finalize(winner: PlayerId | null): Replay {
    return {
      version: 1,
      timestamp: Date.now(),
      mapWidth: this.mapWidth,
      mapHeight: this.mapHeight,
      frames: [...this.frames],
      winner,
      duration: this.frames.length > 0 ? this.frames[this.frames.length - 1].timestamp : 0,
    };
  }

  getFrameCount(): number {
    return this.frames.length;
  }

  getCurrentTick(): number {
    return this.currentTick;
  }
}

export class ReplayPlayer {
  private replay: Replay | null = null;
  private currentFrameIndex: number = 0;
  private playing: boolean = false;
  private speed: number = 1;
  private lastFrameTime: number = 0;
  private onFrame: ((frame: ReplayFrame) => void) | null = null;
  private onComplete: (() => void) | null = null;

  load(replay: Replay): void {
    this.replay = replay;
    this.currentFrameIndex = 0;
    this.playing = false;
  }

  play(): void {
    if (!this.replay) return;
    this.playing = true;
    this.lastFrameTime = performance.now();
  }

  pause(): void {
    this.playing = false;
  }

  stop(): void {
    this.playing = false;
    this.currentFrameIndex = 0;
  }

  setSpeed(speed: number): void {
    this.speed = Math.max(0.25, Math.min(4, speed));
  }

  getSpeed(): number {
    return this.speed;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  onFrameEvent(callback: (frame: ReplayFrame) => void): void {
    this.onFrame = callback;
  }

  onCompleteEvent(callback: () => void): void {
    this.onComplete = callback;
  }

  seekToFrame(index: number): void {
    if (!this.replay) return;
    this.currentFrameIndex = Math.max(0, Math.min(index, this.replay.frames.length - 1));
  }

  seekToTime(ms: number): void {
    if (!this.replay) return;
    const index = this.replay.frames.findIndex(f => f.timestamp >= ms);
    this.currentFrameIndex = index >= 0 ? index : this.replay.frames.length - 1;
  }

  update(): void {
    if (!this.playing || !this.replay) return;

    const now = performance.now();
    const elapsed = (now - this.lastFrameTime) * this.speed;
    this.lastFrameTime = now;

    const frames = this.replay.frames;
    if (this.currentFrameIndex >= frames.length) {
      this.playing = false;
      this.onComplete?.();
      return;
    }

    // Advance frames based on elapsed time
    const currentFrame = frames[this.currentFrameIndex];
    const nextTimestamp = currentFrame.timestamp + elapsed;

    while (this.currentFrameIndex < frames.length - 1 && 
           frames[this.currentFrameIndex + 1].timestamp <= nextTimestamp) {
      this.currentFrameIndex++;
      const frame = frames[this.currentFrameIndex];
      this.onFrame?.(frame);
    }

    if (this.currentFrameIndex >= frames.length - 1) {
      this.playing = false;
      this.onComplete?.();
    }
  }

  getProgress(): number {
    if (!this.replay || this.replay.frames.length === 0) return 0;
    return this.currentFrameIndex / (this.replay.frames.length - 1);
  }

  getCurrentTime(): number {
    if (!this.replay || this.replay.frames.length === 0) return 0;
    return this.replay.frames[this.currentFrameIndex]?.timestamp ?? 0;
  }

  getDuration(): number {
    return this.replay?.duration ?? 0;
  }

  getFrameCount(): number {
    return this.replay?.frames.length ?? 0;
  }
}

// Replay storage
const REPLAY_PREFIX = 'commandwatch_replay_';
const REPLAY_LIST_KEY = 'commandwatch_replay_list';

export interface ReplayMeta {
  name: string;
  timestamp: number;
  duration: number;
  winner: PlayerId | null;
  frameCount: number;
}

export function saveReplay(name: string, replay: Replay): void {
  try {
    localStorage.setItem(REPLAY_PREFIX + name, JSON.stringify(replay));
    const list = getReplayList();
    list.push({
      name,
      timestamp: replay.timestamp,
      duration: replay.duration,
      winner: replay.winner,
      frameCount: replay.frames.length,
    });
    localStorage.setItem(REPLAY_LIST_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Failed to save replay:', e);
  }
}

export function loadReplay(name: string): Replay | null {
  try {
    const data = localStorage.getItem(REPLAY_PREFIX + name);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function deleteReplay(name: string): void {
  localStorage.removeItem(REPLAY_PREFIX + name);
  const list = getReplayList().filter(r => r.name !== name);
  localStorage.setItem(REPLAY_LIST_KEY, JSON.stringify(list));
}

export function getReplayList(): ReplayMeta[] {
  try {
    const data = localStorage.getItem(REPLAY_LIST_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}
