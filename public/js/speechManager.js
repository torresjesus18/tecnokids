/* Lectura en voz alta para TecnoKids (Web Speech API nativa).
   Lee en español a ritmo pausado y con voz amigable, y respeta el interruptor
   de sonido de los Ajustes (⚙️) para que un niño no reciba voz si lo silenció. */
(function (global) {
  const synth = global.speechSynthesis;
  const LANG = ['es-ES', 'es-MX'];
  const RATE = 0.85;   // velocidad pausada, fácil de seguir
  const PITCH = 1.15;  // tono un poco agudo: más amigable para niños
  let voice = null;

  // Las voces se cargan de forma asíncrona en la mayoría de navegadores.
  function pickVoice() {
    if (!synth) return;
    const list = synth.getVoices() || [];
    voice = LANG.map(l => list.find(v => v.lang.replace('_', '-').startsWith(l))).find(Boolean)
      || list.find(v => /^es/i.test(v.lang)) || null;
  }
  if (synth) { pickVoice(); synth.addEventListener('voiceschanged', pickVoice); }

  // Quita emojis y símbolos para que la voz diga solo lo que importa.
  const clean = t => String(t || '').replace(/[\u{1F000}-\u{1FAFF}\u{2190}-\u{2BFF}\u{FE0F}\u{20E3}]/gu, ' ')
    .replace(/\s+/g, ' ').trim();

  function speakText(text) {
    if (!synth) return false;
    if (global.SoundManager && (global.SoundManager.isMuted() || global.SoundManager.getSettings().sfxVolume <= 0)) return false;
    const t = clean(text);
    if (!t) return false;
    synth.cancel(); // nunca encimar dos lecturas
    const u = new SpeechSynthesisUtterance(t);
    u.lang = (voice && voice.lang) || LANG[0];
    if (voice) u.voice = voice;
    u.rate = RATE; u.pitch = PITCH;
    u.volume = global.SoundManager ? global.SoundManager.getSettings().sfxVolume / 100 : 1;
    synth.speak(u);
    return true;
  }

  const stopSpeaking = () => { if (synth) synth.cancel(); };

  // data-speak="texto", data-speak-sel="#id" (lee ese elemento) o, si no hay nada,
  // se lee el propio contenido del botón (sin el icono 🔊).
  function readFrom(el) {
    const target = el.dataset.speakSel && document.querySelector(el.dataset.speakSel);
    const root = target || el;
    if (root.dataset.speak) return speakText(root.dataset.speak);
    const clone = root.cloneNode(true);
    clone.querySelectorAll('.speak-btn, [data-no-speak], script').forEach(n => n.remove());
    return speakText(clone.getAttribute('aria-label') || clone.textContent);
  }

  // Al pasar el mouse por encima de botones e instrucciones marcadas, se leen solas.
  document.addEventListener('mouseenter', e => {
    if (!e.target.closest) return;
    const el = e.target.closest('[data-speak], .btn:not(.speak-btn), .nav-link, .opt');
    if (el) readFrom(el);
  }, true);

  // Al hacer clic en un botón 🔊 o en una instrucción marcada, también se lee.
  document.addEventListener('click', e => {
    if (!e.target.closest) return;
    const el = e.target.closest('.speak-btn, [data-speak]');
    if (el) readFrom(el);
  });

  global.SpeechManager = {
    speakText, stopSpeaking,
    isSupported: () => !!synth,
    isSpeaking: () => !!synth && synth.speaking
  };
})(typeof window !== 'undefined' ? window : globalThis);
