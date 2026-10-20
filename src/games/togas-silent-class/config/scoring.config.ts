/** Puntuación (tabla 12.1 de la spec). */
export const SCORING = {
  studentAsleep: 100,
  quietRelease: 30,
  perfectRelease: 50,
  highPressureRelease: 75,
  highPressureFrom: 80,
  /** Bonus cada vez que la racha llega a un múltiplo de este número. */
  streakBonusEvery: 5,
  streakBonus: 150,
  classroomClear: 500,
  trumpetPenalty: -100,
  detectionPenalty: -150,
} as const;

/** Multiplicador de racha silenciosa: índice = liberaciones seguidas (la última se repite). */
export const COMBO_MULTIPLIERS: readonly number[] = [1, 1, 1.1, 1.2, 1.3, 1.5];

export function comboMultiplier(streak: number): number {
  if (streak <= 0) return 1;
  return COMBO_MULTIPLIERS[Math.min(streak, COMBO_MULTIPLIERS.length - 1)];
}

/**
 * Alcance de la nube según la presión al soltar (tabla 10.2). `reach` en píxeles lógicos.
 * La última fila (esquinas a ~431 px del jugador) se alcanza desde el tier 3 (presión 60):
 * soltar en silencio por encima de 80 es casi imposible con el equilibrio.
 */
export interface EmissionTier {
  tier: number;
  from: number;
  name: string;
  minTargets: number;
  maxTargets: number;
  reach: number;
  color: string;
}

export const EMISSION_TIERS: readonly EmissionTier[] = [
  { tier: 1, from: 0, name: 'Susurro', minTargets: 0, maxTargets: 1, reach: 260, color: '#b5e36b' },
  { tier: 2, from: 40, name: 'Nube sigilosa', minTargets: 1, maxTargets: 2, reach: 290, color: '#8bd450' },
  { tier: 3, from: 60, name: 'Brisa de aula', minTargets: 2, maxTargets: 3, reach: 440, color: '#5ec46a' },
  { tier: 4, from: 80, name: 'Apocalipsis silencioso', minTargets: 3, maxTargets: 5, reach: 520, color: '#3fb7a0' },
  { tier: 5, from: 95, name: 'Sigilo legendario', minTargets: 4, maxTargets: 6, reach: 640, color: '#b06cff' },
];

/** Presión mínima cuya nube llega a esta distancia (null si ninguna llega). */
export function pressureToReach(distance: number): number | null {
  return EMISSION_TIERS.find((t) => t.reach >= distance)?.from ?? null;
}

export function emissionTier(pressure: number): EmissionTier {
  for (let i = EMISSION_TIERS.length - 1; i >= 0; i--) if (pressure >= EMISSION_TIERS[i].from) return EMISSION_TIERS[i];
  return EMISSION_TIERS[0];
}

/** Variantes del pedo-trompeta según la presión acumulada (más presión, más espectáculo). */
export type TrumpetVariant = 'short' | 'trombone' | 'tuba' | 'squeaky' | 'finale';

export const TRUMPET_VARIANTS: ReadonlyArray<{ variant: TrumpetVariant; from: number; label: string; intensity: number }> = [
  { variant: 'short', from: 0, label: 'Trompetilla', intensity: 1 },
  { variant: 'squeaky', from: 40, label: 'Corneta chirriante', intensity: 2 },
  { variant: 'trombone', from: 60, label: 'Trombón roto', intensity: 3 },
  { variant: 'tuba', from: 80, label: 'Tuba profunda', intensity: 4 },
  { variant: 'finale', from: 95, label: 'Gran final orquestal', intensity: 5 },
];

export function trumpetVariant(pressure: number): (typeof TRUMPET_VARIANTS)[number] {
  for (let i = TRUMPET_VARIANTS.length - 1; i >= 0; i--) if (pressure >= TRUMPET_VARIANTS[i].from) return TRUMPET_VARIANTS[i];
  return TRUMPET_VARIANTS[0];
}

export const SUCCESS_LINES: readonly string[] = [
  '¡SILENCIOSO PERO LETAL!',
  '¡MAESTRO DEL SIGILO!',
  '¡MODO FANTASMA!',
  '¡LIBERACIÓN LIMPIA!',
  '¡GENIO QUÍMICO!',
];

/** Estadísticas que deciden el título final. */
export interface TitleInput {
  silentFarts: number;
  trumpetFarts: number;
  detections: number;
  studentsKnockedOut: number;
  totalStudents: number;
  accuracy: number;
}

/**
 * Títulos finales: se evalúan en orden y gana el primero que se cumple.
 * Umbrales transparentes y comprobables, nada de azar.
 */
export const TITLES: ReadonlyArray<{ id: string; name: string; test: (s: TitleInput) => boolean }> = [
  { id: 'doctor', name: 'Doctor en Flatulencia', test: (s) => s.studentsKnockedOut >= s.totalStudents && s.detections === 0 },
  { id: 'brass', name: 'La Banda de Música', test: (s) => s.trumpetFarts >= 3 && s.trumpetFarts > s.silentFarts },
  { id: 'nervous', name: 'El Novato Nervioso', test: (s) => s.accuracy < 0.5 || s.silentFarts === 0 },
  { id: 'legend', name: 'La Leyenda Silenciosa', test: (s) => s.studentsKnockedOut >= 10 && s.detections === 0 && s.accuracy >= 0.75 },
  { id: 'ghost', name: 'El Fantasma del Aula', test: (s) => s.studentsKnockedOut >= 8 && s.detections <= 1 },
  { id: 'engineer', name: 'El Ingeniero Silencioso', test: (s) => s.studentsKnockedOut >= 5 && s.accuracy >= 0.6 },
  { id: 'intern', name: 'El Becario del Sigilo', test: () => true },
];

export function performanceTitle(stats: TitleInput): { id: string; name: string } {
  const title = TITLES.find((t) => t.test(stats)) ?? TITLES[TITLES.length - 1];
  return { id: title.id, name: title.name };
}
