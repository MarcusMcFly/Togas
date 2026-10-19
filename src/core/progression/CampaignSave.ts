/**
 * Partida guardada del modo campaña: esquema, valores por defecto y validación.
 * Sin almacenamiento ni lógica de juego: se prueba con objetos.
 *
 * Los datos vienen de `localStorage` y podrían estar corruptos o editados a mano:
 * todo se valida antes de usarse y, si algo no cuadra, se descarta.
 */

export const CAMPAIGN_SAVE_VERSION = 1;

export interface CampaignScoreState {
  currentScore: number;
  totalEarned: number;
  totalLost: number;
}

/**
 * Estado del intento en curso:
 * - `ready`: esperando a que empiece `currentMissionId`.
 * - `playing`: hay una misión lanzada. Si se carga así, la misión se interrumpió (recarga, salida…).
 * - `failed`: la misión ha fallado; se puede reintentar con la puntuación de entrada.
 * - `lost`: la puntuación llegó a cero; hay que empezar el capítulo de nuevo.
 * - `complete`: no quedan misiones jugables en el capítulo.
 */
export type AttemptStatus = 'ready' | 'playing' | 'failed' | 'lost' | 'complete';

export interface MissionLedgerEntry {
  earned: number;
  lost: number;
  durationSec: number;
}

/** Una fila de estadísticas ya lista para mostrar. */
export interface StatRow {
  label: string;
  value: string;
}

export interface StageRecord {
  missionId: string;
  status: 'completed' | 'failed';
  reason: string | null;
  scoreBefore: number;
  scoreAfter: number;
  earned: number;
  lost: number;
  durationSec: number;
  stats: StatRow[];
}

export interface CampaignAttempt {
  chapterId: string;
  characterId: string;
  status: AttemptStatus;
  currentMissionId: string | null;
  completedMissionIds: string[];
  score: CampaignScoreState;
  /** Puntuación con la que se entró en la misión actual (para reintentarla). */
  missionEntryScore: number;
  retries: number;
  /** Tiempo jugado en el capítulo (s). */
  durationSec: number;
  /** Puntos ganados y perdidos en cada misión completada de este intento. */
  ledger: Record<string, MissionLedgerEntry>;
  failure: { missionId: string; reason: string } | null;
}

export interface CampaignSaveData {
  version: typeof CAMPAIGN_SAVE_VERSION;
  introSeen: boolean;
  selectedCharacterId: string | null;
  unlockedCharacterIds: string[];
  attempt: CampaignAttempt | null;
  lastStage: StageRecord | null;
  bestChapterScores: Record<string, number>;
}

export function emptyCampaignSave(initialUnlocked: readonly string[]): CampaignSaveData {
  return {
    version: CAMPAIGN_SAVE_VERSION,
    introSeen: false,
    selectedCharacterId: null,
    unlockedCharacterIds: [...initialUnlocked],
    attempt: null,
    lastStage: null,
    bestChapterScores: {},
  };
}

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SCORE = 10_000_000;
const MAX_TEXT = 200;
const STATUSES: readonly AttemptStatus[] = ['ready', 'playing', 'failed', 'lost', 'complete'];

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isId = (v: unknown): v is string => typeof v === 'string' && ID.test(v);
const isPoints = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= MAX_SCORE;
const isSeconds = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 1e7;
const isText = (v: unknown): v is string => typeof v === 'string' && v.length <= MAX_TEXT;

function parseIds(v: unknown): string[] | null {
  if (!Array.isArray(v) || !v.every(isId)) return null;
  return [...new Set(v)];
}

function parseScore(v: unknown): CampaignScoreState | null {
  if (!isObject(v)) return null;
  const { currentScore, totalEarned, totalLost } = v;
  if (!isPoints(currentScore) || !isPoints(totalEarned) || !isPoints(totalLost)) return null;
  return { currentScore, totalEarned, totalLost };
}

function parseLedger(v: unknown): Record<string, MissionLedgerEntry> | null {
  if (!isObject(v)) return null;
  const out: Record<string, MissionLedgerEntry> = {};
  for (const [id, entry] of Object.entries(v)) {
    if (!isId(id) || !isObject(entry)) return null;
    const { earned, lost, durationSec } = entry;
    if (!isPoints(earned) || !isPoints(lost) || !isSeconds(durationSec)) return null;
    out[id] = { earned, lost, durationSec };
  }
  return out;
}

function parseAttempt(v: unknown): CampaignAttempt | null {
  if (!isObject(v)) return null;
  const { chapterId, characterId, status, currentMissionId, completedMissionIds, score, missionEntryScore, retries, durationSec, ledger, failure } = v;
  if (!isId(chapterId) || !isId(characterId)) return null;
  if (typeof status !== 'string' || !STATUSES.includes(status as AttemptStatus)) return null;
  if (currentMissionId !== null && !isId(currentMissionId)) return null;
  const completed = parseIds(completedMissionIds);
  const parsedScore = parseScore(score);
  const parsedLedger = parseLedger(ledger);
  if (!completed || !parsedScore || !parsedLedger) return null;
  if (!isPoints(missionEntryScore) || !isPoints(retries) || !isSeconds(durationSec)) return null;
  let parsedFailure: CampaignAttempt['failure'] = null;
  if (failure !== null) {
    if (!isObject(failure) || !isId(failure.missionId) || !isText(failure.reason)) return null;
    parsedFailure = { missionId: failure.missionId, reason: failure.reason };
  }
  return {
    chapterId, characterId, status: status as AttemptStatus, currentMissionId, completedMissionIds: completed,
    score: parsedScore, missionEntryScore, retries, durationSec, ledger: parsedLedger, failure: parsedFailure,
  };
}

function parseStage(v: unknown): StageRecord | null {
  if (!isObject(v)) return null;
  const { missionId, status, reason, scoreBefore, scoreAfter, earned, lost, durationSec, stats } = v;
  if (!isId(missionId) || (status !== 'completed' && status !== 'failed')) return null;
  if (reason !== null && !isText(reason)) return null;
  if (!isPoints(scoreBefore) || !isPoints(scoreAfter) || !isPoints(earned) || !isPoints(lost) || !isSeconds(durationSec)) return null;
  if (!Array.isArray(stats) || stats.length > 40) return null;
  const rows: StatRow[] = [];
  for (const row of stats) {
    if (!isObject(row) || !isText(row.label) || !isText(row.value)) return null;
    rows.push({ label: row.label, value: row.value });
  }
  return { missionId, status, reason, scoreBefore, scoreAfter, earned, lost, durationSec, stats: rows };
}

/**
 * Valida una partida guardada. Devuelve `null` si no es una partida válida de esta
 * versión (el llamador decide si empezar de cero).
 */
export function parseCampaignSave(raw: unknown): CampaignSaveData | null {
  if (!isObject(raw) || raw.version !== CAMPAIGN_SAVE_VERSION) return null;
  const { introSeen, selectedCharacterId, unlockedCharacterIds, attempt, lastStage, bestChapterScores } = raw;
  if (typeof introSeen !== 'boolean') return null;
  if (selectedCharacterId !== null && !isId(selectedCharacterId)) return null;
  const unlocked = parseIds(unlockedCharacterIds);
  if (!unlocked) return null;
  const parsedAttempt = attempt === null ? null : parseAttempt(attempt);
  if (attempt !== null && !parsedAttempt) return null;
  const parsedStage = lastStage === null ? null : parseStage(lastStage);
  if (lastStage !== null && !parsedStage) return null;
  if (!isObject(bestChapterScores)) return null;
  const best: Record<string, number> = {};
  for (const [id, score] of Object.entries(bestChapterScores)) {
    if (!isId(id) || !isPoints(score)) return null;
    best[id] = score;
  }
  return {
    version: CAMPAIGN_SAVE_VERSION,
    introSeen,
    selectedCharacterId,
    unlockedCharacterIds: unlocked,
    attempt: parsedAttempt,
    lastStage: parsedStage,
    bestChapterScores: best,
  };
}
