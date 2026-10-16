export type PressureStateId = 'comfortable' | 'uncomfortable' | 'dangerous' | 'critical';

export interface PressureState {
  id: PressureStateId;
  /** Presión mínima (incluida) del estado. */
  from: number;
  label: string;
  color: string;
}

export const PRESSURE_CONFIG = {
  max: 100,
  /** Valor con el que empieza cada ciclo tras una emisión. */
  startValue: 5,
  /** Unidades por segundo a dificultad 1 (≈ 10,5 s de 5 a 100). */
  baseRatePerSec: 9,
  states: [
    { id: 'comfortable', from: 0, label: 'Cómodo', color: '#8bd450' },
    { id: 'uncomfortable', from: 40, label: 'Incómodo', color: '#ffd23f' },
    { id: 'dangerous', from: 70, label: 'Peligroso', color: '#ff9f1c' },
    { id: 'critical', from: 90, label: '¡CRÍTICO!', color: '#ff4d6d' },
  ] as readonly PressureState[],
  /** A partir de aquí la pizarra muestra la "Pesadilla del ingeniero" (solo visual). */
  nightmareFrom: 85,
} as const;

export function pressureState(pressure: number): PressureState {
  const { states } = PRESSURE_CONFIG;
  for (let i = states.length - 1; i >= 0; i--) if (pressure >= states[i].from) return states[i];
  return states[0];
}
