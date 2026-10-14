/** La parte de la API de `localStorage` que necesitamos. Permite inyectar un almacén falso en tests. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class MemoryStore implements KeyValueStore {
  private readonly data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}

/**
 * `localStorage` puede no existir o lanzar errores (modo privado, cookies bloqueadas…).
 * En ese caso se usa memoria: el juego funciona igual, solo que sin persistencia.
 */
function detectStorage(): KeyValueStore {
  try {
    const storage = globalThis.localStorage;
    const probe = '__togas_probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return new MemoryStore();
  }
}

/** Vista de un almacén limitada a un prefijo. Cada juego recibe la suya. */
export class SaveScope {
  constructor(
    private readonly store: KeyValueStore,
    private readonly prefix: string,
  ) {}

  get<T>(key: string, fallback: T): T {
    try {
      const raw = this.store.getItem(this.prefix + key);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  }

  set(key: string, value: unknown): void {
    try {
      this.store.setItem(this.prefix + key, JSON.stringify(value));
    } catch {
      // Almacén lleno o bloqueado: se ignora, la partida no debe romperse por esto.
    }
  }

  remove(key: string): void {
    try {
      this.store.removeItem(this.prefix + key);
    } catch {
      // Ídem.
    }
  }
}

export class SaveManager {
  constructor(
    private readonly namespace = 'togas.v1',
    private readonly store: KeyValueStore = detectStorage(),
  ) {}

  scope(name: string): SaveScope {
    return new SaveScope(this.store, `${this.namespace}:${name}:`);
  }
}
