// Jugar en difícil cuesta más, así que paga más monedas. Fácil no se penaliza.
const DIFF_MULT = { facil: 1, medio: 1.15, dificil: 1.35 };
const XP_PER_LEVEL = 150;

// Centraliza estrellas, niveles, monedas e insignias para que todos los juegos premien igual.
class RewardManager {
  stars(score) { return score >= 90 ? 3 : score >= 60 ? 2 : score >= 30 ? 1 : 0; }
  levelFor(points) {
    let level = 1, nextLevelAt = XP_PER_LEVEL;
    while (points >= nextLevelAt) {
      level++;
      nextLevelAt += level * XP_PER_LEVEL;
    }
    return level;
  }
  difficultyBonus(difficulty) { return DIFF_MULT[difficulty] || 1; }

  // Monedas que gana el jugador. El servidor las calcula con el perfil que él mismo generó.
  coinsFor(game, o, profile, secs, g) {
    if (o.crashed) return profile.crashAfterSec != null ? 5 : 0;
    let c = 0;
    if (game === 'carrera') {
      c = { 1: 60, 2: 35, 3: 15 }[o.position] || 0;
      if (c && profile.status === 'ok') c += 10;
    } else if (['clasificador', 'organizador-disco', 'laberinto-datos', 'taller-ensamblaje', 'renderizado-gpu'].includes(game)) {
      // Estos juegos reportan un puntaje (0..100) que se limita antes de calcular monedas.
      c = Math.round((Math.max(0, Math.min(100, o.score || 0)) / 100) * g.maxCoins);
      if (c > 0 && profile.status === 'ok') c += 10;
    } else {
      c = Math.min(3, Math.max(0, o.waves | 0)) * 10 + (o.won ? 30 : 0);
    }
    c = Math.round(c * this.difficultyBonus(profile.difficulty));
    if (secs < g.minSeconds) c = Math.min(c, 5);
    return c;
  }

  achievementCodes({ game, o, profile, coins, firstEver }) {
    const codes = [];
    if (firstEver) codes.push('primer_arranque');
    if (!o.crashed && game === 'carrera' && o.position === 1) codes.push('campeon');
    if (!o.crashed && game === 'defensa' && o.won) codes.push('defensor');
    if (!o.crashed && game === 'clasificador' && o.score >= 60) codes.push('experto_clasificador');
    if (!o.crashed && game === 'ciber-guardian' && o.won) codes.push('guardian');
    if (!o.crashed && profile.status === 'ok' && coins > 0) codes.push('pc_ideal');
    return codes;
  }
}
module.exports = RewardManager;