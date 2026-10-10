import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NexusConversationalist } from "../esm/index.js";
test("Pages site has root static assets without bridge token", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /assets\/main.js/);
  assert.match(html, /Parakeet TDT v3/);
  assert.doesNotMatch(html, /session token|bridge.py/);
});
test("Text-only session does not request microphone", async () => {
  let count = 0, voiceCount = 0;
  const dictation = { on:()=>()=>{}, health:async()=>({ready:true}), start:async()=>{count++},stop:async()=>{} };
  const voice = { on:()=>()=>{}, load:async()=>{},speak:async()=>{voiceCount++},stop:()=>{} };
  const reasoner = { on:()=>()=>{},load:async()=>{},respond:async()=>"A short reply." };
  const app = new NexusConversationalist({ dictator:dictation,voice,reasoner });
  await app.start({listen:false});
  await app.send("Hello");
  assert.equal(count,0);
  assert.equal(voiceCount,1);
  assert.equal(app.state,"ready");
  await app.start();
  assert.equal(count,1);
  await app.stop();
});
