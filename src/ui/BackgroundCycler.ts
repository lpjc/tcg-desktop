import { assetUrl } from '../assets/assetUrl';
import { interaction } from '../core/interaction';
import './BackgroundCycler.css';

/**
 * Wallpapers in `assets/backgrounds/` (downscaled classic Windows backgrounds —
 * originals in `art-source/backgrounds/`, rebuilt by scripts/build-backgrounds.ps1).
 * Keep this list in sync with the folder when adding wallpapers.
 */
const WALLPAPERS = [
  'Bliss.jpg',
  'Autumn.jpg',
  'Azul.jpg',
  'Follow.jpg',
  'Red moon desert.jpg',
  'Stonehenge.jpg',
  'Tulips.jpg',
  'Wind.jpg',
  'Windows Home Server (no watermark).jpg',
  'Windows XP 64-Bit Edition.jpg',
  'Windows XP Home Edition.jpg',
];

const INDEX_KEY = 'tcg-desktop.background-index';

/**
 * Web-build only: paints a classic Windows wallpaper behind the transparent
 * game canvas (a nod to the game's desktop-companion origins) and adds a "BG"
 * toolbar button that cycles to the next one. The choice persists per browser.
 * Not constructed in Electron, where the real desktop shows through instead.
 */
export class BackgroundCycler {
  private readonly el: HTMLButtonElement;
  private index: number;

  constructor(containerId: string) {
    const host = document.getElementById(containerId);
    if (!host) throw new Error(`Missing #${containerId}`);

    this.index = readStoredIndex();
    this.apply();

    this.el = document.createElement('button');
    this.el.id = 'background-btn';
    this.el.type = 'button';
    this.el.title = 'Next background';
    this.el.textContent = 'BG';
    host.appendChild(this.el);

    interaction.registerHotElement(this.el);
    this.el.addEventListener('click', () => this.next());
  }

  private next(): void {
    this.index = (this.index + 1) % WALLPAPERS.length;
    try {
      localStorage.setItem(INDEX_KEY, String(this.index));
    } catch {
      /* ignore */
    }
    this.apply();
  }

  /** Inline styles override the `body.web-page` gradient fallback in theme.css. */
  private apply(): void {
    const url = assetUrl(`backgrounds/${WALLPAPERS[this.index]}`);
    document.body.style.backgroundImage = `url("${url}")`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundRepeat = 'no-repeat';
  }
}

function readStoredIndex(): number {
  try {
    const raw = Number(localStorage.getItem(INDEX_KEY));
    if (Number.isInteger(raw) && raw >= 0 && raw < WALLPAPERS.length) return raw;
  } catch {
    /* ignore */
  }
  return 0;
}
