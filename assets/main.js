// Static GitHub Pages app. Independent speech engines are pinned ESM modules.
import { NexusConversationalist, LFMReasoner } from "../esm/index.js";
import { NexusDictationBrowser } from "https://cdn.jsdelivr.net/gh/LuminaryLabs-Dev/NexusDictation@dfaf2ccb601b70b04e678db777a39a6900949bfc/esm/browser.js";
import { NexusVoiceBrowser } from "https://cdn.jsdelivr.net/gh/LuminaryLabs-Dev/NexusVoice@300549e2e5690d84f570705f7e627ce0a1e92ce0/esm/index.js";

const $ = id => document.getElementById(id);
const MODELS = [
  { module: "dictation", label: "Parakeet · NexusDictation", status: "asr-status" },
  { module: "lfm", label: "LFM2.5 · NexusConversationalist", status: "llm-status" },
  { module: "voice", label: "Kokoro · NexusVoice", status: "tts-status" }
];
let app = null, initialized = false, loading = false, current = -1;
const completed = new Set();
function report(value) { $("status").textContent = value; }
function controls() {
  $("load").disabled = loading || initialized;
  $("start").disabled = !initialized || app?.listeningEnabled || (app?.active && app.state !== "ready");
  $("stop").disabled = !app?.active;
  $("send").disabled = !initialized;
}
function setState(value) {
  $("state").textContent = value;
  $("state-dot").style.background = value === "listening" ? "#4ed3ac" : value === "error" ? "#fa7a83" : "#edbd64";
  controls();
}
function addMessage({ role, content }) {
  $("history").querySelector(".empty")?.remove();
  const line = document.createElement("div");
  line.className = "message " + (role === "user" ? "user" : "assistant");
  const title = document.createElement("div"); title.className = "role"; title.textContent = role;
  const body = document.createElement("div"); body.textContent = content;
  line.append(title, body);
  $("history").append(line);
  $("history").scrollTop = $("history").scrollHeight;
}
function updateProgress(event) {
  const i = MODELS.findIndex(model => model.module === event.module);
  if (i < 0 || i < current || (i === current && completed.has(event.module))) return;
  const model = MODELS[i];
  if (i !== current) {
    current = i;
    $("progress-model").textContent = model.label;
    $("progress-step").textContent = "Model " + (i + 1) + " of 3";
    $("download-progress").removeAttribute("value");
    $("progress-percent").textContent = "Preparing…";
    $("progress-bytes").textContent = "Transfer size not yet available";
  }
  const detail = event.detail || event.message || event.phase || "Loading";
  $(model.status).textContent = detail;
  if (event.phase === "ready") {
    completed.add(model.module);
    $("download-progress").value = 100;
    $("progress-percent").textContent = "Ready · 100%";
    $("progress-bytes").textContent = "Model " + (i + 1) + " of 3 complete";
  } else if (Number.isFinite(event.totalBytes) && event.totalBytes > 0 && Number.isFinite(event.loadedBytes)) {
    const loaded = Math.max(0, Math.min(event.totalBytes, event.loadedBytes));
    const percentage = Math.min(99, Math.max(0, loaded / event.totalBytes * 100));
    $("download-progress").value = percentage;
    $("progress-percent").textContent = percentage.toFixed(1) + "%";
    $("progress-bytes").textContent = (loaded / 1e6).toFixed(1) + " / " + (event.totalBytes / 1e6).toFixed(1) + " MB";
  } else if (Number.isFinite(event.percent) && event.percent < 100) {
    $("download-progress").value = Math.min(99, Math.max(0, event.percent));
    $("progress-percent").textContent = event.percent.toFixed(1) + "%";
  }
  report(model.label + ": " + detail);
}
function resetProgress() {
  completed.clear(); current = -1;
  $("download-panel").hidden = false;
  $("download-progress").removeAttribute("value");
  $("progress-model").textContent = "Preparing models";
  $("progress-step").textContent = "Model 1 of 3";
  $("progress-percent").textContent = "Preparing…";
  $("progress-bytes").textContent = "Transfer size not yet available";
  for (const model of MODELS) $(model.status).textContent = "Waiting to load";
}
$("load").addEventListener("click", async () => {
  loading = true; controls(); resetProgress(); $("load").textContent = "Loading…";
  try {
    if (!navigator.gpu || !await navigator.gpu.requestAdapter())
      throw new Error("WebGPU is unavailable. Use current desktop Chrome with GPU acceleration enabled.");
    app = new NexusConversationalist({
      dictator: new NexusDictationBrowser(),
      voice: new NexusVoiceBrowser({ backend: "auto" }),
      reasoner: new LFMReasoner({ dtype: "q4", maxTokens: 110 })
    });
    app.on("message", addMessage);
    app.on("state", setState);
    app.on("partial", t => { $("partial").textContent = t.text; });
    app.on("status", updateProgress);
    app.on("error", e => report("Error: " + (e.message || e)));
    await app.initialize();
    initialized = true;
    $("load").textContent = "Models loaded";
    $("progress-model").textContent = "All 3 models ready";
    $("progress-step").textContent = "3 of 3";
    $("progress-percent").textContent = "Ready";
    $("progress-bytes").textContent = "Model inference runs locally";
    $("download-progress").value = 100;
    setState("Models ready");
    report("All models are ready. Start listening or type a message.");
  } catch (error) {
    const label = current >= 0 ? MODELS[current].label : "WebGPU";
    report("Initialization failed at " + label + ": " + (error.message || error) + ". Select Retry models.");
    if (current >= 0) $(MODELS[current].status).textContent = "Error · Retry available";
    $("progress-model").textContent = "Could not load " + label;
    $("progress-percent").textContent = "Failed";
    app?.dispose(); app = null; initialized = false;
    $("load").textContent = "Retry models";
    setState("Load failed");
  } finally { loading = false; controls(); }
});
$("start").addEventListener("click", async () => {
  try { await app.start(); controls(); report("Listening. Speak and pause to send a message."); }
  catch (e) { report("Microphone error: " + e.message); controls(); }
});
$("stop").addEventListener("click", async () => {
  try { await app.stop(); report("Stopped."); } catch (e) { report("Stop failed: " + e.message); }
  $("partial").textContent = ""; setState("Stopped");
});
$("send-form").addEventListener("submit", async event => {
  event.preventDefault(); if (!app) return;
  const message = $("text").value.trim(); if (!message) return;
  $("text").value = ""; $("send").disabled = true;
  try {
    if (!app.active) await app.start({ listen: false });
    await app.send(message); $("partial").textContent = "";
  } catch (error) { report("Message failed: " + (error.message || error)); }
  finally { controls(); }
});
$("clear").addEventListener("click", () => { if (app) app.messages.length = 0; $("history").replaceChildren(); });
window.addEventListener("beforeunload", () => { try { app?.dispose(); } catch {} });
controls();
