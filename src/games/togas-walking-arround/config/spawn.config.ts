import type { SpawnConfig } from '../systems/SpawnSystem';

/**
 * Patrones de aparición. Cada patrón es un "trozo" de recorrido con posiciones
 * relativas (`dx`, en píxeles de mundo). El SpawnSystem los encadena al azar.
 *
 * Carriles (altura del centro del objeto sobre el suelo):
 * - ground: se recoge andando.
 * - low:    basta un salto corto.
 * - mid:    salto corto o medio.
 * - high:   hay que mantener pulsado.
 */
export const SPAWN_CONFIG: SpawnConfig = {
  /** Distancia antes del primer patrón (deja respirar tras la cuenta atrás). */
  leadIn: 1100,
  /** Separación entre patrones al principio y al final de la partida [mín, máx]. */
  gapStart: [230, 420],
  gapEnd: [150, 300],
  /** Margen extra de seguridad entre obstáculos consecutivos. */
  obstacleMargin: 40,
  lanes: { ground: 26, low: 135, mid: 175, high: 230 },
  patterns: [
    { id: 'single-ground', weight: 3, slots: [{ kind: 'collectible', dx: 0, lane: 'ground' }] },
    {
      id: 'ground-row',
      weight: 3,
      slots: [
        { kind: 'collectible', dx: 0, lane: 'ground' },
        { kind: 'collectible', dx: 60, lane: 'ground' },
        { kind: 'collectible', dx: 120, lane: 'ground' },
      ],
    },
    { id: 'single-air', weight: 2, slots: [{ kind: 'collectible', dx: 0, lane: 'mid' }] },
    {
      id: 'air-arc',
      weight: 2,
      slots: [
        { kind: 'collectible', dx: 0, lane: 'low' },
        { kind: 'collectible', dx: 60, lane: 'mid' },
        { kind: 'collectible', dx: 120, lane: 'high' },
        { kind: 'collectible', dx: 180, lane: 'mid' },
        { kind: 'collectible', dx: 240, lane: 'low' },
      ],
    },
    { id: 'obstacle', weight: 2.5, slots: [{ kind: 'obstacle', dx: 0 }] },
    {
      id: 'obstacle-reward',
      weight: 2.5,
      slots: [
        { kind: 'obstacle', dx: 0 },
        { kind: 'collectible', dx: 0, lane: 'mid' },
      ],
    },
    {
      id: 'food-obstacle-food',
      weight: 2,
      minProgress: 0.15,
      slots: [
        { kind: 'collectible', dx: 0, lane: 'ground' },
        { kind: 'obstacle', dx: 150 },
        { kind: 'collectible', dx: 150, lane: 'high' },
        { kind: 'collectible', dx: 320, lane: 'ground' },
      ],
    },
    {
      id: 'high-temptation',
      weight: 1.5,
      minProgress: 0.3,
      slots: [
        { kind: 'collectible', dx: 0, lane: 'high' },
        { kind: 'collectible', dx: 50, lane: 'high' },
      ],
    },
  ],
};
