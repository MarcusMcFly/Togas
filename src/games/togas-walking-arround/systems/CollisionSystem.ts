/**
 * Rectángulo en coordenadas de juego: `x` es el borde izquierdo y `y` la altura
 * del borde inferior sobre el suelo (hacia arriba).
 */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Colisión entre rectángulos alineados con los ejes (AABB). */
export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Escribe en `out` un rectángulo centrado en `centerX`, reutilizando el objeto (sin basura por frame). */
export function setRect(out: Rect, centerX: number, bottom: number, width: number, height: number): Rect {
  out.x = centerX - width / 2;
  out.y = bottom;
  out.w = width;
  out.h = height;
  return out;
}
