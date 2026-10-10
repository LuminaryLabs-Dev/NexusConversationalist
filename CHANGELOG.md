# Changelog

## 0.2.0 — 2026-10-10
- Added a ready-to-serve GitHub Pages site at repository root with standalone static HTML, CSS and ESM.
- Switched the public dictation backend to NexusDictation's browser Parakeet TDT v3 WebGPU adapter; retained Parakeet Redux native support separately.
- Connected all three independent ESM modules with commit-pinned imports, and added text-only conversation sessions.
- Removed this repository's GitHub Actions CI workflow. Pages uses the configured main/(root) branch source.
- Kept LFM2.5-1.2B WebGPU reasoning in this repository and Kokoro inference in NexusVoice.
- Added local test and device acceptance instructions.

## 0.1.0 — 2026-10-10
- Initial half-duplex controller and LFM2.5 WebGPU worker.

## 0.2.1 — 2026-10-10
- Fixed LFM Transformers.js browser ESM import using the official documented jsDelivr entry.
- Added real download telemetry and indeterminate fallback, sequential loading and retry.
- Added local tests for download calculations and loader failure recovery. No CI workflow.
