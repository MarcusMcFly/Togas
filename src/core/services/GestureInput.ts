export type Gesture = 'tap' | 'swipeDown';

export interface GestureTuning {
  /**
   * Desplazamiento hacia abajo, en fracción de la altura del área táctil, a partir del
   * cual el gesto es un deslizamiento (coordenadas normalizadas: igual en cualquier pantalla).
   */
  swipeThreshold: number;
  /** El desplazamiento vertical debe superar al horizontal por este factor. */
  verticalBias: number;
}

export const DEFAULT_GESTURE_TUNING: GestureTuning = { swipeThreshold: 0.07, verticalBias: 1.2 };

/**
 * Distingue un toque de un deslizamiento hacia abajo con UN solo puntero.
 *
 * - El deslizamiento se reconoce en cuanto cruza el umbral (sin esperar a levantar el
 *   dedo), así rodar responde al instante.
 * - Un toque se reconoce al levantar el dedo si no se cruzó el umbral.
 * - Un mismo contacto produce como mucho UN gesto: deslizar nunca da también un salto.
 * - Los demás dedos se ignoran mientras el primero esté apoyado.
 *
 * Trabaja con coordenadas ya normalizadas (fracción de la altura del área), sin DOM.
 */
export class TapSwipeRecognizer {
  private pointer: number | null = null;
  private startX = 0;
  private startY = 0;
  private resolved = false;

  constructor(private readonly tuning: GestureTuning = DEFAULT_GESTURE_TUNING) {}

  get active(): boolean {
    return this.pointer !== null;
  }

  down(id: number, x: number, y: number): void {
    if (this.pointer !== null) return;
    this.pointer = id;
    this.startX = x;
    this.startY = y;
    this.resolved = false;
  }

  /** Devuelve `swipeDown` la primera vez que el contacto cruza el umbral. */
  move(id: number, x: number, y: number): Gesture | null {
    if (id !== this.pointer || this.resolved) return null;
    if (!this.isSwipeDown(x, y)) return null;
    this.resolved = true;
    return 'swipeDown';
  }

  up(id: number, x: number, y: number): Gesture | null {
    if (id !== this.pointer) return null;
    this.pointer = null;
    if (this.resolved) return null;
    this.resolved = true;
    return this.isSwipeDown(x, y) ? 'swipeDown' : 'tap';
  }

  /** Contacto cancelado (llamada entrante, cambio de app…): no produce ningún gesto. */
  cancel(id?: number): void {
    if (id !== undefined && id !== this.pointer) return;
    this.pointer = null;
    this.resolved = true;
  }

  private isSwipeDown(x: number, y: number): boolean {
    const dx = x - this.startX;
    const dy = y - this.startY;
    return dy >= this.tuning.swipeThreshold && dy >= Math.abs(dx) * this.tuning.verticalBias;
  }
}

export interface GestureOptions {
  /** Elemento donde cuentan los toques (normalmente el contenedor del juego). */
  target: HTMLElement;
  /** Teclas equivalentes (`KeyboardEvent.code`). */
  tapKeys: readonly string[];
  swipeDownKeys: readonly string[];
  tuning?: GestureTuning;
}

/** Toque/clic = un gesto y deslizar hacia abajo = otro, con teclas equivalentes. */
export class GestureBinding {
  private readonly recognizer: TapSwipeRecognizer;
  private readonly listeners = new Set<(gesture: Gesture) => void>();
  private readonly cleanups: Array<() => void> = [];
  private disposed = false;

  constructor(
    private readonly options: GestureOptions,
    private readonly onDispose: (binding: GestureBinding) => void,
  ) {
    this.recognizer = new TapSwipeRecognizer(options.tuning);
    const listen = <E extends Event>(target: EventTarget, type: string, handler: (event: E) => void) => {
      const fn = handler as EventListener;
      target.addEventListener(type, fn);
      this.cleanups.push(() => target.removeEventListener(type, fn));
    };
    listen<PointerEvent>(options.target, 'pointerdown', (e) => {
      if (e.button !== 0) return;
      const p = this.normalize(e);
      this.recognizer.down(e.pointerId, p.x, p.y);
    });
    listen<PointerEvent>(window, 'pointermove', (e) => {
      const p = this.normalize(e);
      this.fire(this.recognizer.move(e.pointerId, p.x, p.y));
    });
    listen<PointerEvent>(window, 'pointerup', (e) => {
      const p = this.normalize(e);
      this.fire(this.recognizer.up(e.pointerId, p.x, p.y));
    });
    listen<PointerEvent>(window, 'pointercancel', (e) => this.recognizer.cancel(e.pointerId));
    listen(window, 'blur', () => this.recognizer.cancel());
    listen<KeyboardEvent>(window, 'keydown', (e) => {
      const tap = options.tapKeys.includes(e.code);
      const swipe = options.swipeDownKeys.includes(e.code);
      if (!tap && !swipe) return;
      e.preventDefault(); // Que Espacio o las flechas no desplacen la página.
      if (!e.repeat) this.fire(tap ? 'tap' : 'swipeDown');
    });
  }

  onGesture(listener: (gesture: Gesture) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const cleanup of this.cleanups) cleanup();
    this.cleanups.length = 0;
    this.listeners.clear();
    this.onDispose(this);
  }

  /** Coordenadas en fracción de la altura del área (así el umbral no depende de la resolución). */
  private normalize(e: PointerEvent): { x: number; y: number } {
    const rect = this.options.target.getBoundingClientRect();
    const size = Math.max(1, rect.height);
    return { x: (e.clientX - rect.left) / size, y: (e.clientY - rect.top) / size };
  }

  private fire(gesture: Gesture | null): void {
    if (!gesture || this.disposed) return;
    for (const listener of [...this.listeners]) listener(gesture);
  }
}
