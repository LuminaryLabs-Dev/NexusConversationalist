import test from "node:test";
import assert from "node:assert/strict";
import { createDownloadProgress } from "../esm/download-progress.js";
import { NexusConversationalist } from "../esm/index.js";

test("tracks actual bytes without inventing missing totals", () => {
  const events=[];
  const progress=createDownloadProgress(e=>events.push(e));
  progress({status:"initiate",file:"a.onnx"});
  assert.equal(events.at(-1).totalBytes,undefined);
  progress({status:"progress",file:"a.onnx",loaded:50,total:100});
  progress({status:"progress",file:"b.onnx",loaded:25,total:100});
  assert.equal(events.at(-1).loadedBytes,75);
  assert.equal(events.at(-1).totalBytes,200);
  assert.equal(events.at(-1).percent,37.5);
  progress({status:"done",file:"a.onnx"});
  assert.equal(events.at(-1).percent,62.5);
  progress({status:"progress_total",loaded:200,total:200,progress:100});
  assert.equal(events.at(-1).percent,99);
});
test("loads sequentially and retries after a failed LFM initialization", async () => {
  const order=[];
  const dict={on:()=>()=>{},async health(){order.push("asr");return {ready:true};},async stop(){}};
  const llm={on:()=>()=>{},tries:0,async load(){order.push("lfm");if(++this.tries===1)throw new Error("transient failure");}};
  const voice={on:()=>()=>{},async load(){order.push("tts");},stop(){}};
  const app=new NexusConversationalist({dictator:dict,reasoner:llm,voice});
  await assert.rejects(app.initialize(),/transient failure/);
  assert.deepEqual(order,["asr","lfm"]);
  await app.initialize();
  assert.deepEqual(order,["asr","lfm","asr","lfm","tts"]);
});
