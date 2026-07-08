import { assetUrl } from '../assets/assetUrl';

/**
 * The game's audio: one-shot SFX (Web Audio, decoded once and cached) and a
 * single looping background music track (streaming <audio> element).
 *
 * Browsers block sound until the first user gesture, so everything is armed
 * lazily: `init()` installs a one-time gesture listener that unlocks the
 * AudioContext and starts the music (if enabled). Music on/off persists in
 * localStorage; SFX have no player-facing toggle yet but respect `setSfxEnabled`.
 *
 * SFX files are small mono WAVs generated from the raw FilmCow pack in
 * `art-source/` by `npm run generate:sfx` (see scripts/build-sfx.mjs).
 */

export type SfxKey =
  | 'coins'
  | 'pling'
  | 'flip'
  | 'rare'
  | 'sale'
  | 'rip'
  | 'no-stock'
  | 'vend';

const MUSIC_KEY = 'tcg-desktop.music-enabled';
const MUSIC_FILE = 'music/djlofi-pixel-dreams-259187.mp3';
/** Subtle bed, well under the SFX. */
const MUSIC_VOLUME = 0.25;
const SFX_VOLUME = 0.5;
/** Same sound re-triggered faster than this is dropped (protects Reveal All spam). */
const SFX_THROTTLE_MS = 90;

type MusicListener = (enabled: boolean) => void;

class AudioManager {
  private context: AudioContext | null = null;
  private buffers = new Map<SfxKey, AudioBuffer>();
  private pending = new Map<SfxKey, Promise<AudioBuffer | null>>();
  private lastPlayed = new Map<SfxKey, number>();
  private sfxEnabled = true;

  private music: HTMLAudioElement | null = null;
  private musicEnabled = readMusicPref();
  private unlocked = false;
  private listeners = new Set<MusicListener>();

  /** Call once at boot: arms the first-gesture unlock. */
  init(): void {
    const unlock = () => {
      this.unlocked = true;
      void this.ensureContext()?.resume();
      this.syncMusic();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  /** Fire-and-forget one-shot. Safe to call before the gesture unlock (no-op). */
  playSfx(key: SfxKey, volume = 1): void {
    if (!this.sfxEnabled || !this.unlocked) return;
    const now = performance.now();
    const last = this.lastPlayed.get(key) ?? -Infinity;
    if (now - last < SFX_THROTTLE_MS) return;
    this.lastPlayed.set(key, now);

    const context = this.ensureContext();
    if (!context) return;
    void this.loadBuffer(key).then((buffer) => {
      if (!buffer) return;
      const source = context.createBufferSource();
      source.buffer = buffer;
      const gain = context.createGain();
      gain.gain.value = SFX_VOLUME * volume;
      source.connect(gain).connect(context.destination);
      source.start();
    });
  }

  isMusicEnabled(): boolean {
    return this.musicEnabled;
  }

  toggleMusic(): void {
    this.musicEnabled = !this.musicEnabled;
    try {
      localStorage.setItem(MUSIC_KEY, String(this.musicEnabled));
    } catch {
      /* ignore */
    }
    this.syncMusic();
    for (const listener of this.listeners) listener(this.musicEnabled);
  }

  /** Subscribe to music on/off changes; fires immediately with current state. */
  onMusicChange(listener: MusicListener): void {
    this.listeners.add(listener);
    listener(this.musicEnabled);
  }

  setSfxEnabled(enabled: boolean): void {
    this.sfxEnabled = enabled;
  }

  // ---- internals -----------------------------------------------------------

  private ensureContext(): AudioContext | null {
    if (this.context) return this.context;
    try {
      this.context = new AudioContext();
    } catch {
      return null;
    }
    return this.context;
  }

  private loadBuffer(key: SfxKey): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(key);
    if (cached) return Promise.resolve(cached);
    const inFlight = this.pending.get(key);
    if (inFlight) return inFlight;

    const context = this.ensureContext();
    if (!context) return Promise.resolve(null);
    const promise = fetch(assetUrl(`sfx/${key}.wav`))
      .then((response) => response.arrayBuffer())
      .then((data) => context.decodeAudioData(data))
      .then((buffer) => {
        this.buffers.set(key, buffer);
        return buffer;
      })
      .catch(() => null)
      .finally(() => this.pending.delete(key));
    this.pending.set(key, promise);
    return promise;
  }

  /** Start/stop the loop to match the enabled flag (only after gesture unlock). */
  private syncMusic(): void {
    if (!this.unlocked) return;
    if (this.musicEnabled) {
      if (!this.music) {
        this.music = new Audio(assetUrl(MUSIC_FILE));
        this.music.loop = true;
        this.music.volume = MUSIC_VOLUME;
      }
      void this.music.play().catch(() => {
        /* autoplay refused — the next toggle retries */
      });
    } else {
      this.music?.pause();
    }
  }
}

function readMusicPref(): boolean {
  try {
    return localStorage.getItem(MUSIC_KEY) !== 'false';
  } catch {
    return true;
  }
}

export const audio = new AudioManager();
