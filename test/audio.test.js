import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readAudio, SAMPLE_RATE } from "../src/audio.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => join(__dirname, "fixtures", name);

describe("readAudio", () => {
  test("SAMPLE_RATE is 22050", () => {
    expect(SAMPLE_RATE).toBe(22050);
  });

  test("reads a WAV file and returns samples at 22050 Hz", () => {
    const { samples, sampleRate } = readAudio(fixture("silence.wav"));
    expect(sampleRate).toBe(22050);
    expect(samples).toBeInstanceOf(Float64Array);
    expect(samples.length).toBeGreaterThan(0);
  });

  test("returns rawPath for non-raw input", () => {
    const { rawPath } = readAudio(fixture("silence.wav"));
    expect(rawPath).toMatch(/\.raw$/);
  });

  test("reads raw s16le PCM with explicit sample rate", () => {
    const { samples, sampleRate, rawPath } = readAudio(fixture("npt.22050.s16le.bin"), {
      raw: true,
      sampleRate: 22050,
    });
    expect(sampleRate).toBe(22050);
    expect(samples).toBeInstanceOf(Float64Array);
    expect(samples.length).toBeGreaterThan(0);
    // For raw input, rawPath is the original file
    expect(rawPath).toBe(fixture("npt.22050.s16le.bin"));
  });

  test("samples are normalized to [-1, 1]", () => {
    const { samples } = readAudio(fixture("attention-tone-only.wav"));
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < samples.length; i++) {
      if (samples[i] < min) min = samples[i];
      if (samples[i] > max) max = samples[i];
    }
    expect(min).toBeGreaterThanOrEqual(-1);
    expect(max).toBeLessThanOrEqual(1);
  });

  test("silence file has near-zero samples", () => {
    const { samples } = readAudio(fixture("silence.wav"));
    let maxAbs = 0;
    for (let i = 0; i < samples.length; i++) {
      if (Math.abs(samples[i]) > maxAbs) maxAbs = Math.abs(samples[i]);
    }
    expect(maxAbs).toBeLessThan(0.001);
  });
});
