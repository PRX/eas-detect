import { detect } from "../src/detect.js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => join(__dirname, "fixtures", name);

const hasToneType = (timecodes, type) => timecodes.some((t) => t.type === type);
const hasFsk = (timecodes) => hasToneType(timecodes, "fsk");
const hasAttentionTone = (timecodes) =>
  hasToneType(timecodes, "attentionTone") ||
  hasToneType(timecodes, "tone960") ||
  hasToneType(timecodes, "tone853");

describe("eas-detect", () => {
  describe("complete EAS message", () => {
    let result;
    beforeAll(async () => {
      result = await detect(fixture("complete-eas.wav"));
    });

    test("detects EAS", () => {
      expect(result.easDetected).toBe(true);
    });

    test("match type is full", () => {
      expect(result.matchType).toBe("full");
    });

    test("detects attention tone in timecodes", () => {
      expect(hasAttentionTone(result.timecodes)).toBe(true);
    });

    test("detects FSK energy in timecodes", () => {
      expect(hasFsk(result.timecodes)).toBe(true);
    });

    test("decodes SAME header", () => {
      expect(result.sameHeaders.length).toBeGreaterThanOrEqual(1);
      const header = result.sameHeaders[0];
      expect(header.originator.code).toBe("WXR");
      expect(header.event.code).toBe("TOR");
      expect(header.event.name).toBe("Tornado Warning");
    });

    test("decodes locations with FIPS lookup", () => {
      const header = result.sameHeaders[0];
      expect(header.locations.length).toBeGreaterThanOrEqual(1);
      expect(header.locations[0].stateFips).toBe("39");
      expect(header.locations[0].state).toBe("Ohio");
    });

    test("detects end of message", () => {
      expect(result.endOfMessage).toBe(true);
    });

    test("timecodes are chronological with valid structure", () => {
      expect(result.timecodes.length).toBeGreaterThan(0);
      for (let i = 0; i < result.timecodes.length; i++) {
        const tc = result.timecodes[i];
        expect(tc).toHaveProperty("type");
        expect(tc).toHaveProperty("start");
        expect(tc).toHaveProperty("end");
        expect(tc.start).toBeLessThan(tc.end);
        if (i > 0) {
          expect(tc.start).toBeGreaterThanOrEqual(result.timecodes[i - 1].start);
        }
      }
    });

    test("nearby intervals are merged", () => {
      // FSK bursts separated by <0.1s should be merged
      const fskTimecodes = result.timecodes.filter((t) => t.type === "fsk");
      for (let i = 1; i < fskTimecodes.length; i++) {
        const gap = fskTimecodes[i].start - fskTimecodes[i - 1].end;
        expect(gap).toBeGreaterThan(0.1);
      }
    });

    test("no redundant top-level fsk or attentionTone fields", () => {
      expect(result).not.toHaveProperty("fsk");
      expect(result).not.toHaveProperty("attentionTone");
    });
  });

  describe("attention tone only (partial)", () => {
    let result;
    beforeAll(async () => {
      result = await detect(fixture("attention-tone-only.wav"));
    });

    test("detects EAS", () => {
      expect(result.easDetected).toBe(true);
    });

    test("match type is partial", () => {
      expect(result.matchType).toBe("partial");
    });

    test("detects attention tone in timecodes", () => {
      expect(hasAttentionTone(result.timecodes)).toBe(true);
    });

    test("attention tone type is attentionTone (dual 853+960)", () => {
      expect(hasToneType(result.timecodes, "attentionTone")).toBe(true);
    });

    test("no SAME headers", () => {
      expect(result.sameHeaders.length).toBe(0);
    });

    test("no end of message", () => {
      expect(result.endOfMessage).toBe(false);
    });
  });

  describe("FSK chirp only (partial)", () => {
    let result;
    beforeAll(async () => {
      result = await detect(fixture("fsk-chirp-only.wav"));
    });

    test("detects EAS", () => {
      expect(result.easDetected).toBe(true);
    });

    test("match type is partial", () => {
      expect(result.matchType).toBe("partial");
    });

    test("detects FSK energy in timecodes", () => {
      expect(hasFsk(result.timecodes)).toBe(true);
    });

    test("no SAME headers decoded", () => {
      expect(result.sameHeaders.length).toBe(0);
    });

    test("no attention tone", () => {
      expect(hasAttentionTone(result.timecodes)).toBe(false);
    });
  });

  describe("EOM only (partial)", () => {
    let result;
    beforeAll(async () => {
      result = await detect(fixture("eom-only.wav"));
    });

    test("detects EAS", () => {
      expect(result.easDetected).toBe(true);
    });

    test("match type is partial", () => {
      expect(result.matchType).toBe("partial");
    });

    test("detects end of message", () => {
      expect(result.endOfMessage).toBe(true);
    });

    test("no SAME headers", () => {
      expect(result.sameHeaders.length).toBe(0);
    });
  });

  describe("header only (partial)", () => {
    let result;
    beforeAll(async () => {
      result = await detect(fixture("header-only.wav"));
    });

    test("detects EAS", () => {
      expect(result.easDetected).toBe(true);
    });

    test("match type is partial", () => {
      expect(result.matchType).toBe("partial");
    });

    test("decodes SAME header", () => {
      expect(result.sameHeaders.length).toBeGreaterThanOrEqual(1);
    });

    test("no end of message", () => {
      expect(result.endOfMessage).toBe(false);
    });
  });

  describe("attention tone + EOM (partial)", () => {
    let result;
    beforeAll(async () => {
      result = await detect(fixture("attn-and-eom.wav"));
    });

    test("match type is partial", () => {
      expect(result.matchType).toBe("partial");
    });

    test("detects attention tone in timecodes", () => {
      expect(hasAttentionTone(result.timecodes)).toBe(true);
    });

    test("detects end of message", () => {
      expect(result.endOfMessage).toBe(true);
    });

    test("no SAME headers", () => {
      expect(result.sameHeaders.length).toBe(0);
    });
  });

  describe("960 Hz tone only (partial)", () => {
    let result;
    beforeAll(async () => {
      result = await detect(fixture("tone-960-only.wav"));
    });

    test("detects EAS", () => {
      expect(result.easDetected).toBe(true);
    });

    test("match type is partial", () => {
      expect(result.matchType).toBe("partial");
    });

    test("detects tone960 type in timecodes", () => {
      expect(hasToneType(result.timecodes, "tone960")).toBe(true);
    });

    test("does not detect attentionTone (dual) type", () => {
      expect(hasToneType(result.timecodes, "attentionTone")).toBe(false);
    });
  });

  describe("853 Hz tone only (partial)", () => {
    let result;
    beforeAll(async () => {
      result = await detect(fixture("tone-853-only.wav"));
    });

    test("detects EAS", () => {
      expect(result.easDetected).toBe(true);
    });

    test("match type is partial", () => {
      expect(result.matchType).toBe("partial");
    });

    test("detects tone853 type in timecodes", () => {
      expect(hasToneType(result.timecodes, "tone853")).toBe(true);
    });

    test("does not detect attentionTone (dual) type", () => {
      expect(hasToneType(result.timecodes, "attentionTone")).toBe(false);
    });
  });

  describe("silence (no match)", () => {
    let result;
    beforeAll(async () => {
      result = await detect(fixture("silence.wav"));
    });

    test("no EAS detected", () => {
      expect(result.easDetected).toBe(false);
    });

    test("match type is none", () => {
      expect(result.matchType).toBe("none");
    });

    test("no timecodes", () => {
      expect(result.timecodes.length).toBe(0);
    });

    test("no SAME headers", () => {
      expect(result.sameHeaders.length).toBe(0);
    });
  });

  describe("sameold samples (raw s16le)", () => {
    test("npt sample detects EAS content", async () => {
      const result = await detect(fixture("npt.22050.s16le.bin"), {
        raw: true,
        sampleRate: 22050,
      });
      expect(result.easDetected).toBe(true);
      expect(hasFsk(result.timecodes)).toBe(true);
      if (result.sameHeaders.length > 0) {
        const header = result.sameHeaders[0];
        expect(header.raw).toMatch(/^ZCZC-PEP-NPT/);
      }
    });

    test("long_message sample detects EAS content", async () => {
      const result = await detect(fixture("long_message.22050.s16le.bin"), {
        raw: true,
        sampleRate: 22050,
      });
      expect(result.easDetected).toBe(true);
      expect(hasFsk(result.timecodes)).toBe(true);
    });

    test("two_and_two sample detects EOM", async () => {
      const result = await detect(fixture("two_and_two.22050.s16le.bin"), {
        raw: true,
        sampleRate: 22050,
      });
      expect(result.easDetected).toBe(true);
      expect(hasFsk(result.timecodes)).toBe(true);
    });
  });
});
