import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Build the shipped game SFX from the raw FilmCow pack (art-source/, NOT the
 * publicDir — the raw pack is 280+ MB of 48kHz 24-bit stereo WAVs).
 *
 * For each job: decode → downmix to mono → resample to 24kHz → trim leading
 * silence → cut to maxSeconds with a fade-out → peak-normalize → write a small
 * 16-bit WAV to assets/sfx/. Re-run with `npm run generate:sfx` after changing
 * a mapping below.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const srcDir = path.join(root, 'art-source', 'FilmCow Designed SFX');
const outDir = path.join(root, 'assets', 'sfx');

const OUT_RATE = 24000;
const FADE_SECONDS = 0.25;
/** Normalize peaks to this level; per-job `gain` scales relative to it. */
const TARGET_PEAK = 0.9;

/** Game sound → FilmCow source file. Swap `src` to audition alternatives. */
const JOBS = [
  { out: 'coins.wav', src: 'sci fi bell 1.wav', maxSeconds: 2.0 },
  { out: 'pling.wav', src: 'sci fi bell 2.wav', maxSeconds: 1.5, gain: 0.7 },
  { out: 'flip.wav', src: 'sci fi click 3.wav', maxSeconds: 1.1 },
  { out: 'rare.wav', src: 'deep sci fi stinger 1.wav', maxSeconds: 2.8 },
  { out: 'sale.wav', src: 'sci fi click 7.wav', maxSeconds: 1.3, gain: 0.8 },
  { out: 'rip.wav', src: 'space lightning 4.wav', maxSeconds: 1.4 },
  { out: 'no-stock.wav', src: 'robot sick 2.wav', maxSeconds: 2.1, gain: 0.7 },
  { out: 'vend.wav', src: 'big distant thump 5.wav', maxSeconds: 1.6 },
];

/** Decode a PCM WAV (16/24/32-bit int, incl. WAVE_FORMAT_EXTENSIBLE) to mono Float32. */
function decodeWavToMono(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.toString('ascii', 0, 4) !== 'RIFF') throw new Error(`Not a WAV: ${filePath}`);

  let offset = 12;
  let fmt = null;
  let data = null;
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === 'fmt ') {
      fmt = {
        channels: buf.readUInt16LE(offset + 10),
        sampleRate: buf.readUInt32LE(offset + 12),
        bits: buf.readUInt16LE(offset + 22),
      };
    } else if (id === 'data') {
      data = buf.subarray(offset + 8, offset + 8 + size);
    }
    offset += 8 + size + (size % 2);
  }
  if (!fmt || !data) throw new Error(`Missing fmt/data chunk: ${filePath}`);

  const bytesPerSample = fmt.bits / 8;
  const frameCount = Math.floor(data.length / (bytesPerSample * fmt.channels));
  const mono = new Float32Array(frameCount);
  const scale = 1 / 2 ** (fmt.bits - 1);
  for (let frame = 0; frame < frameCount; frame++) {
    let sum = 0;
    for (let ch = 0; ch < fmt.channels; ch++) {
      const at = (frame * fmt.channels + ch) * bytesPerSample;
      let value;
      if (fmt.bits === 16) value = data.readInt16LE(at);
      else if (fmt.bits === 24) value = (data.readIntLE(at, 3) << 8) >> 8;
      else if (fmt.bits === 32) value = data.readInt32LE(at);
      else throw new Error(`Unsupported bit depth ${fmt.bits}: ${filePath}`);
      sum += value * scale;
    }
    mono[frame] = sum / fmt.channels;
  }
  return { samples: mono, sampleRate: fmt.sampleRate };
}

/** Naive integer-ratio decimation with box averaging (48k → 24k etc.). */
function resample(samples, fromRate, toRate) {
  if (fromRate === toRate) return samples;
  const ratio = fromRate / toRate;
  const outLength = Math.floor(samples.length / ratio);
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(samples.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += samples[j];
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

function trimLeadingSilence(samples, sampleRate, threshold = 0.01) {
  let first = 0;
  while (first < samples.length && Math.abs(samples[first]) < threshold) first++;
  // Keep a 20ms pre-roll so the attack isn't clipped.
  const start = Math.max(0, first - Math.floor(sampleRate * 0.02));
  return samples.subarray(start);
}

function cutWithFade(samples, sampleRate, maxSeconds) {
  const maxFrames = Math.floor(maxSeconds * sampleRate);
  if (samples.length <= maxFrames) return samples;
  const out = samples.slice(0, maxFrames);
  const fadeFrames = Math.min(out.length, Math.floor(FADE_SECONDS * sampleRate));
  for (let i = 0; i < fadeFrames; i++) {
    out[out.length - fadeFrames + i] *= 1 - i / fadeFrames;
  }
  return out;
}

function normalize(samples, targetPeak) {
  let peak = 0;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  if (peak === 0) return samples;
  const factor = targetPeak / peak;
  for (let i = 0; i < samples.length; i++) samples[i] *= factor;
  return samples;
}

function writeWav16Mono(filePath, samples, sampleRate) {
  const dataSize = samples.length * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  }
  fs.writeFileSync(filePath, buf);
}

fs.mkdirSync(outDir, { recursive: true });
for (const job of JOBS) {
  const { samples, sampleRate } = decodeWavToMono(path.join(srcDir, job.src));
  let out = resample(samples, sampleRate, OUT_RATE);
  out = trimLeadingSilence(out, OUT_RATE);
  out = cutWithFade(out, OUT_RATE, job.maxSeconds);
  out = normalize(out, TARGET_PEAK * (job.gain ?? 1));
  writeWav16Mono(path.join(outDir, job.out), out, OUT_RATE);
  console.log(
    `${job.out} ← ${job.src} (${(out.length / OUT_RATE).toFixed(2)}s, ${(out.length * 2 / 1024).toFixed(0)} KB)`,
  );
}
