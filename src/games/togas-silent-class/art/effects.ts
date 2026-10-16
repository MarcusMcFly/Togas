import { circlePath } from '../../../core/art/paint';

type Ctx = CanvasRenderingContext2D;

/** Texturas de efectos, blancas para poder teñirlas. */
export const FX_CANVAS = { puff: 64, ring: 128, spark: 16, paper: 14, drop: 12 } as const;

/** Bocanada de gas: círculos difusos superpuestos. */
export function drawPuff(ctx: Ctx): void {
  const size = FX_CANVAS.puff;
  const c = size / 2;
  for (const [dx, dy, r] of [[0, 0, 26], [-10, -6, 16], [9, -8, 15], [6, 9, 14], [-8, 8, 13]] as const) {
    const g = ctx.createRadialGradient(c + dx, c + dy, 0, c + dx, c + dy, r);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
}

export function drawRing(ctx: Ctx): void {
  const c = FX_CANVAS.ring / 2;
  circlePath(ctx, c, c, c - 6);
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 6;
  ctx.stroke();
}

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

/** Hoja de papel que sale volando. */
export function drawPaper(ctx: Ctx): void {
  const s = FX_CANVAS.paper;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#2b2340';
  ctx.lineWidth = 1.2;
  ctx.fillRect(1, 2, s - 2, s - 4);
  ctx.strokeRect(1, 2, s - 2, s - 4);
  ctx.strokeStyle = 'rgba(70,110,200,0.6)';
  ctx.beginPath();
  ctx.moveTo(3, 6);
  ctx.lineTo(s - 3, 6);
  ctx.moveTo(3, 9);
  ctx.lineTo(s - 3, 9);
  ctx.stroke();
}

/** Gota de sudor. */
export function drawDrop(ctx: Ctx): void {
  const s = FX_CANVAS.drop;
  ctx.beginPath();
  ctx.moveTo(s / 2, 0.5);
  ctx.quadraticCurveTo(s - 1, s * 0.65, s / 2, s - 0.5);
  ctx.quadraticCurveTo(1, s * 0.65, s / 2, 0.5);
  ctx.fillStyle = '#8fd3ff';
  ctx.fill();
  ctx.strokeStyle = '#2b2340';
  ctx.lineWidth = 1;
  ctx.stroke();
}
