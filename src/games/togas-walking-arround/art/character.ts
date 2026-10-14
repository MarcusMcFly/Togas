import { OUTLINE, circlePath, ellipsePath, fillStroke, label, limb, roundRectPath, shade } from './paint';

/** Aspecto de una skin. Todo lo que el dibujo necesita saber de ella. */
export interface CharacterLook {
  skinTone: string;
  shirt: string;
  pants: string;
  shoes: string;
  backpack: string;
  hair: 'bald' | 'thinning';
  hairColor: string;
  stubble: boolean;
  /** Símbolo de la camiseta. */
  emblem: string;
}

export type Mouth = 'smile' | 'grin' | 'open' | 'o' | 'grimace';
export type Eyes = 'open' | 'happy' | 'closed' | 'wide';

/** Postura del personaje. Todas las animaciones son combinaciones de estos valores. */
export interface Pose {
  /** -1…1: adelanta una pierna y atrasa la otra. */
  legSwing: number;
  /** 0…1: cuánto se levanta el pie que va hacia atrás. */
  legLift: number;
  /** -1…1: balanceo de brazos. */
  armSwing: number;
  /** 0…1: brazos arriba. */
  armsUp: number;
  /** 0…1: rodillas recogidas (salto). */
  tuck: number;
  /** Desplazamiento vertical del tronco (negativo = arriba). */
  bob: number;
  /** Inclinación del tronco en radianes (positivo = hacia delante). */
  lean: number;
  /** Agacharse, en píxeles. */
  crouch: number;
  mouth: Mouth;
  eyes: Eyes;
  /** Mofletes hinchados. */
  cheeks: boolean;
}

export const NEUTRAL_POSE: Pose = {
  legSwing: 0, legLift: 0, armSwing: 0, armsUp: 0, tuck: 0, bob: 0, lean: 0, crouch: 0,
  mouth: 'smile', eyes: 'open', cheeks: false,
};

export const pose = (overrides: Partial<Pose>): Pose => ({ ...NEUTRAL_POSE, ...overrides });

/** Lienzo de cada fotograma (unidades lógicas). Los pies quedan en (feetX, feetY). */
export const CHARACTER_CANVAS = { width: 110, height: 160, feetX: 55, feetY: 154 } as const;

type Ctx = CanvasRenderingContext2D;

/**
 * Dibuja al estudiante mirando a la derecha con los pies en (x, y).
 * El personaje mide unas 120 unidades a escala 1 (1,80 m).
 */
export function drawCharacter(ctx: Ctx, look: CharacterLook, p: Pose, x: number = CHARACTER_CANVAS.feetX, y: number = CHARACTER_CANVAS.feetY): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const hipY = -50 + p.crouch;
  drawLeg(ctx, look, p, hipY, -1);
  drawLeg(ctx, look, p, hipY, 1);

  ctx.save();
  ctx.translate(0, hipY);
  ctx.rotate(p.lean);
  const torsoTop = -38 + p.bob;
  drawBackpack(ctx, look, torsoTop);
  drawArm(ctx, look, p, torsoTop, -1);
  drawHips(ctx, look);
  drawTorso(ctx, look, torsoTop);
  drawHead(ctx, look, p, 5, torsoTop - 16);
  drawArm(ctx, look, p, torsoTop, 1);
  ctx.restore();

  ctx.restore();
}

/** Solo la cabeza (para el avatar del HUD y la selección de personaje). */
export function drawCharacterHead(ctx: Ctx, look: CharacterLook, cx: number, cy: number, scale = 1): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  drawHead(ctx, look, NEUTRAL_POSE, -4, 0, false);
  ctx.restore();
}

function drawLeg(ctx: Ctx, look: CharacterLook, p: Pose, hipY: number, side: -1 | 1): void {
  const swing = side > 0 ? p.legSwing : -p.legSwing;
  const hipX = side * 5;
  const footX = hipX + swing * 15 - p.tuck * 4;
  const lift = swing < 0 ? -swing * p.legLift * 9 : 0;
  const footY = -lift - p.tuck * 22;
  const kneeX = (hipX + footX) / 2 + 5 + p.tuck * 14;
  const kneeY = (hipY + footY) / 2 - p.tuck * 4;
  const back = side < 0;

  limb(ctx, [[hipX, hipY], [kneeX, kneeY], [footX, footY - 5]], 12, back ? shade(look.pants, -0.2) : look.pants);
  // Zapatilla con suela.
  ellipsePath(ctx, footX + 4, footY - 4, 9.5, 5);
  fillStroke(ctx, back ? shade(look.shoes, -0.2) : look.shoes, 2.2);
  ctx.strokeStyle = shade(look.shoes, -0.35);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(footX - 4, footY - 1.5);
  ctx.lineTo(footX + 12, footY - 1.5);
  ctx.stroke();
}

function drawHips(ctx: Ctx, look: CharacterLook): void {
  roundRectPath(ctx, -17, -6, 34, 14, 5);
  fillStroke(ctx, look.pants);
}

function torsoPath(ctx: Ctx, top: number): void {
  ctx.beginPath();
  ctx.moveTo(-16, 3);
  ctx.lineTo(-23, top + 10);
  ctx.quadraticCurveTo(-23, top, -13, top);
  ctx.lineTo(16, top);
  ctx.quadraticCurveTo(26, top, 25, top + 10);
  ctx.lineTo(17, 3);
  ctx.closePath();
}

function drawTorso(ctx: Ctx, look: CharacterLook, top: number): void {
  torsoPath(ctx, top);
  fillStroke(ctx, look.shirt);

  // Sombra lateral y pectoral: el volumen de un tipo fuerte.
  ctx.save();
  torsoPath(ctx, top);
  ctx.clip();
  ctx.fillStyle = 'rgba(0,0,0,0.13)';
  ctx.fillRect(-26, top, 13, 50);
  ctx.restore();
  ctx.strokeStyle = shade(look.shirt, -0.3);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(1, top + 15);
  ctx.quadraticCurveTo(12, top + 20, 21, top + 12);
  ctx.stroke();

  label(ctx, look.emblem, 6, top + 26, 13, 'rgba(255,255,255,0.88)');

  // Asa de la mochila cruzando el pecho.
  limb(ctx, [[-12, top + 2], [-8, top + 18], [-5, -3]], 4, shade(look.backpack, -0.25), 1);
}

function drawBackpack(ctx: Ctx, look: CharacterLook, top: number): void {
  roundRectPath(ctx, -36, top + 4, 19, 35, 6);
  fillStroke(ctx, look.backpack);
  roundRectPath(ctx, -35, top + 21, 12, 14, 3);
  fillStroke(ctx, shade(look.backpack, -0.15), 1.6);
}

function drawArm(ctx: Ctx, look: CharacterLook, p: Pose, top: number, side: -1 | 1): void {
  const back = side < 0;
  const sx = back ? -10 : 12;
  const sy = top + 7;
  const swing = (back ? -p.armSwing : p.armSwing) * 0.9;
  const angle = swing + (Math.PI * 0.85 - swing) * p.armsUp;
  const elbowX = sx + Math.sin(angle) * 16;
  const elbowY = sy + Math.cos(angle) * 16;
  const foreAngle = angle + 0.5;
  const handX = elbowX + Math.sin(foreAngle) * 15;
  const handY = elbowY + Math.cos(foreAngle) * 15;
  const skin = back ? shade(look.skinTone, -0.15) : look.skinTone;
  const shirt = back ? shade(look.shirt, -0.18) : look.shirt;

  limb(ctx, [[sx, sy], [elbowX, elbowY], [handX, handY]], 11, skin);
  // Manga corta sobre un bíceps generoso.
  limb(ctx, [[sx, sy], [(sx + elbowX * 1.2) / 2.2, (sy + elbowY * 1.2) / 2.2]], 15, shirt);
  circlePath(ctx, handX, handY, 6.5);
  fillStroke(ctx, skin, 2.2);
}

function drawHead(ctx: Ctx, look: CharacterLook, p: Pose, hx: number, hy: number, withNeck = true): void {
  if (withNeck) {
    roundRectPath(ctx, hx - 6, hy + 8, 12, 12, 3);
    fillStroke(ctx, shade(look.skinTone, -0.12), 2);
  }

  // Oreja.
  ellipsePath(ctx, hx - 9, hy + 2, 4.5, 6);
  fillStroke(ctx, look.skinTone, 2.2);

  // Cráneo.
  ellipsePath(ctx, hx, hy, 16.5, 17.5);
  fillStroke(ctx, look.skinTone);

  ctx.save();
  ellipsePath(ctx, hx, hy, 16.5, 17.5);
  ctx.clip();
  if (look.stubble) {
    ellipsePath(ctx, hx + 5, hy + 13, 15, 9);
    ctx.fillStyle = 'rgba(70,50,40,0.22)';
    ctx.fill();
  }
  if (look.hair === 'thinning') {
    // Pelo solo en los lados y la nuca.
    ctx.beginPath();
    ctx.arc(hx, hy, 16, Math.PI * 0.55, Math.PI * 1.15);
    ctx.lineWidth = 8;
    ctx.strokeStyle = look.hairColor;
    ctx.stroke();
    ellipsePath(ctx, hx - 7, hy - 6, 7, 6);
    ctx.fillStyle = look.hairColor;
    ctx.fill();
  }
  ctx.restore();

  if (look.hair === 'bald') {
    ellipsePath(ctx, hx - 4, hy - 11, 6, 3, -0.4);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fill();
  } else {
    // Cuatro pelos valientes en la coronilla.
    ctx.strokeStyle = look.hairColor;
    ctx.lineWidth = 1.6;
    const strands: ReadonlyArray<readonly [number, number, number, number, number, number]> = [
      [-8, -14, -4, -21, 2, -17],
      [-4, -16, 1, -23, 6, -18],
      [0, -17, 6, -22, 10, -16],
    ];
    for (const [x1, y1, cx, cy, x2, y2] of strands) {
      ctx.beginPath();
      ctx.moveTo(hx + x1, hy + y1);
      ctx.quadraticCurveTo(hx + cx, hy + cy, hx + x2, hy + y2);
      ctx.stroke();
    }
    ellipsePath(ctx, hx - 1, hy - 12, 5, 2.5, -0.3);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fill();
  }

  // Ceja.
  const browLift = p.eyes === 'wide' ? -3 : p.eyes === 'closed' ? 1 : 0;
  ctx.strokeStyle = look.hairColor;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(hx + 6, hy - 7 + browLift);
  ctx.lineTo(hx + 14, hy - 8 + browLift);
  ctx.stroke();

  drawEye(ctx, p.eyes, hx + 10, hy - 1);

  // Nariz.
  ellipsePath(ctx, hx + 17, hy + 3, 4.5, 4);
  fillStroke(ctx, shade(look.skinTone, -0.05), 2);

  // Mofletes.
  circlePath(ctx, hx + 9, hy + 8, p.cheeks ? 6 : 3.5);
  ctx.fillStyle = p.cheeks ? 'rgba(255,110,110,0.5)' : 'rgba(255,120,120,0.25)';
  ctx.fill();

  drawMouth(ctx, p.mouth, hx + 11, hy + 10);
}

function drawEye(ctx: Ctx, eyes: Eyes, ex: number, ey: number): void {
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = OUTLINE;
  switch (eyes) {
    case 'open':
    case 'wide': {
      const big = eyes === 'wide';
      ellipsePath(ctx, ex, ey, big ? 4.6 : 3.6, big ? 5.4 : 4.3);
      fillStroke(ctx, '#ffffff', 1.5);
      circlePath(ctx, ex + 1.3, ey + 0.5, big ? 1.7 : 2);
      ctx.fillStyle = OUTLINE;
      ctx.fill();
      break;
    }
    case 'closed':
      ctx.beginPath();
      ctx.moveTo(ex - 3.5, ey);
      ctx.quadraticCurveTo(ex, ey + 3, ex + 3.5, ey);
      ctx.stroke();
      break;
    case 'happy':
      ctx.beginPath();
      ctx.moveTo(ex - 3.5, ey + 1);
      ctx.quadraticCurveTo(ex, ey - 3.5, ex + 3.5, ey + 1);
      ctx.stroke();
      break;
  }
}

function drawMouth(ctx: Ctx, mouth: Mouth, mx: number, my: number): void {
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  switch (mouth) {
    case 'smile':
      ctx.beginPath();
      ctx.moveTo(mx - 5, my - 1);
      ctx.quadraticCurveTo(mx, my + 4, mx + 5, my - 2);
      ctx.stroke();
      break;
    case 'grin':
      ctx.beginPath();
      ctx.moveTo(mx - 6, my - 2);
      ctx.quadraticCurveTo(mx, my + 8, mx + 6, my - 3);
      ctx.closePath();
      fillStroke(ctx, '#ffffff', 1.8);
      break;
    case 'open':
      ellipsePath(ctx, mx, my + 1, 5, 6.5);
      fillStroke(ctx, '#7a1f2b', 2);
      ellipsePath(ctx, mx, my + 4.5, 3.5, 2);
      ctx.fillStyle = '#e5677a';
      ctx.fill();
      break;
    case 'o':
      ellipsePath(ctx, mx, my + 1, 3, 3.6);
      fillStroke(ctx, '#7a1f2b', 1.8);
      break;
    case 'grimace':
      roundRectPath(ctx, mx - 6, my - 2, 12, 6, 2);
      fillStroke(ctx, '#ffffff', 1.8);
      ctx.lineWidth = 1;
      for (const dx of [-2, 2]) {
        ctx.beginPath();
        ctx.moveTo(mx + dx, my - 2);
        ctx.lineTo(mx + dx, my + 4);
        ctx.stroke();
      }
      break;
  }
}
