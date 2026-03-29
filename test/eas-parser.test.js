import { parseSameHeader } from "../src/eas-parser.js";

describe("parseSameHeader", () => {
  const VALID_HEADER = "ZCZC-WXR-TOR-039173-039051+0030-1591829-KLST/NWS-";

  test("parses originator code and name", () => {
    const result = parseSameHeader(VALID_HEADER);
    expect(result.originator.code).toBe("WXR");
    expect(result.originator.name).toBe("National Weather Service");
  });

  test("parses event code and name", () => {
    const result = parseSameHeader(VALID_HEADER);
    expect(result.event.code).toBe("TOR");
    expect(result.event.name).toBe("Tornado Warning");
  });

  test("parses multiple location codes with FIPS lookup", () => {
    const result = parseSameHeader(VALID_HEADER);
    expect(result.locations.length).toBe(2);

    expect(result.locations[0].code).toBe("039173");
    expect(result.locations[0].subdivision).toBe("0");
    expect(result.locations[0].stateFips).toBe("39");
    expect(result.locations[0].countyFips).toBe("173");
    expect(result.locations[0].state).toBe("Ohio");
    expect(result.locations[0].county).toMatch(/County/);

    expect(result.locations[1].stateFips).toBe("39");
    expect(result.locations[1].countyFips).toBe("051");
  });

  test("parses duration", () => {
    const result = parseSameHeader(VALID_HEADER);
    expect(result.duration.raw).toBe("0030");
    expect(result.duration.hours).toBe(0);
    expect(result.duration.minutes).toBe(30);
    expect(result.duration.totalMinutes).toBe(30);
    expect(result.duration.description).toBe("30 minutes");
  });

  test("parses issued time", () => {
    const result = parseSameHeader(VALID_HEADER);
    expect(result.issued.raw).toBe("1591829");
    expect(result.issued.julianDay).toBe(159);
    expect(result.issued.hour).toBe(18);
    expect(result.issued.minute).toBe(29);
    expect(result.issued.description).toBe("Day 159, 18:29 UTC");
  });

  test("parses sender", () => {
    const result = parseSameHeader(VALID_HEADER);
    expect(result.sender).toBe("KLST/NWS");
  });

  test("preserves raw header string", () => {
    const result = parseSameHeader(VALID_HEADER);
    expect(result.raw).toBe(VALID_HEADER);
  });

  test("handles nationwide location code 000000", () => {
    const header = "ZCZC-PEP-EAN-000000+0100-0010000-WHITEHOUSE-";
    const result = parseSameHeader(header);
    expect(result.locations[0].state).toBe("All States");
    expect(result.locations[0].county).toBe("All Counties");
  });

  test("includes subdivision description for non-zero subdivisions", () => {
    const header = "ZCZC-WXR-TOR-339173+0030-1591829-KLST/NWS-";
    const result = parseSameHeader(header);
    expect(result.locations[0].subdivision).toBe("3");
    expect(result.locations[0].subdivisionDescription).toBe("Northeast");
  });

  test("returns error for missing + delimiter", () => {
    const result = parseSameHeader("ZCZC-WXR-TOR-039173");
    expect(result.error).toMatch(/missing \+ delimiter/);
  });

  test("returns error for missing ZCZC prefix", () => {
    const result = parseSameHeader("WXYZ-WXR-TOR-039173+0030-1591829-KLST-");
    expect(result.error).toMatch(/missing ZCZC prefix/);
  });

  test("returns unknown for unrecognized originator", () => {
    const header = "ZCZC-ZZZ-TOR-039173+0030-1591829-KLST/NWS-";
    const result = parseSameHeader(header);
    expect(result.originator.name).toBe("Unknown");
  });

  test("returns unknown for unrecognized event code", () => {
    const header = "ZCZC-WXR-ZZZ-039173+0030-1591829-KLST/NWS-";
    const result = parseSameHeader(header);
    expect(result.event.name).toBe("Unknown");
  });

  test("parses duration with hours", () => {
    const header = "ZCZC-WXR-TOR-039173+0130-1591829-KLST/NWS-";
    const result = parseSameHeader(header);
    expect(result.duration.hours).toBe(1);
    expect(result.duration.minutes).toBe(30);
    expect(result.duration.totalMinutes).toBe(90);
    expect(result.duration.description).toBe("1 hour 30 minutes");
  });
});
