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
