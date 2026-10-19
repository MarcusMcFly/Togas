import { OUTLINE, circlePath, ellipsePath, fillStroke, limb, roundRectPath, shade } from '../../../core/art/paint';

type Ctx = CanvasRenderingContext2D;

/** Lienzo del profesor. Los pies quedan en (feetX, feetY). Mide unas 165 unidades. */
export const PROFESSOR_CANVAS = { width: 150, height: 200, feetX: 75, feetY: 194 } as const;

export type ProfessorFrame =
  | 'back' | 'backLook' | 'write0' | 'write1' | 'erase0' | 'erase1' | 'bend'
  | 'side' | 'front' | 'talk' | 'reading' | 'watch' | 'angry';

export const PROFESSOR_FRAMES: readonly ProfessorFrame[] = [
  'back', 'backLook', 'write0', 'write1', 'erase0', 'erase1', 'bend', 'side', 'front', 'talk', 'reading', 'watch', 'angry',
];

const LOOK = {
  skin: '#f0c8a0',
  jacket: '#8a6a4a',
  shirt: '#cfe3f5',
  tie: '#c1121f',
  pants: '#5c5f6b',
  shoes: '#2b2340',
  hair: '#e9e4dc',
  glasses: '#2b2340',
} as const;

type View = 'front' | 'back' | 'side';

interface Pose {
  view: View;
  /** Brazo derecho (el de la tiza): ángulo y si sujeta algo. */
  arm: 'down' | 'write0' | 'write1' | 'erase0' | 'erase1' | 'point' | 'paper' | 'crossed';
  bend: number;
  face: 'neutral' | 'talk' | 'reading' | 'suspicious' | 'angry';
  /** Mira por encima del hombro (aviso de que se va a girar). */
  peek: boolean;
}

const POSES: Record<ProfessorFrame, Pose> = {
  back: { view: 'back', arm: 'down', bend: 0, face: 'neutral', peek: false },
  backLook: { view: 'back', arm: 'down', bend: 0, face: 'suspicious', peek: true },
  write0: { view: 'back', arm: 'write0', bend: 0, face: 'neutral', peek: false },
  write1: { view: 'back', arm: 'write1', bend: 0, face: 'neutral', peek: false },
  erase0: { view: 'back', arm: 'erase0', bend: 0, face: 'neutral', peek: false },
  erase1: { view: 'back', arm: 'erase1', bend: 0, face: 'neutral', peek: false },
  bend: { view: 'back', arm: 'down', bend: 1, face: 'neutral', peek: false },
  side: { view: 'side', arm: 'down', bend: 0, face: 'neutral', peek: false },
  front: { view: 'front', arm: 'down', bend: 0, face: 'neutral', peek: false },
  talk: { view: 'front', arm: 'point', bend: 0, face: 'talk', peek: false },
  reading: { view: 'front', arm: 'paper', bend: 0, face: 'reading', peek: false },
  watch: { view: 'front', arm: 'crossed', bend: 0, face: 'suspicious', peek: false },
  angry: { view: 'front', arm: 'point', bend: 0, face: 'angry', peek: false },
};

/**
 * @param aristocrat detalles sutiles de aristócrata disfrazado (campaña): bigote
 *   con las puntas rizadas, clavel en la solapa y cadena de reloj de oro.
 */
export function drawProfessor(ctx: Ctx, frame: ProfessorFrame, aristocrat = false): void {
  const p = POSES[frame];
  const { feetX, feetY } = PROFESSOR_CANVAS;
  ctx.save();
  ctx.translate(feetX, feetY);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Piernas y zapatos.
  const hipY = -70;
  for (const side of [-1, 1]) {
    limb(ctx, [[side * 9, hipY], [side * 10, -8]], 15, p.view === 'side' && side < 0 ? shade(LOOK.pants, -0.2) : LOOK.pants);
    ellipsePath(ctx, side * 10 + (p.view === 'side' ? 6 : 0), -4, 11, 5.5);
    fillStroke(ctx, LOOK.shoes, 2);
  }

  ctx.save();
  ctx.translate(0, hipY);
  // Agacharse a por la tiza: el tronco se pliega hacia delante (hacia la pizarra).
  if (p.bend > 0) {
    ctx.translate(0, 22 * p.bend);
    ctx.scale(1, 1 - 0.35 * p.bend);
  }
  drawUpperBody(ctx, p);
  if (aristocrat) drawAristocratDetails(ctx, p);
  ctx.restore();
  ctx.restore();
}

function drawAristocratDetails(ctx: Ctx, p: Pose): void {
  const top = -78;
  const hy = top - 22;
  if (p.view === 'front') {
    // Cadena de reloj de oro sobre el chaleco.
    ctx.strokeStyle = '#d4a017';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-14, top + 40);
    ctx.quadraticCurveTo(-2, top + 50, 12, top + 40);
    ctx.stroke();
    circlePath(ctx, 12, top + 40, 2.6);
    fillStroke(ctx, '#ffd23f', 1.2);
    // Clavel rojo en la solapa.
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      circlePath(ctx, -17 + Math.cos(a) * 2.6, top + 14 + Math.sin(a) * 2.6, 2.4);
      fillStroke(ctx, '#d62839', 1);
    }
    circlePath(ctx, -17, top + 14, 1.6);
    ctx.fillStyle = '#ff8fa3';
    ctx.fill();
  }
  if (p.view === 'back') return;
  // Puntas del bigote rizadas hacia arriba.
  ctx.strokeStyle = LOOK.hair;
  ctx.lineWidth = 2.4;
  const sides = p.view === 'side' ? [1] : [-1, 1];
  const cx = p.view === 'side' ? 12 : 0;
  for (const side of sides) {
    const x = cx + side * 10;
    ctx.beginPath();
    ctx.moveTo(x - side * 2, hy + 10);
    ctx.quadraticCurveTo(x + side * 5, hy + 10, x + side * 5, hy + 5);
    ctx.quadraticCurveTo(x + side * 5, hy + 2, x + side * 2, hy + 4);
    ctx.stroke();
  }
}

function drawUpperBody(ctx: Ctx, p: Pose): void {
  const top = -78;
  const back = p.view === 'back';

  // Brazo izquierdo (detrás o al lado).
  if (p.arm !== 'crossed') limb(ctx, [[-24, top + 10], [-30, top + 44], [-26, top + 72]], 13, shade(LOOK.jacket, -0.1));

  // Tronco con chaqueta de tweed.
  ctx.beginPath();
  ctx.moveTo(-24, 4);
  ctx.lineTo(-30, top + 12);
  ctx.quadraticCurveTo(-30, top, -18, top);
  ctx.lineTo(18, top);
  ctx.quadraticCurveTo(30, top, 30, top + 12);
  ctx.lineTo(24, 4);
  ctx.closePath();
  fillStroke(ctx, LOOK.jacket);
  // Textura de tweed.
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 1;
  for (let x = -32; x < 32; x += 5) {
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x + 8, 4);
    ctx.stroke();
  }
  ctx.restore();

  if (p.view === 'front') {
    // Camisa, corbata y solapas.
    ctx.beginPath();
    ctx.moveTo(-9, top);
    ctx.lineTo(0, top + 34);
    ctx.lineTo(9, top);
    ctx.closePath();
    fillStroke(ctx, LOOK.shirt, 2);
    ctx.beginPath();
    ctx.moveTo(-3, top + 4);
    ctx.lineTo(3, top + 4);
    ctx.lineTo(4, top + 28);
    ctx.lineTo(0, top + 34);
    ctx.lineTo(-4, top + 28);
    ctx.closePath();
    fillStroke(ctx, LOOK.tie, 1.5);
    ctx.fillStyle = '#f4f1ea';
    ctx.fillRect(12, top + 14, 9, 3); // bolígrafo en el bolsillo
  } else if (back) {
    ctx.strokeStyle = shade(LOOK.jacket, -0.3);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, top + 40);
    ctx.lineTo(0, 4);
    ctx.stroke();
  }

  drawHead(ctx, p, top);
  drawRightArm(ctx, p, top);
}

function drawRightArm(ctx: Ctx, p: Pose, top: number): void {
  const sx = 24;
  const sy = top + 10;
  const jacket = LOOK.jacket;
  const hand = (x: number, y: number) => {
    circlePath(ctx, x, y, 6);
    fillStroke(ctx, LOOK.skin, 2);
  };
  switch (p.arm) {
    case 'down':
      limb(ctx, [[sx, sy], [30, top + 44], [26, top + 72]], 13, jacket);
      hand(26, top + 74);
      break;
    case 'write0':
    case 'write1': {
      const hx = p.arm === 'write0' ? 40 : 52;
      const hy = p.arm === 'write0' ? top - 34 : top - 26;
      limb(ctx, [[sx, sy], [44, top - 4], [hx, hy]], 13, jacket);
      hand(hx, hy);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(hx - 2, hy - 12, 4, 9);
      break;
    }
    case 'erase0':
    case 'erase1': {
      const hx = p.arm === 'erase0' ? 30 : 58;
      const hy = top - 28;
      limb(ctx, [[sx, sy], [44, top - 2], [hx, hy]], 13, jacket);
      roundRectPath(ctx, hx - 13, hy - 9, 26, 12, 3);
      fillStroke(ctx, '#d9b77e', 2);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillRect(hx - 16, hy - 30, 32, 18);
      break;
    }
    case 'point':
      // Señala a la clase (hacia el jugador, abajo).
      limb(ctx, [[sx, sy], [42, top + 30], [34, top + 56]], 13, jacket);
      hand(34, top + 58);
      limb(ctx, [[34, top + 60], [32, top + 70]], 4, LOOK.skin, 1.5);
      break;
    case 'paper':
      limb(ctx, [[sx, sy], [30, top + 40], [12, top + 34]], 13, jacket);
      limb(ctx, [[-24, top + 10], [-28, top + 40], [-12, top + 34]], 13, jacket);
      ctx.save();
      ctx.translate(0, top + 26);
      ctx.rotate(-0.05);
      roundRectPath(ctx, -18, -12, 36, 26, 2);
      fillStroke(ctx, '#ffffff', 2);
      ctx.strokeStyle = 'rgba(40,40,80,0.4)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(-13, -6 + i * 5);
        ctx.lineTo(13, -6 + i * 5);
        ctx.stroke();
      }
      ctx.restore();
      hand(12, top + 34);
      hand(-12, top + 34);
      break;
    case 'crossed':
      limb(ctx, [[-24, top + 10], [-26, top + 34], [18, top + 36]], 13, shade(jacket, -0.1));
      limb(ctx, [[sx, sy], [26, top + 30], [-16, top + 32]], 13, jacket);
      break;
  }
}

function drawHead(ctx: Ctx, p: Pose, top: number): void {
  const hy = top - 22;
  const view = p.view;
  // Cuello.
  roundRectPath(ctx, -7, top - 8, 14, 10, 3);
  fillStroke(ctx, shade(LOOK.skin, -0.1), 2);

  // Orejas.
  if (view !== 'side') {
    for (const side of [-1, 1]) {
      ellipsePath(ctx, side * 17, hy + 2, 4.5, 6.5);
      fillStroke(ctx, LOOK.skin, 2);
    }
  }
  const faceTone = p.face === 'angry' ? '#f29a8a' : LOOK.skin;
  ellipsePath(ctx, 0, hy, 17, 20);
  fillStroke(ctx, faceTone);

  // Calva brillante y pelo blanco a los lados.
  ctx.save();
  ellipsePath(ctx, 0, hy, 17, 20);
  ctx.clip();
  ctx.fillStyle = LOOK.hair;
  if (view === 'back') {
    ctx.beginPath();
    ctx.arc(0, hy + 2, 18, Math.PI * 0.05, Math.PI * 0.95);
    ctx.lineTo(-18, hy - 2);
    ctx.fill();
  } else if (view === 'side') {
    ctx.fillRect(-18, hy - 4, 12, 18);
  } else {
    ctx.fillRect(-18, hy - 6, 6, 16);
    ctx.fillRect(12, hy - 6, 6, 16);
  }
  ctx.restore();
  ellipsePath(ctx, -5, hy - 13, 6, 3, -0.4);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fill();

  if (view === 'back') {
    if (p.peek) {
      // De perfil por encima del hombro: gafas y bigote asomando.
      ellipsePath(ctx, 15, hy + 2, 5, 4);
      fillStroke(ctx, LOOK.skin, 1.8);
      circlePath(ctx, 12, hy - 3, 4);
      ctx.strokeStyle = LOOK.glasses;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = LOOK.hair;
      ellipsePath(ctx, 12, hy + 8, 6, 3);
      ctx.fill();
    }
    return;
  }
  if (view === 'side') {
    ellipsePath(ctx, 18, hy + 2, 5, 5);
    fillStroke(ctx, LOOK.skin, 2);
    circlePath(ctx, 10, hy - 3, 5);
    ctx.strokeStyle = LOOK.glasses;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = LOOK.hair;
    ellipsePath(ctx, 12, hy + 9, 7, 3.5);
    ctx.fill();
    return;
  }
  drawFace(ctx, p.face, hy);
}

function drawFace(ctx: Ctx, face: Pose['face'], hy: number): void {
  // Gafas redondas.
  ctx.strokeStyle = LOOK.glasses;
  ctx.lineWidth = 2;
  for (const side of [-1, 1]) {
    circlePath(ctx, side * 7, hy - 2, 6);
    ctx.fillStyle = 'rgba(220,240,255,0.6)';
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-1, hy - 2);
  ctx.lineTo(1, hy - 2);
  ctx.stroke();

  // Ojos y cejas.
  ctx.fillStyle = OUTLINE;
  for (const side of [-1, 1]) {
    if (face === 'reading') {
      ctx.fillRect(side * 7 - 3, hy + 1, 6, 1.6);
    } else if (face === 'suspicious') {
      ctx.fillRect(side * 7 - 3, hy - 3, 6, 2.2);
    } else {
      circlePath(ctx, side * 7, hy - 2, face === 'angry' ? 1.6 : 2.2);
      ctx.fill();
    }
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = LOOK.hair;
    ctx.beginPath();
    if (face === 'angry' || face === 'suspicious') {
      ctx.moveTo(side * 12, hy - 12);
      ctx.lineTo(side * 3, hy - 9);
    } else {
      ctx.moveTo(side * 12, hy - 11);
      ctx.lineTo(side * 3, hy - 12);
    }
    ctx.stroke();
  }

  // Nariz y bigote.
  ellipsePath(ctx, 0, hy + 5, 4, 3.5);
  fillStroke(ctx, shade(LOOK.skin, -0.05), 1.6);
  ctx.fillStyle = LOOK.hair;
  ellipsePath(ctx, -5, hy + 10, 6, 3, 0.2);
  ctx.fill();
  ellipsePath(ctx, 5, hy + 10, 6, 3, -0.2);
  ctx.fill();

  // Boca.
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.8;
  if (face === 'talk' || face === 'angry') {
    ellipsePath(ctx, 0, hy + 15, face === 'angry' ? 6 : 4, face === 'angry' ? 5 : 3);
    fillStroke(ctx, '#7a1f2b', 1.6);
  } else if (face === 'suspicious') {
    ctx.beginPath();
    ctx.moveTo(-4, hy + 15);
    ctx.lineTo(4, hy + 14);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(-4, hy + 14);
    ctx.quadraticCurveTo(0, hy + 16, 4, hy + 14);
    ctx.stroke();
  }
  if (face === 'angry') {
    // Venita de enfado.
    ctx.strokeStyle = '#c1121f';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(8, hy - 16);
    ctx.lineTo(12, hy - 13);
    ctx.moveTo(12, hy - 17);
    ctx.lineTo(8, hy - 12);
    ctx.stroke();
  }
}
