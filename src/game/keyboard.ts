export interface KeyBindings {
  [action: string]: string[];
}

export const DEFAULT_KEY_BINDINGS: KeyBindings = {
  // Camera
  panUp: ['w', 'W'],
  panDown: ['s', 'S'],
  panLeft: ['a', 'A'],
  panRight: ['d', 'D'],

  // Build
  buildPowerplant: ['1'],
  buildRefinery: ['2'],
  buildBarracks: ['3'],
  buildWarfactory: ['4'],
  buildTurret: ['5'],
  buildHarvester: ['6'],
  buildInfantry: ['7'],
  buildTank: ['8'],

  // Actions
  selectAll: ['ctrl+a', 'Control+a'],
  attackMove: ['x', 'X'],
  stop: [' ', 'Space'],
  delete: ['Delete', 'Backspace'],

  // UI
  toggleFps: ['f', 'F'],
  toggleMinimap: ['m', 'M'],
  toggleSound: ['p', 'P'],
  saveGame: ['ctrl+s', 'Control+s'],
  loadGame: ['ctrl+l', 'Control+l'],
  pause: ['Escape'],

  // Demo
  startDemo: ['r', 'R'],

  // Replay
  toggleReplay: ['t', 'T'],
};

export class KeyboardManager {
  private bindings: KeyBindings;
  private listeners: Map<string, Set<() => void>> = new Map();
  private enabled: boolean = true;
  private pressedKeys: Set<string> = new Set();

  constructor(bindings?: KeyBindings) {
    this.bindings = bindings || { ...DEFAULT_KEY_BINDINGS };
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
  }

  init(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  destroy(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.enabled) return;

    // Don't capture if user is typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    const key = this.normalizeKey(e);
    this.pressedKeys.add(key);

    for (const [action, keys] of Object.entries(this.bindings)) {
      if (keys.includes(key)) {
        e.preventDefault();
        this.emit(action);
      }
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    const key = this.normalizeKey(e);
    this.pressedKeys.delete(key);
  }

  private normalizeKey(e: KeyboardEvent): string {
    // Handle modifier keys
    if (e.ctrlKey || e.metaKey) {
      return `ctrl+${e.key.toLowerCase()}`;
    }
    return e.key;
  }

  on(action: string, callback: () => void): () => void {
    if (!this.listeners.has(action)) {
      this.listeners.set(action, new Set());
    }
    this.listeners.get(action)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(action)?.delete(callback);
    };
  }

  private emit(action: string): void {
    this.listeners.get(action)?.forEach(cb => cb());
  }

  isPressed(key: string): boolean {
    return this.pressedKeys.has(key);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setBinding(action: string, keys: string[]): void {
    this.bindings[action] = keys;
  }

  getBindings(): KeyBindings {
    return { ...this.bindings };
  }

  isKeyDown(key: string): boolean {
    return this.pressedKeys.has(key);
  }
}

export const keyboardManager = new KeyboardManager();
