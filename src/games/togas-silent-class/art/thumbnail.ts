import { label } from '../../../core/art/paint';
import { SKINS } from '../../../core/characters/CharacterRegistry';
import { STUDENT_SEATS } from '../config/students.config';
import { drawClassroom } from './classroom';
import { drawProfessor } from './professor';
import { drawTorso } from './seatedPlayer';
import { drawStudent } from './student';

let cached: string | null = null;

/** Miniatura del hub, dibujada con el arte del juego. Se genera una vez. */
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

  // El aula completa a un tercio de tamaño.
  ctx.save();
  ctx.scale(1 / 3, 1 / 3);
  drawClassroom(ctx);
  ctx.restore();

  ctx.save();
  ctx.translate(160 - 25, 88 - 66);
  ctx.scale(0.33, 0.33);
  drawProfessor(ctx, 'backLook');
  ctx.restore();

  for (const seat of STUDENT_SEATS.slice(0, 6)) {
    ctx.save();
    ctx.translate(seat.x / 3 - 18, 112 - 46);
    ctx.scale(0.33, 0.33);
    drawStudent(ctx, seat.look, seat.id === 'a3' || seat.id === 'a5' ? 'asleep' : 'awake');
    ctx.restore();
  }

  // Nube verde y protagonista apretando.
  for (const [x, y, r] of [[160, 150, 26], [128, 140, 16], [192, 138, 18], [150, 124, 12]] as const) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(181,227,107,0.7)';
    ctx.fill();
  }
  ctx.save();
  ctx.translate(160 - 50, 180 - 92);
  ctx.scale(0.55, 0.55);
  drawTorso(ctx, SKINS[0].look, 'clench');
  ctx.restore();

  label(ctx, 'Zzz', 230, 60, 16, '#b9a7ff');
  label(ctx, '🤫', 58, 150, 22, '#2b2340');

  cached = canvas.toDataURL('image/png');
  return cached;
}
