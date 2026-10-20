import type { SpawnConfig } from '../systems/SpawnSystem';
import { COLLECTIBLES, type CollectibleDefinition } from './collectibles.config';
import { GAME_CONFIG } from './game.config';
import { SPAWN_CONFIG } from './spawn.config';

/** Reglas de la calle: emisiones con testigos, multiplicador y policía. */
export interface StreetRules {
  /** Radio (px) alrededor del personaje en el que un viandante es testigo de un pedo. */
  emissionRadius: number;
  /** Multiplicador por emisiones limpias: empieza en `start`, sube `step` por emisión y no pasa de `max`. */
  multiplier: { start: number; step: number; max: number };
  /** Acelerón temporal por emisión limpia (px/s), cuánto se pierde por segundo y velocidad tope. */
  speedBoost: { perEmission: number; decayPerSec: number; maxSpeed: number };
  /**
   * Qué cuesta un pedo con testigos: una estrella de policía (con `maxWanted`, detenido)
   * o puntos de campaña (la misión no se puede perder por esto).
   */
  witnessPenalty: { kind: 'police'; maxWanted: number } | { kind: 'points'; points: number };
}

/** Edificios que marcan el principio y el final de un recorrido por distancia. */
export type LandmarkId = 'university' | 'home';

/** Meta por distancia: de dónde se sale, adónde se llega y qué pasa al llegar. */
export interface DistanceGoal {
  kind: 'distance';
  /** px de mundo. */
  distance: number;
  destination: LandmarkId;
  /** Edificio que se deja atrás al empezar (opcional). */
  origin: LandmarkId | null;
  /** Rótulo al llegar. */
  arrivalText: string;
  /** Llegar sin puntos de campaña cuenta como fallo. */
  requiresPoints: boolean;
}

/**
 * Reglamento de una partida de Walking Around. El modo normal usa STANDALONE_RULESET;
 * otros modos (la campaña) pasan el suyo sin tocar la lógica ni el modo normal.
 */
export interface WalkingRuleset {
  id: string;
  /** Comida que aparece y su frecuencia. */
  collectibles: readonly CollectibleDefinition[];
  /** Multiplicador de puntos por comida (id → ×). Las que no estén valen ×1. */
  itemMultipliers: Readonly<Record<string, number>>;
  /** `alternate`: eructo y pedo alternados. `fartOnly`: siempre pedo. */
  emissions: 'alternate' | 'fartOnly';
  /** Fin de la partida: por tiempo o al recorrer una distancia (px de mundo). */
  goal: { kind: 'time'; durationSec: number } | DistanceGoal;
  /** `forward`: se avanza hacia la derecha. `reverse`: hacia la izquierda (vuelta a casa). */
  direction: 'forward' | 'reverse';
  /** Ciudad de noche. */
  night: boolean;
  /** `holdToJump`: mantener para saltar más. `tapAndSwipe`: tocar salta, deslizar abajo rueda. */
  controls: 'holdToJump' | 'tapAndSwipe';
  spawn: SpawnConfig;
  /** IDs de TRAVERSAL_OBSTACLES que pueden aparecer. */
  traversal: readonly string[];
  street: StreetRules | null;
  /** Viandantes en ambos sentidos (si no, todos van hacia el jugador). */
  pedestriansBothWays: boolean;
}

export const STANDALONE_RULESET: WalkingRuleset = {
  id: 'standalone',
  collectibles: COLLECTIBLES,
  itemMultipliers: {},
  emissions: 'alternate',
  goal: { kind: 'time', durationSec: GAME_CONFIG.session.durationSec },
  controls: 'holdToJump',
  spawn: SPAWN_CONFIG,
  traversal: [],
  street: null,
  pedestriansBothWays: false,
  direction: 'forward',
  night: false,
};
