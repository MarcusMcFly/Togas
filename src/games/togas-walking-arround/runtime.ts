import type { GameContext } from '../../core/contracts/GameContext';
import type { SoundRecipe } from '../../core/services/AudioManager';
import { EventBus } from '../../core/services/EventBus';
import type { CollectibleDefinition, ObstacleDefinition } from './config/collectibles.config';
import { DEFAULT_SKIN_ID, getSkin, type SkinDefinition } from './config/skins.config';
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

const SKIN_KEY = 'selectedSkin';
const BEST_KEY = 'bestScore';

/**
 * Estado compartido por las escenas de una sesión: contexto del shell, skin elegida,
 * últimos resultados y bus de eventos. Se crea al empezar y se descarta al salir.
 */
export class TogasRuntime {
  readonly events = new EventBus<TogasEvents>();
  lastResults: SessionResults | null = null;
  private skinId: string;

  constructor(readonly context: GameContext) {
    this.skinId = getSkin(context.services.storage.get(SKIN_KEY, DEFAULT_SKIN_ID)).id;
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
