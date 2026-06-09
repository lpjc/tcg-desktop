/**
 * Walk-motion timing for station-to-station travel.
 *
 * The player accelerates at a FIXED rate up to a FIXED top speed, cruises, then
 * decelerates at the same fixed rate — a classic trapezoidal velocity profile.
 * This is deliberately *not* a normalized ease (e.g. `Sine.easeInOut`) because
 * an ease stretches the same accel curve across the whole trip: short hops feel
 * snappy while long hops feel like slow-motion. With a constant acceleration the
 * ramp-up always feels identical; only the cruise phase grows with distance.
 *
 * Units are source pixels and seconds; `planWalkMotion` returns milliseconds for
 * Phaser tweens plus `progressAt(t)` mapping normalized time → normalized distance.
 */

/** Cruise speed (px/s). */
const MAX_SPEED = 72;
/** Acceleration / deceleration (px/s²). Reaches MAX_SPEED in ~0.23s. */
const ACCEL = 320;

export interface WalkPlan {
  /** Total travel time in milliseconds. */
  durationMs: number;
  /** Fraction of the distance covered at normalized time `t` (0→1). */
  progressAt(t: number): number;
}

/** Distance covered while ramping from rest to MAX_SPEED. */
const RAMP_DISTANCE = (MAX_SPEED * MAX_SPEED) / (2 * ACCEL);
/** Time to ramp from rest to MAX_SPEED. */
const RAMP_TIME = MAX_SPEED / ACCEL;

export function planWalkMotion(distance: number): WalkPlan {
  const dist = Math.max(0, distance);

  if (dist <= 0) {
    return { durationMs: 0, progressAt: () => 1 };
  }

  // Triangular profile: too short to ever reach MAX_SPEED.
  if (dist < 2 * RAMP_DISTANCE) {
    const peakSpeed = Math.sqrt(ACCEL * dist);
    const halfTime = peakSpeed / ACCEL;
    const totalTime = 2 * halfTime;
    const halfDist = dist / 2;

    return {
      durationMs: totalTime * 1000,
      progressAt: (t) => {
        const time = clamp01(t) * totalTime;
        let covered: number;
        if (time <= halfTime) {
          covered = 0.5 * ACCEL * time * time;
        } else {
          const td = time - halfTime;
          covered = halfDist + peakSpeed * td - 0.5 * ACCEL * td * td;
        }
        return clamp01(covered / dist);
      },
    };
  }

  // Trapezoidal profile: ramp up · cruise · ramp down.
  const cruiseDist = dist - 2 * RAMP_DISTANCE;
  const cruiseTime = cruiseDist / MAX_SPEED;
  const totalTime = 2 * RAMP_TIME + cruiseTime;

  return {
    durationMs: totalTime * 1000,
    progressAt: (t) => {
      const time = clamp01(t) * totalTime;
      let covered: number;
      if (time <= RAMP_TIME) {
        covered = 0.5 * ACCEL * time * time;
      } else if (time <= RAMP_TIME + cruiseTime) {
        covered = RAMP_DISTANCE + MAX_SPEED * (time - RAMP_TIME);
      } else {
        const td = time - RAMP_TIME - cruiseTime;
        covered = RAMP_DISTANCE + cruiseDist + MAX_SPEED * td - 0.5 * ACCEL * td * td;
      }
      return clamp01(covered / dist);
    },
  };
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
