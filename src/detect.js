/**
 * Core EAS detection orchestrator.
 *
 * Runs all detectors on an audio file and returns a unified result.
 */

import { detectAttentionTone } from "./attention-tone.js";
import { readAudio, SAMPLE_RATE } from "./audio.js";
import { parseSameHeader } from "./eas-parser.js";
import { detectFsk } from "./fsk-detect.js";
import { decodeSame } from "./same-decode.js";

// Intervals within this gap (seconds) are merged into one
const MERGE_GAP = 0.1;

/**
 * Detect EAS content in an audio file.
 *
 * @param {string} filePath - Path to the audio file
 * @param {object} [options]
 * @param {boolean} [options.raw=false] - Input is raw s16le PCM
 * @param {number} [options.sampleRate=22050] - Sample rate for raw input
 * @returns {object} Detection results as JSON-serializable object
 */
export async function detect(filePath, { raw = false, sampleRate = SAMPLE_RATE } = {}) {
  // Read audio into PCM samples for tone/FSK analysis
  const { samples, sampleRate: sr } = readAudio(filePath, { raw, sampleRate });
  const durationSeconds = Math.round((samples.length / sr) * 1000) / 1000;

  // Run detectors
  const toneIntervals = detectAttentionTone(samples, sr);
  const fskIntervals = detectFsk(samples, sr);
  const same = decodeSame(filePath, { raw, sampleRate });

  // Parse any decoded SAME headers
  const sameHeaders = same.headers.map(parseSameHeader);

  // Build unified timecodes — merge nearby intervals of the same type
  const allIntervals = [
    ...fskIntervals.map((i) => ({ type: "fsk", start: i.start, end: i.end })),
    ...toneIntervals,
  ];
  allIntervals.sort((a, b) => a.start - b.start);
  const timecodes = mergeIntervals(allIntervals);

  // Derive detection flags from merged timecodes
  const hasAttentionTone = timecodes.some(
    (t) => t.type === "attentionTone" || t.type === "tone960" || t.type === "tone853",
  );
  const hasFsk = timecodes.some((t) => t.type === "fsk");
  const hasHeader = sameHeaders.length > 0;
  const hasEom = same.endOfMessage;

  let matchType = "none";
  if (hasHeader && hasAttentionTone && hasEom) {
    matchType = "full";
  } else if (hasHeader || hasAttentionTone || hasEom || hasFsk) {
    matchType = "partial";
  }

  // Assign SAME headers to FSK intervals (headers come in the first FSK bursts)
  const fskTimecodes = timecodes.filter((t) => t.type === "fsk");
  if (sameHeaders.length > 0 && fskTimecodes.length > 0) {
    for (const header of sameHeaders) {
      header.timecode = {
        start: fskTimecodes[0].start,
        end: fskTimecodes[Math.min(2, fskTimecodes.length - 1)].end,
      };
    }
  }

  return {
    file: filePath,
    durationSeconds,
    easDetected: matchType !== "none",
    matchType,
    timecodes,
    sameHeaders,
    endOfMessage: hasEom,
  };
}

/**
 * Merge intervals of the same type that are within MERGE_GAP seconds of each other.
 */
function mergeIntervals(sorted) {
  if (sorted.length === 0) return [];

  const merged = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = sorted[i];

    if (curr.type === prev.type && curr.start - prev.end <= MERGE_GAP) {
      // Extend the previous interval
      prev.end = Math.max(prev.end, curr.end);
    } else {
      merged.push({ ...curr });
    }
  }

  return merged;
}

/**
 * Detect EAS content from a Buffer (for Lambda / programmatic use).
 */
export async function detectBuffer(buffer, extension = ".wav") {
  const { mkdtempSync, writeFileSync, unlinkSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");

  const dir = mkdtempSync(join(tmpdir(), "eas-"));
  const tmpFile = join(dir, `input${extension}`);
  writeFileSync(tmpFile, buffer);

  try {
    return detect(tmpFile);
  } finally {
    try { unlinkSync(tmpFile); } catch {}
  }
}
