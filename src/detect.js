/**
 * Core EAS detection orchestrator.
 *
 * Runs all detectors on an audio file and returns a unified result.
 */

import { readAudio, readAudioBuffer, SAMPLE_RATE } from "./audio.js";
import { detectAttentionTone } from "./attention-tone.js";
import { detectFsk } from "./fsk-detect.js";
import { decodeSame } from "./same-decode.js";
import { parseSameHeader } from "./eas-parser.js";

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
  const attentionTone = detectAttentionTone(samples, sr);
  const fsk = detectFsk(samples, sr);
  const same = decodeSame(filePath, { raw, sampleRate });

  // Parse any decoded SAME headers
  const sameHeaders = same.headers.map(parseSameHeader);

  // Determine match type
  const hasHeader = sameHeaders.length > 0;
  const hasAttentionTone = attentionTone.detected;
  const hasEom = same.endOfMessage;
  const hasFsk = fsk.detected;

  let matchType = "none";
  if (hasHeader && hasAttentionTone && hasEom) {
    matchType = "full";
  } else if (hasHeader || hasAttentionTone || hasEom || hasFsk) {
    matchType = "partial";
  }

  // Build chronological timecodes for all detected EAS events
  const timecodes = buildTimecodes(attentionTone, fsk, sameHeaders, hasEom);

  return {
    file: filePath,
    duration_seconds: durationSeconds,
    eas_detected: matchType !== "none",
    match_type: matchType,
    timecodes,
    attention_tone: attentionTone,
    fsk,
    same_headers: sameHeaders,
    end_of_message: hasEom,
  };
}

/**
 * Build a chronological list of all EAS events with their timecodes.
 * Correlates SAME headers to their FSK intervals by position.
 */
function buildTimecodes(attentionTone, fsk, sameHeaders, hasEom) {
  const events = [];

  // FSK intervals — label each one. SAME headers map to early FSK intervals,
  // EOM maps to late FSK intervals (after the attention tone).
  for (const interval of fsk.intervals) {
    events.push({
      type: "fsk",
      start: interval.start,
      end: interval.end,
    });
  }

  for (const interval of attentionTone.intervals) {
    events.push({
      type: "attention_tone",
      start: interval.start,
      end: interval.end,
    });
  }

  // Assign SAME headers to FSK intervals (headers come in the first FSK bursts)
  if (sameHeaders.length > 0 && fsk.intervals.length > 0) {
    for (const header of sameHeaders) {
      // Find the first FSK interval — that's where the header starts
      header.timecode = {
        start: fsk.intervals[0].start,
        end: fsk.intervals[Math.min(2, fsk.intervals.length - 1)].end,
      };
    }
  }

  // Sort chronologically
  events.sort((a, b) => a.start - b.start);

  return events;
}

/**
 * Detect EAS content from a Buffer (for Lambda / programmatic use).
 */
export async function detectBuffer(buffer, extension = ".wav") {
  const { samples, sampleRate } = readAudioBuffer(buffer, extension);
  // Write to temp, run same-decode, etc. — delegate to file-based detect
  // For now, use the buffer helper from audio.js
  const { mkdtempSync, writeFileSync, unlinkSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");

  const dir = mkdtempSync(join(tmpdir(), "eas-"));
  const tmpFile = join(dir, `input${extension}`);
  writeFileSync(tmpFile, buffer);

  try {
    return await detect(tmpFile);
  } finally {
    try { unlinkSync(tmpFile); } catch {}
  }
}
