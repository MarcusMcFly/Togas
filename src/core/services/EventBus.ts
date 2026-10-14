// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (payload: any) => void;

/**
 * Canal de mensajes tipado: los módulos se avisan ("¡ha habido una emisión!")
 * sin importarse entre sí. `Events` describe cada evento y el tipo de su carga.
 */
export class EventBus<Events extends Record<string, unknown>> {
  private readonly handlers = new Map<keyof Events, Set<Handler>>();

  /** Suscribe un manejador. Devuelve la función para darse de baja. */
  on<K extends keyof Events>(type: K, handler: (payload: Events[K]) => void): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler);
    return () => this.off(type, handler);
  }

  off<K extends keyof Events>(type: K, handler: (payload: Events[K]) => void): void {
    this.handlers.get(type)?.delete(handler);
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    const set = this.handlers.get(type);
    if (!set) return;
    // Copia: un manejador puede darse de baja mientras se recorre la lista.
    for (const handler of [...set]) handler(payload);
  }

  listenerCount(type?: keyof Events): number {
    if (type !== undefined) return this.handlers.get(type)?.size ?? 0;
    let total = 0;
    for (const set of this.handlers.values()) total += set.size;
    return total;
  }

  clear(): void {
    this.handlers.clear();
  }
}
