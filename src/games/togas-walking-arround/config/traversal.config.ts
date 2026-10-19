/**
 * Obstáculos de recorrido: hay que saltarlos o pasar rodando por debajo.
 * No aparecen en la partida normal; los activa el reglamento que los pida.
 */
export type TraversalAction = 'jump' | 'roll';

export interface TraversalObstacleDefinition {
  id: string;
  name: string;
  action: TraversalAction;
  /** Caja de colisión: ancho, y altura de su borde inferior y superior sobre el suelo. */
  hitbox: { width: number; bottom: number; height: number };
  spawnWeight: number;
}

/**
 * - Los de saltar son bajos: un salto completo los supera con margen incluso a la
 *   velocidad mínima.
 * - Los de rodar dejan un hueco de 58 px bajo ellos: de pie (100 px) no se pasa, rodando
 *   (46 px) sí. Llegan más alto que el salto más alto, así que no se pueden saltar.
 */
export const TRAVERSAL_OBSTACLES: readonly TraversalObstacleDefinition[] = [
  { id: 'work_fence', name: 'Valla de obras', action: 'jump', hitbox: { width: 54, bottom: 0, height: 44 }, spawnWeight: 1.2 },
  { id: 'planter', name: 'Jardinera', action: 'jump', hitbox: { width: 58, bottom: 0, height: 40 }, spawnWeight: 1 },
  { id: 'scaffold', name: 'Andamio', action: 'roll', hitbox: { width: 92, bottom: 58, height: 170 }, spawnWeight: 1.1 },
  { id: 'hanging_sign', name: 'Cartel colgante', action: 'roll', hitbox: { width: 84, bottom: 58, height: 160 }, spawnWeight: 1 },
];

export function traversalById(id: string): TraversalObstacleDefinition | undefined {
  return TRAVERSAL_OBSTACLES.find((t) => t.id === id);
}
