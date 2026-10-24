/* Gestor de audio de TecnoKids.
   Los archivos viven en public/audio/ y se piden como /audio/<nombre>.
   Guarda las preferencias en localStorage y nunca interrumpe la app:
   si un archivo todavía no existe, solo lo avisa por consola. */
(function (global) {
  const KEY = 'tecnokids.audio';
  const DIR = '/audio/';
  const MAX_VOICES = 6; // cuántos efectos iguales pueden sonar a la vez
  // Efectos de sonido (SFX) y música de fondo (BGM) disponibles.
  const SFX_FILES = {
    click: 'click.mp3', correct: 'correct.mp3', wrong: 'wrong.mp3', coin: 'coin.mp3',
    star: 'star.mp3', win: 'win.mp3', lose: 'lose.mp3', crash: 'crash.mp3',
    hit: 'hit.mp3', shoot: 'shoot.mp3', boost: 'boost.mp3', wheel: 'sfx-wheel.mp3'
  };
  const BGM_FILES = { menu: 'bgm-menu.mp3', game: 'bgm-game.mp3' };
  const DEF = { muted: false, bgmVolume: 60, sfxVolume: 80 };

  const clamp = (v, min, max) => Math.min(max, Math.max(min, Number(v) || 0));
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY)) || {};
      return {
        muted: !!s.muted,
        bgmVolume: clamp(s.bgmVolume != null ? s.bgmVolume : DEF.bgmVolume, 0, 100),
        sfxVolume: clamp(s.sfxVolume != null ? s.sfxVolume : DEF.sfxVolume, 0, 100)
      };
    } catch (e) { return { ...DEF }; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* modo privado: se ignora */ }
  }

  let prefs = load();
  let bgm = null;              // elemento reutilizado para la música
  let currentBgm = null;       // nombre de la pista que debería estar sonando
  const pools = {};            // voces reutilizables por cada efecto
  const missing = new Set();   // archivos que no se pudieron cargar

  function warn(name, file) {
    const url = DIR + file;
    if (missing.has(url)) return;
    missing.add(url);
    console.warn(`[audio] No se encontró ${url} (sonido "${name}"). Agrégalo a public/audio/ para escucharlo.`);
  }

  function voice(name) {
    if (!pools[name]) pools[name] = { list: [], i: 0 };
    const pool = pools[name];
    if (pool.list.length < MAX_VOICES) {
      const a = new Audio(DIR + SFX_FILES[name]);
      a.preload = 'auto';
      a.addEventListener('error', () => warn(name, SFX_FILES[name]));
      pool.list.push(a);
    }
    const a = pool.list[pool.i % pool.list.length];
    pool.i++;
    return a;
  }

  // Los navegadores bloquean el audio hasta que el niño toca la pantalla: reintentamos al primer toque.
  function unlock() {
    if (currentBgm && !prefs.muted) playBGM(currentBgm, true);
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev =>
    global.addEventListener(ev, function once() {
      global.removeEventListener(ev, once);
      unlock();
    }, { once: true, passive: true }));

  function applyBgm() {
    if (bgm) bgm.volume = prefs.muted ? 0 : prefs.bgmVolume / 100;
  }

  function playSound(name) {
    if (prefs.muted || prefs.sfxVolume <= 0 || !SFX_FILES[name]) return;
    const a = voice(name);
    a.volume = prefs.sfxVolume / 100;
    try { a.currentTime = 0; } catch (e) { /* aún no cargado */ }
    a.play().catch(() => { /* archivo ausente o bloqueado: no pasa nada */ });
  }

  function playBGM(name, force) {
    if (!BGM_FILES[name]) name = 'menu';
    if (!force && currentBgm === name && bgm && !bgm.paused) return; // ya está sonando
    currentBgm = name;
    if (!bgm) {
      bgm = new Audio();
      bgm.loop = true;
      bgm.addEventListener('error', () => warn(bgm.dataset, BGM_FILES[bgm.dataset]));
    }
    if (bgm.dataset !== name) { bgm.dataset = name; bgm.src = DIR + BGM_FILES[name]; }
    applyBgm();
    if (prefs.muted) { bgm.pause(); return; }
    bgm.play().catch(() => { /* bloqueado hasta el primer toque */ });
  }

  function stopBGM() {
    currentBgm = null;
    if (!bgm) return;
    bgm.pause();
    try { bgm.currentTime = 0; } catch (e) { /* nada */ }
  }

  function setSfxVolume(v) { prefs.sfxVolume = Math.round(clamp(v, 0, 100)); save(); return prefs.sfxVolume; }
  function setBgmVolume(v) { prefs.bgmVolume = Math.round(clamp(v, 0, 100)); applyBgm(); save(); return prefs.bgmVolume; }

  function setMuted(v) {
    prefs.muted = !!v;
    applyBgm();
    save();
    if (prefs.muted) { if (bgm) bgm.pause(); }
    else if (currentBgm) playBGM(currentBgm, true);
    return prefs.muted;
  }

  global.SoundManager = {
    playSound, playBGM, stopBGM, setSfxVolume, setBgmVolume,
    setMuted, toggleMuted: () => setMuted(!prefs.muted),
    isMuted: () => prefs.muted,
    getSettings: () => ({ ...prefs }),
    unlock
  };
})(typeof window !== 'undefined' ? window : globalThis);
