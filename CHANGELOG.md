# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-04-08

### Added

 - ffmpeg now needed for both decoding audio and filtering
 - It is not included (install however you like!), but will cause errors if it is missing

### Changed

 - Bandpass logic now using a complex filter in ffmpeg instead of sox
 - Decode also using ffmpeg, which should support more audio encodings than sox
 - Change to use ffmpeg motivated by it being more common and having ready static builds

### Removed

 - No more sox dependency


## [0.1.0] - 2026-04-01

### Added

 - First release!
 - Uses sox and multimon-ng and some DSP code to detect attention and fsk tones.
 - Attempts to detect even if the tones are incomplete, low energy, or mixed.
 - Includes a sensitive mode which gets false positives on some audio (e.g. music)
