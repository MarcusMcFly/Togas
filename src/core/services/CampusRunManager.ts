import { campusCredits, isTransferUsable, parseTransfer, type CreditTransferRecord } from '../progression/CreditTransfer';
import { SaveScope, detectStorage, type KeyValueStore } from './SaveManager';

export interface CampusRunOptions {
  /** Orden de los juegos de la carrera (IDs). Lo decide la app, no los juegos. */
  sequence: readonly string[];
  /** Por defecto `sessionStorage`: sobrevive a recargar la página, no a cerrar la pestaña. */
  store?: KeyValueStore;
  now?: () => number;
}

export interface TransferOffer {
  sourceGameId: string;
  sourceScore: number;
  skinId: string;
}

const KEY = 'transfer';

/**
 * Une los minijuegos en la "Togas Campus Run" sin que se conozcan entre sí:
 * un juego deja una transferencia de créditos y el siguiente la consume una sola vez.
 *
 * Es una comodidad local para un jugador, no una credencial ni un sistema anti-trampas.
 */
export class CampusRunManager {
  private readonly scope: SaveScope;
  private readonly now: () => number;

  constructor(private readonly options: CampusRunOptions) {
    this.scope = new SaveScope(options.store ?? detectStorage('session'), 'togas.v1:campusRun:');
    this.now = options.now ?? Date.now;
  }

  /** ID del juego que sigue a `gameId` en la carrera, o `null` si es el último (o no participa). */
  nextGameAfter(gameId: string): string | null {
    const { sequence } = this.options;
    const index = sequence.indexOf(gameId);
    return index >= 0 && index < sequence.length - 1 ? sequence[index + 1] : null;
  }

  creditsFor(score: number): number {
    return campusCredits(score);
  }

  /** Crea (o sustituye) la transferencia hacia el siguiente juego. */
  offerTransfer(offer: TransferOffer): CreditTransferRecord | null {
    const destinationGameId = this.nextGameAfter(offer.sourceGameId);
    if (!destinationGameId) return null;
    const sourceScore = Math.max(0, Math.floor(offer.sourceScore));
    const record: CreditTransferRecord = {
      sourceGameId: offer.sourceGameId,
      destinationGameId,
      sourceScore,
      credits: campusCredits(sourceScore),
      skinId: offer.skinId,
      createdAt: this.now(),
      consumed: false,
    };
    this.scope.set(KEY, record);
    return record;
  }

  /** La transferencia pendiente para `destinationGameId`, sin gastarla. */
  peekTransfer(destinationGameId: string): CreditTransferRecord | null {
    const record = parseTransfer(this.scope.get<unknown>(KEY, null));
    if (!record) return null;
    return isTransferUsable(record, destinationGameId, this.now()) ? record : null;
  }

  /** Gasta la transferencia: a partir de aquí ya no se puede volver a usar. */
  consumeTransfer(destinationGameId: string): CreditTransferRecord | null {
    const record = this.peekTransfer(destinationGameId);
    if (!record) return null;
    const consumed = { ...record, consumed: true };
    this.scope.set(KEY, consumed);
    return consumed;
  }

  /** Descarta cualquier transferencia pendiente (p. ej. al rechazar la continuación). */
  clear(): void {
    this.scope.remove(KEY);
  }
}
