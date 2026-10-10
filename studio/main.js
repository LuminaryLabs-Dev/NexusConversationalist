// Three independent public ESM modules: the two speech engines arrive via jsDelivr.
import { NexusConversationalist, LFMReasoner } from "../esm/index.js";
import { NexusDictation } from "https://cdn.jsdelivr.net/gh/LuminaryLabs-Dev/NexusDictation@main/esm/index.js";
import { NexusVoiceBrowser } from "https://cdn.jsdelivr.net/gh/LuminaryLabs-Dev/NexusVoice@main/esm/index.js";

const $ = id => document.getElementById(id);
let app = null;
function status(text) { $("status").textContent = text; }
function setButtons(isReady, isActive) {
  $("load").disabled = isReady;
  $("start").disabled = !isReady || isActive;
  $("stop").disabled = !isActive;
  $("send").disabled = !isActive;
}
function appendMessage({ role, content }) {
  const box = document.createElement("div"); box.className = "message " + role;
  const label = document.createElement("div"); label.className = "role"; label.textContent = role;
  const text = document.createElement("div"); text.textContent = content;
  box.append(label, text); $("history").append(box);
  $("history").scrollTop = $("history").scrollHeight;
}
$("load").addEventListener("click", async () => {
  const token = $("token").value.trim();
  if (!token) return status("Enter the session token printed by NexusDictation bridge.py.");
  $("load").disabled = true;
  try {
    app = new NexusConversationalist({
      dictator: new NexusDictation({ token }),
      voice: new NexusVoiceBrowser({ backend: "auto" }),
      reasoner: new LFMReasoner({ dtype: "q4" })
    });
    app.on("message", appendMessage);
    app.on("state", s => {
      $("state").textContent = s;
      $("indicator").style.background = s === "listening" ? "#46c5a2" : s === "error" ? "#ff7284" : "#e6b45c";
    });
    app.on("status", s => status((s.module || "model") + ": " + (s.detail || s.message || s.phase || "loading")));
    app.on("error", e => status("Error: " + (e.message || e)));
    status("Loading Parakeet bridge, LFM WebGPU, and Kokoro...");
    await app.initialize();
    $("token").value = "";
    setButtons(true, false);
    status("All three modules initialized. Start a conversation.");
  } catch (error) {
    status("Initialization failed: " + (error.message || error));
    app?.dispose(); app = null; $("load").disabled = false;
  }
});
$("start").addEventListener("click", async () => {
  try { await app.start(); setButtons(true, true); status("Listening. Speak and pause to get a reply."); }
  catch (error) { status("Could not start microphone: " + error.message); setButtons(true, false); }
});
$("stop").addEventListener("click", async () => {
  try { await app.stop(); status("Stopped."); } catch (error) { status(error.message); }
  setButtons(true, false);
});
$("send-form").addEventListener("submit", async event => {
  event.preventDefault();
  const text = $("text").value.trim();
  if (!text || !app) return;
  $("text").value = "";
  try { await app.send(text); } catch (error) { status(error.message); }
});
window.addEventListener("beforeunload", () => app?.dispose());
