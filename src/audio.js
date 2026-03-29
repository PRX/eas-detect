import { execFileSync } from "node:child_process";
import { readFileSync, unlinkSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const SAMPLE_RATE = 22050;

/**
 * Read an audio file and return mono PCM samples as a Float64Array at 22050 Hz.
 * Uses sox for format conversion. Also accepts raw s16le PCM if `raw` option is set.
 *
 * For non-raw input, sox writes to a temp file allowing files of any length to be processed.
 */
export function readAudio(filePath, { raw = false, sampleRate = SAMPLE_RATE } = {}) {
  let buf;

  if (raw) {
    // Raw signed 16-bit little-endian PCM at the given sample rate
    buf = readFileSync(filePath);
  } else {
    // Use sox to convert to a temp raw file — no buffer size limit
    const dir = mkdtempSync(join(tmpdir(), "eas-"));
    const tmpFile = join(dir, "audio.raw");

    try {
      execFileSync("sox", [
        filePath,
        "-t", "raw",
        "-e", "signed-integer",
        "-b", "16",
        "-r", String(sampleRate),
        "-c", "1",
        tmpFile,
      ]);
      buf = readFileSync(tmpFile);
    } finally {
      try { unlinkSync(tmpFile); } catch {}
    }
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
