import { SKINS } from '../../../core/characters/CharacterRegistry';
import { drawCharacter } from './character';
import { drawCollectible } from './items';
import { label } from '../../../core/art/paint';
import { runPose } from './poses';

let cached: string | null = null;

/** Miniatura del hub, dibujada con el mismo arte del juego. Se genera una vez y se cachea. */
export function getThumbnail(): string {
  if (cached) return cached;
  const scale = 2;
  const width = 320;
  const height = 180;
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.scale(scale, scale);

  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#5fb8f5');
  sky.addColorStop(0.7, '#ffe9c4');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#9fb6d6';
  const blocks: ReadonlyArray<readonly [number, number, number]> = [
    [0, 60, 50], [50, 40, 80], [90, 70, 40], [160, 50, 70], [210, 30, 90], [250, 70, 55], [290, 30, 65],
  ];
  for (const [x, w, h] of blocks) ctx.fillRect(x, 140 - h, w, h);
  ctx.fillStyle = '#d6cfc2';
  ctx.fillRect(0, 140, width, 22);
  ctx.fillStyle = '#4a4a58';
  ctx.fillRect(0, 162, width, 18);

  // Nube de gas detrás de Poio.
  for (const [x, y, r] of [[58, 112, 16], [44, 100, 12], [70, 98, 10]] as const) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(181,227,107,0.85)';
    ctx.fill();
  }

  SKINS.forEach((skin, i) => {
    ctx.save();
    ctx.translate(95 + i * 55, 142);
    ctx.scale(0.85, 0.85);
    drawCharacter(ctx, skin.look, runPose(i * 2 + 1), 0, 0);
    ctx.restore();
  });

  for (const [id, x, y] of [['fabes', 250, 70], ['beer_can', 282, 104], ['chickpeas', 232, 112]] as const) {
    ctx.save();
    ctx.translate(x - 20, y - 20);
    ctx.scale(0.8, 0.8);
    drawCollectible(ctx, id);
    ctx.restore();
  }

  label(ctx, '¡PRRRT!', 52, 72, 18, '#2b2340');

  cached = canvas.toDataURL('image/png');
  return cached;
}
