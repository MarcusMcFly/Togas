/** Utilidades de dibujo sobre Canvas 2D compartidas por todo el arte del juego. */

export const OUTLINE = '#2b2340';

type Ctx = CanvasRenderingContext2D;

/** Aclara (amount > 0) u oscurece (amount < 0) un color `#rrggbb`. */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const target = amount < 0 ? 0 : 255;
  const t = Math.abs(amount);
  const mix = (c: number) => Math.round(c + (target - c) * t);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function ellipsePath(ctx: Ctx, x: number, y: number, rx: number, ry: number, rotation = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2);
}

export function circlePath(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

/** Rellena el trazado actual y, si `lineWidth > 0`, lo perfila (estilo cartoon). */
export function fillStroke(
  ctx: Ctx,
  fill: string | CanvasGradient,
  lineWidth = 2.5,
  stroke: string = OUTLINE,
): void {
  ctx.fillStyle = fill;
  ctx.fill();
  if (lineWidth > 0) {
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

/** Extremidad gruesa con contorno: una polilínea dibujada dos veces (contorno y color). */
export function limb(ctx: Ctx, points: ReadonlyArray<readonly [number, number]>, width: number, color: string, outline = 2.5): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  if (outline > 0) {
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = width + outline * 2;
    ctx.stroke();
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.restore();
}

/** Texto centrado con fuente del sistema. */
export function label(ctx: Ctx, text: string, x: number, y: number, size: number, color: string, weight = 900): void {
  ctx.save();
  ctx.font = `${weight} ${size}px system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}
