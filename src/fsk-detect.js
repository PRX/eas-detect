/**
 * Detect presence of EAS FSK modulation in audio.
 *
 * FSK (Frequency Shift Keying) alternates between mark (2083.3 Hz) and
 * space (1562.5 Hz) at 520.83 baud. A single frequency alone is not FSK —
 * both must appear in close proximity, alternating over time.
 *
 * This detector:
 * 1. Classifies each window as "mark", "space", "both", or "neither"
 * 2. Only reports intervals where both mark and space appear nearby
 * 3. Validates that the region shows frequency alternation (some windows
 *    mark-dominant, others space-dominant), not just broadband noise
 *
 * (Based on the correlation approach used in multimon-ng's demod_eas.c.)
 */

import { round3, SILENCE_THRESHOLD, windowEnergy } from "./dsp-util.js";
import { goertzel } from "./goertzel.js";

const FREQ_MARK = 2083.3;
const FREQ_SPACE = 1562.5;

// Minimum duration to report as FSK presence
const MIN_DURATION = 0.05;

// Energy ratio threshold for FSK — the target frequency must contain at least
// this fraction of window energy. Higher than the attention tone threshold
// because real FSK has 13%+ while music harmonics are typically 5-8%.
const FSK_ENERGY_RATIO_THRESHOLD = 0.1;

// 20ms windows with 50% overlap
const WINDOW_MS = 20;

// How close (in seconds) mark and space windows must appear to count as FSK.
// Wider than a single bit period because real-world FSK signals can have
// brief dips below threshold at byte boundaries.
const PROXIMITY_WINDOW = 0.2;

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
  const proximityHops = Math.ceil(PROXIMITY_WINDOW / hopSeconds);

  // Pass 1: classify each window
  const windows = [];
  for (let offset = 0; offset + windowSize <= samples.length; offset += hopSize) {
    const window = samples.subarray(offset, offset + windowSize);
    const energy = windowEnergy(window);

    if (energy < SILENCE_THRESHOLD) {
      windows.push({ type: "silent", ratioMark: 0, ratioSpace: 0 });
      continue;
    }

    const magMark = goertzel(window, sampleRate, FREQ_MARK);
    const magSpace = goertzel(window, sampleRate, FREQ_SPACE);
    const ratioMark = magMark / energy;
    const ratioSpace = magSpace / energy;

    const hasMark = ratioMark > FSK_ENERGY_RATIO_THRESHOLD;
    const hasSpace = ratioSpace > FSK_ENERGY_RATIO_THRESHOLD;

    let type;
    if (hasMark && hasSpace) {
      type = "both";
    } else if (hasMark) {
      type = "mark";
    } else if (hasSpace) {
      type = "space";
    } else {
      type = "neither";
    }

    windows.push({ type, ratioMark, ratioSpace });
  }

  // Pass 2: find windows where both mark and space appear within proximity
  const isFskCandidate = new Array(windows.length).fill(false);

  for (let i = 0; i < windows.length; i++) {
    const type  = windows[i].type;
    if (type === "neither" || type === "silent") continue;

    if (type === "both") {
      isFskCandidate[i] = true;
      continue;
    }

    const needMark = type === "space";
    const needSpace = type === "mark";
    const start = Math.max(0, i - proximityHops);
    const end = Math.min(windows.length, i + proximityHops + 1);

    for (let j = start; j < end; j++) {
      if (j === i) continue;
      const other = windows[j].type;
      if (
        (needMark && (other === "mark" || other === "both")) ||
        (needSpace && (other === "space" || other === "both"))
      ) {
        isFskCandidate[i] = true;
        break;
      }
    }
  }

  // Pass 3: build candidate intervals, then validate alternation across
  // nearby intervals (not just within one interval, since the preamble
  // and message bytes may be split across intervals)
  const rawIntervals = [];
  let inCandidate = false;
  let candidateStart = 0;
  let candidateStartIdx = 0;

  for (let i = 0; i <= isFskCandidate.length; i++) {
    const time = i * hopSeconds;
    const isActive = i < isFskCandidate.length && isFskCandidate[i];

    if (isActive && !inCandidate) {
      inCandidate = true;
      candidateStart = time;
      candidateStartIdx = i;
    } else if (!isActive && inCandidate) {
      if (time - candidateStart >= MIN_DURATION) {
        rawIntervals.push({
          start: candidateStart,
          end: time,
          startIdx: candidateStartIdx,
          endIdx: i,
        });
      }
      inCandidate = false;
    }
  }

  // Group nearby intervals and validate alternation across each group.
  // EAS transmissions repeat 3 times with ~1s gaps; checking alternation
  // across the group handles short bursts like NNNN where a single burst's
  // preamble is mostly mark-dominant.
  const GROUP_GAP = 2.0; // seconds between bursts in the same transmission
  const intervals = [];
  let groupStart = 0;

  for (let i = 0; i < rawIntervals.length; i++) {
    const isLast = i === rawIntervals.length - 1;
    const gapAfter = isLast ? Infinity : rawIntervals[i + 1].start - rawIntervals[i].end;

    if (gapAfter > GROUP_GAP || isLast) {
      // End of group — validate alternation across all intervals in this group
      const groupStartIdx = rawIntervals[groupStart].startIdx;
      const groupEndIdx = rawIntervals[i].endIdx;

      if (hasAlternation(windows, groupStartIdx, groupEndIdx)) {
        for (let j = groupStart; j <= i; j++) {
          intervals.push({
            start: round3(rawIntervals[j].start),
            end: round3(rawIntervals[j].end),
          });
        }
      }
      groupStart = i + 1;
    }
  }

  return intervals;
}

/**
 * Check that a candidate FSK region shows real frequency alternation —
 * there must be at least one window where mark clearly dominates AND
 * at least one where space clearly dominates. Broadband noise tends to
 * have one frequency consistently stronger, not true alternation.
 */
function hasAlternation(windows, startIdx, endIdx) {
  let hasMarkDominant = false;
  let hasSpaceDominant = false;

  for (let i = startIdx; i < endIdx; i++) {
    const w = windows[i];
    if (w.type === "silent" || w.type === "neither") continue;

    const stronger = Math.max(w.ratioMark, w.ratioSpace);
    const weaker = Math.min(w.ratioMark, w.ratioSpace);

    if (weaker > 0 && stronger / weaker >= ALTERNATION_DOMINANCE) {
      if (w.ratioMark > w.ratioSpace) {
        hasMarkDominant = true;
      } else {
        hasSpaceDominant = true;
      }
    }

    if (hasMarkDominant && hasSpaceDominant) return true;
  }

  return false;
}
