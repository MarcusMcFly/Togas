/**
 * 1-3 "Vuelta a la base" (spec 8): PROVISIONAL. Queda registrada en el capítulo, pero
 * no se puede jugar hasta que su diseño esté cerrado. No se le añaden mecánicas sin
 * aprobar.
 *
 * Concepto previsto (solo como referencia): la ciudad de 1-1 de noche, recorrida en
 * sentido contrario, con puntos que se pueden ganar y perder y sin fallo por policía.
 * La regla global de "puntuación a cero = intento perdido" seguiría aplicándose.
 */
export const RETURN_TO_BASE_NOTES = {
  environment: 'Ciudad, de noche',
  direction: 'reverse',
  scoring: { allowEarn: true, allowLose: true },
} as const;
