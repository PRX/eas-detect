/**
 * Detect presence of EAS FSK energy in audio — mark (2083.3 Hz) and space (1562.5 Hz).
 *
 * This is a coarse detector for partial match reporting. It identifies regions
 * where FSK modulation energy is present, even if the signal isn't clean enough
 * for multimon-ng to decode a complete SAME header.
 *
 * Uses energy-ratio detection for robustness against varying signal levels.
 */

import { goertzel } from "./goertzel.js";
import { ENERGY_RATIO_THRESHOLD, SILENCE_THRESHOLD, windowEnergy, round3 } from "./dsp-util.js";

const FREQ_MARK = 2083.3;
const FREQ_SPACE = 1562.5;

// Minimum duration to count as FSK presence (a single SAME byte is ~15ms)
const MIN_DURATION = 0.05;

// 20ms windows with 50% overlap — short enough to catch brief FSK bursts
const WINDOW_MS = 20;

/**
 * Detect FSK energy intervals in audio.
 * Returns array of { start, end } intervals.
 */
export function detectFsk(samples, sampleRate) {
  const windowSize = Math.round((WINDOW_MS / 1000) * sampleRate);
  const hopSize = Math.round(windowSize / 2);
  const intervals = [];

  let inFsk = false;
  let fskStart = 0;

  for (let offset = 0; offset + windowSize <= samples.length; offset += hopSize) {
    const window = samples.subarray(offset, offset + windowSize);
    const energy = windowEnergy(window);

    if (energy < SILENCE_THRESHOLD) {
      if (inFsk) {
        const end = offset / sampleRate;
        if (end - fskStart >= MIN_DURATION) {
          intervals.push({ start: round3(fskStart), end: round3(end) });
        }
        inFsk = false;
      }
      continue;
    }

    const magMark = goertzel(window, sampleRate, FREQ_MARK);
    const magSpace = goertzel(window, sampleRate, FREQ_SPACE);

    const fskPresent =
      magMark / energy > ENERGY_RATIO_THRESHOLD ||
      magSpace / energy > ENERGY_RATIO_THRESHOLD;

    if (fskPresent && !inFsk) {
      inFsk = true;
      fskStart = offset / sampleRate;
    } else if (!fskPresent && inFsk) {
      const end = offset / sampleRate;
      if (end - fskStart >= MIN_DURATION) {
        intervals.push({ start: round3(fskStart), end: round3(end) });
      }
      inFsk = false;
    }
  }

  if (inFsk) {
    const end = samples.length / sampleRate;
    if (end - fskStart >= MIN_DURATION) {
      intervals.push({ start: round3(fskStart), end: round3(end) });
    }
  }

  return intervals;
}
