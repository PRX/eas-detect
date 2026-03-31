#!/usr/bin/env node

/**
 * Generate EAS test audio fixtures as WAV files.
 *
 * Creates test files for:
 * - Complete EAS message (header x3 + attention tone + EOM x3)
 * - Attention tone only
 * - FSK chirp only (preamble + partial header)
 * - EOM only (NNNN)
 * - Silence (no EAS content)
 *
 * Also downloads sameold sample files if not present.
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "fixtures");

const SAMPLE_RATE = 22050;
const MARK_FREQ = 2083.3;
const SPACE_FREQ = 1562.5;
const BAUD_RATE = 520.83;
const SAMPLES_PER_BIT = Math.round(SAMPLE_RATE / BAUD_RATE);

const ATTN_FREQ_LOW = 853;
const ATTN_FREQ_HIGH = 960;

if (!existsSync(FIXTURES_DIR)) {
  mkdirSync(FIXTURES_DIR, { recursive: true });
}

// --- WAV writing ---

function writeWav(filePath, samples) {
  const numSamples = samples.length;
  const dataSize = numSamples * 2; // 16-bit
  const fileSize = 44 + dataSize;
  const buf = Buffer.alloc(fileSize);

  // RIFF header
  buf.write("RIFF", 0);
  buf.writeUInt32LE(fileSize - 8, 4);
  buf.write("WAVE", 8);

  // fmt chunk
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); // chunk size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample

  // data chunk
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }

  writeFileSync(filePath, buf);
  console.log(`  Generated: ${filePath} (${(numSamples / SAMPLE_RATE).toFixed(1)}s)`);
}

// --- Signal generation ---

function silence(durationSec) {
  return new Float64Array(Math.round(SAMPLE_RATE * durationSec));
}

function sineWave(freq, durationSec, amplitude = 0.5) {
  const n = Math.round(SAMPLE_RATE * durationSec);
  const samples = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    samples[i] = amplitude * Math.sin((2 * Math.PI * freq * i) / SAMPLE_RATE);
  }
  return samples;
}

function attentionTone(durationSec) {
  const n = Math.round(SAMPLE_RATE * durationSec);
  const samples = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    samples[i] =
      0.4 * Math.sin((2 * Math.PI * ATTN_FREQ_LOW * i) / SAMPLE_RATE) +
      0.4 * Math.sin((2 * Math.PI * ATTN_FREQ_HIGH * i) / SAMPLE_RATE);
  }
  return samples;
}

/**
 * Encode bytes as FSK with continuous phase.
 * Returns Float64Array of samples. Phase carries across all bytes/bits.
 */
function fskBytes(bytes) {
  const totalBits = bytes.length * 8;
  const samples = new Float64Array(totalBits * SAMPLES_PER_BIT);
  let phase = 0;
  let sampleIdx = 0;

  for (const byte of bytes) {
    for (let bit = 0; bit < 8; bit++) {
      const freq = (byte >> bit) & 1 ? MARK_FREQ : SPACE_FREQ;
      const phaseInc = (2 * Math.PI * freq) / SAMPLE_RATE;
      for (let j = 0; j < SAMPLES_PER_BIT; j++) {
        samples[sampleIdx++] = 0.5 * Math.sin(phase);
        phase += phaseInc;
      }
    }
  }

  return samples;
}

// /** Encode a single byte as FSK */
// function fskByte(byte) {
//   return fskBytes([byte]);
// }

// /** Encode the 16-byte 0xAB preamble */
// function fskPreamble() {
//   return fskBytes(new Array(16).fill(0xab));
// }

/** Encode a string as FSK bytes (preamble + ASCII chars) with continuous phase */
function fskString(str) {
  const bytes = new Array(16).fill(0xab); // preamble
  for (let i = 0; i < str.length; i++) {
    bytes.push(str.charCodeAt(i));
  }
  return fskBytes(bytes);
}

/** Encode a complete SAME header (3 bursts with 1s silence between) */
function sameHeader(headerStr) {
  return concat([
    fskString(headerStr),
    silence(1),
    fskString(headerStr),
    silence(1),
    fskString(headerStr),
  ]);
}

/** Encode EOM (NNNN, 3 bursts) */
function sameEom() {
  return concat([fskString("NNNN"), silence(1), fskString("NNNN"), silence(1), fskString("NNNN")]);
}

function concat(arrays) {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const result = new Float64Array(total);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

// --- Generate fixtures ---

console.log("Generating EAS test fixtures...\n");

const TEST_HEADER = "ZCZC-WXR-TOR-039173-039051+0030-1591829-KLST/NWS-";

// 1. Complete EAS message
writeWav(
  join(FIXTURES_DIR, "complete-eas.wav"),
  concat([
    silence(0.5),
    sameHeader(TEST_HEADER),
    silence(1),
    attentionTone(8),
    silence(1),
    sameEom(),
    silence(0.5),
  ]),
);

// 2. Attention tone only
writeWav(
  join(FIXTURES_DIR, "attention-tone-only.wav"),
  concat([silence(0.5), attentionTone(10), silence(0.5)]),
);

// 3. FSK chirp only (preamble + ZCZC start, not enough for full SAME decode)
writeWav(
  join(FIXTURES_DIR, "fsk-chirp-only.wav"),
  concat([silence(0.5), fskString("ZCZC-WXR"), silence(0.5)]),
);

// 4. EOM only (NNNN)
writeWav(join(FIXTURES_DIR, "eom-only.wav"), concat([silence(0.5), sameEom(), silence(0.5)]));

// 5. Silence
writeWav(join(FIXTURES_DIR, "silence.wav"), silence(5));

// 6. Header only (no attention tone, no EOM)
writeWav(
  join(FIXTURES_DIR, "header-only.wav"),
  concat([silence(0.5), sameHeader(TEST_HEADER), silence(0.5)]),
);

// 7. Attention tone + EOM (no header)
writeWav(
  join(FIXTURES_DIR, "attn-and-eom.wav"),
  concat([silence(0.5), attentionTone(8), silence(1), sameEom(), silence(0.5)]),
);

// 8. 960 Hz tone only (no 853 Hz)
writeWav(
  join(FIXTURES_DIR, "tone-960-only.wav"),
  concat([silence(0.5), sineWave(960, 5, 0.5), silence(0.5)]),
);

// 9. 853 Hz tone only (no 960 Hz)
writeWav(
  join(FIXTURES_DIR, "tone-853-only.wav"),
  concat([silence(0.5), sineWave(853, 5, 0.5), silence(0.5)]),
);

// --- Download sameold samples ---

console.log("\nDownloading sameold sample files...");

const SAMEOLD_BASE = "https://raw.githubusercontent.com/cbs228/sameold/develop/sample";
const SAMEOLD_FILES = [
  "npt.22050.s16le.bin",
  "long_message.22050.s16le.bin",
  "two_and_two.22050.s16le.bin",
];

for (const file of SAMEOLD_FILES) {
  const dest = join(FIXTURES_DIR, file);
  if (existsSync(dest)) {
    console.log(`  Already exists: ${file}`);
    continue;
  }
  try {
    execSync(`curl -sL "${SAMEOLD_BASE}/${file}" -o "${dest}"`);
    console.log(`  Downloaded: ${file}`);
  } catch (err) {
    console.error(`  Failed to download ${file}: ${err.message}`);
  }
}

console.log("\nDone.");
