/* Motor de juegos de TecnoKids.
   Cada juego aplica el "perfil de rendimiento" que calcula el servidor según el PC del niño:
   fps (tarjeta gráfica), tirones (procesador/memoria), cierre por falta de memoria y calidad visual. */
const sfx = n => { const s = globalThis.SoundManager; if (s) s.playSound(n); };

class BaseGame {
  constructor(canvas, profile, onEnd) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.W = canvas.width; this.H = canvas.height;
    this.p = profile; this.onEnd = onEnd;
    this.q = { baja: 0, media: 1, alta: 2 }[profile.quality] || 0;
    this.keys = {}; this.targetX = this.W / 2;
    this.buttons = []; this.floats = [];          // botones táctiles y textos flotantes
    this.shakeT = 0; this.shakeMax = 1; this.shakeMag = 0;
    this.done = false; this.dead = false; this.paused = false; this.pauseStartedAt = 0; this.elapsed = 0;
    this.frames = 0; this.fps = 0; this.hitchUntil = 0; this.nextHitch = null;
    this._kd = e => {
      if (e.target.closest && e.target.closest('button,a,input,textarea,select,[contenteditable="true"]')) return;
      if (this.paused) return;
      const k = e.key.toLowerCase();
      if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's', ' '].includes(k)) {
        e.preventDefault();
        if (!this.keys[k]) this.onKey(k);
        this.keys[k] = true;
      }
    };
    this._ku = e => { this.keys[e.key.toLowerCase()] = false; };
    this._xy = e => {
      const r = this.cv.getBoundingClientRect();
      return [((e.clientX - r.left) * this.W) / r.width, ((e.clientY - r.top) * this.H) / r.height];
    };
    this._btnAt = (x, y) => this.buttons.find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
    this._pt = e => {
      const [x, y] = this._xy(e);
      // Si el dedo cae sobre un botón, el botón manda y no se mueve el personaje.
      const b = this._btnAt(x, y);
      if (b) { if (e.type === 'pointerdown') this.onButton(b.id, e.type); return; }
      this.targetX = x;
      this.onPointer(x, e.type, y);
    };
    this._pu = e => { const [x, y] = this._xy(e); const b = this._btnAt(x, y); if (b) this.onButton(b.id, e.type); this.onRelease(); };
  }
  onKey() {}
  onPointer() {}
  onButton() {}
  onRelease() {}

  /* --- Efectos compartidos por todos los juegos (el "juice") ----------------
     Todos los juegos heredan de aquí: sacudida, textos flotantes, botones
     táctiles y la cuenta atrás. Así el toque se siente igual en los cuatro. */

  // Sacudida de pantalla con un leve zoom para que no se vean los bordes.
  addShake(mag, dur = 0.35) {
    this.shakeMag = Math.max(this.shakeMag, mag);
    this.shakeT = Math.max(this.shakeT, dur);
    this.shakeMax = Math.max(this.shakeMax, dur);
  }
  // Números/etiquetas que suben y se desvanecen ("+10", "¡Combo x3!").
  addFloat(x, y, text, col) { this.floats.push({ x, y, text, col, life: 1, max: 1 }); }
  updateFx(dt) {
    if (this.shakeT > 0) this.shakeT = Math.max(0, this.shakeT - dt);
    for (const f of this.floats) { f.y -= 38 * dt; f.life -= dt; }
    this.floats = this.floats.filter(f => f.life > 0);
  }
  drawFloats(c) {
    if (!this.floats.length) return;
    c.save(); c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = 'bold 23px sans-serif';
    for (const f of this.floats) {
      c.globalAlpha = Math.min(1, (f.life / f.max) * 1.6);
      c.lineWidth = 5; c.strokeStyle = 'rgba(8,6,34,.7)'; c.strokeText(f.text, f.x, f.y);
      c.fillStyle = f.col; c.fillText(f.text, f.x, f.y);
    }
    c.restore();
  }
  // Botones grandes, pensados para dedos pequeños en tablet o teléfono.
  btn(id, x, y, w, h, icon, col = '#35e0b2') { this.buttons.push({ id, x, y, w, h, icon, col }); }
  drawButtons(c) {
    for (const b of this.buttons) {
      c.save();
      c.globalAlpha = 0.9; c.fillStyle = b.col;
      c.beginPath();
      if (c.roundRect) c.roundRect(b.x, b.y, b.w, b.h, 18); else c.rect(b.x, b.y, b.w, b.h);
      c.fill(); c.globalAlpha = 1;
      c.strokeStyle = 'rgba(8,6,34,.4)'; c.lineWidth = 3; c.stroke();
      c.fillStyle = '#101a45'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = '36px sans-serif'; c.fillText(b.icon, b.x + b.w / 2, b.y + b.h / 2 + 2);
      c.restore();
    }
  }
  // Cuenta atrás 3-2-1 con anillo que se cierra y número que hace "pop".
  drawCountdown(c, txt = '¡Prepárate!') {
    const W = this.W, H = this.H, n = Math.max(1, Math.ceil(this.ready));
    const frac = 1 - (this.ready - Math.floor(this.ready));      // 0 → 1 dentro de cada segundo
    c.save();
    c.fillStyle = 'rgba(6,4,30,.62)'; c.fillRect(0, 0, W, H);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.beginPath(); c.arc(W / 2, H / 2 - 30, 88, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
    c.strokeStyle = '#35e0b2'; c.lineWidth = 8; c.stroke();
    c.save(); c.translate(W / 2, H / 2 - 30); const pop = 1 + (1 - frac) * 0.28; c.scale(pop, pop);
    c.font = 'bold 112px sans-serif'; c.lineWidth = 8; c.strokeStyle = 'rgba(8,6,34,.6)';
    c.strokeText(n, 0, 6); c.fillStyle = '#ffcf33'; c.fillText(n, 0, 6);
    c.restore();
    c.fillStyle = '#fff'; c.font = 'bold 24px sans-serif'; c.fillText(txt, W / 2, H / 2 + 92);
    c.restore();
  }
  // Barra de progreso reutilizable para los HUD.
  hudBar(c, x, y, w, h, v, col = '#ffcf33', bg = 'rgba(10,8,40,.6)') {
    c.save();
    c.fillStyle = bg; c.beginPath();
    if (c.roundRect) c.roundRect(x, y, w, h, h / 2); else c.rect(x, y, w, h);
    c.fill();
    const ww = Math.max(0, Math.min(1, v)) * w;
    if (ww > 2) { c.fillStyle = col; c.beginPath(); if (c.roundRect) c.roundRect(x, y, ww, h, h / 2); else c.rect(x, y, ww, h); c.fill(); }
    c.restore();
  }

  start() {
    window.addEventListener('keydown', this._kd); window.addEventListener('keyup', this._ku);
    this.cv.style.touchAction = 'none';            // el dedo mueve el personaje, no la página
    this.cv.addEventListener('pointerdown', this._pt); this.cv.addEventListener('pointermove', this._pt);
    this.cv.addEventListener('pointerup', this._pu); this.cv.addEventListener('pointercancel', this._pu);
    this.t0 = this.last = this.lastFrame = this.fpsT = performance.now();
    this.nextHitch = this.scheduleHitch(this.t0);
    this.raf = requestAnimationFrame(t => this.tick(t));
  }
  detach() {
    window.removeEventListener('keydown', this._kd); window.removeEventListener('keyup', this._ku);
    this.cv.removeEventListener('pointerdown', this._pt); this.cv.removeEventListener('pointermove', this._pt);
    this.cv.removeEventListener('pointerup', this._pu); this.cv.removeEventListener('pointercancel', this._pu);
  }
  stop() { this.dead = true; this.done = true; cancelAnimationFrame(this.raf); this.detach(); }

  pause(now = performance.now()) {
    if (this.done || this.paused) return;
    this.paused = true;
    this.pauseStartedAt = now;
    this.keys = {};
    this.onRelease();
  }

  resume(now = performance.now()) {
    if (this.done || !this.paused) return;
    const pausedFor = now - this.pauseStartedAt;
    this.t0 += pausedFor;
    this.last = now;
    this.lastFrame = now;
    this.fpsT = now;
    if (this.nextHitch !== null) this.nextHitch += pausedFor;
    if (this.hitchUntil > this.pauseStartedAt) this.hitchUntil += pausedFor;
    this.paused = false;
  }

  scheduleHitch(from) {
    return this.p.hitchPerMin > 0 ? from + (60000 / this.p.hitchPerMin) * (0.5 + Math.random()) : null;
  }

  tick(now) {
    if (this.done) return;
    this.raf = requestAnimationFrame(t => this.tick(t));
    if (this.paused) return;
    const p = this.p;
    this.elapsed = (now - this.t0) / 1000;
    if (p.crashAfterSec != null && this.elapsed >= p.crashAfterSec) return this.end({ crashed: true });
    if (now < this.hitchUntil) return; // el juego está congelado, pero el mundo sigue avanzando "por dentro"
    if (this.nextHitch && now >= this.nextHitch) {
      this.hitchUntil = now + p.hitchMs; this.nextHitch = this.scheduleHitch(this.hitchUntil); return;
    }
    if (now - this.lastFrame < 1000 / p.fps - 2) return; // tope de FPS de la tarjeta gráfica
    const dt = Math.min((now - this.last) / 1000, 0.5);
    this.last = now; this.lastFrame = now;
    this.updateFx(dt);
    this.update(dt);
    if (this.done) return;
    const c = this.ctx;
    c.save();
    if (this.shakeT > 0) {
      const k = this.shakeT / this.shakeMax, m = this.shakeMag * k, s = 1 + 0.035 * k;
      c.translate(this.W / 2, this.H / 2); c.scale(s, s); c.translate(-this.W / 2, -this.H / 2);
      c.translate((Math.random() * 2 - 1) * m, (Math.random() * 2 - 1) * m);
    }
    this.render(c);
    c.restore();
    this.drawFloats(c); this.drawButtons(c); this.drawMonitor(c);
    this.frames++;
    if (now - this.fpsT >= 1000) { this.fps = this.frames; this.frames = 0; this.fpsT = now; }
  }

  end(o) {
    if (this.done) return;
    this.done = true; cancelAnimationFrame(this.raf); this.detach();
    if (o.crashed) {
      const c = this.ctx, W = this.W, H = this.H;
      c.fillStyle = '#1b4bd8'; c.fillRect(0, 0, W, H); c.fillStyle = '#fff';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = 'bold 72px sans-serif'; c.fillText(':(', W / 2, H / 2 - 70);
      c.font = 'bold 24px sans-serif'; c.fillText('¡Tu PC se quedó sin memoria!', W / 2, H / 2 + 10);
      c.font = '18px sans-serif'; c.fillText('El juego se cerró solo…', W / 2, H / 2 + 48);
    }
    setTimeout(() => { if (!this.dead) this.onEnd(o); }, o.crashed ? 2200 : 700);
  }

  // Monitor del PC: barras de uso de CPU, RAM, GPU y ROM + FPS reales.
  drawMonitor(c) {
    const x = this.W - 112, y = 8, p = this.p;
    const ram = p.crashAfterSec ? 0.45 + 0.55 * Math.min(1, this.elapsed / p.crashAfterSec) : p.loads.ram;
    c.save(); c.textAlign = 'left'; c.textBaseline = 'middle'; c.font = 'bold 11px sans-serif';
    c.fillStyle = 'rgba(10,8,40,.78)'; c.fillRect(x - 6, y, 114, 112);
    [['CPU', p.loads.cpu], ['RAM', ram], ['GPU', p.loads.gpu], ['ROM', p.loads.rom]].forEach(([n, v], i) => {
      const yy = y + 16 + i * 20;
      c.fillStyle = '#fff'; c.fillText(n, x, yy);
      c.fillStyle = '#3a3690'; c.fillRect(x + 34, yy - 6, 64, 12);
      c.fillStyle = v > 0.92 ? '#ff6b81' : v > 0.75 ? '#ffcf33' : '#35e0b2'; c.fillRect(x + 34, yy - 6, 64 * v, 12);
    });
    c.fillStyle = '#fff'; c.fillText('FPS ' + this.fps, x, y + 100);
    c.restore();
  }
}

class RaceGame extends BaseGame {
  constructor(...a) {
    super(...a);
    this.L = 2800; this.lanes = [150, 240, 330]; this.ready = 3; this.t = 0; this.flashT = 0;
    const difficulty = {
      facil: { playerSpeed: 160, botSpeeds: [146, 151], avoidance: 0.45, turboAccuracy: 0.5 },
      medio: { playerSpeed: 165, botSpeeds: [158, 164], avoidance: 0.7, turboAccuracy: 0.65 },
      dificil: { playerSpeed: 170, botSpeeds: [169, 176], avoidance: 1, turboAccuracy: 0.8 }
    }[this.p.difficulty] || { playerSpeed: 165, botSpeeds: [158, 164], avoidance: 0.7, turboAccuracy: 0.65 };
    this.me = { dist: 0, lane: 1, x: 240, speed: difficulty.playerSpeed, slow: 0, boost: 0, hit: 0, combo: 0, comboT: 0, nitro: 0.5, nitroOn: false, nitroActive: false };
    this.bots = [
      { dist: 0, lane: 0, x: 150, base: difficulty.botSpeeds[0], avoidance: difficulty.avoidance, turboAccuracy: difficulty.turboAccuracy, slow: 0, boost: 0, changeT: 0, done: false, col: '#ff6b81' },
      { dist: 0, lane: 2, x: 330, base: difficulty.botSpeeds[1], avoidance: difficulty.avoidance, turboAccuracy: difficulty.turboAccuracy, slow: 0, boost: 0, changeT: 0.08, done: false, col: '#ffcf33' }
    ];
    this.objs = [];
    for (let d = 320; d < this.L - 150; d += 110 + Math.random() * 130)
      this.objs.push({ d, lane: Math.floor(Math.random() * 3), type: Math.random() < 0.34 ? 'boost' : 'block', used: false, botPassed: [false, false] });
    // Estrellas en tres capas: al avanzar se mueven a distinta velocidad (parallax).
    this.stars = [[], [], []];
    for (let i = 0; i < 66; i++) this.stars[i % 3].push({ x: Math.random() * this.W, y: Math.random() * this.H, s: 1 + (i % 3) });
  }
  onKey(k) {
    if (k === 'arrowleft' || k === 'a') this.me.lane = Math.max(0, this.me.lane - 1);
    if (k === 'arrowright' || k === 'd') this.me.lane = Math.min(2, this.me.lane + 1);
  }
  onPointer(x, type) {
    if (type !== 'pointerdown') return;
    this.me.lane = x < this.me.x ? Math.max(0, this.me.lane - 1) : Math.min(2, this.me.lane + 1);
  }
  onButton(id, type) {
    if (id === 'left' && type === 'pointerdown') this.me.lane = Math.max(0, this.me.lane - 1);
    else if (id === 'right' && type === 'pointerdown') this.me.lane = Math.min(2, this.me.lane + 1);
    else if (id === 'nitro') { this.me.nitroOn = type !== 'pointerup' && type !== 'pointercancel'; if (this.me.nitroOn) sfx('click'); }
  }
  onRelease() { this.me.nitroOn = false; }

  update(dt) {
    this.t += dt; this.flashT = Math.max(0, this.flashT - dt);
    if (this.ready > 0) { this.ready -= dt; return; }
    const m = this.me, prev = m.dist;
    const previousBotDistances = this.bots.map(bot => bot.dist);
    m.slow = Math.max(0, m.slow - dt); m.boost = Math.max(0, m.boost - dt); m.hit = Math.max(0, m.hit - dt);
    if (m.combo > 0) { m.comboT -= dt; if (m.comboT <= 0) m.combo = 0; }
    // Turbo: se gasta al mantener pulsado el botón y se recarga solo o con cada ⚡.
    m.nitroActive = m.nitroOn && m.nitro > 0.02;
    if (m.nitroActive) {
      m.nitro = Math.max(0, m.nitro - 0.42 * dt);
      if (Math.random() < dt * 26) this.addFloat(m.x + (Math.random() * 24 - 12), 532, '💨', '#ffa94d');
    } else m.nitro = Math.min(1, m.nitro + 0.05 * dt);
    m.dist += (m.speed * (m.slow > 0 ? 0.45 : 1) + (m.boost > 0 ? 70 : 0) + (m.nitroActive ? 120 : 0) + Math.min(4, m.combo) * 6) * dt;
    m.x += (this.lanes[m.lane] - m.x) * Math.min(1, dt * 12);
    // Colisión "barrida": si hubo un tirón largo, igual detecta lo que el auto atravesó.
    for (const o of this.objs) {
      if (!o.used && o.lane === m.lane && o.d > prev && o.d <= m.dist) {
        o.used = true;
        const y = Math.max(60, 500 - (o.d - m.dist) * 0.6);
        if (o.type === 'boost') {
          m.combo = Math.min(6, m.combo + 1); m.comboT = 3.2;
          m.boost = 1.1 + m.combo * 0.22; m.nitro = Math.min(1, m.nitro + 0.22);
          this.addFloat(this.lanes[m.lane], y, m.combo > 1 ? `¡Combo x${m.combo}!` : '+ Turbo', '#ffcf33');
          if (m.combo > 1) this.addShake(4, 0.2);
          sfx('boost');
        } else {
          m.slow = 0.9; m.combo = 0; m.hit = 0.5;
          this.flash = '#ff6b81'; this.flashT = 0.3;
          this.addFloat(this.lanes[m.lane], y, '¡Uy!', '#ff6b81');
          this.addShake(16, 0.4); sfx('crash');
        }
      }
    }
    for (let index = 0; index < this.bots.length; index++) {
      const b = this.bots[index];
      b.slow = Math.max(0, b.slow - dt);
      b.boost = Math.max(0, b.boost - dt);
      b.changeT -= dt;
      if (b.changeT <= 0) {
        b.lane = this.chooseBotLane(b);
        b.changeT = 0.16;
      }
      const previousDistance = previousBotDistances[index];
      b.dist += (b.base + (b.boost > 0 ? 38 : 0) + Math.sin(this.t * 0.7 + index * 2) * 4) * (b.slow > 0 ? 0.55 : 1) * dt;
      b.x += (this.lanes[b.lane] - b.x) * Math.min(1, dt * 6);
      for (const o of this.objs) {
        if (o.botPassed[index] || o.lane !== b.lane || o.d <= previousDistance || o.d > b.dist) continue;
        this.handleBotObject(b, index, o);
      }
      if (b.dist >= this.L) b.done = true;
    }
    if (m.dist >= this.L) this.end({ crashed: false, position: 1 + this.bots.filter(b => b.dist > m.dist).length });
  }

  chooseBotLane(bot) {
    const options = [0, 1, 2].map(lane => {
      let danger = 0, boosts = 0;
      for (const obj of this.objs) {
        if (obj.lane !== lane || obj.d < bot.dist || obj.d > bot.dist + bot.base * 1.35) continue;
        if (obj.type === 'block') danger += obj.d - bot.dist < bot.base * 0.9 ? 4 : 1;
        else boosts++;
      }
      return { lane, danger, boosts, change: lane === bot.lane ? 0 : 1 };
    });
    const current = options.find(option => option.lane === bot.lane);
    const mustEvade = current.danger >= 4 && Math.random() < bot.avoidance;
    if (!mustEvade) return bot.lane;
    const candidates = options.filter(option => option.lane !== bot.lane);
    candidates.sort((a, b) => a.danger - b.danger || b.boosts - a.boosts || a.change - b.change);
    return candidates[0].lane;
  }

  handleBotObject(bot, index, obj, roll = Math.random()) {
    obj.botPassed[index] = true;
    if (obj.type === 'boost') {
      if (roll < bot.turboAccuracy) bot.boost = 1.1;
    } else bot.slow = 0.8;
  }

  car(c, x, y, color, flame) {
    c.save();
    if (this.q >= 2) { c.shadowColor = color; c.shadowBlur = 18; }
    if (flame) {
      c.fillStyle = 'rgba(255,169,77,.85)'; c.beginPath();
      c.moveTo(x - 12, y + 26); c.lineTo(x + 12, y + 26); c.lineTo(x, y + 30 + 16 + Math.random() * 16);
      c.closePath(); c.fill();
    }
    c.fillStyle = color; c.beginPath();
    if (c.roundRect) c.roundRect(x - 17, y - 28, 34, 56, 8); else c.rect(x - 17, y - 28, 34, 56);
    c.fill(); c.restore();
    c.fillStyle = '#16124a'; c.fillRect(x - 11, y - 14, 22, 12);
  }

  render(c) {
    const W = this.W, H = this.H, m = this.me, q = this.q;
    c.fillStyle = '#16124a'; c.fillRect(0, 0, W, H);
    // Parallax: tres capas de estrellas que avanzan a distinta velocidad al correr.
    if (q >= 1) {
      const cols = ['rgba(255,255,255,.3)', 'rgba(255,255,255,.55)', 'rgba(255,233,168,.9)'];
      for (let l = 0; l < this.stars.length; l++) {
        c.fillStyle = cols[l];
        for (const s of this.stars[l]) c.fillRect(s.x, (s.y + m.dist * (0.12 + l * 0.2)) % H, s.s, s.s);
      }
    }
    c.fillStyle = q >= 1 ? '#2d2a78' : '#3b3b6b'; c.fillRect(90, 0, 300, H);
    c.fillStyle = q >= 1 ? '#35e0b2' : '#ddd'; c.fillRect(86, 0, 6, H); c.fillRect(388, 0, 6, H);
    c.fillStyle = '#fff';
    for (let y = -60 + ((m.dist * 0.6) % 60); y < H; y += 60) { c.fillRect(193, y, 4, 30); c.fillRect(283, y, 4, 30); }
    const Y = d => 500 - (d - m.dist) * 0.6;
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '30px sans-serif';
    const fy = Y(this.L);
    if (fy > -20 && fy < H) { c.fillStyle = '#fff'; c.fillRect(90, fy - 6, 300, 12); c.fillText('🏁', W / 2, fy - 22); }
    for (const o of this.objs) { if (o.used) continue; const y = Y(o.d); if (y > -30 && y < H + 30) c.fillText(o.type === 'boost' ? '⚡' : '🚧', this.lanes[o.lane], y); }
    for (const b of this.bots) { const y = Y(b.dist); if (y > -60 && y < H + 60) this.car(c, b.x, y, b.col); }
    this.car(c, m.x, 500, m.hit > 0 ? '#ffffff' : '#35e0b2', m.nitroActive || m.boost > 0);
    if (this.flashT > 0) { c.globalAlpha = Math.min(0.35, this.flashT * 1.2); c.fillStyle = this.flash; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
    // HUD con recuadro: puesto, avance de pista y turbo.
    const rank = 1 + this.bots.filter(b => b.dist > m.dist).length;
    c.save();
    c.fillStyle = 'rgba(10,8,40,.55)'; c.beginPath();
    if (c.roundRect) c.roundRect(8, 8, 300, 92, 16); else c.rect(8, 8, 300, 92);
    c.fill();
    c.textAlign = 'left'; c.font = 'bold 22px sans-serif'; c.fillStyle = '#fff';
    c.fillText(`Puesto ${rank}/3`, 22, 30);
    if (m.combo > 1) { c.textAlign = 'right'; c.fillStyle = '#ffcf33'; c.fillText(`🔥 x${m.combo}`, 296, 30); }
    c.textAlign = 'left'; c.font = 'bold 13px sans-serif'; c.fillStyle = '#cfe9ff'; c.fillText('PISTA', 22, 54);
    this.hudBar(c, 72, 47, 226, 14, m.dist / this.L, '#35e0b2');
    c.fillStyle = '#ffd9df'; c.fillText('TURBO', 22, 80);
    this.hudBar(c, 78, 73, 220, 14, m.nitro, m.nitroActive ? '#ffa94d' : '#ff6b81');
    c.restore();
    if (this.ready > 0) this.drawCountdown(c, '¡Listos para la carrera!');
  }
}

class DefenseGame extends BaseGame {
  constructor(...a) {
    super(...a);
    this.ship = { x: 240, y: 590, hp: 3, inv: 0, cool: 0 };
    this.en = []; this.pb = []; this.eb = []; this.pt = []; this.drops = [];
    this.stars = [[], [], []];
    for (let i = 0; i < 54; i++) this.stars[i % 3].push({ x: (i * 71) % 480, y: (i * 131) % 640, s: 1 + (i % 3) });
    this.t = 0; this.wave = 0; this.cleared = 0; this.spawnLeft = 0; this.spawnT = 0; this.ready = 3;
    this.combo = 0; this.comboT = 0; this.kills = 0; this.charge = 0; this.boomT = 0; this.freeze = 0; this.shield = 0;
    // Botones táctiles: mover la nave a los lados y lanzar la superbomba.
    this.btn('left', 16, this.H - 86, 78, 72, '◀', '#5ad1ff');
    this.btn('right', 102, this.H - 86, 78, 72, '▶', '#5ad1ff');
    this.btn('boom', this.W - 102, this.H - 86, 86, 72, '💥', '#ff6b81');
    this.nextWave();
  }
  onButton(id, type) {
    if (type === 'pointerup' || type === 'pointercancel') return;
    if (id === 'left') this.targetX -= 90;
    else if (id === 'right') this.targetX += 90;
    else if (id === 'boom') this.fireBomb();
  }
  // Superbomba: al llenarse la carga, limpia los disparos y daña a todos los enemigos.
  fireBomb() {
    const s = this.ship;
    if (this.charge < 100) { this.addFloat(s.x, s.y - 60, '¡Bomba sin carga!', '#ffcf33'); sfx('wrong'); return; }
    this.charge = 0; this.boomT = 0.45; this.addShake(22, 0.5); sfx('crash');
    this.addFloat(s.x, s.y - 72, '¡SUPERBOMBA!', '#ff6b81');
    for (const b of this.eb) b.dead = true;
    for (const e of this.en) { if (e.boss) { e.hp -= 12; e.hit = 0.3; } else { e.hp = 0; this.kills++; this.combo++; } }
  }
  // Un enemigo destruido: sube el combo, carga la bomba y a veces suelta un comodín.
  kill(e) {
    this.kills++; this.combo++; this.comboT = 2.6;
    this.charge = Math.min(100, this.charge + 11 + Math.min(20, this.combo * 3));
    this.burst(e.x, e.y, e.boss);
    this.addFloat(e.x, e.y, this.combo > 1 ? `+${10 * this.combo}` : '+10', '#ffcf33');
    if (this.combo % 5 === 0) { this.addFloat(e.x, e.y - 28, `¡Combo x${this.combo}!`, '#35e0b2'); this.addShake(6, 0.25); }
    if (!e.boss && Math.random() < 0.18) this.drops.push({ x: e.x, y: e.y, vy: 90, kind: Math.random() < 0.5 ? 'freeze' : 'shield' });
    sfx(e.boss ? 'win' : 'shoot');
  }
  nextWave() {
    this.wave++; this.banner = 2.5; this.spawnT = 0;
    this.spawnLeft = this.wave === 1 ? 10 : this.wave === 2 ? 16 : 0;
    if (this.wave === 3) this.en.push({ x: 240, y: -60, hp: 40, max: 40, boss: true, vx: 90, shoot: 1.5, r: 44 });
  }
  burst(x, y, big) {
    const n = [0, 5, 14][this.q] * (big ? 2 : 1);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, v = 40 + Math.random() * 160;
      this.pt.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.6, col: ['#ffcf33', '#ff6b81', '#35e0b2'][i % 3] });
    }
  }
  hurt() {
    const s = this.ship;
    if (s.inv > 0) return;
    if (this.shield > 0) {   // el escudo se rompe en lugar de perder una vida
      this.shield--; s.inv = 1; this.burst(s.x, s.y, false);
      this.addFloat(s.x, s.y - 52, '🛡️ ¡Escudo!', '#5ad1ff'); sfx('hit'); return;
    }
    s.hp--; s.inv = 1.2; this.combo = 0; this.burst(s.x, s.y, false);
    this.addShake(18, 0.45); this.addFloat(s.x, s.y - 52, '¡Auch!', '#ff6b81'); sfx('hit');
    if (s.hp <= 0) this.end({ crashed: false, waves: this.cleared, won: false });
  }

  update(dt) {
    this.t += dt; this.banner = Math.max(0, this.banner - dt);
    this.boomT = Math.max(0, this.boomT - dt); this.freeze = Math.max(0, this.freeze - dt);
    if (this.ready > 0) { this.ready -= dt; return; }
    if (this.combo > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }
    const s = this.ship, W = this.W, H = this.H, k = this.keys, fz = this.freeze > 0 ? 0.45 : 1;
    if (k.arrowleft || k.a) this.targetX -= 420 * dt;
    if (k.arrowright || k.d) this.targetX += 420 * dt;
    this.targetX = Math.max(24, Math.min(W - 24, this.targetX));
    s.x += Math.max(-380 * dt, Math.min(380 * dt, this.targetX - s.x));
    s.inv = Math.max(0, s.inv - dt); s.cool -= dt;
    if (s.cool <= 0) { s.cool = 0.28; this.pb.push({ x: s.x, y: s.y - 26 }); }
    if (this.spawnLeft > 0 && (this.spawnT -= dt) <= 0) {
      this.spawnT = 0.65; this.spawnLeft--;
      // Tres tipos de enemigo: rápido y frágil, normal, y lento pero resistente.
      const r = Math.random();
      const kind = r < 0.35 ? 'rapido' : r < 0.78 ? 'normal' : 'tanque';
      const cfg = {
        rapido: { hp: 1, r: 16, vy: 95 + this.wave * 16, icon: '🛸' },
        normal: { hp: 2, r: 18, vy: 55 + this.wave * 12, icon: '👾' },
        tanque: { hp: 3, r: 25, vy: 38 + this.wave * 8, icon: '🛰️' }
      }[kind];
      this.en.push({ x: 40 + Math.random() * 400, y: -30, hp: cfg.hp, max: cfg.hp, r: cfg.r, icon: cfg.icon, kind,
        vx: (Math.random() < 0.5 ? -1 : 1) * (30 + Math.random() * 40), vy: cfg.vy, shoot: 1 + Math.random() * 2 });
    }
    for (const e of this.en) {
      if (e.hit) e.hit = Math.max(0, e.hit - dt);
      if (e.boss) { e.y = Math.min(110, e.y + 60 * fz * dt); e.x += e.vx * fz * dt; if (e.x < 70 || e.x > W - 70) e.vx *= -1; }
      else { e.y += e.vy * fz * dt; e.x += e.vx * fz * dt; if (e.x < 30 || e.x > W - 30) e.vx *= -1; }
      if ((e.shoot -= dt * fz) <= 0 && e.y > 0) {
        if (e.boss) { e.shoot = 1.2; for (const vx of [-90, 0, 90]) this.eb.push({ x: e.x, y: e.y + 40, vx, vy: 230 }); }
        else if (this.wave >= 2) { e.shoot = 2 + Math.random() * 2; this.eb.push({ x: e.x, y: e.y + 20, vx: 0, vy: 210 }); }
        else e.shoot = 999;
      }
    }
    for (const b of this.pb) b.y -= 520 * dt;
    for (const b of this.eb) { b.x += b.vx * fz * dt; b.y += b.vy * fz * dt; }
    for (const p of this.pt) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
    for (const d of this.drops) { d.y += d.vy * dt; d.x += Math.sin(this.t * 3 + d.y * 0.02) * 24 * dt; }
    for (const b of this.pb) {
      for (const e of this.en) {
        if (b.dead || e.hp <= 0) continue;
        if (Math.hypot(b.x - e.x, b.y - e.y) < e.r + 6) { b.dead = true; e.hp--; e.hit = 0.18; if (e.hp <= 0) this.kill(e); }
      }
    }
    // Recoger comodines: ❄️ congela a los enemigos, 🛡️ regala un escudo.
    for (const d of this.drops) {
      if (d.dead || Math.hypot(s.x - d.x, s.y - d.y) > 34) continue;
      d.dead = true;
      if (d.kind === 'freeze') { this.freeze = 5; this.addFloat(d.x, d.y, '❄️ ¡Congelados!', '#5ad1ff'); }
      else { this.shield = Math.min(2, this.shield + 1); this.addFloat(d.x, d.y, '🛡️ ¡Escudo!', '#35e0b2'); }
      sfx('star');
    }
    const boss = this.en.find(e => e.boss);
    if (boss && boss.hp <= 0) { this.cleared = 3; return this.end({ crashed: false, waves: 3, won: true }); }
    for (const e of this.en) {
      if (e.hp > 0 && !e.boss && Math.hypot(s.x - e.x, s.y - e.y) < e.r + 16) { e.hp = 0; this.burst(e.x, e.y, false); this.hurt(); }
      if (e.hp > 0 && e.y > H + 20) { e.hp = 0; this.hurt(); }
    }
    for (const b of this.eb) if (Math.hypot(s.x - b.x, s.y - b.y) < 16) { b.dead = true; this.hurt(); }
    if (this.done) return;
    this.en = this.en.filter(e => e.hp > 0);
    this.pb = this.pb.filter(b => !b.dead && b.y > -20);
    this.eb = this.eb.filter(b => !b.dead && b.y < H + 20 && b.x > -20 && b.x < W + 20);
    this.pt = this.pt.filter(p => p.life > 0);
    this.drops = this.drops.filter(d => !d.dead && d.y < H + 30);
    if (this.wave < 3 && this.spawnLeft === 0 && this.en.length === 0) { this.cleared++; this.nextWave(); }
  }

  render(c) {
    const W = this.W, H = this.H, q = this.q, s = this.ship;
    c.fillStyle = '#0f0c3a'; c.fillRect(0, 0, W, H);
    // Parallax: capas de estrellas que se desplazan a distinta velocidad.
    if (q >= 1) {
      const cols = ['rgba(255,255,255,.3)', 'rgba(255,255,255,.55)', 'rgba(255,233,168,.9)'];
      for (let l = 0; l < this.stars.length; l++) {
        c.fillStyle = cols[l];
        for (const st of this.stars[l]) c.fillRect(st.x, q >= 2 ? (st.y + this.t * (14 + l * 16) * st.s) % H : st.y, st.s, st.s);
      }
    }
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const e of this.en) {
      const wigg = Math.sin(this.t * 5 + e.y * 0.05) * 5;
      c.save(); c.translate(e.x + wigg, e.y);
      if (e.hit > 0) c.rotate((Math.random() * 2 - 1) * 0.3);
      c.font = e.boss ? '84px sans-serif' : e.kind === 'tanque' ? '48px sans-serif' : '34px sans-serif';
      c.fillText(e.boss ? '👽' : e.icon || '👾', 0, 0);
      c.restore();
      if (e.boss) { c.fillStyle = '#3a3690'; c.fillRect(e.x - 50, e.y - 62, 100, 8); c.fillStyle = '#ff6b81'; c.fillRect(e.x - 50, e.y - 62, 100 * Math.max(0, e.hp) / e.max, 8); }
    }
    for (const d of this.drops) { c.font = '30px sans-serif'; c.fillText(d.kind === 'freeze' ? '❄️' : '🛡️', d.x, d.y); }
    c.save(); if (q >= 2) c.shadowBlur = 12;
    c.fillStyle = c.shadowColor = '#ffcf33'; for (const b of this.pb) c.fillRect(b.x - 2, b.y - 10, 4, 14);
    c.fillStyle = c.shadowColor = '#ff6b81'; for (const b of this.eb) c.fillRect(b.x - 3, b.y - 3, 6, 10);
    c.restore();
    for (const p of this.pt) { c.globalAlpha = Math.max(0, p.life * 2); c.fillStyle = p.col; c.fillRect(p.x, p.y, 4, 4); }
    c.globalAlpha = 1;
    if (s.inv <= 0 || Math.floor(s.inv * 10) % 2) {
      if (this.shield > 0) { c.save(); c.globalAlpha = 0.85; c.strokeStyle = '#5ad1ff'; c.lineWidth = 4; c.beginPath(); c.arc(s.x, s.y, 30, 0, 6.28); c.stroke(); c.restore(); }
      c.font = '40px sans-serif'; c.fillText('🚀', s.x, s.y);
    }
    // HUD: vidas, oleada, bajas y combo.
    c.save();
    c.fillStyle = 'rgba(10,8,40,.55)'; c.beginPath();
    if (c.roundRect) c.roundRect(8, 8, 240, 114, 16); else c.rect(8, 8, 240, 114);
    c.fill();
    c.textAlign = 'left'; c.font = '20px sans-serif'; c.fillStyle = '#fff';
    c.fillText('❤️'.repeat(Math.max(0, s.hp)), 20, 28);
    c.font = 'bold 15px sans-serif'; c.fillStyle = '#cfe9ff';
    c.fillText(`Oleada ${Math.min(this.wave, 3)}/3`, 20, 54); c.fillText(`🎯 ${this.kills}`, 140, 54);
    if (this.combo > 1) { c.fillStyle = '#ffcf33'; c.fillText(`🔥 Combo x${this.combo}`, 20, 76); }

    // Carga de la superbomba, ahora dentro del recuadro superior para no tapar los botones.
    c.fillStyle = '#fff'; c.font = 'bold 10px sans-serif';
    c.fillText('💥 BOMBA', 20, 98);
    c.save();
    if (this.charge >= 100) { c.shadowColor = '#ff6b81'; c.shadowBlur = 10 + Math.sin(this.t * 8) * 5; }
    this.hudBar(c, 78, 89, 154, 12, this.charge / 100, this.charge >= 100 ? '#ff6b81' : '#ffa94d');
    c.restore();
    c.restore();

    if (this.boomT > 0) { c.globalAlpha = Math.min(0.5, this.boomT); c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
    if (this.freeze > 0) { c.globalAlpha = 0.14; c.fillStyle = '#5ad1ff'; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
    if (this.banner > 0) {
      const pop = 1 + Math.max(0, this.banner - 2) * 1.4;
      c.save(); c.translate(W / 2, H / 2 - 40); c.scale(pop, pop); c.textAlign = 'center';
      c.fillStyle = '#ffcf33'; c.font = 'bold 40px sans-serif';
      c.fillText(this.wave === 3 ? '¡Jefe final!' : `¡Oleada ${this.wave}!`, 0, 0);
      c.restore();
    }
    if (this.ready > 0) this.drawCountdown(c, '¡Defiende la nave!');
  }
}

/* --- Atrapa el Componente (nivel intermedio) --------------------------------
   Caen componentes de hardware y el niño mueve la cesta para atrapar solo los que
   pide la meta. Fácil: caída lenta y una sola meta. Medio: caída normal y trampas
   (virus/basura) que restan puntos. Difícil: caída rápida y varias metas a la vez. */

// Cada ítem pertenece a una categoría; la meta indica qué categorías hay que atrapar.
const catcherItems = [
  { icon: '🧩', cat: 'ram', name: 'memoria RAM' },
  { icon: '🧠', cat: 'cpu', name: 'procesador' },
  { icon: '🎨', cat: 'gpu', name: 'tarjeta gráfica' },
  { icon: '🖱️', cat: 'entrada', name: 'mouse' },
  { icon: '⌨️', cat: 'entrada', name: 'teclado' },
  { icon: '🖥️', cat: 'salida', name: 'monitor' },
  { icon: '🔊', cat: 'salida', name: 'parlante' },
  { icon: '🖨️', cat: 'salida', name: 'impresora' },
  { icon: '💾', cat: 'almacenamiento', name: 'disco duro' }
];
const catcherColors = {
  ram: '#39bdf8', cpu: '#ff6b81', gpu: '#a78bfa',
  entrada: '#ffcf33', salida: '#35e0b2', almacenamiento: '#ffa94d'
};
const catcherTraps = [{ icon: '🦠', name: 'virus' }, { icon: '🗑️', name: 'basura' }];

// Power-ups: se atrapan y dan una ventaja temporal. Hacen que la partida no sea siempre igual.
const catcherPowers = [
  { id: 'magnet', icon: '🧲', name: 'imán', time: 7 },
  { id: 'slow', icon: '⏱️', name: 'cámara lenta', time: 7 },
  { id: 'double', icon: '✨', name: 'puntos dobles', time: 9 }
];

const catcherModes = {
  facil: { fall: 95, spawn: 1.5, traps: 0, targets: ['ram', 'cpu', 'gpu'], short: '¡Atrapa el componente indicado!' },
  medio: { fall: 155, spawn: 1.15, traps: 0.35, targets: ['ram', 'cpu', 'gpu', 'almacenamiento'], short: '¡Atrapa el componente indicado!' },
  dificil: { fall: 220, spawn: 0.9, traps: 0.45, targets: ['cpu', 'ram', 'gpu', 'entrada', 'salida', 'almacenamiento'], short: '¡Cambia de objetivo y esquiva!' }
};

class CatcherGame extends BaseGame {
  constructor(...a) {
    super(...a);
    this.mode = catcherModes[this.p.difficulty] || catcherModes.medio;
    this.cesta = { x: this.W / 2, w: 118, h: 28, tilt: 0 };
    this.cy = this.H - 142;                       // boca de la cesta
    this.items = []; this.sparks = [];
    this.points = 0; this.good = 0; this.bad = 0;
    this.combo = 0; this.bestCombo = 0; this.comboT = 0;
    this.active = {};                             // power-ups activos: id -> segundos que le quedan
    this.powerT = 6;                              // tiempo mínimo antes de soltar otro power-up
    this.banner = ''; this.bannerT = 0;
    this.totalTime = 45; this.time = this.totalTime;
    this.spawnT = 1; this.t = 0; this.ready = 3;
    this.targetIndex = 0;
    this.currentTarget = this.mode.targets[this.targetIndex];
    this.targetChangeEvery = 8;
    this.targetChangeT = this.targetChangeEvery;
    this.targetIcons = catcherItems.find(item => item.cat === this.currentTarget).icon;
    // Botones grandes para mover la cesta sin arrastrar (tablet/teléfono).
    this.btn('left', 14, this.H - 66, 106, 54, '⬅️');
    this.btn('right', this.W - 120, this.H - 66, 106, 54, '➡️');
  }

  onPointer(x) { this.targetX = x; }
  onButton(id, type) {
    if (type !== 'pointerdown') return;
    if (id === 'left') this.targetX -= 76;
    if (id === 'right') this.targetX += 76;
  }

  burst(x, y, col, n) {
    const k = n != null ? n : [0, 5, 12][this.q];
    for (let i = 0; i < k; i++) {
      const a = Math.random() * 6.28, v = 40 + Math.random() * 170;
      this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.55, col });
    }
  }
  // El combo sube con cada acierto seguido y multiplica los puntos (hasta x5).
  mult() { return 1 + Math.min(4, Math.floor(this.combo / 3)); }
  addPoints(n, x, y, texto, col) {
    const total = n > 0 ? Math.round(n * this.mult() * (this.active.double > 0 ? 2 : 1)) : n;
    this.points = Math.max(0, this.points + total);
    this.addFloat(x, y, `${texto}${total > 0 ? '+' : ''}${total}`, col);
  }
  resetCombo() { this.combo = 0; this.comboT = 0; }

  advanceTarget() {
    this.targetIndex = (this.targetIndex + 1) % this.mode.targets.length;
    this.currentTarget = this.mode.targets[this.targetIndex];
    const target = catcherItems.find(item => item.cat === this.currentTarget);
    this.targetIcons = target.icon;
    this.banner = `¡Atrapa ${target.name}!`;
    this.bannerT = 1.5;
    this.resetCombo();
  }

  itemColor(item) {
    if (item.power) return '#5ad1ff';
    if (item.trap) return item.icon === '🦠' ? '#ff4f68' : '#ff974d';
    return catcherColors[item.cat] || '#d7e1ff';
  }

  spawn() {
    const m = this.mode;
    if (this.powerT <= 0 && Math.random() < 0.5) {   // power-up de vez en cuando
      const p = catcherPowers[Math.floor(Math.random() * catcherPowers.length)];
      this.powerT = 13 + Math.random() * 7;
      const item = { icon: p.icon, name: p.name, power: p.id, x: 56 + Math.random() * (this.W - 112), y: -34, vy: m.fall * 0.85, rot: 0, spin: 2 };
      this.items.push({ ...item, color: this.itemColor(item) });
      return;
    }
    const trap = Math.random() < m.traps, safe = !trap && Math.random() < 0.55;
    const pool = trap ? catcherTraps : safe
      ? catcherItems.filter(i => i.cat === this.currentTarget)
      : catcherItems.filter(i => i.cat !== this.currentTarget);
    const it = pool[Math.floor(Math.random() * pool.length)];
    const item = { ...it, trap, x: 56 + Math.random() * (this.W - 112), y: -34, vy: m.fall, rot: (Math.random() * 2 - 1) * 0.5, spin: (Math.random() * 2 - 1) * 1.2 };
    this.items.push({ ...item, color: this.itemColor(item) });
  }

  update(dt) {
    this.t += dt;
    if (this.ready > 0) { this.ready -= dt; return; }
    if ((this.time -= dt) <= 0) return this.end({ crashed: false, score: Math.min(100, this.points), good: this.good, bad: this.bad });
    const k = this.keys, c = this.cesta, m = this.mode, W = this.W;
    if (k.arrowleft || k.a) this.targetX -= 440 * dt;
    if (k.arrowright || k.d) this.targetX += 440 * dt;
    this.targetX = Math.max(c.w / 2, Math.min(W - c.w / 2, this.targetX));
    const dx = Math.max(-560 * dt, Math.min(560 * dt, this.targetX - c.x));
    c.x += dx; c.tilt += (dx * 7 - c.tilt) * Math.min(1, dt * 8);

    for (const id in this.active) this.active[id] = Math.max(0, this.active[id] - dt);
    this.powerT = Math.max(0, this.powerT - dt);
    this.bannerT = Math.max(0, this.bannerT - dt);
    if (this.combo > 0 && (this.comboT -= dt) <= 0) this.resetCombo();
    this.targetChangeT -= dt;
    if (this.targetChangeT <= 0) {
      this.advanceTarget();
      this.targetChangeT = this.targetChangeEvery;
    }

    if ((this.spawnT -= dt) <= 0) { this.spawnT = m.spawn; this.spawn(); }

    const lui = c.x - c.w / 2, lde = c.x + c.w / 2, slowK = this.active.slow > 0 ? 0.5 : 1;
    for (const it of this.items) {
      it.y += it.vy * slowK * dt;
      it.rot += it.spin * dt;
      // El imán arrastra los componentes correctos hacia la cesta.
      if (this.active.magnet > 0 && !it.trap && !it.power && it.cat === this.currentTarget)
        it.x += Math.max(-190 * dt, Math.min(190 * dt, c.x - it.x));
      if (it.y > this.cy - 8 && it.y < this.cy + 34 && it.x > lui - 8 && it.x < lde + 8) {
        it.hit = true;
        if (it.power) {
          this.active[it.power] = catcherPowers.find(p => p.id === it.power).time;
          this.banner = `${it.icon} ¡${it.name}!`; this.bannerT = 1.6;
          this.addFloat(it.x, this.cy - 24, '¡PODER!', '#5ad1ff');
          this.burst(it.x, this.cy, '#5ad1ff', 18); this.addShake(5, 0.3); sfx('star');
        } else if (it.trap) {
          this.bad++; this.resetCombo();
          this.addPoints(-15, it.x, this.cy - 24, `¡${it.name}! `, '#ff6b81');
          this.burst(it.x, this.cy, '#ff6b81'); this.addShake(9, 0.4); sfx('wrong');
        } else if (this.currentTarget === it.cat) {
          this.good++; this.combo++; this.bestCombo = Math.max(this.bestCombo, this.combo); this.comboT = 3;
          this.addPoints(10, it.x, this.cy - 24, `¡${it.name}! `, '#35e0b2');
          this.burst(it.x, this.cy, '#35e0b2'); this.addShake(2.5, 0.16); sfx('correct');
          if (this.combo > 0 && this.combo % 3 === 0) this.addFloat(c.x, this.cy - 62, `¡COMBO x${this.mult()}!`, '#ffcf33');
        } else {
          this.bad++; this.resetCombo();
          this.addPoints(-8, it.x, this.cy - 24, `Ese ${it.name} `, '#ffcf33');
          this.burst(it.x, this.cy, '#ffcf33'); this.addShake(6, 0.3); sfx('wrong');
        }
      }
      if (it.y > this.H + 40) { if (!it.trap && !it.power && it.cat === this.currentTarget) this.resetCombo(); it.gone = true; }
    }
    for (const s of this.sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; }
    this.items = this.items.filter(it => !it.hit && !it.gone);
    this.sparks = this.sparks.filter(s => s.life > 0);
  }

  render(c) {
    const W = this.W, H = this.H, q = this.q, m = this.mode, cc = this.cesta;
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0c1546'); g.addColorStop(0.55, '#16266b'); g.addColorStop(1, '#0a1030');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (q >= 1) { c.fillStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 34; i++) c.fillRect((i * 61) % W, (i * 113 + this.t * 14 * (1 + i % 4)) % H, 2, 2); }
    if (this.active.magnet > 0) {                    // haz de luz del imán
      c.save(); c.globalAlpha = 0.16; c.fillStyle = '#5ad1ff'; c.beginPath();
      c.moveTo(cc.x, this.cy); c.lineTo(cc.x - cc.w * 1.2, 0); c.lineTo(cc.x + cc.w * 1.2, 0); c.closePath(); c.fill(); c.restore();
    }
    c.fillStyle = '#1d2a63'; c.fillRect(0, H - 54, W, 54);
    c.fillStyle = 'rgba(90,209,255,.28)'; c.fillRect(0, H - 54, W, 3);

    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const it of this.items) {
      c.save(); c.translate(it.x, it.y); c.rotate(it.rot);
      const color = it.color || this.itemColor(it);
      c.shadowColor = color; c.shadowBlur = q >= 1 ? 15 : 7;
      c.fillStyle = color; c.globalAlpha = 0.92;
      c.beginPath(); c.arc(0, 0, 23, 0, Math.PI * 2); c.fill();
      c.globalAlpha = 1; c.lineWidth = 2; c.strokeStyle = '#fff'; c.stroke();
      c.shadowBlur = 0; c.font = it.power ? '30px sans-serif' : '28px sans-serif';
      c.fillText(it.icon, 0, 1); c.restore();
    }
    // Cesta con brillo y un poco de mecida al moverse.
    c.save(); c.translate(cc.x, this.cy + cc.h / 2); c.rotate(Math.max(-0.22, Math.min(0.22, cc.tilt / 70)));
    if (q >= 2) { c.shadowColor = '#35e0b2'; c.shadowBlur = 16; }
    const bg = c.createLinearGradient(0, -cc.h / 2, 0, cc.h / 2);
    bg.addColorStop(0, '#5cf5c7'); bg.addColorStop(1, '#17a37f');
    c.fillStyle = bg; c.beginPath();
    if (c.roundRect) c.roundRect(-cc.w / 2, -cc.h / 2, cc.w, cc.h, 12); else c.rect(-cc.w / 2, -cc.h / 2, cc.w, cc.h);
    c.fill();
    c.fillStyle = 'rgba(16,26,69,.8)'; c.fillRect(-cc.w / 2 + 12, -4, cc.w - 24, 9);
    c.restore();
    for (const s of this.sparks) { c.globalAlpha = Math.max(0, s.life * 2); c.fillStyle = s.col; c.fillRect(s.x, s.y, 4, 4); }
    c.globalAlpha = 1;

    // HUD llamativo: puntaje, tiempo, combo y poderes activos.
    c.save();
    c.fillStyle = 'rgba(8,6,34,.55)'; c.beginPath();
    if (c.roundRect) c.roundRect(8, 8, 216, 112, 16); else c.rect(8, 8, 216, 112);
    c.fill();
    c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillStyle = '#ffcf33'; c.font = 'bold 22px sans-serif'; c.fillText(`⭐ ${this.points}`, 20, 30);
    c.fillStyle = '#fff'; c.font = 'bold 18px sans-serif'; c.fillText(`⏱ ${Math.max(0, Math.ceil(this.time))}s`, 128, 30);
    this.hudBar(c, 20, 46, 192, 12, this.time / this.totalTime, this.time < 10 ? '#ff6b81' : '#35e0b2');
    if (this.combo > 1) { c.fillStyle = '#ffcf33'; c.font = 'bold 20px sans-serif'; c.fillText(`🔥 Combo x${this.mult()}`, 20, 76); }
    else {
      const target = catcherItems.find(item => item.cat === this.currentTarget);
      c.fillStyle = 'rgba(255,255,255,.75)'; c.font = 'bold 15px sans-serif'; c.fillText('Atrapa:', 20, 76);
      c.fillStyle = catcherColors[this.currentTarget]; c.font = 'bold 16px sans-serif';
      c.fillText(`${target.icon} ${target.name}`, 80, 76);
      c.fillStyle = '#fff'; c.font = 'bold 11px sans-serif';
      c.fillText(`cambia en ${Math.ceil(this.targetChangeT)}s`, 20, 101);
    }
    let px = 20;
    for (const p of catcherPowers) if (this.active[p.id] > 0) {
      c.fillStyle = 'rgba(90,209,255,.28)'; c.beginPath();
      if (c.roundRect) c.roundRect(px, 90, 44, 22, 11); else c.rect(px, 90, 44, 22);
      c.fill(); c.textAlign = 'center'; c.fillStyle = '#fff'; c.font = 'bold 14px sans-serif';
      c.fillText(`${p.icon}${Math.ceil(this.active[p.id])}`, px + 22, 101); c.textAlign = 'left'; px += 50;
    }
    c.restore();

    if (this.bannerT > 0) {
      c.save(); c.globalAlpha = Math.min(1, this.bannerT * 1.5); c.textAlign = 'center';
      c.font = 'bold 30px sans-serif'; c.lineWidth = 6; c.strokeStyle = 'rgba(8,6,34,.75)';
      c.strokeText(this.banner, W / 2, H / 2 - 96); c.fillStyle = '#5ad1ff'; c.fillText(this.banner, W / 2, H / 2 - 96);
      c.restore();
    }
    if (this.ready > 0) this.drawCountdown(c, m.short);
  }
}

/* --- Defensa del Sistema (nivel experto) -----------------------------------
   Un tower-defense sencillo: los virus salen de los bordes y avanzan hacia el
   núcleo (la CPU) en el centro. El niño toca o hace clic sobre cada uno para
   eliminarlo antes de que llegue al núcleo. Fácil: pocos y lentos. Medio:
   oleadas más grandes y rápidas. Difícil: más virus, aguantan 2 toques y el
   jefe final pide muchos clics. Tres oleadas, la última es el virus jefe.
   Los aciertos seguidos llenan la barra de la SUPERBOMBA, que limpia la
   pantalla de un solo toque cuando está cargada. */
const guardianModes = {
  facil: { speed: 30, hp: 1, bossHp: 5, every: 1.35, counts: [6, 9], coreHp: 6, bossSpeed: 17 },
  medio: { speed: 44, hp: 1, bossHp: 8, every: 1.0, counts: [8, 12], coreHp: 5, bossSpeed: 22 },
  dificil: { speed: 58, hp: 2, bossHp: 12, every: 0.8, counts: [10, 14], coreHp: 4, bossSpeed: 28 }
};
const guardianBugs = [{ icon: '🦠', name: 'virus' }, { icon: '👾', name: 'malware' }, { icon: '🧟', name: 'troyano' }];
const guardianBoss = { icon: '👹', name: 'virus jefe' };

class GuardianGame extends BaseGame {
  constructor(...a) {
    super(...a);
    const m = this.mode = guardianModes[this.p.difficulty] || guardianModes.medio;
    this.core = { x: this.W / 2, y: this.H / 2 + 60, hp: m.coreHp, max: m.coreHp, hit: 0 };
    this.bugs = []; this.pops = []; this.ripples = [];
    this.t = 0; this.wave = 0; this.cleared = 0; this.left = 0; this.spawnT = 0;
    this.killed = 0; this.escaped = 0; this.combo = 0; this.best = 0;
    this.charge = 0; this.boomT = 0;
    this.ready = 3; this.banner = 0;
    this.btn('boom', this.W / 2 - 56, this.H - 76, 112, 58, '💥', '#ffcf33');
    this.startWave();
  }

  startWave() {
    this.wave++; this.banner = 2.2; this.spawnT = 1.6;
    this.left = this.wave === 3 ? 1 : this.mode.counts[this.wave - 1];
  }

  // Los virus nacen fuera del tablero (arriba, izquierda o derecha) y apuntan al núcleo.
  spawn(boss) {
    const m = this.mode;
    const b = boss ? guardianBoss : guardianBugs[Math.floor(Math.random() * guardianBugs.length)];
    const lado = ['top', 'left', 'right'][Math.floor(Math.random() * 3)];
    let x = boss ? this.core.x : 40 + Math.random() * (this.W - 80), y = -34;
    if (!boss && lado !== 'top') { x = lado === 'left' ? -34 : this.W + 34; y = 70 + Math.random() * (this.H - 330); }
    const rapido = b.name === 'malware' ? 1.35 : b.name === 'troyano' ? 0.72 : 1;
    const ang = Math.atan2(this.core.y - y, this.core.x - x), sp = (boss ? m.bossSpeed : m.speed) * rapido;
    const hp = boss ? m.bossHp : Math.max(m.hp, b.name === 'troyano' ? 2 : 1);
    this.bugs.push({ icon: b.icon, name: b.name, x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, hp, max: hp, boss: !!boss, r: boss ? 46 : 22, t: Math.random() * 6, hit: 0 });
  }

  pop(x, y, col, n) {
    const k = n != null ? n : [0, 6, 14][this.q];
    for (let i = 0; i < k; i++) {
      const a = Math.random() * 6.28, v = 40 + Math.random() * 170;
      this.pops.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.55, col });
    }
  }
  ripple(x, y, col = '#5ad1ff') { this.ripples.push({ x, y, r: 8, life: 0.42, max: 0.42, col }); }

  // Cada toque en un virus le quita un punto de vida; tocar el fondo no hace nada malo.
  onPointer(x, type, y) {
    if (type !== 'pointerdown' || this.done || this.ready > 0) return;
    this.ripple(x, y);
    // Buscamos un virus vivo que esté cerca del toque (buffer de 16px para facilitar el acierto).
    const bug = this.bugs.find(b => !b.dead && Math.hypot(x - b.x, y - b.y) < b.r + 16);
    sfx('shoot');
    if (!bug) { this.pop(x, y, '#8a86c9', [0, 3, 7][this.q]); return; }
    bug.hit = 0.18;
    if (--bug.hp > 0) { this.pop(bug.x, bug.y, '#ffcf33', [0, 4, 10][this.q]); return; }
    this.kill(bug);
  }
  // Los aciertos seguidos suben el combo, y el combo llena la bomba más rápido.
  kill(bug) {
    bug.dead = true;
    this.killed++; this.combo++; this.best = Math.max(this.best, this.combo);
    this.charge = Math.min(100, this.charge + 12 + Math.min(18, this.combo * 3));
    this.pop(bug.x, bug.y, bug.boss ? '#ffcf33' : '#35e0b2', bug.boss ? [0, 18, 32][this.q] : undefined);
    this.addFloat(bug.x, bug.y - 18, `+${this.combo}`, '#35e0b2');
    this.addShake(bug.boss ? 15 : 4, bug.boss ? 0.6 : 0.22);
    sfx('hit');
    if (this.combo % 5 === 0) this.addFloat(this.core.x, this.core.y - 96, `¡COMBO x${this.combo}!`, '#ffcf33');
    if (bug.boss) this.end({ crashed: false, waves: 3, won: true });
  }
  // La SUPERBOMBA: solo funciona con la barra llena. Limpia la pantalla de virus.
  onButton(id, type) {
    if (type !== 'pointerdown' || id !== 'boom' || this.done || this.ready > 0) return;
    if (this.charge < 100) { sfx('wrong'); this.addFloat(this.W / 2, this.H - 104, '¡Aún no está lista!', '#ff6b81'); return; }
    this.charge = 0; this.boomT = 0.6;
    for (const b of this.bugs) if (!b.boss) { b.dead = true; this.killed++; this.pop(b.x, b.y, '#ffcf33', [0, 8, 16][this.q]); }
    this.bugs = this.bugs.filter(b => !b.dead);
    this.addShake(18, 0.7); this.addFloat(this.W / 2, this.H / 2 - 140, '¡SUPERBOMBA!', '#ffcf33'); sfx('boost');
  }

  update(dt) {
    this.t += dt;
    for (const r of this.ripples) { r.r += 200 * dt; r.life -= dt; }
    this.ripples = this.ripples.filter(r => r.life > 0);
    if (this.ready > 0) { this.ready -= dt; return; }
    const core = this.core, m = this.mode;
    this.banner = Math.max(0, this.banner - dt);
    this.boomT = Math.max(0, this.boomT - dt);
    core.hit = Math.max(0, core.hit - dt);
    if (this.left > 0 && this.banner <= 0 && (this.spawnT -= dt) <= 0) { this.spawn(this.wave === 3); this.spawnT = m.every; this.left--; }
    for (const b of this.bugs) {
      b.t += dt; b.hit = Math.max(0, b.hit - dt);
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (Math.hypot(core.x - b.x, core.y - b.y) < (b.boss ? 64 : 36)) {
        b.dead = true; core.hp -= b.boss ? 3 : 1; core.hit = 0.45; this.escaped++;
        this.combo = 0;                        // se te escapó uno: adiós al combo
        this.pop(core.x, core.y - 50, '#ff6b81', [0, 10, 20][this.q]);
        this.addFloat(core.x, core.y - 78, '¡Golpe!', '#ff6b81');
        this.addShake(12, 0.5); sfx('wrong');
      }
    }
    for (const p of this.pops) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
    this.bugs = this.bugs.filter(b => !b.dead);
    this.pops = this.pops.filter(p => p.life > 0);
    if (core.hp <= 0) return this.end({ crashed: false, waves: this.cleared, won: false });
    // Si no quedan virus y la oleada terminó: pasamos a la siguiente o ganamos el juego.
    if (this.left === 0 && !this.bugs.length) {
      if (this.wave < 3) { this.cleared++; this.startWave(); }
      else if (!this.done) { this.end({ crashed: false, waves: 3, won: true }); }
    }
  }

  render(c) {
    const W = this.W, H = this.H, q = this.q, core = this.core;
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#08122e'); g.addColorStop(0.6, '#0d1c46'); g.addColorStop(1, '#070a22');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(110,140,255,.10)'; c.lineWidth = 1;      // placa base
    for (let x = 0; x < W; x += 40) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
    for (let y = 0; y < H; y += 40) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    if (q >= 1) {                                                   // ondas de "circuito" alrededor del núcleo
      c.save(); c.globalAlpha = 0.18; c.strokeStyle = '#5ad1ff'; c.lineWidth = 2;
      for (let i = 0; i < 3; i++) { const rr = 118 + i * 46 + Math.sin(this.t * 1.6 + i) * 9; c.beginPath(); c.arc(core.x, core.y, rr, 0, Math.PI * 2); c.stroke(); }
      c.restore();
    }
    const col = core.hit > 0 ? '#ff6b81' : '#35e0b2';
    c.save(); if (q >= 2) { c.shadowColor = col; c.shadowBlur = 20; }
    c.fillStyle = core.hit > 0 ? '#5c1b34' : '#14224e';
    c.beginPath();
    if (c.roundRect) c.roundRect(core.x - 60, core.y - 60, 120, 120, 20); else c.rect(core.x - 60, core.y - 60, 120, 120);
    c.fill(); c.strokeStyle = col; c.lineWidth = 4; c.stroke(); c.restore();
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '48px sans-serif'; c.fillText('🧠', core.x, core.y - 12);
    c.fillStyle = '#fff'; c.font = 'bold 16px sans-serif'; c.fillText('CPU', core.x, core.y + 28);
    this.hudBar(c, core.x - 60, core.y + 48, 120, 11, core.hp / core.max, '#35e0b2');

    for (const b of this.bugs) {
      c.save(); c.translate(b.x, b.y);
      c.rotate(b.hit > 0 ? 0.5 : Math.sin(this.t * 5 + b.t) * 0.16);
      c.font = b.boss ? '88px sans-serif' : '36px sans-serif';
      if (b.hit > 0) { c.shadowColor = '#fff'; c.shadowBlur = 20; }
      c.fillText(b.icon, 0, 0); c.restore();
      if (b.hp > 1 && !b.boss) { c.fillStyle = '#ffcf33'; c.font = 'bold 13px sans-serif'; c.fillText(b.hp, b.x + 21, b.y - 17); }
    }
    const boss = this.bugs.find(b => b.boss);
    if (boss) {
      c.fillStyle = 'rgba(8,6,34,.62)'; c.beginPath();
      if (c.roundRect) c.roundRect(boss.x - 66, boss.y - 80, 132, 14, 7); else c.rect(boss.x - 66, boss.y - 80, 132, 14);
      c.fill();
      c.fillStyle = '#ff6b81'; c.fillRect(boss.x - 64, boss.y - 78, 128 * Math.max(0, boss.hp) / boss.max, 10);
    }
    for (const r of this.ripples) {
      c.save(); c.globalAlpha = Math.max(0, r.life / r.max) * 0.85; c.strokeStyle = r.col; c.lineWidth = 3;
      c.beginPath(); c.arc(r.x, r.y, r.r, 0, Math.PI * 2); c.stroke(); c.restore();
    }
    for (const p of this.pops) { c.globalAlpha = Math.max(0, p.life * 2); c.fillStyle = p.col; c.fillRect(p.x, p.y, 4, 4); }
    c.globalAlpha = 1;

    // HUD: corazones, oleada, bajas, combo y recarga de la bomba.
    c.save();
    c.fillStyle = 'rgba(8,6,34,.55)'; c.beginPath();
    if (c.roundRect) c.roundRect(8, 8, 220, 116, 16); else c.rect(8, 8, 220, 116);
    c.fill();
    c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillStyle = '#ff6b81'; c.font = 'bold 22px sans-serif'; c.fillText('❤️'.repeat(Math.max(0, core.hp)), 22, 30);
    c.fillStyle = '#fff'; c.font = 'bold 18px sans-serif'; c.fillText(`Oleada ${Math.min(this.wave, 3)}/3`, 22, 58);
    c.fillStyle = '#ffcf33'; c.fillText(`🛡️ ${this.killed}`, 22, 84);
    if (this.combo > 1) { c.fillStyle = '#ffcf33'; c.font = 'bold 18px sans-serif'; c.fillText(`🔥 x${this.combo}`, 130, 84); }
    c.fillStyle = 'rgba(255,255,255,.75)'; c.font = 'bold 14px sans-serif'; c.fillText('Recarga de la bomba', 22, 108);
    c.restore();
    this.hudBar(c, W / 2 - 72, H - 94, 144, 12, this.charge / 100, this.charge >= 100 ? '#ffcf33' : '#5ad1ff');
    if (this.charge >= 100) {
      c.save(); c.globalAlpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(this.t * 8)); c.strokeStyle = '#ffcf33'; c.lineWidth = 6;
      c.beginPath();
      if (c.roundRect) c.roundRect(W / 2 - 62, H - 82, 124, 70, 22); else c.rect(W / 2 - 62, H - 82, 124, 70);
      c.stroke(); c.restore();
    }
    if (this.boomT > 0) { c.globalAlpha = Math.min(0.45, this.boomT * 0.8); c.fillStyle = '#ffcf33'; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
    if (this.banner > 0 && this.ready <= 0) {
      c.textAlign = 'center'; c.fillStyle = this.wave === 3 ? '#ff6b81' : '#ffcf33'; c.font = 'bold 40px sans-serif';
      c.fillText(this.wave === 3 ? '¡Virus jefe!' : `¡Oleada ${this.wave}!`, W / 2, H / 2 - 170);
    }
    if (this.ready > 0) this.drawCountdown(c, '¡Toca los virus!');
  }
}

/* --- El Organizador de Disco -----------------------------------------------
   Puzzle de bloques: el espacio del tablero depende de la RAM y el ritmo de
   descarga depende del almacenamiento ROM. */
const diskShapes = [
  { color: '#5ad1ff', cells: [[1, 1, 1, 1]] },
  { color: '#ffcf33', cells: [[1, 1], [1, 1]] },
  { color: '#ff6b81', cells: [[0, 1, 0], [1, 1, 1]] },
  { color: '#35e0b2', cells: [[0, 1, 1], [1, 1, 0]] },
  { color: '#a78bfa', cells: [[1, 1, 0], [0, 1, 1]] },
  { color: '#ffa94d', cells: [[1, 0, 0], [1, 1, 1]] },
  { color: '#4ade80', cells: [[0, 0, 1], [1, 1, 1]] }
];
const diskIcons = ['📷', '🎬', '📁', '🎵'];

class DiskOrganizerGame extends BaseGame {
  constructor(...args) {
    super(...args);
    const ram = this.p.componentLevels.ram || 1;
    this.cols = ram < 2 ? 8 : ram < 3 ? 9 : 10;
    this.rows = ram < 2 ? 14 : ram < 3 ? 16 : 18;
    this.cell = 22;
    this.boardX = Math.round((this.W - this.cols * this.cell) / 2);
    this.boardY = 126;
    this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(null));
    this.rom = this.p.componentLevels.rom || 1;
    this.mode = { facil: 1.25, medio: 0.95, dificil: 0.72 }[this.p.difficulty] || 0.95;
    this.active = null;
    this.lines = 0;
    this.pieces = 0;
    this.t = 0;
    this.fallT = 0;
    this.moveT = 0;
    this.softDropT = 0;
    this.ready = 3;
    this.btn('left', 38, this.H - 64, 70, 48, '⬅️');
    this.btn('down', 116, this.H - 64, 70, 48, '⬇️');
    this.btn('rotate', 194, this.H - 64, 70, 48, '🔄');
    this.btn('drop', 272, this.H - 64, 70, 48, '⏬');
    this.btn('right', 350, this.H - 64, 70, 48, '➡️');
    this.spawn();
  }

  spawn() {
    const shape = diskShapes[Math.floor(Math.random() * diskShapes.length)];
    this.active = {
      cells: shape.cells.map(row => row.slice()), color: shape.color,
      icon: diskIcons[Math.floor(Math.random() * diskIcons.length)],
      x: Math.floor((this.cols - shape.cells[0].length) / 2), y: 0
    };
    if (this.collides(this.active, 0, 0)) {
      this.end(this.result(false));
    }
  }

  score() { return Math.min(100, this.lines * 18 + Math.floor(this.pieces / 3) * 5); }
  result(won) { return { crashed: false, score: this.score(), won, lines: this.lines, pieces: this.pieces }; }

  collides(piece, dx, dy, cells = piece.cells) {
    return cells.some((row, y) => row.some((value, x) => {
      if (!value) return false;
      const gx = piece.x + x + dx, gy = piece.y + y + dy;
      return gx < 0 || gx >= this.cols || gy >= this.rows || (gy >= 0 && this.grid[gy][gx]);
    }));
  }

  shift(dx, dy) {
    if (this.collides(this.active, dx, dy)) {
      if (dy > 0) this.lockPiece();
      return false;
    }
    this.active.x += dx; this.active.y += dy;
    return true;
  }

  rotate() {
    const cells = this.active.cells[0].map((_, x) => this.active.cells.map(row => row[x]).reverse());
    if (!this.collides(this.active, 0, 0, cells)) this.active.cells = cells;
  }

  hardDrop() {
    while (!this.collides(this.active, 0, 1)) this.active.y++;
    this.lockPiece();
  }

  lockPiece() {
    this.active.cells.forEach((row, y) => row.forEach((value, x) => {
      const gx = this.active.x + x, gy = this.active.y + y;
      if (value && gy >= 0) this.grid[gy][gx] = { color: this.active.color, icon: this.active.icon };
    }));
    this.pieces++;
    const remaining = this.grid.filter(row => row.some(cell => !cell));
    const cleared = this.rows - remaining.length;
    this.lines += cleared;
    while (remaining.length < this.rows) remaining.unshift(Array(this.cols).fill(null));
    this.grid = remaining;
    if (cleared) { this.addFloat(this.W / 2, this.boardY + 80, `+${cleared} fila${cleared > 1 ? 's' : ''}`, '#35e0b2'); sfx('star'); }
    if (this.lines >= 6) {
      this.end(this.result(true));
      return;
    }
    this.spawn();
  }

  onKey(key) {
    if (this.ready > 0 || this.done) return;
    if (key === 'arrowleft' || key === 'a') this.shift(-1, 0);
    else if (key === 'arrowright' || key === 'd') this.shift(1, 0);
    else if (key === 'arrowup' || key === 'w') this.rotate();
    else if (key === ' ') this.hardDrop();
  }

  onButton(id, type) {
    if (type !== 'pointerdown' || this.ready > 0 || this.done) return;
    if (id === 'left') this.shift(-1, 0);
    else if (id === 'right') this.shift(1, 0);
    else if (id === 'down') this.shift(0, 1);
    else if (id === 'rotate') this.rotate();
    else if (id === 'drop') this.hardDrop();
  }

  update(dt) {
    this.t += dt;
    if (this.ready > 0) { this.ready -= dt; return; }
    const horizontal = this.keys.arrowleft || this.keys.a ? -1 : this.keys.arrowright || this.keys.d ? 1 : 0;
    if (horizontal) {
      this.moveT -= dt;
      if (this.moveT <= 0) {
        this.shift(horizontal, 0);
        this.moveT = 0.16 + (this.p.componentLevels.cpu === 1 ? 0.08 : 0);
      }
    } else this.moveT = 0;
    const fallEvery = this.mode;
    this.fallT += dt;
    if (this.fallT >= fallEvery) { this.fallT = 0; this.shift(0, 1); }
    if (this.keys.arrowdown || this.keys.s) {
      this.softDropT -= dt;
      if (this.softDropT <= 0) {
        this.shift(0, 1);
        this.softDropT = 0.09;
      }
    } else this.softDropT = 0;
  }

  drawCell(c, x, y, cell, item) {
    c.fillStyle = item.color; c.fillRect(x + 1, y + 1, cell - 2, cell - 2);
    c.strokeStyle = 'rgba(10,8,40,.55)'; c.lineWidth = 2; c.strokeRect(x + 2, y + 2, cell - 4, cell - 4);
    if (cell >= 20) { c.font = `${Math.floor(cell * 0.62)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(item.icon, x + cell / 2, y + cell / 2 + 1); }
  }

  render(c) {
    c.fillStyle = '#10123c'; c.fillRect(0, 0, this.W, this.H);
    c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; c.font = 'bold 20px sans-serif';
    c.fillText('💾 ORGANIZA EL DISCO', 18, 30);
    c.font = 'bold 16px sans-serif'; c.fillText(`Filas: ${this.lines}   Archivos: ${this.pieces}`, 18, 62);
    c.fillStyle = '#17183c'; c.fillRect(this.boardX - 4, this.boardY - 4, this.cols * this.cell + 8, this.rows * this.cell + 8);
    for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) {
      const px = this.boardX + x * this.cell, py = this.boardY + y * this.cell;
      c.fillStyle = '#25264e'; c.fillRect(px, py, this.cell - 1, this.cell - 1);
      if (this.grid[y][x]) this.drawCell(c, px, py, this.cell, this.grid[y][x]);
    }
    if (this.active) this.active.cells.forEach((row, y) => row.forEach((value, x) => {
      if (value) this.drawCell(c, this.boardX + (this.active.x + x) * this.cell, this.boardY + (this.active.y + y) * this.cell, this.cell, this.active);
    }));
    if (this.ready > 0) this.drawCountdown(c, this.rom === 1 ? '¡Ordena tus archivos!' : '¡Disco listo!');
  }
}

/* --- Laberinto de Datos -----------------------------------------------------
   La RAM permite cargar laberintos mayores; el procesador determina la respuesta
   de Byte y la ROM influye en la velocidad de carga simulada. */
class DataMazeGame extends BaseGame {
  constructor(...args) {
    super(...args);
    const ram = this.p.componentLevels.ram || 1;
    const size = ram < 2 ? [11, 13] : ram < 3 ? [13, 17] : [15, 19];
    this.cols = size[0]; this.rows = size[1];
    this.cell = Math.floor(Math.min(23, (this.W - 104) / this.cols, (this.H - 228) / this.rows));
    this.boardX = Math.floor((this.W - this.cols * this.cell) / 2);
    this.boardY = 118;
    this.maze = this.createMaze();
    this.startPos = { x: 1, y: 1 };
    this.goal = { x: this.cols - 2, y: this.rows - 2 };
    this.player = { ...this.startPos };
    this.targetPackets = 8;
    this.packets = this.placeItems(this.targetPackets, [this.startPos, this.goal]);
    this.viruses = this.placeItems(2, [this.startPos, this.goal, ...this.packets]);
    this.lives = 3; this.t = 0; this.moveT = 0;
    this.virusT = 0; this.ready = this.p.componentLevels.rom === 1 ? 5 : 3;
    this.pointerDir = null; this.pointerMoveT = 0;
    const btnY = this.H - 62;
    this.btn('up', this.W / 2 - 36, btnY - 48, 72, 44, '⬆️');
    this.btn('left', this.W / 2 - 116, btnY, 72, 44, '⬅️');
    this.btn('down', this.W / 2 - 36, btnY, 72, 44, '⬇️');
    this.btn('right', this.W / 2 + 44, btnY, 72, 44, '➡️');
  }

  createMaze() {
    const maze = Array.from({ length: this.rows }, () => Array(this.cols).fill(1));
    const stack = [{ x: 1, y: 1 }];
    maze[1][1] = 0;
    while (stack.length) {
      const current = stack[stack.length - 1];
      const next = [[0, -2], [0, 2], [-2, 0], [2, 0]]
        .map(([dx, dy]) => ({ x: current.x + dx, y: current.y + dy, dx, dy }))
        .filter(pos => pos.x > 0 && pos.x < this.cols - 1 && pos.y > 0 && pos.y < this.rows - 1 && maze[pos.y][pos.x]);
      if (!next.length) { stack.pop(); continue; }
      const chosen = next[Math.floor(Math.random() * next.length)];
      maze[current.y + chosen.dy / 2][current.x + chosen.dx / 2] = 0;
      maze[chosen.y][chosen.x] = 0;
      stack.push({ x: chosen.x, y: chosen.y });
    }

    const loopWalls = [];
    for (let y = 1; y < this.rows - 1; y++) {
      for (let x = 1; x < this.cols - 1; x++) {
        if (maze[y][x] !== 1) continue;
        const joinsHorizontal = maze[y][x - 1] === 0 && maze[y][x + 1] === 0;
        const joinsVertical = maze[y - 1][x] === 0 && maze[y + 1][x] === 0;
        if (joinsHorizontal || joinsVertical) loopWalls.push({ x, y });
      }
    }
    for (let i = loopWalls.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [loopWalls[i], loopWalls[j]] = [loopWalls[j], loopWalls[i]];
    }
    const openings = Math.min(loopWalls.length, Math.max(3, Math.floor(loopWalls.length * 0.2)));
    for (const wall of loopWalls.slice(0, openings)) maze[wall.y][wall.x] = 0;

    return maze;
  }

  placeItems(count, excluded) {
    const taken = new Set(excluded.map(pos => `${pos.x},${pos.y}`));
    const available = [];
    for (let y = 1; y < this.rows - 1; y++) for (let x = 1; x < this.cols - 1; x++)
      if (!this.maze[y][x] && !taken.has(`${x},${y}`)) available.push({ x, y });
    const items = [];
    while (items.length < count && available.length) {
      const index = Math.floor(Math.random() * available.length);
      items.push(available.splice(index, 1)[0]);
    }
    return items;
  }

  onKey(key) {
    // El teclado se procesa desde this.keys en update; pointerDir es solo para controles táctiles.
  }

  onButton(id, type) {
    if (type !== 'pointerdown' || this.done || this.ready > 0) return;
    const directions = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
    this.pointerDir = directions[id];
    this.movePlayer(...this.pointerDir);
    this.pointerMoveT = 0.18;
  }

  onRelease() { this.pointerDir = null; }

  result(won) {
    const packetsCollected = this.targetPackets - this.packets.length;
    return {
      crashed: false, score: Math.min(100, packetsCollected * 12), won,
      packetsCollected, totalPackets: this.targetPackets
    };
  }

  movePlayer(dx, dy) {
    const x = this.player.x + dx, y = this.player.y + dy;
    if (this.maze[y] && this.maze[y][x] === 0) { this.player.x = x; this.player.y = y; }
    const packet = this.packets.findIndex(pos => pos.x === this.player.x && pos.y === this.player.y);
    if (packet >= 0) {
      this.packets.splice(packet, 1); sfx('coin');
      this.addFloat(this.boardX + this.player.x * this.cell, this.boardY + this.player.y * this.cell, '+12', '#ffcf33');
      if (this.packets.length === 0) return this.end(this.result(true));
    }
    const virus = this.viruses.find(pos => pos.x === this.player.x && pos.y === this.player.y);
    if (virus) {
      this.lives--;
      this.player = { ...this.startPos };
      virus.x = this.cols - 2; virus.y = this.rows - 2;
      this.addShake(8, 0.35); sfx('wrong');
      if (this.lives <= 0) this.end(this.result(false));
    }
    if (this.player.x === this.goal.x && this.player.y === this.goal.y) {
      const collected = this.targetPackets - this.packets.length;
      this.end(this.result(collected >= 5));
    }
  }

  virusStep(virus) {
    const queue = [{ x: virus.x, y: virus.y, first: null }], visited = new Set([`${virus.x},${virus.y}`]);
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    while (queue.length) {
      const pos = queue.shift();
      if (pos.x === this.player.x && pos.y === this.player.y) {
        if (pos.first) { virus.x = pos.first.x; virus.y = pos.first.y; }
        return;
      }
      for (const [dx, dy] of dirs) {
        const x = pos.x + dx, y = pos.y + dy, key = `${x},${y}`;
        if (this.maze[y] && this.maze[y][x] === 0 && !visited.has(key)) {
          visited.add(key); queue.push({ x, y, first: pos.first || { x, y } });
        }
      }
    }
  }

  update(dt) {
    this.t += dt;
    if (this.ready > 0) { this.ready -= dt; return; }
    const dx = this.keys.arrowleft || this.keys.a ? -1 : this.keys.arrowright || this.keys.d ? 1 : 0;
    const dy = this.keys.arrowup || this.keys.w ? -1 : this.keys.arrowdown || this.keys.s ? 1 : 0;
    const cpu = this.p.componentLevels.cpu || 1;
    this.moveT -= dt;
    if ((dx || dy) && this.moveT <= 0) {
      this.movePlayer(dx, dy);
      this.moveT = 0.26 - Math.min(cpu - 1, 3) * 0.035;
    } else if (this.pointerDir && (this.pointerMoveT -= dt) <= 0) {
      this.movePlayer(...this.pointerDir);
      this.pointerMoveT = 0.18;
    }
    this.virusT += dt;
    if (this.virusT >= 0.85) {
      this.virusT = 0;
      this.viruses.forEach(virus => this.virusStep(virus));
      if (this.viruses.some(virus => virus.x === this.player.x && virus.y === this.player.y)) this.movePlayer(0, 0);
    }
  }

  render(c) {
    c.fillStyle = '#08122e'; c.fillRect(0, 0, this.W, this.H);
    c.fillStyle = '#fff'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.font = 'bold 20px sans-serif';
    c.fillText('🤖 LABERINTO DE DATOS', 16, 28);
    c.font = 'bold 15px sans-serif'; c.fillStyle = '#ffcf33';
    c.fillText(`Paquetes: ${this.targetPackets - this.packets.length}/${this.targetPackets}`, 16, 60);
    c.fillStyle = '#ff6b81'; c.fillText(`Vidas: ${'❤️'.repeat(this.lives)}`, 16, 88);
    for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) {
      const px = this.boardX + x * this.cell, py = this.boardY + y * this.cell;
      c.fillStyle = this.maze[y][x] ? '#29346b' : '#101b42';
      c.fillRect(px, py, this.cell - 1, this.cell - 1);
      if (x === this.goal.x && y === this.goal.y) { c.font = `${this.cell - 2}px sans-serif`; c.textAlign = 'center'; c.fillText('🏁', px + this.cell / 2, py + this.cell / 2); }
    }
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `${Math.max(12, this.cell - 3)}px sans-serif`;
    this.packets.forEach(pos => c.fillText('📦', this.boardX + (pos.x + 0.5) * this.cell, this.boardY + (pos.y + 0.5) * this.cell));
    this.viruses.forEach(pos => c.fillText('🦠', this.boardX + (pos.x + 0.5) * this.cell, this.boardY + (pos.y + 0.5) * this.cell));
    c.font = `${Math.max(14, this.cell - 1)}px sans-serif`;
    c.fillText('🤖', this.boardX + (this.player.x + 0.5) * this.cell, this.boardY + (this.player.y + 0.5) * this.cell);
    if (this.ready > 0) this.drawCountdown(c, this.p.componentLevels.rom === 1 ? 'Cargando con ROM básica…' : '¡Busca los paquetes!');
  }
}

if (typeof module !== 'undefined') module.exports = { BaseGame, RaceGame, DefenseGame, CatcherGame, GuardianGame, DiskOrganizerGame, DataMazeGame };
