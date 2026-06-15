import './SetTabs.css';

/** One set's tab info, supplied by the screen. */
export interface SetTabInfo {
  id: string;
  name: string;
  unlocked: boolean;
  /** 0..1 discovery progress, shown as a tiny underline bar. */
  fraction: number;
}

/**
 * The binder's section tabs — a horizontal row of dividers across the top of the
 * book, one per set (like the labelled tabs in a real card binder). Clicking a
 * tab turns to that set (the book riffles through the pages to reach it). Locked
 * sets show dim and un-clickable. Built to grow as more sets unlock.
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

    const label = document.createElement('span');
    label.className = 'set-tab__name';
    label.textContent = tab.unlocked ? tab.name : '???';

    const bar = document.createElement('span');
    bar.className = 'set-tab__bar';
    const fill = document.createElement('span');
    fill.className = 'set-tab__fill';
    fill.style.width = `${Math.round(tab.fraction * 100)}%`;
    bar.appendChild(fill);

    btn.append(label, bar);
    if (tab.unlocked && !active) {
      btn.addEventListener('click', () => this.onSelect(tab.id));
    }
    return btn;
  }
}
