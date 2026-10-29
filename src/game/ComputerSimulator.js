const KINDS = { cpu: 'procesador', ram: 'memoria', gpu: 'tarjeta gráfica', rom: 'almacenamiento ROM' };

// Traduce la configuración del PC a límites reproducibles que usan los juegos y sus consejos.
class ComputerSimulator {
  constructor(parts, games) { this.parts = parts; this.games = games; }

  nameAt(kind, level) { return this.parts[kind].find(p => p.level === level).name; }

  profile(gameId, config) {
    const g = this.games[gameId];
    if (!g) throw new Error('Juego no válido');
    const sel = {}, st = {};
    for (const k of Object.keys(KINDS)) {
      const p = this.parts[k].find(x => x.code === config[k]);
      if (!p) throw new Error('Componente no válido');
      sel[k] = p;
      st[k] = p.level < g.min[k] ? 'bad' : p.level < g.rec[k] ? 'limited' : 'good';
    }
    const tips = [];
    const need = (k, lv) => this.nameAt(k, lv);
    if (st.cpu === 'bad') tips.push(`${sel.cpu.name} es demasiado lento para ${g.name}: el juego se congela. Necesitas al menos ${need('cpu', g.min.cpu)}.`);
    if (st.cpu === 'limited') tips.push(`${sel.cpu.name} alcanza, pero hay tirones. Con ${need('cpu', g.rec.cpu)} iría más suave.`);
    if (st.ram === 'bad') tips.push(`A ${sel.ram.name} se le llena la memoria y el juego se cierra solo. Necesitas al menos ${need('ram', g.min.ram)}.`);
    if (st.ram === 'limited') tips.push(`Con ${sel.ram.name} la memoria va justa y el juego se pausa un instante de vez en cuando. Mejor ${need('ram', g.rec.ram)}.`);
    if (st.gpu === 'bad') tips.push(`Con ${sel.gpu.name} las imágenes salen muy entrecortadas y sin efectos. Necesitas al menos ${need('gpu', g.min.gpu)}.`);
    if (st.gpu === 'limited') tips.push(`${sel.gpu.name} dibuja bien, pero sin todos los efectos. Con ${need('gpu', g.rec.gpu)} se vería genial.`);
    if (st.rom === 'bad') tips.push(`${sel.rom.name} no tiene espacio suficiente para ${g.name}. Necesitas al menos ${need('rom', g.min.rom)}.`);
    if (st.rom === 'limited') tips.push(`${sel.rom.name} alcanza, pero el juego tardará más en cargar. Con ${need('rom', g.rec.rom)} cargaría más rápido.`);
    const vals = Object.values(st);
    const status = vals.includes('bad') ? 'fail' : vals.includes('limited') ? 'limited' : 'ok';
    if (status === 'ok') tips.push('¡Tu PC va perfecto! Todo se ve fluido y con todos los efectos.');
    const load = k => st[k] === 'bad' ? 1 : st[k] === 'limited' ? 0.9 : sel[k].level > g.rec[k] ? 0.4 : 0.65;
    return {
      game: gameId, status, tips,
      componentLevels: Object.fromEntries(Object.entries(sel).map(([kind, part]) => [kind, part.level])),
      fps: { bad: 15, limited: 30, good: 60 }[st.gpu],
      quality: { bad: 'baja', limited: 'media', good: 'alta' }[st.gpu],
      hitchPerMin: { bad: 12, limited: 5, good: 0 }[st.cpu] + (st.ram === 'limited' ? 3 : 0),
      hitchMs: st.cpu === 'bad' ? 450 : st.cpu === 'limited' ? 220 : 160,
      crashAfterSec: st.ram === 'bad' ? 10 + 4 * sel.ram.level : null,
      loads: { cpu: load('cpu'), ram: load('ram'), gpu: load('gpu'), rom: load('rom') }
    };
  }
}
module.exports = ComputerSimulator;