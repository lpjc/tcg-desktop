let interactive = false;

export function setWindowInteractive(value: boolean): void {
  if (interactive === value) return;
  interactive = value;
  window.desktop?.setInteractive(value);
}

export function isWindowInteractive(): boolean {
  return interactive;
}
