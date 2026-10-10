# Static GitHub Pages acceptance

GitHub Pages must use **Deploy from a branch → main → /(root)**. This repository does not use CI or GitHub Actions for deployment.

## Verify the public page
1. Load https://luminarylabs-dev.github.io/NexusConversationalist/ and verify root `index.html`, `assets/site.css`, `assets/main.js`, and `esm/index.js` all return HTTP 200.
2. Use Chrome on an Apple Silicon Mac. Inspect `navigator.gpu.requestAdapter()` before running the models.
3. Click Load models. Confirm browser downloads model files from Hugging Face and resolves jsDelivr ESM imports for NexusDictation and NexusVoice. Expect a large initial download. Confirm all three report Loaded.
4. Test **Send text** first: no microphone permission prompt; LFM text response appears and NexusVoice speaks it.
5. Click Start listening. Speak and pause. Confirm Parakeet returns one finalized transcript, LFM responds, Kokoro plays audio, and input resumes.
6. Repeat 10 turns. Check no self-transcription, no duplicate finalized turns and no stuck speaking state.
7. Click Stop during ASR, LFM, and playback and verify microphone tracks terminate and no late stale response plays.
8. Test actual model download failures, microphone denial, no WebGPU, offline reload, mobile layout, and browser console warnings.
9. Record inference latency, memory use and hardware/browser details.

## Deliberate limitations
* Browser-only ASR uses Parakeet TDT v3, **not** Photon/Redux; native NexusDictation separately supports Redux.
* Turn-taking is half-duplex; no microphone barge-in while speaking.
* This repository contains static ESM source and a ready-to-serve root Pages site, but no model binaries.
* Unit tests do not validate live GPU inference.
* Pages publication may take time to become accessible after pushes.
