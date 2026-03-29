import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const SAMPLE_RATE = 22050;

/**
 * Read an audio file and return mono PCM samples as a Float64Array at 22050 Hz.
 * Uses sox for format conversion. Also accepts raw s16le PCM if `raw` option is set.
 */
export function readAudio(filePath, { raw = false, sampleRate = SAMPLE_RATE } = {}) {
  let buf;

  if (raw) {
    // Raw signed 16-bit little-endian PCM at the given sample rate
    buf = readFileSync(filePath);
  } else {
    // Use sox to convert any format to s16le mono at target sample rate
    buf = execFileSync("sox", [
      filePath,
      "-t", "raw",
      "-e", "signed-integer",
      "-b", "16",
      "-r", String(sampleRate),
      "-c", "1",
      "-",
    ], { maxBuffer: 100 * 1024 * 1024 });
  }

  // Convert s16le buffer to Float64Array normalized to [-1, 1]
  const sampleCount = buf.length / 2;
  const samples = new Float64Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    samples[i] = buf.readInt16LE(i * 2) / 32768;
  }

  return { samples, sampleRate };
}

export { SAMPLE_RATE };
