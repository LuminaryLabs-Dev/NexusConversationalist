import test from "node:test";
import assert from "node:assert/strict";
import { NexusConversationalist } from "../esm/index.js";

function fakes() {
  const listeners = new Map();
  const emit = (name, value) => { for (const fn of listeners.get(name) || []) fn(value); };
  const dictator = {
    running:false, health:async()=>({ready:true,model:"mock-redux"}),
    on(name,fn){ if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);return ()=>listeners.get(name).delete(fn); },
    async start(){ this.running=true; },async stop(){this.running=false;}
  };
  const voice = { count:0, stopped:false, on(){return ()=>{};},async load(){},
    async speak(text){this.count++;this.last=text;},stop(){this.stopped=true;} };
  const reasoner = {async load(){},on(){return ()=>{};},async respond(messages){ return "Echo: " + messages.at(-1).content;}};
  return { dictator, voice, reasoner, emit };
}
test("initialize/start and turn alternates without transcribing preview", async () => {
 const f=fakes();const app=new NexusConversationalist(f);
 await app.initialize();await app.start();
 assert.equal(app.state,"listening");
 f.emit("partial",{text:"not final",utteranceId:"a",isFinal:false});
 assert.equal(f.voice.count,0);
 await app.receiveFinal({text:"hi",utteranceId:"a",isFinal:true});
 assert.equal(app.state,"listening"); assert.equal(f.voice.last,"Echo: hi");
 assert.equal(f.voice.count,1);
 await app.receiveFinal({text:"hi",utteranceId:"a",isFinal:true});
 assert.equal(f.voice.count,1);
 await app.stop();assert.equal(app.state,"idle");assert.equal(f.dictator.running,false);
});
test("host actions require explicit authorization", async () => {
 const f=fakes();const app=new NexusConversationalist(f);
 assert.throws(()=>app.registerAction("task.create",{execute:()=>true}),/authorize/);
 app.registerAction("task.create",{authorize:async()=>false,execute:async()=>true});
 await assert.rejects(app.performAction("task.create",{}),/not authorized/);
 app.registerAction("task.create",{authorize:async()=>true,execute:async()=>({ok:true})});
 assert.deepEqual(await app.performAction("task.create",{}),{ok:true});
});
test("manual text enters same reasoning/voice loop",async()=>{
 const f=fakes();const app=new NexusConversationalist(f);
 await app.start();await app.send("test");
 assert.equal(f.voice.last,"Echo: test");assert.equal(app.state,"listening");await app.stop();
});
