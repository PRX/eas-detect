/**
 * Detect EAS attention tone: 853 Hz and 960 Hz played simultaneously.
 *
 * Uses the Goertzel algorithm to efficiently measure energy at specific
 * frequencies in sliding windows across the audio.
 */

const FREQ_LOW = 853;
const FREQ_HIGH = 960;

// Minimum duration in seconds to count as an attention tone
const MIN_DURATION = 0.5;

// Goertzel magnitude threshold relative to window RMS — the attention tone
// frequencies should be significantly above the noise floor
const MAGNITUDE_THRESHOLD = 0.01;

// Analysis window: 50ms with 50% overlap
const WINDOW_MS = 50;

/**
 * Goertzel algorithm — compute magnitude of a single frequency bin.
 * More efficient than FFT when you only need a few frequencies.
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

  // Magnitude squared, normalized by N
  return (s1 * s1 + s2 * s2 - coeff * s1 * s2) / (N * N);
}

/**
 * Compute RMS energy of a sample window.
 */
function rms(samples) {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / samples.length);
}

/**
 * Detect attention tone intervals in audio samples.
 * Returns { detected: boolean, intervals: [{ start, end }] }
 */
export function detectAttentionTone(samples, sampleRate) {
  const windowSize = Math.round((WINDOW_MS / 1000) * sampleRate);
  const hopSize = Math.round(windowSize / 2);
  const intervals = [];

  let inTone = false;
  let toneStart = 0;

  for (let offset = 0; offset + windowSize <= samples.length; offset += hopSize) {
    const window = samples.subarray(offset, offset + windowSize);
    const windowRms = rms(window);

    // Skip silent windows
    if (windowRms < 0.001) {
      if (inTone) {
        const end = offset / sampleRate;
        if (end - toneStart >= MIN_DURATION) {
          intervals.push({ start: round3(toneStart), end: round3(end) });
        }
        inTone = false;
      }
      continue;
    }

    const mag853 = goertzel(window, sampleRate, FREQ_LOW);
    const mag960 = goertzel(window, sampleRate, FREQ_HIGH);

    // Both frequencies must be present with significant energy
    const bothPresent = mag853 > MAGNITUDE_THRESHOLD && mag960 > MAGNITUDE_THRESHOLD;

    if (bothPresent && !inTone) {
      inTone = true;
      toneStart = offset / sampleRate;
    } else if (!bothPresent && inTone) {
      const end = offset / sampleRate;
      if (end - toneStart >= MIN_DURATION) {
        intervals.push({ start: round3(toneStart), end: round3(end) });
      }
      inTone = false;
    }
  }

  // Close any open interval
  if (inTone) {
    const end = samples.length / sampleRate;
    if (end - toneStart >= MIN_DURATION) {
      intervals.push({ start: round3(toneStart), end: round3(end) });
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
