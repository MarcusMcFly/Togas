import { clamp } from '../../../core/utils/math';
import { BalanceSystem } from '../systems/BalanceSystem';

export interface BalanceControlHandlers {
  press(): void;
  /** Entrada normalizada: -1…1 por eje, y positivo = arriba. */
  move(x: number, y: number): void;
  release(): void;
  /** Toque cancelado o foco perdido: soltar SIN tirarse un pedo. */
  cancel(): void;
  /** Pide pausar el juego (tras una cancelación). */
  interrupted(): void;
}

export interface BalanceControlOptions {
  /** Elemento que recibe los toques (el contenedor del juego). */
  target: HTMLElement;
  /** Lienzo de Phaser, para convertir píxeles de pantalla a unidades lógicas. */
  canvas: () => HTMLCanvasElement | null;
  view: { width: number; height: number };
  /** Radio lógico del mando: igual en cualquier resolución u orientación. */
  radius: number;
  deadZone: number;
}

/** Estado visible del mando (en unidades lógicas) para dibujarlo. */
export interface JoystickView {
  active: boolean;
  originX: number;
  originY: number;
  thumbX: number;
  thumbY: number;
}

const KEY_AXES: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0],
  ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1],
};

/**
 * Mantener, arrastrar y soltar con UN dedo (o un puntero). El mando aparece donde
 * se toca, así sirve igual para zurdos y diestros. Ignora segundos dedos.
 *
 * Alternativa con teclado (accesibilidad): mantener Espacio + flechas/WASD.
 */
export class BalanceTouchController {
  readonly view: JoystickView = { active: false, originX: 0, originY: 0, thumbX: 0, thumbY: 0 };
  enabled = true;
  private pointerId: number | null = null;
  private keyboardHeld = false;
  private readonly keysDown = new Set<string>();
  private readonly cleanups: Array<() => void> = [];

  constructor(
    private readonly options: BalanceControlOptions,
    private readonly handlers: BalanceControlHandlers,
  ) {
    const listen = <E extends Event>(target: EventTarget, type: string, handler: (event: E) => void, opts?: AddEventListenerOptions) => {
      const fn = handler as EventListener;
      target.addEventListener(type, fn, opts);
      this.cleanups.push(() => target.removeEventListener(type, fn, opts));
    };
    const { target } = options;
    listen<PointerEvent>(target, 'pointerdown', (e) => this.onDown(e));
    listen<PointerEvent>(window, 'pointermove', (e) => this.onMove(e));
    listen<PointerEvent>(window, 'pointerup', (e) => this.onUp(e));
    listen<PointerEvent>(window, 'pointercancel', (e) => {
      if (e.pointerId === this.pointerId) this.interrupt();
    });
    listen(window, 'blur', () => {
      if (this.isActive) this.interrupt();
    });
    listen<KeyboardEvent>(window, 'keydown', (e) => this.onKey(e, true));
    listen<KeyboardEvent>(window, 'keyup', (e) => this.onKey(e, false));
  }

  get isActive(): boolean {
    return this.pointerId !== null || this.keyboardHeld;
  }

  /** Suelta el control sin intento (pausa, fin de partida…). */
  cancel(): void {
    if (!this.isActive) return;
    this.reset();
    this.handlers.cancel();
  }

  dispose(): void {
    for (const cleanup of this.cleanups) cleanup();
    this.cleanups.length = 0;
    this.reset();
  }

  private onDown(e: PointerEvent): void {
    if (!this.enabled || this.isActive) return; // un solo dedo: el resto se ignora
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const point = this.toLogical(e);
    if (!point) return;
    this.pointerId = e.pointerId;
    try {
      this.options.target.setPointerCapture(e.pointerId);
    } catch {
      // Sin captura también funciona: escuchamos en window.
    }
    Object.assign(this.view, { active: true, originX: point.x, originY: point.y, thumbX: point.x, thumbY: point.y });
    this.handlers.press();
    this.handlers.move(0, 0);
  }

  private onMove(e: PointerEvent): void {
    if (e.pointerId !== this.pointerId) return;
    const point = this.toLogical(e);
    if (!point) return;
    this.updateThumb(point.x - this.view.originX, point.y - this.view.originY);
  }

  private onUp(e: PointerEvent): void {
    if (e.pointerId !== this.pointerId) return;
    this.reset();
    this.handlers.release();
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    if (e.code === 'Space') {
      e.preventDefault();
      if (e.repeat) return;
      if (down && this.enabled && !this.isActive) {
        this.keyboardHeld = true;
        const { width, height } = this.options.view;
        Object.assign(this.view, { active: true, originX: width / 2, originY: height * 0.72, thumbX: width / 2, thumbY: height * 0.72 });
        this.handlers.press();
        this.applyKeys();
      } else if (!down && this.keyboardHeld) {
        this.reset();
        this.handlers.release();
      }
      return;
    }
    if (!(e.code in KEY_AXES)) return;
    e.preventDefault();
    if (down) this.keysDown.add(e.code);
    else this.keysDown.delete(e.code);
    if (this.keyboardHeld) this.applyKeys();
  }

  private applyKeys(): void {
    let x = 0;
    let y = 0;
    for (const code of this.keysDown) {
      x += KEY_AXES[code][0];
      y += KEY_AXES[code][1];
    }
    const r = this.options.radius;
    this.updateThumb(clamp(x, -1, 1) * r, clamp(y, -1, 1) * r);
  }

  private updateThumb(dx: number, dy: number): void {
    const r = this.options.radius;
    const length = Math.hypot(dx, dy);
    const k = length > r ? r / length : 1;
    this.view.thumbX = this.view.originX + dx * k;
    this.view.thumbY = this.view.originY + dy * k;
    const n = BalanceSystem.normalizeInput(dx, dy, r, this.options.deadZone);
    this.handlers.move(n.x, n.y);
  }

  private interrupt(): void {
    this.cancel();
    this.handlers.interrupted();
  }

  private reset(): void {
    if (this.pointerId !== null) {
      try {
        this.options.target.releasePointerCapture(this.pointerId);
      } catch {
        // Ya estaba liberada.
      }
    }
    this.pointerId = null;
    this.keyboardHeld = false;
    this.view.active = false;
  }

  /** Píxeles de pantalla → unidades lógicas del juego (independiente de la resolución). */
  private toLogical(e: PointerEvent): { x: number; y: number } | null {
    const canvas = this.options.canvas();
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: ((e.clientX - rect.left) / rect.width) * this.options.view.width,
      y: ((e.clientY - rect.top) / rect.height) * this.options.view.height,
    };
  }
}
