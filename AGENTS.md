# Agent guide

Only this repo owns turn management, LFM2.5-1.2B reasoning, and app authorization. Do not copy the NexusDictation Photon implementation or NexusVoice Kokoro inference into this repo. The standalone JS ESM imports are the integration boundary. Keep partial transcripts inert and gate capture during spoken output. No unverified test claims. Run `node --test tests/*.test.js` and complete live MacBook checks before release.
