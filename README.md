# Togas

▶ **Jugar:** https://marcusmcfly.github.io/Togas/dist/

Plataforma de minijuegos 2D para navegador. La arquitectura está organizada en capas para que se puedan añadir juegos nuevos sin tocar el núcleo. El primer minijuego es **Togas Walking arround** (ID `togas-walking-arround`).

El objetivo final es un **único fichero `.html` autoejecutable**: lo abres desde un enlace (o con doble clic) y el juego arranca. No hace falta servidor ni instalación.

> **Estado actual (v0.1.0):** el juego es jugable de principio a fin: hub → selección de personaje → partida de 90 s → resultados → repetir. Gráficos y sonidos se generan por código (ver [sección 8](#8-decisiones-respecto-a-la-spec)). El repositorio Git está inicializado (rama `main`), pero aún no tiene commits ni remoto.
>
> **Probarlo ya:** `pnpm install` y luego `pnpm dev`, o `pnpm build` y abrir `dist/index.html` con doble clic.
>
> La especificación completa está en [`docs/SPEC_01_Initial_spec.docx`](docs/SPEC_01_Initial_spec.docx).

---

## Índice

1. [El juego en 1 minuto](#1-el-juego-en-1-minuto)
2. [Cómo está pensada la arquitectura](#2-cómo-está-pensada-la-arquitectura)
3. [Estructura del proyecto](#3-estructura-del-proyecto)
4. [El contrato de un minijuego](#4-el-contrato-de-un-minijuego)
5. [Guías prácticas](#5-guías-prácticas)
6. [Assets: convenciones](#6-assets-convenciones)
7. [Cómo se genera el `.html` único](#7-cómo-se-genera-el-html-único)
8. [Decisiones respecto a la spec](#8-decisiones-respecto-a-la-spec)
9. [Hoja de ruta](#9-hoja-de-ruta)
10. [Glosario](#10-glosario)

---

## 1. El juego en 1 minuto

Es un *runner* 2D de comedia. Un estudiante de ingeniería avanza solo por una ciudad y el jugador únicamente tiene que **saltar**.

| Concepto | Resumen |
|---|---|
| Duración | Partidas de **90 segundos** |
| Control | **Una sola acción:** saltar. Tocar la pantalla, `Espacio`, `↑` o clic. Si mantienes pulsado, el salto es más alto |
| Personajes (skins) | **Poio** (1,80 m, calvo) y **Marcus** (1,72 m, poco pelo). Cambian el aspecto y los sonidos, **nunca** la jugabilidad |
| Coleccionables | Fabes, garbanzos, coliflor, lata de cerveza y refresco. Suben el **medidor de gas** y dan puntos |
| Obstáculos | Aerored y sales de fruta. Bajan el gas, pero no te quitan puntos |
| Viandantes | Pasean por la acera y reaccionan a los **pedos**: sorpresa o cabreo (con la cara ampliada en una viñeta de cómic) o salen corriendo. Cuanto más fuerte el pedo, más lejos llega y más huyen. Solo decorado; se ajusta en `config/pedestrians.config.ts` |
| Mecánica central | Cuando el gas llega a **100**, el personaje eructa o se tira un pedo de forma automática (alternando). Cada emisión sube la **intensidad**, de nivel 1 (*Tiny*) a 5 (*Legendary*) |

El ciclo de una partida es: **elegir skin → correr y saltar → recoger comida → emisiones cada vez más épicas → pantalla de resultados → repetir**.

---

## 2. Cómo está pensada la arquitectura

### La idea clave: tres capas

Una buena forma de entenderlo es pensar en una **consola de videojuegos**:

| Capa | Analogía | Ruta | Qué hace |
|---|---|---|---|
| 1. Shell | El menú de la consola | `src/app/` | Arranca la app, muestra el hub, registra los juegos y navega entre ellos |
| 2. Core | El hardware y el sistema operativo | `src/core/` | Ofrece servicios genéricos: input, audio, guardado, ajustes, eventos y UI base |
| 3. Games | Los cartuchos | `src/games/` | Cada juego tiene sus reglas, entidades, assets y configuración |

### La regla de oro: las dependencias van hacia abajo

```
   ┌──────────────────────┐
   │  Capa 1 · app/       │  conoce la lista de juegos (registro), no sus detalles
   └──────────┬───────────┘
              │ usa
   ┌──────────▼───────────┐
   │  Capa 3 · games/*    │  cada juego es una isla
   └──────────┬───────────┘
              │ usa
   ┌──────────▼───────────┐
   │  Capa 2 · core/      │  genérico, no sabe que existen "fabes" ni "pedos"
   └──────────────────────┘
```

Lo que **está prohibido** y por qué:

| ❌ Prohibido | Por qué |
|---|---|
| Que `core/` tenga lógica tipo `if (skin === "poio")` | Si el núcleo conoce un juego concreto, deja de servir para los demás |
| Que un juego importe código de otro juego | Si borras o cambias uno, se rompería el otro |
| Que `app/` conozca objetos del juego (fabes, eructos…) | El shell solo debe saber *que* hay juegos, no *cómo* funcionan |
| Valores de balance escritos dentro de la lógica | Todo lo ajustable va en `config/` para poder equilibrar el juego sin tocar código |

> 💡 **Prueba de fuego de la arquitectura:** si añadir un segundo minijuego te obliga a modificar el primero, algo está mal diseñado (criterio de aceptación AC-12).

### Capa 2 en detalle: `src/core/`

| Carpeta | Contenido | Para qué sirve |
|---|---|---|
| `contracts/` | `GameModule`, `GameContext`, `GameSession` | Las "interfaces" que todo juego debe cumplir (ver [sección 4](#4-el-contrato-de-un-minijuego)) |
| `services/` | `InputManager`, `AudioManager`, `AssetManager`, `SaveManager`, `SettingsManager`, `EventBus` | Servicios comunes. Por ejemplo, el audio respeta el mute global en todos los juegos |
| `ui/` | `Menu`, `Button`, `Overlay`, `ResponsiveLayout` | Componentes visuales reutilizables y adaptación a la pantalla |

### Dentro de un juego: `src/games/<id>/`

| Carpeta | Qué contiene | Ejemplo en Togas |
|---|---|---|
| `index.ts` | Punto de entrada: exporta el `GameModule` | Título, versión, miniatura… |
| `config/` | **Datos** de ajuste, sin lógica | Puntos de cada comida, velocidad, skins |
| `scenes/` | Escenas de Phaser | `PlayScene` |
| `entities/` | Objetos del mundo | `Player`, `Collectible`, `Obstacle` |
| `systems/` | Reglas que se ejecutan cada frame | `GasSystem`, `SpawnSystem`, `ScoreSystem`… |
| `ui/` | Interfaz propia del juego | `GameHUD`, `ResultsScreen` |
| `assets/` | Imágenes y sonidos propios | Sprites de Poio, sonidos de Marcus |

> 💡 Separar **entidades** (las *cosas*) de **sistemas** (las *reglas*) facilita los tests. Por ejemplo, `GasSystem` se puede probar con números sin dibujar nada en pantalla.

---

## 3. Estructura del proyecto

```
Togas/
├── docs/                          Especificación (GDD + TDD)
├── src/
│   ├── app/                       Capa 1: shell, registro y hub
│   ├── core/                      Capa 2: servicios compartidos
│   │   ├── contracts/
│   │   ├── services/
│   │   └── ui/
│   ├── games/                     Capa 3: un directorio por minijuego
│   │   ├── togas-walking-arround/
│   │   │   ├── index.ts           El GameModule: lo único que ve el shell
│   │   │   ├── TogasSession.ts    Crea y destruye la instancia de Phaser
│   │   │   ├── runtime.ts         Estado compartido entre escenas (skin, récord, eventos)
│   │   │   ├── config/            Todos los números del balance
│   │   │   ├── systems/           Reglas puras (sin Phaser): gas, salto, spawn, puntos…
│   │   │   ├── entities/          Lo que se ve: jugador, comida, antigases, palomas, ciudad
│   │   │   ├── scenes/            Boot → Select → Play (+ HUD) → Results
│   │   │   ├── fx/                Nubes de gas, ondas, texto cómico, cámara
│   │   │   ├── art/               Dibujo procedural (Canvas 2D) de todo el arte
│   │   │   ├── audio/             Síntesis de eructos, pedos y efectos (Web Audio)
│   │   │   ├── ui/                HUD, tema y botones
│   │   │   └── assets/            Reservado para sprites/audio en fichero (hoy vacío)
│   │   └── _template/             Juego mínimo de ejemplo para copiar
│   ├── main.ts                    Arranque: servicios + registro + shell
│   ├── styles.css                 Estilos del hub y del marco
│   └── shared-assets/{fonts,icons,ui}/   Recursos comunes (no de un juego)
├── tests/
│   ├── unit/                      Lógica aislada (gas, salto, spawn, puntos, servicios)
│   ├── integration/               Registro de juegos y plantilla
│   └── e2e/                       Reservado: la app completa en un navegador
├── index.html                     Entrada de Vite
├── vite.config.ts                 Build de un solo fichero + config de tests
├── tsconfig.json
└── package.json
```

Las carpetas aún vacías llevan un `.gitkeep`. Git no guarda directorios vacíos, así que este fichero "ancla" la carpeta. Cuando la carpeta tenga contenido real, se puede borrar.

### El recorrido de un frame

Para entender `PlayScene.update()`, este es el orden en que pasan las cosas en cada frame:

```
 entrada (toque/tecla)
        │
        ▼
 RunnerSystem ── avanza, salta, aplica gravedad
        │
        ▼
 SpawnSystem ─── crea comida y antigases por delante (justos: nunca imposibles)
        │
        ▼
 CollisionSystem ─ ¿el jugador toca algo?
        │
        ├── comida ──► ScoreSystem (+puntos) y GasSystem (+gas)
        │                                   │ ¿llega a 100?
        │                                   ▼
        │                           EmissionSystem ── ¿eructo o pedo? ¿qué variante?
        │                                   │
        │                                   ▼
        │                   sonido de la skin + EffectsDirector (nubes, ondas, cámara)
        │
        └── antigás ──► GasSystem (−gas, nunca < 0), efecto de efervescencia
        │
        ▼
 HUD (escena aparte) lee el estado y se dibuja
```

---

## 4. El contrato de un minijuego

Un **contrato** es un acuerdo: *"si tu juego expone estas propiedades y métodos, el shell sabe cargarlo, arrancarlo y cerrarlo"*. Así el shell puede manejar cualquier juego sin conocerlo por dentro.

### `GameModule`: lo que el juego declara

| Propiedad | Propósito |
|---|---|
| `id` | Identificador único y estable (`togas-walking-arround`) |
| `title` | Nombre visible en el hub |
| `version` | Versión del juego |
| `description` | Descripción corta |
| `thumbnail` | Imagen de la tarjeta en el hub |
| `supportedInputs` | Teclado, táctil, ratón |
| `preload()` | Carga los assets que necesita |
| `create(context)` | Crea una sesión de juego. Recibe el `GameContext` |
| `destroy()` | Libera todos sus recursos |

### `GameContext`: lo que el shell le da al juego

Es la "caja de herramientas" con los servicios de `core/` (audio, input, guardado…). El juego **no crea** sus propios servicios globales, los **recibe**. A esto se le llama *inyección de dependencias*.

### `GameSession`: el ciclo de vida de una partida

```
          start()            pause()
 [creada] ───────► [jugando] ───────► [pausada]
                      ▲                   │
                      └──── resume() ─────┘
                      │
                      ▼ destroy()
                 [destruida]   ← sin listeners, audio ni bucles huérfanos
```

> ⚠️ **Error típico:** olvidar quitar un listener de teclado en `destroy()`. Si entras y sales del juego 5 veces, el salto se ejecutaría 5 veces por pulsación (criterio AC-13).

---

## 5. Guías prácticas

### Añadir un minijuego nuevo

1. Copiar `src/games/_template/` dentro de `src/games/`.
2. Renombrar la carpeta con el ID del juego, en `kebab-case` (por ejemplo `mi-juego`).
3. Implementar el contrato `GameModule` en su `index.ts`.
4. Añadir sus assets y su configuración.
5. Registrarlo en el registro central (`src/app/GameRegistry.ts`).
6. Darle miniatura y metadatos para el hub.

✅ Si has tenido que tocar código de otro juego o del shell (aparte del registro), revisa el diseño.

### Añadir una skin nueva

Hoy, con arte y sonido procedurales, basta con **una entrada** en `config/skins.config.ts`:

- `look`: colores de piel, camiseta, pantalón, zapatillas, mochila, tipo de pelo y símbolo de la camiseta.
- `voice`: tono, timbre y "rugosidad" de sus eructos y pedos.
- `heightM`: altura en metros (solo cambia el tamaño del dibujo).

Las animaciones (correr, saltar, eructar…) y sus sonidos se generan solos. Si en el futuro se usan sprites y audios en fichero, irán en `assets/characters/<skin>/` y `assets/audio/<skin>/`.

En ningún caso **se toca** el controlador del jugador. Todas las skins comparten la misma caja de colisión y las mismas físicas para que el juego sea justo (criterio AC-02).

### Ajustar el balance

Todos los valores numéricos viven en `config/`. Valores iniciales de la spec:

| Parámetro | Valor | Fichero previsto |
|---|---|---|
| Duración de la partida | 90 s | `game.config.ts` |
| Velocidad inicial / máxima | 230 / 400 px/s | `game.config.ts` |
| Gas máximo | 100 | `game.config.ts` |
| Fabes / garbanzos / coliflor / cerveza / refresco | +30 / +25 / +20 / +18 / +15 gas | `collectibles.config.ts` |
| Aerored / sales de fruta | −35 / −25 gas | `collectibles.config.ts` |
| Resolución lógica | 960 × 540 | `game.config.ts` |

---

## 6. Assets: convenciones

### Audio

El audio se separa por skin, igual que los sprites:

```
assets/audio/poio/poio_burp_t01_v01.ogg
              │     │    │   │
              │     │    │   └─ variante (v01, v02…) → para que no suene siempre igual
              │     │    └───── intensidad (t01 = Tiny … t05 = Legendary)
              │     └────────── tipo: burp (eructo) | fart (pedo)
              └──────────────── skin
```

**Mínimo necesario:** 2 skins × 2 tipos × 5 intensidades = **20 clips**.

El sistema de gas **nunca** referencia "poio" ni "marcus" directamente. Pide *"el eructo de nivel 3 de la skin activa"* y el `AudioManager` resuelve qué fichero toca.

### Imágenes y marcas

- Las latas y los refrescos deben ser **ficticios, sin marcas reales**.
- "Aerored" es un producto real. Para una versión pública conviene sustituirlo por un medicamento inventado.
- Los assets de **un juego** van en `src/games/<id>/assets/`. Los que comparten todos los juegos van en `src/shared-assets/`.

---

## 7. Cómo se genera el `.html` único

**Stack propuesto:** Vite + TypeScript + Phaser 3, con el plugin `vite-plugin-singlefile`.

| Herramienta | Papel |
|---|---|
| **TypeScript** | JavaScript con tipos. Detecta errores (por ejemplo, un juego que no cumple el contrato) antes de ejecutar |
| **Phaser 3** | Motor 2D: sprites, físicas arcade, cámara, input y audio |
| **Vite** | Servidor de desarrollo con recarga instantánea y empaquetador para producción |
| **vite-plugin-singlefile** | Mete todo el JS, el CSS y los assets (en base64) **dentro** de `index.html` |

Comandos:

```bash
pnpm install          # instala dependencias (una vez, y tras cambiar package.json)
pnpm dev              # desarrollo: abre http://localhost:5173 con recarga en caliente
pnpm build            # producción: comprueba tipos y genera dist/index.html (un único fichero)
pnpm test             # ejecuta los tests una vez
pnpm test:watch       # tests en modo vigilancia mientras programas
pnpm typecheck        # solo comprobación de tipos
pnpm audit            # busca vulnerabilidades conocidas en las dependencias
```

> ⚠️ El gestor de paquetes del proyecto es **pnpm** (versión fijada en `package.json`). No uses `npm install` dentro del proyecto: crearía un segundo lockfile y saltaría las protecciones de seguridad. Para instalar pnpm (una vez, fuera del proyecto): `npm i -g pnpm@12.11.2`.

### Seguridad de dependencias

Instalar un paquete significa descargar y ejecutar código de terceros en tu ordenador. Por eso `pnpm-workspace.yaml` aplica una política básica (basada en `docs/SPEC_02_Security_pnpm.docx`):

| Ajuste | Qué protege |
|---|---|
| `minimumReleaseAge: 1440` | Solo se instalan versiones publicadas hace más de 24 h. Muchas versiones maliciosas se retiran en las primeras horas |
| `strictDepBuilds: true` | Ningún paquete ejecuta scripts de instalación (`postinstall`…) sin aprobación. Hoy ninguno lo pide |
| `blockExoticSubdeps: true` | Las dependencias indirectas no pueden venir de repos Git o URLs sueltas |
| `trustPolicy: no-downgrade` | Rechaza versiones publicadas con menos garantías que las anteriores |
| `verifyDepsBeforeRun: error` | Si `node_modules` no coincide con el lockfile, los comandos fallan en vez de reinstalar solos |
| Versiones exactas en `package.json` | Nada se actualiza sin que lo decidas tú |
| `nodeLinker: hoisted` | No es de seguridad: Windows no permite los enlaces que pnpm usa por defecto sin Modo de desarrollador |

`pnpm-lock.yaml` fija las versiones exactas de **todo** el árbol (45 paquetes) y hay que subirlo al repo.

**Excepción conocida:** `pnpm audit` avisa de `braces@3.0.3` (severidad alta, GHSA-vfj7-8cjw-p6xm, aún sin versión corregida). Llega por `vite-plugin-singlefile → micromatch`. Es un bloqueo por patrones muy anidados, y solo se ejecuta al compilar con los patrones de nuestra propia configuración: **no llega al juego publicado** y nadie externo puede aprovecharlo. Revisar cuando salga una versión corregida.

Tamaño actual de `dist/index.html`: **~1,3 MB** (~350 KB comprimido). Casi todo es Phaser; el juego en sí apenas ocupa porque no lleva imágenes ni audios.

> 💡 En modo `dev`, el hub muestra también la **plantilla** (`_template`). En el build de producción no aparece.

> 💡 **Ventaja:** en desarrollo trabajas con muchos ficheros pequeños y ordenados. Al publicar se convierten en uno solo. La modularidad del código **no se pierde** por distribuir un único fichero.
>
> ⚠️ **Coste:** los assets embebidos en base64 ocupan ~33 % más. Conviene comprimir el audio (`.ogg`) y las imágenes (sprite sheets en `.webp`/`.png` optimizados).

---

## 8. Decisiones respecto a la spec

| Cambio | Motivo |
|---|---|
| `_template` dentro de `src/games/` (no en la raíz) | Crear un juego nuevo es copiar la carpeta junto a las existentes |
| Audio separado por skin (`audio/poio/`, `audio/marcus/`) | Coherencia con la separación de sprites |
| `.gitkeep` en carpetas vacías | Git no versiona directorios vacíos |
| Objetivo de distribución principal: `.html` único | La spec lo trata como opcional. Aquí es el objetivo principal |
| **Arte procedural** (Canvas 2D) en vez de sprites en fichero | No hay ilustraciones todavía, y así el `.html` sigue siendo ligero. Cada skin genera sus animaciones a partir de su `look` en `skins.config.ts` |
| **Sonido sintetizado** (Web Audio) en vez de 20 `.ogg` | Mismo motivo. La convención `skin_tipo_tNN_vNN` se mantiene como parámetros: skin → voz, tier → intensidad, variante → semilla. Cambiar a ficheros solo toca `audio/emissionSounds.ts` |
| "Aerored" se muestra como **"Antigás Forte"** (inventado) | La spec recomienda no usar la marca real en una versión pública. El ID interno sigue siendo `aerored` |
| Carpetas extra en el juego: `art/`, `audio/`, `fx/` | Separan dibujo, síntesis y efectos visuales de la lógica |
| HUD en una **escena aparte** | Así las sacudidas de cámara mueven el mundo, pero no los marcadores |
| Botón de pausa y menú de pausa los pone **el shell** | Todos los juegos tienen pausa igual sin reprogramarla (Esc o P también pausan) |

### Nota sobre el ID `togas-walking-arround`

Se mantiene la grafía "arround" (con doble *r*) porque es el ID fijo del juego en la spec. Si se quiere corregir a "around", conviene hacerlo **antes** de escribir código. El ID se usa en el registro, en las claves de guardado (récords) y en las rutas, así que cambiarlo después rompería las puntuaciones guardadas.

---

## 9. Hoja de ruta

| Fase | Objetivo | Entregable |
|---|---|---|
| **1. Base técnica** ✅ | Vite + TS + Phaser, shell, registro, servicios, plantilla | App capaz de lanzar módulos |
| **2. Prototipo jugable** ✅ | Scroll, salto, comida, obstáculos, gas, puntos, temporizador | Partida completa |
| **3. Identidad** 🟡 | Sprites y sonidos de Poio y Marcus, selector, intensidades | Hecho con arte y sonido procedurales; faltan ilustraciones y audios "de verdad" si se quieren |
| **4. Pulido** 🟡 | Parallax, partículas, HUD responsive, ajustes, accesibilidad | Hecho lo principal; ver pendientes |
| **5. Calidad y release** 🟡 | Tests, rendimiento, navegadores, publicación | 34 tests de lógica; falta e2e y publicar |

**Criterios de aceptación cubiertos por tests automáticos:** AC-02 (skins sin física propia), AC-04, AC-05, AC-06, AC-07, AC-11 (persistencia de ajustes), AC-12 (registro de juegos) y AC-14 (un bot juega partidas enteras a velocidad máxima sin chocar nunca). Comprobados con un navegador automatizado: AC-01 (partida entera solo con Espacio), AC-08 (escritorio y móvil horizontal), AC-09 (fin a los 90 s y resultados) y AC-10 (repetir sin recargar). **Sin comprobar todavía:** AC-03 (hay que escucharlo), AC-13 (entrar y salir muchas veces) y AC-15 (jugar en silencio).

**Pendiente:**

- [ ] Primer commit y publicación en GitHub Pages (falta configurar el remoto).
- [ ] En móvil **vertical** el juego se ve pequeño (encaja 16:9 con bandas): añadir aviso "gira el móvil" o un encuadre propio.
- [ ] Tests e2e en navegador (`tests/e2e/`).
- [ ] Papeles y basura que reaccionen a la onda expansiva (la spec lo cita como opcional).
- [ ] Ilustraciones y audios grabados, si se quiere sustituir lo procedural.

---

## 10. Glosario

| Término | Significado |
|---|---|
| **Runner** | Género en el que el personaje avanza solo y el jugador esquiva o salta |
| **Skin** | Aspecto y sonidos intercambiables de un personaje, sin efecto en la jugabilidad |
| **Hub** | Pantalla principal que lista los minijuegos disponibles |
| **Parallax** | Capas de fondo que se mueven a distinta velocidad para simular profundidad |
| **Spawn** | Aparición de objetos en el escenario |
| **Pooling** | Reutilizar objetos que salen de pantalla en vez de crear otros nuevos, para ahorrar memoria |
| **Contrato / interfaz** | Lista de propiedades y métodos que un módulo se compromete a ofrecer |
| **Event Bus** | Canal de mensajes para que los módulos se comuniquen sin conocerse ("¡ha habido una emisión!") |
| **Tier** | Nivel de intensidad de una emisión (1–5) |
| **Seed / semilla** | Número que hace que la generación "aleatoria" sea repetible, útil para tests |
