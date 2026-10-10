// LFM inference worker: official LiquidAI ONNX export, Q4 WebGPU.
const scope = self;
const MODEL = "LiquidAI/LFM2.5-1.2B-Instruct-ONNX";
let tokenizer, model, loading, TextStreamer;
async function ensure(dtype) {
  if (model) return;
  if (loading) return loading;
  loading = (async () => {
    scope.postMessage({ type: "status", phase: "loading", detail: "Downloading LFM2.5 Q4 from Hugging Face" });
    const tf = await import("https://esm.sh/@huggingface/transformers@3.8.1?bundle");
    TextStreamer = tf.TextStreamer;
    tokenizer = await tf.AutoTokenizer.from_pretrained(MODEL);
    model = await tf.AutoModelForCausalLM.from_pretrained(MODEL, { device: "webgpu", dtype });
    scope.postMessage({ type: "status", phase: "ready", detail: "LFM WebGPU ready" });
  })();
  try { return await loading; } catch (error) { loading = null; throw error; }
}
scope.onmessage = async ({ data }) => {
  const { type, id, dtype = "q4" } = data;
  try {
    await ensure(dtype);
    if (type === "load") {
      scope.postMessage({ type: "result", id, model: MODEL });
      return;
    }
    if (type !== "generate") throw new Error("Unknown LFM worker command");
    const input = tokenizer.apply_chat_template(data.messages, {
      add_generation_prompt: true, return_dict: true
    });
    let fragments = "";
    const streamer = new TextStreamer(tokenizer, {
      skip_prompt: true, skip_special_tokens: true,
      callback_function: text => { fragments += text; }
    });
    const output = await model.generate({
      ...input, max_new_tokens: data.maxTokens || 110,
      do_sample: false, streamer
    });
    if (!fragments.trim()) {
      const all = output.tolist()[0];
      const length = input.input_ids.dims.at(-1);
      fragments = tokenizer.decode(all.slice(length), { skip_special_tokens: true });
    }
    scope.postMessage({ type: "result", id, text: fragments.trim() });
  } catch (error) {
    scope.postMessage({ type: "error", id, message: String(error?.message || error) });
  }
};
