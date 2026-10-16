/**
 * Reglas puras de la "Campus Run": cómo se convierte la puntuación de un juego en
 * Créditos de Campus para el siguiente y cuándo una transferencia es válida.
 * Sin estado ni almacenamiento: se prueba con números.
 */

export const CAMPUS_RUN_RULES = {
  /** 1 crédito por cada 250 puntos del juego anterior. */
  pointsPerCredit: 250,
  maxCredits: 12,
  /** La continuación debe lanzarse en menos de 10 minutos. */
  transferTtlMs: 10 * 60 * 1000,
} as const;

/** Registro de una transferencia entre dos juegos. Se puede usar una sola vez. */
export interface CreditTransferRecord {
  sourceGameId: string;
  destinationGameId: string;
  sourceScore: number;
  credits: number;
  skinId: string;
  /** Marca de tiempo (ms) de creación. */
  createdAt: number;
  consumed: boolean;
}

export function campusCredits(score: number, rules = CAMPUS_RUN_RULES): number {
  if (!Number.isFinite(score) || score <= 0) return 0;
  return Math.min(rules.maxCredits, Math.floor(score / rules.pointsPerCredit));
}

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SCORE = 10_000_000;

/**
 * Valida datos leídos del almacenamiento (podrían estar corruptos o editados a mano).
 * Devuelve `null` si algo no cuadra. No es anti-trampas: solo evita que el juego se rompa.
 */
export function parseTransfer(raw: unknown, rules = CAMPUS_RUN_RULES): CreditTransferRecord | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const { sourceGameId, destinationGameId, sourceScore, credits, skinId, createdAt, consumed } = r;
  if (typeof sourceGameId !== 'string' || !ID.test(sourceGameId)) return null;
  if (typeof destinationGameId !== 'string' || !ID.test(destinationGameId)) return null;
  if (typeof skinId !== 'string' || !ID.test(skinId)) return null;
  if (typeof sourceScore !== 'number' || !Number.isInteger(sourceScore) || sourceScore < 0 || sourceScore > MAX_SCORE) return null;
  if (typeof createdAt !== 'number' || !Number.isFinite(createdAt)) return null;
  if (typeof consumed !== 'boolean') return null;
  // Los créditos se recalculan: nunca se confía en el número guardado.
  if (credits !== campusCredits(sourceScore, rules)) return null;
  return { sourceGameId, destinationGameId, sourceScore, credits, skinId, createdAt, consumed };
}

export function isTransferUsable(
  record: CreditTransferRecord,
  destinationGameId: string,
  now: number,
  rules = CAMPUS_RUN_RULES,
): boolean {
  if (record.consumed || record.destinationGameId !== destinationGameId) return false;
  const age = now - record.createdAt;
  return age >= 0 && age <= rules.transferTtlMs;
}
