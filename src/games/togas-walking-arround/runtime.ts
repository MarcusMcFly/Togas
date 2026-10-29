import type { GameContext } from '../../core/contracts/GameContext';
import type { MissionHost } from '../../core/contracts/Mission';
import type { SoundRecipe } from '../../core/services/AudioManager';
import { EventBus } from '../../core/services/EventBus';
import type { CollectibleDefinition, ObstacleDefinition } from './config/collectibles.config';
import { DEFAULT_SKIN_ID, getSkin, type SkinDefinition } from '../../core/characters/CharacterRegistry';
import { STANDALONE_RULESET, type WalkingRuleset } from './config/ruleset';
import type { Emission } from './systems/EmissionSystem';
import type { SessionStats } from './systems/ScoreSystem';

/** Eventos internos del juego (PlayScene → HUD y efectos). */
export interface TogasEvents extends Record<string, unknown> {
  collect: { def: CollectibleDefinition };
  obstacle: { def: ObstacleDefinition };
  emission: Emission;
}

export interface SessionResults extends SessionStats {
  skinId: string;
  bestScore: number;
  isNewBest: boolean;
}

/** Estadísticas de una partida jugada como misión (las lee el orquestador). */
export interface WalkingMissionStats {
  pointsEarned: number;
  /** Unidades recogidas por tipo de comida. */
  collected: Record<string, number>;
  /** Recogidas de las comidas con multiplicador especial (p. ej. lentejas). */
  specialCollected: number;
  otherCollected: number;
  emissions: number;
  cleanEmissions: number;
  /** Pedos con testigos. */
  witnessedEmissions: number;
  /** Puntos de campaña perdidos por testigos (si el reglamento los cobra en puntos). */
  pointsLost: number;
  pedestriansAffected: number;
  bestMultiplier: number;
  wanted: number;
  maxWanted: number;
  stumbles: number;
  durationSec: number;
}

/** Una partida jugada como misión: el anfitrión y el reglamento que manda. */
export interface WalkingMission {
  host: MissionHost<WalkingMissionStats>;
  ruleset: WalkingRuleset;
}

const SKIN_KEY = 'selectedSkin';
const BEST_KEY = 'bestScore';

/**
 * Estado compartido por las escenas de una sesión: contexto del shell, skin elegida,
 * reglamento, últimos resultados y bus de eventos. Se crea al empezar y se descarta al salir.
 */
export class TogasRuntime {
  readonly events = new EventBus<TogasEvents>();
  readonly ruleset: WalkingRuleset;
  lastResults: SessionResults | null = null;
  private skinId: string;

  constructor(
    readonly context: GameContext,
    readonly mission: WalkingMission | null = null,
  ) {
    this.ruleset = mission?.ruleset ?? STANDALONE_RULESET;
    // En una misión el personaje lo impone el orquestador y no se guarda como preferencia.
    this.skinId = mission
      ? getSkin(mission.host.context.skinId).id
      : getSkin(context.services.storage.get(SKIN_KEY, DEFAULT_SKIN_ID)).id;
  }

  get skin(): SkinDefinition {
    return getSkin(this.skinId);
  }

  selectSkin(id: string): void {
    this.skinId = getSkin(id).id;
    this.context.services.storage.set(SKIN_KEY, this.skinId);
  }

  get bestScore(): number {
    return this.context.services.storage.get(BEST_KEY, 0);
  }

  /** Guarda el récord si se ha superado y devuelve los resultados completos. */
  finishSession(stats: SessionStats): SessionResults {
    const previousBest = this.bestScore;
    const isNewBest = stats.score > previousBest;
    if (isNewBest) this.context.services.storage.set(BEST_KEY, stats.score);
    this.lastResults = { ...stats, skinId: this.skinId, bestScore: Math.max(previousBest, stats.score), isNewBest };
    return this.lastResults;
  }

  get reducedMotion(): boolean {
    return this.context.services.settings.current.reducedMotion;
  }

  play(recipe: SoundRecipe, channel?: string): void {
    this.context.services.audio.play(recipe, { channel });
  }

  dispose(): void {
    this.events.clear();
  }
}
