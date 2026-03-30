import { execFileSync } from "node:child_process";
import { readFileSync, unlinkSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const SAMPLE_RATE = 22050;

/**
 * Read an audio file and return mono PCM samples as a Float64Array at 22050 Hz.
 * Uses sox for format conversion. Also accepts raw s16le PCM if `raw` option is set.
 *
 * For non-raw input, sox writes to a temp raw file allowing files of any length
 * to be processed. The temp file path is returned as `rawPath` so downstream
 * consumers (e.g., multimon-ng) can reuse it without re-converting.
 *
 * @returns {{ samples: Float64Array, sampleRate: number, rawPath: string }}
 *   rawPath is the path to the s16le 22050 Hz mono raw PCM file. For raw input
 *   this is the original filePath; for non-raw input it's a temp file that the
 *   caller is responsible for cleaning up.
 */
export function readAudio(filePath, { raw = false, sampleRate = SAMPLE_RATE } = {}) {
  let buf;
  let rawPath;

  if (raw) {
    buf = readFileSync(filePath);
    rawPath = filePath;
  } else {
    const dir = mkdtempSync(join(tmpdir(), "eas-"));
    rawPath = join(dir, "audio.raw");

    execFileSync("sox", [
      filePath,
      "-t", "raw",
      "-e", "signed-integer",
      "-b", "16",
      "-r", String(sampleRate),
      "-c", "1",
      rawPath,
    ]);
    buf = readFileSync(rawPath);
  }

  // Convert s16le buffer to Float64Array normalized to [-1, 1]
  const sampleCount = buf.length / 2;
  const samples = new Float64Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    samples[i] = buf.readInt16LE(i * 2) / 32768;
  }

  return { samples, sampleRate, rawPath };
}

/**
 * Apply a sox bandpass filter to a raw PCM file and return filtered samples.
 * Used to isolate EAS frequency bands before energy-ratio analysis, improving
 * detection of tones buried under speech or music.
 *
 * @param {string} rawPath - Path to s16le 22050 Hz mono raw PCM file
 * @param {number} lowFreq - Lower edge of the bandpass filter in Hz
 * @param {number} highFreq - Upper edge of the bandpass filter in Hz
 * @param {number} [sampleRate=SAMPLE_RATE] - Sample rate of the raw file
 * @returns {Float64Array} Filtered samples normalized to [-1, 1]
 */
export function bandpassFilter(rawPath, lowFreq, highFreq, sampleRate = SAMPLE_RATE) {
  const dir = mkdtempSync(join(tmpdir(), "eas-bp-"));
  const filteredPath = join(dir, "filtered.raw");

  try {
    execFileSync("sox", [
      "-t", "raw", "-e", "signed-integer", "-b", "16", "-r", String(sampleRate), "-c", "1",
      rawPath,
      "-t", "raw", "-e", "signed-integer", "-b", "16", "-r", String(sampleRate), "-c", "1",
      filteredPath,
      "sinc", `${lowFreq}-${highFreq}`,
    ]);

    const buf = readFileSync(filteredPath);
    const sampleCount = buf.length / 2;
    const samples = new Float64Array(sampleCount);
    for (let i = 0; i < sampleCount; i++) {
      samples[i] = buf.readInt16LE(i * 2) / 32768;
    }
    return samples;
  } finally {
    try { unlinkSync(filteredPath); } catch {}
  }
}

export { SAMPLE_RATE };
