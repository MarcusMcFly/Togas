import type Phaser from 'phaser';
import { CHARACTER_CANVAS } from '../art/character';
import { PERSON_CANVAS } from '../art/pedestrian';
import { ART_SCALE, charTex, pedTex, pedWalkAnim } from '../art/textures';
import { GAME_CONFIG } from '../config/game.config';
import { POLICE_LOOKS } from '../config/pedestrians.config';
import { DEPTH } from '../ui/theme';

/**
 * Detención cómica: dos agentes (ficticios) llegan desde los lados, se plantan junto al
 * protagonista y se lo llevan andando fuera de la pantalla. Solo es una animación.
 */
export class PoliceEscort {
  constructor(private readonly scene: Phaser.Scene) {}

  run(player: Phaser.GameObjects.Sprite, skinId: string, reducedMotion: boolean, onDone: () => void): void {
    const scene = this.scene;
    const ground = GAME_CONFIG.groundY;
    const width = GAME_CONFIG.view.width;
    const make = (index: number, x: number) => {
      const look = POLICE_LOOKS[index];
      return scene.add
        .sprite(x, ground, pedTex(look.id, 'walk0'))
        .setOrigin(PERSON_CANVAS.feetX / PERSON_CANVAS.width, PERSON_CANVAS.feetY / PERSON_CANVAS.height)
        .setScale(look.scale / ART_SCALE)
        .setDepth(DEPTH.player + 1)
        .setFlipX(x > player.x)
        .play(pedWalkAnim(look.id));
    };
    const left = make(0, -60);
    const right = make(1, width + 60);
    player.anims.stop();
    player.setTexture(charTex(skinId, 'hit'));
    player.setOrigin(CHARACTER_CANVAS.feetX / CHARACTER_CANVAS.width, CHARACTER_CANVAS.feetY / CHARACTER_CANVAS.height);

    const approach = reducedMotion ? 500 : 900;
    scene.tweens.add({ targets: left, x: player.x - 44, duration: approach, ease: 'Sine.easeOut' });
    scene.tweens.add({
      targets: right, x: player.x + 44, duration: approach, ease: 'Sine.easeOut',
      onComplete: () => {
        for (const [officer, index] of [[left, 0], [right, 1]] as const) {
          officer.stop();
          officer.setTexture(pedTex(POLICE_LOOKS[index].id, 'angry'));
        }
        scene.time.delayedCall(650, () => this.escort([left, right], player, onDone));
      },
    });
  }

  private escort(officers: Phaser.GameObjects.Sprite[], player: Phaser.GameObjects.Sprite, onDone: () => void): void {
    const scene = this.scene;
    officers.forEach((officer, i) => officer.setFlipX(true).play(pedWalkAnim(POLICE_LOOKS[i].id)));
    player.setFlipX(true);
    const targets = [...officers, player];
    scene.tweens.add({ targets, x: '-=760', duration: 2600, ease: 'Linear', onComplete: onDone });
    scene.tweens.add({ targets: player, y: player.y - 4, duration: 160, yoyo: true, repeat: 7 });
  }
}
