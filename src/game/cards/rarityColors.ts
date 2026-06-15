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
export function shadeColor(color: number, factor: number): string {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  const target = factor < 0 ? 0 : 255;
  const amount = Math.abs(factor);
  const mix = (channel: number) => Math.round(channel + (target - channel) * amount);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
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
