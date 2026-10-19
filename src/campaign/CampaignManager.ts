import type { CharacterDefinition } from '../core/characters/CharacterDefinition';
import type { MissionContext, MissionHost, MissionOutcome, ScoreChange } from '../core/contracts/Mission';
import {
  emptyCampaignSave, parseCampaignSave,
  type CampaignAttempt, type CampaignSaveData, type CampaignScoreState, type StageRecord,
} from '../core/progression/CampaignSave';
import type { SaveScope } from '../core/services/SaveManager';
import { CampaignScoreSystem } from './systems/CampaignScoreSystem';
import type { CampaignUnlockSystem, SlotView } from './systems/CampaignUnlockSystem';
import { chapterNodes, isChapterComplete, nextMission, type MissionNode } from './systems/MissionProgressSystem';
import type { ChapterDefinition, MissionDefinition } from './types';

const SAVE_KEY = 'campaign';

export type PlayableMission = Extract<MissionDefinition, { status: 'playable' }>;

/** Una misión en marcha: lo que el minijuego recibe y a qué misión corresponde. */
export interface MissionRun {
  mission: PlayableMission;
  context: MissionContext;
  host: MissionHost<unknown>;
}

export interface MissionResult {
  record: StageRecord;
  attempt: CampaignAttempt;
  chapterCompleted: boolean;
  newlyUnlocked: string[];
}

/** Resumen del capítulo para el mapa (spec 12.2). */
export interface ChapterSummary {
  totalScore: number;
  /** Puntos ganados y perdidos en cada misión completada, por ID. */
  ledger: CampaignAttempt['ledger'];
  durationSec: number;
  retries: number;
  status: CampaignAttempt['status'];
}

export interface CampaignManagerOptions {
  campaignId: string;
  chapters: readonly ChapterDefinition[];
  characters: readonly CharacterDefinition[];
  unlocks: CampaignUnlockSystem;
}

interface ActiveRun {
  missionId: string;
  earned: number;
  lost: number;
  finished: boolean;
}

/**
 * Progreso de la campaña: intento en curso, misiones, puntuación de campaña y guardado.
 * No sabe nada de pantallas ni de cómo se juega cada misión: eso es cosa de la sesión
 * y de cada minijuego.
 *
 * Reglas:
 * - Las misiones se juegan en orden y no se pueden saltar.
 * - Una misión fallada se reintenta con la puntuación con la que se entró en ella.
 * - Si la puntuación llega a cero, el intento se pierde y el capítulo empieza de nuevo.
 * - Una misión lanzada que no termina (recarga, salida) cuenta como interrumpida.
 */
export class CampaignManager {
  private data: CampaignSaveData;
  private active: ActiveRun | null = null;

  constructor(
    private readonly storage: SaveScope,
    private readonly options: CampaignManagerOptions,
  ) {
    const initial = options.unlocks.initial();
    this.data = parseCampaignSave(storage.get<unknown>(SAVE_KEY, null)) ?? emptyCampaignSave(initial);
    for (const id of initial) if (!this.data.unlockedCharacterIds.includes(id)) this.data.unlockedCharacterIds.push(id);
    this.discardInvalidAttempt();
    // Una misión que seguía "en juego" al cargar no llegó a terminar.
    if (this.data.attempt?.status === 'playing') this.interrupt(this.data.attempt);
    this.save();
  }

  get state(): Readonly<CampaignSaveData> {
    return this.data;
  }

  get attempt(): Readonly<CampaignAttempt> | null {
    return this.data.attempt;
  }

  get isPlaying(): boolean {
    return this.active !== null && !this.active.finished;
  }

  markIntroSeen(): void {
    this.data.introSeen = true;
    this.save();
  }

  roster(): SlotView[] {
    return this.options.unlocks.roster(this.data.unlockedCharacterIds);
  }

  character(id: string | null): CharacterDefinition | null {
    return this.options.characters.find((c) => c.id === id) ?? null;
  }

  chapterFor(characterId: string | null): ChapterDefinition | null {
    return this.options.chapters.find((c) => c.characterId === characterId) ?? null;
  }

  get selectedChapter(): ChapterDefinition | null {
    return this.chapterFor(this.data.selectedCharacterId);
  }

  /** Elige personaje. Solo si está desbloqueado y tiene capítulo. */
  selectCharacter(id: string): boolean {
    const chapter = this.chapterFor(id);
    if (!chapter || !this.data.unlockedCharacterIds.includes(id)) return false;
    this.data.selectedCharacterId = id;
    if (!this.data.attempt || this.data.attempt.characterId !== id) this.data.attempt = this.newAttempt(chapter, id, 0);
    this.save();
    return true;
  }

  nodes(): MissionNode[] {
    const chapter = this.selectedChapter;
    return chapter ? chapterNodes(chapter, this.data.attempt) : [];
  }

  /** Misión actual del intento (la siguiente por jugar, o la fallada). */
  currentMission(): MissionDefinition | null {
    const id = this.data.attempt?.currentMissionId;
    return this.selectedChapter?.missions.find((m) => m.id === id) ?? null;
  }

  summary(): ChapterSummary | null {
    const attempt = this.data.attempt;
    if (!attempt) return null;
    return {
      totalScore: attempt.score.currentScore,
      ledger: attempt.ledger,
      durationSec: attempt.durationSec,
      retries: attempt.retries,
      status: attempt.status,
    };
  }

  /**
   * Lanza la misión actual. Devuelve lo que necesita el minijuego, o `null` si no toca
   * jugar (misión fallada sin reintentar, intento perdido…). `onFinish` se llama una vez.
   */
  startMission(onFinish: (result: MissionResult) => void): MissionRun | null {
    const attempt = this.data.attempt;
    const chapter = this.selectedChapter;
    const mission = this.currentMission();
    const character = this.character(attempt?.characterId ?? null);
    if (!attempt || !chapter || !character || attempt.status !== 'ready' || mission?.status !== 'playable') return null;

    const entry: CampaignScoreState = { ...attempt.score };
    const score = new CampaignScoreSystem(entry);
    score.setRules(mission.scoring);
    attempt.status = 'playing';
    attempt.missionEntryScore = entry.currentScore;
    this.save();

    const run: ActiveRun = { missionId: mission.id, earned: 0, lost: 0, finished: false };
    this.active = run;
    const context: MissionContext = {
      mode: 'campaign',
      campaignId: this.options.campaignId,
      chapterId: chapter.id,
      missionId: mission.id,
      characterId: character.id,
      skinId: character.skinId,
      startingScore: entry.currentScore,
      rulesetId: mission.id,
    };
    const host: MissionHost<unknown> = {
      context,
      get score() {
        return score.score;
      },
      report: (event): ScoreChange => {
        if (run.finished) return { applied: 0, score: score.score, depleted: false };
        const change = score.apply(event);
        if (change.applied > 0) run.earned += change.applied;
        else run.lost -= change.applied;
        return change;
      },
      finish: (outcome) => {
        if (run.finished) return;
        run.finished = true;
        score.lock();
        onFinish(this.complete(chapter, mission, entry, score.snapshot, run, outcome));
      },
    };
    return { mission, context, host };
  }

  /** La misión en curso se abandona (salir al hub o al mapa): cuenta como interrumpida. */
  abandonMission(): void {
    const run = this.active;
    const attempt = this.data.attempt;
    if (!run || run.finished || !attempt) return;
    run.finished = true;
    this.active = null;
    this.interrupt(attempt);
    this.save();
  }

  /** Vuelve a intentar la misión fallada, con la puntuación con la que se entró. */
  retryMission(): boolean {
    const attempt = this.data.attempt;
    if (!attempt || attempt.status !== 'failed') return false;
    attempt.status = 'ready';
    attempt.failure = null;
    attempt.retries++;
    this.save();
    return true;
  }

  /** Empieza el capítulo desde la primera misión con 0 puntos. */
  restartChapter(): boolean {
    const chapter = this.selectedChapter;
    const previous = this.data.attempt;
    if (!chapter || !previous) return false;
    const retried = previous.status !== 'ready' || previous.completedMissionIds.length > 0;
    this.data.attempt = this.newAttempt(chapter, previous.characterId, previous.retries + (retried ? 1 : 0));
    this.save();
    return true;
  }

  private complete(
    chapter: ChapterDefinition,
    mission: PlayableMission,
    entry: CampaignScoreState,
    final: CampaignScoreState,
    run: ActiveRun,
    outcome: MissionOutcome<unknown>,
  ): MissionResult {
    this.active = null;
    const attempt = this.data.attempt as CampaignAttempt;
    const durationSec = Math.max(0, Math.round(mission.runner.durationOf(outcome.stats)));
    const record: StageRecord = {
      missionId: mission.id,
      status: outcome.status,
      reason: outcome.reason ?? null,
      scoreBefore: entry.currentScore,
      scoreAfter: final.currentScore,
      earned: run.earned,
      lost: run.lost,
      durationSec,
      stats: mission.runner.describe(outcome.stats),
    };
    attempt.durationSec += durationSec;
    let chapterCompleted = false;
    let newlyUnlocked: string[] = [];

    if (outcome.status === 'completed') {
      attempt.score = final;
      if (!attempt.completedMissionIds.includes(mission.id)) attempt.completedMissionIds.push(mission.id);
      attempt.ledger[mission.id] = { earned: run.earned, lost: run.lost, durationSec };
      attempt.failure = null;
      const next = nextMission(chapter, attempt.completedMissionIds);
      attempt.status = next ? 'ready' : 'complete';
      attempt.currentMissionId = next?.id ?? null;
      chapterCompleted = isChapterComplete(chapter, attempt.completedMissionIds);
      if (chapterCompleted) {
        const best = this.data.bestChapterScores[chapter.id] ?? 0;
        this.data.bestChapterScores[chapter.id] = Math.max(best, final.currentScore);
        newlyUnlocked = this.options.unlocks.newlyUnlocked(this.data.bestChapterScores, this.data.unlockedCharacterIds);
        this.data.unlockedCharacterIds.push(...newlyUnlocked);
      }
    } else {
      // Puntuación a cero: el intento entero está perdido.
      const depleted = outcome.reason === 'bankrupt' || (entry.currentScore > 0 && final.currentScore === 0);
      attempt.status = depleted ? 'lost' : 'failed';
      attempt.failure = { missionId: mission.id, reason: outcome.reason ?? 'failed' };
      // Para reintentar, la reserva vuelve a la de entrada: lo jugado en el intento fallido no cuenta.
      attempt.score = { ...entry };
    }
    this.data.lastStage = record;
    this.save();
    return { record, attempt, chapterCompleted, newlyUnlocked };
  }

  private interrupt(attempt: CampaignAttempt): void {
    attempt.status = 'failed';
    attempt.failure = { missionId: attempt.currentMissionId ?? 'unknown', reason: 'interrupted' };
  }

  private newAttempt(chapter: ChapterDefinition, characterId: string, retries: number): CampaignAttempt {
    const first = nextMission(chapter, []);
    return {
      chapterId: chapter.id,
      characterId,
      status: first ? 'ready' : 'complete',
      currentMissionId: first?.id ?? null,
      completedMissionIds: [],
      score: { currentScore: 0, totalEarned: 0, totalLost: 0 },
      missionEntryScore: 0,
      retries,
      durationSec: 0,
      ledger: {},
      failure: null,
    };
  }

  /** Un intento que no encaja con los capítulos actuales (datos viejos) se descarta. */
  private discardInvalidAttempt(): void {
    const attempt = this.data.attempt;
    if (!attempt) return;
    const chapter = this.options.chapters.find((c) => c.id === attempt.chapterId);
    const ids = new Set(chapter?.missions.map((m) => m.id) ?? []);
    const valid = chapter
      && chapter.characterId === attempt.characterId
      && attempt.completedMissionIds.every((id) => ids.has(id))
      && (attempt.currentMissionId === null || ids.has(attempt.currentMissionId));
    if (!valid) this.data.attempt = null;
    if (this.data.selectedCharacterId && !this.character(this.data.selectedCharacterId)) this.data.selectedCharacterId = null;
  }

  private save(): void {
    this.storage.set(SAVE_KEY, this.data);
  }
}
