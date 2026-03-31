#!/usr/bin/env node

/**
 * CLI entry point for eas-detect.
 *
 * Usage: eas-detect <audio-file> [--raw] [--sample-rate 22050] [--fsk-mode bandpass]
 */

import { detect } from "./src/detect.js";

const args = process.argv.slice(2);

if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
  console.error(`Usage: eas-detect <audio-file> [options]

Detect EAS (Emergency Alert System) tones and SAME messages in audio files.

Options:
  --raw              Input is raw signed 16-bit little-endian PCM
  --sample-rate N    Sample rate for raw input (default: 22050)
  --fsk-mode MODE    FSK detection mode (default: "default")
                       default   - energy-ratio with alternation validation
                       sensitive - bandpass filtering + correlation analysis
                                   (better for weak signals mixed with speech)
  --help, -h         Show this help

Output: JSON to stdout`);
  process.exit(args.includes("--help") || args.includes("-h") ? 0 : 1);
}

const filePath = args.find((a) => !a.startsWith("--"));
const raw = args.includes("--raw");
const srIdx = args.indexOf("--sample-rate");
const sampleRate = srIdx !== -1 ? parseInt(args[srIdx + 1], 10) : 22050;
const fskModeIdx = args.indexOf("--fsk-mode");
const fskMode = fskModeIdx !== -1 ? args[fskModeIdx + 1] : "default";

if (!filePath) {
  console.error("Error: no audio file specified");
  process.exit(1);
}

try {
  const result = await detect(filePath, { raw, sampleRate, fskMode });
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.error(JSON.stringify({ error: err.message }, null, 2));
  process.exit(1);
}
