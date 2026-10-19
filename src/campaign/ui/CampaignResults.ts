import type { StageRecord } from '../../core/progression/CampaignSave';
import { createButton } from '../../core/ui/Button';
import { h } from '../../core/ui/dom';
import type { MissionDefinition } from '../types';

export interface ResultsOptions {
  mission: MissionDefinition;
  record: StageRecord;
  /** Texto del motivo del fallo (si lo hay). */
  failure: string | null;
  /** El intento entero se ha perdido (puntuación a cero). */
  attemptLost: boolean;
  /** Siguiente misión jugable, si la hay. */
  next: MissionDefinition | null;
  /** Siguiente misión reservada pero sin implementar (para avisar). */
  upcoming: MissionDefinition | null;
  onNext: () => void;
  onRetry: () => void;
  onRestart: () => void;
  onMap: () => void;
}

/** Resultados de una misión (spec 9.5): desenlace, puntos y estadísticas, y qué sigue. */
export function createResults(options: ResultsOptions): HTMLElement {
  const { mission, record } = options;
  const won = record.status === 'completed';
  const change = record.earned - record.lost;
  const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n).toLocaleString('es-ES')}`;

  const headline = won ? '¡MISIÓN CUMPLIDA!' : options.attemptLost ? 'INTENTO PERDIDO' : 'MISIÓN FALLIDA';
  const scores = h('dl', { className: 'results-score' }, [
    h('div', {}, [h('dt', { text: 'Al empezar' }), h('dd', { text: record.scoreBefore.toLocaleString('es-ES') })]),
    h('div', {}, [h('dt', { text: won ? 'Cambio' : 'En la misión' }), h('dd', { className: change < 0 ? 'is-loss' : 'is-gain', text: signed(change) })]),
    h('div', {}, [h('dt', { text: won ? 'Puntos de campaña' : 'Puntos al acabar' }), h('dd', { className: 'results-score__total', text: record.scoreAfter.toLocaleString('es-ES') })]),
  ]);

  const stats = h('table', { className: 'stat-table' }, [
    h('tbody', {}, record.stats.map((row) => h('tr', {}, [h('th', { text: row.label }), h('td', { text: row.value })]))),
  ]);

  const actions = h('div', { className: 'camp-actions' });
  if (won && options.next) {
    actions.append(createButton({ label: `Siguiente: ${options.next.code} ${options.next.title}`, icon: '▶', onClick: options.onNext }));
  } else if (!won && options.attemptLost) {
    actions.append(createButton({ label: 'Empezar el capítulo de nuevo', icon: '↻', onClick: options.onRestart }));
  } else if (!won) {
    actions.append(createButton({ label: `Reintentar ${mission.code} (${record.scoreBefore.toLocaleString('es-ES')} pts)`, icon: '↻', onClick: options.onRetry }));
  }
  actions.append(createButton({ label: 'Mapa del capítulo', variant: 'secondary', onClick: options.onMap }));

  return h('section', { className: `camp-screen camp-panel results results--${won ? 'win' : 'fail'}` }, [
    h('p', { className: 'camp-kicker', text: `Misión ${mission.code} · ${mission.title}` }),
    h('h1', { className: 'camp-title results__headline', text: headline }),
    options.failure ? h('p', { className: 'camp-notice camp-notice--danger', text: options.failure }) : null,
    !won && !options.attemptLost
      ? h('p', { className: 'camp-notice', text: `Al reintentar vuelves a empezar ${mission.code} con ${record.scoreBefore.toLocaleString('es-ES')} puntos.` })
      : null,
    scores,
    stats,
    won && !options.next && options.upcoming
      ? h('p', { className: 'camp-notice', text: `Siguiente: ${options.upcoming.code} «${options.upcoming.title}». Está en desarrollo: tu puntuación queda guardada para cuando llegue.` })
      : null,
    actions,
  ]);
}
