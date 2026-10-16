import { OUTLINE, circlePath, ellipsePath, fillStroke, limb, roundRectPath, shade } from '../../../core/art/paint';
import type { StudentLook } from '../config/students.config';

type Ctx = CanvasRenderingContext2D;

/** Lienzo de un estudiante visto de espaldas. El asiento queda en (seatX, seatY). */
export const STUDENT_CANVAS = { width: 110, height: 140, seatX: 55, seatY: 132 } as const;

export type StudentPose = 'awake' | 'write' | 'drowsy' | 'asleep' | 'startled';
export const STUDENT_POSES: readonly StudentPose[] = ['awake', 'write', 'drowsy', 'asleep', 'startled'];

interface Body {
  /** Desplazamiento vertical de todo el cuerpo (negativo = arriba). */
  lift: number;
  /** Hundimiento de hombros. */
  slump: number;
  headX: number;
  headY: number;
  headTilt: number;
  /** La cabeza queda por detrás de los hombros (dormido sobre la mesa). */
  headBehind: boolean;
  arms: 'desk' | 'write' | 'up' | 'wide';
}

function bodyFor(look: StudentLook, pose: StudentPose): Body {
  const base: Body = { lift: 0, slump: 0, headX: 0, headY: 0, headTilt: 0, headBehind: false, arms: 'desk' };
  switch (pose) {
    case 'awake':
      return base;
    case 'write':
      return { ...base, headY: 3, headTilt: 0.08, arms: 'write' };
    case 'drowsy':
      return { ...base, slump: 4, headY: 6, headX: 4, headTilt: 0.28 };
    case 'startled':
      return { ...base, lift: -10, headY: -4, arms: 'up' };
    case 'asleep':
      switch (look.sleep) {
        case 'desk':
          return { ...base, slump: 8, headY: 22, headBehind: true, arms: 'wide' };
        case 'back':
          return { ...base, slump: 3, headY: 8, headTilt: -0.2 };
        case 'side':
          return { ...base, slump: 6, headX: 14, headY: 12, headTilt: 0.75 };
        case 'upright':
          return { ...base, slump: 2, headY: 7, headTilt: 0.12 };
      }
  }
}

export function drawStudent(ctx: Ctx, look: StudentLook, pose: StudentPose): void {
  const { seatX, seatY } = STUDENT_CANVAS;
  const b = bodyFor(look, pose);
  ctx.save();
  ctx.translate(seatX, seatY + b.lift);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const shoulderY = -78 + b.slump;
  const neckTop = shoulderY - 6;
  const headY = neckTop - 16 + b.headY;

  if (b.headBehind) drawHead(ctx, look, b.headX, headY, b.headTilt, pose === 'startled');
  drawArms(ctx, look, b, shoulderY);
  drawTorso(ctx, look, shoulderY);
  if (!b.headBehind) {
    roundRectPath(ctx, -7, neckTop - 2, 14, 12, 4);
    fillStroke(ctx, shade(look.skinTone, -0.1), 2);
    drawHead(ctx, look, b.headX, headY, b.headTilt, pose === 'startled');
  }
  ctx.restore();
}

function drawTorso(ctx: Ctx, look: StudentLook, shoulderY: number): void {
  ctx.beginPath();
  ctx.moveTo(-23, -2);
  ctx.lineTo(-28, shoulderY + 12);
  ctx.quadraticCurveTo(-28, shoulderY, -16, shoulderY);
  ctx.lineTo(16, shoulderY);
  ctx.quadraticCurveTo(28, shoulderY, 28, shoulderY + 12);
  ctx.lineTo(23, -2);
  ctx.closePath();
  fillStroke(ctx, look.shirt);
  // Arrugas de la espalda y sombra lateral.
  ctx.strokeStyle = shade(look.shirt, -0.25);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, shoulderY + 8);
  ctx.lineTo(0, -14);
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(10, shoulderY + 6, 14, -shoulderY - 10);
}

function drawArms(ctx: Ctx, look: StudentLook, b: Body, shoulderY: number): void {
  const skin = look.skinTone;
  const sleeve = shade(look.shirt, -0.08);
  for (const side of [-1, 1] as const) {
    const sx = side * 22;
    const sy = shoulderY + 8;
    let elbow: [number, number];
    let hand: [number, number];
    switch (b.arms) {
      case 'up':
        elbow = [side * 38, sy - 16];
        hand = [side * 34, sy - 40];
        break;
      case 'wide':
        elbow = [side * 40, sy + 14];
        hand = [side * 22, sy - 6];
        break;
      case 'write':
        elbow = side > 0 ? [36, sy + 22] : [-34, sy + 24];
        hand = side > 0 ? [26, sy + 2] : [-24, sy + 6];
        break;
      default:
        elbow = [side * 34, sy + 26];
        hand = [side * 24, sy + 8];
    }
    limb(ctx, [[sx, sy], elbow, hand], 9, skin, 2);
    limb(ctx, [[sx, sy], [(sx + elbow[0]) / 2, (sy + elbow[1]) / 2]], 12, sleeve, 2);
    if (b.arms === 'up') {
      circlePath(ctx, hand[0], hand[1], 5);
      fillStroke(ctx, skin, 2);
    }
  }
}

function drawHead(ctx: Ctx, look: StudentLook, hx: number, hy: number, tilt: number, startled: boolean): void {
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(tilt);

  // Orejas.
  for (const side of [-1, 1]) {
    ellipsePath(ctx, side * 16, 2, 4, 6);
    fillStroke(ctx, look.skinTone, 2);
  }
  if (look.glasses) {
    ctx.strokeStyle = '#2b2340';
    ctx.lineWidth = 2;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 15, -2);
      ctx.lineTo(side * 17, 4);
      ctx.stroke();
    }
  }

  // Cráneo (de espaldas casi todo es pelo).
  ellipsePath(ctx, 0, 0, 16, 18);
  fillStroke(ctx, look.skinTone, 2.5);
  drawHair(ctx, look, startled);

  if (look.headphones) {
    ctx.strokeStyle = '#2b2d42';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 18, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    for (const side of [-1, 1]) {
      ellipsePath(ctx, side * 17, 2, 5, 8);
      fillStroke(ctx, '#e63946', 2);
    }
  }
  ctx.restore();
}

function drawHair(ctx: Ctx, look: StudentLook, startled: boolean): void {
  const c = look.hairColor;
  ctx.save();
  switch (look.hair) {
    case 'short':
    case 'buzz': {
      ellipsePath(ctx, 0, -2, 16, look.hair === 'buzz' ? 15 : 17);
      ctx.fillStyle = look.hair === 'buzz' ? `${c}cc` : c;
      ctx.fill();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      // Nuca.
      ctx.fillStyle = look.skinTone;
      ctx.fillRect(-9, 11, 18, 6);
      break;
    }
    case 'long':
    case 'ponytail':
    case 'bun':
    case 'curly': {
      ctx.beginPath();
      ctx.moveTo(-17, 4);
      ctx.quadraticCurveTo(-19, -20, 0, -19);
      ctx.quadraticCurveTo(19, -20, 17, 4);
      if (look.hair === 'long') {
        ctx.lineTo(18, 26);
        ctx.quadraticCurveTo(0, 32, -18, 26);
      } else {
        ctx.quadraticCurveTo(0, 18, -17, 4);
      }
      ctx.closePath();
      fillStroke(ctx, c, 2.5);
      if (look.hair === 'ponytail') {
        ellipsePath(ctx, 0, 18, 6, 14);
        fillStroke(ctx, c, 2);
        circlePath(ctx, 0, 6, 3.5);
        fillStroke(ctx, '#ff4d6d', 1.5);
      }
      if (look.hair === 'bun') {
        circlePath(ctx, 0, -18, 9);
        fillStroke(ctx, c, 2.5);
      }
      if (look.hair === 'curly') {
        for (const [x, y] of [[-12, -12], [0, -17], [12, -12], [-15, 0], [15, 0], [-8, 8], [8, 8]] as const) {
          circlePath(ctx, x, y, 6.5);
          fillStroke(ctx, c, 1.8);
        }
      }
      break;
    }
    case 'cap': {
      ellipsePath(ctx, 0, -3, 17, 16);
      fillStroke(ctx, c, 2.5);
      // Visera hacia atrás.
      ellipsePath(ctx, 0, 10, 12, 5);
      fillStroke(ctx, shade(c, -0.25), 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-4, 4, 8, 3);
      break;
    }
  }
  if (startled) {
    // Pelos de punta del susto.
    ctx.strokeStyle = c;
    ctx.lineWidth = 2.5;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 5, -16);
      ctx.lineTo(i * 8, -30);
      ctx.stroke();
    }
  }
  ctx.restore();
}
