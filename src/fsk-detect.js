/**
 * Detect presence of EAS FSK energy in audio — mark (2083.3 Hz) and space (1562.5 Hz).
 *
 * This is a coarse detector for partial match reporting. It identifies regions
 * where FSK modulation energy is present, even if the signal isn't clean enough
 * for multimon-ng to decode a complete SAME header.
 */

const FREQ_MARK = 2083.3;
const FREQ_SPACE = 1562.5;

// Minimum duration to count as FSK presence (a single SAME byte is ~15ms)
const MIN_DURATION = 0.05;

// Energy threshold — FSK signal should dominate the window
const MAGNITUDE_THRESHOLD = 0.005;

// 20ms windows with 50% overlap — short enough to catch brief FSK bursts
const WINDOW_MS = 20;

/**
 * Goertzel algorithm — magnitude squared at a single frequency.
 */
function goertzel(samples, sampleRate, targetFreq) {
  const N = samples.length;
  const k = Math.round((N * targetFreq) / sampleRate);
  const w = (2 * Math.PI * k) / N;
  const cosW = Math.cos(w);
  const coeff = 2 * cosW;

  let s0 = 0;
  let s1 = 0;
  let s2 = 0;

  for (let i = 0; i < N; i++) {
    s0 = samples[i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }

  return (s1 * s1 + s2 * s2 - coeff * s1 * s2) / (N * N);
}

/**
 * Detect FSK energy intervals in audio.
 * Returns { detected: boolean, intervals: [{ start, end }] }
 */
export function detectFsk(samples, sampleRate) {
  const windowSize = Math.round((WINDOW_MS / 1000) * sampleRate);
  const hopSize = Math.round(windowSize / 2);
  const intervals = [];

  let inFsk = false;
  let fskStart = 0;

  for (let offset = 0; offset + windowSize <= samples.length; offset += hopSize) {
    const window = samples.subarray(offset, offset + windowSize);

    const magMark = goertzel(window, sampleRate, FREQ_MARK);
    const magSpace = goertzel(window, sampleRate, FREQ_SPACE);

    // Either mark or space frequency should have significant energy
    // (at any instant, the FSK signal is at one or the other)
    const fskPresent =
      magMark > MAGNITUDE_THRESHOLD || magSpace > MAGNITUDE_THRESHOLD;

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

  return {
    detected: intervals.length > 0,
    intervals,
  };
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}
