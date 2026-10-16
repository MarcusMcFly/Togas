/** Estados del profesor (máquina de estados de ProfessorAI). */
export type ProfessorStateId =
  | 'writing'
  | 'reading'
  | 'warning'
  | 'turning'
  | 'explaining'
  | 'watching'
  | 'investigating'
  | 'turningBack'
  | 'chalkDrop'
  | 'erasing';

/** Lo que el jugador necesita saber: ¿adónde mira el profe? */
export type AttentionLevel = 'away' | 'aboutToTurn' | 'turning' | 'facing' | 'watching' | 'investigating';

export const ATTENTION_BY_STATE: Record<ProfessorStateId, AttentionLevel> = {
  writing: 'away',
  reading: 'away',
  chalkDrop: 'away',
  erasing: 'away',
  warning: 'aboutToTurn',
  turning: 'turning',
  turningBack: 'turning',
  explaining: 'facing',
  watching: 'watching',
  investigating: 'investigating',
};

export const PROFESSOR_CONFIG = {
  /** Aviso previo a girarse (s): deja la tiza, se para, pasos. */
  warningSec: 0.9,
  /** Con el perk "Apuntes del profe", el aviso dura esto más. */
  notesPerkExtraSec: 0.7,
  turnSec: 0.45,
  /** Nunca mira a la clase más de esto seguido (siempre hay ventana antes de llegar a 100). */
  maxFacingSec: 3.4,
  /** Ventana tranquila mínima tras una investigación: nada de miradas encadenadas. */
  minSafeAfterInvestigationSec: 3,
  investigateSec: 2.4,
  /** Tras una amonestación seria, durante este tiempo las ventanas tranquilas se acortan. */
  heightenedSec: 15,
  heightenedSafeFactor: 0.65,
  /** Mínimo absoluto de una ventana tranquila (también con atención aumentada). */
  minSafeSec: 2,
  /** Probabilidad de leer apuntes en vez de escribir en una ventana tranquila. */
  readingChance: 0.3,
  /** Probabilidad de que el profe te pille en una liberación silenciosa, según adónde mire. */
  detection: {
    away: 0,
    aboutToTurn: 0,
    /** En pleno giro, el riesgo crece (o decrece) con el ángulo. */
    turning: [0.2, 0.75] as readonly [number, number],
    facing: 0.6,
    watching: 0.9,
    investigating: 1,
  },
  events: {
    chalkDropSec: 2.4,
    erasingSec: 2.6,
    silenceSec: 4,
    /** Pesos relativos de cada evento cuando toca uno. */
    weights: { chalkDrop: 3, erasing: 3, silence: 2, snore: 2 },
  },
} as const;

export type RandomEventKind = keyof typeof PROFESSOR_CONFIG.events.weights;

/** Lo que dice el profe al pillarte. Añadir frases no requiere tocar código. */
export const PROFESSOR_DIALOGUE = {
  caught: [
    '¿¡QUIÉN HA SIDO!?',
    '¡Esto es una universidad, no una banda de música!',
    'Interesante fenómeno acústico…',
    '¿Le apetece salir a explicar esta ecuación?',
    'Eso no ha sido la silla.',
    'Apunten: la presión se libera por el punto más débil.',
  ],
  suspicious: [
    'Hmm… ¿Huele a… ingeniería?',
    'Noto cierta tensión en la última fila…',
    '¿Alguien ha abierto una válvula?',
  ],
  lecture: [
    'Por tanto, P = F / A…',
    '…y la presión no deja de aumentar.',
    'Esto entra en el examen.',
    'Como ven, el sistema es estable… en teoría.',
    'Fíjense en el factor de seguridad.',
    'Bernoulli lo explica todo.',
  ],
  warnings: [
    'Primer aviso.',
    '¡Segundo aviso! Le estoy vigilando.',
    '¡FUERA DE MI CLASE!',
  ],
} as const;

/** Lo que el profe va escribiendo en la pizarra (en bucle). */
export const BOARD_FORMULAS: readonly string[] = [
  'P = F / A',
  'Δp = ρ · g · h',
  'p₁ + ½ρv₁² = p₂ + ½ρv₂²',
  'σ = F / A ≤ σ_adm',
  'PV = nRT',
  'F.S. = σ_rot / σ_trab ≥ 1,5',
  'Q = m · cp · ΔT',
  'ε = ΔL / L₀',
];

/** "La pesadilla del ingeniero": solo aparece con presión muy alta. Puramente visual. */
export const NIGHTMARE_FORMULAS: readonly string[] = [
  'σ_glúteo > σ_rotura\n⇒ ¡¡BOOM!!',
  'lim (t→90 s) p(t) = ∞',
  'F.S. = 0,01\n¡FALLO INMINENTE!',
];
