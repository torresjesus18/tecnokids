// Catálogo único de hardware y requisitos que comparten tienda, simulador y juegos.
const parts = {
  cpu: [
    { code: 'cpu1', name: 'Procesador Chispa', spec: '2 núcleos · 2.0 GHz', level: 1, price: 0, icon: '🧠' },
    { code: 'cpu2', name: 'Procesador Rayo', spec: '4 núcleos · 3.0 GHz', level: 2, price: 120, icon: '🧠' },
    { code: 'cpu3', name: 'Procesador Cometa', spec: '6 núcleos · 3.6 GHz', level: 3, price: 300, icon: '🧠' },
    { code: 'cpu4', name: 'Procesador Nova', spec: '8 núcleos · 4.2 GHz', level: 4, price: 600, icon: '🧠' }
  ],
  ram: [
    { code: 'ram1', name: 'Memoria Gota', spec: '2 GB', level: 1, price: 0, icon: '🧩' },
    { code: 'ram2', name: 'Memoria Río', spec: '4 GB', level: 2, price: 100, icon: '🧩' },
    { code: 'ram3', name: 'Memoria Lago', spec: '8 GB', level: 3, price: 250, icon: '🧩' },
    { code: 'ram4', name: 'Memoria Océano', spec: '16 GB', level: 4, price: 500, icon: '🧩' }
  ],
  gpu: [
    { code: 'gpu1', name: 'Gráficos Básicos', spec: 'Integrados', level: 1, price: 0, icon: '🎨' },
    { code: 'gpu2', name: 'Tarjeta Brisa', spec: '2 GB', level: 2, price: 150, icon: '🎨' },
    { code: 'gpu3', name: 'Tarjeta Turbo', spec: '4 GB', level: 3, price: 350, icon: '🎨' },
    { code: 'gpu4', name: 'Tarjeta Mega', spec: '8 GB', level: 4, price: 700, icon: '🎨' }
  ],
  rom: [
    { code: 'rom1', name: 'ROM Semilla', spec: '32 GB', level: 1, price: 0, icon: '💾' },
    { code: 'rom2', name: 'ROM Archivo', spec: '64 GB', level: 2, price: 120, icon: '💾' },
    { code: 'rom3', name: 'ROM Biblioteca', spec: '128 GB', level: 3, price: 300, icon: '💾' },
    { code: 'rom4', name: 'ROM Universo', spec: '256 GB', level: 4, price: 600, icon: '💾' }
  ]
};

const starter = { cpu: 'cpu1', ram: 'ram1', gpu: 'gpu1', rom: 'rom1' };

// Cada misión declara requisitos mínimos y recomendados; el simulador convierte estos niveles en efectos.
const games = {
  carrera: {
    name: 'Carrera Cósmica', icon: '🏎️', minSeconds: 15, maxCoins: 70,
    desc: 'Compite contra dos robots por el camino de las estrellas. Esquiva los conos 🚧 y recoge rayos ⚡.',
    controls: 'Flechas ← → (o A / D), o toca a un lado de tu auto para cambiar de carril.',
    min: { cpu: 1, ram: 1, gpu: 1, rom: 1 }, rec: { cpu: 2, ram: 2, gpu: 2, rom: 2 }
  },
  clasificador: {
    name: 'La Caza de Chips', icon: '🧲', minSeconds: 20, maxCoins: 70,
    desc: 'Mueve la cesta y atrapa solo los componentes que Byte te pide. ¡Los virus te quitan puntos!',
    controls: 'Flechas ← → (o A / D), o mueve el dedo o el ratón para llevar la cesta.',
    min: { cpu: 2, ram: 1, gpu: 1, rom: 1 }, rec: { cpu: 2, ram: 2, gpu: 2, rom: 2 }
  },
  defensa: {
    name: 'Defensa Galáctica', icon: '🚀', minSeconds: 25, maxCoins: 60,
    desc: 'Protege la base de tres oleadas y de un jefe final. ¡Este juego le pide mucho más a tu PC!',
    controls: 'Flechas ← → (o A / D), o arrastra el dedo o el ratón. Tu nave dispara sola.',
    min: { cpu: 2, ram: 2, gpu: 2, rom: 1 }, rec: { cpu: 3, ram: 3, gpu: 3, rom: 2 }
  },
  'ciber-guardian': {
    name: 'Defensa del Sistema', icon: '🛡️', minSeconds: 25, maxCoins: 60,
    desc: 'Los virus quieren entrar a tu PC. Toca cada uno para eliminarlo antes de que llegue a la CPU del centro.',
    controls: 'Toca o haz clic sobre cada virus para eliminarlo. Los del nivel difícil aguantan más de un toque.',
    min: { cpu: 2, ram: 2, gpu: 2, rom: 1 }, rec: { cpu: 3, ram: 3, gpu: 3, rom: 2 }
  },
  'organizador-disco': {
    name: 'El Organizador de Disco', icon: '💾', minSeconds: 20, maxCoins: 70,
    desc: 'Acomoda bloques de archivos para liberar 6 filas y organizar el disco. ¡Evita que se llene!',
    controls: 'Flechas izquierda y derecha para mover, abajo para acelerar, arriba para girar y espacio para soltar.',
    min: { cpu: 1, ram: 1, gpu: 1, rom: 1 }, rec: { cpu: 2, ram: 2, gpu: 1, rom: 2 }
  },
  'laberinto-datos': {
    name: 'Laberinto de Datos', icon: '🤖', minSeconds: 30, maxCoins: 70,
    desc: 'Guía a Byte por un laberinto de circuitos, recoge paquetes de datos y evita a los virus.',
    controls: 'Usa las flechas o WASD para moverte por el laberinto. En móvil, toca las flechas de la pantalla.',
    min: { cpu: 1, ram: 1, gpu: 1, rom: 1 }, rec: { cpu: 2, ram: 2, gpu: 2, rom: 2 }
  },
  'taller-ensamblaje': {
    name: 'Taller de Ensamblaje', icon: '🛠️', minSeconds: 12, maxCoins: 80,
    timeLimitSec: { facil: 120, medio: 90, dificil: 60 },
    desc: 'Arrastra las piezas al gabinete. Tienes 2 min en Fácil, 1:30 en Medio y 1 min en Difícil; terminar más rápido y cometer menos errores mejora tus monedas. El SSD SATA es una pieza distractora.',
    controls: 'Arrastra cada pieza a la zona resaltada. En celular, toca una pieza y luego su espacio.',
    min: { cpu: 1, ram: 1, gpu: 1, rom: 1 }, rec: { cpu: 1, ram: 1, gpu: 1, rom: 1 }
  },
  'renderizado-gpu': {
    name: 'Desafío de Renderizado GPU', icon: '🚀', badge: '⚡ Carrera de Rendimiento', rating: 4, action: '¡Renderizar!',
    minSeconds: 28, maxCoins: 80,
    desc: '¡Pilota tu cohete GPU! Junta núcleos para aumentar los FPS y esquiva el polvo que puede obstruir la ventilación y sobrecalentar la tarjeta.',
    controls: 'Usa las flechas o WASD para pilotar. En celular, arrastra el cohete para recoger núcleos y esquivar el polvo.',
    min: { cpu: 1, ram: 1, gpu: 1, rom: 1 }, rec: { cpu: 2, ram: 2, gpu: 3, rom: 2 }
  }
};

module.exports = { parts, starter, games };