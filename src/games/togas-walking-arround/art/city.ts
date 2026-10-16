import { Random } from '../../../core/utils/Random';
import { OUTLINE, circlePath, ellipsePath, fillStroke, label, roundRectPath, shade } from '../../../core/art/paint';

type Ctx = CanvasRenderingContext2D;

/**
 * Ciudad europea inventada, en capas para el parallax. Las capas que se repiten
 * miden TILE_WIDTH y se dibujan sin cruzar los bordes, para que el mosaico no tenga costuras.
 */
export const TILE_WIDTH = 1024;
export const CITY_LAYERS = {
  sky: { width: 960, height: 540 },
  clouds: { width: TILE_WIDTH, height: 170 },
  skyline: { width: TILE_WIDTH, height: 220 },
  buildings: { width: TILE_WIDTH, height: 330 },
  street: { width: TILE_WIDTH, height: 300, sidewalkY: 222 },
} as const;

export function drawSky(ctx: Ctx): void {
  const { width, height } = CITY_LAYERS.sky;
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#5fb8f5');
  gradient.addColorStop(0.55, '#bfe7ff');
  gradient.addColorStop(0.8, '#ffe9c4');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(790, 105, 10, 790, 105, 130);
  glow.addColorStop(0, 'rgba(255,245,190,0.9)');
  glow.addColorStop(1, 'rgba(255,245,190,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(640, 0, 300, 260);
  circlePath(ctx, 790, 105, 42);
  ctx.fillStyle = '#fff3b0';
  ctx.fill();
}

export function drawClouds(ctx: Ctx): void {
  const clouds: ReadonlyArray<readonly [number, number, number]> = [
    [120, 60, 1], [430, 110, 0.7], [640, 45, 1.2], [900, 95, 0.8],
  ];
  for (const [x, y, s] of clouds) {
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    for (const [dx, dy, r] of [[-40, 8, 22], [-14, -6, 30], [18, -2, 26], [44, 10, 18], [0, 14, 24]] as const) {
      circlePath(ctx, x + dx * s, y + dy * s, r * s);
      ctx.fill();
    }
  }
}

export function drawSkyline(ctx: Ctx): void {
  const { width, height } = CITY_LAYERS.skyline;
  const rng = new Random(7);
  const rows = [
    { color: '#c3d4ea', min: 50, max: 150 },
    { color: '#9fb6d6', min: 30, max: 110 },
  ];
  for (const row of rows) {
    ctx.fillStyle = row.color;
    let x = 0;
    while (x < width) {
      const w = Math.min(rng.int(40, 95), width - x);
      const h = rng.range(row.min, row.max);
      const top = height - h;
      ctx.fillRect(x, top, w, h);
      const roof = rng.next();
      if (roof < 0.15 && w > 50) {
        // Cúpula.
        ctx.beginPath();
        ctx.arc(x + w / 2, top, w / 3, Math.PI, 0);
        ctx.fill();
        ctx.fillRect(x + w / 2 - 1.5, top - w / 3 - 14, 3, 14);
      } else if (roof < 0.3) {
        // Torre con chapitel.
        ctx.beginPath();
        ctx.moveTo(x + w * 0.3, top);
        ctx.lineTo(x + w / 2, top - 45);
        ctx.lineTo(x + w * 0.7, top);
        ctx.fill();
      } else if (roof < 0.45) {
        // Tejado a dos aguas.
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x + w / 2, top - 18);
        ctx.lineTo(x + w, top);
        ctx.fill();
      } else if (roof < 0.55) {
        // Antena.
        ctx.fillRect(x + w * 0.6, top - 30, 2, 30);
      }
      x += w;
    }
  }
}

const FACADES = ['#f2c57c', '#e98a6b', '#f4e3c1', '#a8c5da', '#f0a7a0', '#cfe0b4', '#e8d0a9', '#b9a7d6'];
const AWNINGS = ['#e63946', '#2a9d8f', '#3d5a80', '#f4a261', '#6a4c93'];
const SHOPS = [
  'CAFÉ', 'BAR PACO', 'SIDRERÍA', 'KEBAB', 'FABADAS 24H', 'COPISTERÍA', 'PANADERÍA', 'FARMACIA', 'CHURROS',
];

export function drawBuildings(ctx: Ctx): void {
  const { width, height } = CITY_LAYERS.buildings;
  const rng = new Random(42);
  let x = 0;
  let index = 0;
  while (x < width) {
    const isFaculty = index === 2;
    let w = isFaculty ? 270 : rng.int(120, 185);
    if (width - x - w < 120) w = width - x;
    if (isFaculty) drawFaculty(ctx, x, w, height);
    else drawBuilding(ctx, rng, x, w, height, SHOPS[index % SHOPS.length]);
    x += w;
    index++;
  }
}

function drawBuilding(ctx: Ctx, rng: Random, x: number, w: number, bottom: number, shop: string): void {
  const h = rng.range(185, 300);
  const top = bottom - h;
  const facade = rng.pick(FACADES);
  const shutter = rng.chance(0.5) ? '#4f772d' : '#3d5a80';
  const awning = rng.pick(AWNINGS);
  const outline = 'rgba(43,35,64,0.55)';

  // Tejado.
  const roofType = rng.next();
  if (roofType < 0.35) {
    ctx.beginPath();
    ctx.moveTo(x + 4, top);
    ctx.lineTo(x + 16, top - 22);
    ctx.lineTo(x + w - 16, top - 22);
    ctx.lineTo(x + w - 4, top);
    ctx.closePath();
    fillStroke(ctx, '#5b6378', 2, outline);
    for (let dx = 30; dx < w - 30; dx += 46) {
      roundRectPath(ctx, x + dx, top - 18, 14, 14, 3);
      fillStroke(ctx, '#bfe3f0', 1.5, outline);
    }
  } else if (roofType < 0.6) {
    ctx.beginPath();
    ctx.moveTo(x + 2, top);
    ctx.lineTo(x + w / 2, top - 30);
    ctx.lineTo(x + w - 2, top);
    ctx.closePath();
    fillStroke(ctx, '#c4683f', 2, outline);
  }

  ctx.fillStyle = facade;
  ctx.fillRect(x, top, w, h);
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, top, w - 2, h);
  // Cornisa.
  ctx.fillStyle = shade(facade, -0.18);
  ctx.fillRect(x - 2, top, w + 4, 9);

  // Ventanas con contraventanas y algún balcón.
  const groundFloor = 60;
  const cols = Math.max(2, Math.floor(w / 50));
  const colW = w / cols;
  for (let y = top + 22; y + 34 < bottom - groundFloor; y += 48) {
    const balcony = rng.chance(0.35);
    for (let c = 0; c < cols; c++) {
      const wx = x + c * colW + colW / 2 - 10;
      ctx.fillStyle = shade(shutter, 0.1);
      ctx.fillRect(wx - 7, y, 6, 30);
      ctx.fillRect(wx + 21, y, 6, 30);
      roundRectPath(ctx, wx, y, 20, 30, 2);
      fillStroke(ctx, rng.chance(0.25) ? '#ffe9a8' : '#bfe3f0', 1.5, outline);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(wx + 10, y + 2);
      ctx.lineTo(wx + 10, y + 28);
      ctx.stroke();
      if (balcony) {
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(wx - 6, y + 22, 32, 10);
        for (let b = wx - 2; b < wx + 26; b += 5) {
          ctx.beginPath();
          ctx.moveTo(b, y + 22);
          ctx.lineTo(b, y + 32);
          ctx.stroke();
        }
      }
    }
  }

  // Planta baja: escaparate, puerta, toldo y letrero.
  const gy = bottom - groundFloor;
  ctx.fillStyle = shade(facade, -0.08);
  ctx.fillRect(x, gy, w, groundFloor);
  roundRectPath(ctx, x + 10, gy + 22, w - 54, groundFloor - 22, 3);
  fillStroke(ctx, '#bfe3f0', 2, outline);
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 18, bottom - 8);
  ctx.lineTo(x + 34, gy + 28);
  ctx.stroke();
  roundRectPath(ctx, x + w - 38, gy + 18, 26, groundFloor - 18, 3);
  fillStroke(ctx, '#7b4b2a', 2, outline);
  for (let i = 0; i < Math.floor((w - 16) / 16); i++) {
    ctx.fillStyle = i % 2 === 0 ? awning : '#ffffff';
    ctx.beginPath();
    const ax = x + 8 + i * 16;
    ctx.moveTo(ax, gy + 6);
    ctx.lineTo(ax + 16, gy + 6);
    ctx.lineTo(ax + 16, gy + 18);
    ctx.quadraticCurveTo(ax + 8, gy + 24, ax, gy + 18);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 8, gy + 6, Math.floor((w - 16) / 16) * 16, 12);
  roundRectPath(ctx, x + w / 2 - 44, gy - 16, 88, 18, 4);
  fillStroke(ctx, '#2b2340', 0);
  label(ctx, shop, x + w / 2, gy - 7, shop.length > 9 ? 9.5 : 11, '#ffd23f');
}

function drawFaculty(ctx: Ctx, x: number, w: number, bottom: number): void {
  const stone = '#ece0c6';
  const outline = 'rgba(43,35,64,0.55)';
  const top = bottom - 250;
  // Frontón clásico.
  ctx.beginPath();
  ctx.moveTo(x + 6, top + 30);
  ctx.lineTo(x + w / 2, top - 10);
  ctx.lineTo(x + w - 6, top + 30);
  ctx.closePath();
  fillStroke(ctx, shade(stone, -0.05), 2, outline);
  circlePath(ctx, x + w / 2, top + 14, 9);
  fillStroke(ctx, '#bfe3f0', 1.5, outline);
  ctx.fillStyle = stone;
  ctx.fillRect(x, top + 30, w, 220);
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, top + 30, w - 2, 220);
  ctx.fillStyle = shade(stone, -0.12);
  ctx.fillRect(x, top + 30, w, 26);
  label(ctx, 'FACULTAD DE INGENIERÍA', x + w / 2, top + 43, 11, '#5a4f78');
  // Ventanas al fondo y columnas delante.
  for (let wx = x + 30; wx < x + w - 40; wx += 52) {
    roundRectPath(ctx, wx + 6, top + 70, 22, 34, 11);
    fillStroke(ctx, '#bfe3f0', 1.5, outline);
  }
  for (let c = 0; c < 6; c++) {
    const cx = x + 22 + c * ((w - 44) / 5);
    ctx.fillStyle = '#fbf5e6';
    ctx.fillRect(cx - 7, top + 118, 14, 106);
    ctx.strokeStyle = outline;
    ctx.strokeRect(cx - 7, top + 118, 14, 106);
    ctx.fillStyle = shade(stone, -0.1);
    ctx.fillRect(cx - 10, top + 112, 20, 7);
  }
  roundRectPath(ctx, x + w / 2 - 20, bottom - 66, 40, 42, 20);
  fillStroke(ctx, '#6b4226', 2, outline);
  // Escalinata.
  for (let s = 0; s < 3; s++) {
    ctx.fillStyle = shade(stone, -0.06 * s);
    ctx.fillRect(x + 10 - s * 4, bottom - 24 + s * 8, w - 20 + s * 8, 8);
  }
}

export function drawStreet(ctx: Ctx): void {
  const { width, height, sidewalkY } = CITY_LAYERS.street;
  // Acera.
  ctx.fillStyle = '#d6cfc2';
  ctx.fillRect(0, sidewalkY, width, 40);
  ctx.fillStyle = '#ebe5da';
  ctx.fillRect(0, sidewalkY, width, 4);
  ctx.strokeStyle = 'rgba(80,70,90,0.25)';
  ctx.lineWidth = 1.5;
  for (let x = 0; x < width; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, sidewalkY + 4);
    ctx.lineTo(x - 10, sidewalkY + 40);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(0, sidewalkY + 21);
  ctx.lineTo(width, sidewalkY + 21);
  ctx.stroke();
  // Bordillo y calzada.
  ctx.fillStyle = '#9e978c';
  ctx.fillRect(0, sidewalkY + 40, width, 8);
  ctx.fillStyle = '#4a4a58';
  ctx.fillRect(0, sidewalkY + 48, width, height - sidewalkY - 48);
  ctx.fillStyle = '#f1f1f1';
  for (let x = 0; x < width; x += 64) ctx.fillRect(x + 16, sidewalkY + 64, 32, 4);

  // Mobiliario urbano.
  drawStreetLamp(ctx, 70, sidewalkY);
  drawTree(ctx, 250, sidewalkY);
  drawBench(ctx, 400, sidewalkY);
  drawSign(ctx, 520, sidewalkY);
  drawStreetLamp(ctx, 600, sidewalkY);
  drawBike(ctx, 700, sidewalkY);
  drawTree(ctx, 850, sidewalkY);
  drawBin(ctx, 975, sidewalkY);
}

function drawStreetLamp(ctx: Ctx, x: number, ground: number): void {
  ctx.fillStyle = '#3a3f58';
  ctx.fillRect(x - 3, ground - 190, 6, 190);
  ctx.fillRect(x - 8, ground - 8, 16, 8);
  ctx.beginPath();
  ctx.moveTo(x, ground - 188);
  ctx.quadraticCurveTo(x + 4, ground - 205, x + 24, ground - 200);
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#3a3f58';
  ctx.stroke();
  roundRectPath(ctx, x + 16, ground - 202, 18, 12, 4);
  fillStroke(ctx, '#fff1a8', 2);
}

function drawTree(ctx: Ctx, x: number, ground: number): void {
  ctx.fillStyle = '#7a5230';
  ctx.fillRect(x - 5, ground - 90, 10, 90);
  for (const [dx, dy, r] of [[-26, -110, 30], [24, -112, 30], [0, -140, 36], [-8, -100, 28], [14, -96, 26]] as const) {
    circlePath(ctx, x + dx, ground + dy, r);
    fillStroke(ctx, '#5aa548', 2.5);
  }
  for (const [dx, dy] of [[-14, -140], [16, -120], [-28, -112]] as const) {
    circlePath(ctx, x + dx, ground + dy, 6);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fill();
  }
  roundRectPath(ctx, x - 20, ground - 10, 40, 10, 3);
  fillStroke(ctx, '#8d8478', 2);
}

function drawBench(ctx: Ctx, x: number, ground: number): void {
  ctx.fillStyle = '#3a3f58';
  ctx.fillRect(x - 32, ground - 24, 5, 24);
  ctx.fillRect(x + 27, ground - 24, 5, 24);
  for (const y of [-26, -38, -48]) {
    roundRectPath(ctx, x - 38, ground + y, 76, 7, 2);
    fillStroke(ctx, '#b5753c', 1.8);
  }
}

function drawSign(ctx: Ctx, x: number, ground: number): void {
  ctx.fillStyle = '#7d8597';
  ctx.fillRect(x - 2.5, ground - 120, 5, 120);
  // Señal de peligro con nube: un pequeño Easter egg.
  ctx.beginPath();
  ctx.moveTo(x, ground - 158);
  ctx.lineTo(x + 26, ground - 114);
  ctx.lineTo(x - 26, ground - 114);
  ctx.closePath();
  fillStroke(ctx, '#ffffff', 2.5);
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#e63946';
  ctx.stroke();
  for (const [dx, dy, r] of [[-6, -124, 5], [1, -128, 6], [7, -123, 4.5]] as const) {
    circlePath(ctx, x + dx, ground + dy, r);
    ctx.fillStyle = '#8bd450';
    ctx.fill();
  }
}

function drawBike(ctx: Ctx, x: number, ground: number): void {
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 3;
  for (const dx of [-22, 22]) {
    circlePath(ctx, x + dx, ground - 16, 15);
    ctx.stroke();
  }
  ctx.strokeStyle = '#e63946';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(x - 22, ground - 16);
  ctx.lineTo(x - 6, ground - 40);
  ctx.lineTo(x + 14, ground - 40);
  ctx.lineTo(x + 22, ground - 16);
  ctx.moveTo(x - 6, ground - 40);
  ctx.lineTo(x + 2, ground - 16);
  ctx.lineTo(x + 14, ground - 40);
  ctx.moveTo(x + 14, ground - 40);
  ctx.lineTo(x + 12, ground - 50);
  ctx.stroke();
  roundRectPath(ctx, x - 12, ground - 46, 12, 5, 2);
  fillStroke(ctx, OUTLINE, 0);
}

function drawBin(ctx: Ctx, x: number, ground: number): void {
  roundRectPath(ctx, x - 13, ground - 44, 26, 44, 4);
  fillStroke(ctx, '#2a9d8f', 2.5);
  roundRectPath(ctx, x - 15, ground - 48, 30, 7, 3);
  fillStroke(ctx, shade('#2a9d8f', -0.25), 2);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillRect(x - 8, ground - 36, 4, 28);
}

/** Paloma de 40 × 32 con las patas en (20, 30). `frame`: 0 de pie, 1 picoteando, 2–3 volando. */
export function drawPigeon(ctx: Ctx, frame: number): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const pecking = frame === 1;
  const flying = frame >= 2;
  if (!flying) {
    ctx.strokeStyle = '#e07a8a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(18, 24);
    ctx.lineTo(17, 30);
    ctx.moveTo(23, 24);
    ctx.lineTo(24, 30);
    ctx.stroke();
  }
  // Cola y cuerpo.
  ctx.beginPath();
  ctx.moveTo(8, 18);
  ctx.lineTo(1, 14);
  ctx.lineTo(3, 21);
  ctx.closePath();
  fillStroke(ctx, '#5c6475', 1.8);
  ellipsePath(ctx, 19, 19, 12, 7.5, -0.1);
  fillStroke(ctx, '#9aa3b5', 2);
  // Ala.
  if (flying) {
    const up = frame === 2;
    ctx.beginPath();
    ctx.moveTo(14, 16);
    ctx.quadraticCurveTo(18, up ? 0 : 34, 30, up ? 2 : 30);
    ctx.lineTo(22, 17);
    ctx.closePath();
    fillStroke(ctx, '#7c8598', 1.8);
  } else {
    ellipsePath(ctx, 17, 18, 8, 4.5, -0.15);
    fillStroke(ctx, '#7c8598', 1.5);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(13, 18, 6, 1.5);
  }
  // Cabeza con cuello tornasolado.
  const hx = pecking ? 31 : 29;
  const hy = pecking ? 20 : 9;
  ellipsePath(ctx, (19 + hx) / 2 + 2, (16 + hy) / 2 + 1, 4.5, 4.5);
  ctx.fillStyle = '#6aa58e';
  ctx.fill();
  circlePath(ctx, hx, hy, 5);
  fillStroke(ctx, '#7c8598', 1.8);
  circlePath(ctx, hx + 1.5, hy - 1, 1.2);
  ctx.fillStyle = '#ff9f1c';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(hx + 4, hy);
  ctx.lineTo(hx + 8, hy + 1.5);
  ctx.lineTo(hx + 4, hy + 2);
  ctx.closePath();
  fillStroke(ctx, '#f4a261', 1);
  ctx.restore();
}
