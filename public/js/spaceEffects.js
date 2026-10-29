// Efectos decorativos de fondo, limitados por preferencia de movimiento y temporizadores.
(() => {
  const layer = document.querySelector('#space-effects');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!layer || !Element.prototype.animate) return;

  const shipInterval = 3 * 60 * 1000;
  const shipDuration = 18000;
  const sideShipInterval = 90 * 1000;
  const sideShipDuration = 18000;
  const cometDuration = 6000;
  const directions = Array.from({ length: 8 }, (_, i) => i * Math.PI / 4);
  const shipSvg = '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M7 32C20 17 38 13 56 32 38 51 20 47 7 32Z" fill="#f4f2ff" stroke="#35e0b2" stroke-width="3"/><path d="M18 24 8 17l3 14m7 9-10 7 3-14" fill="#ff6b81" stroke="#ff6b81" stroke-width="2" stroke-linejoin="round"/><path d="M7 28 0 32l7 4" fill="#ffcf33"/><circle cx="42" cy="29" r="4" fill="#5ad1ff" stroke="#16124a" stroke-width="2"/></svg>';
  let previousDirection = -1;
  let shipTimer;
  let sideShipTimer;
  let cometTimer;
  let impactTimer;
  let primaryShipActive = false;
  let sideShipActive = false;
  const activeAnimations = new Set();

  const pointOnPath = (vector, distance, center, offset = 0) => ({
    x: center.x + vector.x * distance - vector.y * offset,
    y: center.y + vector.y * distance + vector.x * offset
  });

  function animateFlight(element, start, end, angle, duration, onFinish) {
    const animation = element.animate([
      { transform: `translate(-50%, -50%) translate(${start.x}px, ${start.y}px) rotate(${angle}deg)`, opacity: 0 },
      { opacity: 1, offset: 0.08 },
      { opacity: 1, offset: 0.92 },
      { transform: `translate(-50%, -50%) translate(${end.x}px, ${end.y}px) rotate(${angle}deg)`, opacity: 0 }
    ], { duration, easing: 'linear', fill: 'forwards' });
    activeAnimations.add(animation);
    animation.onfinish = () => {
      activeAnimations.delete(animation);
      element.remove();
      if (onFinish) onFinish();
    };
    animation.oncancel = () => activeAnimations.delete(animation);
    return animation;
  }

  function createImpact(center) {
    const flash = document.createElement('span');
    flash.className = 'space-impact';
    flash.textContent = '✨';
    layer.appendChild(flash);
    const animation = flash.animate([
      { transform: 'translate(-50%, -50%) scale(.2)', opacity: 0 },
      { transform: 'translate(-50%, -50%) scale(1.2)', opacity: 1, offset: 0.35 },
      { transform: 'translate(-50%, -50%) scale(1.8)', opacity: 0 }
    ], { duration: 850, easing: 'ease-out' });
    activeAnimations.add(animation);
    flash.style.left = `${center.x}px`;
    flash.style.top = `${center.y}px`;
    animation.onfinish = () => {
      activeAnimations.delete(animation);
      flash.remove();
    };
    animation.oncancel = () => activeAnimations.delete(animation);
  }

  function passShip() {
    if (motion.matches) return;
    if (sideShipActive) {
      shipTimer = setTimeout(passShip, 1000);
      return;
    }
    primaryShipActive = true;

    let directionIndex;
    do {
      directionIndex = Math.floor(Math.random() * directions.length);
    } while (directionIndex === previousDirection);
    previousDirection = directionIndex;

    const angle = directions[directionIndex];
    const vector = { x: Math.cos(angle), y: Math.sin(angle) };
    const center = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const distance = Math.hypot(center.x, center.y) + 120;
    const start = pointOnPath(vector, -distance, center);
    const end = pointOnPath(vector, distance, center);
    const ship = document.createElement('span');
    ship.className = 'spacecraft';
    ship.innerHTML = shipSvg;
    layer.appendChild(ship);
    const shipAnimation = animateFlight(ship, start, end, angle * 180 / Math.PI, shipDuration, () => { primaryShipActive = false; });

    if (Math.random() < 0.25) {
      const collision = Math.random() < 0.12;
      const perpendicular = { x: -vector.y, y: vector.x };
      const missDistance = collision ? 0 : (Math.random() < 0.5 ? -1 : 1) * 125;
      const cometCenter = pointOnPath(perpendicular, 0, center, missDistance);
      const cometDistance = Math.hypot(window.innerWidth, window.innerHeight) / 2 + 120;
      const cometStart = pointOnPath(perpendicular, -cometDistance, cometCenter);
      const cometEnd = pointOnPath(perpendicular, cometDistance, cometCenter);
      const comet = document.createElement('span');
      comet.className = 'space-comet';
      layer.appendChild(comet);
      let cometAnimation;

      cometTimer = setTimeout(() => {
        if (motion.matches) {
          comet.remove();
          return;
        }
        cometAnimation = animateFlight(comet, cometStart, cometEnd, Math.atan2(perpendicular.y, perpendicular.x) * 180 / Math.PI, cometDuration);
      }, shipDuration / 2 - cometDuration / 2);

      if (collision) {
        impactTimer = setTimeout(() => {
          if (motion.matches) return;
          shipAnimation.cancel();
          ship.remove();
          primaryShipActive = false;
          cometAnimation?.cancel();
          comet.remove();
          createImpact(center);
        }, shipDuration / 2);
      }
    }

    shipTimer = setTimeout(passShip, shipInterval);
  }

  function passSideShip() {
    if (motion.matches) return;
    if (primaryShipActive || sideShipActive) {
      sideShipTimer = setTimeout(passSideShip, 1000);
      return;
    }

    const main = document.querySelector('main');
    const sideGap = main ? (window.innerWidth - main.getBoundingClientRect().width) / 2 : 0;
    const top = Math.max(110, (document.querySelector('.tk-nav')?.getBoundingClientRect().bottom || 0) + 24);
    const bottom = window.innerHeight - 36;
    if (sideGap < 48 || bottom - top < 120) {
      sideShipTimer = setTimeout(passSideShip, sideShipInterval);
      return;
    }

    sideShipActive = true;
    const left = sideGap / 2;
    const right = window.innerWidth - left;
    const height = bottom - top;
    const jitter = Math.min(18, Math.max(0, left - 24));
    const leftJitter = left + jitter;
    const rightJitter = right - jitter;
    const mainTop = main?.getBoundingClientRect().top;
    const crossingY = main ? mainTop - 28 : top;
    const points = crossingY >= top
      ? [
        { x: left, y: bottom, angle: -90 },
        { x: left, y: bottom - (bottom - crossingY) * 0.22, angle: -90 },
        { x: leftJitter, y: bottom - (bottom - crossingY) * 0.22, angle: 0 },
        { x: leftJitter, y: bottom - (bottom - crossingY) * 0.36, angle: -90 },
        { x: left, y: bottom - (bottom - crossingY) * 0.36, angle: 180 },
        { x: left, y: crossingY, angle: -90 },
        { x: right, y: crossingY, angle: 0 },
        { x: right, y: crossingY + (bottom - crossingY) * 0.3, angle: 90 },
        { x: rightJitter, y: crossingY + (bottom - crossingY) * 0.3, angle: 180 },
        { x: rightJitter, y: crossingY + (bottom - crossingY) * 0.44, angle: 90 },
        { x: right, y: crossingY + (bottom - crossingY) * 0.44, angle: 0 },
        { x: right, y: bottom, angle: 90 }
      ]
      : [
        { x: left, y: bottom, angle: -90 },
        { x: left, y: bottom - height * 0.2, angle: -90 },
        { x: leftJitter, y: bottom - height * 0.2, angle: 0 },
        { x: leftJitter, y: bottom - height * 0.35, angle: -90 },
        { x: left, y: bottom - height * 0.35, angle: 180 },
        { x: left, y: top, angle: -90 },
        { x: leftJitter, y: top, angle: 0 },
        { x: leftJitter, y: top + height * 0.12, angle: 90 },
        { x: left, y: top + height * 0.12, angle: 180 },
        { x: left, y: bottom, angle: 90 }
      ];
    const ship = document.createElement('span');
    ship.className = 'spacecraft side-ship';
    ship.innerHTML = shipSvg;
    layer.appendChild(ship);
    const distances = [0];
    for (let i = 1; i < points.length; i++) {
      distances.push(distances[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
    }
    const totalDistance = distances[distances.length - 1];
    const travelOffset = distance => 0.035 + distance / totalDistance * 0.93;
    const positionAt = point => `translate(-50%, -50%) translate(${point.x}px, ${point.y}px)`;
    const travelFrames = points.map((point, index) => ({
      transform: positionAt(point),
      offset: travelOffset(distances[index])
    }));
    const positionFrames = [
      { ...travelFrames[0], opacity: 0, offset: 0 },
      { ...travelFrames[0], opacity: 1, offset: 0.035 },
      ...travelFrames.slice(1, -1).map(frame => ({ ...frame, opacity: 1 })),
      { ...travelFrames[travelFrames.length - 1], opacity: 1, offset: 0.965 },
      { ...travelFrames[travelFrames.length - 1], opacity: 0, offset: 1 }
    ];
    const graphic = ship.querySelector('svg');
    graphic.style.transformBox = 'fill-box';
    graphic.style.transformOrigin = 'center';
    const rotationFrames = points.map((point, index) => ({
      transform: `rotate(${point.angle}deg)`,
      offset: travelOffset(distances[index]),
      easing: 'steps(1, start)'
    }));
    rotationFrames.unshift({ transform: `rotate(${points[0].angle}deg)`, offset: 0 });
    rotationFrames.push({ transform: `rotate(${points[points.length - 1].angle}deg)`, offset: 1 });
    const positionAnimation = ship.animate(positionFrames, { duration: sideShipDuration, easing: 'linear', fill: 'forwards' });
    const rotationAnimation = graphic.animate(rotationFrames, { duration: sideShipDuration, easing: 'linear', fill: 'forwards' });
    activeAnimations.add(positionAnimation);
    activeAnimations.add(rotationAnimation);
    positionAnimation.onfinish = () => {
      activeAnimations.delete(positionAnimation);
      activeAnimations.delete(rotationAnimation);
      ship.remove();
      sideShipActive = false;
    };
    positionAnimation.oncancel = () => activeAnimations.delete(positionAnimation);
    rotationAnimation.oncancel = () => activeAnimations.delete(rotationAnimation);

    sideShipTimer = setTimeout(passSideShip, sideShipInterval);
  }

  function resetTimers() {
    clearTimeout(shipTimer);
    clearTimeout(sideShipTimer);
    clearTimeout(cometTimer);
    clearTimeout(impactTimer);
    activeAnimations.forEach(animation => animation.cancel());
    activeAnimations.clear();
    primaryShipActive = false;
    sideShipActive = false;
    layer.replaceChildren();
    if (!motion.matches) {
      shipTimer = setTimeout(passShip, shipInterval);
      sideShipTimer = setTimeout(passSideShip, sideShipInterval);
    }
  }

  motion.addEventListener('change', resetTimers);
  resetTimers();
})();
