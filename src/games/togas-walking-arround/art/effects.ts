import { circlePath, ellipsePath } from '../../../core/art/paint';

type Ctx = CanvasRenderingContext2D;

/** Texturas de efectos: todas blancas o neutras para poder teñirlas en el juego. */
export const FX_CANVAS = {
  puff: 64,
  ring: 128,
  spark: 16,
  bubble: 16,
  glow: 64,
  shadow: { width: 64, height: 16 },
} as const;

/** Bocanada de gas: círculo difuso con algo de textura. */
export function drawPuff(ctx: Ctx): void {
  const size = FX_CANVAS.puff;
  const c = size / 2;
  for (const [dx, dy, r] of [[0, 0, 26], [-10, -6, 16], [9, -8, 15], [6, 9, 14], [-8, 8, 13]] as const) {
    const g = ctx.createRadialGradient(c + dx, c + dy, 0, c + dx, c + dy, r);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
}

/** Onda expansiva. */
export function drawRing(ctx: Ctx): void {
  const c = FX_CANVAS.ring / 2;
  circlePath(ctx, c, c, c - 6);
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 6;
  ctx.stroke();
  circlePath(ctx, c, c, c - 13);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 3;
  ctx.stroke();
}

/** Estrella pequeña para confeti y destellos. */
export function drawSpark(ctx: Ctx): void {
  const c = FX_CANVAS.spark / 2;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? 7.5 : 3;
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
}

/** Burbuja de efervescencia (antigás). */
export function drawBubble(ctx: Ctx): void {
  const c = FX_CANVAS.bubble / 2;
  circlePath(ctx, c, c, 6);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.8;
  ctx.stroke();
  circlePath(ctx, c - 2, c - 2, 1.5);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
}

/** Halo suave (aviso visual alrededor de los antigases). */
export function drawGlow(ctx: Ctx): void {
  const c = FX_CANVAS.glow / 2;
  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, FX_CANVAS.glow, FX_CANVAS.glow);
}

/** Sombra en el suelo. */
export function drawShadow(ctx: Ctx): void {
  const { width, height } = FX_CANVAS.shadow;
  ellipsePath(ctx, width / 2, height / 2, width / 2 - 1, height / 2 - 1);
  ctx.fillStyle = 'rgba(30,20,50,0.28)';
  ctx.fill();
}
