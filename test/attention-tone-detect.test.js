import { detectAttentionTone } from "../src/attention-tone-detect.js";

const SAMPLE_RATE = 22050;

function sineWave(freq, durationSec, amplitude = 0.5) {
  const n = Math.round(SAMPLE_RATE * durationSec);
  const samples = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    samples[i] = amplitude * Math.sin((2 * Math.PI * freq * i) / SAMPLE_RATE);
  }
  return samples;
}

function dualTone(durationSec, amplitude = 0.4) {
  const n = Math.round(SAMPLE_RATE * durationSec);
  const samples = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    samples[i] =
      amplitude * Math.sin((2 * Math.PI * 853 * i) / SAMPLE_RATE) +
      amplitude * Math.sin((2 * Math.PI * 960 * i) / SAMPLE_RATE);
  }
  return samples;
}

function concat(...arrays) {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const result = new Float64Array(total);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

describe("detectAttentionTone", () => {
  test("detects dual-tone (853+960 Hz) as attentionTone", () => {
    const samples = dualTone(2);
    const intervals = detectAttentionTone(samples, SAMPLE_RATE);
    expect(intervals.length).toBe(1);
    expect(intervals[0].type).toBe("attentionTone");
  });

  test("detects 960 Hz alone as tone960", () => {
    const samples = sineWave(960, 2);
    const intervals = detectAttentionTone(samples, SAMPLE_RATE);
    expect(intervals.length).toBe(1);
    expect(intervals[0].type).toBe("tone960");
  });

  test("detects 853 Hz alone as tone853", () => {
    const samples = sineWave(853, 2);
    const intervals = detectAttentionTone(samples, SAMPLE_RATE);
    expect(intervals.length).toBe(1);
    expect(intervals[0].type).toBe("tone853");
  });

  test("returns empty array for silence", () => {
    const samples = new Float64Array(SAMPLE_RATE * 2);
    const intervals = detectAttentionTone(samples, SAMPLE_RATE);
    expect(intervals.length).toBe(0);
  });

  test("returns empty array for unrelated frequency", () => {
    const samples = sineWave(440, 2);
    const intervals = detectAttentionTone(samples, SAMPLE_RATE);
    expect(intervals.length).toBe(0);
  });

  test("ignores tones shorter than minimum duration", () => {
    // 0.2 seconds is below the 0.5s minimum
    const samples = concat(
      new Float64Array(SAMPLE_RATE),
      dualTone(0.2),
      new Float64Array(SAMPLE_RATE),
    );
    const intervals = detectAttentionTone(samples, SAMPLE_RATE);
    expect(intervals.length).toBe(0);
  });

  test("reports correct start and end times", () => {
    const silence = new Float64Array(SAMPLE_RATE); // 1 second
    const tone = dualTone(3);
    const samples = concat(silence, tone, silence);
    const intervals = detectAttentionTone(samples, SAMPLE_RATE);
    expect(intervals.length).toBe(1);
    expect(intervals[0].start).toBeCloseTo(1.0, 0);
    expect(intervals[0].end).toBeCloseTo(4.0, 0);
  });

  test("detects multiple separate tone intervals", () => {
    const silence = new Float64Array(SAMPLE_RATE * 2);
    const tone = dualTone(1);
    const samples = concat(tone, silence, tone);
    const intervals = detectAttentionTone(samples, SAMPLE_RATE);
    expect(intervals.length).toBe(2);
  });
});
