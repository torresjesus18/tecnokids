(() => {
  const widget = document.querySelector('#byte-widget');
  const app = document.querySelector('#app');
  if (!widget || !app) return;

  const panel = document.querySelector('#byte-panel');
  const launcher = document.querySelector('#byte-launcher');
  const answer = document.querySelector('#byte-answer');
  const link = document.querySelector('#byte-link');
  const voice = document.querySelector('#byte-voice');
  const gameHints = {
    carrera: 'Recoge los rayos ⚡ para usar el turbo y cambia de carril antes de llegar a los conos.',
    clasificador: 'Atrapa el componente que Byte pide y evita los virus para no perder puntos.',
    defensa: 'Mueve tu nave y apunta a los enemigos antes de que alcancen la base.',
    'ciber-guardian': 'Elimina los virus pronto y protege el centro de la CPU.',
    'organizador-disco': 'Gira los bloques y deja espacio para completar filas.',
    'laberinto-datos': 'Usa los cruces para cambiar de ruta, esquivar virus y juntar paquetes.'
  };
  const helpText = {
    carrera: 'En Carrera Cósmica, usa las flechas izquierda y derecha para cambiar de carril. En celular, toca el lado al que quieres moverte.',
    clasificador: 'Mueve la cesta con las flechas. En celular, desliza el dedo para atrapar los componentes.',
    defensa: 'Usa las flechas para mover la nave y arrastra en la pantalla para apuntar.',
    'ciber-guardian': 'Toca los virus para eliminarlos antes de que lleguen a la CPU.',
    'organizador-disco': 'Mueve los bloques con las flechas, usa arriba para girarlos y espacio para soltarlos.',
    'laberinto-datos': 'Usa las flechas o WASD para mover a Byte. En celular, toca los controles en pantalla.'
  };
  let speaking = localStorage.getItem('byte-voice') === 'on';
  let lastRoute = location.hash;

  function routeInfo() {
    const [, page = '', game = ''] = (location.hash || '#/').split('/');
    return { page, game };
  }

  function setReply(text, linkText = '', href = '', announce = true) {
    answer.textContent = text;
    link.hidden = !linkText;
    if (linkText) {
      link.textContent = linkText;
      link.href = href;
    }
    if (announce && speaking && window.SpeechManager) window.SpeechManager.speakText(text);
  }

  function updateWidget() {
    const inGame = !!app.querySelector('#cv');
    const slot = app.querySelector('#byte-slot');
    if (slot && widget.parentElement !== slot) slot.appendChild(widget);
    else if (!slot && widget.parentElement !== document.body) document.body.appendChild(widget);
    widget.classList.toggle('byte-widget-inline', !!slot);
    widget.hidden = inGame;
    if (inGame) {
      panel.hidden = true;
      launcher.setAttribute('aria-expanded', 'false');
    }
  }

  function answerHelp(kind) {
    const { page, game } = routeInfo();
    const isLoggedIn = ['mundo', 'mi-pc', 'juego', 'progreso'].includes(page) || !!document.querySelector('#logout');
    if (kind === 'how') {
      setReply(helpText[game] || (page === 'mi-pc'
        ? 'Explora las piezas, compara sus niveles y pulsa Comprar o Equipar para cambiar tu PC.'
        : page === 'progreso'
          ? 'Aquí puedes ver tus niveles, insignias y resultados de partidas.'
          : page === 'entrar'
            ? 'Escribe tu correo y contraseña para entrar. Si eres nuevo, elige “Soy nuevo” para crear tu cuenta.'
            : 'Elige un juego en Mi mundo y pulsa “¡Jugar!” para comenzar. Antes de jugar verás los controles y podrás elegir la dificultad.'));
      return;
    }

    if (kind === 'hint') {
      setReply(gameHints[game] || (page === 'mi-pc'
        ? 'Fíjate en el nivel y las características de cada pieza. Una mejora puede ayudar a que tus juegos vayan más fluidos.'
        : page === 'progreso'
          ? 'Prueba distintos juegos para sumar estrellas y completar más insignias.'
          : 'En cada juego puedes abrir las instrucciones antes de empezar. ¡Busca los controles y la misión!'));
      return;
    }

    if (page === 'mi-pc') {
      setReply('Compara primero procesador, memoria y tarjeta gráfica. Elige una pieza de mayor nivel que puedas comprar y recuerda equiparla.', 'Explorar piezas', '#/mi-pc');
    } else if (game || page === 'mundo' || page === 'progreso') {
      setReply('Si un juego va con tirones o se cierra, mejorar el procesador, la memoria o la tarjeta gráfica puede ayudar.', 'Ver mi PC', '#/mi-pc');
    } else if (!isLoggedIn) {
      setReply('Crea tu cuenta para jugar, ganar monedas y mejorar las piezas de tu computador.', 'Crear cuenta', '#/entrar/registro');
    } else {
      setReply('Juega y revisa el aviso de rendimiento. Si un juego va lento, podrás ver qué piezas conviene mejorar.', 'Ver mi PC', '#/mi-pc');
    }
  }

  function closePanel() {
    panel.hidden = true;
    launcher.setAttribute('aria-expanded', 'false');
    launcher.focus();
    if (window.SpeechManager) window.SpeechManager.stopSpeaking();
  }

  launcher.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    launcher.setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) panel.querySelector('[data-byte-help]').focus();
    else if (window.SpeechManager) window.SpeechManager.stopSpeaking();
  });
  document.querySelector('#byte-close').addEventListener('click', closePanel);
  voice.setAttribute('aria-pressed', String(speaking));
  voice.textContent = speaking ? '🔊' : '🔇';
  voice.setAttribute('aria-label', speaking ? 'Silenciar voz' : 'Activar voz');
  voice.addEventListener('click', () => {
    speaking = !speaking;
    localStorage.setItem('byte-voice', speaking ? 'on' : 'off');
    voice.setAttribute('aria-pressed', String(speaking));
    voice.textContent = speaking ? '🔊' : '🔇';
    voice.setAttribute('aria-label', speaking ? 'Silenciar voz' : 'Activar voz');
    if (!speaking && window.SpeechManager) window.SpeechManager.stopSpeaking();
    else if (speaking && window.SpeechManager) window.SpeechManager.speakText(answer.textContent);
  });
  panel.addEventListener('click', event => {
    const option = event.target.closest('[data-byte-help]');
    if (option) answerHelp(option.dataset.byteHelp);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) closePanel();
  });

  function onRouteChange() {
    if (lastRoute !== location.hash) {
      lastRoute = location.hash;
      setReply('¡Hola! Puedo explicarte cómo jugar, darte una pista o ayudarte a mejorar tu PC.', '', '', false);
    }
    updateWidget();
  }

  window.addEventListener('hashchange', onRouteChange);
  new MutationObserver(updateWidget).observe(app, { childList: true, subtree: true });
  updateWidget();
})();
