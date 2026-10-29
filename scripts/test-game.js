// Pruebas de lógica sin PostgreSQL: perfiles de PC, recompensas y motores Canvas.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parts, starter, games } = require('../src/game/data');
const ComputerSimulator = require('../src/game/ComputerSimulator');
const RewardManager = require('../src/game/RewardManager');
const PlayerProgress = require('../src/game/PlayerProgress');
const { BaseGame, RaceGame, CatcherGame, DiskOrganizerGame, DataMazeGame, AssemblyWorkshopGame, GpuRenderGame } = require('../public/js/games');
const ProgressService = require('../src/ProgressService');
const sim = new ComputerSimulator(parts, games), r = new RewardManager();
const best = { cpu: 'cpu4', ram: 'ram4', gpu: 'gpu4', rom: 'rom4' };

// Rendimiento simulado por hardware y pagos básicos por juego.
const a = sim.profile('carrera', starter);
assert.strictEqual(a.status, 'limited'); assert.strictEqual(a.fps, 30); assert.strictEqual(a.crashAfterSec, null);
const b = sim.profile('defensa', starter);
assert.strictEqual(b.status, 'fail'); assert.strictEqual(b.crashAfterSec, 14); assert.strictEqual(b.quality, 'baja');
const c = sim.profile('defensa', best);
assert.strictEqual(c.status, 'ok'); assert.strictEqual(c.fps, 60); assert.strictEqual(c.hitchPerMin, 0);

assert.strictEqual(r.coinsFor('carrera', { position: 1 }, c, 30, games.carrera), 70);
assert.strictEqual(r.coinsFor('carrera', { position: 1 }, a, 30, games.carrera), 60);
assert.strictEqual(r.coinsFor('carrera', { position: 1 }, a, 3, games.carrera), 5);   // demasiado rápido: sospechoso
assert.strictEqual(r.coinsFor('defensa', { crashed: true }, b, 14, games.defensa), 5);
assert.strictEqual(r.coinsFor('defensa', { waves: 3, won: true }, c, 60, games.defensa), 60);
// Atrapa el Componente: las monedas salen del puntaje (0..100) que reporta el juego.
assert.strictEqual(r.coinsFor('clasificador', { score: 100 }, b, 40, games.clasificador), 70);
assert.strictEqual(r.coinsFor('clasificador', { score: 50 }, b, 40, games.clasificador), 35);
assert.strictEqual(r.coinsFor('clasificador', { score: 100 }, b, 5, games.clasificador), 5);   // partida muy corta
// Defensa del Sistema: como Defensa Galáctica, paga por oleadas superadas.
assert.strictEqual(r.coinsFor('ciber-guardian', { waves: 3, won: true }, c, 60, games['ciber-guardian']), 60);
assert.strictEqual(r.coinsFor('ciber-guardian', { waves: 1, won: false }, c, 60, games['ciber-guardian']), 10);
assert.strictEqual(sim.profile('ciber-guardian', starter).status, 'fail');
for (const game of ['organizador-disco', 'laberinto-datos']) {
  assert.notStrictEqual(sim.profile(game, starter).status, 'fail');
  assert.strictEqual(sim.profile(game, best).status, 'ok');
  assert.ok(r.coinsFor(game, { score: 100 }, sim.profile(game, best), 45, games[game]) > 0);
}
assert.strictEqual(games['organizador-disco'].minSeconds, 20);
assert.strictEqual(games['taller-ensamblaje'].minSeconds, 12);
assert.deepStrictEqual(games['taller-ensamblaje'].timeLimitSec, { facil: 120, medio: 90, dificil: 60 });
assert.strictEqual(games['renderizado-gpu'].rating, 4);
assert.strictEqual(games['renderizado-gpu'].badge, '⚡ Carrera de Rendimiento');
assert.strictEqual(games['renderizado-gpu'].action, '¡Renderizar!');
assert.deepStrictEqual(ProgressService.paidSpinOdds, {
  recoverOrWinPercent: 59,
  averagePrize: 20
}, 'la ruleta pagada debe mostrar odds coherentes y devolver su costo en promedio');
// Catálogo, dificultad y recompensas de los juegos recientes.
assert.notStrictEqual(sim.profile('renderizado-gpu', starter).status, 'fail');
assert.strictEqual(
  r.coinsFor('renderizado-gpu', { score: 100 }, sim.profile('renderizado-gpu', best), 45, games['renderizado-gpu']),
  90
);
assert.notStrictEqual(sim.profile('taller-ensamblaje', starter).status, 'fail');
assert.strictEqual(r.coinsFor('taller-ensamblaje', { score: 100 }, sim.profile('taller-ensamblaje', best), 45, games['taller-ensamblaje']), 90);
const balancedPc = { cpu: 'cpu2', ram: 'ram2', gpu: 'gpu2', rom: 'rom2' };
assert.strictEqual(sim.profile('carrera', balancedPc).status, 'ok');
const starterRom = sim.profile('carrera', { ...balancedPc, rom: 'rom1' });
assert.strictEqual(starterRom.status, 'limited');
assert.strictEqual(starterRom.loads.rom, 0.9);
assert.ok(starterRom.tips.some(tip => tip.includes('ROM') && tip.includes('cargar')));
assert.throws(() => sim.profile('carrera', { ...balancedPc, rom: 'invalid' }), /Componente no válido/);
// La dificultad elegida paga más monedas (fácil no se penaliza).
assert.strictEqual(r.coinsFor('carrera', { position: 1 }, c, 30, games.carrera), 70);
assert.strictEqual(r.coinsFor('carrera', { position: 1 }, { ...c, difficulty: 'medio' }, 30, games.carrera), 81);
assert.strictEqual(r.coinsFor('defensa', { waves: 3, won: true }, { ...c, difficulty: 'dificil' }, 60, games.defensa), 81);
assert.strictEqual(r.coinsFor('defensa', { waves: 3, won: true }, { ...c, difficulty: 'facil' }, 60, games.defensa), 60);
// Insignias de los juegos nuevos.
const ach = (game, o) => r.achievementCodes({ game, o, profile: c, coins: 30, firstEver: false });
assert.ok(ach('clasificador', { score: 60 }).includes('experto_clasificador'));
assert.ok(!ach('clasificador', { score: 40 }).includes('experto_clasificador'));
assert.ok(ach('ciber-guardian', { won: true }).includes('guardian'));
assert.ok(!ach('ciber-guardian', { won: false }).includes('guardian'));
assert.strictEqual(r.levelFor(149), 1);
assert.strictEqual(r.levelFor(150), 2);
assert.strictEqual(r.levelFor(449), 2);
assert.strictEqual(r.levelFor(450), 3);
assert.deepStrictEqual(new PlayerProgress({ points: 200, level: 2 }).toJSON(), {
  points: 200, level: 2, currentLevelAt: 150, nextLevelAt: 450,
  xpIntoLevel: 50, xpForNextLevel: 300, percentToNext: 16
});

const canvas = { width: 480, height: 640, getContext: () => ({}) };
// Contratos de controles y comportamiento determinista de los motores.
const catcher = new CatcherGame(canvas, { ...sim.profile('clasificador', best), difficulty: 'facil' }, () => {});
const firstTarget = catcher.currentTarget;
catcher.advanceTarget();
assert.notStrictEqual(catcher.currentTarget, firstTarget, 'el objetivo de componentes debe alternar');
assert.ok(catcher.targetIcons, 'el objetivo activo debe tener un icono visible');
assert.strictEqual(catcher.itemColor({ cat: 'cpu' }), '#ff6b81');
assert.strictEqual(catcher.itemColor({ cat: 'ram' }), '#39bdf8');
assert.strictEqual(catcher.itemColor({ trap: true, icon: '🦠' }), '#ff4f68');
assert.strictEqual(catcher.itemColor({ power: 'magnet' }), '#5ad1ff');
const raceProfile = { ...sim.profile('carrera', starter), difficulty: 'facil' };
const easyRace = new RaceGame(canvas, raceProfile, () => {});
const normalRace = new RaceGame(canvas, { ...raceProfile, difficulty: 'medio' }, () => {});
const hardRace = new RaceGame(canvas, { ...raceProfile, difficulty: 'dificil' }, () => {});
assert.strictEqual(easyRace.buttons.length, 0, 'los controles táctiles de Carrera deben estar fuera del área de juego');
assert.ok(easyRace.me.speed > 140, 'la velocidad base del jugador debe ser más rápida que antes');
assert.ok(easyRace.L < 3200, 'la pista debe tomar menos tiempo en completarse');
assert.ok(easyRace.bots.every((bot, i) => bot.base < normalRace.bots[i].base));
assert.ok(normalRace.bots.every((bot, i) => bot.base < hardRace.bots[i].base));
normalRace.onButton('right', 'pointerdown');
normalRace.onButton('right', 'pointerup');
assert.strictEqual(normalRace.me.lane, 2, 'un toque derecho debe cambiar un solo carril, no dos');
normalRace.onButton('left', 'pointerdown');
normalRace.onButton('left', 'pointerup');
assert.strictEqual(normalRace.me.lane, 1, 'el toque izquierdo debe regresar un carril por toque');
easyRace.objs = [{ d: 60, lane: 0, type: 'block', used: false }];
const hardBot = hardRace.bots[0];
hardRace.objs = [{ d: 60, lane: 0, type: 'block', used: false, botPassed: [false, false] }];
assert.strictEqual(hardBot.avoidance, 1, 'en difícil los bots deben intentar esquivar siempre');
assert.notStrictEqual(hardRace.chooseBotLane(hardBot), 0, 'el bot difícil debe evitar el obstáculo cercano');
assert.strictEqual(hardBot.turboAccuracy, 0.8, 'la precisión de turbo en difícil debe ser 80%');
const boostObject = { d: 100, lane: 0, type: 'boost', used: false, botPassed: [false, false] };
hardRace.handleBotObject(hardBot, 0, boostObject, 0.79);
assert.strictEqual(hardBot.boost, 1.1, 'el bot activa el turbo en un resultado dentro del 80%');
assert.strictEqual(boostObject.used, false, 'los bots no deben consumir el objeto del jugador');
assert.strictEqual(boostObject.botPassed[1], false, 'cada bot debe llevar su propio estado del objeto');
hardBot.boost = 0;
hardRace.handleBotObject(hardBot, 0, boostObject, 0.81);
assert.strictEqual(hardBot.boost, 0, 'el turbo no se activa fuera del 80% de precisión');

const baseGame = new BaseGame(canvas, { quality: 'alta', hitchPerMin: 0 }, () => {});
baseGame.t0 = 500;
baseGame.last = 900;
baseGame.lastFrame = 900;
baseGame.fpsT = 800;
baseGame.nextHitch = 12000;
baseGame.pause(1000);
baseGame.resume(6000);
assert.strictEqual(baseGame.t0, 5500, 'el tiempo límite de la partida se pausa junto con el juego');
assert.strictEqual(baseGame.last, 6000, 'reanudar no debe producir un salto de tiempo en el primer frame');
assert.strictEqual(baseGame.nextHitch, 17000, 'los tirones simulados también deben pausarse');
baseGame.pause(7000);
baseGame.resume(9000);
assert.strictEqual(baseGame.t0, 7500, 'la pausa debe poder repetirse');

const gameProfile = { ...sim.profile('organizador-disco', starter), difficulty: 'medio' };
const diskGame = new DiskOrganizerGame(canvas, gameProfile, () => {});
const piecesBeforeDrop = diskGame.pieces;
diskGame.hardDrop();
assert.strictEqual(diskGame.pieces, piecesBeforeDrop + 1, 'soltar una pieza debe asentarla una sola vez');
assert.strictEqual('timeLeft' in diskGame, false, 'el Organizador de Disco no debe tener temporizador');
diskGame.ready = 0;
diskGame.update(100);
assert.strictEqual(diskGame.done, false, 'el Organizador no debe terminar solo por pasar el tiempo');
diskGame.lines = 3;
assert.deepStrictEqual(diskGame.result(false), {
  crashed: false, score: 54, won: false, lines: 3, pieces: 1
});

const winningDisk = new DiskOrganizerGame(canvas, gameProfile, () => {});
winningDisk.end = result => { winningDisk.done = true; winningDisk.endResult = result; };
winningDisk.lines = 5;
winningDisk.grid = Array.from({ length: winningDisk.rows }, () => Array(winningDisk.cols).fill(null));
winningDisk.grid[winningDisk.rows - 1].fill({ color: '#5ad1ff', icon: '📁' });
winningDisk.grid[winningDisk.rows - 1][winningDisk.cols - 1] = null;
winningDisk.active = { cells: [[1]], color: '#5ad1ff', icon: '📁', x: winningDisk.cols - 1, y: winningDisk.rows - 1 };
winningDisk.lockPiece();
assert.strictEqual(winningDisk.done, true, 'liberar seis filas debe terminar el Organizador');
assert.strictEqual(winningDisk.endResult.won, true, 'liberar seis filas debe dar la victoria');
assert.strictEqual(winningDisk.endResult.lines, 6);

const fullDisk = new DiskOrganizerGame(canvas, gameProfile, () => {});
fullDisk.end = result => { fullDisk.done = true; fullDisk.endResult = result; };
fullDisk.grid[0].fill({ color: '#5ad1ff', icon: '📁' });
fullDisk.spawn();
assert.strictEqual(fullDisk.done, true, 'el tablero lleno debe terminar el Organizador');
assert.strictEqual(fullDisk.endResult.won, false, 'llenar el tablero debe terminar sin victoria');

const mazeGame = new DataMazeGame(canvas, { ...sim.profile('laberinto-datos', starter), difficulty: 'medio' }, () => {});
assert.strictEqual(typeof mazeGame.start, 'function', 'la posición inicial no debe ocultar el método que arranca el juego');
assert.deepStrictEqual(mazeGame.startPos, { x: 1, y: 1 });
assert.strictEqual(mazeGame.packets.length, mazeGame.targetPackets);
assert.ok(mazeGame.packets.every(pos => mazeGame.maze[pos.y][pos.x] === 0));
assert.ok(mazeGame.viruses.every(pos => mazeGame.maze[pos.y][pos.x] === 0));
assert.strictEqual('timeLeft' in mazeGame, false, 'el Laberinto no debe tener temporizador');
mazeGame.ready = 0;
mazeGame.viruses = [];
mazeGame.update(100);
assert.strictEqual(mazeGame.done, false, 'el Laberinto no debe terminar solo por pasar el tiempo');
mazeGame.packets.splice(0, 5);
assert.deepStrictEqual(mazeGame.result(true), {
  crashed: false, score: 60, won: true, packetsCollected: 5, totalPackets: 8
});
mazeGame.packets.push({ x: 1, y: 2 });
mazeGame.onKey('arrowright');
assert.strictEqual(mazeGame.pointerDir, null, 'el teclado no debe dejar activado el movimiento táctil repetido');
for (const pc of [starter, balancedPc, best]) {
  const maze = new DataMazeGame(canvas, { ...sim.profile('laberinto-datos', pc), difficulty: 'medio' }, () => {});
  const queue = [maze.startPos], visited = new Set([`${maze.startPos.x},${maze.startPos.y}`]);
  for (let i = 0; i < queue.length; i++) {
    const pos = queue[i];
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const x = pos.x + dx, y = pos.y + dy, key = `${x},${y}`;
      if (maze.maze[y] && maze.maze[y][x] === 0 && !visited.has(key)) {
        visited.add(key); queue.push({ x, y });
      }
    }
  }
  assert.ok(visited.has(`${maze.goal.x},${maze.goal.y}`), 'el laberinto debe tener una ruta hasta la salida');
  let edges = 0;
  for (let y = 0; y < maze.rows; y++) for (let x = 0; x < maze.cols; x++) {
    if (maze.maze[y][x] !== 0) continue;
    if (maze.maze[y + 1] && maze.maze[y + 1][x] === 0) edges++;
    if (maze.maze[y][x + 1] === 0) edges++;
  }
  assert.ok(edges - visited.size + 1 >= 3, 'el laberinto debe ofrecer rutas alternativas para esquivar virus');
  assert.ok(maze.boardY + maze.rows * maze.cell <= maze.H - 100, 'el tablero no debe cubrir los controles táctiles');
}

const assemblyProfile = { ...sim.profile('taller-ensamblaje', starter), difficulty: 'facil' };
const assemblyGame = new AssemblyWorkshopGame({ ...canvas, width: 960, height: 640 }, assemblyProfile, () => {});
assemblyGame.end = result => { assemblyGame.done = true; assemblyGame.endResult = result; };
const wrongDrop = assemblyGame.slots().motherboard;
assert.strictEqual(assemblyGame.tryInstall('motherboard', wrongDrop.x + wrongDrop.w / 2, wrongDrop.y + wrongDrop.h / 2), true);
assert.strictEqual(assemblyGame.tryInstall('ssd-sata', wrongDrop.x + wrongDrop.w / 2, wrongDrop.y + wrongDrop.h / 2), false);
assert.ok(assemblyGame.feedback.includes('SSD SATA'), 'el SSD SATA debe dar feedback de pieza distractora');
assert.strictEqual(assemblyGame.tryInstall('cpu', 0, 0), false, 'la pieza correcta debe soltarse en la zona resaltada');
assert.strictEqual(assemblyGame.errors, 2, 'una pieza incorrecta o fuera de su ranura debe mostrar error sin avanzar');
assemblyGame.elapsed = 60;
assert.strictEqual(assemblyGame.score(), 80, 'la recompensa debe bajar al demorarse más');
assemblyGame.elapsed = 0;
const fastAssemblyScore = assemblyGame.score();
assemblyGame.elapsed = 60;
assert.ok(
  r.coinsFor('taller-ensamblaje', { score: fastAssemblyScore }, sim.profile('taller-ensamblaje', best), 45, games['taller-ensamblaje'])
    > r.coinsFor('taller-ensamblaje', { score: assemblyGame.score() }, sim.profile('taller-ensamblaje', best), 45, games['taller-ensamblaje']),
  'terminar más rápido debe dar más monedas'
);
assemblyGame.elapsed = 0;
let thermalDrawn = false;
assemblyGame.drawImage = () => { thermalDrawn = true; };
assemblyGame.drawPart({}, { id: 'thermal' }, {}, true);
assert.strictEqual(thermalDrawn, false, 'la imagen de la pasta no debe dibujarse sobre el procesador');
for (const part of ['motherboard', 'cpu', 'thermal', 'ram', 'gpu', 'ssd-m2']) {
  if (part === 'motherboard') continue;
  const slot = assemblyGame.slots()[part];
  assert.strictEqual(assemblyGame.tryInstall(part, slot.x + slot.w / 2, slot.y + slot.h / 2), true, `${part} debe instalarse en su zona`);
}
assert.strictEqual(assemblyGame.done, true, 'instalar todas las piezas debe finalizar el taller');
assert.deepStrictEqual(assemblyGame.endResult, {
  crashed: false, won: true, score: 90, installed: 6, elapsedSeconds: 0
});
assert.deepStrictEqual(assemblyGame.partCards().map(part => part.id), ['motherboard', 'cpu', 'ram', 'gpu', 'ssd-m2', 'ssd-sata', 'thermal']);
const timedOutAssembly = new AssemblyWorkshopGame({ ...canvas, width: 960, height: 640 }, assemblyProfile, () => {});
timedOutAssembly.end = result => { timedOutAssembly.done = true; timedOutAssembly.endResult = result; };
timedOutAssembly.installed = new Set(['motherboard', 'cpu', 'thermal']);
timedOutAssembly.elapsed = timedOutAssembly.timeLimitSec;
timedOutAssembly.update(0);
assert.deepStrictEqual(timedOutAssembly.endResult, {
  crashed: false, won: false, timedOut: true, score: 40, installed: 3, elapsedSeconds: 120
}, 'al terminarse el tiempo debe guardar avance parcial sin contar como victoria');
const compactAssembly = new AssemblyWorkshopGame({ ...canvas, width: 480, height: 1200 }, assemblyProfile, () => {});
assert.strictEqual(compactAssembly.compact, true);
assert.strictEqual(compactAssembly.timeLimitSec, 120);
assert.ok(compactAssembly.partCards().every(part => part.x + part.w / 2 <= compactAssembly.W), 'las piezas deben caber en el taller móvil');
assert.ok(compactAssembly.partCards().every(part => part.y + part.h / 2 <= compactAssembly.H), 'el inventario debe caber dentro del canvas móvil');
for (const part of compactAssembly.partCards()) {
  assert.ok(fs.existsSync(path.join(__dirname, '../public/img/ensamblaje', part.src)), `debe existir la imagen de ${part.id}`);
}
assert.ok(fs.existsSync(path.join(__dirname, '../public/img/ensamblaje/gabinete-abierto.webp')), 'debe existir la imagen del gabinete');

const interactionAssembly = new AssemblyWorkshopGame({ ...canvas, width: 480, height: 1200 }, assemblyProfile, () => {});
const boardPartCard = interactionAssembly.partCards().find(part => part.id === 'motherboard');
const cardEvent = pointerId => ({ pointerId, currentTarget: { setPointerCapture() {} } });
interactionAssembly.onPointer(boardPartCard.x, 'pointerdown', boardPartCard.y, cardEvent(1));
interactionAssembly.pause(0);
assert.strictEqual(interactionAssembly.errors, 0, 'pausar mientras se arrastra no debe contar como error');
assert.strictEqual(interactionAssembly.draggingPart, null, 'pausar debe limpiar el arrastre activo');
interactionAssembly.resume(100);
interactionAssembly.onPointer(boardPartCard.x, 'pointerdown', boardPartCard.y, cardEvent(2));
interactionAssembly.onRelease({ type: 'pointercancel', pointerId: 2 }, NaN, NaN);
assert.strictEqual(interactionAssembly.errors, 0, 'cancelar un gesto no debe intentar instalar una pieza');
interactionAssembly.onPointer(boardPartCard.x, 'pointerdown', boardPartCard.y, cardEvent(3));
interactionAssembly.onRelease({ type: 'pointerup', pointerId: 3 }, -10, -10);
assert.strictEqual(interactionAssembly.errors, 1, 'soltar fuera del tablero debe dar feedback sin bloquear el inventario');
interactionAssembly.onPointer(boardPartCard.x, 'pointerdown', boardPartCard.y, cardEvent(4));
interactionAssembly.onRelease({ type: 'pointerup', pointerId: 4 }, boardPartCard.x, boardPartCard.y);
const motherboardSlot = interactionAssembly.slots().motherboard;
interactionAssembly.onPointer(motherboardSlot.x + motherboardSlot.w / 2, 'pointerdown', motherboardSlot.y + motherboardSlot.h / 2, cardEvent(5));
interactionAssembly.onRelease({ type: 'pointerup', pointerId: 5 }, motherboardSlot.x + motherboardSlot.w / 2, motherboardSlot.y + motherboardSlot.h / 2);
assert.ok(interactionAssembly.installed.has('motherboard'), 'tocar la pieza y después su zona debe instalarla');
interactionAssembly.onPointer(boardPartCard.x, 'pointerdown', boardPartCard.y, cardEvent(6));
assert.strictEqual(interactionAssembly.draggingPart, null, 'una pieza instalada ya no debe poder arrastrarse desde el inventario');

const gpuRetroProfile = {
  ...sim.profile('renderizado-gpu', starter),
  difficulty: 'facil',
  renderMode: 'retro'
};
const gpuRetro = new GpuRenderGame(canvas, gpuRetroProfile, () => {});
gpuRetro.end = result => { gpuRetro.done = true; gpuRetro.endResult = result; };
assert.strictEqual(gpuRetro.baseFps, 30, 'la GPU integrada debe comenzar en modo retro de 30 FPS');
assert.deepStrictEqual(
  [gpuRetro.difficulty.distance / gpuRetro.difficulty.speed,
    new GpuRenderGame(canvas, { ...gpuRetroProfile, difficulty: 'medio' }, () => {}).difficulty.distance / 150,
    new GpuRenderGame(canvas, { ...gpuRetroProfile, difficulty: 'dificil' }, () => {}).difficulty.distance / 170]
    .map(seconds => Math.round(seconds)),
  [35, 44, 55],
  'las pistas deben durar más a medida que sube la dificultad'
);
gpuRetro.ready = 0;
gpuRetro.spawnT = 2;
gpuRetro.targets = [{ type: 'core', x: gpuRetro.player.x, y: gpuRetro.player.y, spin: 0 }];
gpuRetro.update(0.01);
assert.strictEqual(gpuRetro.cores, 1, 'recoger un núcleo debe aumentar el contador');
gpuRetro.update(0.01);
assert.strictEqual(gpuRetro.fps, 34, 'los núcleos aumentan los FPS del modo retro');
assert.ok(gpuRetro.boostT > 0, 'recoger un núcleo activa el turbo');
const scoreWithCore = gpuRetro.score();
gpuRetro.targets = [{ type: 'dust', x: gpuRetro.player.x, y: gpuRetro.player.y, spin: 0 }];
gpuRetro.update(0.01);
assert.strictEqual(gpuRetro.lives, 2, 'un choque con polvo consume una oportunidad');
assert.strictEqual(gpuRetro.hits, 1);
assert.strictEqual(gpuRetro.temperature, 70, 'el polvo que obstruye la ventilación eleva la temperatura');
assert.ok(gpuRetro.damageT > 0, 'un choque activa el parpadeo rojo');
gpuRetro.update(0.01);
assert.ok(gpuRetro.speed < gpuRetro.difficulty.speed, 'un choque reduce la velocidad');
gpuRetro.distance = 100;
gpuRetro.cores = 0;
assert.ok(scoreWithCore > gpuRetro.score(), 'los núcleos aumentan el puntaje');
gpuRetro.restartLevel();
assert.strictEqual(gpuRetro.cores, 0, 'reiniciar restablece los núcleos');
assert.strictEqual(gpuRetro.lives, 3, 'reiniciar restaura las vidas');
assert.strictEqual(gpuRetro.ready, 3, 'reiniciar vuelve a la cuenta regresiva');
const gpuHeat = new GpuRenderGame(canvas, gpuRetroProfile, () => {});
gpuHeat.end = result => { gpuHeat.done = true; gpuHeat.endResult = result; };
gpuHeat.ready = 0;
gpuHeat.spawnT = 2;
for (let hit = 0; hit < 3; hit++) {
  gpuHeat.targets = [{ type: 'dust', x: gpuHeat.player.x, y: gpuHeat.player.y, spin: 0 }];
  gpuHeat.update(0.01);
}
assert.strictEqual(gpuHeat.endResult.won, false, 'tres choques de polvo deben apagar la GPU');
assert.strictEqual(gpuHeat.endResult.hits, 3);
assert.strictEqual(gpuHeat.endResult.temperature, 100);
const gpuRtx = new GpuRenderGame(canvas, { ...gpuRetroProfile, componentLevels: { ...gpuRetroProfile.componentLevels, gpu: 3 }, renderMode: 'rtx' }, () => {});
assert.strictEqual(gpuRtx.baseFps, 144, 'RTX comienza en 144 FPS');
gpuRtx.ready = 0;
gpuRtx.distance = gpuRtx.difficulty.distance;
gpuRtx.end = result => { gpuRtx.done = true; gpuRtx.endResult = result; };
gpuRtx.update(0.01);
assert.strictEqual(gpuRtx.endResult.won, true, 'alcanzar la meta termina la pista');
assert.strictEqual(gpuRtx.endResult.renderMode, 'rtx');
console.log('Pruebas de perfiles y recompensas: OK');