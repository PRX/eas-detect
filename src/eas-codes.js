/**
 * EAS/SAME lookup tables for human-readable interpretation.
 *
 * Originator and event codes per 47 CFR 11.31 (FCC Part 11 rules).
 * https://www.ecfr.gov/current/title-47/chapter-I/subchapter-A/part-11/subpart-B/section-11.31
 *
 * State FIPS codes per ANSI INCITS 38:2009.
 */

export const ORIGINATOR_CODES = {
  PEP: "United States Government",
  CIV: "Civil Authorities",
  WXR: "National Weather Service",
  EAS: "EAS Participant",
};

export const EVENT_CODES = {
  // National codes (required)
  EAN: "Emergency Action Notification",
  NIC: "National Information Center",
  NPT: "National Periodic Test",
  RMT: "Required Monthly Test",
  RWT: "Required Weekly Test",

  // State and local — civil/emergency
  ADR: "Administrative Message",
  BLU: "Blue Alert",
  CAE: "Child Abduction Emergency",
  CDW: "Civil Danger Warning",
  CEM: "Civil Emergency Message",
  EQW: "Earthquake Warning",
  EVI: "Evacuation Immediate",
  FRW: "Fire Warning",
  HMW: "Hazardous Materials Warning",
  LAE: "Local Area Emergency",
  LEW: "Law Enforcement Warning",
  MEP: "Missing and Endangered Persons",
  NMN: "Network Message Notification",
  NUW: "Nuclear Power Plant Warning",
  RHW: "Radiological Hazard Warning",
  SPW: "Shelter in Place Warning",
  TOE: "911 Telephone Outage Emergency",
  VOW: "Volcano Warning",

  // State and local — weather warnings
  AVW: "Avalanche Warning",
  BZW: "Blizzard Warning",
  CFW: "Coastal Flood Warning",
  DSW: "Dust Storm Warning",
  EWW: "Extreme Wind Warning",
  FFW: "Flash Flood Warning",
  FLW: "Flood Warning",
  HUW: "Hurricane Warning",
  HWW: "High Wind Warning",
  SMW: "Special Marine Warning",
  SQW: "Snow Squall Warning",
  SSW: "Storm Surge Warning",
  SVR: "Severe Thunderstorm Warning",
  TOR: "Tornado Warning",
  TRW: "Tropical Storm Warning",
  TSW: "Tsunami Warning",
  WSW: "Winter Storm Warning",

  // State and local — weather watches
  AVA: "Avalanche Watch",
  CFA: "Coastal Flood Watch",
  FFA: "Flash Flood Watch",
  FLA: "Flood Watch",
  HUA: "Hurricane Watch",
  HWA: "High Wind Watch",
  SSA: "Storm Surge Watch",
  SVA: "Severe Thunderstorm Watch",
  TOA: "Tornado Watch",
  TRA: "Tropical Storm Watch",
  TSA: "Tsunami Watch",
  WSA: "Winter Storm Watch",

  // State and local — weather statements
  FFS: "Flash Flood Statement",
  FLS: "Flood Statement",
  HLS: "Hurricane Statement",
  SPS: "Special Weather Statement",
  SVS: "Severe Weather Statement",

  // Test/demo
  DMO: "Practice/Demo Warning",

  // Additional codes in use by states and NWS but not listed in 47 CFR 11.31
  AMB: "AMBER Alert",
  PEV: "Potential Evacuation",
  WCW: "Wind Chill Warning",
};

export const STATE_FIPS = {
  "00": "All States",
  "01": "Alabama",
  "02": "Alaska",
  "04": "Arizona",
  "05": "Arkansas",
  "06": "California",
  "08": "Colorado",
  "09": "Connecticut",
  10: "Delaware",
  11: "District of Columbia",
  12: "Florida",
  13: "Georgia",
  15: "Hawaii",
  16: "Idaho",
  17: "Illinois",
  18: "Indiana",
  19: "Iowa",
  20: "Kansas",
  21: "Kentucky",
  22: "Louisiana",
  23: "Maine",
  24: "Maryland",
  25: "Massachusetts",
  26: "Michigan",
  27: "Minnesota",
  28: "Mississippi",
  29: "Missouri",
  30: "Montana",
  31: "Nebraska",
  32: "Nevada",
  33: "New Hampshire",
  34: "New Jersey",
  35: "New Mexico",
  36: "New York",
  37: "North Carolina",
  38: "North Dakota",
  39: "Ohio",
  40: "Oklahoma",
  41: "Oregon",
  42: "Pennsylvania",
  44: "Rhode Island",
  45: "South Carolina",
  46: "South Dakota",
  47: "Tennessee",
  48: "Texas",
  49: "Utah",
  50: "Vermont",
  51: "Virginia",
  53: "Washington",
  54: "West Virginia",
  55: "Wisconsin",
  56: "Wyoming",
  // Territories
  60: "American Samoa",
  66: "Guam",
  69: "Northern Mariana Islands",
  72: "Puerto Rico",
  78: "U.S. Virgin Islands",
};
