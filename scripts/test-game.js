const assert = require('assert');
const { parts, starter, games } = require('../src/game/data');
const ComputerSimulator = require('../src/game/ComputerSimulator');
const RewardManager = require('../src/game/RewardManager');
const PlayerProgress = require('../src/game/PlayerProgress');
const { BaseGame, RaceGame, CatcherGame, DiskOrganizerGame, DataMazeGame } = require('../public/js/games');
const sim = new ComputerSimulator(parts, games), r = new RewardManager();
const best = { cpu: 'cpu4', ram: 'ram4', gpu: 'gpu4', rom: 'rom4' };

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
diskGame.lines = 3;
assert.deepStrictEqual(diskGame.result(false), {
  crashed: false, score: 54, won: false, lines: 3, pieces: 1
});

const mazeGame = new DataMazeGame(canvas, { ...sim.profile('laberinto-datos', starter), difficulty: 'medio' }, () => {});
assert.strictEqual(typeof mazeGame.start, 'function', 'la posición inicial no debe ocultar el método que arranca el juego');
assert.deepStrictEqual(mazeGame.startPos, { x: 1, y: 1 });
assert.strictEqual(mazeGame.packets.length, mazeGame.targetPackets);
assert.ok(mazeGame.packets.every(pos => mazeGame.maze[pos.y][pos.x] === 0));
assert.ok(mazeGame.viruses.every(pos => mazeGame.maze[pos.y][pos.x] === 0));
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
console.log('Pruebas de perfiles y recompensas: OK');