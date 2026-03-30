/**
 * Shared DSP utilities for the EAS detectors.
 */

// Energy ratio threshold: target frequency must contain at least this fraction
// of the window's total energy. 0.05 = 5%.
export const ENERGY_RATIO_THRESHOLD = 0.05;

// Windows with mean energy below this are considered silent and skipped.
// 0.001 is roughly -30 dBFS RMS — filters out near-silence where tiny
// noise spikes can create misleading energy ratios.
export const SILENCE_THRESHOLD = 0.001;

/**
 * Compute mean energy (mean squared amplitude) of a sample window.
 */
export function windowEnergy(samples) {
  let sumSq = 0;
  for (let i = 0; i < samples.length; i++) {
    sumSq += samples[i] * samples[i];
  }
  return sumSq / samples.length;
}

/**
 * Round a number to 3 decimal places (millisecond precision for timecodes).
 */
export function round3(n) {
  return Math.round(n * 1000) / 1000;
}
