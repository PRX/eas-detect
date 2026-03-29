/**
 * Decode SAME headers from raw PCM audio using multimon-ng.
 *
 * Expects a raw s16le 22050 Hz mono PCM file (as produced by readAudio).
 */

import { execFileSync } from "node:child_process";

/**
 * Run multimon-ng on a raw PCM file and extract SAME messages.
 * @param {string} rawPath - Path to s16le 22050 Hz mono raw PCM file
 * @returns {{ headers: string[], endOfMessage: boolean }}
 */
export function decodeSame(rawPath) {
  let output;

  try {
    output = execFileSync("multimon-ng", ["-t", "raw", "-a", "EAS", rawPath], {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (err) {
    // multimon-ng exits non-zero when it reaches EOF, which is normal
    output = err.stdout || "";
  }

  return parseSameOutput(output);
}

/**
 * Parse multimon-ng text output for EAS messages.
 * multimon-ng outputs lines like:
 *   EAS: ZCZC-WXR-TOR-039173+0030-1591829-KLST/NWS-
 *   EAS: NNNN
 */
function parseSameOutput(output) {
  const headers = [];
  let endOfMessage = false;

  for (const line of output.split("\n")) {
    const match = line.match(/^EAS:\s*(.+)$/);
    if (!match) continue;

    const message = match[1].trim();

    if (message === "NNNN") {
      endOfMessage = true;
    } else if (message.startsWith("ZCZC-")) {
      // Deduplicate — multimon-ng may output the same header multiple times
      // from the 3 repeated bursts
      if (!headers.includes(message)) {
        headers.push(message);
      }
    }
  }

  return { headers, endOfMessage };
}
