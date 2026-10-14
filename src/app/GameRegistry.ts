import type { GameModule } from '../core/contracts/GameModule';

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Lista central de minijuegos. Es lo único que hay que tocar para añadir uno nuevo. */
export class GameRegistry {
  private readonly modules = new Map<string, GameModule>();

  register(module: GameModule): void {
    if (!ID_PATTERN.test(module.id)) {
      throw new Error(`ID de juego no válido: "${module.id}". Usa kebab-case, p. ej. "mi-juego".`);
    }
    if (this.modules.has(module.id)) {
      throw new Error(`Ya hay un juego registrado con el ID "${module.id}".`);
    }
    this.modules.set(module.id, module);
  }

  get(id: string): GameModule | undefined {
    return this.modules.get(id);
  }

  list(): GameModule[] {
    return [...this.modules.values()];
  }
}
