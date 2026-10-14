export interface PrimaryActionOptions {
  /** Elemento donde un toque o clic cuenta como acción (normalmente el contenedor del juego). */
  target: HTMLElement;
  /** Códigos de tecla (`KeyboardEvent.code`) que cuentan como acción, p. ej. `Space`. */
  keys: readonly string[];
}

type Listener = () => void;

/**
 * "Acción principal": une toque, clic y teclas en un único botón virtual.
 * Sabe si está pulsado (`isDown`) y avisa al pulsar y al soltar.
 * Varias fuentes a la vez (dos dedos, tecla + clic) cuentan como una sola pulsación.
 */
export class PrimaryAction {
  private readonly sources = new Set<string>();
  private readonly pressListeners = new Set<Listener>();
  private readonly releaseListeners = new Set<Listener>();
  private readonly cleanups: Array<() => void> = [];
  private disposed = false;

  constructor(
    options: PrimaryActionOptions,
    private readonly onDispose: (action: PrimaryAction) => void,
  ) {
    const listen = <E extends Event>(target: EventTarget, type: string, handler: (event: E) => void) => {
      const fn = handler as EventListener;
      target.addEventListener(type, fn);
      this.cleanups.push(() => target.removeEventListener(type, fn));
    };

    listen<PointerEvent>(options.target, 'pointerdown', (e) => {
      if (e.button !== 0) return;
      this.down(`pointer:${e.pointerId}`);
    });
    listen<PointerEvent>(window, 'pointerup', (e) => this.up(`pointer:${e.pointerId}`));
    listen<PointerEvent>(window, 'pointercancel', (e) => this.up(`pointer:${e.pointerId}`));
    listen<KeyboardEvent>(window, 'keydown', (e) => {
      if (!options.keys.includes(e.code)) return;
      e.preventDefault(); // Que Espacio o ↑ no desplacen la página.
      if (!e.repeat) this.down(`key:${e.code}`);
    });
    listen<KeyboardEvent>(window, 'keyup', (e) => {
      if (options.keys.includes(e.code)) this.up(`key:${e.code}`);
    });
    listen(window, 'blur', () => this.releaseAll());
  }

  get isDown(): boolean {
    return this.sources.size > 0;
  }

  onPress(listener: Listener): () => void {
    this.pressListeners.add(listener);
    return () => this.pressListeners.delete(listener);
  }

  onRelease(listener: Listener): () => void {
    this.releaseListeners.add(listener);
    return () => this.releaseListeners.delete(listener);
  }

  releaseAll(): void {
    if (this.sources.size === 0) return;
    this.sources.clear();
    for (const listener of [...this.releaseListeners]) listener();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const cleanup of this.cleanups) cleanup();
    this.cleanups.length = 0;
    this.sources.clear();
    this.pressListeners.clear();
    this.releaseListeners.clear();
    this.onDispose(this);
  }

  private down(source: string): void {
    const wasDown = this.isDown;
    this.sources.add(source);
    if (!wasDown) for (const listener of [...this.pressListeners]) listener();
  }

  private up(source: string): void {
    if (!this.sources.delete(source)) return;
    if (!this.isDown) for (const listener of [...this.releaseListeners]) listener();
  }
}

/** Crea acciones y lleva la cuenta de las activas para poder limpiarlas todas al salir de un juego. */
export class InputManager {
  private readonly active = new Set<PrimaryAction>();

  bindPrimaryAction(options: PrimaryActionOptions): PrimaryAction {
    const action = new PrimaryAction(options, (a) => this.active.delete(a));
    this.active.add(action);
    return action;
  }

  get activeBindings(): number {
    return this.active.size;
  }

  disposeAll(): void {
    for (const action of [...this.active]) action.dispose();
  }
}
