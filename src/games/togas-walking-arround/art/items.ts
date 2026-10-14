import { OUTLINE, circlePath, ellipsePath, fillStroke, label, roundRectPath, shade } from './paint';

type Ctx = CanvasRenderingContext2D;

/** Lienzos de los objetos (unidades lógicas). */
export const ITEM_CANVAS = { width: 52, height: 52 } as const;
export const OBSTACLE_CANVAS = { width: 52, height: 60 } as const;

/** Dibuja una comida o bebida centrada en un lienzo de 52 × 52. Marcas siempre inventadas. */
export function drawCollectible(ctx: Ctx, id: string): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (id) {
    case 'fabes':
      drawFabada(ctx);
      break;
    case 'chickpeas':
      drawChickpeas(ctx);
      break;
    case 'cauliflower':
      drawCauliflower(ctx);
      break;
    case 'beer_can':
      drawCan(ctx, '#f4c430', '#d99a0b', 'BIRRA', '#b3261e');
      break;
    case 'soda':
      drawCan(ctx, '#8a5cf6', '#5b34c4', 'FIZZ', '#ffffff');
      break;
    default:
      circlePath(ctx, 26, 26, 16);
      fillStroke(ctx, '#cccccc');
  }
  ctx.restore();
}

/** Dibuja un antigás centrado en un lienzo de 52 × 60, apoyado en el borde inferior. */
export function drawObstacle(ctx: Ctx, id: string): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (id === 'fruit_salts') drawFruitSalts(ctx);
  else drawAntigasBox(ctx);
  ctx.restore();
}

function steam(ctx: Ctx, xs: readonly number[], top: number): void {
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  for (const x of xs) {
    ctx.beginPath();
    ctx.moveTo(x, top + 10);
    ctx.bezierCurveTo(x - 4, top + 6, x + 4, top + 3, x, top - 2);
    ctx.stroke();
  }
}

function bowl(ctx: Ctx, rim: string, body: string, food: string): void {
  ctx.beginPath();
  ctx.moveTo(5, 25);
  ctx.quadraticCurveTo(7, 45, 26, 45);
  ctx.quadraticCurveTo(45, 45, 47, 25);
  ctx.closePath();
  fillStroke(ctx, body);
  ellipsePath(ctx, 26, 25, 21, 7);
  fillStroke(ctx, rim);
  ellipsePath(ctx, 26, 25, 17.5, 5);
  fillStroke(ctx, food, 1.5);
}

function drawFabada(ctx: Ctx): void {
  steam(ctx, [18, 26, 34], 4);
  bowl(ctx, '#c97a3d', '#a9521f', '#e8a23a');
  // Fabes, chorizo y morcilla.
  const beans: ReadonlyArray<readonly [number, number]> = [[16, 24], [22, 26], [30, 23], [36, 26], [27, 27], [19, 22]];
  for (const [x, y] of beans) {
    ellipsePath(ctx, x, y, 3.2, 2.1, 0.3);
    fillStroke(ctx, '#f6ecd6', 1);
  }
  for (const [x, y] of [[25, 22], [34, 22]] as const) {
    circlePath(ctx, x, y, 3.6);
    fillStroke(ctx, '#c0392b', 1.2);
    circlePath(ctx, x - 1, y - 1, 0.9);
    ctx.fillStyle = '#f5b7a8';
    ctx.fill();
  }
  circlePath(ctx, 13, 26, 3.2);
  fillStroke(ctx, '#3b1f1f', 1.2);
  // Raya decorativa de la cazuela.
  ctx.strokeStyle = shade('#a9521f', 0.3);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(11, 35);
  ctx.quadraticCurveTo(26, 40, 41, 35);
  ctx.stroke();
}

function drawChickpeas(ctx: Ctx): void {
  steam(ctx, [20, 32], 6);
  bowl(ctx, '#7fb2ec', '#3d7cc9', '#d9a441');
  const peas: ReadonlyArray<readonly [number, number]> = [[14, 25], [19, 23], [24, 26], [29, 23], [34, 25], [38, 24], [21, 27], [31, 27], [26, 22]];
  for (const [x, y] of peas) {
    circlePath(ctx, x, y, 3);
    fillStroke(ctx, '#ecc985', 1);
  }
  ctx.fillStyle = '#4caf50';
  for (const [x, y] of [[17, 22], [33, 22], [27, 26]] as const) {
    circlePath(ctx, x, y, 1.3);
    ctx.fill();
  }
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(12, 36);
  ctx.quadraticCurveTo(26, 41, 40, 36);
  ctx.stroke();
}

function drawCauliflower(ctx: Ctx): void {
  // Hojas.
  for (const [x, rot] of [[13, -0.6], [39, 0.6], [26, 0]] as const) {
    ellipsePath(ctx, x, 37, 9, 13, rot);
    fillStroke(ctx, '#5aa548', 2);
  }
  // Ramilletes.
  const florets: ReadonlyArray<readonly [number, number, number]> = [
    [17, 25, 8], [35, 25, 8], [26, 19, 9], [21, 31, 7.5], [31, 31, 7.5], [26, 27, 8],
  ];
  for (const [x, y, r] of florets) {
    circlePath(ctx, x, y, r);
    fillStroke(ctx, '#f6f1e1', 2);
  }
  ctx.fillStyle = '#dcd3b8';
  for (const [x, y] of [[24, 17], [33, 23], [19, 29], [28, 29]] as const) {
    circlePath(ctx, x, y, 1.6);
    ctx.fill();
  }
}

function drawCan(ctx: Ctx, light: string, dark: string, brand: string, brandColor: string): void {
  const gradient = ctx.createLinearGradient(14, 0, 38, 0);
  gradient.addColorStop(0, dark);
  gradient.addColorStop(0.35, light);
  gradient.addColorStop(0.55, shade(light, 0.3));
  gradient.addColorStop(1, dark);
  roundRectPath(ctx, 14, 7, 24, 40, 5);
  fillStroke(ctx, gradient);
  // Tapa metálica.
  ellipsePath(ctx, 26, 8, 11, 3.5);
  fillStroke(ctx, '#d9dde3', 2);
  ellipsePath(ctx, 28, 8, 3, 1.2);
  ctx.fillStyle = '#9aa1ab';
  ctx.fill();
  // Etiqueta inventada.
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillRect(15.5, 20, 21, 13);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1;
  ctx.strokeRect(15.5, 20, 21, 13);
  label(ctx, brand, 26, 26.8, brand.length > 4 ? 6.2 : 7.5, brandColor === '#ffffff' ? dark : brandColor);
  // Gotas de condensación.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const [x, y] of [[18, 14], [33, 38], [20, 41]] as const) {
    ellipsePath(ctx, x, y, 1.2, 1.8);
    ctx.fill();
  }
}

function drawAntigasBox(ctx: Ctx): void {
  roundRectPath(ctx, 8, 14, 36, 44, 4);
  fillStroke(ctx, '#f4f7fb');
  ctx.fillStyle = '#2ec4b6';
  ctx.fillRect(9.5, 15.5, 33, 10);
  // Icono "prohibido el gas": nube tachada.
  for (const [x, y, r] of [[22, 40, 5], [28, 38, 6], [33, 41, 4.5]] as const) {
    circlePath(ctx, x, y, r);
    ctx.fillStyle = '#b5e36b';
    ctx.fill();
  }
  circlePath(ctx, 27, 40, 9);
  ctx.strokeStyle = '#e63946';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(21, 34);
  ctx.lineTo(33, 46);
  ctx.stroke();
  label(ctx, 'ANTIGÁS', 26, 21, 6.5, '#ffffff');
  label(ctx, 'FORTE', 26, 53, 6, '#2b2340');
  // Pastilla asomando.
  ellipsePath(ctx, 40, 12, 6, 3.5, -0.5);
  fillStroke(ctx, '#ffffff', 1.8);
}

function drawFruitSalts(ctx: Ctx): void {
  // Sobre con borde dentado.
  ctx.beginPath();
  ctx.moveTo(9, 16);
  for (let x = 9; x <= 43; x += 4) ctx.lineTo(x + 2, x % 8 === 1 ? 13 : 16);
  ctx.lineTo(43, 16);
  ctx.lineTo(43, 57);
  ctx.lineTo(9, 57);
  ctx.closePath();
  fillStroke(ctx, '#ffcf56');
  ctx.fillStyle = '#ff9f1c';
  ctx.fillRect(10.5, 42, 31, 13);
  // Limón.
  ellipsePath(ctx, 26, 30, 9, 7);
  fillStroke(ctx, '#f9f871', 2);
  ellipsePath(ctx, 26, 30, 5, 3.5);
  ctx.fillStyle = '#fffbd0';
  ctx.fill();
  label(ctx, 'SAL DE', 26, 46, 5.8, '#ffffff');
  label(ctx, 'FRUTAS', 26, 52, 5.8, '#ffffff');
  // Burbujitas efervescentes.
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.2;
  for (const [x, y, r] of [[15, 22, 2], [37, 24, 2.5], [34, 36, 1.6]] as const) {
    circlePath(ctx, x, y, r);
    ctx.stroke();
  }
}
