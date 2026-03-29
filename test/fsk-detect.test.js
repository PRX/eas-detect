import { detectFsk } from "../src/fsk-detect.js";

const SAMPLE_RATE = 22050;
const MARK_FREQ = 2083.3;
const SPACE_FREQ = 1562.5;
const BAUD_RATE = 520.83;
const SAMPLES_PER_BIT = Math.round(SAMPLE_RATE / BAUD_RATE);

function fskSignal(durationSec) {
  const n = Math.round(SAMPLE_RATE * durationSec);
  const samples = new Float64Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    // Alternate between mark and space at baud rate
    const bit = Math.floor(i / SAMPLES_PER_BIT) % 2;
    const freq = bit ? MARK_FREQ : SPACE_FREQ;
    const phaseInc = (2 * Math.PI * freq) / SAMPLE_RATE;
    samples[i] = 0.5 * Math.sin(phase);
    phase += phaseInc;
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

describe("detectFsk", () => {
  test("detects FSK energy in a mark/space signal", () => {
    const samples = fskSignal(0.5);
    const intervals = detectFsk(samples, SAMPLE_RATE);
    expect(intervals.length).toBeGreaterThanOrEqual(1);
  });

  test("returns empty array for silence", () => {
    const samples = new Float64Array(SAMPLE_RATE);
    const intervals = detectFsk(samples, SAMPLE_RATE);
    expect(intervals.length).toBe(0);
  });

  test("returns empty array for unrelated frequency", () => {
    const n = SAMPLE_RATE;
    const samples = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      samples[i] = 0.5 * Math.sin((2 * Math.PI * 440 * i) / SAMPLE_RATE);
    }
    const intervals = detectFsk(samples, SAMPLE_RATE);
    expect(intervals.length).toBe(0);
  });

  test("detects pure mark frequency", () => {
    const n = Math.round(SAMPLE_RATE * 0.2);
    const samples = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      samples[i] = 0.5 * Math.sin((2 * Math.PI * MARK_FREQ * i) / SAMPLE_RATE);
    }
    const intervals = detectFsk(samples, SAMPLE_RATE);
    expect(intervals.length).toBeGreaterThanOrEqual(1);
  });

  test("detects pure space frequency", () => {
    const n = Math.round(SAMPLE_RATE * 0.2);
    const samples = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      samples[i] = 0.5 * Math.sin((2 * Math.PI * SPACE_FREQ * i) / SAMPLE_RATE);
    }
    const intervals = detectFsk(samples, SAMPLE_RATE);
    expect(intervals.length).toBeGreaterThanOrEqual(1);
  });

  test("reports intervals with start and end times", () => {
    const silence = new Float64Array(SAMPLE_RATE);
    const fsk = fskSignal(0.5);
    const samples = concat(silence, fsk, silence);
    const intervals = detectFsk(samples, SAMPLE_RATE);
    expect(intervals.length).toBeGreaterThanOrEqual(1);
    expect(intervals[0].start).toBeCloseTo(1.0, 0);
    expect(intervals[0]).toHaveProperty("end");
    expect(intervals[0].end).toBeGreaterThan(intervals[0].start);
  });
});
