# Live MacBook acceptance gates

## Required hardware
Apple Silicon MacBook Pro with a recent WebGPU-capable browser, microphone, speakers, Python 3.11+ and enough free memory. This is a **manual hardware test**, not implied by the automated unit suite.

## Procedure
1. Install `moondream>=2.4.0`, start `native/bridge.py` in NexusDictation, confirm `/health` with its session token.
2. Serve the Conversationalist repo on loopback port 4173. Open `/studio/`, paste the bridge token, click Load models. Verify actual download of Redux, LFM Q4, and Kokoro via Hugging Face and WebGPU adapter acquisition.
3. Click Start; say a short sentence and pause. Confirm one finalized transcript, one LFM text response, one audible Kokoro reply, and automatic return to Listening.
4. Repeat ten sequential short turns, one long utterance (>15 seconds), silence, and low-volume input. Assert no AI self-transcription and no duplicate user turn from a preview.
5. Stop during dictation, during LFM generation, and during speech. Confirm no unhandled reentry or lingering microphone track.
6. Reload the page, disconnect the internet after caches are populated, confirm expected offline behavior or document the missing cached resources. Test Safari separately if target deployment requires it.
7. Measure finalization latency, time to first response audio, RAM and GPU memory, transcription WER on real test recordings. Record OS/browser versions and hardware.

## Known limitations
- Redux/Photon is native CPU/Metal; it is not a browser WebGPU model. `bridge.py` is required for browser dictation.
- No microphone barge-in during playback; this is intentionally half-duplex.
- CDN ESM imports need internet or vendoring even when models are cached.
- LFM ONNX Q4 ~1.2 GB and Kokoro first-run assets require downloading.
- No real-microphone / real-model / headless browser test has been run by the repository's Node suite.
- Check LFM license, model attribution and NexusVoice native third-party notices before redistribution.
