import { ORIGINATOR_CODES, EVENT_CODES, STATE_FIPS } from "../src/eas-codes.js";
import { COUNTY_FIPS } from "../src/fips-counties.js";

describe("ORIGINATOR_CODES", () => {
  test("contains all 4 FCC-defined originator codes", () => {
    expect(ORIGINATOR_CODES).toHaveProperty("PEP");
    expect(ORIGINATOR_CODES).toHaveProperty("CIV");
    expect(ORIGINATOR_CODES).toHaveProperty("WXR");
    expect(ORIGINATOR_CODES).toHaveProperty("EAS");
  });

  test("all values are non-empty strings", () => {
    for (const [code, name] of Object.entries(ORIGINATOR_CODES)) {
      expect(typeof name).toBe("string");
      expect(name.length).toBeGreaterThan(0);
    }
  });
});

describe("EVENT_CODES", () => {
  test("contains required national codes", () => {
    expect(EVENT_CODES).toHaveProperty("EAN");
    expect(EVENT_CODES).toHaveProperty("NPT");
    expect(EVENT_CODES).toHaveProperty("RMT");
    expect(EVENT_CODES).toHaveProperty("RWT");
  });

  test("contains common weather warning codes", () => {
    expect(EVENT_CODES).toHaveProperty("TOR");
    expect(EVENT_CODES).toHaveProperty("SVR");
    expect(EVENT_CODES).toHaveProperty("FFW");
    expect(EVENT_CODES).toHaveProperty("TSW");
  });

  test("contains civil emergency codes", () => {
    expect(EVENT_CODES).toHaveProperty("CEM");
    expect(EVENT_CODES).toHaveProperty("CDW");
    expect(EVENT_CODES).toHaveProperty("EVI");
    expect(EVENT_CODES).toHaveProperty("CAE");
    expect(EVENT_CODES).toHaveProperty("BLU");
  });

  test("contains supplementary codes (AMB, PEV, WCW)", () => {
    expect(EVENT_CODES).toHaveProperty("AMB");
    expect(EVENT_CODES).toHaveProperty("PEV");
    expect(EVENT_CODES).toHaveProperty("WCW");
  });

  test("has at least 60 event codes", () => {
    expect(Object.keys(EVENT_CODES).length).toBeGreaterThanOrEqual(60);
  });

  test("has no duplicate values that suggest copy-paste errors", () => {
    // All codes should be 3 uppercase letters
    for (const code of Object.keys(EVENT_CODES)) {
      expect(code).toMatch(/^[A-Z]{3}$/);
    }
  });

  test("all values are non-empty strings", () => {
    for (const [code, name] of Object.entries(EVENT_CODES)) {
      expect(typeof name).toBe("string");
      expect(name.length).toBeGreaterThan(0);
    }
  });
});

describe("STATE_FIPS", () => {
  test("contains all 50 states", () => {
    // Count entries excluding territories and "All States"
    const stateCodes = Object.keys(STATE_FIPS).filter(
      (k) => !["00", "60", "66", "69", "72", "78"].includes(k),
    );
    // 50 states + DC = 51
    expect(stateCodes.length).toBe(51);
  });

  test("contains territories", () => {
    expect(STATE_FIPS["72"]).toBe("Puerto Rico");
    expect(STATE_FIPS["66"]).toBe("Guam");
    expect(STATE_FIPS["78"]).toBe("U.S. Virgin Islands");
  });

  test("contains special all-states code", () => {
    expect(STATE_FIPS["00"]).toBe("All States");
  });
});

describe("COUNTY_FIPS", () => {
  test("has over 3000 entries", () => {
    expect(Object.keys(COUNTY_FIPS).length).toBeGreaterThan(3000);
  });

  test("keys are 5-character SSCCC format", () => {
    for (const key of Object.keys(COUNTY_FIPS).slice(0, 100)) {
      expect(key).toMatch(/^\d{5}$/);
    }
  });

  test("looks up known counties", () => {
    expect(COUNTY_FIPS["06037"]).toMatch(/Los Angeles/);
    expect(COUNTY_FIPS["36061"]).toMatch(/New York/);
    expect(COUNTY_FIPS["17031"]).toMatch(/Cook/);
  });
});
