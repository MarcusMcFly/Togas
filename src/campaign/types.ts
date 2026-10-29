import type { GameContext } from '../core/contracts/GameContext';
import type { GameSession } from '../core/contracts/GameSession';
import type { MissionHost } from '../core/contracts/Mission';
import type { StatRow } from '../core/progression/CampaignSave';
import type { ScoreRules } from './systems/CampaignScoreSystem';

/**
 * Cómo se juega una misión: qué minijuego la ejecuta y cómo se leen sus estadísticas.
 * El tipo de las estadísticas queda oculto para que el orquestador trate todas las
 * misiones igual (ver `missionRunner`).
 */
export interface MissionRunner {
  /** Minijuego que la ejecuta (para reservarle su propio almacenamiento). */
  gameId: string;
  start(context: GameContext, host: MissionHost<unknown>): GameSession;
  describe(stats: unknown): StatRow[];
  durationOf(stats: unknown): number;
}

/** Crea un MissionRunner con tipos comprobados para unas estadísticas concretas. */
export function missionRunner<S>(runner: {
  gameId: string;
  start(context: GameContext, host: MissionHost<S>): GameSession;
  describe(stats: S): StatRow[];
  durationOf(stats: S): number;
}): MissionRunner {
  return runner as unknown as MissionRunner;
}

export interface MissionBriefing {
  story: readonly string[];
  controls: readonly string[];
  rules: readonly string[];
}

interface MissionInfo {
  /** ID global y estable (se guarda en la partida). */
  id: string;
  /** Código visible ("1-1"). */
  code: string;
  title: string;
  environment: string;
  /** Minijuego en el que se basa (texto informativo). */
  foundation: string;
  scoring: ScoreRules;
  briefing: MissionBriefing;
}

/**
 * - `playable`: se puede jugar.
 * - `planned`: reservada en el capítulo pero aún sin implementar (se muestra, no se juega).
 */
export type MissionDefinition =
  | (MissionInfo & { status: 'playable'; runner: MissionRunner })
  | (MissionInfo & { status: 'planned' });

export interface ChapterDefinition {
  id: string;
  number: number;
  title: string;
  characterId: string;
  /**
   * Puntos de campaña con los que hay que terminar el capítulo para desbloquear al
   * siguiente personaje (la regla de desbloqueo usa este mismo número como `minScore`).
   */
  nextCharacterScore?: number;
  /** Mientras alguna misión esté `planned`, el capítulo se marca "En desarrollo". */
  missions: readonly MissionDefinition[];
}

/** Hueco del plantel de personajes. Sin `characterId`, aún no hay personaje aprobado. */
export interface RosterSlot {
  slot: number;
  characterId: string | null;
}
