# NexusConversationalist

**Static, serverless, local-inference conversation studio.** The build is committed directly to the repository root and published with **GitHub Pages → Deploy from a branch → main → /(root)**. No CI, bundler or deployment action is required.

## Open the public app

**https://luminarylabs-dev.github.io/NexusConversationalist/**

Use an up-to-date WebGPU-capable desktop Chrome browser, ideally on an Apple Silicon MacBook Pro. Click **Load models** (the first model downloads are large), then **Start listening**, speak, pause, and wait for the spoken response. After playback it resumes listening. **Send text** lets you try LFM + Kokoro without microphone access. Permission to use the microphone is requested only on Start listening.

### The three independent ESM modules

| Module | Web inference engine | Role |
| --- | --- | --- |
| [NexusDictation](https://github.com/LuminaryLabs-Dev/NexusDictation) | [Parakeet TDT v3 ONNX int4](https://huggingface.co/efederici/parakeet-tdt-0.6b-v3-onnx-int4) through parakeet.js WebGPU + WASM | Microphone → text |
| NexusConversationalist | [LFM2.5-1.2B-Instruct ONNX](https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct-ONNX), Q4 WebGPU | Conversation state + text reasoning |
| [NexusVoice](https://github.com/LuminaryLabs-Dev/NexusVoice) | [Kokoro 82M ONNX](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX), WebGPU FP32 or WASM Q8 fallback | Text → speech |

**Important model distinction:** The earlier **[Parakeet Redux](https://huggingface.co/moondream/parakeet-redux)** model requires Photon (native CPU/Metal) and is retained in NexusDictation for native macOS applications. The GitHub Pages deployment cannot execute Photon/Python, so the web build uses the compatible Parakeet **TDT v3** model instead. The browser will download approximately 409 MB of ASR weights, LFM Q4 weights and Kokoro assets from Hugging Face. Allow substantial free disk/GPU memory. All inference runs on-device after downloading, not on an external inference API.

## Repository / static build

```
NexusConversationalist/
├── index.html               # Actual GitHub Pages root entrypoint
├── .nojekyll                # Serve files as-is
├── assets/
│   ├── main.js              # Imports two independent ESM repositories
│   └── site.css
├── esm/
│   ├── index.js             # Conversation controller / turn manager
│   ├── lfm.js               # LFM ESM wrapper
│   └── lfm-worker.js        # LFM WebGPU inference
├── tests/
└── docs/
```

All static assets are committed directly to `main`. No GitHub Actions workflow is used for this Pages site. The browser imports immutable GitHub commit-pinned NexusDictation and NexusVoice ESM modules through jsDelivr, and its local LFM worker loads the official Liquid AI ONNX export through Transformers.js. Browser CDN imports require network access on first visit and must be vendored for a completely offline distribution.

To preview the same root build locally:

```bash
git clone https://github.com/LuminaryLabs-Dev/NexusConversationalist.git
cd NexusConversationalist
python3 -m http.server 4173 --bind 127.0.0.1
# open http://127.0.0.1:4173/
```

## Conversation contract

`idle → listening → thinking → speaking → listening` for voice turns. Input capture is stopped while the AI thinks and speaks. Only finalized ASR transcripts trigger turns; duplicates are ignored. `start({listen:false})` enables text-only conversation without requesting microphone permissions. Typed messages use the same reasoning and TTS path. Actions are opt-in; the host must explicitly register and authorize any application action.

## Verification and limitations

Run `node --test tests/*.test.js` **locally**, without CI. Tests exercise the turn-state protocol using mocked model adapters. Live microphone, GPU model weights, WASM decoder, CDN module loading, speech synthesis and sustained sessions require a real MacBook/browser acceptance run. Do not claim those runtime gates are passed until tested on actual target hardware. The sandbox's headless Chromium renderer could not complete a screenshot, so that visual gate also remains open.

Review [LFM 1.0 license](https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct-ONNX/blob/main/LICENSE), model licenses and NexusVoice's third-party notices before selling a packaged version. No user audio or transcripts are persisted by default.

See [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md) for the actual-hardware verification checklist.

## Browser model loading (2026-10-10)

The LFM worker now imports the **Hugging Face documented browser ESM entry** `https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1`, replacing the failing `esm.sh` dynamic import. Initialization is sequential: Parakeet, LFM Q4, then Kokoro. A live progress panel shows the active module, real percentage and downloaded/total MB **only when byte telemetry is exposed** (currently LFM); other downloads remain indeterminate instead of displaying invented numbers. Initialization failures identify the stage and provide **Retry models**. Static Pages remains at `main/(root)` without CI.

Local acceptance: `node --test tests/*.test.js`. On a target WebGPU MacBook, load all three models and send a voice turn; sandbox headless browser limitations do not establish successful GPU inference.

## Lumina voice-call interface (2026-10-10)

The root GitHub Pages shell now presents NexusConversationalist as **Lumina**, centered on the embeddable [GLSL orb](assets/lumina-orb.js) and streamlined audio-call controls. Open the gear for the existing model loading/progress/retry flow and audio activation settings; open Chat for transcript, text input and Clear conversation. All inference adapters and existing model loading files are unchanged.

The orb is a standalone custom element: `<lumina-orb intensity="0.12" pulse="0.48" wave="0.38" speed="0.85"></lumina-orb>`. Import `assets/lumina-orb.js` as a module and change GLSL uniforms live with `setParams({ intensity, pulse, wave, speed, hue, mode })`. No new dependency or build step.

**Voice activation** is optional and off by default. After a user grants microphone permission, a local RMS monitor compares audio against a rolling ambient baseline and starts NexusDictation on a sustained rise of at least 10%, with a noise floor and cooldown. The Settings panel adjusts sensitivity, and tapping the orb starts listening manually. Ambient volume detection is not a wake word; other sounds may trigger it. Browser privacy rules prevent microphone monitoring before permission. See [docs/LUMINA.md](docs/LUMINA.md) for details.

## Lumina Reflex Kit (2026-10-10)

Lumina now uses conservative known-phrase routing so short greetings bypass LFM, while open-ended questions continue through LFM + NexusVoice. There is a 43-phrase Kokoro catalog, IndexedDB recording cache, prioritized single-channel scheduler, and Settings-based **Prepare all 43 voice clips** action. Four common clips are prepared after model loading. Optional NexusEngine Speech Kit provider adapter: `esm/reflex/nexusengine-adapter.js`. See [Reflex documentation](docs/REFLEX.md) for generation, validation and limitations. Entries marked generated=false have no packaged audio yet.
