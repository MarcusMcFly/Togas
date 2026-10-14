/** Comida y bebida que suma gas y puntos. */
export interface CollectibleDefinition {
  id: string;
  name: string;
  /** Gas que suma al medidor (0–100). */
  gas: number;
  score: number;
  /** Frecuencia relativa de aparición. */
  spawnWeight: number;
}

/** Productos antigás que hay que esquivar. */
export interface ObstacleDefinition {
  id: string;
  name: string;
  /** Gas que resta al medidor. */
  gasPenalty: number;
  spawnWeight: number;
}

export const COLLECTIBLES: readonly CollectibleDefinition[] = [
  { id: 'fabes', name: 'Fabada', gas: 30, score: 100, spawnWeight: 0.9 },
  { id: 'chickpeas', name: 'Garbanzos', gas: 25, score: 90, spawnWeight: 1.1 },
  { id: 'cauliflower', name: 'Coliflor', gas: 20, score: 75, spawnWeight: 1.2 },
  { id: 'beer_can', name: 'Cerveza', gas: 18, score: 65, spawnWeight: 1.4 },
  { id: 'soda', name: 'Refresco', gas: 15, score: 50, spawnWeight: 1.5 },
];

/**
 * "Aerored" es una marca real: el ID se conserva por la spec, pero el producto que se
 * ve en pantalla es un antigás inventado ("Antigás Forte") para no usar marcas sin permiso.
 */
export const OBSTACLES: readonly ObstacleDefinition[] = [
  { id: 'aerored', name: 'Antigás Forte', gasPenalty: 35, spawnWeight: 1 },
  { id: 'fruit_salts', name: 'Sales de frutas', gasPenalty: 25, spawnWeight: 1.3 },
];

/** Cajas de colisión (ancho × alto en píxeles). */
export const COLLECTIBLE_HITBOX = { width: 40, height: 40 } as const;
export const OBSTACLE_HITBOX = { width: 34, height: 42 } as const;
