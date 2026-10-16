import type Phaser from 'phaser';

/**
 * Dibuja una textura con Canvas 2D a `resolution` píxeles por unidad lógica.
 * Muéstrala luego con `setScale(1 / resolution)`. Si la clave ya existe, no hace nada.
 */
export function paintTexture(
  textures: Phaser.Textures.TextureManager,
  key: string,
  width: number,
  height: number,
  resolution: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): void {
  if (textures.exists(key)) return;
  const texture = textures.createCanvas(key, Math.ceil(width * resolution), Math.ceil(height * resolution));
  if (!texture) throw new Error(`No se pudo crear la textura ${key}`);
  const ctx = texture.getContext();
  ctx.save();
  ctx.scale(resolution, resolution);
  draw(ctx);
  ctx.restore();
  texture.refresh();
}
