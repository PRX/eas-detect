/**
 * Alternative FSK detector using correlation analysis with bandpass filtering.
 *
 * Detects the *pattern* of FSK modulation by looking for anti-correlation
 * between mark (2083.3 Hz) and space (1562.5 Hz) energy envelopes over time.
 * In real FSK, when mark energy is high, space is low and vice versa — they
 * alternate at the baud rate. Music harmonics tend to rise and fall together
 * (positive correlation).
 *
 * Uses narrow bandpass filters (±50 Hz) via ffmpeg to isolate each FSK frequency,
 * then computes energy envelopes and Pearson correlation over sliding regions.
 * The bandpass improves sensitivity by removing competing frequencies that
 * would dilute the correlation signal.
 *
 * This can detect very faint FSK signals mixed with speech because it's
 * pattern-based rather than level-based.
 */

import { bandpassFilter } from "./audio.js";
import { round3, windowEnergy } from "./dsp-util.js";

const FREQ_MARK = 2083.3;
const FREQ_SPACE = 1562.5;

// Bandpass filter width around each frequency (Hz)
const FILTER_WIDTH = 50;

// Short window for computing per-frequency energy — close to the bit period
// (1.92ms at 520.83 baud) to capture per-bit energy variation.
const ENVELOPE_WINDOW_MS = 2;

// Analysis region over which to compute correlation (ms).
// 50ms (~26 bits) provides enough data for reliable correlation while
// keeping the analysis localized to detect short FSK bursts.
const ANALYSIS_REGION_MS = 50;

// Hop between analysis regions (ms)
const ANALYSIS_HOP_MS = 25;

// Correlation threshold — values below this indicate anti-correlation (FSK).
// Real FSK in test files shows correlations of -0.85 to -0.91.
// -0.8 catches weak signals while filtering most music.
const CORRELATION_THRESHOLD = -0.8;

// Both frequencies must have some minimum total magnitude in the region
// to avoid spurious correlations from near-silence.
const MIN_REGION_MAGNITUDE = 1e-10;

// Minimum duration to report as FSK presence
const MIN_DURATION = 0.1;

// Maximum duration of a single FSK interval
const MAX_INTERVAL_DURATION = 6.0;

// Maximum gap to bridge between active regions
const MAX_GAP = 0.3;

// Minimum number of active analysis regions in a candidate interval
const MIN_ACTIVE_REGIONS = 2;

/**
 * Detect FSK modulation using bandpass-filtered correlation analysis.
 *
 * @param {string} rawPath - Path to s16le 22050 Hz mono raw PCM file
 * @param {number} sampleRate - Sample rate
 * @returns {Array<{start: number, end: number}>} Detected FSK intervals
 */
export function detectFskSensitive(rawPath, sampleRate) {
  // Bandpass filter into narrow mark and space bands
  const markSamples = bandpassFilter(
    rawPath,
    FREQ_MARK - FILTER_WIDTH,
    FREQ_MARK + FILTER_WIDTH,
    sampleRate,
  );
  const spaceSamples = bandpassFilter(
    rawPath,
    FREQ_SPACE - FILTER_WIDTH,
    FREQ_SPACE + FILTER_WIDTH,
    sampleRate,
  );

  // Compute energy envelopes in short windows close to the bit period
  const envWindowSize = Math.max(2, Math.round((ENVELOPE_WINDOW_MS / 1000) * sampleRate));
  const numEnvWindows = Math.floor(
    Math.min(markSamples.length, spaceSamples.length) / envWindowSize,
  );

  const markEnvelope = new Float64Array(numEnvWindows);
  const spaceEnvelope = new Float64Array(numEnvWindows);

  for (let i = 0; i < numEnvWindows; i++) {
    const offset = i * envWindowSize;
    markEnvelope[i] = windowEnergy(markSamples.subarray(offset, offset + envWindowSize));
    spaceEnvelope[i] = windowEnergy(spaceSamples.subarray(offset, offset + envWindowSize));
  }

  // Slide analysis regions and compute mark-space correlation
  const envRate = sampleRate / envWindowSize;
  const regionSize = Math.round((ANALYSIS_REGION_MS / 1000) * envRate);
  const regionHop = Math.round((ANALYSIS_HOP_MS / 1000) * envRate);
  const hopSeconds = ANALYSIS_HOP_MS / 1000;

  const regions = [];

  for (let i = 0; i + regionSize <= numEnvWindows; i += regionHop) {
    const markRegion = markEnvelope.subarray(i, i + regionSize);
    const spaceRegion = spaceEnvelope.subarray(i, i + regionSize);
    const time = i / envRate;

    // Check both bands have some energy
    let markSum = 0,
      spaceSum = 0;
    for (let j = 0; j < regionSize; j++) {
      markSum += markRegion[j];
      spaceSum += spaceRegion[j];
    }

    if (markSum < MIN_REGION_MAGNITUDE || spaceSum < MIN_REGION_MAGNITUDE) {
      regions.push({ time, active: false });
      continue;
    }

    const corr = pearsonCorrelation(
      markRegion,
      spaceRegion,
      markSum / regionSize,
      spaceSum / regionSize,
    );

    regions.push({ time, active: corr < CORRELATION_THRESHOLD });
  }

  // Build intervals from active regions with gap bridging
  const candidates = [];
  let inInterval = false;
  let intervalStart = 0;
  let lastActiveTime = 0;
  let activeCount = 0;

  for (const region of regions) {
    if (region.active) {
      if (!inInterval) {
        inInterval = true;
        intervalStart = region.time;
        activeCount = 0;
      }
      lastActiveTime = region.time + hopSeconds;
      activeCount++;
    } else if (inInterval && region.time - lastActiveTime > MAX_GAP) {
      const duration = lastActiveTime - intervalStart;
      if (
        duration >= MIN_DURATION &&
        duration <= MAX_INTERVAL_DURATION &&
        activeCount >= MIN_ACTIVE_REGIONS
      ) {
        candidates.push({ start: intervalStart, end: lastActiveTime });
      }
      inInterval = false;
    }
  }

  if (inInterval) {
    const duration = lastActiveTime - intervalStart;
    if (
      duration >= MIN_DURATION &&
      duration <= MAX_INTERVAL_DURATION &&
      activeCount >= MIN_ACTIVE_REGIONS
    ) {
      candidates.push({ start: intervalStart, end: lastActiveTime });
    }
  }

  // Validate each candidate has real mark/space alternation in the envelopes.
  // This filters out regions where anti-correlation is statistical noise rather
  // than actual FSK alternation (same check used by the default detector).
  const validated = candidates.filter((c) => {
    const startIdx = Math.round(c.start * envRate);
    const endIdx = Math.min(Math.round(c.end * envRate), numEnvWindows);
    return hasAlternation(markEnvelope, spaceEnvelope, startIdx, endIdx);
  });

  return validated.map((c) => ({ start: round3(c.start), end: round3(c.end) }));
}

/**
 * Check that a region shows real frequency alternation — at least one window
 * where mark energy clearly dominates AND at least one where space dominates.
 * A window "clearly dominates" if the stronger band is at least 1.5x the weaker.
 */
function hasAlternation(markEnvelope, spaceEnvelope, startIdx, endIdx) {
  const DOMINANCE = 1.5;
  let hasMarkDominant = false;
  let hasSpaceDominant = false;

  for (let i = startIdx; i < endIdx; i++) {
    const m = markEnvelope[i];
    const s = spaceEnvelope[i];
    if (m === 0 && s === 0) continue;

    const stronger = Math.max(m, s);
    const weaker = Math.min(m, s);

    if (weaker > 0 && stronger / weaker >= DOMINANCE) {
      if (m > s) hasMarkDominant = true;
      else hasSpaceDominant = true;
    }

    if (hasMarkDominant && hasSpaceDominant) return true;
  }

  return false;
}

/**
 * Compute Pearson correlation coefficient between two arrays.
 */
function pearsonCorrelation(a, b, meanA, meanB) {
  const n = a.length;
  let sumAB = 0,
    sumAA = 0,
    sumBB = 0;

  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    sumAB += da * db;
    sumAA += da * da;
    sumBB += db * db;
  }

  const denom = Math.sqrt(sumAA * sumBB);
  if (denom === 0) return 0;
  return sumAB / denom;
}
