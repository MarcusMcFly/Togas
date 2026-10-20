import { OUTLINE, circlePath, ellipsePath, fillStroke, label, limb, roundRectPath, shade } from '../../../core/art/paint';

type Ctx = CanvasRenderingContext2D;

/** Lienzo de cada obstáculo de recorrido. `groundY` es la línea del suelo dentro del lienzo. */
export const TRAVERSAL_CANVAS: Readonly<Record<string, { width: number; height: number; groundY: number }>> = {
  work_fence: { width: 70, height: 64, groundY: 60 },
  planter: { width: 74, height: 60, groundY: 56 },
  scaffold: { width: 132, height: 340, groundY: 334 },
  hanging_sign: { width: 120, height: 300, groundY: 296 },
};

/** Fachada de la universidad (meta del recorrido). La puerta queda en el centro. */
export const UNIVERSITY_CANVAS = { width: 460, height: 360, groundY: 356 } as const;

export function drawTraversal(ctx: Ctx, id: string): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (id) {
    case 'work_fence':
      drawWorkFence(ctx);
      break;
    case 'planter':
      drawPlanter(ctx);
      break;
    case 'scaffold':
      drawScaffold(ctx);
      break;
    case 'hanging_sign':
      drawHangingSign(ctx);
      break;
  }
  ctx.restore();
}

/** Valla de obras baja: tablón a rayas sobre dos caballetes y una baliza. */
function drawWorkFence(ctx: Ctx): void {
  for (const x of [14, 56]) {
    ctx.beginPath();
    ctx.moveTo(x - 9, 60);
    ctx.lineTo(x, 26);
    ctx.lineTo(x + 9, 60);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.strokeStyle = '#f4f1ea';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  roundRectPath(ctx, 4, 16, 62, 15, 3);
  fillStroke(ctx, '#ffffff');
  ctx.save();
  roundRectPath(ctx, 4, 16, 62, 15, 3);
  ctx.clip();
  ctx.fillStyle = '#e63946';
  for (let x = -10; x < 70; x += 14) {
    ctx.beginPath();
    ctx.moveTo(x, 31);
    ctx.lineTo(x + 7, 31);
    ctx.lineTo(x + 15, 16);
    ctx.lineTo(x + 8, 16);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  roundRectPath(ctx, 4, 16, 62, 15, 3);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // Baliza.
  roundRectPath(ctx, 31, 8, 8, 9, 2);
  fillStroke(ctx, '#ff9f1c', 2);
  circlePath(ctx, 35, 9, 6);
  ctx.fillStyle = 'rgba(255,210,63,0.35)';
  ctx.fill();
}

/** Jardinera de hormigón con un seto y flores. */
function drawPlanter(ctx: Ctx): void {
  for (const [x, y, rx, ry] of [[20, 26, 14, 11], [37, 21, 16, 13], [54, 26, 14, 11]] as const) {
    ellipsePath(ctx, x, y, rx, ry);
    fillStroke(ctx, '#4f9d3a', 2.2);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ellipsePath(ctx, 37, 30, 28, 5);
  ctx.fill();
  for (const [x, y, c] of [[16, 20, '#ff4d6d'], [30, 14, '#ffd23f'], [44, 17, '#ff4d6d'], [56, 22, '#ffd23f'], [38, 25, '#ffffff']] as const) {
    circlePath(ctx, x, y, 2.6);
    fillStroke(ctx, c, 1.2);
  }
  roundRectPath(ctx, 6, 28, 62, 28, 4);
  fillStroke(ctx, '#b8b0a3');
  ctx.fillStyle = shade('#b8b0a3', -0.15);
  ctx.fillRect(8, 46, 58, 8);
  ctx.strokeStyle = shade('#b8b0a3', -0.3);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(26, 30);
  ctx.lineTo(26, 54);
  ctx.moveTo(48, 30);
  ctx.lineTo(48, 54);
  ctx.stroke();
}

/** Andamio de obra: hay que pasar rodando bajo la plataforma (hueco de 58 px). */
function drawScaffold(ctx: Ctx): void {
  const ground = 334;
  const deckBottom = ground - 58;
  // Red de seguridad por encima de la plataforma.
  ctx.fillStyle = 'rgba(46,160,90,0.55)';
  ctx.fillRect(14, 18, 104, deckBottom - 50);
  ctx.strokeStyle = 'rgba(20,90,50,0.6)';
  ctx.lineWidth = 1;
  for (let y = 26; y < deckBottom - 32; y += 10) {
    ctx.beginPath();
    ctx.moveTo(14, y);
    ctx.lineTo(118, y);
    ctx.stroke();
  }
  for (let x = 22; x < 118; x += 10) {
    ctx.beginPath();
    ctx.moveTo(x, 18);
    ctx.lineTo(x, deckBottom - 32);
    ctx.stroke();
  }
  // Tubos verticales y cruces.
  for (const x of [12, 120]) limb(ctx, [[x, 6], [x, ground]], 6, '#9aa5b8', 2);
  for (const [y0, y1] of [[24, 120], [120, 216]] as const) {
    limb(ctx, [[12, y1], [120, y0]], 3.5, '#9aa5b8', 1.6);
  }
  limb(ctx, [[12, 24], [120, 24]], 4, '#9aa5b8', 1.6);
  // Plataforma con cartel a rayas.
  roundRectPath(ctx, 2, deckBottom - 36, 128, 22, 3);
  fillStroke(ctx, '#ffd23f');
  ctx.save();
  roundRectPath(ctx, 2, deckBottom - 36, 128, 22, 3);
  ctx.clip();
  ctx.fillStyle = OUTLINE;
  for (let x = -20; x < 140; x += 18) {
    ctx.beginPath();
    ctx.moveTo(x, deckBottom - 14);
    ctx.lineTo(x + 9, deckBottom - 14);
    ctx.lineTo(x + 20, deckBottom - 36);
    ctx.lineTo(x + 11, deckBottom - 36);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  roundRectPath(ctx, 34, deckBottom - 34, 64, 18, 4);
  fillStroke(ctx, '#ffffff', 2);
  label(ctx, '¡AGÁCHATE!', 66, deckBottom - 25, 10, '#c1121f');
  roundRectPath(ctx, 0, deckBottom - 14, 132, 14, 3);
  fillStroke(ctx, '#c8a165');
  ctx.strokeStyle = shade('#c8a165', -0.3);
  ctx.lineWidth = 1.2;
  for (const x of [33, 66, 99]) {
    ctx.beginPath();
    ctx.moveTo(x, deckBottom - 13);
    ctx.lineTo(x, deckBottom - 1);
    ctx.stroke();
  }
}

/** Cartel publicitario colgado de una viga: el borde inferior queda a 58 px del suelo. */
function drawHangingSign(ctx: Ctx): void {
  const ground = 296;
  const bottom = ground - 58;
  const top = 88;
  limb(ctx, [[2, 10], [118, 10]], 8, '#5c5f6b', 2);
  for (const x of [24, 96]) {
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    for (let y = 14; y < top; y += 8) {
      ellipsePath(ctx, x, y + 3, 2.5, 4);
      ctx.stroke();
    }
  }
  roundRectPath(ctx, 4, top, 112, bottom - top, 8);
  fillStroke(ctx, '#ff4d6d', 3);
  roundRectPath(ctx, 11, top + 7, 98, bottom - top - 14, 5);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 2;
  ctx.stroke();
  label(ctx, 'REBAJAS', 60, top + 40, 20, '#ffffff');
  label(ctx, '−50 %', 60, top + 76, 26, '#ffd23f');
  label(ctx, 'en antigases', 60, top + 108, 11, '#ffffff', 700);
}

/** Fachada clásica de la universidad, con escalinata, columnas y frontón. */
export function drawUniversity(ctx: Ctx): void {
  const { width, groundY } = UNIVERSITY_CANVAS;
  const cx = width / 2;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Bandera en el frontón.
  limb(ctx, [[cx, 34], [cx, 2]], 3, '#5c5f6b', 1.5);
  ctx.beginPath();
  ctx.moveTo(cx + 1, 4);
  ctx.quadraticCurveTo(cx + 18, 0, cx + 34, 8);
  ctx.lineTo(cx + 34, 22);
  ctx.quadraticCurveTo(cx + 18, 14, cx + 1, 18);
  ctx.closePath();
  fillStroke(ctx, '#9b5de5', 2);

  // Cuerpo del edificio.
  roundRectPath(ctx, 40, 116, width - 80, groundY - 140, 4);
  fillStroke(ctx, '#efe3c8');
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  ctx.fillRect(42, 118, 40, groundY - 144);

  // Puerta en arco.
  ctx.beginPath();
  ctx.moveTo(cx - 32, groundY - 26);
  ctx.lineTo(cx - 32, groundY - 100);
  ctx.arc(cx, groundY - 100, 32, Math.PI, 0);
  ctx.lineTo(cx + 32, groundY - 26);
  ctx.closePath();
  fillStroke(ctx, '#6b3f22');
  ctx.strokeStyle = shade('#6b3f22', -0.35);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, groundY - 26);
  ctx.lineTo(cx, groundY - 130);
  ctx.stroke();
  for (const side of [-1, 1]) {
    circlePath(ctx, cx + side * 7, groundY - 70, 2.5);
    fillStroke(ctx, '#ffd23f', 1.2);
  }

  // Columnas.
  const columns = [78, 136, 194, 266, 324, 382];
  for (const x of columns) {
    roundRectPath(ctx, x - 12, 128, 24, groundY - 158, 3);
    fillStroke(ctx, '#fbf6ea', 2.2);
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1.4;
    for (const dx of [-5, 0, 5]) {
      ctx.beginPath();
      ctx.moveTo(x + dx, 134);
      ctx.lineTo(x + dx, groundY - 36);
      ctx.stroke();
    }
    roundRectPath(ctx, x - 16, 122, 32, 9, 2);
    fillStroke(ctx, '#f5ecd8', 2);
    roundRectPath(ctx, x - 16, groundY - 34, 32, 8, 2);
    fillStroke(ctx, '#f5ecd8', 2);
  }

  // Pancartas entre columnas.
  for (const [x, emblem, color] of [[107, '∫', '#2a9d8f'], [353, 'π', '#e76f51']] as const) {
    ctx.beginPath();
    ctx.moveTo(x - 14, 142);
    ctx.lineTo(x + 14, 142);
    ctx.lineTo(x + 14, 196);
    ctx.lineTo(x, 188);
    ctx.lineTo(x - 14, 196);
    ctx.closePath();
    fillStroke(ctx, color, 2);
    label(ctx, emblem, x, 164, 18, '#ffffff');
  }

  // Friso con el nombre y frontón.
  roundRectPath(ctx, 26, 94, width - 52, 30, 4);
  fillStroke(ctx, '#f5ecd8');
  label(ctx, 'UNIVERSIDAD', cx, 110, 22, OUTLINE);
  ctx.beginPath();
  ctx.moveTo(18, 96);
  ctx.lineTo(cx, 30);
  ctx.lineTo(width - 18, 96);
  ctx.closePath();
  fillStroke(ctx, '#f5ecd8');
  ctx.beginPath();
  ctx.moveTo(60, 88);
  ctx.lineTo(cx, 46);
  ctx.lineTo(width - 60, 88);
  ctx.closePath();
  ctx.strokeStyle = shade('#f5ecd8', -0.25);
  ctx.lineWidth = 2;
  ctx.stroke();
  circlePath(ctx, cx, 70, 12);
  fillStroke(ctx, '#ffd23f', 2);
  label(ctx, 'Σ', cx, 70, 14, OUTLINE);

  // Escalinata.
  for (let i = 0; i < 3; i++) {
    const y = groundY - 26 + i * 9;
    const w = width - 96 + i * 28;
    roundRectPath(ctx, cx - w / 2, y, w, 9, 2);
    fillStroke(ctx, i % 2 === 0 ? '#d9cfbb' : '#e6dcc8', 2);
  }
  ctx.restore();
}

/** Portal de casa de noche (meta de la vuelta). La puerta queda en el centro. */
export const HOME_CANVAS = { width: 320, height: 360, groundY: 356, night: true } as const;

export function drawHome(ctx: Ctx): void {
  const { width, groundY } = HOME_CANVAS;
  const cx = width / 2;
  const brick = '#7a4b52';
  const lit = '#ffd36b';
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Tejado y chimenea.
  roundRectPath(ctx, 228, 18, 26, 46, 3);
  fillStroke(ctx, shade(brick, -0.2), 2);
  ctx.beginPath();
  ctx.moveTo(14, 66);
  ctx.lineTo(cx, 20);
  ctx.lineTo(width - 14, 66);
  ctx.closePath();
  fillStroke(ctx, '#3b3f5c');

  // Fachada con hileras de ladrillo.
  roundRectPath(ctx, 26, 62, width - 52, groundY - 62, 3);
  fillStroke(ctx, brick);
  ctx.strokeStyle = 'rgba(0,0,0,0.16)';
  ctx.lineWidth = 1;
  for (let y = 74; y < groundY - 6; y += 14) {
    ctx.beginPath();
    ctx.moveTo(28, y);
    ctx.lineTo(width - 28, y);
    ctx.stroke();
  }

  // Ventanas: casi todas a oscuras, alguna encendida (la de Pollo, la que más).
  const windows: ReadonlyArray<readonly [number, number, boolean]> = [
    [64, 102, false], [cx - 16, 102, true], [width - 96, 102, false],
    [64, 172, true], [width - 96, 172, false],
  ];
  for (const [x, y, on] of windows) {
    if (on) {
      const g = ctx.createRadialGradient(x + 16, y + 22, 0, x + 16, y + 22, 44);
      g.addColorStop(0, 'rgba(255,214,120,0.45)');
      g.addColorStop(1, 'rgba(255,214,120,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 28, y - 22, 88, 88);
    }
    roundRectPath(ctx, x, y, 32, 44, 3);
    fillStroke(ctx, on ? lit : '#2a3060', 2);
    ctx.strokeStyle = on ? 'rgba(160,110,40,0.6)' : 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 16, y + 3);
    ctx.lineTo(x + 16, y + 41);
    ctx.moveTo(x + 3, y + 22);
    ctx.lineTo(x + 29, y + 22);
    ctx.stroke();
  }

  // Rótulo bajo el tejado: por encima de la cabeza del personaje cuando se para en la puerta.
  roundRectPath(ctx, cx - 92, 70, 184, 26, 6);
  fillStroke(ctx, '#2b2340', 2);
  label(ctx, 'HOGAR, DULCE HOGAR', cx, 83, 14, lit);

  // Farolillo y luz del portal.
  const porch = ctx.createRadialGradient(cx, groundY - 70, 0, cx, groundY - 70, 110);
  porch.addColorStop(0, 'rgba(255,214,120,0.5)');
  porch.addColorStop(1, 'rgba(255,214,120,0)');
  ctx.fillStyle = porch;
  ctx.fillRect(cx - 110, groundY - 180, 220, 180);
  circlePath(ctx, cx + 48, groundY - 92, 7);
  fillStroke(ctx, '#fff6c8', 2);

  // Puerta con montante y felpudo.
  roundRectPath(ctx, cx - 30, groundY - 96, 60, 84, 4);
  fillStroke(ctx, '#3d5a80');
  ctx.beginPath();
  ctx.arc(cx, groundY - 96, 30, Math.PI, 0);
  ctx.closePath();
  fillStroke(ctx, lit, 2);
  circlePath(ctx, cx + 18, groundY - 54, 3);
  fillStroke(ctx, '#ffd23f', 1.2);
  roundRectPath(ctx, cx - 40, groundY - 12, 80, 8, 3);
  fillStroke(ctx, '#b5651d', 2);
  ellipsePath(ctx, cx, groundY - 2, 70, 4);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fill();
  ctx.restore();
}
