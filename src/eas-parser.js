/**
 * Parse a SAME header string into structured, human-readable fields.
 *
 * Format: ZCZC-ORG-EEE-PSSCCC-PSSCCC+TTTT-JJJHHMM-LLLLLLLL-
 * Multiple location codes are separated by hyphens before the +TTTT field.
 */

import { ORIGINATOR_CODES, EVENT_CODES, STATE_FIPS } from "./eas-codes.js";

let COUNTY_FIPS = {};
try {
  const mod = await import("./fips-counties.js");
  COUNTY_FIPS = mod.COUNTY_FIPS;
} catch {
  // County lookup will return code only if file is missing
}

/**
 * Parse a raw SAME header string.
 * @param {string} raw - e.g. "ZCZC-WXR-TOR-039173-039051+0030-1591829-KLST/NWS-"
 * @returns {object} Parsed and interpreted header
 */
export function parseSameHeader(raw) {
  const header = raw.trim();

  // Strip trailing dash if present
  const cleaned = header.endsWith("-")
    ? header.slice(0, -1)
    : header;

  // Split on the + to separate locations from duration+time+sender
  const plusIdx = cleaned.indexOf("+");
  if (plusIdx === -1) {
    return { raw: header, error: "Invalid SAME header: missing + delimiter" };
  }

  const beforePlus = cleaned.slice(0, plusIdx);
  const afterPlus = cleaned.slice(plusIdx + 1);

  // Before +: ZCZC-ORG-EEE-PSSCCC-PSSCCC-...
  const beforeParts = beforePlus.split("-");
  if (beforeParts.length < 4 || beforeParts[0] !== "ZCZC") {
    return { raw: header, error: "Invalid SAME header: missing ZCZC prefix" };
  }

  const originatorCode = beforeParts[1];
  const eventCode = beforeParts[2];
  const locationCodes = beforeParts.slice(3);

  // After +: TTTT-JJJHHMM-LLLLLLLL
  const afterParts = afterPlus.split("-");
  if (afterParts.length < 3) {
    return { raw: header, error: "Invalid SAME header: incomplete time/sender fields" };
  }

  const duration = afterParts[0];
  const issuedTime = afterParts[1];
  const sender = afterParts.slice(2).join("-"); // sender may contain hyphens

  return {
    raw: header,
    originator: {
      code: originatorCode,
      name: ORIGINATOR_CODES[originatorCode] || "Unknown",
    },
    event: {
      code: eventCode,
      name: EVENT_CODES[eventCode] || "Unknown",
    },
    locations: locationCodes.map(parseLocation),
    duration: parseDuration(duration),
    issued: parseIssuedTime(issuedTime),
    sender: sender.trim(),
  };
}

/**
 * Parse a PSSCCC location code.
 * P = subdivision (0 = entire county, 1-9 = parts)
 * SS = state FIPS
 * CCC = county FIPS
 */
function parseLocation(code) {
  if (code.length !== 6) {
    return { raw: code, error: "Invalid location code" };
  }

  const subdivision = code[0];
  const stateFips = code.slice(1, 3);
  const countyFips = code.slice(3, 6);
  const fullFips = stateFips + countyFips;

  // Special case: 000000 means all US
  if (code === "000000") {
    return {
      code,
      subdivision: "0",
      stateFips: "00",
      countyFips: "000",
      state: "All States",
      county: "All Counties",
    };
  }

  const result = {
    code,
    subdivision,
    stateFips,
    countyFips,
    state: STATE_FIPS[stateFips] || `Unknown State (${stateFips})`,
    county: COUNTY_FIPS[fullFips] || `Unknown County (${fullFips})`,
  };

  const SUBDIVISIONS = {
    "0": "Entire county",
    "1": "Northwest",
    "2": "North",
    "3": "Northeast",
    "4": "West",
    "5": "Central",
    "6": "East",
    "7": "Southwest",
    "8": "South",
    "9": "Southeast",
  };

  if (subdivision !== "0") {
    result.subdivisionDescription = SUBDIVISIONS[subdivision] || `Part ${subdivision}`;
  }

  return result;
}

/**
 * Parse TTTT duration field (in 15-minute increments as HHMM).
 */
function parseDuration(tttt) {
  if (tttt.length !== 4) return { raw: tttt, description: "Unknown" };

  const hours = parseInt(tttt.slice(0, 2), 10);
  const minutes = parseInt(tttt.slice(2, 4), 10);
  const totalMinutes = hours * 60 + minutes;

  const parts = [];
  if (hours > 0) parts.push(`${hours} hour${hours > 1 ? "s" : ""}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? "s" : ""}`);

  return {
    raw: tttt,
    hours,
    minutes,
    totalMinutes,
    description: parts.join(" ") || "0 minutes",
  };
}

/**
 * Parse JJJHHMM issued time field.
 * JJJ = Julian day (001-366)
 * HH = hour UTC
 * MM = minute UTC
 */
function parseIssuedTime(jjjhhmm) {
  if (jjjhhmm.length !== 7) return { raw: jjjhhmm, description: "Unknown" };

  const julianDay = parseInt(jjjhhmm.slice(0, 3), 10);
  const hour = parseInt(jjjhhmm.slice(3, 5), 10);
  const minute = parseInt(jjjhhmm.slice(5, 7), 10);

  return {
    raw: jjjhhmm,
    julianDay,
    hour,
    minute,
    description: `Day ${julianDay}, ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} UTC`,
  };
}
