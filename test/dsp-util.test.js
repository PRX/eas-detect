import { windowEnergy, round3, ENERGY_RATIO_THRESHOLD, SILENCE_THRESHOLD } from "../src/dsp-util.js";

describe("windowEnergy", () => {
  test("returns zero for silence", () => {
    expect(windowEnergy(new Float64Array(100))).toBe(0);
  });

  test("returns correct energy for a known signal", () => {
    // DC signal of amplitude 0.5: energy = 0.25
    const samples = new Float64Array(100).fill(0.5);
    expect(windowEnergy(samples)).toBeCloseTo(0.25);
  });

  test("returns 0.5 for a full-scale sine wave", () => {
    // RMS of sin(x) is 1/sqrt(2), so energy (RMS^2) is 0.5
    const n = 22050; // one full second for accuracy
    const samples = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      samples[i] = Math.sin((2 * Math.PI * 440 * i) / 22050);
    }
    expect(windowEnergy(samples)).toBeCloseTo(0.5, 2);
  });
});

describe("round3", () => {
  test("rounds to 3 decimal places", () => {
    expect(round3(1.23456)).toBe(1.235);
    expect(round3(0.1)).toBe(0.1);
    expect(round3(0)).toBe(0);
    expect(round3(99.9994)).toBe(99.999);
    expect(round3(99.9995)).toBe(100);
  });
});

describe("constants", () => {
  test("ENERGY_RATIO_THRESHOLD is 0.05", () => {
    expect(ENERGY_RATIO_THRESHOLD).toBe(0.05);
  });

  test("SILENCE_THRESHOLD is a small positive number", () => {
    expect(SILENCE_THRESHOLD).toBeGreaterThan(0);
    expect(SILENCE_THRESHOLD).toBeLessThan(0.001);
  });
});
