import registry from '../data/conventions/registry.json';
import defaultExpo from '../data/conventions/default_expo.json';
import wideLobby from '../data/conventions/wide_lobby.json';
import type { PlacedObjectData } from '../entities/Placeable';

export interface ConventionRoomDef {
  id: string;
  x: number;
  width: number;
  floorTop: number;
  label: string;
}

export interface ConventionFloorTheme {
  fill: string;
  border: string;
  lipColor?: string;
}

export interface ConventionVenuePreset {
  id: string;
  name: string;
  width: number;
  rooms: ConventionRoomDef[];
  floor: ConventionFloorTheme;
  /** World position of the player booth origin in this venue. */
  booth: { x: number; y: number };
}

export interface PlayerBoothLayout {
  objects: PlacedObjectData[];
}

export interface ConventionPropsLayout {
  venueId: string;
  objects: PlacedObjectData[];
  floor?: PlacedObjectData[];
}

const PRESETS: Record<string, ConventionVenuePreset> = {
  [defaultExpo.id]: defaultExpo as ConventionVenuePreset,
  [wideLobby.id]: wideLobby as ConventionVenuePreset,
};

let activeId: string = registry.defaultId;
let active: ConventionVenuePreset = PRESETS[activeId] ?? (defaultExpo as ConventionVenuePreset);

export function listConventionVenueIds(): string[] {
  return registry.venues;
}

export function listConventionVenues(): ConventionVenuePreset[] {
  return registry.venues.map((id) => PRESETS[id]).filter(Boolean);
}

export function getActiveConventionVenue(): ConventionVenuePreset {
  return active;
}

export function getActiveConventionVenueId(): string {
  return activeId;
}

export function getConventionWidth(): number {
  return active.width;
}

export function getConventionRooms(): ConventionRoomDef[] {
  return active.rooms;
}

export function getConventionMainFloorTop(): number {
  return Math.min(...active.rooms.map((r) => r.floorTop));
}

export function getBoothAnchor(): { x: number; y: number } {
  return active.booth;
}

export function conventionPropsLayoutName(venueId: string = activeId): string {
  return `convention_${venueId}_props`;
}

export function parseLipColor(hex?: string): number {
  if (!hex) return 0xc8a868;
  return Number.parseInt(hex.replace('#', ''), 16);
}

export function setActiveConventionVenue(id: string): boolean {
  const preset = PRESETS[id];
  if (!preset) return false;
  activeId = id;
  active = preset;
  return true;
}

export function getConventionRoomAt(worldX: number): ConventionRoomDef | null {
  const width = getConventionWidth();
  if (worldX < 0 || worldX >= width) return null;
  for (const room of getConventionRooms()) {
    if (worldX >= room.x && worldX < room.x + room.width) return room;
  }
  return null;
}

export function conventionRoomBounds(
  room: ConventionRoomDef,
  frameX = 0,
): { x: number; width: number; floorTop: number } {
  return { x: frameX + room.x, width: room.width, floorTop: room.floorTop };
}
