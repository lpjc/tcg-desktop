/** Screen-space point for DOM fly animations (viewport pixels). */
export interface FlyPoint {
  x: number;
  y: number;
}

export function elementCenter(el: HTMLElement): FlyPoint {
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

const FLY_HOST_ID = 'editor-ui';

function flyHost(): HTMLElement {
  const host = document.getElementById(FLY_HOST_ID);
  if (!host) throw new Error(`Missing #${FLY_HOST_ID}`);
  return host;
}

/** Move a fixed-position element from one screen point to another. */
export function animateFly(
  el: HTMLElement,
  from: FlyPoint,
  to: FlyPoint,
  options?: { duration?: number; delay?: number; endScale?: number },
): Promise<void> {
  const duration = options?.duration ?? 620;
  const delay = options?.delay ?? 0;
  const endScale = options?.endScale ?? 0.55;

  el.style.position = 'fixed';
  el.style.left = '0';
  el.style.top = '0';
  el.style.margin = '0';
  el.style.pointerEvents = 'none';
  el.style.zIndex = '9990';
  el.style.transformOrigin = 'center center';

  return el
    .animate(
      [
        {
          transform: `translate(${from.x}px, ${from.y}px) translate(-50%, -50%) scale(1)`,
          opacity: '1',
        },
        {
          transform: `translate(${to.x}px, ${to.y}px) translate(-50%, -50%) scale(${endScale})`,
          opacity: '0',
        },
      ],
      {
        duration,
        delay,
        easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)',
        fill: 'forwards',
      },
    )
    .finished.then(() => el.remove())
    .catch(() => el.remove());
}

/** Spinning pixel coins that arc from one HUD/world screen point to another. */
export function flyCoins(
  from: FlyPoint,
  to: FlyPoint,
  count: number,
  onFirstArrive?: () => void,
): Promise<void> {
  const host = flyHost();
  const clamped = Math.max(1, Math.min(count, 8));
  let paid = false;

  const flights = Array.from({ length: clamped }, (_, index) => {
    const coin = document.createElement('img');
    coin.className = 'sale-fly-coin';
    coin.src = encodeURI(`/coin-sprites/sprite-1-${(index % 14) + 1}.png`);
    coin.width = 10;
    coin.height = 10;
    host.appendChild(coin);

    const jitter = {
      x: (Math.random() - 0.5) * 10,
      y: (Math.random() - 0.5) * 6,
    };

    return animateFly(
      coin,
      { x: from.x + jitter.x, y: from.y + jitter.y },
      { x: to.x, y: to.y },
      { duration: 560 + index * 40, delay: index * 55, endScale: 0.45 },
    ).then(() => {
      if (!paid) {
        paid = true;
        onFirstArrive?.();
      }
    });
  });

  return Promise.all(flights).then(() => undefined);
}
