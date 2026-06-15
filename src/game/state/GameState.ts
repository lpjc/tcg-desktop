import { PILE_IDS, type PileId } from '../cards/piles';
import { loadGameStateData, saveGameStateData } from './persistence';
import type { CashBox, GameStateData } from './types';

const STATE_VERSION = 1;
/** Coalesce rapid mutations into one disk write. */
const SAVE_DEBOUNCE_MS = 600;

type Listener = (data: Readonly<GameStateData>) => void;

function emptyStock(): Record<PileId, number> {
  const stock = {} as Record<PileId, number>;
  for (const id of PILE_IDS) stock[id] = 0;
  return stock;
}

function defaultData(): GameStateData {
  return {
    version: STATE_VERSION,
    money: 0,
    stock: emptyStock(),
    collection: {},
    skills: { reputation: 0, luck: 0, prestige: 0, attraction: 0 },
    displayCase: [null, null, null],
    unlockedConventions: ['default_expo'],
    unlockedSets: [],
    cashBox: { sales: 0, money: 0, reputation: 0 },
  };
}

/**
 * The single source of truth for player progress (money, stock, collection,
 * skills, booth cash box, unlocks). UI and world systems subscribe for updates;
 * every mutation notifies subscribers and schedules a debounced save.
 *
 * Treat the snapshot as read-only — always go through a mutator so listeners and
 * persistence stay in sync.
 */
class GameState {
  private data: GameStateData = defaultData();
  private listeners = new Set<Listener>();
  private saveTimer: number | null = null;

  snapshot(): Readonly<GameStateData> {
    return this.data;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.data);
    return () => this.listeners.delete(listener);
  }

  /** Hydrate from disk (or localStorage in browser). Call once at boot. */
  async load(): Promise<void> {
    const saved = await loadGameStateData();
    if (saved) this.data = mergeSaved(defaultData(), saved);
    this.emit();
  }

  // ---- mutators ------------------------------------------------------------

  addMoney(amount: number): void {
    this.data.money += amount;
    this.changed();
  }

  grantStock(pile: PileId, count: number): void {
    this.data.stock[pile] += count;
    this.changed();
  }

  /** Remove cards from a pile; false (no change) when there aren't enough. */
  takeFromStock(pile: PileId, count = 1): boolean {
    if (this.data.stock[pile] < count) return false;
    this.data.stock[pile] -= count;
    this.changed();
    return true;
  }

  /** Record a single booth sale into the (un-collected) cash box. */
  recordSale(money: number, reputation: number): void {
    const box = this.data.cashBox;
    box.sales += 1;
    box.money += money;
    box.reputation += reputation;
    this.changed();
  }

  /** Move the cash box into the bank + skills, returning what was collected. */
  collectCashBox(): CashBox {
    const collected: CashBox = { ...this.data.cashBox };
    this.data.money += collected.money;
    this.data.skills.reputation += collected.reputation;
    this.data.cashBox = { sales: 0, money: 0, reputation: 0 };
    this.changed();
    return collected;
  }

  discoverCard(cardId: string, holo: boolean): void {
    const entry = this.data.collection[cardId] ?? { discovered: false, holo: false };
    entry.discovered = true;
    if (holo) entry.holo = true;
    this.data.collection[cardId] = entry;
    this.changed();
  }

  unlockSet(setId: string): void {
    if (this.data.unlockedSets.includes(setId)) return;
    this.data.unlockedSets.push(setId);
    this.changed();
  }

  /** Wipe progress back to a fresh save (dev tool). */
  reset(): void {
    this.data = defaultData();
    this.changed();
  }

  // ---- internals -----------------------------------------------------------

  private changed(): void {
    this.emit();
    this.scheduleSave();
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.data);
  }

  private scheduleSave(): void {
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      void saveGameStateData(this.data);
    }, SAVE_DEBOUNCE_MS);
  }
}

/** Shallow-merge a saved blob onto defaults so new fields/piles fill in safely. */
function mergeSaved(base: GameStateData, saved: Partial<GameStateData>): GameStateData {
  return {
    ...base,
    ...saved,
    stock: { ...base.stock, ...(saved.stock ?? {}) },
    skills: { ...base.skills, ...(saved.skills ?? {}) },
    cashBox: { ...base.cashBox, ...(saved.cashBox ?? {}) },
    collection: saved.collection ?? base.collection,
    displayCase: saved.displayCase ?? base.displayCase,
    unlockedConventions: saved.unlockedConventions ?? base.unlockedConventions,
    unlockedSets: saved.unlockedSets ?? base.unlockedSets,
    version: STATE_VERSION,
  };
}

export const gameState = new GameState();
export type { GameStateData } from './types';
