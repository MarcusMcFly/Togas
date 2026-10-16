import { OUTLINE, circlePath, ellipsePath, fillStroke, label, limb, roundRectPath, shade } from '../../../core/art/paint';
import type { CharacterLook } from '../../../core/characters/SkinDefinition';

type Ctx = CanvasRenderingContext2D;

/**
 * El protagonista sentado, visto de espaldas, por piezas: piernas, glúteos y tronco
 * se mueven por separado según las dos burbujas. Todas las piezas comparten el mismo
 * origen: el punto del banco donde se sienta.
 */
export const PART_CANVAS = { width: 180, height: 200, originX: 90, originY: 150 } as const;

export type TorsoPose = 'sit' | 'clench' | 'celebrate' | 'shame' | 'slump' | 'blast';
export const TORSO_POSES: readonly TorsoPose[] = ['sit', 'clench', 'celebrate', 'shame', 'slump', 'blast'];
export type ButtPose = 'relaxed' | 'clench' | 'lift';
export const BUTT_POSES: readonly ButtPose[] = ['relaxed', 'clench', 'lift'];

function origin(ctx: Ctx): void {
  ctx.translate(PART_CANVAS.originX, PART_CANVAS.originY);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

/** Una pierna (lado -1 izquierda, 1 derecha). Pivota en la cadera: (±16, -8). */
export function drawLeg(ctx: Ctx, look: CharacterLook, side: -1 | 1): void {
  ctx.save();
  origin(ctx);
  const hip: [number, number] = [side * 16, -8];
  const knee: [number, number] = [side * 46, 0];
  const foot: [number, number] = [side * 50, 38];
  limb(ctx, [hip, knee], 22, look.pants);
  limb(ctx, [knee, foot], 17, shade(look.pants, -0.12));
  ellipsePath(ctx, foot[0] + side * 4, foot[1] + 4, 13, 7);
  fillStroke(ctx, look.shoes, 2.2);
  ctx.restore();
}

export const LEG_PIVOT = { x: 16, y: -8 } as const;

export function drawButt(ctx: Ctx, look: CharacterLook, pose: ButtPose): void {
  ctx.save();
  origin(ctx);
  const squeeze = pose === 'clench' ? 0.82 : 1;
  for (const side of [-1, 1] as const) {
    const lifted = pose === 'lift' && side > 0;
    const cx = side * 14 * squeeze;
    const cy = -12 - (lifted ? 9 : 0);
    ellipsePath(ctx, cx, cy, 16 * squeeze, 14 * (pose === 'clench' ? 1.08 : 1), lifted ? 0.25 : 0);
    fillStroke(ctx, look.pants, 2.5);
    ellipsePath(ctx, cx + side * 4, cy - 5, 5, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fill();
  }
  if (pose === 'clench') {
    // Líneas de tensión.
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 30, -22);
      ctx.lineTo(side * 38, -26);
      ctx.moveTo(side * 31, -12);
      ctx.lineTo(side * 40, -12);
      ctx.stroke();
    }
  }
  // Cinturón asomando.
  roundRectPath(ctx, -26, -30, 52, 7, 3);
  fillStroke(ctx, shade(look.pants, -0.3), 2);
  ctx.restore();
}

export function drawTorso(ctx: Ctx, look: CharacterLook, pose: TorsoPose): void {
  ctx.save();
  origin(ctx);
  const shrug = pose === 'clench' ? -6 : pose === 'slump' || pose === 'shame' ? 6 : 0;
  const shoulderY = -96 + shrug;
  const waistY = -26;

  const armsBehind = pose === 'sit' || pose === 'slump';
  if (armsBehind) drawArms(ctx, look, pose, shoulderY);

  ctx.beginPath();
  ctx.moveTo(-26, waistY);
  ctx.lineTo(-34, shoulderY + 14);
  ctx.quadraticCurveTo(-34, shoulderY, -20, shoulderY);
  ctx.lineTo(20, shoulderY);
  ctx.quadraticCurveTo(34, shoulderY, 34, shoulderY + 14);
  ctx.lineTo(26, waistY);
  ctx.closePath();
  fillStroke(ctx, look.shirt);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(14, shoulderY + 8, 18, waistY - shoulderY - 10);
  // El símbolo de la skin, en grande en la espalda.
  label(ctx, look.emblem, 0, (shoulderY + waistY) / 2 + 2, 30, 'rgba(255,255,255,0.85)');
  // Omóplatos de tipo fuerte.
  ctx.strokeStyle = shade(look.shirt, -0.28);
  ctx.lineWidth = 1.6;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 6, shoulderY + 14);
    ctx.quadraticCurveTo(side * 20, shoulderY + 22, side * 24, shoulderY + 12);
    ctx.stroke();
  }

  const headDrop = pose === 'slump' ? 16 : pose === 'shame' ? 8 : pose === 'clench' ? 6 : 0;
  roundRectPath(ctx, -9, shoulderY - 10, 18, 14, 4);
  fillStroke(ctx, shade(look.skinTone, -0.1), 2);
  drawHeadBack(ctx, look, 0, shoulderY - 26 + headDrop);

  if (!armsBehind) drawArms(ctx, look, pose, shoulderY);
  ctx.restore();
}

function drawArms(ctx: Ctx, look: CharacterLook, pose: TorsoPose, shoulderY: number): void {
  for (const side of [-1, 1] as const) {
    const s: [number, number] = [side * 30, shoulderY + 10];
    let elbow: [number, number];
    let hand: [number, number];
    switch (pose) {
      case 'clench': // agarrado al banco con todas sus fuerzas
        elbow = [side * 48, shoulderY + 44];
        hand = [side * 36, -6];
        break;
      case 'celebrate':
        elbow = [side * 50, shoulderY - 18];
        hand = [side * 44, shoulderY - 56];
        break;
      case 'shame': // manos a la cabeza
        elbow = [side * 50, shoulderY - 6];
        hand = [side * 14, shoulderY - 36];
        break;
      case 'blast':
        elbow = [side * 56, shoulderY + 6];
        hand = [side * 72, shoulderY - 16];
        break;
      case 'slump':
        elbow = [side * 40, shoulderY + 46];
        hand = [side * 34, shoulderY + 70];
        break;
      default: // codos sobre la mesa
        elbow = [side * 46, shoulderY + 36];
        hand = [side * 28, shoulderY + 6];
    }
    limb(ctx, [s, elbow, hand], 15, look.skinTone);
    limb(ctx, [s, [(s[0] * 1.2 + elbow[0]) / 2.2, (s[1] * 1.2 + elbow[1]) / 2.2]], 20, shade(look.shirt, -0.06));
    circlePath(ctx, hand[0], hand[1], 8);
    fillStroke(ctx, look.skinTone, 2.2);
  }
}

/** Cabeza vista por detrás: la calva de Poio o la coronilla clara de Marcus. */
function drawHeadBack(ctx: Ctx, look: CharacterLook, hx: number, hy: number): void {
  for (const side of [-1, 1]) {
    ellipsePath(ctx, hx + side * 21, hy + 4, 5.5, 8);
    fillStroke(ctx, look.skinTone, 2.2);
  }
  ellipsePath(ctx, hx, hy, 21, 23);
  fillStroke(ctx, look.skinTone);
  ctx.save();
  ellipsePath(ctx, hx, hy, 21, 23);
  ctx.clip();
  if (look.hair === 'thinning') {
    ctx.fillStyle = look.hairColor;
    ctx.beginPath();
    ctx.arc(hx, hy + 6, 22, Math.PI * 0.05, Math.PI * 0.95);
    ctx.lineTo(hx - 22, hy - 2);
    ctx.fill();
    ctx.strokeStyle = look.hairColor;
    ctx.lineWidth = 1.6;
    for (const dx of [-6, 0, 6]) {
      ctx.beginPath();
      ctx.moveTo(hx + dx, hy - 20);
      ctx.quadraticCurveTo(hx + dx + 4, hy - 12, hx + dx, hy - 6);
      ctx.stroke();
    }
  } else if (look.stubble) {
    ctx.fillStyle = 'rgba(70,50,40,0.18)';
    ctx.beginPath();
    ctx.arc(hx, hy + 8, 22, Math.PI * 0.05, Math.PI * 0.95);
    ctx.fill();
  }
  ctx.restore();
  ellipsePath(ctx, hx - 6, hy - 12, 8, 4, -0.4);
  ctx.fillStyle = look.hair === 'bald' ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)';
  ctx.fill();
}

/** Expresiones del retrato del HUD (vista de frente). */
export type Expression = 'calm' | 'strain' | 'sweat' | 'breath' | 'relief' | 'embarrassed' | 'proud' | 'shock';
export const EXPRESSIONS: readonly Expression[] = ['calm', 'strain', 'sweat', 'breath', 'relief', 'embarrassed', 'proud', 'shock'];
export const FACE_SIZE = 72;

export function drawFace(ctx: Ctx, look: CharacterLook, expression: Expression): void {
  const c = FACE_SIZE / 2;
  ctx.save();
  ctx.translate(c, c + 3);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const tone = expression === 'breath' ? '#d9a3c9' : expression === 'strain' ? shade(look.skinTone, -0.06) : look.skinTone;
  for (const side of [-1, 1]) {
    ellipsePath(ctx, side * 25, 2, 5, 7.5);
    fillStroke(ctx, tone, 2);
  }
  ellipsePath(ctx, 0, 0, 25, 27);
  fillStroke(ctx, tone);

  ctx.save();
  ellipsePath(ctx, 0, 0, 25, 27);
  ctx.clip();
  if (look.stubble) {
    ellipsePath(ctx, 0, 20, 22, 12);
    ctx.fillStyle = 'rgba(70,50,40,0.2)';
    ctx.fill();
  }
  if (look.hair === 'thinning') {
    ctx.fillStyle = look.hairColor;
    ctx.fillRect(-26, -12, 7, 16);
    ctx.fillRect(19, -12, 7, 16);
  }
  ctx.restore();
  if (look.hair === 'thinning') {
    ctx.strokeStyle = look.hairColor;
    ctx.lineWidth = 1.6;
    for (const dx of [-4, 1, 6]) {
      ctx.beginPath();
      ctx.moveTo(dx, -26);
      ctx.quadraticCurveTo(dx + 3, -33, dx + 6, -27);
      ctx.stroke();
    }
  } else {
    ellipsePath(ctx, -8, -18, 7, 3.5, -0.4);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fill();
  }

  drawEyes(ctx, look, expression);
  ellipsePath(ctx, 0, 5, 4.5, 4);
  fillStroke(ctx, shade(tone, -0.06), 1.8);
  drawMouth(ctx, expression);

  // Mofletes y extras.
  const blush = expression === 'embarrassed' ? 0.6 : expression === 'strain' || expression === 'breath' ? 0.45 : 0.2;
  for (const side of [-1, 1]) {
    const big = expression === 'breath';
    ellipsePath(ctx, side * 14, 11, big ? 9 : 5.5, big ? 8 : 4);
    ctx.fillStyle = `rgba(255,100,110,${blush})`;
    ctx.fill();
  }
  if (expression === 'sweat' || expression === 'strain') {
    ctx.beginPath();
    ctx.moveTo(22, -16);
    ctx.quadraticCurveTo(28, -6, 22, -3);
    ctx.quadraticCurveTo(16, -6, 22, -16);
    fillStroke(ctx, '#8fd3ff', 1.5);
  }
  ctx.restore();
}

function drawEyes(ctx: Ctx, look: CharacterLook, expression: Expression): void {
  ctx.strokeStyle = OUTLINE;
  ctx.fillStyle = OUTLINE;
  ctx.lineWidth = 2;
  for (const side of [-1, 1]) {
    const ex = side * 9;
    const ey = -5;
    switch (expression) {
      case 'strain':
        ctx.beginPath();
        ctx.moveTo(ex - 4, ey - 2);
        ctx.lineTo(ex + 4 * side, ey);
        ctx.lineTo(ex - 4, ey + 2);
        ctx.stroke();
        break;
      case 'relief':
      case 'proud':
        ctx.beginPath();
        ctx.moveTo(ex - 4, ey + 1);
        ctx.quadraticCurveTo(ex, ey - 4, ex + 4, ey + 1);
        ctx.stroke();
        break;
      case 'breath':
      case 'shock':
      case 'embarrassed':
        ellipsePath(ctx, ex, ey, 4.5, 5.5);
        fillStroke(ctx, '#ffffff', 1.6);
        circlePath(ctx, ex, ey, 1.8);
        ctx.fill();
        break;
      default:
        ellipsePath(ctx, ex, ey, 3.5, 4.2);
        fillStroke(ctx, '#ffffff', 1.5);
        circlePath(ctx, ex + 0.5, ey + 0.5, 1.9);
        ctx.fill();
    }
    // Cejas.
    ctx.strokeStyle = look.hairColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    const worried = expression === 'sweat' || expression === 'embarrassed';
    const angry = expression === 'strain';
    const lift = expression === 'shock' || expression === 'breath' ? -4 : 0;
    ctx.moveTo(ex - 5, ey - 9 + lift + (worried ? 2 * side : angry ? -2 * side : 0));
    ctx.lineTo(ex + 5, ey - 9 + lift + (worried ? -2 * side : angry ? 2 * side : 0));
    ctx.stroke();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
  }
}

function drawMouth(ctx: Ctx, expression: Expression): void {
  const my = 15;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  switch (expression) {
    case 'calm':
      ctx.beginPath();
      ctx.moveTo(-6, my);
      ctx.quadraticCurveTo(0, my + 4, 6, my - 1);
      ctx.stroke();
      break;
    case 'strain':
    case 'embarrassed':
      roundRectPath(ctx, -8, my - 3, 16, 7, 2);
      fillStroke(ctx, '#ffffff', 1.8);
      ctx.lineWidth = 1;
      for (const dx of [-3, 0, 3]) {
        ctx.beginPath();
        ctx.moveTo(dx, my - 3);
        ctx.lineTo(dx, my + 4);
        ctx.stroke();
      }
      break;
    case 'sweat':
      ctx.beginPath();
      ctx.moveTo(-7, my + 1);
      for (let i = 0; i < 4; i++) ctx.quadraticCurveTo(-5 + i * 3.5, my + (i % 2 ? 3 : -2), -3.5 + i * 3.5, my + 1);
      ctx.stroke();
      break;
    case 'breath':
      ctx.beginPath();
      ctx.moveTo(-4, my);
      ctx.lineTo(4, my);
      ctx.stroke();
      break;
    case 'relief':
      ellipsePath(ctx, 0, my, 5, 3);
      fillStroke(ctx, '#7a1f2b', 1.6);
      break;
    case 'proud':
      ctx.beginPath();
      ctx.moveTo(-8, my - 2);
      ctx.quadraticCurveTo(0, my + 9, 8, my - 3);
      ctx.closePath();
      fillStroke(ctx, '#ffffff', 1.8);
      break;
    case 'shock':
      ellipsePath(ctx, 0, my + 1, 5, 7);
      fillStroke(ctx, '#7a1f2b', 1.8);
      break;
  }
}
