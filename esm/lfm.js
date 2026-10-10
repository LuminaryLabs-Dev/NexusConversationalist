/** LFM2.5-1.2B local inference, owned solely by NexusConversationalist. */
export const LFM_MODEL = "LiquidAI/LFM2.5-1.2B-Instruct-ONNX";
export const LFM_CARD = "https://huggingface.co/" + LFM_MODEL;

export class LFMReasoner {
  constructor({ dtype = "q4", maxTokens = 110, systemPrompt =
    "You are a concise, helpful voice assistant. Respond conversationally in one to three short sentences. Do not claim to execute application actions. Avoid markdown." ,
    workerFactory } = {}) {
    this.dtype = dtype;
    this.maxTokens = maxTokens;
    this.systemPrompt = systemPrompt;
    this.workerFactory = workerFactory;
    this.pending = new Map();
    this.sequence = 0;
    this.events = new Map();
    this.disposed = false;
  }
  on(event, fn) {
    if (!this.events.has(event)) this.events.set(event, new Set());
    this.events.get(event).add(fn);
    return () => this.events.get(event)?.delete(fn);
  }
  emit(type, data) { for (const fn of this.events.get(type) || []) fn(data); }
  ensureWorker() {
    if (this.worker) return;
    if (this.disposed) throw new Error("LFM reasoner disposed");
    if (this.workerFactory) this.worker = this.workerFactory();
    else {
      if (typeof Worker === "undefined" || !globalThis.navigator?.gpu) {
        throw new Error("LFM2.5 browser backend requires a WebGPU-capable browser");
      }
      const url = new URL("./lfm-worker.js", import.meta.url).href;
      const blobURL = URL.createObjectURL(new Blob(["import " + JSON.stringify(url) + ";"], { type: "text/javascript" }));
      try { this.worker = new Worker(blobURL, { type: "module" }); }
      finally { URL.revokeObjectURL(blobURL); }
    }
    this.worker.onmessage = ({ data }) => {
      if (data.type === "status") { this.emit("status", data); return; }
      const pending = this.pending.get(data.id);
      if (!pending) return;
      this.pending.delete(data.id);
      if (data.type === "error") pending.reject(new Error(data.message));
      else pending.resolve(data);
    };
    this.worker.onerror = e => {
      const error = new Error(e.message || "LFM model worker failed");
      for (const p of this.pending.values()) p.reject(error);
      this.pending.clear();
      this.emit("error", error);
    };
  }
  request(type, fields = {}) {
    this.ensureWorker();
    const id = String(++this.sequence);
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ type, id, dtype: this.dtype, ...fields });
    });
  }
  async load() {
    if (this.loaded) return;
    if (!this.loading) this.loading = this.request("load").then(x => {
      this.loaded = true; return x;
    }).catch(e => { this.loading = null; throw e; });
    return this.loading;
  }
  async respond(messages) {
    await this.load();
    const recent = messages.slice(-16).map(({ role, content }) => ({ role, content }));
    const result = await this.request("generate", {
      messages: [{ role: "system", content: this.systemPrompt }, ...recent],
      maxTokens: this.maxTokens
    });
    const text = String(result.text || "").trim();
    if (!text) throw new Error("LFM returned no response");
    return text;
  }
  dispose() {
    this.disposed = true;
    for (const p of this.pending.values()) p.reject(new Error("LFM disposed"));
    this.pending.clear();
    this.worker?.terminate();
    this.worker = null;
  }
}
