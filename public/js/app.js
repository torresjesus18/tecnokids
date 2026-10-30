// Aplicación de una sola página: rutas, vistas, estado de sesión e integración de juegos.
const app = document.querySelector('#app');
const sm = window.SoundManager;
let me = null, currentGame = null, currentKind = 'cpu';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const byteGreeting = `<div class="byte-welcome">
  <div>
    <p id="byte-greeting" class="byte-greeting-text">¡Hola! Soy Byte. ¿Necesitas ayuda para empezar?</p>
    <button class="btn btn-sm btn-tk alt speak-btn byte-greeting-voice" type="button" data-speak-sel="#byte-greeting">🔊 Escuchar saludo</button>
  </div>
</div>`;
async function api(url, method = 'GET', body) {
  // Todas las peticiones conservan la cookie de sesión y convierten respuestas HTTP en errores visibles.
  const r = await fetch('/api' + url, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(d.error || 'Algo salió mal'); e.status = r.status; throw e; }
  return d;
}
const stars = n => `<span class="stars" aria-label="${n} de 3 estrellas">${'<b>★</b>'.repeat(n)}${'★'.repeat(3 - n)}</span>`;
const bar = p => `<div class="progress" role="progressbar" aria-valuenow="${p.percentToNext}" aria-valuemin="0" aria-valuemax="100"><div class="progress-bar" style="width:${Math.max(p.percentToNext, 8)}%">${p.points} pts</div></div>`;
const levelCircle = p => {
  const radius = 44, circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, p.percentToNext));
  const offset = circumference * (1 - progress / 100);
  const remaining = p.nextLevelAt - p.points;
  return `<div class="level-circle-wrapper" role="img" aria-label="Nivel ${p.level}, ${p.xpIntoLevel} de ${p.xpForNextLevel} XP para el siguiente nivel">
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <circle class="level-circle-bg" cx="50" cy="50" r="${radius}"></circle>
      <circle class="level-circle-fill" cx="50" cy="50" r="${radius}" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"></circle>
    </svg>
    <div class="level-circle-content"><span class="level-tag">NIVEL</span><span class="level-num">${p.level}</span></div>
  </div>
  <div class="xp-detail">${p.xpIntoLevel} / ${p.xpForNextLevel} XP</div>
  <div class="xp-subtext">¡Te faltan ${remaining} pts para el siguiente nivel!</div>`;
};
const chip = pv => pv.status === 'ok' ? '✅ Va fluido' : pv.status === 'limited' ? '⚠️ Va con tirones' : pv.crashAfterSec != null ? '⛔ Se cierra solo' : '🔴 Va muy lento';
const show = html => { SpeechManager.stopSpeaking(); app.innerHTML = html; app.focus({ preventScroll: true }); window.scrollTo(0, 0); };
const err = e => `<div class="alert alert-danger mt-3" role="alert">${esc(e.message)}</div>`;
const GAME_CONTROLS = {
  carrera: [['⬅️', '➡️', 'Cambiar de carril'], ['👆', 'Toca un lado de la pantalla']],
  'taller-ensamblaje': [['🖱️', 'Arrastra una pieza al espacio resaltado'], ['👆', 'Toca pieza y luego el espacio']],
  'renderizado-gpu': [['⬅️', '⬆️', '➡️', '⬇️', 'Pilotar con flechas o WASD'], ['👆', 'Arrastra el cohete']],
  clasificador: [['⬅️', '➡️', 'Mover la cesta'], ['👆', 'Desliza para mover']],
  defensa: [['⬅️', '➡️', 'Mover la nave'], ['👆', 'Arrastra para apuntar']],
  'ciber-guardian': [['👆', 'Toca los virus para eliminarlos']],
  'organizador-disco': [['⬅️', '➡️', 'Mover'], ['⬇️', 'Acelerar'], ['⬆️', 'Girar'], ['⎵', 'Soltar']],
  'laberinto-datos': [['⬆️', '⬅️', '⬇️', '➡️', 'Mover a Byte'], ['WASD', 'Mover a Byte'], ['👆', 'Usa las flechas en pantalla']]
};
const gameControlBadges = id => (GAME_CONTROLS[id] || [['🎮', 'Sigue las instrucciones en pantalla']])
  .map(parts => {
    const label = parts[parts.length - 1];
    const keys = parts.slice(0, -1).join(' ');
    return `<span class="key-badge"><span class="key-icons">${keys}</span>${esc(label)}</span>`;
  }).join('');
const KINDS = {
  cpu: ['🧠', 'Procesador', 'Es el cerebro del PC. Si es lento, el juego se congela a ratos.'],
  ram: ['🧩', 'Memoria', 'Guarda lo que el juego está usando. Si se llena, el juego se cierra.'],
  gpu: ['🎨', 'Tarjeta gráfica', 'Dibuja las imágenes. Si es débil, se ve entrecortado y sin efectos.'],
  rom: ['💾', 'ROM · Almacenamiento', 'Guarda el sistema y los archivos del juego. Con más espacio, los juegos cargan más rápido.']
};
const wait = ms => { const m = Math.ceil(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; };
const DIFF_LABEL = { facil: 'Fácil', medio: 'Medio', dificil: 'Difícil' };
const teamSection = `<section class="team-section mt-4" aria-labelledby="team-title">
  <div class="team-heading"><span class="team-tag">👥 CIPA</span><h2 id="team-title">MSI Team</h2><p>Aprendemos y creamos en equipo.</p></div>
  <div class="team-members">
    <div class="team-member"><span aria-hidden="true">👩‍💻</span><strong>Karoll Rodríguez</strong></div>
    <div class="team-member"><span aria-hidden="true">👨‍💻</span><strong>Camilo Correa</strong></div>
    <div class="team-member"><span aria-hidden="true">👨‍🚀</span><strong>Jesús Torres</strong></div>
    <div class="team-member"><span aria-hidden="true">👨‍💻</span><strong>Wiston</strong></div>
  </div>
</section>`;

// Ajustes de sonido (⚙️): interruptor general y volúmenes de música y efectos.
function initSettings() {
  const modalEl = document.querySelector('#settings');
  if (!sm || !modalEl) return;
  const on = document.querySelector('#set-sonido'), bgm = document.querySelector('#set-bgm'), sfx = document.querySelector('#set-sfx');
  const bgmVal = document.querySelector('#set-bgm-val'), sfxVal = document.querySelector('#set-sfx-val'), estado = document.querySelector('#set-estado');
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  const draw = () => {
    const s = sm.getSettings();
    on.checked = !s.muted; estado.textContent = s.muted ? 'desactivado' : 'activado';
    bgm.value = s.bgmVolume; bgmVal.textContent = s.bgmVolume;
    sfx.value = s.sfxVolume; sfxVal.textContent = s.sfxVolume;
  };
  // El botón ⚙️ vive en el menú, que se dibuja en cada ruta: se escucha por delegación.
  document.addEventListener('click', e => { if (e.target.closest('#btn-settings')) { draw(); modal.show(); } });
  on.onchange = () => { sm.setMuted(!on.checked); if (!on.checked) SpeechManager.stopSpeaking(); draw(); sm.playSound('click'); };
  bgm.oninput = () => { sm.setBgmVolume(bgm.value); bgmVal.textContent = bgm.value; };
  sfx.oninput = () => { sm.setSfxVolume(sfx.value); sfxVal.textContent = sfx.value; };
  sfx.onchange = () => sm.playSound('star');
  modalEl.addEventListener('shown.bs.modal', draw);
  draw();
  // Un "clic" suave para todos los botones y enlaces de la aplicación.
  document.addEventListener('click', e => { if (e.target.closest('.btn, .nav-link, .opt, .part')) sm.playSound('click'); });
}

// Ruleta de Recompensas (🎡). La animación es decorativa: el premio lo sortea el servidor.
function openRoulette() {
  const modalEl = document.querySelector('#roulette');
  if (modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

function confetti(host) {
  const cols = ['#ffcf33', '#35e0b2', '#ff6b81', '#7c6bff', '#5ad1ff'];
  for (let i = 0; i < 28; i++) {
    const s = document.createElement('i');
    s.className = 'confetti';
    s.style.left = Math.random() * 96 + '%';
    s.style.background = cols[i % cols.length];
    s.style.animationDelay = (Math.random() * 0.5).toFixed(2) + 's';
    host.appendChild(s);
    setTimeout(() => s.remove(), 3000);
  }
}

function initRoulette() {
  const modalEl = document.querySelector('#roulette');
  if (!modalEl) return;
  const cv = document.querySelector('#wheel'), c = cv.getContext('2d');
  const msg = document.querySelector('#wheel-msg'), state = document.querySelector('#wheel-state'), go = document.querySelector('#wheel-go');
  const wheelWrap = modalEl.querySelector('.wheel-wrap');
  const COLS = ['#ffcf33', '#35e0b2', '#7c6bff', '#ff6b81', '#5ad1ff', '#ffa94d'];
  const WHEEL_SEGMENTS = 6;
  let prizes = [], rot = 0, spinning = false, raf = null, spinId = 0;

  const draw = () => {
    const W = cv.width, H = cv.height, cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 18;
    c.clearRect(0, 0, W, H);
    if (prizes.length !== WHEEL_SEGMENTS) return;
    // Los sectores son iguales; cada índice conserva el mismo premio que entrega el servidor.
    const step = Math.PI * 2 / WHEEL_SEGMENTS;
    for (let i = 0; i < WHEEL_SEGMENTS; i++) {
      const prize = prizes[i];
      const a0 = rot + i * step;
      c.save();
      c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, R, a0, a0 + step); c.closePath();
      c.clip();
      // El degradado radial y el brillo conservan el relieve sin alterar los límites del sector.
      const shade = c.createRadialGradient(cx, cy, 14, cx, cy, R);
      shade.addColorStop(0, COLS[i % COLS.length]);
      shade.addColorStop(0.2, COLS[i % COLS.length]);
      shade.addColorStop(1, '#241d68');
      c.fillStyle = shade; c.fillRect(0, 0, W, H);
      const sheen = c.createLinearGradient(0, cy - R, W, cy + R);
      sheen.addColorStop(0, 'rgba(255,255,255,.2)');
      sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
      sheen.addColorStop(1, 'rgba(10,8,50,.12)');
      c.fillStyle = sheen; c.fillRect(0, 0, W, H);
      c.restore();
      c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, R, a0, a0 + step); c.closePath();
      c.strokeStyle = 'rgba(255,255,255,.82)'; c.lineWidth = 1.25;
      c.shadowColor = 'rgba(22,18,74,.35)'; c.shadowBlur = 4; c.stroke();
      c.shadowBlur = 0;
      // Las etiquetas se ubican en el radio medio y se voltean si quedarían al revés.
      const mid = a0 + step / 2, labelRadius = R * 0.59;
      c.save(); c.translate(cx + Math.cos(mid) * labelRadius, cy + Math.sin(mid) * labelRadius);
      c.rotate(mid + Math.PI / 2);
      const textAngle = ((mid + Math.PI / 2) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      if (textAngle > Math.PI / 2 && textAngle < Math.PI * 1.5) c.rotate(Math.PI);
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = '27px sans-serif';
      c.fillStyle = '#fff';
      c.strokeStyle = '#241d68'; c.lineWidth = 3.5;
      c.shadowColor = 'rgba(20,15,62,.75)'; c.shadowBlur = 3;
      c.strokeText(prize.icon, 0, -16);
      c.fillText(prize.icon, 0, -16);
      c.font = '900 22px Trebuchet MS, sans-serif';
      c.strokeText(String(prize.coins), 0, 14);
      c.fillText(String(prize.coins), 0, 14);
      c.restore();
    }
  };

  const load = async () => {
    const d = await api('/roulette');
    // El dibujo y el índice del resultado dependen del mismo orden de seis premios.
    if (!d || !Array.isArray(d.prizes) || d.prizes.length !== WHEEL_SEGMENTS
      || d.prizes.some(prize => !prize || !Number.isFinite(prize.coins) || typeof prize.icon !== 'string')) {
      throw new Error('No se pudieron cargar los seis premios de la ruleta.');
    }
    prizes = d.prizes; rot = 0; draw();
    msg.textContent = '¡Prueba tu suerte!';
    state.textContent = d.free ? '🎁 Tienes un giro gratis.' : `Giro gratis en ${wait(d.nextFreeIn)}`;
    go.textContent = d.free ? 'Girar gratis' : `Girar ${d.cost} 🪙`;
    go.disabled = !d.free && d.coins < d.cost;
  };

  const spin = async () => {
    if (spinning) return;
    const currentSpin = ++spinId;
    // Desactiva el botón durante la petición para evitar dobles giros concurrentes.
    spinning = true; go.disabled = true; msg.textContent = '¡Girando!'; wheelWrap.classList.add('spinning');
    sm.playSound('wheel');
    let r;
    try {
      r = await api('/roulette/spin', 'POST');
      const selectedPrize = r && Number.isInteger(r.index) ? prizes[r.index] : null;
      if (!selectedPrize || !r.prize || selectedPrize.coins !== r.prize.coins
        || typeof r.prize.name !== 'string' || typeof r.prize.icon !== 'string'
        || !Number.isFinite(r.coins) || !Number.isFinite(r.nextCost)
        || !Number.isFinite(r.nextFreeIn) || !Array.isArray(r.newAchievements)) {
        throw new Error('El resultado recibido no coincide con los premios de la ruleta.');
      }
    }
    catch (x) {
      if (currentSpin !== spinId) return;
      spinning = false; wheelWrap.classList.remove('spinning'); msg.textContent = x.message;
      try { await load(); }
      catch (refreshError) { state.textContent = `No pudimos actualizar la ruleta: ${refreshError.message}`; }
      msg.textContent = x.message;
      return;
    }
    if (currentSpin !== spinId) return;
    // Se anima hacia el centro del sector cuyo índice eligió el servidor.
    const base = -Math.PI / 2 - (r.index + 0.5) * Math.PI * 2 / WHEEL_SEGMENTS;
    const from = rot;
    const delta = Math.PI * 2 * 4 + (((base - from) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const t0 = performance.now(), dur = 2800;
    const anim = now => {
      if (currentSpin !== spinId) return;
      // Una curva de salida desacelera el giro antes de detenerse en el premio recibido.
      const k = Math.min(1, (now - t0) / dur);
      rot = from + delta * (1 - Math.pow(1 - k, 3));
      draw();
      if (k < 1) return void (raf = requestAnimationFrame(anim));
      spinning = false;
      wheelWrap.classList.remove('spinning');
      sm.playSound('win'); confetti(wheelWrap);
      msg.textContent = `${r.prize.icon} ¡Ganaste ${r.prize.name}!`;
      state.textContent = `Ahora tienes ${r.coins} 🪙 · Giro gratis en ${wait(r.nextFreeIn)}`
        + r.newAchievements.map(a => ` · ${a.icon} Insignia nueva: ${a.name}`).join('');
      go.textContent = `Girar ${r.nextCost} 🪙`;
      go.disabled = r.coins < r.nextCost;
    };
    raf = requestAnimationFrame(anim);
  };

  go.onclick = spin;
  modalEl.addEventListener('shown.bs.modal', () => { load().catch(x => { msg.textContent = x.message; }); });
  modalEl.addEventListener('hidden.bs.modal', () => {
    // Invalida respuestas tardías para no dejar un giro colgado al cerrar el modal.
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    spinId++;
    spinning = false;
    wheelWrap.classList.remove('spinning');
  });
}

function renderNav(current) {
  // Íconos grandes junto al texto: pensado para niños que todavía no leen.
  const links = me
    ? [['#/mundo', '🏠', 'Mi Mundo'], ['#/mi-pc', '💻', 'Mi PC'], ['#/progreso', '🏆', 'Mi Progreso']]
    : [['#/entrar', '🔑', 'Entrar']];
  document.querySelector('#nav-links').innerHTML =
    links.map(([h, ico, t]) =>
      `<li class="nav-item"><a class="nav-link ${current === h ? 'active' : ''}" href="${h}"><span class="ico" aria-hidden="true">${ico}</span>${t}</a></li>`).join('') +
    `<li class="nav-item"><button class="nav-link" type="button" id="btn-settings"><span class="ico" aria-hidden="true">⚙️</span>Ajustes</button></li>` +
    (me ? `<li class="nav-item"><a class="nav-link" href="#" id="logout"><span class="ico" aria-hidden="true">🚪</span>Salir <small>(${esc(me.username)})</small></a></li>` : '');
  const lo = document.querySelector('#logout');
  if (lo) lo.onclick = async e => { e.preventDefault(); await api('/auth/logout', 'POST'); me = null; location.hash = '#/'; route(); };
}

// Vistas SPA: cada función dibuja el contenido de una ruta dentro de #app.
function viewWelcome() {
  show(`<section class="hero row align-items-center g-4">
    <div class="col-lg-7"><h1>Arma tu PC y pruébalo jugando.</h1>
      <p class="fs-5 my-3" data-speak="Corre carreras y defiende la galaxia. Si tu computador es lento, el juego se traba. ¡Gana monedas, compra mejores piezas y míralo volar!">Corre carreras y defiende la galaxia. Si tu computador es lento, el juego se traba. ¡Gana monedas, compra mejores piezas y míralo volar!</p>
      <a class="btn btn-tk btn-lg" href="${me ? '#/mundo' : '#/entrar/registro'}">${me ? 'Seguir jugando' : 'Crear mi cuenta'}</a>
      ${me ? '' : '<a class="btn btn-tk alt btn-lg ms-2" href="#/entrar">Ya tengo cuenta</a>'}</div>
    <div class="col-lg-5 byte-slot" id="byte-slot">${byteGreeting}</div></section>
    <section class="row g-3 mt-2">
      ${[['🏎️', 'Prueba tu PC jugando', 'Cada juego usa tu procesador, tu memoria y tu tarjeta gráfica.'], ['🪙', 'Gana monedas', 'Mientras mejor te vaya, más monedas ganas.'], ['🛠️', 'Mejora tus piezas', 'Compra componentes y descubre qué cambia en el juego.']]
        .map(([i, t, d]) => `<div class="col-md-4"><div class="mission"><div class="emoji">${i}</div><h3 class="h4">${t}</h3><p class="mb-0">${d}</p></div></div>`).join('')}
    </section>
    ${teamSection}`);
}

function viewAuth(start) {
  show(`<div class="row justify-content-center"><div class="col-md-8 col-lg-6"><div class="panel">
    <ul class="nav nav-pills mb-3" role="tablist"><li class="nav-item"><button class="nav-link active" id="t-login" type="button">Ya tengo cuenta</button></li>
    <li class="nav-item"><button class="nav-link" id="t-reg" type="button">Soy nuevo</button></li></ul>
    <form id="f" class="needs-validation" novalidate></form><div id="msg"></div></div></div></div>`);
  const f = document.querySelector('#f');
  let mode = start === 'registro' ? 'reg' : 'login';
  const draw = () => {
    f.classList.remove('was-validated');
    f.innerHTML = `${mode === 'reg' ? `<div class="mb-3">
        <label class="form-label fw-bold" for="u">Tu alias (no uses tu nombre real)</label>
        <input class="form-control" id="u" maxlength="20" minlength="3" pattern="[A-Za-z0-9_]{3,20}" title="Usa de 3 a 20 letras, números o guion bajo." required autocomplete="username">
        <div class="invalid-feedback">Usa de 3 a 20 letras, números o guion bajo.</div>
      </div>` : ''}
      <div class="mb-3">
        <label class="form-label fw-bold" for="e">Correo de tu mamá, papá o un adulto</label>
        <input class="form-control" id="e" type="email" maxlength="120" required autocomplete="email">
        <div class="form-text">Lo usamos solo para tu cuenta.</div>
        <div class="invalid-feedback">Escribe un correo, por ejemplo: nombre@correo.com 🙂</div>
      </div>
      <div class="mb-3">
        <label class="form-label fw-bold" for="p">Contraseña (mínimo 8 caracteres)</label>
        <div class="input-group">
          <input class="form-control" id="p" type="password" minlength="8" maxlength="72" required autocomplete="${mode === 'reg' ? 'new-password' : 'current-password'}">
          <button class="btn btn-outline-secondary" id="toggle-password" type="button" aria-controls="p" aria-pressed="false">👁 Mostrar</button>
          <div class="invalid-feedback">La contraseña debe tener entre 8 y 72 caracteres.</div>
        </div>
      </div>
      ${mode === 'reg' ? `<fieldset class="mb-3">
          <legend class="form-label fw-bold mb-2">🧩 ¿Qué pieza del PC te da más curiosidad?</legend>
          <select class="form-select" id="pieza-favorita" required>
            <option value="" selected disabled>Elige una…</option>
            <option value="cpu">Procesador</option>
            <option value="ram">Memoria</option>
            <option value="gpu">Tarjeta gráfica</option>
            <option value="rom">Almacenamiento</option>
          </select>
          <div class="invalid-feedback">Elige una pieza para continuar 🙂</div>
        </fieldset>
        <fieldset class="mb-3">
          <legend class="form-label fw-bold mb-2">🎮 ¿Con qué dificultad quieres empezar?</legend>
          <div class="form-check">
            <input class="form-check-input" type="radio" name="dificultad-inicial" id="dificultad-facil" value="facil" required checked>
            <label class="form-check-label" for="dificultad-facil">🟢 Fácil</label>
            <div class="invalid-feedback">Elige una dificultad para empezar 🙂</div>
          </div>
          <div class="form-check">
            <input class="form-check-input" type="radio" name="dificultad-inicial" id="dificultad-medio" value="medio" required>
            <label class="form-check-label" for="dificultad-medio">🟡 Medio</label>
          </div>
          <div class="form-check">
            <input class="form-check-input" type="radio" name="dificultad-inicial" id="dificultad-dificil" value="dificil" required>
            <label class="form-check-label" for="dificultad-dificil">🔴 Difícil</label>
          </div>
        </fieldset>
        <div class="mb-3">
          <label class="form-label fw-bold" for="nombre-pc">🤖 Ponle un nombre a tu PC (no uses tu nombre real)</label>
          <textarea class="form-control" id="nombre-pc" maxlength="40" rows="2" placeholder="Ejemplo: PC Galáctica"></textarea>
          <div class="form-text">Opcional. Este nombre no se guarda.</div>
        </div>
        <div class="form-check mb-3">
          <input class="form-check-input" type="checkbox" id="adulto" required>
          <label class="form-check-label" for="adulto">👨‍👩‍👧 Un adulto sabe que voy a jugar.</label>
          <div class="invalid-feedback">Pídele a un adulto que te ayude con este paso 🙂</div>
        </div>
        <p class="form-text">La pieza y la dificultad que elegiste no se guardan en tu cuenta.</p>` : ''}
      <button class="btn btn-tk w-100" type="submit">${mode === 'reg' ? 'Crear mi cuenta' : 'Entrar'}</button>
      <p class="text-center mt-3 mb-0">${mode === 'reg' ? '¿Ya tienes cuenta?' : '¿Primera vez aquí?'} <a href="#" id="sw" class="fw-bold">${mode === 'reg' ? 'Entra aquí' : 'Crea tu cuenta'}</a></p>`;
    document.querySelector('#toggle-password').onclick = e => {
      const input = document.querySelector('#p');
      const visible = input.type === 'password';
      input.type = visible ? 'text' : 'password';
      e.currentTarget.textContent = visible ? '🙈 Ocultar' : '👁 Mostrar';
      e.currentTarget.setAttribute('aria-pressed', String(visible));
    };
    document.querySelector('#sw').onclick = e => { e.preventDefault(); mode = mode === 'reg' ? 'login' : 'reg'; draw(); };
    document.querySelector('#t-login').classList.toggle('active', mode === 'login');
    document.querySelector('#t-reg').classList.toggle('active', mode === 'reg');
    document.querySelector('#msg').innerHTML = '';
  };
  document.querySelector('#t-login').onclick = () => { mode = 'login'; draw(); };
  document.querySelector('#t-reg').onclick = () => { mode = 'reg'; draw(); };
  f.onsubmit = async e => {
    e.preventDefault();
    if (!f.checkValidity()) {
      e.stopPropagation();
      f.classList.add('was-validated');
      return;
    }
    f.classList.add('was-validated');
    const v = id => (document.querySelector('#' + id) || {}).value || '';
    const body = mode === 'reg' ? { username: v('u').trim(), email: v('e').trim(), password: v('p') } : { email: v('e').trim(), password: v('p') };
    try { me = await api('/auth/' + (mode === 'reg' ? 'register' : 'login'), 'POST', body); location.hash = '#/mundo'; route(); }
    catch (x) { document.querySelector('#msg').innerHTML = err(x); }
  };
  draw();
}

const partLine = (pc, k) => { const p = pc.catalog[k].find(x => x.code === pc.equipped[k]); return `<li>${p.icon} ${esc(p.name)} <small>· ${esc(p.spec)}</small></li>`; };

async function viewWorld() {
  const routeHash = location.hash;
  const [d, pc, rl] = await Promise.all([api('/progress'), api('/pc'), api('/roulette')]);
  if (location.hash !== routeHash) return;
  const canBuyUpgrade = Object.entries(pc.catalog).some(([kind, parts]) => {
    const equipped = parts.find(part => part.code === pc.equipped[kind]);
    return parts.some(part => part.level > equipped.level && !pc.owned.includes(part.code) && part.price <= pc.coins);
  });
  const equippedParts = Object.entries(pc.catalog).map(([kind, parts]) => {
    const part = parts.find(item => item.code === pc.equipped[kind]);
    return `<li>${part.icon} ${esc(part.name)}</li>`;
  }).join('');
  show(`<div class="byte-slot byte-slot-world" id="byte-slot">${byteGreeting}</div>
    <div class="world-actions row g-3 my-2">
      <div class="col-lg-4"><div class="panel world-action-card level-card">
        <div class="d-flex justify-content-end fw-bold"><span class="coins-pill">🪙 ${pc.coins}</span></div>
        <div class="level-progress-content">${levelCircle(d.progress)}</div>
        <a class="btn btn-tk alt world-action-button" href="#/progreso">Ver Logros 🏆</a>
      </div></div>
      <div class="col-lg-4"><div class="panel world-action-card text-center">
        <h2 class="h4">Arma tu PC</h2>
        ${canBuyUpgrade
          ? '<p class="pc-upgrade-badge">¡Puedes mejorar tu PC! 💡</p>'
          : `<ul class="pc-equipped-summary">${equippedParts}</ul>`}
        <a class="btn btn-tk alt world-action-button" href="#/mi-pc">Armar mi PC</a>
      </div></div>
      <div class="col-lg-4"><div class="mission hw world-action-card ruleta-card">
        <h3 class="card-title">Ruleta Tecno</h3>
        <img src="/img/ruleta.png" alt="Ruleta Tecno" class="ruleta-card-img">
        <p class="card-desc">${rl.free ? 'Premios de 5 a 80 🪙 · Giro gratis disponible' : `Premios de 5 a 80 🪙 · Gratis en ${wait(rl.nextFreeIn)}`}</p>
        <button class="btn btn-tk world-action-button btn-action" type="button" id="btn-ruleta">${rl.free ? 'Girar gratis' : `Girar ${rl.cost} 🪙`}</button>
      </div></div>
    </div>
    <div class="row g-3">${Object.entries(pc.games).map(([id, g]) => {
      const cover = id === 'taller-ensamblaje' ? '/img/ensamblaje/gabinete-abierto.webp'
        : id === 'renderizado-gpu' ? '/img/renderizado.webp' : `/img/${id}.webp`;
      const coverFallback = id === 'taller-ensamblaje'
        ? 'this.hidden=true'
        : `this.src='https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=${encodeURIComponent('futuristic game landscape 3d cartoon style')}&image_size=landscape_16_9'`;
      const coverMarkup = `<img src="${cover}" class="mission-img" alt="${id === 'taller-ensamblaje' ? 'Gabinete abierto para ensamblar un computador' : esc(g.name)}" onerror="${coverFallback}">`;
      const rating = g.rating
        ? `<span class="rating-stars" aria-label="Calificación ${g.rating} de 5">${'★'.repeat(g.rating)}${'☆'.repeat(5 - g.rating)} <small>${g.rating}/5</small></span>`
        : stars((d.missions.find(m => m.slug === id) || { stars: 0 }).stars);
      return `<div class="col-md-6"><a class="mission game-card" href="#/juego/${id}" aria-label="Jugar ${esc(g.name)}">
      ${coverMarkup}
      <div class="mission-body">
        <h3 class="h4">${g.icon} ${esc(g.name)}</h3>${g.badge ? `<span class="game-badge">${esc(g.badge)}</span>` : ''}<p class="flex-grow-1">${esc(g.desc)}</p>
        <div class="fw-bold">${pc.previews[id].status === 'fail' ? '⛔ Requiere mejoras' : pc.previews[id].status === 'ok' ? '✅ Va fluido' : '⚠️ Va con tirones'}</div>
        <div class="d-flex justify-content-between align-items-center mt-2">
          ${rating}
          <span class="btn btn-tk alt">${esc(g.action || '¡Jugar!')}</span>
        </div>
      </div>
    </a></div>`;
    }).join('')}
    </div>
    ${teamSection}`);
  document.querySelector('#btn-ruleta').onclick = openRoulette;
}

async function viewPc(note, upgrade) {
  const d = await api('/pc');
  if (location.hash !== '#/mi-pc') return;
  const cat = KINDS[currentKind];
  
  show(`<div class="garage">
    <div class="garage-header">
      <a class="btn btn-tk alt" href="#/mundo">◀ ATRÁS</a>
      <div class="coins-pill">🪙 ${d.coins}</div>
    </div>

    ${note ? `<div class="alert alert-success py-2 mb-2" role="status">${note}</div>` : ''}
    <div id="fb"></div>

    <div class="garage-body">
      <!-- Vista central del PC -->
      <div class="garage-pc-view">
        <div class="pc-case ${note ? 'upgrade' : ''}" aria-hidden="true">🖥️</div>
        <div class="pc-slots">
          ${Object.entries(KINDS).map(([k, [icon, label]]) => {
            const equipped = d.catalog[k].find(p => p.code === d.equipped[k]);
            return `<button class="pc-slot ${currentKind === k ? 'active' : ''}" type="button" data-kind="${k}" aria-pressed="${currentKind === k}" aria-label="Ver ${label}">
              <span class="ico">${equipped ? equipped.icon : icon}</span>
              <span class="label">${label}</span>
            </button>`;
          }).join('')}
        </div>
      </div>

      <!-- Panel lateral de piezas -->
      <div class="garage-side">
        <h3 class="h5 mb-2">${cat[0]} ${cat[1]}</h3>
        <p class="small mb-3" data-speak="${esc(cat[2])}">${cat[2]}</p>
        
        ${d.catalog[currentKind].map(p => {
          const owned = d.owned.includes(p.code), on = d.equipped[currentKind] === p.code;
          const equipped = d.catalog[currentKind].find(part => part.code === d.equipped[currentKind]);
          const delta = on ? '' : componentSpecDelta(equipped, p);
          const deltaDirection = p.level > equipped.level ? 'up' : p.level < equipped.level ? 'down' : 'same';
          return `<div class="garage-item ${on ? 'active on' : ''}" data-component="${p.code}">
            <span class="ico">${p.icon}</span>
            <div class="info">
              <span class="name">${esc(p.name)}</span>
              <span class="spec">${esc(p.spec)}</span>
              ${delta ? `<span class="component-delta ${deltaDirection}">${delta}</span>` : ''}
            </div>
            <div class="action">
              ${on ? `<span class="component-equipped" aria-current="true">EQUIPADO · NIVEL ${p.level}</span>` : owned
                ? `<button class="btn btn-sm btn-tk alt garage-equip" type="button" data-eq="${currentKind}:${p.code}">Equipar · Nivel ${p.level}</button>`
                : `<button class="btn btn-sm btn-tk garage-buy" type="button" data-buy="${p.code}" ${d.coins < p.price ? 'disabled' : ''}>${d.coins < p.price ? '🔒 ' : ''}Comprar 🪙 ${p.price}</button>`}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <div class="garage-footer">
      <button class="btn btn-tk alt" onclick="openRoulette()">Ruleta 🎡</button>
      <a class="btn btn-tk" href="#/mundo">🏠 Inicio</a>
    </div>
  </div>`);

  const upgradeTimers = new WeakMap();
  const animateUpgrade = (item, direction = 'up') => {
    [item, app.querySelector('.garage-pc-view')].filter(Boolean).forEach(el => {
      clearTimeout(upgradeTimers.get(el));
      el.classList.remove('upgrade-glow', 'upgrade-up', 'upgrade-down');
      void el.offsetWidth;
      el.classList.add('upgrade-glow', direction === 'down' ? 'upgrade-down' : 'upgrade-up');
      upgradeTimers.set(el, setTimeout(() => el.classList.remove('upgrade-glow', 'upgrade-up', 'upgrade-down'), 600));
    });
  };

  if (upgrade) {
    const item = Array.from(app.querySelectorAll('[data-component]')).find(el => el.dataset.component === upgrade.code);
    animateUpgrade(item, upgrade.direction);
  }

  // Eventos de categorías
  app.querySelectorAll('[data-kind]').forEach(s => s.onclick = () => {
    currentKind = s.dataset.kind;
    viewPc();
  });

  // Comprar
  app.querySelectorAll('[data-buy]').forEach(b => b.onclick = async (e) => {
    e.stopPropagation();
    try {
      const selectedPart = d.catalog[currentKind].find(part => part.code === b.dataset.buy);
      const currentPart = d.catalog[currentKind].find(part => part.code === d.equipped[currentKind]);
      if (!selectedPart || !currentPart) throw new Error('No se pudo identificar el nivel del componente.');
      const direction = selectedPart.level > currentPart.level ? 'up' : 'down';
      const r = await api('/shop/buy', 'POST', { code: b.dataset.buy }); 
      if (location.hash !== '#/mi-pc') return;
      sm.playSound('correct');
      viewPc('¡Pieza comprada! ' + r.newAchievements.map(a => `${a.icon} ${a.name}`).join(', '), { code: b.dataset.buy, direction });
    } catch (x) { const feedback = document.querySelector('#fb'); if (feedback && location.hash === '#/mi-pc') feedback.innerHTML = err(x); }
  });

  // Equipar
  app.querySelectorAll('[data-eq]').forEach(button => button.onclick = async () => {
    const [k, code] = button.dataset.eq.split(':');
    try {
      const currentPart = d.catalog[k].find(part => part.code === d.equipped[k]);
      const selectedPart = d.catalog[k].find(part => part.code === code);
      if (!currentPart || !selectedPart) throw new Error('No se pudo identificar el nivel del componente.');
      const direction = selectedPart.level > currentPart.level ? 'up' : 'down';
      await api('/pc/equip', 'POST', { ...d.equipped, [k]: code }); 
      if (location.hash !== '#/mi-pc') return;
      sm.playSound('correct');
      viewPc('¡PC actualizado!', { code, direction });
    } catch (x) { const feedback = document.querySelector('#fb'); if (feedback && location.hash === '#/mi-pc') feedback.innerHTML = err(x); }
  });
}

// Compara piezas antes de equiparlas y explica cambios de rendimiento al jugador.
function componentSpecDelta(current, candidate) {
  if (!current || !candidate) return '';
  const metrics = spec => Array.from(spec.matchAll(/(\d+(?:[.,]\d+)?)\s*(núcleos|GHz|GB)/gi), match => ({
    unit: match[2].toLowerCase(),
    value: Number(match[1].replace(',', '.'))
  }));
  const currentMetrics = new Map(metrics(current.spec).map(metric => [metric.unit, metric.value]));
  const changes = metrics(candidate.spec).map(metric => ({
    unit: metric.unit,
    value: metric.value - (currentMetrics.get(metric.unit) || 0)
  })).filter(change => change.value !== 0);

  if (changes.length) {
    const format = value => new Intl.NumberFormat('es', { maximumFractionDigits: 2 }).format(Math.abs(value));
    const labels = { 'núcleos': 'núcleos', ghz: 'GHz', gb: 'GB' };
    return changes.map(change => `${change.value > 0 ? '+' : '−'}${format(change.value)} ${labels[change.unit]}`).join(' · ');
  }
  const levelDifference = candidate.level - current.level;
  if (levelDifference) return `Nivel ${levelDifference > 0 ? '+' : '−'}${Math.abs(levelDifference)}`;
  return 'Especificaciones similares';
}

// Antes de arrancar cualquier juego se elige la dificultad: 🟢 Fácil, 🟡 Medio o 🔴 Difícil.
function askDifficulty(gameTitle, onPick) {
  const modalEl = document.querySelector('#difficulty');
  if (!modalEl) return onPick('medio');
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  document.querySelector('#diff-game').innerHTML = gameTitle;
  const pick = e => {
    const b = e.target.closest('[data-diff]');
    if (!b) return;
    done();
    onPick(b.dataset.diff);
  };
  const done = () => { modalEl.removeEventListener('click', pick); modal.hide(); };
  modalEl.addEventListener('click', pick);
  modalEl.addEventListener('hidden.bs.modal', () => modalEl.removeEventListener('click', pick), { once: true });
  modal.show();
}

// Pide la dificultad y arranca la partida directamente, sin pasar por la pantalla de instrucciones.
// Inicia una partida autorizada por el backend y entrega el perfil al motor Canvas.
function startGame(id, g, fb, options = {}) {
  const routeHash = location.hash;
  askDifficulty(`${g.icon} <strong>${esc(g.name)}</strong>`, async diff => {
    if (location.hash !== routeHash) return;
    const renderMode = id === 'renderizado-gpu'
      ? options.renderMode || document.querySelector('#render-mode')?.value
      : undefined;
    try { play(id, g, await api('/games/start', 'POST', { game: id, difficulty: diff, renderMode })); }
    catch (x) {
      const msg = err(x);
      if (fb) fb.innerHTML = msg; else show(`<div class="panel"><h2>Ups</h2>${msg}</div>`);
    }
  });
}

async function viewGame(id) {
  const routeHash = `#/juego/${id}`;
  const d = await api('/pc');
  if (location.hash !== routeHash) return;
  const g = d.games[id];
  if (!g) return viewWelcome();
  const pv = d.previews[id];
  const components = Object.keys(KINDS).map(kind => {
    const part = d.catalog[kind].find(item => item.code === d.equipped[kind]);
    return `<span class="hardware-chip" title="${esc(part.spec)}">${KINDS[kind][0]} ${esc(part.name)}</span>`;
  }).join('');
  const isAssembly = id === 'taller-ensamblaje';
  const isGpuChallenge = id === 'renderizado-gpu';
  const gpuLevel = d.catalog.gpu.find(item => item.code === d.equipped.gpu)?.level || 1;
  show(`<div class="panel game-menu ${isAssembly ? 'game-menu-assembly' : ''}">
    <a class="btn btn-tk alt game-back" href="#/mundo">◀ Atrás</a>
    <div class="game-lobby-grid">
      <section class="game-lobby-action" aria-labelledby="game-lobby-title">
        ${isAssembly
          ? `<div class="assembly-lobby-art" aria-hidden="true"><span class="assembly-art-glow"></span><span class="assembly-art-board">🧩</span><span class="assembly-art-computer">🖥️</span><span class="assembly-art-tool">🔧</span><span class="assembly-art-chip">⚙️</span></div>`
          : isGpuChallenge
            ? `<img src="/img/renderizado.webp" class="game-lobby-cover" alt="Portada de ${esc(g.name)}">`
            : `<img src="/img/${encodeURIComponent(id)}.webp" class="game-lobby-cover" alt="Portada de ${esc(g.name)}" onerror="this.hidden=true">`}
        ${isAssembly ? '<span class="game-lobby-kicker">MISIÓN PRÁCTICA</span>' : ''}
        ${isGpuChallenge ? `<span class="game-lobby-kicker">${esc(g.badge || '⚡ Carrera de Rendimiento')}</span>` : ''}
        <h1 class="h2" id="game-lobby-title">${g.icon} ${esc(g.name)}</h1>
        <p>${esc(g.desc)}</p>
        ${isAssembly ? '<div class="assembly-time-note"><span>⏱️ Tiempo por dificultad</span><strong>Fácil 2:00 <i>·</i> Medio 1:30 <i>·</i> Difícil 1:00</strong></div>' : ''}
        ${isGpuChallenge ? `<div class="render-mode-picker">
          <label for="render-mode">🎨 Calidad gráfica</label>
          <select class="form-select" id="render-mode">
            <option value="retro" ${gpuLevel < 3 ? 'selected' : ''}>🟩 Baja GPU · Integrados · 30 FPS · Retro 8 bits</option>
            <option value="rtx" ${gpuLevel >= 3 ? 'selected' : ''} ${gpuLevel < 3 ? 'disabled' : ''}>🌈 Alta GPU · RTX · 144+ FPS · Neón</option>
          </select>
          <small>${gpuLevel < 3 ? 'Mejora tu GPU a nivel 3 para desbloquear RTX.' : `Tu GPU de nivel ${gpuLevel} admite ambos modos.`}</small>
        </div>` : ''}
        <div class="game-lobby-actions">
          <button class="btn btn-tk alt btn-play-big" id="go" type="button" ${pv.status === 'fail' ? 'disabled' : ''}>${pv.status === 'fail' ? '🔒 Necesitas mejorar tu PC' : '🎮 ¡JUGAR AHORA!'}</button>
          <button class="btn btn-tk speak-btn" type="button" data-speak-sel="#guia">🔊 Escuchar</button>
        </div>
      </section>
      <section class="game-lobby-info" id="guia" aria-label="Estado de la PC, controles y componentes">
        <div class="game-performance ${pv.status}" role="status">${chip(pv)}</div>
        ${pv.status !== 'ok' && pv.tips.length ? `<details class="game-tips"><summary>¿Qué le pasa a mi PC?</summary><ul class="mb-0 mt-2">${pv.tips.map(t => `<li data-speak="${esc(t)}">${esc(t)}</li>`).join('')}</ul></details>` : ''}
        <div class="game-controls">
          <h2 class="h5">¿Cómo se juega?</h2>
          <div class="controls-badges">${gameControlBadges(id)}</div>
        </div>
        <details class="game-hardware">
          <summary>Ver las piezas de mi PC</summary>
          <div class="hardware-chips">${components}</div>
        </details>
        <p class="game-a11y-controls visually-hidden">${esc(g.controls)}</p>
      </section>
    </div>
    <div class="game-menu-actions">
      <a class="btn btn-tk alt" href="#/mi-pc">Mejorar mi PC</a>
    </div><div id="fb"></div></div>`);
  document.querySelector('#go').onclick = () => { if (pv.status !== 'fail') startGame(id, g, document.querySelector('#fb')); };
}

// Cada juego tiene su propio motor de canvas.
// Registro entre identificadores de misión y clases del motor de juego.
const ENGINES = {
  carrera: RaceGame, clasificador: CatcherGame, defensa: DefenseGame, 'ciber-guardian': GuardianGame,
  'organizador-disco': DiskOrganizerGame, 'laberinto-datos': DataMazeGame,
  'taller-ensamblaje': AssemblyWorkshopGame, 'renderizado-gpu': GpuRenderGame
};

function play(id, g, s) {
  sm.playBGM('game');
  const isAssembly = id === 'taller-ensamblaje';
  const isGpuChallenge = id === 'renderizado-gpu';
  const canvasSize = gameCanvasDimensions(id, window.innerWidth, window.innerHeight, app.clientWidth);
  show(`<div class="game-wrap ${isAssembly ? 'assembly-game-wrap' : ''} ${isGpuChallenge ? 'gpu-game-wrap' : ''} ${id === 'carrera' ? 'race-game-wrap' : ''}">
    <div class="game-toolbar">
      <span class="game-title">${g.icon} ${esc(g.name)}</span>
      <div class="game-toolbar-actions">
        ${isGpuChallenge ? '<button class="btn btn-tk alt" id="restart-game" type="button">↻ Reiniciar</button>' : ''}
        <button class="btn btn-tk alt" id="pause-game" type="button" aria-pressed="false">⏸ Pausar</button>
      </div>
    </div>
    <div class="game-stage">
      <canvas id="cv" width="${canvasSize.width}" height="${canvasSize.height}" aria-label="${esc(g.name)}"></canvas>
      <div class="game-paused" id="game-paused" hidden role="dialog" aria-modal="true" aria-labelledby="game-paused-title">
        <h2 id="game-paused-title">Partida en pausa</h2>
        <p>Si sales, esta ronda no contará para tu progreso.</p>
        <button class="btn btn-tk" id="resume-game" type="button">▶ Continuar</button>
        <button class="btn btn-tk alt" id="exit-game" type="button">🏠 Salir al menú</button>
      </div>
    </div>
    ${id === 'carrera' ? `<div class="race-touch-controls" id="race-touch-controls" aria-label="Controles de Carrera Cósmica">
      <button class="race-control" type="button" data-control="left" aria-label="Cambiar al carril izquierdo">◀ <span>Izquierda</span></button>
      <button class="race-control nitro" type="button" data-control="nitro" aria-label="Mantener para usar turbo">🚀 <span>Mantén para turbo</span></button>
      <button class="race-control" type="button" data-control="right" aria-label="Cambiar al carril derecho"><span>Derecha</span> ▶</button>
    </div>` : ''}
    ${isAssembly ? '' : `<p class="text-center mt-2 mb-0" data-speak="${esc(g.controls)}">${esc(g.controls)}</p>`}</div>`);
  const Game = ENGINES[id] || DefenseGame;
  currentGame = new Game(document.querySelector('#cv'), s.profile, async o => {
    currentGame = null;
    const activeGameRoute = `#/juego/${id}`;
    try {
      const result = {
        sessionId: s.sessionId, crashed: !!o.crashed, position: o.position, waves: o.waves,
        won: !!o.won, score: o.score,
        ...(id === 'renderizado-gpu' ? { cores: o.cores, distance: o.distance, hits: o.hits, renderMode: o.renderMode } : {})
      };
      const r = await api('/games/finish', 'POST', result);
      if (location.hash === activeGameRoute) showResult(id, g, o, r);
    } catch (x) {
      if (location.hash === activeGameRoute) {
        show(`<div class="panel"><h2>Ups</h2><p>${esc(x.message)}</p><a class="btn btn-tk" href="#/mundo">Volver al mundo</a></div>`);
      }
    }
  });
  const pauseButton = document.querySelector('#pause-game');
  const pauseOverlay = document.querySelector('#game-paused');
  const restartButton = document.querySelector('#restart-game');
  if (restartButton) restartButton.onclick = () => currentGame?.restartLevel();
  const raceControls = document.querySelector('#race-touch-controls');
  if (raceControls) {
    let nitroPointer = null;
    let keyboardNitroTimer;
    raceControls.addEventListener('pointerdown', event => {
      const button = event.target.closest('button[data-control]');
      if (!button) return;
      event.preventDefault();
      currentGame.onButton(button.dataset.control, 'pointerdown');
      if (button.dataset.control === 'nitro') {
        nitroPointer = event.pointerId;
        button.setPointerCapture(event.pointerId);
      }
    });
    const releaseNitro = event => {
      if (event.pointerId !== nitroPointer) return;
      currentGame?.onButton('nitro', event.type === 'pointerup' ? 'pointerup' : 'pointercancel');
      nitroPointer = null;
    };
    raceControls.addEventListener('pointerup', releaseNitro);
    raceControls.addEventListener('pointercancel', releaseNitro);
    raceControls.addEventListener('lostpointercapture', releaseNitro);
    raceControls.addEventListener('click', event => {
      const button = event.target.closest('button[data-control]');
      if (!button || event.detail !== 0) return;
      if (button.dataset.control === 'nitro') {
        currentGame.onButton('nitro', 'pointerdown');
        clearTimeout(keyboardNitroTimer);
        keyboardNitroTimer = setTimeout(() => currentGame?.onButton('nitro', 'pointerup'), 180);
      } else currentGame.onButton(button.dataset.control, 'pointerdown');
    });
  }
  const togglePause = () => {
    if (currentGame.paused) {
      currentGame.resume();
      pauseButton.textContent = '⏸ Pausar';
      pauseButton.setAttribute('aria-pressed', 'false');
      pauseOverlay.hidden = true;
      pauseButton.focus();
    } else {
      currentGame.pause();
      pauseButton.textContent = '▶ Continuar';
      pauseButton.setAttribute('aria-pressed', 'true');
      pauseOverlay.hidden = false;
      document.querySelector('#resume-game').focus();
    }
  };
  pauseButton.onclick = togglePause;
  document.querySelector('#resume-game').onclick = togglePause;
  document.querySelector('#exit-game').onclick = () => {
    if (window.confirm('¿Salir de la partida? El progreso de esta ronda no se guardará.')) {
      location.hash = '#/mundo';
    }
  };
  currentGame.start();
}

// Presenta el resultado calculado en el servidor; el cliente solo muestra recompensas recibidas.
function showResult(id, g, o, r) {
  const title = r.crashed ? '¡Tu PC se cerró!'
    : id === 'carrera' ? `¡Llegaste en el puesto ${o.position}!`
    : id === 'clasificador' ? `¡Atrapaste ${o.good} componentes!`
      : id === 'renderizado-gpu' ? (o.won ? '¡Pista renderizada!' : '¡La GPU se sobrecalentó!')
      : id === 'taller-ensamblaje' ? (o.won ? '¡PC ensamblado!' : o.timedOut ? '¡Se acabó el tiempo!' : '¡Taller terminado!')
      : id === 'organizador-disco' ? (o.won ? '¡Disco organizado!' : '¡El disco se llenó!')
    : id === 'laberinto-datos' ? (o.won ? '¡Laberinto completado!' : '¡Byte necesita más práctica!')
    : id === 'ciber-guardian' ? (o.won ? '¡CPU a salvo!' : '¡Defiende la CPU!')
    : o.won ? '¡Defendiste la base!' : `Superaste ${o.waves} oleada${o.waves === 1 ? '' : 's'}`;
  const stats = r.crashed ? '<strong>Resultado:</strong> la partida se cerró por el rendimiento del PC.'
    : id === 'carrera' ? `🏁 Puesto <strong>${o.position || '—'}/3</strong>`
    : id === 'clasificador' ? `🧩 <strong>${o.good || 0}</strong> atrapados <span>·</span> ❌ ${o.bad || 0}`
    : id === 'renderizado-gpu' ? `🚀 <strong>${o.distance || 0}</strong> m <span>·</span> ⚡ <strong>${o.cores || 0}</strong> núcleos <span>·</span> 🌡️ ${o.temperature || 55}°C · ${o.hits || 0}/3 choques de polvo · ${o.renderMode === 'rtx' ? 'RTX' : 'Retro'}`
    : id === 'taller-ensamblaje' ? `🛠️ <strong>${o.installed || 0}/6</strong> piezas instaladas${o.elapsedSeconds != null ? ` <span>·</span> ⏱️ ${Math.floor(o.elapsedSeconds / 60)}:${String(o.elapsedSeconds % 60).padStart(2, '0')}` : ''}`
    : id === 'organizador-disco' ? `📂 <strong>${o.lines || 0}</strong> filas <span>·</span> ${o.pieces || 0} bloques`
    : id === 'laberinto-datos' ? `📦 <strong>${o.packetsCollected || 0}/${o.totalPackets || 8}</strong> paquetes`
    : `🛡️ <strong>${o.waves || 0}/3</strong> oleadas`;
  const nextTry = r.crashed
    ? 'Pide ayuda para revisar tu PC.'
    : id === 'carrera' ? (o.position === 1
      ? '¡Genial! Prueba una dificultad más alta.'
      : 'Recoge ⚡ y esquiva los conos.')
    : id === 'taller-ensamblaje' ? (o.timedOut
      ? 'El SSD SATA es una pieza distractora: busca el SSD M.2. Intenta de nuevo y administra el tiempo.'
      : '¡Aprendiste dónde va cada pieza! Prueba otra vez y recuerda que la pasta térmica va sobre el procesador.')
    : id === 'renderizado-gpu' ? 'Esquiva las nubes de polvo que obstruyen la ventilación de la GPU. Si se acumula demasiado calor, la tarjeta reduce su rendimiento y puede apagarse para protegerse.'
    : id === 'organizador-disco' ? (o.won
      ? '¡Liberaste seis filas y organizaste el disco!'
      : 'Gira los bloques y libera seis filas antes de que se llene.')
    : id === 'laberinto-datos' ? (o.won
      ? '¡Misión cumplida! Busca más paquetes por otras rutas.'
      : 'Cambia de camino para esquivar virus y juntar paquetes.')
    : id === 'clasificador' ? 'Mira el objetivo y atrapa solo ese componente.'
    : 'Toca los virus pronto y protege el centro.';
  sm.playBGM('menu');
  sm.playSound(r.crashed ? 'lose' : 'win');
  if (r.coins > 0) setTimeout(() => sm.playSound('coin'), 600);
  show(`<div class="panel text-center pop result-panel"><h2>${title}</h2>${stars(r.stars)}
    <div class="result-reward">
      <strong>${r.coins > 0 ? `+${r.coins} 🪙` : '¡Sigue intentando!'}</strong>
      <span>Saldo: ${r.balance} 🪙</span>
      ${r.bonus > 1 ? `<small>${DIFF_LABEL[r.difficulty]} · bono +${Math.round((r.bonus - 1) * 100)}%</small>` : ''}
    </div>
    <div class="result-summary">${stats}</div>
    <div class="result-tip" data-speak="${esc(nextTry)}"><strong>💡 Siguiente reto</strong><span>${nextTry}</span></div>
    <details class="result-diagnosis verdict ${r.status} text-start">
      <summary>🖥️ Ver consejos de tu PC</summary>
      <ul class="mb-0 mt-2 fw-normal">${r.tips.map(t => `<li data-speak="${esc(t)}">${esc(t)}</li>`).join('')}</ul>
    </details>
    ${r.newAchievements.map(a => `<div class="badge-tk pop my-2 mx-1">${a.icon} Nueva insignia: ${esc(a.name)}</div>`).join('')}
    <div class="my-3 mx-auto" style="max-width:28rem">${bar(r.progress)}<div class="small mt-1">Nivel ${r.progress.level}</div></div>
    <button class="btn btn-tk" id="again" type="button">Jugar otra vez</button>
    <a class="btn btn-tk alt" href="#/mi-pc">Comprar piezas</a> <a class="btn btn-tk alt" href="#/mundo">🌍 Mi mundo</a></div>`);
  // "Jugar otra vez" vuelve a preguntar la dificultad y arranca sin más pantallas.
  document.querySelector('#again').onclick = () => startGame(id, g, undefined, { renderMode: o.renderMode });
}

async function viewProgress() {
  const d = await api('/progress');
  if (location.hash !== '#/progreso') return;
  show(`<h2 class="mb-3">Mi progreso</h2><div class="panel mb-4"><div class="d-flex justify-content-between"><strong>Nivel ${d.progress.level}</strong><span class="coins-pill">🪙 ${d.coins}</span></div>${bar(d.progress)}</div>
    <div class="row g-3"><div class="col-lg-6"><div class="panel h-100"><h3 class="h5">Juegos</h3>${d.missions.map(m => `<div class="d-flex justify-content-between align-items-center border-bottom py-2"><span>${esc(m.title)}</span>${stars(m.stars)}</div>`).join('')}</div></div>
    <div class="col-lg-6"><div class="panel h-100"><h3 class="h5">Insignias</h3><div class="d-flex flex-wrap gap-2">${d.achievements.map(a => `<span class="badge-tk border ${a.unlocked ? '' : 'locked'}" title="${esc(a.description)}">${a.icon} ${esc(a.name)}</span>`).join('')}</div></div></div></div>
    <div class="panel mt-3"><h3 class="h5">Últimas partidas</h3>${d.attempts.length ? `<div class="table-responsive"><table class="table mb-0"><thead><tr><th>Juego</th><th>Puntaje</th><th>Fecha</th></tr></thead><tbody>${d.attempts.map(a => `<tr><td>${esc(a.title)}</td><td>${a.score}</td><td>${new Date(a.created_at).toLocaleString('es')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="mb-0">Todavía no has jugado. ¡Elige un juego en Mi mundo!</p>'}</div>`);
}

// Resuelve el hash de navegación y vuelve a comprobar la sesión antes de mostrar vistas privadas.
let routeSequence = 0;
async function route() {
  const sequence = ++routeSequence;
  const routeHash = location.hash || '#/';
  if (currentGame) { currentGame.stop(); currentGame = null; }
  const [, page, arg] = routeHash.split('/');
  try {
    if (me === null) { const r = await api('/auth/me'); me = r.user || false; }
    if (sequence !== routeSequence || (location.hash || '#/') !== routeHash) return;
    if (['mundo', 'mi-pc', 'juego', 'progreso'].includes(page) && !me) { location.hash = '#/entrar'; return; }
    if (page === 'entrar' && me) { location.hash = '#/mundo'; return; }
    
    // Ocultar la navegación principal en el garaje y el juego para inmersión total
    const nav = document.querySelector('.tk-nav');
    if (nav) nav.style.display = (page === 'mi-pc' || page === 'juego') ? 'none' : 'block';
    
    renderNav('#/' + (page || ''));
    sm.playBGM(page === 'juego' ? 'game' : 'menu');
    const views = { '': viewWelcome, entrar: () => viewAuth(arg), mundo: viewWorld, 'mi-pc': () => viewPc(), juego: () => viewGame(arg), progreso: viewProgress };
    await (views[page || ''] || viewWelcome)();
  } catch (e) {
    if (sequence !== routeSequence || (location.hash || '#/') !== routeHash) return;
    if (e.status === 401) { me = false; location.hash = '#/entrar'; return; }
    show(`<div class="panel"><h2>Ups, algo falló</h2><p>${esc(e.message)}</p><a class="btn btn-tk" href="#/">Volver al inicio</a></div>`);
  }
}
window.addEventListener('hashchange', route);
initSettings();
initRoulette();
route();