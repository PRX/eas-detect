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

import { goertzel } from "./goertzel.js";
import { ENERGY_RATIO_THRESHOLD, SILENCE_THRESHOLD, windowEnergy, round3 } from "./dsp-util.js";

const FREQ_LOW = 853;
const FREQ_HIGH = 960;

// Minimum duration in seconds to count as a tone
const MIN_DURATION = 0.5;

// Analysis window: 100ms with 50% overlap (longer window = better frequency resolution)
const WINDOW_MS = 100;

/**
 * Classify which tone(s) are present in a window using energy ratios.
 * Returns "attentionTone", "tone960", "tone853", or null.
 */
function classifyWindow(samples, sampleRate) {
  const energy = windowEnergy(samples);
  if (energy < SILENCE_THRESHOLD) return null;

  const mag853 = goertzel(samples, sampleRate, FREQ_LOW);
  const mag960 = goertzel(samples, sampleRate, FREQ_HIGH);

  const has853 = mag853 / energy > ENERGY_RATIO_THRESHOLD;
  const has960 = mag960 / energy > ENERGY_RATIO_THRESHOLD;

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
      currentType = type;
      toneStart = offset / sampleRate;
    }
  }

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
