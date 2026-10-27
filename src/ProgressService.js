const pool = require('./db');
const { parts, starter, games } = require('./game/data');
const ComputerSimulator = require('./game/ComputerSimulator');
const RewardManager = require('./game/RewardManager');
const PlayerProgress = require('./game/PlayerProgress');

const KINDS = Object.keys(parts);
const DIFFICULTIES = ['facil', 'medio', 'dificil'];
const fail = msg => Object.assign(new Error(msg), { user: true });

// Ruleta de Recompensas: un giro gratis cada 2 horas; los demás cuestan monedas.
// Los premios y sus probabilidades viven solo en el servidor.
const FREE_SPIN_MS = 2 * 60 * 60 * 1000;
const SPIN_COST = 20;
const SPIN_PRIZES = [
  { name: '5 monedas', icon: '🥉', coins: 5, weight: 30 },
  { name: '10 monedas', icon: '🪙', coins: 10, weight: 30 },
  { name: '20 monedas', icon: '💰', coins: 20, weight: 20 },
  { name: '30 monedas', icon: '💵', coins: 30, weight: 12 },
  { name: '50 monedas', icon: '💎', coins: 50, weight: 6 },
  { name: '80 monedas', icon: '🏆', coins: 80, weight: 2 }
];
class ProgressService {
  constructor() { this.rewards = new RewardManager(); this.sim = new ComputerSimulator(parts, games); }

  async _ensurePc(db, userId) {
    await db.query('INSERT INTO user_pc (user_id, cpu, ram, gpu, rom) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',
      [userId, starter.cpu, starter.ram, starter.gpu, starter.rom]);
    await db.query('INSERT INTO user_components (user_id, component_code) SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING', [userId, Object.values(starter)]);
  }

  async _unlock(db, userId, codes) {
    const out = [];
    for (const code of codes) {
      const r = await db.query(
        `INSERT INTO user_achievements (user_id, achievement_id) SELECT $1, id FROM achievements WHERE code=$2
         ON CONFLICT DO NOTHING RETURNING achievement_id`, [userId, code]);
      if (r.rowCount) out.push((await db.query('SELECT name, description, icon FROM achievements WHERE id=$1', [r.rows[0].achievement_id])).rows[0]);
    }
    return out;
  }

  async getPc(userId) {
    await this._ensurePc(pool, userId);
    const coins = (await pool.query('SELECT coins FROM player_progress WHERE user_id=$1', [userId])).rows[0].coins;
    const owned = (await pool.query('SELECT component_code FROM user_components WHERE user_id=$1', [userId])).rows.map(r => r.component_code);
    const equipped = (await pool.query('SELECT cpu, ram, gpu, rom FROM user_pc WHERE user_id=$1', [userId])).rows[0];
    const previews = {}, pub = {};
    for (const [id, g] of Object.entries(games)) {
      previews[id] = this.sim.profile(id, equipped);
      pub[id] = { name: g.name, icon: g.icon, desc: g.desc, controls: g.controls };
    }
    return { coins, owned, equipped, catalog: parts, games: pub, previews };
  }

  async buy(userId, code) {
    const part = KINDS.flatMap(k => parts[k].map(p => ({ ...p, kind: k }))).find(p => p.code === code);
    if (!part) throw fail('Ese componente no existe');
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await this._ensurePc(c, userId);
      const pr = await c.query('SELECT coins FROM player_progress WHERE user_id=$1 FOR UPDATE', [userId]);
      if ((await c.query('SELECT 1 FROM user_components WHERE user_id=$1 AND component_code=$2', [userId, code])).rowCount) throw fail('Ya tienes ese componente');
      if (pr.rows[0].coins < part.price) throw fail('Todavía no te alcanzan las monedas. ¡Sigue jugando!');
      await c.query('INSERT INTO user_components (user_id, component_code) VALUES ($1,$2)', [userId, code]);
      await c.query('UPDATE player_progress SET coins = coins - $2, updated_at = now() WHERE user_id=$1', [userId, part.price]);
      await c.query(`UPDATE user_pc SET ${part.kind} = $2 WHERE user_id=$1`, [userId, code]); // part.kind viene del catálogo, no del usuario
      const newAchievements = await this._unlock(c, userId, ['ingeniero']);
      await c.query('COMMIT');
      return { ok: true, newAchievements };
    } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  }

  async equip(userId, config) {
    for (const k of KINDS) if (!parts[k].some(p => p.code === config[k])) throw fail('Componente no válido');
    await this._ensurePc(pool, userId);
    const codes = KINDS.map(k => config[k]);
    const own = await pool.query('SELECT component_code FROM user_components WHERE user_id=$1 AND component_code = ANY($2)', [userId, codes]);
    if (own.rowCount !== KINDS.length) throw fail('Solo puedes poner componentes que ya son tuyos');
    const assignments = KINDS.map((kind, index) => `${kind}=$${index + 2}`).join(', ');
    await pool.query(`UPDATE user_pc SET ${assignments} WHERE user_id=$1`, [userId, ...codes]);
    return { ok: true };
  }

  // El niño elige Fácil / Medio / Difícil antes de jugar; queda guardado en el perfil de la partida.
  async startGame(userId, gameId, difficulty = 'medio') {
    if (!games[gameId]) throw fail('Juego no válido');
    const level = DIFFICULTIES.includes(difficulty) ? difficulty : 'medio';
    await this._ensurePc(pool, userId);
    const eq = (await pool.query('SELECT cpu, ram, gpu, rom FROM user_pc WHERE user_id=$1', [userId])).rows[0];
    const profile = { ...this.sim.profile(gameId, eq), difficulty: level };
    if (profile.status === 'fail') {
      throw fail(`No puedes iniciar ${games[gameId].name} todavía. ${profile.tips.join(' ')}`);
    }
    const r = await pool.query('INSERT INTO game_sessions (user_id, game, profile) VALUES ($1,$2,$3) RETURNING id', [userId, gameId, JSON.stringify(profile)]);
    return { sessionId: r.rows[0].id, profile };
  }

  async finishGame(userId, sessionId, raw) {
    const sid = Number(sessionId);
    if (!Number.isInteger(sid)) throw fail('Partida no válida');
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      const s = await c.query(
        `SELECT game, profile, EXTRACT(EPOCH FROM (now() - started_at)) AS secs FROM game_sessions
         WHERE id=$1 AND user_id=$2 AND finished_at IS NULL FOR UPDATE`, [sid, userId]);
      if (!s.rows[0]) throw fail('Esa partida ya terminó o no existe');
      const { game, profile } = s.rows[0], secs = Number(s.rows[0].secs), g = games[game];
      const o = { crashed: raw.crashed === true, position: Number(raw.position) | 0, waves: Number(raw.waves) | 0, won: raw.won === true,
        score: Math.max(0, Math.min(100, Math.round(Number(raw.score) || 0))) };
      // Si el perfil decía que el juego se cerraba y el navegador afirma que terminó, el servidor manda.
      if (!o.crashed && profile.crashAfterSec != null && secs > profile.crashAfterSec + 3) o.crashed = true;
      const coins = this.rewards.coinsFor(game, o, profile, secs, g);
      const score = Math.min(100, Math.round((coins / g.maxCoins) * 100));
      const completed = !o.crashed && (game === 'carrera' ? o.position >= 1 && o.position <= 2
        : ['clasificador', 'organizador-disco', 'laberinto-datos'].includes(game) ? o.score >= 60
          : o.won);
      const firstEver = !(await c.query('SELECT 1 FROM game_sessions WHERE user_id=$1 AND finished_at IS NOT NULL LIMIT 1', [userId])).rowCount;
      const mission = (await c.query('SELECT id FROM missions WHERE slug=$1', [game])).rows[0];
      if (!mission) throw fail(`La misión "${game}" no está registrada. Ejecuta sql/migracion-nuevos-juegos.sql y reinicia el servidor.`);
      await c.query('INSERT INTO mission_attempts (user_id, mission_id, score, completed, result_data) VALUES ($1,$2,$3,$4,$5)',
        [userId, mission.id, score, completed, JSON.stringify({ ...o, status: profile.status })]);
      const cur = (await c.query('SELECT total_points, coins FROM player_progress WHERE user_id=$1 FOR UPDATE', [userId])).rows[0];
      const total = cur.total_points + coins, level = this.rewards.levelFor(total);
      await c.query('UPDATE player_progress SET total_points=$2, coins=coins+$3, level=$4, updated_at=now() WHERE user_id=$1', [userId, total, coins, level]);
      await c.query('UPDATE game_sessions SET finished_at=now(), coins_awarded=$2, result=$3 WHERE id=$1', [sid, coins, JSON.stringify(o)]);
      const newAchievements = await this._unlock(c, userId, this.rewards.achievementCodes({ game, o, profile, coins, firstEver }));
      await c.query('COMMIT');
      return { coins, stars: this.rewards.stars(score), status: profile.status, tips: profile.tips, crashed: o.crashed, newAchievements,
        difficulty: profile.difficulty, bonus: this.rewards.difficultyBonus(profile.difficulty),
        balance: cur.coins + coins, progress: new PlayerProgress({ points: total, level }).toJSON() };
    } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  }

  // Estado de la ruleta: los premios que dibuja el frontend y si toca giro gratis.
  async roulette(userId) {
    const p = (await pool.query(
      `SELECT coins, GREATEST(0, $2 - COALESCE(EXTRACT(EPOCH FROM (now() - last_free_spin)) * 1000, $2))::bigint AS free_spin_in
       FROM player_progress WHERE user_id=$1`, [userId, FREE_SPIN_MS])).rows[0];
    if (!p) throw fail('No encontramos tu progreso');
    const restante = Number(p.free_spin_in);
    return {
      prizes: SPIN_PRIZES.map(({ name, icon }) => ({ name, icon })),
      cost: SPIN_COST, coins: p.coins, free: restante === 0, nextFreeIn: restante
    };
  }

  // Giro de la ruleta: el premio lo sortea el servidor, nunca el navegador.
  async spin(userId) {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      const p = (await c.query(
        `SELECT coins, GREATEST(0, $2 - COALESCE(EXTRACT(EPOCH FROM (now() - last_free_spin)) * 1000, $2))::bigint AS free_spin_in
         FROM player_progress WHERE user_id=$1 FOR UPDATE`, [userId, FREE_SPIN_MS])).rows[0];
      if (!p) throw fail('No encontramos tu progreso');
      const restante = Number(p.free_spin_in), free = restante === 0;
      if (!free && p.coins < SPIN_COST) throw fail(`Te faltan monedas: cada giro cuesta ${SPIN_COST} 🪙 y el giro gratis todavía no vuelve.`);
      const total = SPIN_PRIZES.reduce((s, x) => s + x.weight, 0);
      let r = Math.random() * total, index = 0;
      while (index < SPIN_PRIZES.length - 1 && r >= SPIN_PRIZES[index].weight) { r -= SPIN_PRIZES[index].weight; index++; }
      const prize = SPIN_PRIZES[index];
      const coins = p.coins - (free ? 0 : SPIN_COST) + prize.coins;
      if (free) {
        await c.query('UPDATE player_progress SET coins=$2, last_free_spin=now(), updated_at=now() WHERE user_id=$1',
          [userId, coins]);
      } else {
        await c.query('UPDATE player_progress SET coins=$2, updated_at=now() WHERE user_id=$1',
          [userId, coins]);
      }
      const newAchievements = await this._unlock(c, userId, ['afortunado']);
      await c.query('COMMIT');
      return {
        index, free, cost: free ? 0 : SPIN_COST, nextCost: SPIN_COST, coins, newAchievements,
        prize: { name: prize.name, icon: prize.icon, coins: prize.coins },
        nextFreeIn: free ? FREE_SPIN_MS : restante
      };
    } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  }

  async getProgress(userId) {
    const u = await pool.query(
      'SELECT u.username, p.total_points, p.level, p.coins FROM users u JOIN player_progress p ON p.user_id=u.id WHERE u.id=$1', [userId]);
    if (!u.rows[0]) return null;
    const missions = await pool.query(
      `SELECT m.slug, m.title, m.description, m.category, m.difficulty, m.max_score, COALESCE(MAX(a.score),0)::int AS best
       FROM missions m LEFT JOIN mission_attempts a ON a.mission_id=m.id AND a.user_id=$1
       WHERE m.active GROUP BY m.id ORDER BY m.id`, [userId]);
    const attempts = await pool.query(
      `SELECT m.title, a.score, a.completed, a.created_at FROM mission_attempts a JOIN missions m ON m.id=a.mission_id
       WHERE a.user_id=$1 AND m.active ORDER BY a.created_at DESC LIMIT 10`, [userId]);
    const ach = await pool.query(
      `SELECT a.code, a.name, a.description, a.icon, (ua.user_id IS NOT NULL) AS unlocked
       FROM achievements a LEFT JOIN user_achievements ua ON ua.achievement_id=a.id AND ua.user_id=$1 ORDER BY a.id`, [userId]);
    return {
      username: u.rows[0].username, coins: u.rows[0].coins,
      progress: new PlayerProgress({
        points: u.rows[0].total_points,
        level: this.rewards.levelFor(u.rows[0].total_points)
      }).toJSON(),
      missions: missions.rows.map(m => ({ ...m, stars: this.rewards.stars(m.best) })),
      attempts: attempts.rows, achievements: ach.rows
    };
  }
}
module.exports = ProgressService;