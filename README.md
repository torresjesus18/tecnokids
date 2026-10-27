# TecnoKids

Plataforma educativa web para niños de 7 a 12 años. Enseña **para qué sirve cada pieza de un computador** (procesador, memoria, tarjeta gráfica y almacenamiento) con una idea central: *el niño arma su PC y lo prueba jugando; si una pieza no alcanza, el juego va con tirones o se cierra*. Con las monedas que gana mejora sus piezas y vuelve a probar.

Proyecto final de **Diseño de Sitios Web** · Ingeniería de Software.

## Tecnologías
- **Frontend:** HTML5, CSS3, Bootstrap 5, JavaScript (sin frameworks), Canvas 2D para los juegos, Web Speech API (narrador), Web Audio / `Audio` (música y efectos).
- **Backend:** Node.js + Express, API REST, sesiones con `express-session`.
- **Base de datos:** PostgreSQL con el paquete `pg`.
- **Seguridad de contraseñas:** `bcryptjs`.

## Instalación

1. **Crear la base de datos** (una sola vez), en pgAdmin (Query Tool) o `psql`:

        CREATE DATABASE tecnokids;

2. **Configurar el entorno.** Copia `.env.example` a `.env` y completa tus datos (la contraseña de PostgreSQL y una frase larga y aleatoria para `SESSION_SECRET`). El archivo `.env` no se sube al repositorio.

3. **Instalar y arrancar:**

        npm install
        npm run db:init
        npm start

   `npm run db:init` ejecuta solo `sql/schema.sql`. Después, **en una base nueva**, ejecuta en pgAdmin los siguientes archivos **en este orden** (todos se pueden repetir sin romper datos):

   | Orden | Archivo | Qué agrega |
   |---|---|---|
   | 1 | `sql/migracion-juegos.sql` | Monedas, PC del jugador, partidas, dificultad hasta 4 |
   | 2 | `sql/migracion-ruleta.sql` | Giro gratis de la Ruleta Tecno |
   | 3 | `sql/migracion-rom.sql` | Pieza de almacenamiento (ROM) |
   | 4 | `sql/migracion-nuevos-juegos.sql` | Organizador de Disco y Laberinto de Datos |

4. Abre **http://localhost:3000**.

`npm test` ejecuta las pruebas de la lógica del juego (no necesita base de datos).

## Publicar gratis con Render y Neon

Render Free puede suspender el servidor tras un período sin actividad; el primer acceso después de dormir puede tardar. Neon aloja PostgreSQL y no se usa la base de datos de Render, cuyo plan gratuito expira.

1. Crea una base de datos en Neon y copia su **connection string**. Debe incluir `sslmode=require`; no publiques ni subas esa URL.
2. Sube el proyecto a GitHub sin `.env` (está excluido por `.gitignore`).
3. En Render, crea un **Blueprint** desde el repositorio. `render.yaml` configura el servicio web gratuito y deja `DATABASE_URL` para ingresarla como secreto.
4. En el servicio web de Render, abre **Environment** y agrega `DATABASE_URL` con la URL de Neon. Confirma también `SESSION_SECRET`; Render puede generarla desde el Blueprint. Guarda los cambios.
5. Inicializa la base vacía en Neon ejecutando el contenido de estos archivos en su **SQL Editor**, en este orden:
   1. `sql/schema.sql`
   2. `sql/migracion-juegos.sql`
   3. `sql/migracion-ruleta.sql`
   4. `sql/migracion-rom.sql`
   5. `sql/migracion-nuevos-juegos.sql`
6. Despliega y abre la URL pública del servicio. `/healthz` debe responder `ok`.

La aplicación toma el puerto de `PORT`, confía en el proxy HTTPS de Render y guarda las sesiones en PostgreSQL. Como la base empieza vacía, no se importan usuarios ni avances de pruebas.

## Los juegos

Cada juego tiene tres dificultades (Fácil, Medio, Difícil) que cambian el reto y multiplican las monedas ganadas (×1, ×1,15 y ×1,35). Cada uno exige un nivel mínimo y recomendado de cada pieza (niveles del 1 al 4):

| Juego | Idea | Mínimo (CPU/RAM/GPU/ROM) | Recomendado |
|---|---|---|---|
| 🏎️ Carrera Cósmica | Carrera contra dos robots | 1/1/1/1 | 2/2/2/2 |
| 🧲 La Caza de Chips | Atrapar y clasificar componentes que caen | 2/1/1/1 | 2/2/2/2 |
| 🚀 Defensa Galáctica | Defender la base en tres oleadas | 2/2/2/1 | 3/3/3/2 |
| 🛡️ Defensa del Sistema | Proteger la CPU de los virus | 2/2/2/1 | 3/3/3/2 |
| 💾 El Organizador de Disco | Acomodar bloques de archivos y liberar espacio | 1/1/1/1 | 2/2/1/2 |
| 🧩 Laberinto de Datos | Guiar a Byte, recoger paquetes y evitar virus | 1/1/1/1 | 2/2/2/2 |

## Piezas del PC

Cada jugador empieza con las piezas de nivel 1 (gratis) y compra las demás con monedas.

| Nivel | Procesador | Memoria RAM | Tarjeta gráfica | Almacenamiento (ROM) |
|---|---|---|---|---|
| 1 | Chispa · 2 núcleos, 2.0 GHz (gratis) | Gota · 2 GB (gratis) | Gráficos Básicos · integrados (gratis) | Semilla · 32 GB (gratis) |
| 2 | Rayo · 4 núcleos, 3.0 GHz · 🪙120 | Río · 4 GB · 🪙100 | Brisa · 2 GB · 🪙150 | Archivo · 64 GB · 🪙120 |
| 3 | Cometa · 6 núcleos, 3.6 GHz · 🪙300 | Lago · 8 GB · 🪙250 | Turbo · 4 GB · 🪙350 | Biblioteca · 128 GB · 🪙300 |
| 4 | Nova · 8 núcleos, 4.2 GHz · 🪙600 | Océano · 16 GB · 🪙500 | Mega · 8 GB · 🪙700 | Universo · 256 GB · 🪙600 |

## Cómo funciona la simulación

Al iniciar una partida, el **servidor** compara el nivel de cada pieza equipada con los requisitos del juego y genera un *perfil de rendimiento* que el navegador aplica al juego: una pieza por debajo del mínimo provoca fallos (por ejemplo, poca memoria cierra el juego y un procesador lento lo congela), una pieza entre el mínimo y el recomendado produce tirones, y con las piezas recomendadas todo va fluido. Al terminar, el niño ve qué pieza causó qué efecto y qué le conviene mejorar. Es una **simulación educativa con reglas fijas**, no una medición del computador real.

## Economía y recompensas
- **Monedas:** se calculan en el servidor (`RewardManager`) según el resultado de cada juego (en la carrera, por ejemplo, 60, 35 o 15 monedas base según el puesto) y la dificultad. Las partidas demasiado cortas pagan casi nada.
- **Nivel:** sube con la experiencia; cada nivel pide más puntos que el anterior (nivel × 150).
- **Insignias:** por logros (primera partida, campeón, defensor, PC ideal, primera compra, etc.).
- **Ruleta Tecno:** un giro gratis cada 2 horas; los giros extra cuestan 20 monedas. Los premios van de 5 a 80 monedas y el reparto está calculado para que, en promedio, un giro pagado devuelva menos de lo que cuesta.

## Estructura del proyecto

    server.js                  Arranque, sesiones, archivos estáticos
    src/routes.js              API REST
    src/ProgressService.js     Lógica con base de datos (compras, partidas, ruleta) y transacciones
    src/game/data.js           Catálogo de piezas y juegos
    src/game/ComputerSimulator.js   Perfil de rendimiento según las piezas
    src/game/RewardManager.js       Monedas e insignias
    src/game/PlayerProgress.js      Nivel y experiencia
    sql/                       Esquema y migraciones
    public/js/games.js         Motor de los juegos (Canvas)
    public/js/app.js           Pantallas y navegación
    public/js/soundManager.js, speechManager.js, byteAssistant.js, spaceEffects.js
    public/img, public/audio   Portadas y sonido

## Programación orientada a objetos

- **`BaseGame`** (clase base) concentra lo común de los juegos: bucle, límite de FPS, tirones, cierre por memoria llena, monitor de CPU/RAM/GPU y efectos. De ella heredan `RaceGame`, `CatcherGame`, `DefenseGame`, `GuardianGame`, `DiskOrganizerGame` y `DataMazeGame`, que solo definen su propia lógica (`update` y `render`). Esto es **herencia y polimorfismo** con una ventaja real: el rendimiento del PC se aplica igual a todos los juegos.
- **`ComputerSimulator`**: convierte las piezas del jugador en un perfil de rendimiento.
- **`RewardManager`**: calcula monedas e insignias.
- **`PlayerProgress`**: representa y calcula el nivel y la experiencia.
- **`ProgressService`**: único punto de acceso a la base de datos para el progreso (encapsula las transacciones).

## API REST (prefijo `/api`)

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/auth/register` | Crear cuenta (alias, correo, contraseña) |
| POST | `/auth/login` | Iniciar sesión |
| POST | `/auth/logout` | Cerrar sesión |
| GET | `/auth/me` | Usuario actual |
| GET | `/progress` | Nivel, monedas, juegos, insignias e historial |
| GET | `/pc` | Piezas, PC equipado y estado en cada juego |
| POST | `/shop/buy` | Comprar una pieza |
| POST | `/pc/equip` | Cambiar las piezas puestas |
| POST | `/games/start` | Iniciar una partida (juego y dificultad) |
| POST | `/games/finish` | Terminar la partida y recibir recompensas |
| GET | `/roulette` | Estado de la ruleta |
| POST | `/roulette/spin` | Girar la ruleta |

Las rutas privadas exigen sesión y cada consulta usa el id del usuario autenticado, así que un jugador no puede ver ni modificar el progreso de otro.

## Base de datos (PostgreSQL)

| Tabla | Contenido |
|---|---|
| `users` | Alias, correo y hash de la contraseña |
| `player_progress` | Puntos, nivel, monedas y último giro gratis |
| `missions` | Catálogo de juegos (con campo `active`) |
| `mission_attempts` | Historial de intentos con puntaje y resultado |
| `achievements` / `user_achievements` | Insignias y las que desbloqueó cada jugador |
| `user_pc` | Piezas actualmente puestas (CPU, RAM, GPU, ROM) |
| `user_components` | Piezas que el jugador ya compró |
| `game_sessions` | Partidas iniciadas, con su perfil y monedas pagadas |

Hay claves foráneas con borrado en cascada, restricciones de unicidad (alias y correo) y un índice sobre los intentos por usuario y misión.

## Seguridad implementada
- Contraseñas con **bcrypt** (nunca en texto plano).
- **Consultas parametrizadas** (sin concatenar datos del usuario en el SQL).
- Sesión en cookie `httpOnly` y `sameSite=lax` (`secure` en producción); la sesión se regenera al iniciar sesión.
- **El servidor decide las monedas:** el navegador solo reporta el resultado. Cada partida se abre en el servidor, solo puede cerrarse una vez, y si el perfil indicaba que el juego se cerraba por falta de memoria, el servidor no paga una victoria.
- Compras, partidas y ruleta usan **transacciones** con bloqueo de fila para evitar dobles cobros.
- Privacidad: solo se pide alias, correo y contraseña.

## Cómo verificar
1. Crea un jugador ("Soy nuevo") y revisa en pgAdmin que `users` guarde la contraseña como hash.
2. Juega la Carrera con el PC inicial: debe ir con tirones. Gana monedas, compra una pieza en **Mi PC** y vuelve a jugar.
3. Revisa `game_sessions`, `mission_attempts` y `user_components`.
4. Comprueba la ruleta: el primer giro es gratis, cada cuenta nueva recibe 20 monedas iniciales y los siguientes giros cuestan 20 monedas; el próximo giro gratis queda disponible en 2 horas.
5. Cierra sesión, reinicia el servidor y entra otra vez: el progreso sigue ahí.
6. Crea un segundo usuario: empieza con 20 monedas de bienvenida y las piezas gratuitas.

## Limitaciones conocidas
- Render Free puede dormir el servidor cuando no recibe tráfico; la base de datos Neon conserva los datos y las sesiones.
- El resultado de cada juego (puesto, oleadas, etc.) lo reporta el navegador; el servidor limita lo que se puede ganar, pero un usuario técnico podría falsear un resultado. Para un prototipo educativo es un riesgo aceptado.
- No hay límite de intentos de inicio de sesión ni recuperación de contraseña.
- La música y los efectos requieren los archivos `.mp3` en `public/audio/`.