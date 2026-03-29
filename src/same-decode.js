/**
 * Decode SAME headers from audio using multimon-ng.
 *
 * Pipes audio through sox → multimon-ng and parses the text output
 * for SAME header strings and EOM markers.
 */

import { execFileSync, execSync } from "node:child_process";
import { existsSync } from "node:fs";

/**
 * Run multimon-ng on an audio file and extract SAME messages.
 * Returns { headers: string[], endOfMessage: boolean }
 */
export function decodeSame(filePath, { raw = false, sampleRate = 22050 } = {}) {
  const soxArgs = raw
    ? ["-t", "raw", "-e", "signed-integer", "-b", "16", "-r", String(sampleRate), "-c", "1", filePath]
    : [filePath];

  // sox input → s16le 22050 mono raw → multimon-ng EAS decoder
  const command = buildCommand(soxArgs);
  let output;

  try {
    output = execSync(command, {
      maxBuffer: 10 * 1024 * 1024,
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
 * Build the sox | multimon-ng pipeline command.
 */
function buildCommand(soxArgs) {
  const sox = [
    "sox",
    ...soxArgs,
    "-t", "raw",
    "-e", "signed-integer",
    "-b", "16",
    "-r", "22050",
    "-c", "1",
    "-",
  ].map(shellEscape).join(" ");

  return `${sox} | multimon-ng -t raw -a EAS -`;
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

function shellEscape(arg) {
  if (/^[a-zA-Z0-9_./:=+-]+$/.test(arg)) return arg;
  return `'${arg.replace(/'/g, "'\\''")}'`;
}
