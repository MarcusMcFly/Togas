import './styles.css';
import { GameRegistry } from './app/GameRegistry';
import { GameShell } from './app/GameShell';
import { AudioManager } from './core/services/AudioManager';
import { InputManager } from './core/services/InputManager';
import { SaveManager } from './core/services/SaveManager';
import { SettingsManager } from './core/services/SettingsManager';
import { templateGame } from './games/_template';
import { togasWalkingArround } from './games/togas-walking-arround';

// 1. Servicios compartidos (capa 2). Se crean una sola vez y se prestan a cada juego.
const save = new SaveManager();
const settings = new SettingsManager(save.scope('settings'));
const audio = new AudioManager(settings);
const input = new InputManager();

// 2. Registro de minijuegos. Añadir un juego = una línea aquí.
const registry = new GameRegistry();
registry.register(togasWalkingArround);
// La plantilla solo aparece en desarrollo, para demostrar que se puede añadir un juego sin tocar los demás.
if (import.meta.env.DEV) registry.register(templateGame);

// 3. Shell (capa 1): hub + navegación + ciclo de vida.
const root = document.getElementById('app');
if (!root) throw new Error('Falta el elemento #app en index.html');

new GameShell(root, registry, { save, settings, audio, input }, {
  title: 'Togas',
  subtitle: 'Minijuegos absurdos para jugar con una mano',
}).start();
