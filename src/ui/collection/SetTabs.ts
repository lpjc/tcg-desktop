import './SetTabs.css';

/** One set's tab info, supplied by the screen. */
export interface SetTabInfo {
  id: string;
  name: string;
  unlocked: boolean;
  /** 0..1 discovery progress, shown as a tiny spine bar. */
  fraction: number;
}

/**
 * The binder's index tabs — a vertical rail of dividers down the left edge, one
 * per set (like the tabbed dividers in a real card binder). Clicking a tab turns
 * to that set. Locked sets show as dim, un-clickable spines (a hint of what's to
 * come). Built to grow: today there's one set, later there are many.
 */
export class SetTabs {
  readonly el: HTMLDivElement;
  private readonly onSelect: (setId: string) => void;

  constructor(onSelect: (setId: string) => void) {
    this.onSelect = onSelect;
    this.el = document.createElement('div');
    this.el.className = 'set-tabs';
  }

  render(tabs: SetTabInfo[], activeId: string): void {
    this.el.replaceChildren();
    for (const tab of tabs) {
      this.el.appendChild(this.buildTab(tab, tab.id === activeId));
    }
  }

  private buildTab(tab: SetTabInfo, active: boolean): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'set-tab';
    btn.dataset.state = active ? 'active' : 'idle';
    btn.disabled = !tab.unlocked;
    btn.title = tab.unlocked ? tab.name : 'Locked set';

    const letter = document.createElement('span');
    letter.className = 'set-tab__letter';
    letter.textContent = tab.unlocked ? tab.name.charAt(0).toUpperCase() : '';

    const bar = document.createElement('span');
    bar.className = 'set-tab__bar';
    const fill = document.createElement('span');
    fill.className = 'set-tab__fill';
    fill.style.height = `${Math.round(tab.fraction * 100)}%`;
    bar.appendChild(fill);

    btn.append(letter, bar);
    if (tab.unlocked) {
      btn.addEventListener('click', () => this.onSelect(tab.id));
    }
    return btn;
  }
}
