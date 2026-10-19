import { label } from '../../core/art/paint';
import { getSkin } from '../../core/characters/CharacterRegistry';
import { drawCharacter } from '../../games/togas-walking-arround/art/character';
import { drawCollectible } from '../../games/togas-walking-arround/art/items';
import { SINGLE_POSES, idlePose, runPose } from '../../games/togas-walking-arround/art/poses';

/**
 * Ilustraciones de la campaña, dibujadas con el mismo arte procedural que los juegos
 * (la skin del registro compartido). Se generan una vez y se cachean como data URI.
 */

const cache = new Map<string, string>();

function render(key: string, width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): string {
  const cached = cache.get(key);
  if (cached) return cached;
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.scale(scale, scale);
  draw(ctx);
  const url = canvas.toDataURL('image/png');
  cache.set(key, url);
  return url;
}

/** Retrato de cuerpo entero de una skin (fondo transparente). */
export function portrait(skinId: string, pose: 'idle' | 'collect' | 'strong' = 'idle'): string {
  return render(`portrait:${skinId}:${pose}`, 120, 170, (ctx) => {
    const look = getSkin(skinId).look;
    const p = pose === 'idle' ? idlePose(0) : SINGLE_POSES[pose];
    drawCharacter(ctx, look, p, 60, 164);
  });
}

/**
 * Silueta genérica de un personaje bloqueado. Es la misma figura para todos: no revela
 * aspecto, nombre ni habilidades sin aprobar.
 */
export function silhouette(variant: number): string {
  return render(`silhouette:${variant % 3}`, 120, 170, (ctx) => {
    drawCharacter(ctx, getSkin('pollo').look, variant % 3 === 0 ? idlePose(0) : runPose(variant), 60, 164);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#3b3360';
    ctx.fillRect(0, 0, 120, 170);
    ctx.globalCompositeOperation = 'source-over';
    label(ctx, '?', 62, 78, 34, '#8f87b5');
  });
}

/** Figura rellena de un color plano, en un lienzo aparte (fondo transparente). */
function shadowFigure(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 240;
  canvas.height = 340;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.scale(2, 2);
  drawCharacter(ctx, getSkin('pollo').look, idlePose(0), 60, 164);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = '#4a3f80';
  ctx.fillRect(0, 0, 120, 170);
  return canvas;
}

/** Miniatura del hub: el universo, siete siluetas y Pollo en color. */
export function campaignThumbnail(): string {
  return render('thumbnail', 320, 180, (ctx) => {
    const sky = ctx.createLinearGradient(0, 0, 0, 180);
    sky.addColorStop(0, '#120f2e');
    sky.addColorStop(1, '#3b2a6b');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 320, 180);
    // Estrellas fijas (sin azar: la miniatura es siempre igual).
    for (let i = 0; i < 60; i++) {
      const x = (i * 97) % 320;
      const y = (i * 53) % 120;
      ctx.fillStyle = i % 5 === 0 ? '#ffd23f' : 'rgba(255,255,255,0.75)';
      ctx.fillRect(x, y, i % 7 === 0 ? 2 : 1, i % 7 === 0 ? 2 : 1);
    }
    // Planeta.
    ctx.beginPath();
    ctx.arc(268, 46, 26, 0, Math.PI * 2);
    ctx.fillStyle = '#ff8a3d';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,248,236,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(268, 46, 42, 9, -0.3, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, 150, 320, 30);
    for (let i = 0; i < 8; i++) {
      ctx.save();
      ctx.translate(40 + i * 37, 158);
      ctx.scale(0.42, 0.42);
      if (i === 0) {
        // Halo de "elegido".
        ctx.beginPath();
        ctx.arc(0, -70, 70, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,210,63,0.35)';
        ctx.fill();
        drawCharacter(ctx, getSkin('pollo').look, SINGLE_POSES.strong, 0, 0);
      } else {
        ctx.drawImage(shadowFigure(), -60, -164, 120, 170);
      }
      ctx.restore();
    }
    ctx.save();
    ctx.translate(244, 76);
    ctx.scale(0.7, 0.7);
    drawCollectible(ctx, 'lentils');
    ctx.restore();
    label(ctx, 'CAMPAÑA', 168, 92, 30, '#ffd23f');
    label(ctx, '8 héroes · 24 misiones', 168, 116, 12, '#fff8ec', 700);
  });
}
