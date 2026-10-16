export { COLORS, FONT_FAMILY, addText, type TextOptions } from '../../../core/ui/phaser/theme';

/** Profundidades de dibujo: lo de abajo se pinta primero. */
export const DEPTH = {
  sky: 0,
  clouds: 1,
  skyline: 2,
  buildings: 3,
  street: 4,
  pigeons: 5,
  shadows: 6,
  items: 7,
  player: 10,
  fx: 20,
  text: 30,
  overlay: 40,
} as const;
