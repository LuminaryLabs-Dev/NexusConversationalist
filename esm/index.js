import { LFMReasoner, LFM_MODEL, LFM_CARD } from "./lfm.js";
export { LFMReasoner, LFM_MODEL, LFM_CARD };

export class NexusConversationalist {
  constructor({ dictator, voice, reasoner = new LFMReasoner(), maxMessages = 16 } = {}) {
    if (!dictator || !voice || !reasoner) throw new Error("Dictation, voice and reasoning adapters required");
    this.dictator = dictator;
    this.voice = voice;
    this.reasoner = reasoner;
    this.maxMessages = maxMessages;
    this.messages = [];
    this.events = new Map();
    this.completed = new Set();
    this.state = "idle";
    this.active = false;
    this.listeningEnabled = false;
    this.generation = 0;
    this.initialized = false;
    this.actions = new Map();
    this.offDictation = [
      dictator.on("partial", t => this.emit("partial", t)),
      dictator.on("final", t => { void this.receiveFinal(t); }),
      dictator.on("status", s => this.emit("status", { module: "dictation", ...s })),
      dictator.on("error", e => this.emit("error", e))
    ];
    this.reasoner.on?.("status", s => this.emit("status", { module: "lfm", ...s }));
    this.voice.on?.("status", s => this.emit("status", { module: "voice", ...s }));
  }
  on(event, handler) {
    if (!this.events.has(event)) this.events.set(event, new Set());
    this.events.get(event).add(handler);
    return () => this.events.get(event)?.delete(handler);
  }
  emit(event, data) { for (const fn of this.events.get(event) || []) fn(data); }
  setState(state) { this.state = state; this.emit("state", state); }
  async initialize() {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      const health = await this.dictator.health();
      if (!health?.ready) throw new Error("NexusDictation bridge not ready");
      await Promise.all([this.reasoner.load(), this.voice.load()]);
      this.initialized = true;
      this.emit("ready", { dictation: health.model, reasoning: LFM_MODEL });
    })();
    try { return await this.initPromise; }
    catch (e) { this.initPromise = null; this.emit("error", e); throw e; }
  }
  async start({ listen = true } = {}) {
    await this.initialize();
    if (this.active && (!listen || this.listeningEnabled)) return;
    if (!this.active) { this.active = true; ++this.generation; }
    if (!listen) { this.setState("ready"); return; }
    try {
      await this.dictator.start();
      this.listeningEnabled = true;
      this.setState("listening");
    } catch (error) {
      this.active = false;
      this.listeningEnabled = false;
      this.setState("error");
      this.emit("error", error);
      throw error;
    }
  }
  async receiveFinal(event) {
    if (!this.active || !event?.isFinal || !event.text?.trim()) return;
    if (this.state === "thinking" || this.state === "speaking") return;
    if (this.completed.has(event.utteranceId)) return;
    this.completed.add(event.utteranceId);
    if (this.completed.size > 100) this.completed.delete(this.completed.values().next().value);
    return this.process(event.text.trim());
  }
  async send(text) {
    if (!this.active) throw new Error("Start a conversation before sending");
    if (!text || !text.trim()) return;
    if (this.state === "thinking" || this.state === "speaking") throw new Error("Turn already in progress");
    if (this.listeningEnabled) await this.dictator.stop({ finalize: false });
    return this.process(text.trim());
  }
  async process(text) {
    if (!this.active || this.state === "thinking" || this.state === "speaking") return;
    const turn = this.generation;
    this.setState("thinking");
    this.addMessage("user", text);
    try {
      const reply = await this.reasoner.respond(this.messages);
      if (!this.active || turn !== this.generation) return;
      this.addMessage("assistant", reply);
      this.setState("speaking");
      await this.voice.speak(reply);
      if (!this.active || turn !== this.generation) return;
      if (this.listeningEnabled) {
        await this.dictator.start();
        this.setState("listening");
      } else this.setState("ready");
    } catch (error) {
      if (!this.active || turn !== this.generation) return;
      this.active = false;
      this.listeningEnabled = false;
      this.setState("error");
      this.emit("error", error);
    }
  }
  addMessage(role, content) {
    const message = { role, content, timestamp: Date.now() };
    this.messages.push(message);
    if (this.messages.length > this.maxMessages) this.messages.splice(0, this.messages.length - this.maxMessages);
    this.emit("message", message);
  }
  registerAction(name, { execute, authorize } = {}) {
    if (!/^[a-zA-Z][\w.:-]{0,80}$/.test(name) || typeof execute !== "function" || typeof authorize !== "function") {
      throw new Error("Actions require a valid name, execute and authorize callbacks");
    }
    this.actions.set(name, { execute, authorize });
    return () => this.actions.delete(name);
  }
  async performAction(name, args) {
    const action = this.actions.get(name);
    if (!action) throw new Error("Action is not registered");
    if (!await action.authorize(args)) throw new Error("Action was not authorized");
    return action.execute(args);
  }
  async stop() {
    ++this.generation;
    this.active = false;
    this.listeningEnabled = false;
    this.voice.stop();
    try { await this.dictator.stop({ finalize: false }); }
    finally { this.setState("idle"); }
  }
  dispose() {
    ++this.generation;
    this.active = false;
    this.listeningEnabled = false;
    this.voice.stop();
    void this.dictator.stop({ finalize: false });
    for (const unsub of this.offDictation) unsub?.();
    this.reasoner.dispose?.();
    this.voice.dispose?.();
    this.dictator.dispose?.();
    this.events.clear();
    this.setState("idle");
  }
}
