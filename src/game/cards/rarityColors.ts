import type { Rarity } from './rarity';

/**
 * One colour per rarity — the single source of truth for stock UI, glows, etc.
 * Holo and non-holo piles of the same rarity share this exact base; holo is
 * distinguished only by the moving stripe effect, not a different hue.
 */
export const RARITY_COLORS: Record<Rarity, number> = {
  common: 0x9aa6b2,
  rare: 0x4f9dde,
  epic: 0xa463f2,
  chase: 0xf2b341,
};

export function rarityColor(rarity: Rarity): number {
  return RARITY_COLORS[rarity];
}

/** Mix a 0xRRGGBB colour toward white (factor > 0) or black (factor < 0). */
export function shadeColorInt(color: number, factor: number): number {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  const target = factor < 0 ? 0 : 255;
  const amount = Math.abs(factor);
  const mix = (channel: number) => Math.round(channel + (target - channel) * amount);
  return (mix(r) << 16) | (mix(g) << 8) | mix(b);
}

/** Same mix as `shadeColorInt`, formatted as a CSS `rgb()` string for the DOM. */
export function shadeColor(color: number, factor: number): string {
  const c = shadeColorInt(color, factor);
  return `rgb(${(c >> 16) & 0xff}, ${(c >> 8) & 0xff}, ${c & 0xff})`;
}

/** CSS values for a chunky stock-card token (base + pixel bevel). */
export function rarityTokenColors(rarity: Rarity): { base: string; hi: string; edge: string } {
  const color = RARITY_COLORS[rarity];
  return {
    base: shadeColor(color, 0),
    hi: shadeColor(color, 0.4),
    edge: shadeColor(color, -0.45),
  };
}

/** Numeric (0xRRGGBB) twin of `rarityTokenColors` for Phaser-drawn card tokens. */
export function rarityTokenColorsInt(rarity: Rarity): { base: number; hi: number; edge: number } {
  const color = RARITY_COLORS[rarity];
  return {
    base: color,
    hi: shadeColorInt(color, 0.4),
    edge: shadeColorInt(color, -0.45),
  };
}

export interface RarityCardColors {
  base: string;
  hi: string;
  edge: string;
  glow: string;
  deep: string;
}

/**
 * CSS values for a binder card frame of a given rarity: the flat base, a light
 * bevel highlight, a dark bevel edge, a soft glow, and a deep tint for the card
 * backing gradient. Keeps every hue derived from `RARITY_COLORS`.
 */
export function rarityCardColors(rarity: Rarity): RarityCardColors {
  const color = RARITY_COLORS[rarity];
  return {
    base: shadeColor(color, 0),
    hi: shadeColor(color, 0.5),
    edge: shadeColor(color, -0.5),
    glow: shadeColor(color, 0.3),
    deep: shadeColor(color, -0.72),
  };
}
