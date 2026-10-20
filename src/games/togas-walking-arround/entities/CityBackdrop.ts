import type Phaser from 'phaser';
import { CITY_LAYERS, TILE_WIDTH } from '../art/city';
import { ART_SCALE, TEX, cityTex } from '../art/textures';
import { GAME_CONFIG } from '../config/game.config';
import { DEPTH } from '../ui/theme';

interface ParallaxLayer {
  images: [Phaser.GameObjects.Image, Phaser.GameObjects.Image];
  /** Fracción de la velocidad del suelo a la que se mueve la capa. */
  factor: number;
  /** Desplazamiento propio por segundo (las nubes se mueven aunque el jugador esté quieto). */
  drift: number;
}

export interface BackdropOptions {
  night: boolean;
  /** Se avanza hacia la izquierda: la ciudad se desplaza hacia la derecha. */
  reversed: boolean;
}

/**
 * Ciudad con parallax: cada capa son dos imágenes iguales puestas una tras otra
 * que se recolocan al salir de pantalla. Cuanto más lejos, más despacio se mueve.
 * El arte no se refleja al ir hacia la izquierda (los rótulos se leerían al revés):
 * solo cambia el sentido del desplazamiento.
 */
export class CityBackdrop {
  private readonly layers: ParallaxLayer[] = [];
  private readonly reversed: boolean;

  constructor(scene: Phaser.Scene, options: BackdropOptions = { night: false, reversed: false }) {
    const ground = GAME_CONFIG.groundY;
    const key = (base: string) => cityTex(base, options.night);
    this.reversed = options.reversed;
    scene.add.image(0, 0, key(TEX.sky)).setOrigin(0).setScale(1 / ART_SCALE).setDepth(DEPTH.sky);
    this.addLayer(scene, key(TEX.clouds), 16, 0.04, 6, DEPTH.clouds);
    this.addLayer(scene, key(TEX.skyline), 330 - CITY_LAYERS.skyline.height, 0.12, 0, DEPTH.skyline);
    this.addLayer(scene, key(TEX.buildings), ground - CITY_LAYERS.buildings.height, 0.45, 0, DEPTH.buildings);
    this.addLayer(scene, key(TEX.street), ground - CITY_LAYERS.street.sidewalkY, 1, 0, DEPTH.street);
  }

  /** @param distance distancia recorrida por el jugador @param time segundos (para la deriva de nubes) */
  setScroll(distance: number, time = 0): void {
    for (const layer of this.layers) {
      const offset = (((distance * layer.factor + time * layer.drift) % TILE_WIDTH) + TILE_WIDTH) % TILE_WIDTH;
      // Hacia la izquierda la ciudad avanza hacia la derecha: el mosaico se recoloca al revés.
      const start = this.reversed ? offset - TILE_WIDTH : -offset;
      layer.images[0].x = start;
      layer.images[1].x = start + TILE_WIDTH;
    }
  }

  private addLayer(scene: Phaser.Scene, key: string, top: number, factor: number, drift: number, depth: number): void {
    const make = (x: number) => scene.add.image(x, top, key).setOrigin(0).setScale(1 / ART_SCALE).setDepth(depth);
    this.layers.push({ images: [make(0), make(TILE_WIDTH)], factor, drift });
  }
}
