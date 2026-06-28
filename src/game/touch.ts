export interface TouchState {
  active: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  startTime: number;
  isTap: boolean;
  isLongPress: boolean;
  isDragging: boolean;
  isPanning: boolean;
  isPinching: boolean;
  pinchDistance: number;
  fingerCount: number;
}

export interface TouchAction {
  type: 'select' | 'move' | 'attack' | 'build' | 'pan' | 'zoom';
  x: number;
  y: number;
  worldX: number;
  worldY: number;
}

export class TouchManager {
  private state: TouchState = {
    active: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    startTime: 0,
    isTap: false,
    isLongPress: false,
    isDragging: false,
    isPanning: false,
    isPinching: false,
    pinchDistance: 0,
    fingerCount: 0,
  };

  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private camera: { x: number; y: number } | null = null;
  private onAction: ((action: TouchAction) => void) | null = null;
  private onLongPress: ((x: number, y: number) => void) | null = null;
  private enabled: boolean = true;

  // Thresholds
  private TAP_THRESHOLD = 10;
  private LONG_PRESS_MS = 500;
  private DRAG_THRESHOLD = 15;

  init(canvas: HTMLCanvasElement, camera: { x: number; y: number }): void {
    this.canvas = canvas;
    this.camera = camera;

    canvas.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', this.handleTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', this.handleTouchCancel, { passive: false });
  }

  destroy(): void {
    if (this.canvas) {
      this.canvas.removeEventListener('touchstart', this.handleTouchStart);
      this.canvas.removeEventListener('touchmove', this.handleTouchMove);
      this.canvas.removeEventListener('touchend', this.handleTouchEnd);
      this.canvas.removeEventListener('touchcancel', this.handleTouchCancel);
    }
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
    }
  }

  setOnAction(callback: (action: TouchAction) => void): void {
    this.onAction = callback;
  }

  setOnLongPress(callback: (x: number, y: number) => void): void {
    this.onLongPress = callback;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  private getCanvasPos(touch: Touch): { x: number; y: number } {
    const rect = this.canvas!.getBoundingClientRect();
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    };
  }

  private getWorldPos(screenX: number, screenY: number): { x: number; y: number } {
    if (!this.camera) return { x: screenX, y: screenY };
    return {
      x: screenX + this.camera.x,
      y: screenY + this.camera.y,
    };
  }

  private getTouchDistance(t1: Touch, t2: Touch): number {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private handleTouchStart = (e: TouchEvent): void => {
    if (!this.enabled) return;
    e.preventDefault();

    const touches = e.touches;
    this.state.active = true;
    this.state.fingerCount = touches.length;
    this.state.startTime = Date.now();

    if (touches.length >= 1) {
      const pos = this.getCanvasPos(touches[0]);
      this.state.startX = pos.x;
      this.state.startY = pos.y;
      this.state.currentX = pos.x;
      this.state.currentY = pos.y;
      this.state.isTap = true;
      this.state.isDragging = false;
      this.state.isPanning = false;
    }

    if (touches.length === 2) {
      this.state.isPinching = true;
      this.state.pinchDistance = this.getTouchDistance(touches[0], touches[1]);
      this.state.isTap = false;
    }

    // Long press detection
    this.longPressTimer = setTimeout(() => {
      if (this.state.isTap && !this.state.isDragging) {
        this.state.isLongPress = true;
        const world = this.getWorldPos(this.state.currentX, this.state.currentY);
        this.onLongPress?.(world.x, world.y);
      }
    }, this.LONG_PRESS_MS);
  };

  private handleTouchMove = (e: TouchEvent): void => {
    if (!this.enabled || !this.state.active) return;
    e.preventDefault();

    const touches = e.touches;

    if (touches.length === 1 && !this.state.isPinching) {
      const pos = this.getCanvasPos(touches[0]);
      const dx = pos.x - this.state.startX;
      const dy = pos.y - this.state.startY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > this.TAP_THRESHOLD) {
        this.state.isTap = false;
      }

      if (dist > this.DRAG_THRESHOLD) {
        this.state.isDragging = true;
        this.state.isPanning = true;
      }

      this.state.currentX = pos.x;
      this.state.currentY = pos.y;
    }

    if (touches.length === 2) {
      this.state.isPinching = true;
      this.state.pinchDistance = this.getTouchDistance(touches[0], touches[1]);
      this.state.isTap = false;
    }
  };

  private handleTouchEnd = (e: TouchEvent): void => {
    if (!this.enabled || !this.state.active) return;
    e.preventDefault();

    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    const world = this.getWorldPos(this.state.currentX, this.state.currentY);

    if (this.state.isTap && !this.state.isDragging && !this.state.isLongPress) {
      // Single tap = select or command
      this.onAction?.({
        type: 'select',
        x: this.state.currentX,
        y: this.state.currentY,
        worldX: world.x,
        worldY: world.y,
      });
    } else if (this.state.isDragging && !this.state.isPinching) {
      // Drag = pan camera
      this.onAction?.({
        type: 'pan',
        x: this.state.currentX,
        y: this.state.currentY,
        worldX: world.x,
        worldY: world.y,
      });
    }

    // Reset state
    this.state = {
      active: false,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      startTime: 0,
      isTap: false,
      isLongPress: false,
      isDragging: false,
      isPanning: false,
      isPinching: false,
      pinchDistance: 0,
      fingerCount: 0,
    };
  };

  private handleTouchCancel = (e: TouchEvent): void => {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    this.state.active = false;
    this.state.isTap = false;
    this.state.isDragging = false;
    this.state.isPanning = false;
    this.state.isPinching = false;
  };

  isTouchDevice(): boolean {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  getPinchDistance(): number {
    return this.state.pinchDistance;
  }

  isPinching(): boolean {
    return this.state.isPinching;
  }
}
