import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readAudio } from "../src/audio.js";
import { decodeSame } from "../src/same-decode.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => join(__dirname, "fixtures", name);

describe("decodeSame", () => {
  test("decodes SAME header from complete EAS fixture", () => {
    const { rawPath } = readAudio(fixture("complete-eas.wav"));
    const result = decodeSame(rawPath);
    expect(result.headers.length).toBeGreaterThanOrEqual(1);
    expect(result.headers[0]).toMatch(/^ZCZC-WXR-TOR/);
  });

  test("detects end of message from complete EAS fixture", () => {
    const { rawPath } = readAudio(fixture("complete-eas.wav"));
    const result = decodeSame(rawPath);
    expect(result.endOfMessage).toBe(true);
  });

  test("detects EOM from eom-only fixture", () => {
    const { rawPath } = readAudio(fixture("eom-only.wav"));
    const result = decodeSame(rawPath);
    expect(result.endOfMessage).toBe(true);
    expect(result.headers.length).toBe(0);
  });

  test("returns empty results for silence", () => {
    const { rawPath } = readAudio(fixture("silence.wav"));
    const result = decodeSame(rawPath);
    expect(result.headers.length).toBe(0);
    expect(result.endOfMessage).toBe(false);
  });

  test("returns empty results for attention-tone-only fixture", () => {
    const { rawPath } = readAudio(fixture("attention-tone-only.wav"));
    const result = decodeSame(rawPath);
    expect(result.headers.length).toBe(0);
    expect(result.endOfMessage).toBe(false);
  });

  test("deduplicates repeated headers from 3-burst transmission", () => {
    const { rawPath } = readAudio(fixture("complete-eas.wav"));
    const result = decodeSame(rawPath);
    // The header is sent 3 times but should appear only once
    const uniqueHeaders = new Set(result.headers);
    expect(result.headers.length).toBe(uniqueHeaders.size);
  });
});
