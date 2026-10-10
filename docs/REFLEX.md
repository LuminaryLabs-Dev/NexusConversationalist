# Lumina Reflex Kit

Lumina has three response paths: instant safe reflexes, NexusDictation speech recognition, and LFM2.5/NexusVoice for open-ended dialogue.

## Audio assets

The shared Drive Luminary-Models folder contains the Kokoro-82M model and af_heart voice. The 43-entry audio/lumina/manifest.json is an authored catalog, with generated=false until real output is validated.

In browser Settings, Prepare all 43 voice clips invokes the already loaded NexusVoice Kokoro model, saves WAV audio into IndexedDB, and makes subsequent playback immediate. The first four frequently used clips are prepared after model initialization.

To create deployable prerecorded assets using NexusVoice Node and ffmpeg after installing its dependencies:

    cd ../NexusVoice/node
    npm ci --onnxruntime-node-install-cuda=skip
    npm run model:download
    cd ../../NexusConversationalist
    node tools/generate-lumina-clips.mjs --nexusvoice ../NexusVoice

The batch script validates non-silent 24k mono WAV, converts to Opus, records checksums and durations, and updates the manifest. Generated opus files can then be committed for direct GitHub Pages delivery.

## Rules

- Only complete short utterances use the reflex bypass. Open-ended requests keep LFM2.5 and dynamic NexusVoice.
- A missing recording falls back to NexusVoice rather than claiming instant playback.
- Unverified action completion, consent, and agreement never trigger affirmative prerecorded clips.
- A noncommittal cached acknowledgment can play while LFM is thinking and is canceled when the answer arrives.
- Playback is single-channel, prioritized and cancelable. The existing turn manager continues microphone gating.
- NexusEngine integration uses a separate opt-in Speech Kit provider adapter without changing engine Core.
- No new CI workflows.

## Verification

Run node --test tests/*.test.js locally. Verify the actual model, audio generation, IndexedDB cache, and interruption behavior on the target MacBook with WebGPU. This sandbox cannot install the required NexusVoice Node runtime dependencies, so 43 deployable Kokoro audio files have not been generated here.
