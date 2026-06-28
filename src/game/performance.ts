export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  avgFrameTime: number;
  minFrameTime: number;
  maxFrameTime: number;
  entityCount: number;
  unitCount: number;
  buildingCount: number;
  projectileCount: number;
  oreCount: number;
  drawCalls: number;
  memoryUsage: number | null;
  uptime: number;
}

export class PerformanceMonitor {
  private frameTimes: number[] = [];
  private lastFrameTime: number = 0;
  private frameCount: number = 0;
  private fpsUpdateTime: number = 0;
  private currentFps: number = 0;
  private startTime: number = 0;
  private drawCallCount: number = 0;
  private samples: number = 60;

  constructor() {
    this.startTime = performance.now();
    this.lastFrameTime = performance.now();
    this.fpsUpdateTime = performance.now();
  }

  startFrame(): void {
    this.lastFrameTime = performance.now();
    this.drawCallCount = 0;
  }

  endFrame(): void {
    const now = performance.now();
    const frameTime = now - this.lastFrameTime;
    this.frameTimes.push(frameTime);
    this.frameCount++;
    this.drawCallCount++;

    // Keep only last N samples
    if (this.frameTimes.length > this.samples) {
      this.frameTimes.shift();
    }

    // Update FPS every 500ms
    if (now - this.fpsUpdateTime >= 500) {
      this.currentFps = Math.round((this.frameCount * 1000) / (now - this.fpsUpdateTime));
      this.frameCount = 0;
      this.fpsUpdateTime = now;
    }
  }

  recordDrawCall(): void {
    this.drawCallCount++;
  }

  getMetrics(
    entityCount: number,
    unitCount: number,
    buildingCount: number,
    projectileCount: number,
    oreCount: number,
  ): PerformanceMetrics {
    const avgFrameTime = this.frameTimes.length > 0
      ? this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
      : 0;
    const minFrameTime = this.frameTimes.length > 0 ? Math.min(...this.frameTimes) : 0;
    const maxFrameTime = this.frameTimes.length > 0 ? Math.max(...this.frameTimes) : 0;

    // Memory API is only available in Chromium
    let memoryUsage: number | null = null;
    if ((performance as any).memory) {
      memoryUsage = (performance as any).memory.usedJSHeapSize;
    }

    return {
      fps: this.currentFps,
      frameTime: this.frameTimes[this.frameTimes.length - 1] ?? 0,
      avgFrameTime,
      minFrameTime,
      maxFrameTime,
      entityCount,
      unitCount,
      buildingCount,
      projectileCount,
      oreCount,
      drawCalls: this.drawCallCount,
      memoryUsage,
      uptime: performance.now() - this.startTime,
    };
  }

  reset(): void {
    this.frameTimes = [];
    this.frameCount = 0;
    this.currentFps = 0;
    this.startTime = performance.now();
    this.lastFrameTime = this.startTime;
    this.fpsUpdateTime = this.startTime;
  }

  getFps(): number {
    return this.currentFps;
  }
}
