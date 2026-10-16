import { OUTLINE, circlePath, ellipsePath, fillStroke, label, roundRectPath } from '../../../core/art/paint';
import type { StudentLook, StudentSeat } from '../config/students.config';

type Ctx = CanvasRenderingContext2D;

/** Geometría del aula (mundo lógico 960 × 540). */
export const CLASSROOM = {
  width: 960,
  height: 540,
  board: { x: 230, y: 44, w: 500, h: 150 },
  /** Zona de la pizarra donde el profe "escribe" líneas nuevas. */
  boardText: { x: 250, y: 64, lineHeight: 26, lines: 5 },
  clock: { x: 800, y: 68, r: 24 },
  professorDesk: { x: 610, y: 206, w: 140, h: 52 },
  floorY: 236,
} as const;

/** Medidas de una fila de pupitres, relativas al asiento y escaladas por profundidad. */
export const DESK = { topFar: 64, topNear: 47, benchTop: 3, benchBottom: 13 } as const;

const CHALK = 'rgba(250,250,240,0.88)';

export function drawClassroom(ctx: Ctx): void {
  const { width, height, floorY } = CLASSROOM;

  // Pared.
  const wall = ctx.createLinearGradient(0, 0, 0, floorY);
  wall.addColorStop(0, '#f3e6c8');
  wall.addColorStop(1, '#e2cfa6');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, width, floorY);
  // Zócalo.
  ctx.fillStyle = '#b8a07a';
  ctx.fillRect(0, floorY - 22, width, 22);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(0, floorY - 22, width, 3);

  // Suelo de linóleo con perspectiva.
  const floor = ctx.createLinearGradient(0, floorY, 0, height);
  floor.addColorStop(0, '#a77d55');
  floor.addColorStop(1, '#7c5a3b');
  ctx.fillStyle = floor;
  ctx.fillRect(0, floorY, width, height - floorY);
  ctx.strokeStyle = 'rgba(0,0,0,0.1)';
  ctx.lineWidth = 1.5;
  for (let i = -10; i <= 10; i++) {
    ctx.beginPath();
    ctx.moveTo(width / 2 + i * 40, floorY);
    ctx.lineTo(width / 2 + i * 150, height);
    ctx.stroke();
  }

  // Fluorescentes.
  ctx.fillStyle = '#d9cba9';
  ctx.fillRect(0, 0, width, 10);
  for (const x of [120, 400, 680]) {
    roundRectPath(ctx, x, 4, 160, 10, 4);
    fillStroke(ctx, '#fffdf0', 2);
    const glow = ctx.createLinearGradient(0, 14, 0, 60);
    glow.addColorStop(0, 'rgba(255,255,230,0.35)');
    glow.addColorStop(1, 'rgba(255,255,230,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 20, 14, 200, 46);
  }

  drawWindows(ctx);
  drawBoard(ctx);
  drawClockFace(ctx);
  drawPosters(ctx);
  drawProfessorDesk(ctx);
}

function drawWindows(ctx: Ctx): void {
  for (const [x, w] of [[18, 86], [114, 86]] as const) {
    roundRectPath(ctx, x, 36, w, 150, 4);
    fillStroke(ctx, '#8b6a45', 3);
    const sky = ctx.createLinearGradient(0, 42, 0, 180);
    sky.addColorStop(0, '#7cc4f4');
    sky.addColorStop(1, '#d8f0ff');
    ctx.fillStyle = sky;
    ctx.fillRect(x + 6, 42, w - 12, 138);
    // Nubes y un edificio de la facultad al fondo.
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ellipsePath(ctx, x + 30, 70, 16, 7);
    ctx.fill();
    ellipsePath(ctx, x + 44, 66, 12, 8);
    ctx.fill();
    ctx.fillStyle = '#b9c7d9';
    ctx.fillRect(x + 6, 140, w - 12, 40);
    ctx.fillStyle = '#9fb0c6';
    for (let i = 0; i < 4; i++) ctx.fillRect(x + 12 + i * 18, 148, 10, 12);
    // Marco en cruz.
    ctx.fillStyle = '#8b6a45';
    ctx.fillRect(x + w / 2 - 2, 42, 4, 138);
    ctx.fillRect(x + 6, 106, w - 12, 4);
  }
}

function drawBoard(ctx: Ctx): void {
  const { x, y, w, h } = CLASSROOM.board;
  roundRectPath(ctx, x - 10, y - 10, w + 20, h + 20, 6);
  fillStroke(ctx, '#8b5a2b', 3);
  const board = ctx.createLinearGradient(x, y, x + w, y + h);
  board.addColorStop(0, '#355c45');
  board.addColorStop(1, '#2b4b39');
  ctx.fillStyle = board;
  ctx.fillRect(x, y, w, h);
  // Restos de borrado.
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (const [ex, ey, ew, eh] of [[x + 300, y + 20, 120, 30], [x + 40, y + 100, 90, 24]] as const) {
    ellipsePath(ctx, ex + ew / 2, ey + eh / 2, ew / 2, eh / 2);
    ctx.fill();
  }
  // Bandeja de tizas.
  ctx.fillStyle = '#6e4520';
  ctx.fillRect(x - 6, y + h + 4, w + 12, 8);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x + 60, y + h + 1, 14, 4);
  ctx.fillStyle = '#ffd6e0';
  ctx.fillRect(x + 84, y + h + 1, 12, 4);
  roundRectPath(ctx, x + w - 70, y + h - 2, 34, 10, 2);
  fillStroke(ctx, '#d9b77e', 1.5);

  // Dibujo fijo: un depósito a presión con flechas (el resto del texto lo escribe el profe).
  const cx = x + w - 70;
  const cy = y + 62;
  ctx.strokeStyle = CHALK;
  ctx.lineWidth = 2;
  ellipsePath(ctx, cx, cy, 34, 26);
  ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 38, cy + Math.sin(a) * 30);
    ctx.lineTo(cx + Math.cos(a) * 50, cy + Math.sin(a) * 40);
    ctx.stroke();
  }
  label(ctx, 'p ↑', cx, cy, 16, CHALK, 700);
}

export function drawClockFace(ctx: Ctx): void {
  const { x, y, r } = CLASSROOM.clock;
  circlePath(ctx, x, y, r + 3);
  fillStroke(ctx, '#3d3d4a', 2.5);
  circlePath(ctx, x, y, r);
  ctx.fillStyle = '#fffdf5';
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * (r - 3), y + Math.sin(a) * (r - 3));
    ctx.lineTo(x + Math.cos(a) * (r - (i % 3 === 0 ? 8 : 5)), y + Math.sin(a) * (r - (i % 3 === 0 ? 8 : 5)));
    ctx.stroke();
  }
}

function drawPosters(ctx: Ctx): void {
  const poster = (x: number, y: number, w: number, h: number, fill: string, lines: readonly string[], size: number, rot: number) => {
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(rot);
    roundRectPath(ctx, -w / 2, -h / 2, w, h, 3);
    fillStroke(ctx, fill, 2);
    lines.forEach((line, i) => label(ctx, line, 0, -((lines.length - 1) * size * 0.6) + i * size * 1.2, size, OUTLINE, 900));
    circlePath(ctx, 0, -h / 2 + 4, 2.5);
    ctx.fillStyle = '#e63946';
    ctx.fill();
    ctx.restore();
  };
  poster(846, 108, 92, 82, '#ffe8a3', ['BERNOULLI', '♥', 'TE QUIERO'], 12, 0.04);
  poster(752, 120, 78, 56, '#d7f0ff', ['ΣF = 0', 'ΣM = 0'], 14, -0.03);
}

function drawProfessorDesk(ctx: Ctx): void {
  const { x, y, w, h } = CLASSROOM.professorDesk;
  // Papelera.
  ctx.beginPath();
  ctx.moveTo(x + w + 12, y + 22);
  ctx.lineTo(x + w + 40, y + 22);
  ctx.lineTo(x + w + 36, y + 56);
  ctx.lineTo(x + w + 16, y + 56);
  ctx.closePath();
  fillStroke(ctx, '#7d8597', 2);
  ellipsePath(ctx, x + w + 26, y + 22, 14, 4);
  fillStroke(ctx, '#5c6375', 1.5);
  circlePath(ctx, x + w + 22, y + 18, 5);
  fillStroke(ctx, '#f4f1ea', 1.2);

  // Mesa del profe.
  roundRectPath(ctx, x, y + 8, w, h, 4);
  fillStroke(ctx, '#7a4e2d', 2.5);
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(x + 6, y + 18, w - 12, h - 16);
  roundRectPath(ctx, x - 6, y, w + 12, 12, 3);
  fillStroke(ctx, '#9a6a40', 2.5);
  // Papeles y taza.
  ctx.save();
  ctx.translate(x + 36, y - 2);
  ctx.rotate(-0.08);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-16, -4, 32, 6);
  ctx.fillStyle = '#f4f1ea';
  ctx.fillRect(-12, -7, 30, 5);
  ctx.restore();
  roundRectPath(ctx, x + w - 34, y - 14, 14, 15, 3);
  fillStroke(ctx, '#e76f51', 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + w - 28, y - 18);
  ctx.quadraticCurveTo(x + w - 24, y - 26, x + w - 29, y - 32);
  ctx.stroke();
}

/**
 * Una fila de pupitres corridos con su banco. Se dibuja ENTRE filas de estudiantes
 * para que cada fila tape a la de detrás.
 */
export function drawDeskRow(ctx: Ctx, seats: readonly StudentSeat[], seatY: number, scale: number, playerX: number | null): void {
  const { width } = CLASSROOM;
  const top = seatY - DESK.topFar * scale;
  const near = seatY - DESK.topNear * scale;

  // Patas de la mesa.
  ctx.fillStyle = '#5b4632';
  for (let x = 40; x < width; x += 120) ctx.fillRect(x, near, 6 * scale, (DESK.topNear - DESK.benchTop) * scale);

  // Tablero.
  ctx.beginPath();
  ctx.moveTo(10, near);
  ctx.lineTo(24, top);
  ctx.lineTo(width - 24, top);
  ctx.lineTo(width - 10, near);
  ctx.closePath();
  fillStroke(ctx, '#c79a63', 2.5);
  ctx.fillStyle = '#9b7347';
  ctx.fillRect(10, near, width - 20, 5 * scale);

  const items = seats.map((s) => ({ x: s.x, look: s.look }));
  if (playerX !== null) items.push({ x: playerX, look: { desk: 'notebook' } as StudentLook });
  for (const item of items) drawDeskItem(ctx, item.x, top, near, scale, item.look.desk);

  // Banco.
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(0, seatY + DESK.benchBottom * scale, width, 6 * scale);
  roundRectPath(ctx, 0, seatY - DESK.benchTop * scale, width, (DESK.benchBottom + DESK.benchTop) * scale, 3);
  fillStroke(ctx, '#6c4a2d', 2.5);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(0, seatY - DESK.benchTop * scale + 2, width, 3 * scale);
}

function drawDeskItem(ctx: Ctx, x: number, top: number, near: number, scale: number, kind: StudentLook['desk']): void {
  const mid = (top + near) / 2;
  ctx.save();
  ctx.translate(x, mid);
  ctx.scale(scale, scale);
  switch (kind) {
    case 'laptop': {
      // Pantalla mirando al estudiante (y a nosotros, que estamos detrás).
      roundRectPath(ctx, 6, -34, 46, 30, 3);
      fillStroke(ctx, '#3a3f4b', 2);
      ctx.fillStyle = '#8ecae6';
      ctx.fillRect(10, -30, 38, 22);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(13, -27, 18, 3);
      ctx.fillRect(13, -21, 26, 3);
      roundRectPath(ctx, 2, -5, 54, 6, 2);
      fillStroke(ctx, '#9aa1ad', 1.5);
      break;
    }
    case 'notebook':
      ctx.rotate(-0.06);
      roundRectPath(ctx, -46, -8, 34, 14, 1.5);
      fillStroke(ctx, '#fffdf5', 1.5);
      ctx.strokeStyle = 'rgba(70,110,200,0.5)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-43, -4 + i * 3.5);
        ctx.lineTo(-15, -4 + i * 3.5);
        ctx.stroke();
      }
      ctx.strokeStyle = '#e63946';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-10, -10);
      ctx.lineTo(4, -4);
      ctx.stroke();
      break;
    case 'tablet':
      roundRectPath(ctx, 10, -26, 30, 22, 3);
      fillStroke(ctx, '#2b2d42', 2);
      ctx.fillStyle = '#f6bd60';
      ctx.fillRect(13, -23, 24, 16);
      break;
  }
  ctx.restore();
}
