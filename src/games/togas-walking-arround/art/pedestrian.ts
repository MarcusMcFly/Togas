import { OUTLINE, circlePath, ellipsePath, fillStroke, limb, roundRectPath, shade } from './paint';

type Ctx = CanvasRenderingContext2D;

export type HairStyle = 'short' | 'ponytail' | 'bun' | 'cap' | 'curly' | 'grey';
export type Expression = 'neutral' | 'surprised' | 'angry' | 'scared';

/** Aspecto de un viandante. */
export interface PersonLook {
  skinTone: string;
  hair: HairStyle;
  hairColor: string;
  top: string;
  bottom: string;
  skirt: boolean;
  shoes: string;
  glasses: boolean;
}

export interface PersonPose {
  legSwing: number;
  armSwing: number;
  /** 0…1: brazos arriba (sorpresa). */
  armsUp: number;
  /** Puños cerrados delante (cabreo). */
  fists: boolean;
  bob: number;
  lean: number;
  expression: Expression;
  sweat: boolean;
}

const NEUTRAL: PersonPose = {
  legSwing: 0, armSwing: 0, armsUp: 0, fists: false, bob: 0, lean: 0, expression: 'neutral', sweat: false,
};
const personPose = (overrides: Partial<PersonPose>): PersonPose => ({ ...NEUTRAL, ...overrides });

/** Lienzo de cada fotograma (unidades lógicas). Mira a la derecha; en el juego se voltea. */
export const PERSON_CANVAS = { width: 90, height: 150, feetX: 45, feetY: 145 } as const;
/** Lienzo de la cara ampliada (viñeta de cómic). */
export const FACE_CANVAS = 72;

export const WALK_FRAMES = 4;
export const FLEE_FRAMES = 2;

export function walkPose(frame: number): PersonPose {
  const phase = (frame / WALK_FRAMES) * Math.PI * 2;
  return personPose({ legSwing: Math.sin(phase) * 0.7, armSwing: -Math.sin(phase) * 0.6, bob: -Math.abs(Math.cos(phase)) * 1.5 });
}

export function fleePose(frame: number): PersonPose {
  const swing = frame === 0 ? 1 : -1;
  return personPose({ legSwing: swing, armSwing: -swing, lean: 0.3, expression: 'scared', sweat: true, bob: -2 });
}

export const SURPRISED_POSE = personPose({ armsUp: 0.85, lean: -0.15, expression: 'surprised' });
export const ANGRY_POSE = personPose({ fists: true, lean: 0.12, expression: 'angry', legSwing: 0.3 });

/** Viandante de cuerpo entero, con los pies en (feetX, feetY). Mide unas 110 unidades. */
export function drawPerson(ctx: Ctx, look: PersonLook, p: PersonPose): void {
  ctx.save();
  ctx.translate(PERSON_CANVAS.feetX, PERSON_CANVAS.feetY);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const hipY = -46;
  for (const side of [-1, 1] as const) {
    const swing = side > 0 ? p.legSwing : -p.legSwing;
    const footX = side * 3 + swing * 13;
    const lift = swing < 0 ? -swing * 6 : 0;
    const color = side < 0 ? shade(look.bottom, -0.2) : look.bottom;
    limb(ctx, [[side * 3, hipY], [(side * 3 + footX) / 2 + 3, hipY / 2 - lift / 2], [footX, -4 - lift]], 8, look.skirt ? look.skinTone : color, 2.2);
    ellipsePath(ctx, footX + 3, -3 - lift, 7, 4);
    fillStroke(ctx, side < 0 ? shade(look.shoes, -0.2) : look.shoes, 2);
  }

  ctx.save();
  ctx.translate(0, hipY);
  ctx.rotate(p.lean);
  const top = -40 + p.bob;

  drawArm(ctx, look, p, top, -1);
  if (look.skirt) {
    ctx.beginPath();
    ctx.moveTo(-10, -4);
    ctx.lineTo(10, -4);
    ctx.lineTo(15, 18);
    ctx.lineTo(-15, 18);
    ctx.closePath();
    fillStroke(ctx, look.bottom, 2.2);
  } else {
    roundRectPath(ctx, -11, -6, 22, 12, 4);
    fillStroke(ctx, look.bottom, 2.2);
  }
  roundRectPath(ctx, -11, top, 22, -top + 2, 7);
  fillStroke(ctx, look.top, 2.4);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(-9.5, top + 4, 6, -top - 4);

  ctx.save();
  ctx.translate(2, top - 12);
  drawPersonHead(ctx, look, p.expression, p.sweat);
  ctx.restore();

  drawArm(ctx, look, p, top, 1);
  ctx.restore();
  ctx.restore();
}

function drawArm(ctx: Ctx, look: PersonLook, p: PersonPose, top: number, side: -1 | 1): void {
  const back = side < 0;
  const sx = back ? -6 : 7;
  const sy = top + 5;
  const skin = back ? shade(look.skinTone, -0.15) : look.skinTone;
  const sleeve = back ? shade(look.top, -0.18) : look.top;
  let elbow: [number, number];
  let hand: [number, number];
  if (p.fists) {
    // Puños por delante, a la altura del pecho.
    elbow = [sx + 9, sy + 12];
    hand = [sx + 16 + (back ? -3 : 0), sy + 2];
  } else {
    const swing = (back ? -p.armSwing : p.armSwing) * 0.9;
    // Brazos arriba y abiertos hacia los lados, sin tapar la cara.
    const raised = back ? -Math.PI * 0.8 : Math.PI * 0.68;
    const angle = swing + (raised - swing) * p.armsUp;
    elbow = [sx + Math.sin(angle) * 13, sy + Math.cos(angle) * 13];
    const fore = angle + 0.35;
    hand = [elbow[0] + Math.sin(fore) * 12, elbow[1] + Math.cos(fore) * 12];
  }
  limb(ctx, [[sx, sy], elbow, hand], 7, skin, 2.2);
  limb(ctx, [[sx, sy], [(sx + elbow[0]) / 2, (sy + elbow[1]) / 2]], 10, sleeve, 2.2);
  circlePath(ctx, hand[0], hand[1], p.fists ? 5 : 4.2);
  fillStroke(ctx, skin, 2);
}

/** Cabeza centrada en (0, 0), mirando a la derecha. Radio ~13. */
export function drawPersonHead(ctx: Ctx, look: PersonLook, expression: Expression, sweat = false): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Coleta y moño van detrás de la cabeza.
  if (look.hair === 'ponytail') {
    ellipsePath(ctx, -15, 4, 5, 10, 0.3);
    fillStroke(ctx, look.hairColor, 2);
  } else if (look.hair === 'bun') {
    circlePath(ctx, -8, -13, 7);
    fillStroke(ctx, look.hairColor, 2);
  }

  ellipsePath(ctx, -7, 2, 3.5, 4.5);
  fillStroke(ctx, look.skinTone, 2);
  ellipsePath(ctx, 0, 0, 13, 14);
  fillStroke(ctx, look.skinTone, 2.4);

  if (expression === 'angry') {
    ctx.save();
    ellipsePath(ctx, 0, 0, 13, 14);
    ctx.clip();
    ctx.fillStyle = 'rgba(230,40,40,0.38)';
    ctx.fillRect(-14, -15, 28, 30);
    ctx.restore();
  }

  drawHair(ctx, look);

  // Ojos y cejas.
  const ex = 7;
  const ey = -1;
  ctx.strokeStyle = OUTLINE;
  ctx.fillStyle = OUTLINE;
  switch (expression) {
    case 'neutral':
      circlePath(ctx, ex, ey, 1.6);
      ctx.fill();
      brow(ctx, look, ex, ey - 5, 0);
      break;
    case 'surprised':
    case 'scared':
      ellipsePath(ctx, ex, ey, 3.6, 4.6);
      fillStroke(ctx, '#ffffff', 1.5);
      circlePath(ctx, ex + 0.8, ey, 1.2);
      ctx.fillStyle = OUTLINE;
      ctx.fill();
      brow(ctx, look, ex, ey - 8, expression === 'scared' ? 0.35 : -0.15);
      break;
    case 'angry':
      // Ojo entornado, con la ceja en V cayendo encima.
      ellipsePath(ctx, ex, ey + 0.5, 3.4, 2.6);
      fillStroke(ctx, '#ffffff', 1.5);
      circlePath(ctx, ex + 1, ey + 0.8, 1.4);
      ctx.fillStyle = OUTLINE;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(ex - 4.5, ey - 6);
      ctx.lineTo(ex + 4.5, ey - 1.5);
      ctx.lineWidth = 3.4;
      ctx.strokeStyle = look.hair === 'grey' ? '#7d7d7d' : look.hairColor;
      ctx.stroke();
      // Vena de cómic en la frente.
      ctx.strokeStyle = '#d62839';
      ctx.lineWidth = 1.6;
      for (const [x1, y1, x2, y2] of [[-3, -9, -1, -7], [-1, -11, 1, -9], [-5, -7, -3, -5]] as const) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo((x1 + x2) / 2 + 1.5, (y1 + y2) / 2 - 1.5, x2, y2);
        ctx.stroke();
      }
      break;
  }

  if (look.glasses) {
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.5;
    circlePath(ctx, ex, ey, 4.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ex - 4.5, ey);
    ctx.lineTo(-4, ey - 1);
    ctx.stroke();
  }

  // Nariz.
  ellipsePath(ctx, 13, 3, 3, 2.6);
  fillStroke(ctx, shade(look.skinTone, -0.06), 1.8);
  if (look.hair === 'grey') {
    // Bigote de señor mayor.
    ellipsePath(ctx, 10, 6.5, 5, 2);
    fillStroke(ctx, '#d9d9d9', 1.4);
  }

  // Boca.
  const mx = 8;
  const my = 8;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.8;
  switch (expression) {
    case 'neutral':
      ctx.beginPath();
      ctx.moveTo(mx - 3, my);
      ctx.quadraticCurveTo(mx, my + 2, mx + 3, my - 0.5);
      ctx.stroke();
      break;
    case 'surprised':
      ellipsePath(ctx, mx, my + 1, 3, 4);
      fillStroke(ctx, '#7a1f2b', 1.6);
      break;
    case 'scared':
      ellipsePath(ctx, mx, my + 1, 4, 3.4);
      fillStroke(ctx, '#7a1f2b', 1.6);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(mx - 3, my - 1.4, 6, 1.6);
      break;
    case 'angry':
      // Boca torcida hacia abajo enseñando los dientes.
      ctx.beginPath();
      ctx.moveTo(mx - 4.5, my + 3);
      ctx.quadraticCurveTo(mx, my - 2.5, mx + 4.5, my + 3);
      ctx.closePath();
      fillStroke(ctx, '#ffffff', 1.6);
      break;
  }

  if (sweat) {
    ctx.beginPath();
    ctx.moveTo(-10, -12);
    ctx.quadraticCurveTo(-14, -6, -11, -4);
    ctx.quadraticCurveTo(-7, -6, -10, -12);
    fillStroke(ctx, '#9ad7ff', 1.3);
  }
}

function brow(ctx: Ctx, look: PersonLook, x: number, y: number, tilt: number): void {
  ctx.strokeStyle = look.hair === 'grey' ? '#7d7d7d' : look.hairColor;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(x - 3.5, y - tilt * 4);
  ctx.lineTo(x + 3.5, y + tilt * 4);
  ctx.stroke();
}

function drawHair(ctx: Ctx, look: PersonLook): void {
  const hair = look.hairColor;
  switch (look.hair) {
    case 'short':
    case 'ponytail':
    case 'bun':
      ctx.beginPath();
      ctx.ellipse(0, -2, 13.5, 13, 0, Math.PI * 0.95, Math.PI * 2.02);
      ctx.quadraticCurveTo(6, -6, -4, -5);
      ctx.quadraticCurveTo(-9, 2, -13, 3);
      ctx.closePath();
      fillStroke(ctx, hair, 2);
      break;
    case 'curly':
      for (const [x, y, r] of [[-9, -6, 5], [-5, -11, 5.5], [1, -13, 5.5], [7, -11, 5], [-11, 0, 4.5]] as const) {
        circlePath(ctx, x, y, r);
        fillStroke(ctx, hair, 1.8);
      }
      break;
    case 'cap':
      ctx.beginPath();
      ctx.ellipse(0, -4, 13.5, 11, 0, Math.PI, Math.PI * 2);
      ctx.closePath();
      fillStroke(ctx, hair, 2);
      ctx.beginPath();
      ctx.moveTo(8, -5);
      ctx.quadraticCurveTo(20, -6, 22, -2);
      ctx.lineTo(9, -2);
      ctx.closePath();
      fillStroke(ctx, shade(hair, -0.2), 2);
      break;
    case 'grey':
      ellipsePath(ctx, -8, -3, 6, 7);
      ctx.fillStyle = '#d9d9d9';
      ctx.fill();
      ellipsePath(ctx, -3, -11, 5, 2.5, -0.3);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fill();
      break;
  }
}

/** Viñeta de cómic con la cara ampliada (sorpresa o cabreo). */
export function drawFaceBubble(ctx: Ctx, look: PersonLook, expression: 'surprised' | 'angry'): void {
  const c = FACE_CANVAS / 2;
  // Estallido de cómic alrededor de la viñeta.
  ctx.beginPath();
  const spikes = 14;
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? c - 1 : c - 7;
    const a = (i / (spikes * 2)) * Math.PI * 2;
    ctx.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
  }
  ctx.closePath();
  fillStroke(ctx, expression === 'angry' ? '#ff6b6b' : '#ffd23f', 2);
  circlePath(ctx, c, c, c - 10);
  fillStroke(ctx, expression === 'angry' ? '#ffe0e0' : '#fff8ec', 2.4);

  ctx.save();
  circlePath(ctx, c, c, c - 11);
  ctx.clip();
  ctx.translate(c - 5, c + 1);
  ctx.scale(1.45, 1.45);
  drawPersonHead(ctx, look, expression);
  ctx.restore();
}
