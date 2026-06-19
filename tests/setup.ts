import { vi } from 'vitest';

/**
 * Mock document.createElement('canvas') so that GameEngine's internal
 * canvas creation (fowCanvas, terrainCanvas) returns canvases with
 * working 2d contexts. jsdom does not implement canvas natively.
 */
const originalCreateElement = document.createElement.bind(document);

vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
  if (tagName === 'canvas') {
    const ctx = {
      fillRect: vi.fn(),
      fill: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      ellipse: vi.fn(),
      stroke: vi.fn(),
      strokeRect: vi.fn(),
      drawImage: vi.fn(),
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      transform: vi.fn(),
      setTransform: vi.fn(),
      resetTransform: vi.fn(),
      closePath: vi.fn(),
      arcTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      rect: vi.fn(),
      roundRect: vi.fn(),
      clip: vi.fn(),
      createImageData: vi.fn((w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4),
        width: w,
        height: h,
      })),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(0) })),
      putImageData: vi.fn(),
      fillText: vi.fn(),
      strokeText: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 0 }),
      createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
      createRadialGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
      createPattern: vi.fn(),
      setLineDash: vi.fn(),
      getLineDash: vi.fn().mockReturnValue([]),
    } as unknown as CanvasRenderingContext2D;

    return {
      width: 800,
      height: 600,
      style: {},
      getContext: vi.fn().mockReturnValue(ctx),
      getBoundingClientRect: vi.fn().mockReturnValue({ left: 0, top: 0, width: 800, height: 600 }),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as HTMLCanvasElement;
  }
  return originalCreateElement(tagName);
});
