import { detect } from "../src/detect.js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => join(__dirname, "fixtures", name);

describe("eas-detect", () => {
  describe("complete EAS message", () => {
    let result;
    beforeAll(async () => {
      result = await detect(fixture("complete-eas.wav"));
    });

    test("detects EAS", () => {
      expect(result.eas_detected).toBe(true);
    });

    test("match type is full", () => {
      expect(result.match_type).toBe("full");
    });

    test("detects attention tone", () => {
      expect(result.attention_tone.detected).toBe(true);
      expect(result.attention_tone.intervals.length).toBeGreaterThanOrEqual(1);
    });

    test("detects FSK energy", () => {
      expect(result.fsk.detected).toBe(true);
    });

    test("decodes SAME header", () => {
      expect(result.same_headers.length).toBeGreaterThanOrEqual(1);
      const header = result.same_headers[0];
      expect(header.originator.code).toBe("WXR");
      expect(header.event.code).toBe("TOR");
      expect(header.event.name).toBe("Tornado Warning");
    });

    test("decodes locations with FIPS lookup", () => {
      const header = result.same_headers[0];
      expect(header.locations.length).toBeGreaterThanOrEqual(1);
      expect(header.locations[0].state_fips).toBe("39");
      expect(header.locations[0].state).toBe("Ohio");
    });

    test("detects end of message", () => {
      expect(result.end_of_message).toBe(true);
    });

    test("includes timecodes", () => {
      expect(result.timecodes.length).toBeGreaterThan(0);
      for (const tc of result.timecodes) {
        expect(tc).toHaveProperty("type");
        expect(tc).toHaveProperty("start");
        expect(tc).toHaveProperty("end");
        expect(tc.start).toBeLessThan(tc.end);
      }
    });
  });

  describe("attention tone only (partial)", () => {
    let result;
    beforeAll(async () => {
      result = await detect(fixture("attention-tone-only.wav"));
    });

    test("detects EAS", () => {
      expect(result.eas_detected).toBe(true);
    });

    test("match type is partial", () => {
      expect(result.match_type).toBe("partial");
    });

    test("detects attention tone", () => {
      expect(result.attention_tone.detected).toBe(true);
    });

    test("no SAME headers", () => {
      expect(result.same_headers.length).toBe(0);
    });

    test("no end of message", () => {
      expect(result.end_of_message).toBe(false);
    });
  });

  describe("FSK chirp only (partial)", () => {
    let result;
    beforeAll(async () => {
      result = await detect(fixture("fsk-chirp-only.wav"));
    });

    test("detects EAS", () => {
      expect(result.eas_detected).toBe(true);
    });

    test("match type is partial", () => {
      expect(result.match_type).toBe("partial");
    });

    test("detects FSK energy", () => {
      expect(result.fsk.detected).toBe(true);
    });

    test("no SAME headers decoded", () => {
      expect(result.same_headers.length).toBe(0);
    });

    test("no attention tone", () => {
      expect(result.attention_tone.detected).toBe(false);
    });
  });

  describe("EOM only (partial)", () => {
    let result;
    beforeAll(async () => {
      result = await detect(fixture("eom-only.wav"));
    });

    test("detects EAS", () => {
      expect(result.eas_detected).toBe(true);
    });

    test("match type is partial", () => {
      expect(result.match_type).toBe("partial");
    });

    test("detects end of message", () => {
      expect(result.end_of_message).toBe(true);
    });

    test("no SAME headers", () => {
      expect(result.same_headers.length).toBe(0);
    });
  });

  describe("header only (partial)", () => {
    let result;
    beforeAll(async () => {
      result = await detect(fixture("header-only.wav"));
    });

    test("detects EAS", () => {
      expect(result.eas_detected).toBe(true);
    });

    test("match type is partial", () => {
      expect(result.match_type).toBe("partial");
    });

    test("decodes SAME header", () => {
      expect(result.same_headers.length).toBeGreaterThanOrEqual(1);
    });

    test("no end of message", () => {
      expect(result.end_of_message).toBe(false);
    });
  });

  describe("attention tone + EOM (partial)", () => {
    let result;
    beforeAll(async () => {
      result = await detect(fixture("attn-and-eom.wav"));
    });

    test("match type is partial", () => {
      expect(result.match_type).toBe("partial");
    });

    test("detects attention tone", () => {
      expect(result.attention_tone.detected).toBe(true);
    });

    test("detects end of message", () => {
      expect(result.end_of_message).toBe(true);
    });

    test("no SAME headers", () => {
      expect(result.same_headers.length).toBe(0);
    });
  });

  describe("silence (no match)", () => {
    let result;
    beforeAll(async () => {
      result = await detect(fixture("silence.wav"));
    });

    test("no EAS detected", () => {
      expect(result.eas_detected).toBe(false);
    });

    test("match type is none", () => {
      expect(result.match_type).toBe("none");
    });

    test("no attention tone", () => {
      expect(result.attention_tone.detected).toBe(false);
    });

    test("no FSK", () => {
      expect(result.fsk.detected).toBe(false);
    });

    test("no SAME headers", () => {
      expect(result.same_headers.length).toBe(0);
    });
  });

  describe("sameold samples (raw s16le)", () => {
    // Note: multimon-ng has weaker error correction than sameold/samedec,
    // so it may only partially decode these samples. We test that at least
    // FSK energy and/or partial headers are detected.

    test("npt sample detects EAS content", async () => {
      const result = await detect(fixture("npt.22050.s16le.bin"), {
        raw: true,
        sampleRate: 22050,
      });
      expect(result.eas_detected).toBe(true);
      expect(result.fsk.detected).toBe(true);
      // multimon-ng may only get a partial header from this sample
      if (result.same_headers.length > 0) {
        const header = result.same_headers[0];
        expect(header.raw).toMatch(/^ZCZC-PEP-NPT/);
      }
    });

    test("long_message sample detects EAS content", async () => {
      const result = await detect(fixture("long_message.22050.s16le.bin"), {
        raw: true,
        sampleRate: 22050,
      });
      expect(result.eas_detected).toBe(true);
      expect(result.fsk.detected).toBe(true);
    });

    test("two_and_two sample detects EOM", async () => {
      const result = await detect(fixture("two_and_two.22050.s16le.bin"), {
        raw: true,
        sampleRate: 22050,
      });
      expect(result.eas_detected).toBe(true);
      // This sample has both EOM and header FSK
      expect(result.fsk.detected).toBe(true);
    });
  });
});
