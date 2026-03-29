# @prx/eas-detect

Detect [EAS (Emergency Alert System)](https://en.wikipedia.org/wiki/Emergency_Alert_System) tones and SAME messages in audio files. Returns structured JSON with decoded headers, FIPS location lookups, and timecodes for when each EAS component occurs in the audio.

Supports full and **partial** match detection — even if only the attention tones, a fragment of the FSK digital header, or just the End of Message marker is present.

> **Warning:** This software is provided without warranty and is **not** intended to be used for detecting EAS as part of a real, production, broadcast system. Its purpose is to detect the presence of EAS codes in audio files to help **prevent** their inadvertent inclusion in content where they should not be present.

## Requirements

- Node.js >= 18
- [SoX](https://sox.sourceforge.net/) (`brew install sox`)
- [multimon-ng](https://github.com/EliasOenal/multimon-ng) (`brew install multimon-ng`)

## Install

```bash
npm install @prx/eas-detect
```

## CLI Usage

```bash
npx eas-detect recording.wav
```

For raw PCM input (signed 16-bit little-endian):

```bash
npx eas-detect recording.bin --raw --sample-rate 22050
```

Output is JSON to stdout.

## Library Usage

```js
import { detect } from "@prx/eas-detect";

const result = await detect("recording.wav");

if (result.eas_detected) {
  console.log(`Match: ${result.match_type}`); // "full", "partial", or "none"

  for (const header of result.same_headers) {
    console.log(`${header.event.name} from ${header.originator.name}`);
    for (const loc of header.locations) {
      console.log(`  ${loc.county}, ${loc.state}`);
    }
  }
}
```

For processing audio from a Buffer (e.g., from S3):

```js
import { detectBuffer } from "@prx/eas-detect";

const result = await detectBuffer(audioBuffer, ".wav");
```

## Output Format

### Full match

A complete EAS message with header, attention tone, and End of Message:

```json
{
  "file": "recording.wav",
  "duration_seconds": 18.886,
  "eas_detected": true,
  "match_type": "full",
  "timecodes": [
    { "type": "fsk", "start": 0.491, "end": 1.483 },
    { "type": "fsk", "start": 2.486, "end": 3.478 },
    { "type": "fsk", "start": 4.48, "end": 5.462 },
    { "type": "attention_tone", "start": 6.459, "end": 14.445 },
    { "type": "fsk", "start": 15.465, "end": 15.766 },
    { "type": "fsk", "start": 16.768, "end": 17.079 },
    { "type": "fsk", "start": 18.071, "end": 18.382 }
  ],
  "attention_tone": {
    "detected": true,
    "intervals": [{ "start": 6.459, "end": 14.445 }]
  },
  "fsk": {
    "detected": true,
    "intervals": [
      { "start": 0.491, "end": 1.483 },
      { "start": 2.486, "end": 3.478 },
      { "start": 4.48, "end": 5.462 },
      { "start": 15.465, "end": 15.766 },
      { "start": 16.768, "end": 17.079 },
      { "start": 18.071, "end": 18.382 }
    ]
  },
  "same_headers": [
    {
      "raw": "ZCZC-WXR-TOR-039173-039051+0030-1591829-KLST/NWS-",
      "originator": { "code": "WXR", "name": "National Weather Service" },
      "event": { "code": "TOR", "name": "Tornado Warning" },
      "locations": [
        {
          "code": "039173",
          "subdivision": "0",
          "state_fips": "39",
          "county_fips": "173",
          "state": "Ohio",
          "county": "Wood County"
        },
        {
          "code": "039051",
          "subdivision": "0",
          "state_fips": "39",
          "county_fips": "051",
          "state": "Ohio",
          "county": "Fulton County"
        }
      ],
      "duration": {
        "raw": "0030",
        "hours": 0,
        "minutes": 30,
        "total_minutes": 30,
        "description": "30 minutes"
      },
      "issued": {
        "raw": "1591829",
        "julian_day": 159,
        "hour": 18,
        "minute": 29,
        "description": "Day 159, 18:29 UTC"
      },
      "sender": "KLST/NWS",
      "timecode": { "start": 0.491, "end": 5.462 }
    }
  ],
  "end_of_message": true
}
```

### Partial match

When only some EAS components are present — for example, just the End of Message marker:

```json
{
  "file": "recording.wav",
  "duration_seconds": 3.914,
  "eas_detected": true,
  "match_type": "partial",
  "timecodes": [
    { "type": "fsk", "start": 0.491, "end": 0.802 },
    { "type": "fsk", "start": 1.804, "end": 2.105 },
    { "type": "fsk", "start": 3.107, "end": 3.408 }
  ],
  "attention_tone": { "detected": false, "intervals": [] },
  "fsk": {
    "detected": true,
    "intervals": [
      { "start": 0.491, "end": 0.802 },
      { "start": 1.804, "end": 2.105 },
      { "start": 3.107, "end": 3.408 }
    ]
  },
  "same_headers": [],
  "end_of_message": true
}
```

## Match Types

| match_type | Meaning |
|-----------|---------|
| `full` | SAME header + attention tone + End of Message all present |
| `partial` | At least one EAS component detected (header, attention tone, EOM, or FSK energy) |
| `none` | No EAS content detected |

## How It Works

Three detection methods run in parallel on the audio:

1. **Attention tone detection** — [Goertzel algorithm](https://en.wikipedia.org/wiki/Goertzel_algorithm) tuned to 853 Hz and 960 Hz (the EAS dual-tone attention signal)
2. **FSK energy detection** — Goertzel at the SAME mark (2083.3 Hz) and space (1562.5 Hz) frequencies, reporting presence even when the signal is too degraded to decode
3. **SAME header decoding** — pipes audio through [SoX](https://sox.sourceforge.net/) into [multimon-ng](https://github.com/EliasOenal/multimon-ng) for full SAME protocol decoding with error correction

Decoded SAME headers are parsed and enriched with human-readable lookups from 3,235 FIPS county codes and all standard EAS originator/event codes.

## EAS Protocol Summary

An EAS message consists of:

1. **Digital header** (SAME) — FSK at 520.83 baud, sent 3 times with ~1s silence between bursts
2. **Attention tone** — 853 Hz + 960 Hz simultaneous, 8-25 seconds
3. **Voice/data message** — the actual alert content
4. **End of Message** — `NNNN` sent 3 times using the same FSK encoding

The SAME header format is: `ZCZC-ORG-EEE-PSSCCC+TTTT-JJJHHMM-LLLLLLLL-`

| Field | Description |
|-------|-------------|
| `ORG` | Originator (EAS, CIV, WXR, PEP) |
| `EEE` | Event code (TOR, SVR, RWT, etc.) |
| `PSSCCC` | Location: P=subdivision, SS=state FIPS, CCC=county FIPS |
| `TTTT` | Duration (HHMM) |
| `JJJHHMM` | Issue time (Julian day + UTC time) |
| `LLLLLLLL` | Sender callsign |

## Testing

```bash
# Generate test audio fixtures
npm run generate-fixtures

# Run tests
npm test
```

## License

MIT
