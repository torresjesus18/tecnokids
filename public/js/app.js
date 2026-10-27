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
  let prizes = [], rot = 0, spinning = false, raf = null;

  const draw = () => {
    const W = cv.width, H = cv.height, R = Math.min(W, H) / 2 - 30, n = prizes.length;
    c.clearRect(0, 0, W, H);
    if (!n) return;
    const step = Math.PI * 2 / n;
    for (let i = 0; i < n; i++) {
      const a0 = rot + i * step;
      c.beginPath(); c.moveTo(W / 2, H / 2); c.arc(W / 2, H / 2, R, a0, a0 + step); c.closePath();
      c.fillStyle = COLS[i % COLS.length]; c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 3; c.stroke();
      c.save(); c.translate(W / 2, H / 2); c.rotate(a0 + step / 2);
      c.textAlign = 'right'; c.textBaseline = 'middle'; c.fillStyle = '#16124a'; c.font = 'bold 15px sans-serif';
      c.fillText(`${prizes[i].icon} ${prizes[i].name}`, R - 12, 0);
      c.restore();
    }
    c.beginPath(); c.arc(W / 2, H / 2, 26, 0, 6.29); c.fillStyle = '#fff'; c.fill();
    c.textAlign = 'center'; c.font = '26px sans-serif'; c.fillText('🎡', W / 2, H / 2 + 1);
    c.beginPath(); c.moveTo(W / 2, H / 2 - R + 4); c.lineTo(W / 2 - 15, H / 2 - R - 20); c.lineTo(W / 2 + 15, H / 2 - R - 20);
    c.closePath(); c.fillStyle = '#16124a'; c.fill();
  };

  const load = async () => {
    const d = await api('/roulette');
    prizes = d.prizes; rot = 0; draw();
    msg.textContent = '¡Prueba tu suerte!';
    state.textContent = d.free ? '🎁 Tienes un giro gratis.' : `Giro gratis en ${wait(d.nextFreeIn)}`;
    go.textContent = d.free ? 'Girar gratis' : `Girar ${d.cost} 🪙`;
    go.disabled = !d.free && d.coins < d.cost;
  };

  const spin = async () => {
    if (spinning) return;
    spinning = true; go.disabled = true; msg.textContent = '¡Girando!'; wheelWrap.classList.add('spinning');
    sm.playSound('wheel');
    let r;
    try { r = await api('/roulette/spin', 'POST'); }
    catch (x) {
      spinning = false; wheelWrap.classList.remove('spinning'); msg.textContent = x.message;
      try { await load(); } catch (e) { /* sin conexión: se queda el mensaje */ }
      return;
    }
    const step = Math.PI * 2 / prizes.length;
    const base = -Math.PI / 2 - (r.index + 0.5) * step;                  // deja el premio bajo la flecha
    const from = rot;
    const delta = Math.PI * 2 * 4 + (((base - from) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const t0 = performance.now(), dur = 2800;
    const anim = now => {
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
    if (raf) cancelAnimationFrame(raf);
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
    </section>`);
}

function viewAuth(start) {
  show(`<div class="row justify-content-center"><div class="col-md-8 col-lg-6"><div class="panel">
    <ul class="nav nav-pills mb-3" role="tablist"><li class="nav-item"><button class="nav-link active" id="t-login" type="button">Ya tengo cuenta</button></li>
    <li class="nav-item"><button class="nav-link" id="t-reg" type="button">Soy nuevo</button></li></ul>
    <form id="f"></form><div id="msg"></div></div></div></div>`);
  const f = document.querySelector('#f');
  let mode = start === 'registro' ? 'reg' : 'login';
  const draw = () => {
    f.innerHTML = `${mode === 'reg' ? `<label class="form-label fw-bold" for="u">Tu alias (no uses tu nombre real)</label><input class="form-control mb-3" id="u" maxlength="20" minlength="3" pattern="[A-Za-z0-9_]{3,20}" title="Usa de 3 a 20 letras, números o guion bajo." required autocomplete="username">` : ''}
      <label class="form-label fw-bold" for="e">Correo</label><input class="form-control mb-3" id="e" type="email" maxlength="120" required autocomplete="email">
      <label class="form-label fw-bold" for="p">Contraseña (mínimo 8 caracteres)</label>
      <div class="input-group mb-3"><input class="form-control" id="p" type="password" minlength="8" maxlength="72" required autocomplete="${mode === 'reg' ? 'new-password' : 'current-password'}">
        <button class="btn btn-outline-secondary" id="toggle-password" type="button" aria-controls="p" aria-pressed="false">👁 Mostrar</button></div>
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
    const v = id => (document.querySelector('#' + id) || {}).value || '';
    const body = mode === 'reg' ? { username: v('u').trim(), email: v('e').trim(), password: v('p') } : { email: v('e').trim(), password: v('p') };
    try { me = await api('/auth/' + (mode === 'reg' ? 'register' : 'login'), 'POST', body); location.hash = '#/mundo'; route(); }
    catch (x) { document.querySelector('#msg').innerHTML = err(x); }
  };
  draw();
}

const partLine = (pc, k) => { const p = pc.catalog[k].find(x => x.code === pc.equipped[k]); return `<li>${p.icon} ${esc(p.name)} <small>· ${esc(p.spec)}</small></li>`; };

async function viewWorld() {
  const [d, pc, rl] = await Promise.all([api('/progress'), api('/pc'), api('/roulette')]);
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
    <div class="row g-3">${Object.entries(pc.games).map(([id, g]) => `<div class="col-md-6"><a class="mission game-card" href="#/juego/${id}" aria-label="Jugar ${esc(g.name)}">
      <img src="/img/${id}.webp" class="mission-img" alt="${esc(g.name)}" onerror="this.src='https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=${encodeURIComponent('futuristic game landscape 3d cartoon style')}&image_size=landscape_16_9'">
      <div class="mission-body">
        <h3 class="h4">${g.icon} ${esc(g.name)}</h3><p class="flex-grow-1">${esc(g.desc)}</p>
        <div class="fw-bold">${pc.previews[id].status === 'fail' ? '⛔ Requiere mejoras' : pc.previews[id].status === 'ok' ? '✅ Va fluido' : '⚠️ Va con tirones'}</div>
        <div class="d-flex justify-content-between align-items-center mt-2">
          ${stars((d.missions.find(m => m.slug === id) || { stars: 0 }).stars)}
          <span class="btn btn-tk alt">¡Jugar!</span>
        </div>
      </div>
    </a></div>`).join('')}
    </div>`);
  document.querySelector('#btn-ruleta').onclick = openRoulette;
}

async function viewPc(note, upgrade) {
  const d = await api('/pc');
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
      sm.playSound('correct');
      viewPc('¡Pieza comprada! ' + r.newAchievements.map(a => `${a.icon} ${a.name}`).join(', '), { code: b.dataset.buy, direction });
    } catch (x) { document.querySelector('#fb').innerHTML = err(x); }
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
      sm.playSound('correct');
      viewPc('¡PC actualizado!', { code, direction });
    } catch (x) { document.querySelector('#fb').innerHTML = err(x); }
  });
}

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
function startGame(id, g, fb) {
  askDifficulty(`${g.icon} <strong>${esc(g.name)}</strong>`, async diff => {
    try { play(id, g, await api('/games/start', 'POST', { game: id, difficulty: diff })); }
    catch (x) {
      const msg = err(x);
      if (fb) fb.innerHTML = msg; else show(`<div class="panel"><h2>Ups</h2>${msg}</div>`);
    }
  });
}

async function viewGame(id) {
  const d = await api('/pc'), g = d.games[id];
  if (!g) return viewWelcome();
  const pv = d.previews[id];
  const components = Object.keys(KINDS).map(kind => {
    const part = d.catalog[kind].find(item => item.code === d.equipped[kind]);
    return `<span class="hardware-chip" title="${esc(part.spec)}">${KINDS[kind][0]} ${esc(part.name)}</span>`;
  }).join('');
  show(`<div class="panel game-menu">
    <a class="btn btn-tk alt game-back" href="#/mundo">◀ Atrás</a>
    <div class="game-lobby-grid">
      <section class="game-lobby-action" aria-labelledby="game-lobby-title">
        <img src="/img/${encodeURIComponent(id)}.webp" class="game-lobby-cover" alt="Portada de ${esc(g.name)}" onerror="this.hidden=true">
        <h1 class="h2" id="game-lobby-title">${g.icon} ${esc(g.name)}</h1>
        <p>${esc(g.desc)}</p>
        <button class="btn btn-tk alt btn-play-big" id="go" type="button" ${pv.status === 'fail' ? 'disabled' : ''}>${pv.status === 'fail' ? '🔒 Necesitas mejorar tu PC' : '🎮 ¡JUGAR AHORA!'}</button>
        <button class="btn btn-tk speak-btn" type="button" data-speak-sel="#guia">🔊 Escuchar</button>
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
const ENGINES = {
  carrera: RaceGame, clasificador: CatcherGame, defensa: DefenseGame, 'ciber-guardian': GuardianGame,
  'organizador-disco': DiskOrganizerGame, 'laberinto-datos': DataMazeGame
};

function play(id, g, s) {
  sm.playBGM('game');
  show(`<div class="game-wrap">
    <div class="game-toolbar">
      <span class="game-title">${g.icon} ${esc(g.name)}</span>
      <button class="btn btn-tk alt" id="pause-game" type="button" aria-pressed="false">⏸ Pausar</button>
    </div>
    <div class="game-stage">
      <canvas id="cv" width="480" height="640" aria-label="${esc(g.name)}"></canvas>
      <div class="game-paused" id="game-paused" hidden role="status" aria-live="polite">
        <h2>Partida en pausa</h2>
        <button class="btn btn-tk" id="resume-game" type="button">▶ Continuar</button>
      </div>
    </div>
    <p class="text-center mt-2 mb-0" data-speak="${esc(g.controls)}">${esc(g.controls)}</p></div>`);
  const Game = ENGINES[id] || DefenseGame;
  currentGame = new Game(document.querySelector('#cv'), s.profile, async o => {
    currentGame = null;
    try {
      const r = await api('/games/finish', 'POST', { sessionId: s.sessionId, crashed: !!o.crashed, position: o.position, waves: o.waves, won: !!o.won, score: o.score });
      showResult(id, g, o, r);
    } catch (x) { show(`<div class="panel"><h2>Ups</h2><p>${esc(x.message)}</p><a class="btn btn-tk" href="#/mundo">Volver al mundo</a></div>`); }
  });
  const pauseButton = document.querySelector('#pause-game');
  const pauseOverlay = document.querySelector('#game-paused');
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
  currentGame.start();
}

function showResult(id, g, o, r) {
  const title = r.crashed ? '¡Tu PC se cerró!'
    : id === 'carrera' ? `¡Llegaste en el puesto ${o.position}!`
    : id === 'clasificador' ? `¡Atrapaste ${o.good} componentes!`
    : id === 'organizador-disco' ? (o.won ? '¡Disco organizado!' : '¡El disco se llenó!')
    : id === 'laberinto-datos' ? (o.won ? '¡Laberinto completado!' : '¡Byte necesita más práctica!')
    : id === 'ciber-guardian' ? (o.won ? '¡CPU a salvo!' : '¡Defiende la CPU!')
    : o.won ? '¡Defendiste la base!' : `Superaste ${o.waves} oleada${o.waves === 1 ? '' : 's'}`;
  const stats = r.crashed ? '<strong>Resultado:</strong> la partida se cerró por el rendimiento del PC.'
    : id === 'carrera' ? `🏁 Puesto <strong>${o.position || '—'}/3</strong>`
    : id === 'clasificador' ? `🧩 <strong>${o.good || 0}</strong> atrapados <span>·</span> ❌ ${o.bad || 0}`
    : id === 'organizador-disco' ? `📂 <strong>${o.lines || 0}</strong> filas <span>·</span> ${o.pieces || 0} bloques`
    : id === 'laberinto-datos' ? `📦 <strong>${o.packetsCollected || 0}/${o.totalPackets || 8}</strong> paquetes`
    : `🛡️ <strong>${o.waves || 0}/3</strong> oleadas`;
  const nextTry = r.crashed
    ? 'Pide ayuda para revisar tu PC.'
    : id === 'carrera' ? (o.position === 1
      ? '¡Genial! Prueba una dificultad más alta.'
      : 'Recoge ⚡ y esquiva los conos.')
    : id === 'organizador-disco' ? (o.lines >= 4
      ? '¡Buen trabajo! Busca completar varias filas seguidas.'
      : 'Gira los bloques y completa una fila antes de soltar.')
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
    <a class="btn btn-tk alt" href="#/mi-pc">Comprar piezas</a> <a class="btn btn-outline-dark" href="#/mundo">Mi mundo</a></div>`);
  // "Jugar otra vez" vuelve a preguntar la dificultad y arranca sin más pantallas.
  document.querySelector('#again').onclick = () => startGame(id, g);
}

async function viewProgress() {
  const d = await api('/progress');
  show(`<h2 class="mb-3">Mi progreso</h2><div class="panel mb-4"><div class="d-flex justify-content-between"><strong>Nivel ${d.progress.level}</strong><span class="coins-pill">🪙 ${d.coins}</span></div>${bar(d.progress)}</div>
    <div class="row g-3"><div class="col-lg-6"><div class="panel h-100"><h3 class="h5">Juegos</h3>${d.missions.map(m => `<div class="d-flex justify-content-between align-items-center border-bottom py-2"><span>${esc(m.title)}</span>${stars(m.stars)}</div>`).join('')}</div></div>
    <div class="col-lg-6"><div class="panel h-100"><h3 class="h5">Insignias</h3><div class="d-flex flex-wrap gap-2">${d.achievements.map(a => `<span class="badge-tk border ${a.unlocked ? '' : 'locked'}" title="${esc(a.description)}">${a.icon} ${esc(a.name)}</span>`).join('')}</div></div></div></div>
    <div class="panel mt-3"><h3 class="h5">Últimas partidas</h3>${d.attempts.length ? `<div class="table-responsive"><table class="table mb-0"><thead><tr><th>Juego</th><th>Puntaje</th><th>Fecha</th></tr></thead><tbody>${d.attempts.map(a => `<tr><td>${esc(a.title)}</td><td>${a.score}</td><td>${new Date(a.created_at).toLocaleString('es')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="mb-0">Todavía no has jugado. ¡Elige un juego en Mi mundo!</p>'}</div>`);
}

async function route() {
  if (currentGame) { currentGame.stop(); currentGame = null; }
  const [, page, arg] = (location.hash || '#/').split('/');
  try {
    if (me === null) { const r = await api('/auth/me'); me = r.user || false; }
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
    if (e.status === 401) { me = false; location.hash = '#/entrar'; return; }
    show(`<div class="panel"><h2>Ups, algo falló</h2><p>${esc(e.message)}</p><a class="btn btn-tk" href="#/">Volver al inicio</a></div>`);
  }
}
window.addEventListener('hashchange', route);
initSettings();
initRoulette();
route();