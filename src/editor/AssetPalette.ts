import { getItemsByCategory, type CatalogItem } from '../assets/catalog';
import { interaction } from '../core/interaction';
import { enablePanelDrag } from '../ui/draggablePanel';

export type PaletteSelectHandler = (item: CatalogItem) => void;

const CATEGORIES: Array<{ id: string; label: string }> = [
  { id: 'furniture', label: 'Furniture' },
  { id: 'free', label: 'Free' },
  { id: 'floor', label: 'Floors' },
  { id: 'pet', label: 'Decor' },
];

/**
 * Max thumbnails rendered per category. High enough to show a full pack
 * (the free-furniture set alone is ~200) while still bounding DOM cost.
 */
const MAX_VISIBLE_ITEMS = 1000;

const PALETTE_WIDTH_PX = 320;
const PALETTE_STORAGE_KEY = 'tcg-desktop.palette-pos';

export class AssetPalette {
  private root: HTMLElement;
  private listEl: HTMLElement;
  private searchEl: HTMLInputElement;
  private tabsEl: HTMLElement;
  private onSelect: PaletteSelectHandler;
  private selectedId: string | null = null;
  private activeCategory = 'furniture';
  private floorOnly = false;

  constructor(containerId: string, onSelect: PaletteSelectHandler) {
    const host = document.getElementById(containerId);
    if (!host) throw new Error(`Missing #${containerId}`);

    this.onSelect = onSelect;
    this.root = document.createElement('div');
    this.root.id = 'asset-palette';
    this.root.innerHTML = `
      <div class="palette-drag-handle" title="Drag to reposition">Assets</div>
      <div class="palette-header">
        <div class="palette-mode-hint"></div>
        <div class="palette-tabs"></div>
        <input type="search" placeholder="Search…" />
      </div>
      <div class="palette-list"></div>
    `;
    host.appendChild(this.root);

    this.searchEl = this.root.querySelector('input') as HTMLInputElement;
    this.listEl = this.root.querySelector('.palette-list') as HTMLElement;
    this.tabsEl = this.root.querySelector('.palette-tabs') as HTMLElement;
    this.searchEl.addEventListener('input', () => this.renderList());

    interaction.registerHotElement(this.root);
    this.injectStyles();
    enablePanelDrag(this.root, this.root.querySelector('.palette-drag-handle') as HTMLElement, {
      storageKey: PALETTE_STORAGE_KEY,
      width: PALETTE_WIDTH_PX,
    });
    this.renderTabs();
    this.renderList();
    this.setVisible(false);
  }

  setVisible(visible: boolean): void {
    this.root.style.display = visible ? 'flex' : 'none';
    this.updateModeHint();
  }

  private updateModeHint(): void {
    const hint = this.root.querySelector('.palette-mode-hint') as HTMLElement | null;
    if (!hint) return;
    hint.textContent = this.floorOnly ? 'Tile paint — pick a floor tile' : '';
    hint.style.display = this.floorOnly ? 'block' : 'none';
  }

  getSelectedId(): string | null {
    return this.selectedId;
  }

  clearSelection(): void {
    this.selectedId = null;
    this.renderList();
  }

  /** Lock palette to floor tiles (tile-paint mode). */
  setFloorOnly(floorOnly: boolean): void {
    this.floorOnly = floorOnly;
    if (floorOnly) {
      this.activeCategory = 'floor';
      this.selectedId = null;
    }
    this.updateModeHint();
    this.renderTabs();
    this.renderList();
  }

  private renderTabs(): void {
    this.tabsEl.innerHTML = '';
    const categories = this.floorOnly
      ? CATEGORIES.filter((c) => c.id === 'floor')
      : CATEGORIES;
    for (const cat of categories) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `palette-tab${this.activeCategory === cat.id ? ' active' : ''}`;
      btn.textContent = cat.label;
      btn.addEventListener('click', () => {
        if (this.floorOnly && cat.id !== 'floor') return;
        this.activeCategory = cat.id;
        this.renderTabs();
        this.renderList();
      });
      this.tabsEl.appendChild(btn);
    }
  }

  private renderList(): void {
    const query = this.searchEl.value.trim().toLowerCase();
    const items = getItemsByCategory(this.activeCategory).filter((item) => {
      if (!query) return true;
      return item.name.toLowerCase().includes(query) || item.id.includes(query);
    });

    this.listEl.innerHTML = '';
    for (const item of items.slice(0, MAX_VISIBLE_ITEMS)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `palette-item${this.selectedId === item.id ? ' selected' : ''}`;
      btn.title = `${item.name} (${item.width}×${item.height})`;
      btn.innerHTML = `
        <img src="${encodeURI(`/${item.file}`)}" alt="" width="${Math.min(item.width, 36)}" height="${Math.min(item.height, 36)}" />
        <span>${item.name}</span>
      `;
      btn.addEventListener('click', () => {
        this.selectedId = item.id;
        this.onSelect(item);
        this.renderList();
      });
      this.listEl.appendChild(btn);
    }
  }

  private injectStyles(): void {
    if (document.getElementById('palette-styles')) return;
    const style = document.createElement('style');
    style.id = 'palette-styles';
    style.textContent = `
      #editor-ui {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 1000;
        font-family: system-ui, sans-serif;
      }
      #asset-palette {
        position: fixed;
        top: 8px;
        right: 8px;
        width: ${PALETTE_WIDTH_PX}px;
        max-height: calc(100% - 16px);
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 8px;
        background: rgba(12, 14, 20, 0.92);
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 8px;
        color: #f2f4f8;
        pointer-events: auto;
        backdrop-filter: blur(6px);
        box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
      }
      #asset-palette .palette-drag-handle {
        margin: -2px -2px 0;
        padding: 6px 8px;
        border-radius: 6px 6px 0 0;
        background: rgba(255, 255, 255, 0.06);
        font-size: 12px;
        font-weight: 600;
        cursor: grab;
        user-select: none;
        letter-spacing: 0.02em;
      }
      #asset-palette .palette-drag-handle.dragging {
        cursor: grabbing;
      }
      #asset-palette .palette-header {
        display: flex;
        flex-direction: column;
        gap: 6px;
        font-size: 12px;
      }
      #asset-palette .palette-mode-hint {
        font-size: 10px;
        color: #6ecfff;
        padding: 2px 0;
      }
      #asset-palette .palette-tabs {
        display: flex;
        gap: 4px;
      }
      #asset-palette .palette-tab {
        flex: 1;
        padding: 4px 6px;
        border-radius: 4px;
        border: 1px solid rgba(255,255,255,0.15);
        background: rgba(255,255,255,0.04);
        color: inherit;
        font-size: 10px;
        cursor: pointer;
      }
      #asset-palette .palette-tab.active {
        border-color: #6ecfff;
        background: rgba(110, 207, 255, 0.16);
      }
      #asset-palette input {
        width: 100%;
        padding: 4px 6px;
        border-radius: 4px;
        border: 1px solid rgba(255,255,255,0.2);
        background: rgba(0,0,0,0.35);
        color: inherit;
        font-size: 11px;
      }
      #asset-palette .palette-list {
        overflow-y: auto;
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 4px;
        max-height: 360px;
      }
      #asset-palette .palette-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        padding: 4px;
        border: 1px solid transparent;
        border-radius: 4px;
        background: rgba(255,255,255,0.04);
        color: inherit;
        cursor: pointer;
        text-align: center;
        font-size: 9px;
      }
      #asset-palette .palette-item img {
        image-rendering: pixelated;
        flex-shrink: 0;
        object-fit: contain;
        background: rgba(0,0,0,0.25);
      }
      #asset-palette .palette-item span {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
      }
      #asset-palette .palette-item.selected {
        border-color: #6ecfff;
        background: rgba(110, 207, 255, 0.18);
      }
      #hud-banner {
        position: fixed;
        left: 8px;
        top: 30px;
        max-width: min(360px, calc(100vw - 16px));
        padding: 0;
        border-radius: 6px;
        background: rgba(12, 14, 20, 0.82);
        color: #e8ecf4;
        font-size: 11px;
        line-height: 1.45;
        pointer-events: none;
        border: 1px solid rgba(255,255,255,0.12);
        overflow: hidden;
      }
      #hud-banner .hud-drag-handle {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 8px;
        font-size: 9px;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: #9aa3b2;
        background: rgba(255, 255, 255, 0.05);
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        pointer-events: auto;
        cursor: grab;
        user-select: none;
      }
      #hud-banner .hud-drag-handle.dragging {
        cursor: grabbing;
      }
      #hud-banner .hud-body {
        padding: 6px 10px 8px;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  }
}
