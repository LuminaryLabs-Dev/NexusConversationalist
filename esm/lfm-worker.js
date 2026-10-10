// Official LiquidAI LFM2.5-1.2B Q4 WebGPU model. Direct CDN ESM import is documented by Hugging Face.
import { createDownloadProgress } from "./download-progress.js";
const MODEL = "LiquidAI/LFM2.5-1.2B-Instruct-ONNX";
const TRANSFORMERS_ESM = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1";
let tokenizer, model, loading, tf;
function status(data) { self.postMessage({ type: "status", ...data }); }
async function setup(dtype) {
  if (model) return;
  if (loading) return loading;
  loading = (async () => {
    status({ phase: "loading", detail: "Importing Transformers.js from jsDelivr" });
    tf = await import(TRANSFORMERS_ESM);
    if (!tf.AutoTokenizer || !tf.AutoModelForCausalLM) throw new Error("Transformers.js ESM exports are unavailable");
    const download = createDownloadProgress(status);
    status({ phase: "loading", detail: "Loading LFM tokenizer" });
    tokenizer = await tf.AutoTokenizer.from_pretrained(MODEL, { progress_callback: download });
    status({ phase: "loading", detail: "Loading LFM Q4 WebGPU model" });
    model = await tf.AutoModelForCausalLM.from_pretrained(MODEL, {
      device: "webgpu", dtype, progress_callback: download
    });
    status({ phase: "ready", detail: "LFM Q4 WebGPU ready", percent: 100 });
  })();
  try { await loading; } catch (error) { loading = null; model = null; throw error; }
}
self.onmessage = async ({ data }) => {
  const { type, id, dtype = "q4" } = data;
  try {
    await setup(dtype);
    if (type === "load") return self.postMessage({ type: "result", id, model: MODEL });
    if (type !== "generate") throw new Error("Unknown LFM worker command");
    const input = tokenizer.apply_chat_template(data.messages, {
      add_generation_prompt: true, return_dict: true
    });
    let fragments = "";
    const streamer = new tf.TextStreamer(tokenizer, {
      skip_prompt: true, skip_special_tokens: true,
      callback_function: text => { fragments += text; }
    });
    const output = await model.generate({
      ...input, max_new_tokens: data.maxTokens || 110, do_sample: false, streamer
    });
    if (!fragments.trim()) {
      const all = output.tolist()[0];
      fragments = tokenizer.decode(all.slice(input.input_ids.dims.at(-1)), { skip_special_tokens: true });
    }
    self.postMessage({ type: "result", id, text: fragments.trim() });
  } catch (error) {
    self.postMessage({ type: "error", id, message: String(error?.message || error) });
  }
};
