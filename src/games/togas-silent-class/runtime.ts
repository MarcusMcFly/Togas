import type { GameContext } from '../../core/contracts/GameContext';
import type { MissionHost } from '../../core/contracts/Mission';
import { DEFAULT_SKIN_ID, getSkin, type SkinDefinition } from '../../core/characters/CharacterRegistry';
import type { CreditTransferRecord } from '../../core/progression/CreditTransfer';
import type { SoundRecipe } from '../../core/services/AudioManager';
import { GAME_CONFIG } from './config/game.config';
import { getPerk, type PerkDefinition, type PerkId } from './config/perks.config';
import type { ClassroomRules } from './config/ruleset';
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

/** Estadísticas de una clase jugada como misión (las lee el orquestador). */
export interface ClassroomMissionStats {
  studentsAffected: number;
  totalStudents: number;
  silentEmissions: number;
  trumpetFarts: number;
  chairFalls: number;
  /** Presión más alta alcanzada (0–100). */
  peakPressure: number;
  /** Precisión media del equilibrio (0–1). */
  accuracy: number;
  longestHoldSec: number;
  /** `caught` si el profe te pilló soltando. */
  detection: 'none' | 'caught';
  aristocratDefeated: boolean;
  durationSec: number;
}

/** Puntos de campaña que se pierden (nunca se ganan) durante la misión. */
export interface ClassroomPenalties {
  chairFall: number;
  /** Trompetazo con el profe de espaldas (o emisión forzada por presión). */
  uncontrolledRelease: number;
  /** Goteo por segundo de clase activa: acabar antes conserva más puntos. */
  drainPerSec: number;
}

/** Textos propios de la misión (historia breve dentro del aula). */
export interface ClassroomMissionTexts {
  intro: string;
  objective: string;
  professorTarget: string;
  victory: string;
}

/** Una clase jugada como misión: anfitrión, reglamento, penalizaciones y textos. */
export interface ClassroomMission {
  host: MissionHost<ClassroomMissionStats>;
  rules: ClassroomRules;
  penalties: ClassroomPenalties;
  texts: ClassroomMissionTexts;
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

  constructor(
    readonly context: GameContext,
    readonly mission: ClassroomMission | null = null,
  ) {
    const storage = context.services.storage;
    this.skinId = getSkin(storage.get(KEYS.skin, DEFAULT_SKIN_ID)).id;
    const saved = storage.get<Partial<Preferences>>(KEYS.prefs, {});
    this.prefs = { forgiving: Boolean(saved.forgiving), highContrast: Boolean(saved.highContrast) };
    if (mission) {
      // En una misión el personaje lo impone el orquestador.
      this.skinId = getSkin(mission.host.context.skinId).id;
      return;
    }
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
    // Las misiones no participan en la Campus Run.
    if (this.mission) return null;
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
    if (this.mission) {
      this.perk = null;
      return;
    }
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
