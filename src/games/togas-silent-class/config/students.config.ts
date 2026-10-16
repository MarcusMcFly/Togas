/** Aspecto de un compañero de clase (visto de espaldas). */
export interface StudentLook {
  hair: 'short' | 'long' | 'bun' | 'curly' | 'cap' | 'buzz' | 'ponytail';
  hairColor: string;
  skinTone: string;
  shirt: string;
  /** Lo que tiene sobre la mesa. */
  desk: 'laptop' | 'notebook' | 'tablet';
  glasses: boolean;
  headphones: boolean;
  /** Cómo se queda dormido. */
  sleep: 'desk' | 'back' | 'side' | 'upright';
}

export interface StudentSeat {
  id: string;
  name: string;
  /** Posición del asiento (base del cuerpo) en el mundo lógico. */
  x: number;
  y: number;
  /** Escala por profundidad: las filas del fondo se ven más pequeñas. */
  scale: number;
  look: StudentLook;
}

const ROW_A = { y: 296, scale: 0.72 };
const ROW_B = { y: 386, scale: 0.86 };
const ROW_C = { y: 476, scale: 1 };

/**
 * 12 compañeros: fila del fondo (6), fila del medio (4, con hueco para ver al profe)
 * y los dos vecinos de pupitre del protagonista. La distancia al asiento del jugador
 * decide a quién alcanza la nube.
 */
export const STUDENT_SEATS: readonly StudentSeat[] = [
  { id: 'a1', name: 'Lucía', x: 130, ...ROW_A, look: { hair: 'long', hairColor: '#4a2c1d', skinTone: '#f0c9a0', shirt: '#9b5de5', desk: 'laptop', glasses: false, headphones: false, sleep: 'desk' } },
  { id: 'a2', name: 'Dani', x: 270, ...ROW_A, look: { hair: 'cap', hairColor: '#e63946', skinTone: '#c68b59', shirt: '#2a9d8f', desk: 'notebook', glasses: false, headphones: true, sleep: 'back' } },
  { id: 'a3', name: 'Irene', x: 410, ...ROW_A, look: { hair: 'bun', hairColor: '#d4a373', skinTone: '#f6d5b5', shirt: '#f4a261', desk: 'tablet', glasses: true, headphones: false, sleep: 'upright' } },
  { id: 'a4', name: 'Óscar', x: 550, ...ROW_A, look: { hair: 'curly', hairColor: '#1d1d1d', skinTone: '#8d5a3b', shirt: '#e9c46a', desk: 'laptop', glasses: false, headphones: false, sleep: 'side' } },
  { id: 'a5', name: 'Marta', x: 690, ...ROW_A, look: { hair: 'ponytail', hairColor: '#b5651d', skinTone: '#f1c08e', shirt: '#457b9d', desk: 'notebook', glasses: true, headphones: false, sleep: 'desk' } },
  { id: 'a6', name: 'Javi', x: 830, ...ROW_A, look: { hair: 'buzz', hairColor: '#3b2a20', skinTone: '#e2a66f', shirt: '#6a994e', desk: 'laptop', glasses: false, headphones: true, sleep: 'back' } },
  { id: 'b1', name: 'Sara', x: 110, ...ROW_B, look: { hair: 'ponytail', hairColor: '#1d1d1d', skinTone: '#d8a47f', shirt: '#ef476f', desk: 'laptop', glasses: false, headphones: false, sleep: 'side' } },
  { id: 'b2', name: 'Pablo', x: 265, ...ROW_B, look: { hair: 'short', hairColor: '#6b4226', skinTone: '#f6d5b5', shirt: '#118ab2', desk: 'notebook', glasses: true, headphones: false, sleep: 'desk' } },
  { id: 'b3', name: 'Nerea', x: 695, ...ROW_B, look: { hair: 'curly', hairColor: '#a0522d', skinTone: '#f0c9a0', shirt: '#06d6a0', desk: 'tablet', glasses: false, headphones: false, sleep: 'upright' } },
  { id: 'b4', name: 'Álex', x: 850, ...ROW_B, look: { hair: 'short', hairColor: '#e9c46a', skinTone: '#f1c08e', shirt: '#073b4c', desk: 'laptop', glasses: false, headphones: true, sleep: 'back' } },
  { id: 'c1', name: 'Rubén', x: 175, ...ROW_C, look: { hair: 'buzz', hairColor: '#2b2340', skinTone: '#a86f4c', shirt: '#ff8a3d', desk: 'laptop', glasses: false, headphones: false, sleep: 'desk' } },
  { id: 'c2', name: 'Elena', x: 785, ...ROW_C, look: { hair: 'bun', hairColor: '#3b2a20', skinTone: '#f6d5b5', shirt: '#c77dff', desk: 'notebook', glasses: true, headphones: false, sleep: 'side' } },
];

export const STUDENT_TIMINGS = {
  /** La profundidad (filas) pesa más que la distancia lateral: primero caen los vecinos. */
  depthWeight: 1.4,
  /** Un estudiante "adormilado" vuelve a estar despierto tras este tiempo. */
  drowsySec: 4,
  /** Un susto dura esto; luego vuelve a su estado (los dormidos se vuelven a dormir). */
  startledSec: 1.3,
  /** Margen extra de alcance en el que la nube adormila sin dormir del todo. */
  drowsyReachFactor: 1.25,
  /** Radio del susto de un pedo-trompeta según su intensidad (1–5). */
  startleReachPerIntensity: 140,
} as const;
