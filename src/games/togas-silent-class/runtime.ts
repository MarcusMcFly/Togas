import type { GameContext } from '../../core/contracts/GameContext';
import { DEFAULT_SKIN_ID, getSkin, type SkinDefinition } from '../../core/characters/CharacterRegistry';
import type { CreditTransferRecord } from '../../core/progression/CreditTransfer';
import type { SoundRecipe } from '../../core/services/AudioManager';
import { GAME_CONFIG } from './config/game.config';
import { getPerk, type PerkDefinition, type PerkId } from './config/perks.config';
import type { ClassroomResults } from './systems/ClassroomSimulation';

export interface CampusRunInfo {
  sourceGameTitle: string;
  sourceScore: number;
  credits: number;
  perk: PerkDefinition | null;
}

export interface SessionResults extends ClassroomResults {
  skinId: string;
  bestScore: number;
  isNewBest: boolean;
  campusRun: CampusRunInfo | null;
}

export interface Preferences {
  /** Modo relajado (accesibilidad): menos deriva y presión más lenta. */
  forgiving: boolean;
  /** Niveles de burbuja en alto contraste. */
  highContrast: boolean;
}

const KEYS = { skin: 'selectedSkin', best: 'bestScore', tutorial: 'tutorialDone', prefs: 'preferences' } as const;

/**
 * Estado compartido por las escenas de una sesión: contexto del shell, skin,
 * preferencias, Campus Run y últimos resultados.
 */
export class SilentClassRuntime {
  lastResults: SessionResults | null = null;
  /** Ventaja elegida para la próxima partida (solo con créditos de Campus Run). */
  perk: PerkId | null = null;
  /** Carrera en curso: se fija al consumir la transferencia y dura hasta la siguiente partida. */
  private run: CampusRunInfo | null = null;
  private skinId: string;
  private prefs: Preferences;
  private readonly pauseListeners = new Set<() => void>();

  constructor(readonly context: GameContext) {
    const storage = context.services.storage;
    this.skinId = getSkin(storage.get(KEYS.skin, DEFAULT_SKIN_ID)).id;
    const saved = storage.get<Partial<Preferences>>(KEYS.prefs, {});
    this.prefs = { forgiving: Boolean(saved.forgiving), highContrast: Boolean(saved.highContrast) };
    // Si venimos de Walking Around, la skin de allí manda.
    const pending = this.pendingTransfer;
    if (pending) this.skinId = getSkin(pending.skinId).id;
  }

  get skin(): SkinDefinition {
    return getSkin(this.skinId);
  }

  selectSkin(id: string): void {
    this.skinId = getSkin(id).id;
    this.context.services.storage.set(KEYS.skin, this.skinId);
  }

  get preferences(): Readonly<Preferences> {
    return this.prefs;
  }

  setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
    this.prefs = { ...this.prefs, [key]: value };
    this.context.services.storage.set(KEYS.prefs, this.prefs);
  }

  get tutorialDone(): boolean {
    return this.context.services.storage.get(KEYS.tutorial, false);
  }

  markTutorialDone(): void {
    this.context.services.storage.set(KEYS.tutorial, true);
  }

  get bestScore(): number {
    return this.context.services.storage.get(KEYS.best, 0);
  }

  /** Transferencia de Walking Around esperando a ser usada (sin gastarla). */
  get pendingTransfer(): CreditTransferRecord | null {
    return this.context.services.campusRun.peekTransfer(GAME_CONFIG.id);
  }

  get campusRun(): CampusRunInfo | null {
    return this.run;
  }

  /**
   * Empieza la clase. Si hay transferencia pendiente se gasta aquí (una sola vez)
   * junto con la ventaja elegida; los créditos sobrantes caducan.
   */
  beginClass(): void {
    const record = this.context.services.campusRun.consumeTransfer(GAME_CONFIG.id);
    if (!record) {
      // Sin créditos no hay ventajas.
      this.perk = null;
      return;
    }
    const perk = getPerk(this.perk);
    const affordable = perk && perk.cost <= record.credits ? perk : null;
    this.perk = affordable?.id ?? null;
    this.run = {
      sourceGameTitle: this.context.gameTitle(record.sourceGameId) ?? record.sourceGameId,
      sourceScore: record.sourceScore,
      credits: record.credits,
      perk: affordable,
    };
  }

  finishSession(results: ClassroomResults): SessionResults {
    const previousBest = this.bestScore;
    const isNewBest = results.score > previousBest;
    if (isNewBest) this.context.services.storage.set(KEYS.best, results.score);
    this.lastResults = {
      ...results,
      skinId: this.skinId,
      bestScore: Math.max(previousBest, results.score),
      isNewBest,
      campusRun: this.run,
    };
    // La Campus Run termina con esta clase: la ventaja no se repite en la siguiente.
    this.run = null;
    this.perk = null;
    return this.lastResults;
  }

  get reducedMotion(): boolean {
    return this.context.services.settings.current.reducedMotion;
  }

  play(recipe: SoundRecipe, channel?: string): void {
    this.context.services.audio.play(recipe, { channel });
  }

  /** Avisa a quien lo necesite (el mando) de que el juego se ha pausado. */
  onPause(listener: () => void): () => void {
    this.pauseListeners.add(listener);
    return () => this.pauseListeners.delete(listener);
  }

  notifyPause(): void {
    for (const listener of [...this.pauseListeners]) listener();
  }

  dispose(): void {
    this.pauseListeners.clear();
  }
}
