# Lumina call shell

The GitHub Pages root now presents NexusConversationalist as **Lumina**, an audio-first conversation interface. Existing model adapters and state machine remain in `esm/`; no inference code is copied into the shell.

## Embeddable GLSL element

Import `<script type="module" src="./assets/lumina-orb.js"></script>` then place:

```html
<lumina-orb intensity="0.12" wave="0.38" pulse="0.48" speed="0.85" hue="0.62"></lumina-orb>
```

The custom element renders with a WebGL2 GLSL vertex/fragment shader and falls back to CSS where WebGL2 is unavailable. Set live uniform parameters via `document.querySelector('lumina-orb').setParams({intensity:.6, wave:.45, pulse:.55, speed:1.1, hue:.62, mode:'speaking'})`.

Recognized modes are `idle`, `monitoring`, `listening`, `thinking`, `speaking`, `error`. Rendering is limited to 1.75 DPR and pauses when the document is hidden. The component needs no third-party dependencies, build tool, or backend. `assets/lumina-orb.js` exports the `LUMINA_GLSL` fragment source for shader reuse.

## Microphone wake

Auto-listen is **off by default**. Press **Auto-listen off** or enable the corresponding Settings switch to request browser microphone permission; only then does the RMS monitor run. The rolling ambient RMS baseline is compared with the current audio RMS. Trigger when the level exceeds the baseline by at least **10%**, exceeds the absolute noise floor, and persists across **3 audio frames**, with a cooldown. Sensitivity can be adjusted in Settings (10–80%). The wake monitor starts NexusDictation on an eligible rise; it **does not** record or transmit microphone audio and is disabled while Lumina thinks, speaks, or NexusDictation is already transcribing. Tap the orb to start dictation explicitly; tap again during listening to finish the utterance.

This is a **volume trigger, not a wake-word recognizer**. It can fire on background sound. Normal browser microphone permissions prohibit monitoring before user approval. Also note that if the models are still downloading, the microphone cannot provide instant dialogue.

## Preserved UX

- The `NexusDictationBrowser` ESM module is still loaded from its pinned jsDelivr commit.
- LFM2.5-1.2B local Q4 reasoning remains in `esm/`.
- The `NexusVoiceBrowser` ESM module is unchanged and still imported from its pinned commit.
- Model load/retry and download status remain available through the Settings gear.
- Chat history, manual text entry, Clear conversation, and End call remain accessible.
- No CI, framework build pipeline or server endpoint was introduced.

## Validation

Run `node --test tests/*.test.js` locally. Sandbox visual validation used headless Chromium with in-memory model mocks; Chromium supplied no usable WebGL2 context, so a CSS fallback was rendered. Test actual GPU shader compilation, Hugging Face loading, live microphone wake, inference, and speech audio on a target MacBook before calling the release production-ready.