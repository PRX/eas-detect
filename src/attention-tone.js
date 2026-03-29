/**
 * Detect EAS attention tones in audio.
 *
 * Detects three cases:
 * - "attentionTone" — 853 Hz and 960 Hz played simultaneously (standard EAS)
 * - "tone960" — 960 Hz present alone, which the FCC docs allows for mono
 * - "tone853" — 853 Hz present alone, which is less of an issue, but still to be avoided
 *
 * Uses the Goertzel algorithm with energy-ratio detection: the tone frequency's
 * energy is compared to total window energy, making detection robust even when
 * the tone is mixed with speech or music.
 */

const FREQ_LOW = 853;
const FREQ_HIGH = 960;

// Minimum duration in seconds to count as a tone
const MIN_DURATION = 0.5;

// Energy ratio threshold: tone frequency must contain at least this fraction
// of the window's total energy. 0.05 = 5% of energy at the target frequency.
const ENERGY_RATIO_THRESHOLD = 0.05;

// Analysis window: 100ms with 50% overlap (longer window = better frequency resolution)
const WINDOW_MS = 100;

/**
 * Generalized Goertzel algorithm — compute magnitude at an exact frequency.
 * Uses non-integer k for precise frequency targeting.
 */
function goertzel(samples, sampleRate, targetFreq) {
  const N = samples.length;
  const w = (2 * Math.PI * targetFreq) / sampleRate;
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

  // Magnitude squared, normalized by N
  return (s1 * s1 + s2 * s2 - coeff * s1 * s2) / (N * N);
}

/**
 * Classify which tone(s) are present in a window using energy ratios.
 * Returns "attentionTone", "tone960", "tone853", or null.
 */
function classifyWindow(samples, sampleRate) {
  // Compute total energy (RMS squared)
  let sumSq = 0;
  for (let i = 0; i < samples.length; i++) {
    sumSq += samples[i] * samples[i];
  }
  const energy = sumSq / samples.length;

  // Skip silent windows
  if (energy < 0.000001) return null;

  const mag853 = goertzel(samples, sampleRate, FREQ_LOW);
  const mag960 = goertzel(samples, sampleRate, FREQ_HIGH);

  // Energy ratio: what fraction of window energy is at each frequency
  const ratio853 = mag853 / energy;
  const ratio960 = mag960 / energy;

  const has853 = ratio853 > ENERGY_RATIO_THRESHOLD;
  const has960 = ratio960 > ENERGY_RATIO_THRESHOLD;

  if (has853 && has960) return "attentionTone";
  if (has960) return "tone960";
  if (has853) return "tone853";
  return null;
}

/**
 * Detect attention tone intervals in audio samples.
 * Returns array of { type, start, end } intervals.
 *
 * Types: "attentionTone" (853+960 Hz), "tone960" (960 Hz alone), "tone853" (853 Hz alone)
 */
export function detectAttentionTone(samples, sampleRate) {
  const windowSize = Math.round((WINDOW_MS / 1000) * sampleRate);
  const hopSize = Math.round(windowSize / 2);
  const intervals = [];

  let currentType = null;
  let toneStart = 0;

  for (let offset = 0; offset + windowSize <= samples.length; offset += hopSize) {
    const window = samples.subarray(offset, offset + windowSize);
    const type = classifyWindow(window, sampleRate);

    if (type !== currentType) {
      // Close previous interval
      if (currentType !== null) {
        const end = offset / sampleRate;
        if (end - toneStart >= MIN_DURATION) {
          intervals.push({
            type: currentType,
            start: round3(toneStart),
            end: round3(end),
          });
        }
      }
      // Start new interval
      currentType = type;
      toneStart = offset / sampleRate;
    }
  }

  // Close any open interval
  if (currentType !== null) {
    const end = samples.length / sampleRate;
    if (end - toneStart >= MIN_DURATION) {
      intervals.push({
        type: currentType,
        start: round3(toneStart),
        end: round3(end),
      });
    }
  }

  return intervals;
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}
