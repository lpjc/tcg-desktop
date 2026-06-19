import { interaction } from '../../core/interaction';
import { allSets, type CardSet } from '../../game/cards/cards';
import { PACK_PRICE, shopEconomy } from '../../game/economy/ShopEconomy';
import { gameState, type GameStateData } from '../../game/state/GameState';
import { registerPackVending } from '../shopBridge';
import './PackVendingScreen.css';

/** Fixed machine capacity: a 2x3 window. Sets fill slots in registration order. */
const SLOT_COUNT = 6;
/** Deterministic accent hue per slot so each pack reads as its own product. */
const PACK_ACCENTS = ['#e0563b', '#3b7fe0', '#6fb83b', '#b85fd8', '#e0a93b', '#3bc6c0'];

interface Slot {
  index: number;
  set: CardSet | undefined;
  accent: string;
  pack: HTMLElement;
  buyBtn: HTMLButtonElement;
  nameEl: HTMLElement;
  priceEl: HTMLElement;
}

/**
 * The pack vending machine: an upright machine that rises from (and runs off)
 * the bottom edge. Its glass-fronted 2x3 window shows one booster per card set;
 * a column of buy buttons on the right (each labelled with set name + price)
 * dispenses a pack — it drops from its slot and a fresh one slides in behind.
 *
 * Unlocked sets are buyable (a pack queues on the shop counter to rip); locked
 * sets show a silhouette + "Locked"; not-yet-made sets tease as "?" silhouettes.
 * Opened by walking to a pack-vendor station; auto-closed on walking away.
 */
export class PackVendingScreen {
  private readonly root: HTMLDivElement;
  private readonly machine: HTMLDivElement;
  private readonly windowEl: HTMLDivElement;
  private readonly fallLayer: HTMLDivElement;
  private readonly slots: Slot[] = [];
  private open = false;

  constructor(containerId: string) {
    const host = document.getElementById(containerId);
    if (!host) throw new Error(`Missing #${containerId}`);

    this.root = document.createElement('div');
    this.root.id = 'pack-vending-root';
    this.root.setAttribute('aria-hidden', 'true');

    const machine = document.createElement('div');
    machine.className = 'machine';
    this.machine = machine;

    const header = document.createElement('div');
    header.className = 'machine__header';
    const title = document.createElement('span');
    title.className = 'machine__title';
    title.textContent = 'CARD PACKS';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'machine__close';
    close.textContent = '\u2715';
    close.title = 'Close (Esc)';
    close.addEventListener('click', () => this.close());
    header.append(title, close);

    const body = document.createElement('div');
    body.className = 'machine__body';

    const window_ = document.createElement('div');
    window_.className = 'machine__window';
    this.windowEl = window_;

    const grid = document.createElement('div');
    grid.className = 'machine__grid';

    const fallLayer = document.createElement('div');
    fallLayer.className = 'machine__fall-layer';
    this.fallLayer = fallLayer;

    const glass = document.createElement('div');
    glass.className = 'machine__glass';
    window_.append(grid, fallLayer, glass);

    const panel = document.createElement('div');
    panel.className = 'machine__panel';

    for (let i = 0; i < SLOT_COUNT; i++) {
      const slot = this.buildSlot(i);
      grid.appendChild(slot.pack.parentElement as HTMLElement);
      panel.appendChild(this.buildButtonRow(slot));
      this.slots.push(slot);
    }

    body.append(window_, panel);
    machine.append(header, body);
    this.root.appendChild(machine);
    host.appendChild(this.root);

    interaction.registerHotElement(machine);
    registerPackVending({ open: () => this.show(), close: () => this.close() });
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.open) {
        event.preventDefault();
        this.close();
      }
    });
    gameState.subscribe((data) => {
      if (this.open) this.render(data);
    });
  }

  show(): void {
    if (this.open) return;
    this.open = true;
    this.render(gameState.snapshot());
    this.root.classList.add('is-open');
    this.root.setAttribute('aria-hidden', 'false');
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.root.classList.remove('is-open');
    this.root.setAttribute('aria-hidden', 'true');
  }

  private buildSlot(index: number): Slot {
    const set = allSets()[index];
    const accent = PACK_ACCENTS[index % PACK_ACCENTS.length];

    const bay = document.createElement('div');
    bay.className = 'pack-bay';
    bay.style.setProperty('--accent', accent);

    const pack = document.createElement('div');
    pack.className = 'pack-bay__pack';
    const shine = document.createElement('span');
    shine.className = 'pack-bay__shine';
    const mark = document.createElement('span');
    mark.className = 'pack-bay__mark';
    pack.append(shine, mark);
    bay.appendChild(pack);

    // Button + labels live in the side panel; created here so they share the slot.
    const buyBtn = document.createElement('button');
    buyBtn.type = 'button';
    buyBtn.className = 'pack-btn';
    buyBtn.style.setProperty('--accent', accent);
    buyBtn.textContent = String(index + 1);
    buyBtn.addEventListener('click', () => this.buy(index));

    const nameEl = document.createElement('span');
    nameEl.className = 'pack-row__name';
    const priceEl = document.createElement('span');
    priceEl.className = 'pack-row__price';

    return { index, set, accent, pack, buyBtn, nameEl, priceEl };
  }

  private buildButtonRow(slot: Slot): HTMLElement {
    const row = document.createElement('div');
    row.className = 'pack-row';
    const labels = document.createElement('span');
    labels.className = 'pack-row__labels';
    labels.append(slot.nameEl, slot.priceEl);
    row.append(slot.buyBtn, labels);
    return row;
  }

  private buy(index: number): void {
    const slot = this.slots[index];
    if (!slot.set) return;
    if (!shopEconomy.buyPack(slot.set.id)) return;
    this.dropFaller(slot);
  }

  /**
   * Dispense feel: a solid copy of the pack drops out of its slot, tumbles down
   * inside the glass (in front of the bays, behind the glass sheet), then slips
   * behind the machine chassis at the bottom.
   */
  private dropFaller(slot: Slot): void {
    const bay = slot.pack.getBoundingClientRect();
    const win = this.windowEl.getBoundingClientRect();
    const machine = this.machine.getBoundingClientRect();

    const faller = document.createElement('div');
    faller.className = 'pack-faller';
    faller.style.setProperty('--accent', slot.accent);
    faller.style.left = `${bay.left - win.left}px`;
    faller.style.top = `${bay.top - win.top}px`;
    faller.style.width = `${bay.width}px`;
    faller.style.height = `${bay.height}px`;
    faller.style.setProperty('--fall', `${machine.bottom - bay.top + 24}px`);

    const crimp = document.createElement('span');
    crimp.className = 'pack-faller__crimp';
    const shine = document.createElement('span');
    shine.className = 'pack-faller__shine';
    faller.append(crimp, shine);

    faller.addEventListener('animationend', () => faller.remove());
    this.fallLayer.appendChild(faller);
  }

  private render(data: Readonly<GameStateData>): void {
    const affordable = data.money >= PACK_PRICE;
    for (const slot of this.slots) {
      const bay = slot.pack.parentElement as HTMLElement;
      if (!slot.set) {
        bay.dataset.state = 'empty';
        slot.nameEl.textContent = '???';
        slot.priceEl.textContent = 'Soon';
        slot.buyBtn.disabled = true;
        continue;
      }
      const unlocked = data.unlockedSets.includes(slot.set.id);
      bay.dataset.state = unlocked ? 'unlocked' : 'locked';
      slot.nameEl.textContent = slot.set.name;
      slot.priceEl.textContent = unlocked ? `\u20AC${PACK_PRICE}` : 'Locked';
      slot.buyBtn.disabled = !unlocked || !affordable;
    }
  }
}
