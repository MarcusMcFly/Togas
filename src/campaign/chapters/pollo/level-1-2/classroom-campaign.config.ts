import type { ClassroomMissionTexts, ClassroomPenalties, ClassroomRules } from '../../../../games/togas-silent-class/mission';

/** Reglamento de "Clase silenciosa" en la campaña (spec 7). Todos los números son ajustables. */
export const SILENT_CLASS_RULES: ClassroomRules = {
  id: 'pollo-1-2',
  // Sin reloj: la clase acaba al derrotar al profe o al fallar. El goteo de puntos premia acabar antes.
  timeLimitSec: null,
  detection: 'instantFail',
  lookingFrom: 0.5,
  chair: { criticalSec: 0.8, maxFalls: 3 },
  objective: 'studentsThenProfessor',
  aristocrat: true,
};

/** En 1-2 no se gana nada: solo se pierde (spec 7.11). */
export const SILENT_CLASS_PENALTIES: ClassroomPenalties = {
  chairFall: 100,
  uncontrolledRelease: 150,
  drainPerSec: 1,
};

export const SILENT_CLASS_TEXTS: ClassroomMissionTexts = {
  intro: '«Solo queda un sitio libre: la última fila.»',
  objective: 'Objetivo: deja K.O. a los 12 compañeros. Después, al profe.',
  professorTarget: '¡TODOS K.O.!\n¡A POR EL ARISTÓCRATA!',
  victory: 'ARISTÓCRATA NEUTRALIZADO.\nMACROECONOMÍA CANCELADA.',
};
