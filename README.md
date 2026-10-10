# NexusConversationalist

A local, half-duplex conversational controller that connects three **independently versioned ESM modules**:

1. [NexusDictation](https://github.com/LuminaryLabs-Dev/NexusDictation): [moondream/parakeet-redux](https://huggingface.co/moondream/parakeet-redux) through the native Photon localhost bridge. Microphone -> text.
2. **NexusConversationalist**: [LiquidAI/LFM2.5-1.2B-Instruct-ONNX](https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct-ONNX), **Q4 on WebGPU**. Text -> response text. Model loading and reasoning stay inside this repository.
3. [NexusVoice](https://github.com/LuminaryLabs-Dev/NexusVoice): [Kokoro-82M-v1.0-ONNX](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX) via browser worker, WebGPU FP32 or WASM Q8. Text -> audio.

The controller owns listening/processing/speaking state and suppresses microphone capture during speech playback. Transcript previews are never used as commands. No server-hosted text or speech API is used.

## MacBook quick start

1. On an Apple Silicon Mac, launch the **native** NexusDictation bridge:
   ```bash
   git clone https://github.com/LuminaryLabs-Dev/NexusDictation.git
   cd NexusDictation
   python3 -m venv .venv && source .venv/bin/activate
   pip install "moondream>=2.4.0"
   python3 native/bridge.py --device cpu
   ```
   Photon downloads Parakeet Redux from Hugging Face on first launch. Copy the printed **session token**.
2. Serve this repository as a static site from localhost:
   ```bash
   python3 -m http.server 4173 --bind 127.0.0.1
   ```
   Open **http://127.0.0.1:4173/studio/** in a current WebGPU-capable browser. Paste the bridge token and select `Load models`. Hugging Face will download LFM Q4 and Kokoro on first run. This needs ~1.2 GB LFM weights plus TTS assets and additional working memory; ensure enough free space/RAM.
3. Click **Start listening** and speak a short sentence. After silence, Photon finalizes transcription, LFM creates a response, Kokoro speaks, and recording automatically resumes. Click **Stop** to end. `Send text` tests the LFM + Kokoro path without a microphone.

**The two imported speech repos are delivered as plain JavaScript ESM over jsDelivr**. The local Studio imports `esm/index.js` from each repository and the LFM module locally; no bundler or global variables are required. For production, pin immutable commit SHAs/releases instead of `@main`. Browser CDN imports and real GPU model inference require an on-device smoke test; offline reuse depends on caches and CDN module availability. For fully offline distribution, vendor/pin the JS modules and model weights.

## JavaScript integration

```js
import { NexusConversationalist, LFMReasoner } from "./esm/index.js";
import { NexusDictation } from "https://cdn.jsdelivr.net/gh/LuminaryLabs-Dev/NexusDictation@main/esm/index.js";
import { NexusVoiceBrowser } from "https://cdn.jsdelivr.net/gh/LuminaryLabs-Dev/NexusVoice@main/esm/index.js";

const app = new NexusConversationalist({
  dictator: new NexusDictation({ token: "token-printed-by-Python-bridge" }),
  voice: new NexusVoiceBrowser({ backend: "auto" }),
  reasoner: new LFMReasoner({ dtype: "q4" })
});
app.on("message", console.log);
app.on("state", console.log);
await app.initialize(); // WebGPU, models and Photon must be available
await app.start();      // user gesture required for microphone/audio
// await app.stop(); app.dispose();
```

### State contract

`idle -> listening -> thinking -> speaking -> listening`. Events: `state`, `partial`, `message`, `error`. Manual `send(text)` works in an active session and gates capture. `stop()` invalidates any in-flight reasoning or speech.

Model reasoning is pluggable but defaults to the official LFM2.5-1.2B-Instruct-ONNX WebGPU export. The controller does not automatically execute LLM-suggested actions. Actions require an explicit host-side registration and authorization callback, and successful application execution before confirmation.

## Validation

`node --test tests/*.test.js` tests the turn manager with fake model adapters. It does **not** prove actual model inference, live microphone capture, CDN module loading, or macOS runtime compatibility. Those require the MacBook acceptance run documented in `docs/ACCEPTANCE.md`.

## Licenses / security

Parakeet Redux is CC-BY-4.0; Kokoro ONNX is Apache-2.0; LFM2.5 uses the separate **LFM 1.0 License**, which must be checked before commercial redistribution. NexusVoice's native eSpeak NG phonemizer has an additional unresolved GPL redistribution issue. No model weights, microphone recordings, or token secrets are committed.
