import { coinSpriteUrl } from '../world/coins';
import './flyFx.css';

/** A screen-space point in viewport pixels (the coordinate space DOM flies use). */
export interface FlyPoint {
  x: number;
  y: number;
}

const FLY_HOST_ID = 'editor-ui';

/**
 * The full-window overlay that flying elements live in. Both the Phaser canvas
 * (#game-container) and this host sit at viewport origin, so world->screen
 * coordinates (see `hudCoords`) line up 1:1 with `position: fixed` flies here.
 */
export function flyHost(): HTMLElement {
  const host = document.getElementById(FLY_HOST_ID);
  if (!host) throw new Error(`Missing #${FLY_HOST_ID}`);
  return host;
}

/** Centre of a laid-out element in viewport pixels. */
export function elementCenter(el: HTMLElement): FlyPoint {
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

interface FlyOptions {
  duration?: number;
  delay?: number;
  /** Final scale at the destination (a slight shrink reads as "landing"). */
  endScale?: number;
  /** Scale bump at the midpoint of the arc (reads as a little lift). */
  peakScale?: number;
  /** Fires once when the sprite reaches the destination (before the fade-out). */
  onArrive?: () => void;
}

/** Opacity only dips at the very start/end so the sprite reads solid mid-flight. */
const FADE_EDGE = 0.05;

function flyTransform(x: number, y: number, scale: number): string {
  return `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${scale})`;
}

/**
 * Fly an already-mounted element from one screen point to another, then remove
 * it. Purely cosmetic: the element is fixed-positioned and click-through, and is
 * always cleaned up (even if the animation is cancelled).
 *
 * The arc grows slightly at the midpoint and stays fully opaque between the
 * first/last 5% of the trip — only fading in on spawn and out on arrival.
 */
export function flyElement(
  el: HTMLElement,
  from: FlyPoint,
  to: FlyPoint,
  options?: FlyOptions,
): Promise<void> {
  const duration = options?.duration ?? 600;
  const delay = options?.delay ?? 0;
  const endScale = options?.endScale ?? 0.6;
  const peakScale = options?.peakScale ?? 1.18;

  const midX = from.x + (to.x - from.x) * 0.5;
  const midY = from.y + (to.y - from.y) * 0.5;

  el.style.position = 'fixed';
  el.style.left = '0';
  el.style.top = '0';
  el.style.margin = '0';
  el.style.pointerEvents = 'none';
  el.style.zIndex = '9990';
  el.style.transformOrigin = 'center center';

  let arriveTimer: number | undefined;
  if (options?.onArrive) {
    const hitMs = delay + duration * (1 - FADE_EDGE);
    arriveTimer = window.setTimeout(options.onArrive, hitMs);
  }

  return el
    .animate(
      [
        { transform: flyTransform(from.x, from.y, 1), opacity: 0 },
        { transform: flyTransform(from.x, from.y, 1), opacity: 1, offset: FADE_EDGE },
        { transform: flyTransform(midX, midY, peakScale), opacity: 1, offset: 0.5 },
        { transform: flyTransform(to.x, to.y, endScale), opacity: 1, offset: 1 - FADE_EDGE },
        { transform: flyTransform(to.x, to.y, endScale), opacity: 0, offset: 1 },
      ],
      { duration, delay, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'forwards' },
    )
    .finished.then(() => {
      if (arriveTimer !== undefined) window.clearTimeout(arriveTimer);
      el.remove();
    })
    .catch(() => {
      if (arriveTimer !== undefined) window.clearTimeout(arriveTimer);
      el.remove();
    });
}

interface FlyCoinsOptions {
  duration?: number;
  stagger?: number;
}

/**
 * Spinning pixel coins that arc from one screen point to another (e.g. a buyer
 * or the booth cash pile -> the money pill). `onFirstArrive` fires exactly once,
 * when the first coin lands — the caller uses it to reveal the banked gain.
 */
export function flyCoins(
  from: FlyPoint,
  to: FlyPoint,
  count: number,
  onFirstArrive?: () => void,
  options?: FlyCoinsOptions,
): Promise<void> {
  const host = flyHost();
  const clamped = Math.max(1, Math.min(count, 8));
  const duration = options?.duration ?? 560;
  const stagger = options?.stagger ?? 55;
  let arrived = false;

  const flights = Array.from({ length: clamped }, (_, index) => {
    const coin = document.createElement('img');
    coin.className = 'fly-coin';
    coin.src = coinSpriteUrl((index % 14) + 1);
    coin.width = 10;
    coin.height = 10;
    host.appendChild(coin);

    const jitter = { x: (Math.random() - 0.5) * 10, y: (Math.random() - 0.5) * 6 };
    return flyElement(coin, { x: from.x + jitter.x, y: from.y + jitter.y }, to, {
      duration: duration + index * 40,
      delay: index * stagger,
      endScale: 0.45,
      onArrive:
        index === 0 && onFirstArrive
          ? () => {
              if (!arrived) {
                arrived = true;
                onFirstArrive();
              }
            }
          : undefined,
    });
  });

  return Promise.all(flights).then(() => undefined);
}
