import { createButton } from '../../core/ui/Button';
import { h } from '../../core/ui/dom';
import type { ChapterSummary } from '../CampaignManager';
import { duration } from '../systems/MissionResultAdapter';
import type { MissionNode, NodeState } from '../systems/MissionProgressSystem';
import type { ChapterDefinition, MissionDefinition } from '../types';

const STATE_LABELS: Record<NodeState, string> = {
  locked: '🔒 Bloqueada',
  available: '▶ Disponible',
  inProgress: '↻ En curso',
  completed: '✓ Completada',
  notImplemented: '🚧 Próximamente',
};

/** Acción principal del mapa, según el estado del intento. */
export type MapAction =
  | { kind: 'start'; mission: MissionDefinition; continuing: boolean }
  | { kind: 'retry'; mission: MissionDefinition; reason: string; score: number }
  | { kind: 'restart'; reason: string }
  | { kind: 'done'; next: MissionDefinition | null };

export interface ChapterMapOptions {
  chapter: ChapterDefinition;
  inDevelopment: boolean;
  nodes: readonly MissionNode[];
  summary: ChapterSummary | null;
  action: MapAction;
  onStart: () => void;
  onRetry: () => void;
  onRestart: () => void;
  onBack: () => void;
  onExit: () => void;
}

/** Mapa del capítulo (spec 9.4): tres nodos conectados con su estado y la acción que toca. */
export function createChapterMap(options: ChapterMapOptions): HTMLElement {
  const { chapter, summary, action } = options;
  const nodes = h('ol', { className: 'chapter-map' }, options.nodes.map(({ mission, state }) =>
    h('li', { className: `mission-node mission-node--${state}` }, [
      h('span', { className: 'mission-node__code', text: mission.code }),
      h('div', { className: 'mission-node__body' }, [
        h('strong', { className: 'mission-node__title', text: mission.title }),
        h('span', { className: 'mission-node__meta', text: `${mission.environment} · ${mission.foundation}` }),
      ]),
      h('span', { className: 'mission-node__state', text: STATE_LABELS[state] }),
    ])));

  const actions = h('div', { className: 'camp-actions' });
  let notice: HTMLElement | null = null;
  switch (action.kind) {
    case 'start':
      actions.append(createButton({
        label: `${action.continuing ? 'Continuar' : 'Empezar'}: ${action.mission.code} ${action.mission.title}`,
        icon: '▶',
        onClick: options.onStart,
      }));
      break;
    case 'retry':
      notice = h('p', { className: 'camp-notice camp-notice--warn', text: `Misión ${action.mission.code} fallida. ${action.reason}` });
      actions.append(
        createButton({ label: `Reintentar ${action.mission.code} (${action.score.toLocaleString('es-ES')} pts)`, icon: '↻', onClick: options.onRetry }),
        createButton({ label: 'Empezar el capítulo de nuevo', variant: 'secondary', onClick: options.onRestart }),
      );
      break;
    case 'restart':
      notice = h('p', { className: 'camp-notice camp-notice--danger', text: `Intento perdido. ${action.reason}` });
      actions.append(createButton({ label: 'Empezar el capítulo de nuevo', icon: '↻', onClick: options.onRestart }));
      break;
    case 'done':
      notice = h('p', {
        className: 'camp-notice',
        text: action.next
          ? `¡Misiones jugables superadas! ${action.next.code} «${action.next.title}» está en desarrollo y llegará pronto.`
          : '¡Capítulo completado!',
      });
      actions.append(createButton({ label: 'Rejugar el capítulo', icon: '↻', variant: 'secondary', onClick: options.onRestart }));
      break;
  }

  const stat = (label: string, value: string, className?: string) =>
    h('div', { className: 'chapter-stats__item' }, [h('dt', { text: label }), h('dd', { className, text: value })]);
  const stats = summary
    ? h('dl', { className: 'chapter-stats' }, [
      stat('Puntos de campaña', summary.totalScore.toLocaleString('es-ES'), 'chapter-stats__score'),
      stat('Tiempo jugado', duration(summary.durationSec)),
      stat('Reintentos', String(summary.retries)),
      ...chapter.missions.flatMap((m) => {
        const entry = summary.ledger[m.id];
        if (!entry) return [];
        const change = entry.earned - entry.lost;
        return [stat(`Nivel ${m.code}`, `${change >= 0 ? '+' : '−'}${Math.abs(change).toLocaleString('es-ES')}`)];
      }),
    ])
    : null;

  return h('section', { className: 'camp-screen camp-panel' }, [
    h('header', { className: 'camp-header' }, [
      createButton({ label: 'Héroes', icon: '←', variant: 'ghost', onClick: options.onBack }),
      createButton({ label: 'Hub', icon: '⌂', variant: 'ghost', onClick: options.onExit }),
    ]),
    h('p', { className: 'camp-kicker', text: `Capítulo ${chapter.number}${options.inDevelopment ? ' · En desarrollo' : ''}` }),
    h('h1', { className: 'camp-title', text: chapter.title }),
    nodes,
    stats,
    notice,
    actions,
  ]);
}

export interface BriefingOptions {
  mission: MissionDefinition;
  startingScore: number;
  onStart: () => void;
  onBack: () => void;
}

/** Historia, controles y reglas de la misión antes de empezar. */
export function createBriefing(options: BriefingOptions): HTMLElement {
  const { mission } = options;
  const list = (title: string, items: readonly string[]) => items.length
    ? h('section', { className: 'briefing__block' }, [
      h('h2', { className: 'briefing__heading', text: title }),
      h('ul', { className: 'briefing__list' }, items.map((item) => h('li', { text: item }))),
    ])
    : null;
  const scoring = mission.scoring.allowEarn && !mission.scoring.allowLose
    ? 'En esta misión solo se ganan puntos.'
    : !mission.scoring.allowEarn && mission.scoring.allowLose
      ? 'En esta misión no se gana nada: solo puedes perder puntos.'
      : 'En esta misión se pueden ganar y perder puntos.';

  return h('section', { className: 'camp-screen camp-panel briefing' }, [
    h('header', { className: 'camp-header' }, [
      createButton({ label: 'Mapa', icon: '←', variant: 'ghost', onClick: options.onBack }),
    ]),
    h('p', { className: 'camp-kicker', text: `Misión ${mission.code} · ${mission.environment}` }),
    h('h1', { className: 'camp-title', text: mission.title }),
    h('div', { className: 'briefing__story' }, mission.briefing.story.map((p) => h('p', { text: p }))),
    h('p', { className: 'briefing__score' }, [
      h('span', { text: 'Puntos de campaña al empezar: ' }),
      h('strong', { text: options.startingScore.toLocaleString('es-ES') }),
      h('span', { className: 'briefing__hint', text: ` · ${scoring}` }),
    ]),
    list('Controles (una sola mano)', mission.briefing.controls),
    list('Reglas', mission.briefing.rules),
    h('div', { className: 'camp-actions' }, [
      createButton({ label: '¡Empezar misión!', icon: '▶', onClick: options.onStart }),
    ]),
  ]);
}
