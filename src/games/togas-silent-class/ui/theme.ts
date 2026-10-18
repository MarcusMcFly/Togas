export { COLORS, FONT_FAMILY, addText, type TextOptions } from '../../../core/ui/phaser/theme';

/** Profundidades del aula: cada fila de pupitres tapa a la anterior. */
export const DEPTH = {
  background: 0,
  boardText: 1,
  professor: 5,
  /** Fila i de pupitres = deskRow + i·10; sus estudiantes, +1. */
  deskRow: 10,
  player: 42,
  fx: 50,
  bubble: 60,
  text: 70,
  overlay: 80,
} as const;

/** Colores de estado de los niveles (normal y alto contraste). */
export const LEVEL_COLORS = {
  // `ready` es el único verde: solo sale cuando soltar sería silencioso. `settling` = centrado, confirmando.
  normal: { ready: 0x5cc85a, settling: 0x8ecae6, drift: 0xffd23f, warning: 0xff9f1c, critical: 0xff4d6d, liquid: 0xc8f08f, bubble: 0xffffff },
  contrast: { ready: 0x00e5ff, settling: 0x9d8cff, drift: 0xffffff, warning: 0xffea00, critical: 0xff00a8, liquid: 0x111111, bubble: 0xffea00 },
} as const;
