import type Phaser from 'phaser';

/** Estilo visual común a todos los minijuegos hechos con Phaser. */
export const FONT_FAMILY = "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";

export const COLORS = {
  ink: 0x2b2340,
  inkCss: '#2b2340',
  paper: 0xfff8ec,
  paperCss: '#fff8ec',
  accent: 0xff8a3d,
  yellow: 0xffd23f,
  yellowCss: '#ffd23f',
  gas: 0x8bd450,
  danger: 0xff4d6d,
  muted: '#8f87b5',
} as const;

export interface TextOptions {
  color?: string;
  stroke?: number;
  align?: 'left' | 'center' | 'right';
  weight?: string;
  wrapWidth?: number;
}

/** Texto con contorno grueso, estilo cómic. */
export function addText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size: number,
  options: TextOptions = {},
): Phaser.GameObjects.Text {
  const { color = '#ffffff', stroke = Math.max(3, Math.round(size / 6)), align = 'center', weight = '900', wrapWidth } = options;
  const t = scene.add.text(x, y, text, {
    fontFamily: FONT_FAMILY,
    fontSize: `${size}px`,
    fontStyle: weight,
    color,
    stroke: COLORS.inkCss,
    strokeThickness: stroke,
    align,
    resolution: 2,
    wordWrap: wrapWidth ? { width: wrapWidth } : undefined,
  });
  t.setOrigin(align === 'left' ? 0 : align === 'right' ? 1 : 0.5, 0.5);
  return t;
}
