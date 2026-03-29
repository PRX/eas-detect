/**
 * Generalized Goertzel algorithm for single-frequency energy measurement.
 *
 * The Goertzel algorithm is a signal processing technique that efficiently
 * computes the energy (magnitude squared) at a single frequency in a block
 * of samples. It is equivalent to computing one bin of a DFT, but requires
 * only O(N) multiplications instead of O(N log N) for a full FFT.
 *
 * This implementation uses a non-integer normalized frequency, which allows
 * measuring energy at an exact target frequency rather than rounding to the
 * nearest FFT bin. This is important when the window size doesn't evenly
 * divide the sample rate at the target frequency — e.g., 853 Hz at 22050 Hz
 * with a 2205-sample window would round to ~860 Hz with standard Goertzel,
 * losing significant energy from the true 853 Hz signal.
 *
 * The algorithm maintains a second-order IIR filter state (two delay taps)
 * and processes each sample with a single multiply-accumulate. After all
 * samples are processed, the output magnitude is computed from the final
 * filter state.
 *
 * @param {Float64Array} samples - Audio samples to analyze
 * @param {number} sampleRate - Sample rate in Hz
 * @param {number} targetFreq - Frequency to measure in Hz
 * @returns {number} Normalized magnitude squared at the target frequency.
 *   The value is divided by N^2 so it scales consistently regardless of
 *   window size. For a pure sine wave at amplitude A, this returns ~A^2/4.
 */
export function goertzel(samples, sampleRate, targetFreq) {
  const numSamples = samples.length;

  // Angular frequency of the target, normalized to the sample rate.
  // This is the key difference from standard Goertzel: we use the exact
  // frequency rather than rounding to k = round(N * freq / sampleRate).
  const angularFreq = (2 * Math.PI * targetFreq) / sampleRate;

  // The filter coefficient is 2*cos(w), which drives the second-order
  // recursive computation. This is the only trig needed for the entire block.
  const filterCoeff = 2 * Math.cos(angularFreq);

  // Second-order IIR filter delay taps
  let current = 0; // s[n]
  let prev1 = 0; // s[n-1]
  let prev2 = 0; // s[n-2]

  // Process each sample through the recursive filter:
  //   s[n] = x[n] + coeff * s[n-1] - s[n-2]
  for (let i = 0; i < numSamples; i++) {
    current = samples[i] + filterCoeff * prev1 - prev2;
    prev2 = prev1;
    prev1 = current;
  }

  // Compute magnitude squared from the final filter state:
  //   |X(k)|^2 = s1^2 + s2^2 - coeff * s1 * s2
  // Normalized by N^2 for consistent scaling across window sizes.
  const magnitudeSquared =
    prev1 * prev1 + prev2 * prev2 - filterCoeff * prev1 * prev2;

  return magnitudeSquared / (numSamples * numSamples);
}
