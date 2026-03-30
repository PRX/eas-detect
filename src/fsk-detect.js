/**
 * Detect presence of EAS FSK modulation in audio.
 *
 * FSK (Frequency Shift Keying) alternates between mark (2083.3 Hz) and
 * space (1562.5 Hz) at 520.83 baud. A single frequency alone is not FSK —
 * both must appear in close proximity, alternating over time.
 *
 * Detection approach (based on the correlation method in multimon-ng's demod_eas.c):
 * 1. Scan audio in overlapping windows, measuring mark/space energy ratios
 * 2. Build candidate intervals where either frequency exceeds the threshold,
 *    bridging small gaps where energy dips briefly
 * 3. Validate each candidate group shows true FSK alternation: at least one
 *    mark-dominant and one space-dominant window must exist
 */

import { round3, windowEnergy } from "./dsp-util.js";
import { goertzel } from "./goertzel.js";

// Silence threshold for FSK detection. Even with bandpass-filtered input,
// we need a meaningful threshold because dialogue harmonics in the 1500-2150 Hz
// band can trigger false positives. The alternation check helps but isn't
// sufficient for very quiet signals.
const FSK_SILENCE_THRESHOLD = 0.001;

const FREQ_MARK = 2083.3;
const FREQ_SPACE = 1562.5;

// Minimum duration to report as FSK presence
const MIN_DURATION = 0.05;

// Energy ratio threshold — target frequency must contain at least this fraction
// of window energy. Real FSK has 13%+; music harmonics are typically 5-8%.
const FSK_ENERGY_RATIO_THRESHOLD = 0.1;

// 20ms analysis windows with 50% overlap
const WINDOW_MS = 20;

// Maximum gap (seconds) to bridge between active windows in the same interval.
// Must be shorter than the ~1s silence between EAS burst repetitions, but long
// enough to handle brief dips at byte boundaries.
const MAX_GAP = 0.1;

// Maximum gap (seconds) between intervals in the same transmission group.
// EAS repeats 3 times with ~1s silence between bursts.
const GROUP_GAP = 2.0;

// Maximum duration of a single FSK interval. A full SAME header (16-byte
// preamble + 268-byte message) at 520.83 baud is ~4.4 seconds. Anything
// much longer is not a real EAS transmission.
const MAX_INTERVAL_DURATION = 6.0;

// A window is "clearly dominated" by one frequency if the stronger is at
// least this many times the weaker.
const ALTERNATION_DOMINANCE = 1.5;

/**
 * Detect FSK modulation intervals in audio.
 * Returns array of { start, end } intervals where FSK is present.
 */
export function detectFsk(samples, sampleRate) {
  const windowSize = Math.round((WINDOW_MS / 1000) * sampleRate);
  const hopSize = Math.round(windowSize / 2);
  const hopSeconds = hopSize / sampleRate;

  // Pass 1: scan windows and build candidate intervals.
  // Each interval tracks whether mark-dominant and space-dominant windows
  // have been seen, so we can validate alternation without a second scan.
  const candidates = [];
  let active = false;
  let intervalStart = 0;
  let lastActiveTime = 0;
  let hasMarkDominant = false;
  let hasSpaceDominant = false;

  for (let offset = 0; offset + windowSize <= samples.length; offset += hopSize) {
    const window = samples.subarray(offset, offset + windowSize);
    const energy = windowEnergy(window);
    const time = offset / sampleRate;

    // Determine if this window has FSK energy
    let isFskWindow = false;
    if (energy >= FSK_SILENCE_THRESHOLD) {
      const magMark = goertzel(window, sampleRate, FREQ_MARK);
      const magSpace = goertzel(window, sampleRate, FREQ_SPACE);
      const ratioMark = magMark / energy;
      const ratioSpace = magSpace / energy;

      if (ratioMark > FSK_ENERGY_RATIO_THRESHOLD || ratioSpace > FSK_ENERGY_RATIO_THRESHOLD) {
        isFskWindow = true;

        // Track dominance for alternation validation
        const stronger = Math.max(ratioMark, ratioSpace);
        const weaker = Math.min(ratioMark, ratioSpace);
        if (weaker > 0 && stronger / weaker >= ALTERNATION_DOMINANCE) {
          if (ratioMark > ratioSpace) hasMarkDominant = true;
          else hasSpaceDominant = true;
        }
      }
    }

    if (isFskWindow) {
      if (!active) {
        // Start a new interval
        active = true;
        intervalStart = time;
        hasMarkDominant = false;
        hasSpaceDominant = false;
      }
      lastActiveTime = time + hopSeconds;
    } else if (active && time - lastActiveTime > MAX_GAP) {
      // Gap exceeded — close the interval at the last active window
      pushCandidate(candidates, intervalStart, lastActiveTime,
        hasMarkDominant, hasSpaceDominant);
      active = false;
    }
  }

  // Close any open interval
  if (active) {
    pushCandidate(candidates, intervalStart, lastActiveTime,
      hasMarkDominant, hasSpaceDominant);
  }

  // Pass 2: validate alternation. First, include any interval that has both
  // mark-dominant and space-dominant windows on its own. Then, for intervals
  // that only show one dominant frequency, include them if a nearby interval
  // (within GROUP_GAP) has the complementary frequency — this handles short
  // EOM bursts where the preamble is mostly mark but a nearby burst has space.
  const validated = new Array(candidates.length).fill(false);

  // Mark intervals that self-validate
  for (let i = 0; i < candidates.length; i++) {
    if (candidates[i].hasMarkDominant && candidates[i].hasSpaceDominant) {
      validated[i] = true;
    }
  }

  // For remaining intervals, check if a neighbor provides the missing frequency
  for (let i = 0; i < candidates.length; i++) {
    if (validated[i]) continue;
    const c = candidates[i];
    if (!c.hasMarkDominant && !c.hasSpaceDominant) continue;

    for (let j = 0; j < candidates.length; j++) {
      if (i === j) continue;
      const gap = j > i
        ? candidates[j].start - c.end
        : c.start - candidates[j].end;
      if (gap > GROUP_GAP) continue;

      const neighborValidated = validated[j];
      const neighbor = candidates[j];

      // Only borrow from an already-validated neighbor or one with the missing freq
      if (
        (c.hasMarkDominant && !c.hasSpaceDominant && neighbor.hasSpaceDominant) ||
        (c.hasSpaceDominant && !c.hasMarkDominant && neighbor.hasMarkDominant)
      ) {
        // The neighbor must itself be validated or self-alternating
        if (neighborValidated || (neighbor.hasMarkDominant && neighbor.hasSpaceDominant)) {
          validated[i] = true;
          break;
        }
      }
    }
  }

  return candidates
    .filter((_, i) => validated[i])
    .map((c) => ({ start: round3(c.start), end: round3(c.end) }));
}

function pushCandidate(candidates, start, end, hasMarkDominant, hasSpaceDominant) {
  const duration = end - start;
  if (duration >= MIN_DURATION && duration <= MAX_INTERVAL_DURATION) {
    candidates.push({ start, end, hasMarkDominant, hasSpaceDominant });
  }
}
