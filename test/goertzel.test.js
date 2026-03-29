import { goertzel } from "../src/goertzel.js";

const SAMPLE_RATE = 22050;

function sineWave(freq, durationSec, amplitude = 1.0) {
  const n = Math.round(SAMPLE_RATE * durationSec);
  const samples = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    samples[i] = amplitude * Math.sin((2 * Math.PI * freq * i) / SAMPLE_RATE);
  }
  return samples;
}

describe("goertzel", () => {
  test("detects energy at the target frequency", () => {
    const samples = sineWave(960, 0.1);
    const mag = goertzel(samples, SAMPLE_RATE, 960);
    expect(mag).toBeGreaterThan(0.01);
  });

  test("returns near-zero for a different frequency", () => {
    const samples = sineWave(960, 0.1);
    const mag = goertzel(samples, SAMPLE_RATE, 400);
    expect(mag).toBeLessThan(0.001);
  });

  test("returns near-zero for silence", () => {
    const samples = new Float64Array(2205);
    const mag = goertzel(samples, SAMPLE_RATE, 960);
    expect(mag).toBe(0);
  });

  test("magnitude scales with amplitude", () => {
    const loud = sineWave(853, 0.1, 1.0);
    const quiet = sineWave(853, 0.1, 0.25);
    const magLoud = goertzel(loud, SAMPLE_RATE, 853);
    const magQuiet = goertzel(quiet, SAMPLE_RATE, 853);
    // Magnitude squared scales with amplitude squared (16x for 4x amplitude)
    expect(magLoud / magQuiet).toBeCloseTo(16, 0);
  });

  test("distinguishes 853 Hz from 960 Hz", () => {
    const samples = sineWave(853, 0.1);
    const mag853 = goertzel(samples, SAMPLE_RATE, 853);
    const mag960 = goertzel(samples, SAMPLE_RATE, 960);
    expect(mag853).toBeGreaterThan(mag960 * 10);
  });

  test("detects both frequencies in a dual-tone signal", () => {
    const n = Math.round(SAMPLE_RATE * 0.1);
    const samples = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      samples[i] =
        0.5 * Math.sin((2 * Math.PI * 853 * i) / SAMPLE_RATE) +
        0.5 * Math.sin((2 * Math.PI * 960 * i) / SAMPLE_RATE);
    }
    const mag853 = goertzel(samples, SAMPLE_RATE, 853);
    const mag960 = goertzel(samples, SAMPLE_RATE, 960);
    expect(mag853).toBeGreaterThan(0.01);
    expect(mag960).toBeGreaterThan(0.01);
    // Both should be roughly equal since equal amplitude
    expect(mag853 / mag960).toBeCloseTo(1, 0);
  });
});
