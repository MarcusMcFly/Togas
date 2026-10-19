import { createClassroomMission, type ClassroomMissionStats } from '../../../games/togas-silent-class/mission';
import { createWalkingMission, type WalkingMissionStats } from '../../../games/togas-walking-arround/mission';
import { POLLO } from '../../characters/pollo/pollo.config';
import { describeClassroom, describeWalking } from '../../systems/MissionResultAdapter';
import { missionRunner, type ChapterDefinition } from '../../types';
import { LENTIL_COMMUTE_RULESET } from './level-1-1/walking-campaign.config';
import { SILENT_CLASS_PENALTIES, SILENT_CLASS_RULES, SILENT_CLASS_TEXTS } from './level-1-2/classroom-campaign.config';
import { RETURN_TO_BASE_NOTES } from './level-1-3/return-campaign.config';

/** Capítulo 1: la misión de Pollo (spec 5). */
export const POLLO_CHAPTER: ChapterDefinition = {
  id: 'pollo',
  number: 1,
  title: 'La misión de Pollo',
  characterId: POLLO.id,
  missions: [
    {
      id: 'pollo-1-1',
      code: '1-1',
      title: 'El trayecto de las lentejas',
      environment: 'Ciudad, de día',
      foundation: 'Togas Walking Around',
      status: 'playable',
      // Ida: solo se ganan puntos.
      scoring: { allowEarn: true, allowLose: false },
      briefing: {
        story: [
          'Pollo tiene las piernas inquietas. Y como quedarse quieto le resulta prácticamente imposible, ha decidido ir andando a la universidad.',
          'No es que vaya siempre a clase, claro. Pero hoy es distinto: hoy el destino le tiene preparado algo ridículo.',
          'Por el camino, Pollo descubrirá el increíble poder de las lentejas.',
        ],
        controls: [
          'Toca la pantalla (o pulsa ESPACIO) para saltar.',
          'Desliza hacia abajo (o pulsa ↓) para rodar bajo andamios y carteles.',
        ],
        rules: [
          'Las lentejas valen ×3. El resto de la comida, ×1.',
          'Cuando el gas se llena, Pollo se tira un pedo él solo. Elige bien qué comes y cuándo.',
          'Pedo sin nadie cerca: multiplicador +0,25 (hasta ×3) y un acelerón.',
          'Pedo con viandantes cerca: multiplicador a ×1 y una estrella de policía. Con 5, detenido.',
          'Tropezar con una valla o un andamio te quita el multiplicador.',
          'Llega a la universidad con puntos: los necesitarás en clase.',
        ],
      },
      runner: missionRunner<WalkingMissionStats>({
        gameId: 'togas-walking-arround',
        start: (context, host) => createWalkingMission(context, host, LENTIL_COMMUTE_RULESET),
        describe: (stats) => describeWalking(stats, 'Lentejas'),
        durationOf: (stats) => stats.durationSec,
      }),
    },
    {
      id: 'pollo-1-2',
      code: '1-2',
      title: 'Clase silenciosa',
      environment: 'Aula de la universidad',
      foundation: 'Togas Silent Class',
      status: 'playable',
      // La misión principal: no se gana nada, solo se protege la reserva.
      scoring: { allowEarn: false, allowLose: true },
      briefing: {
        story: [
          'La economía no es más que un invento aristocrático: un sistema innecesariamente complicado diseñado para confundir a todo el mundo. ¿Has conocido alguna vez a un economista rico? ¿Y por qué demonios un ingeniero da clase de macroeconomía?',
          'Tras abusar del poder de las lentejas, Pollo llega a clase. Solo queda un sitio: la última fila. Y al frente no hay un profesor cualquiera: es un aristócrata disfrazado de profesor mal pagado.',
          'La misión: liberar el gas acumulado, dejar K.O. a los doce compañeros con flatulencias de dibujos animados y, por último, derrotar al aristócrata. Solo entonces la ciudad estará a salvo.',
        ],
        controls: [
          'Mantén pulsado para apretar y aguantar el gas.',
          'Sin soltar, arrastra en horizontal (piernas) y en vertical (glúteos) para centrar las dos burbujas.',
          'Suelta cuando las burbujas estén en verde y el profe mire a la pizarra.',
        ],
        rules: [
          'Aquí no se gana ni un punto: tu reserva de 1-1 solo puede bajar.',
          'Soltar con el profe mirando a la clase: misión fallida al instante.',
          'Si la silla se tambalea demasiado rato, te caes y pierdes el gas (−100). Tres caídas: expulsión.',
          'Un trompetazo con el profe de espaldas cuesta −150. Cada segundo de clase, −1.',
          'Con los 12 compañeros K.O., un último pedo silencioso derrota al profe.',
        ],
      },
      runner: missionRunner<ClassroomMissionStats>({
        gameId: 'togas-silent-class',
        start: (context, host) => createClassroomMission(context, {
          host, rules: SILENT_CLASS_RULES, penalties: SILENT_CLASS_PENALTIES, texts: SILENT_CLASS_TEXTS,
        }),
        describe: describeClassroom,
        durationOf: (stats) => stats.durationSec,
      }),
    },
    {
      id: 'pollo-1-3',
      code: '1-3',
      title: 'Vuelta a la base',
      environment: RETURN_TO_BASE_NOTES.environment,
      foundation: 'Togas Walking Around (en sentido contrario)',
      status: 'planned',
      scoring: RETURN_TO_BASE_NOTES.scoring,
      briefing: {
        story: ['Tras derrotar al aristócrata disfrazado, Pollo tiene que volver a casa… de noche.'],
        controls: [],
        rules: [],
      },
    },
  ],
};
