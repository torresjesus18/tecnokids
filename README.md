# TecnoKids

Plataforma educativa para niños (7–12 años): minijuegos y un simulador de computadores.
Node.js + Express + PostgreSQL + Bootstrap 5. Sin frameworks de frontend.

## 1. Crear la base de datos (una sola vez)
En pgAdmin (Query Tool) o en `psql`:

    CREATE DATABASE tecnokids;

## 2. Configurar
    copy .env.example .env      (Windows)
Abre `.env` y escribe tu contraseña de PostgreSQL en `PGPASSWORD` y una frase larga en `SESSION_SECRET`.

## 3. Instalar, inicializar y arrancar
    npm install
    npm run db:setup    (crea tablas, misiones y aplica las migraciones pendientes)
    npm test            (pruebas de la lógica del juego, no necesitan base de datos)
    npm start

Abre http://localhost:3000

`npm run db:init` sigue disponible para crear solo el esquema base. `npm run db:setup` es el comando completo e idempotente que se usa también al desplegar.

## Publicar en Render
El archivo `render.yaml` configura un servidor Node.js y una base PostgreSQL persistente. Para publicarlo:
1. Sube este proyecto a un repositorio de GitHub. No subas `.env` ni compartas sus claves; `.env` está excluido por `.gitignore`.
2. En Render, crea un **Blueprint** conectado al repositorio y confirma los servicios y el costo del plan siempre activo.
3. Render ejecuta las migraciones pendientes antes de cada despliegue y genera `SESSION_SECRET` automáticamente. La URL pública aparece en el panel del servicio.

El servicio incluye una ruta `/healthz` para comprobar que el servidor y PostgreSQL estén disponibles. La base alojada empieza vacía; los usuarios y el progreso que existan solo en tu base local no se copian automáticamente.

## Cómo verificar
1. Pestaña "Soy nuevo": crea un jugador. Revisa en pgAdmin la tabla `users` (la contraseña aparece como hash).
2. Juega el Quiz y arma un PC. Revisa `mission_attempts` y `player_progress`.
3. Repite la misma misión con el mismo puntaje: los puntos NO suben (solo se premia superar tu mejor marca).
4. Cierra sesión, reinicia el servidor y entra de nuevo: el progreso sigue ahí.
5. Crea un segundo usuario: su progreso empieza en cero (cada consulta usa el id de la sesión).

## Estructura
- `server.js`: arranque, sesiones, archivos estáticos.
- `src/routes.js`: API REST (auth, progreso, quiz, simulador).
- `src/game/`: clases POO — `QuizGame`, `ComputerSimulator`, `RewardManager`, `PlayerProgress` (+ datos en `data.js`).
- `src/ProgressService.js`: persistencia con transacción (intento + puntos + insignias).
- `sql/schema.sql` y `sql/migracion-*.sql`: tablas, restricciones, índice, datos iniciales y cambios de versión. `npm run db:setup` las aplica en orden y registra las ya ejecutadas en `schema_migrations`.
- `public/`: HTML, CSS y JS del navegador.

## Seguridad implementada
bcrypt para contraseñas · consultas parametrizadas · sesión en cookie httpOnly · rutas privadas con middleware ·
el servidor calcula el puntaje (el navegador solo envía respuestas/componentes) · validación en backend ·
no se piden datos personales (solo alias, correo y contraseña).

## Limitaciones conocidas
- No hay límite de intentos de login ni recuperación de contraseña.
