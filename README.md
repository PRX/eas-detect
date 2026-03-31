# @prx.org/eas-detect

Detect [EAS (Emergency Alert System)](https://en.wikipedia.org/wiki/Emergency_Alert_System) tones and SAME messages in audio files. Returns structured JSON with decoded headers, FIPS location lookups, and timecodes for when each EAS component occurs in the audio.

Supports full and **partial** match detection — even if only the attention tones, a fragment of the FSK digital header, or just the End of Message marker is present.

> **Warning:** This software is provided without warranty and is **not** intended to be used for detecting EAS as part of a real, production, broadcast system. Its purpose is to detect the presence of EAS codes in audio files to help **prevent** their inadvertent inclusion in content where they should not be present.

## Requirements

- Node.js >= 18
- [SoX](https://sox.sourceforge.net/) (`brew install sox`)
- [multimon-ng](https://github.com/EliasOenal/multimon-ng) (`brew install multimon-ng`)

## Install

```bash
npm install @prx.org/eas-detect
```

## CLI Usage

Call on any audio file, it will use sox to analyze the file:

```bash
npx eas-detect recording.wav
```

For raw PCM input (signed 16-bit little-endian) you also need to specify the sample rate:

```bash
npx eas-detect recording.bin --raw --sample-rate 22050
```

For audio where EAS tones are mixed with speech or music (e.g. TV broadcasts),
use the sensitive FSK detection mode:

```bash
npx eas-detect recording.mp3 --fsk-mode sensitive
```

Output is JSON to stdout.

### FSK Detection Modes

| Mode | Flag | Description |
|------|------|-------------|
| default | *(none)* | Energy-ratio analysis with alternation validation. Fast and precise, best for clean recordings. |
| sensitive | `--fsk-mode sensitive` | Bandpass filtering + mark/space anti-correlation analysis. Detects faint FSK buried under speech or music, but may produce more false positives on music-heavy content. |

## Library Usage

```js
import { detect } from "@prx.org/eas-detect";

const result = await detect("recording.wav");
// Or with sensitive FSK detection:
// const result = await detect("recording.wav", { fskMode: "sensitive" });

if (result.easDetected) {
  console.log(`Match: ${result.matchType}`); // "full", "partial", or "none"

  for (const header of result.sameHeaders) {
    console.log(`${header.event.name} from ${header.originator.name}`);
    for (const loc of header.locations) {
      console.log(`  ${loc.county}, ${loc.state}`);
    }
  }
}
```

For processing audio from a Buffer (e.g., from S3):

```js
import { detectBuffer } from "@prx.org/eas-detect";

const result = await detectBuffer(audioBuffer, ".wav");
```

## Output Format

### Full match

A complete EAS message with header, attention tone, and End of Message:

```json
{
  "file": "recording.wav",
  "durationSeconds": 18.886,
  "easDetected": true,
  "matchType": "full",
  "timecodes": [
    { "type": "fsk", "start": 0.491, "end": 1.493 },
    { "type": "fsk", "start": 2.476, "end": 3.488 },
    { "type": "fsk", "start": 4.47, "end": 5.472 },
    { "type": "attentionTone", "start": 6.403, "end": 14.457 },
    { "type": "fsk", "start": 15.455, "end": 15.776 },
    { "type": "fsk", "start": 16.768, "end": 17.089 },
    { "type": "fsk", "start": 18.071, "end": 18.382 }
  ],
  "sameHeaders": [
    {
      "raw": "ZCZC-WXR-TOR-039173-039051+0030-1591829-KLST/NWS-",
      "originator": { "code": "WXR", "name": "National Weather Service" },
      "event": { "code": "TOR", "name": "Tornado Warning" },
      "locations": [
        {
          "code": "039173",
          "subdivision": "0",
          "stateFips": "39",
          "countyFips": "173",
          "state": "Ohio",
          "county": "Wood County"
        },
        {
          "code": "039051",
          "subdivision": "0",
          "stateFips": "39",
          "countyFips": "051",
          "state": "Ohio",
          "county": "Fulton County"
        }
      ],
      "duration": {
        "raw": "0030",
        "hours": 0,
        "minutes": 30,
        "totalMinutes": 30,
        "description": "30 minutes"
      },
      "issued": {
        "raw": "1591829",
        "julianDay": 159,
        "hour": 18,
        "minute": 29,
        "description": "Day 159, 18:29 UTC"
      },
      "sender": "KLST/NWS",
      "timecode": { "start": 0.491, "end": 5.472 }
    }
  ],
  "endOfMessage": true
}
```

### Partial match

When only some EAS components are present — for example, just the End of Message marker:

```json
{
  "file": "recording.wav",
  "durationSeconds": 3.914,
  "easDetected": true,
  "matchType": "partial",
  "timecodes": [
    { "type": "fsk", "start": 0.491, "end": 0.802 },
    { "type": "fsk", "start": 1.794, "end": 2.105 },
    { "type": "fsk", "start": 3.097, "end": 3.418 }
  ],
  "sameHeaders": [],
  "endOfMessage": true
}
```

## Match Types

| matchType | Meaning |
|-----------|---------|
| `full` | SAME header + attention tone + End of Message all present |
| `partial` | At least one EAS component detected (header, attention tone, EOM, or FSK energy) |
| `none` | No EAS content detected |

## How It Works

Three detection methods run on the audio:

1. **Attention tone detection** — [Goertzel algorithm](https://en.wikipedia.org/wiki/Goertzel_algorithm) tuned to 853 Hz and 960 Hz (the EAS dual-tone attention signal), using energy-ratio analysis. Also runs on bandpass-filtered audio (800-1000 Hz) to catch tones buried under speech or music.
2. **FSK detection** — Detects the FSK modulation pattern (mark at 2083.3 Hz, space at 1562.5 Hz). The default mode uses Goertzel energy ratios with mark/space alternation validation. The sensitive mode applies narrow bandpass filters around each frequency and detects anti-correlation between the mark and space energy envelopes using Pearson correlation.
3. **SAME header decoding** — Pipes audio through [SoX](https://sox.sourceforge.net/) into [multimon-ng](https://github.com/EliasOenal/multimon-ng) for full SAME protocol decoding with error correction.

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
