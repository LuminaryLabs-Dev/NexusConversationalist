import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {LuminaReflexKit,routeReflex,chooseEventClip} from "../esm/reflex/index.js";
import {ReflexAudioScheduler} from "../esm/reflex/audio-scheduler.js";
import {createLuminaSpeechProvider} from "../esm/reflex/nexusengine-adapter.js";
import {NexusConversationalist} from "../esm/index.js";
const manifest=JSON.parse(await readFile(new URL("../audio/lumina/manifest.json",import.meta.url),"utf8"));
const wav=()=>{const x=new Uint8Array(60);x.set([82,73,70,70],0);x.set([87,65,86,69],8);x[46]=42;return x.buffer;};
function fixture(){
 const memory=new Map(),scheduler={count:0,stop(){},async play(){this.count++;return true}};
 const voice={generations:0,speeches:0,async generate(){this.generations++;return wav();},
  async speak(){this.speeches++},async load(){},stop(){},on(){return ()=>{}}};
 const reflex=new LuminaReflexKit({manifest,voice,scheduler,store:{
   get:async k=>memory.get(k)||null,set:async(k,v)=>{memory.set(k,v)}
 }});
 const dictator={on(){return ()=>{}},async health(){return {ready:true}},async start(){},async stop(){}};
 const reasoner={calls:0,on(){return ()=>{}},async load(){},async respond(){this.calls++;return "Dynamic answer."}};
 return {reflex,voice,scheduler,dictator,reasoner};
}
test("43 distinct authored phrases, none pretending to be generated",()=>{
 assert.equal(manifest.clips.length,43);
 assert.equal(new Set(manifest.clips.map(x=>x.id)).size,43);
 assert.ok(manifest.clips.every(x=>x.voice==="af_heart"&&!x.generated));
});
test("only safe complete utterances bypass the model",()=>{
 assert.equal(routeReflex("Hey Lumina",manifest).text,"Hey!");
 assert.equal(routeReflex("Hey Lumina send my email",manifest),null);
 assert.equal(routeReflex("Explain Newton's laws",manifest),null);
 assert.equal(chooseEventClip("actions_completed",manifest),null);
 assert.equal(chooseEventClip("actions_completed",manifest,{confirmed:true}).text,"Done.");
});
test("missing clip allows fallback, generated WAV is cached",async()=>{
 const f=fixture();
 assert.equal(await f.reflex.play("greetings.hey"),false);
 await f.reflex.prepare("greetings.hey");await f.reflex.prepare("greetings.hey");
 assert.equal(f.voice.generations,1);
 assert.equal(await f.reflex.play("greetings.hey",{ignoreCooldown:true}),true);
});
test("scheduler respects priority and cancels before overlapping clips",async()=>{
 const players=[],revoked=[];
 const scheduler=new ReflexAudioScheduler({createAudio:()=>{
    const player={pause(){},async play(){}};players.push(player);return player;},
   URLAPI:{createObjectURL:()=>String(players.length+1),revokeObjectURL:u=>revoked.push(u)}});
 const low=scheduler.play({bytes:wav()},{priority:40});
 assert.equal(await scheduler.play({bytes:wav()},{priority:10}),false);
 const high=scheduler.play({bytes:wav()},{priority:100});
 assert.equal(await low,false);players.at(-1).onended();
 assert.equal(await high,true);assert.equal(revoked.length,2);
});
test("greeting bypasses LFM and novel question invokes LFM plus NexusVoice",async()=>{
 const f=fixture();await f.reflex.prepare("greetings.hey");
 const app=new NexusConversationalist({dictator:f.dictator,voice:f.voice,reasoner:f.reasoner,reflex:f.reflex});
 await app.start({listen:false});
 await app.send("Hey Lumina");
 assert.equal(f.reasoner.calls,0);assert.equal(f.scheduler.count,1);
 await app.send("Why is the sky blue?");
 assert.equal(f.reasoner.calls,1);assert.equal(f.voice.speeches,1);
 await app.stop();
});
test("NexusEngine Speech Kit adapter returns authored speech descriptors",async()=>{
 const f=fixture(), provider=createLuminaSpeechProvider(f.reflex);
 const result=await provider.synthesize({id:"greetings.hey",text:"Hey!"});
 assert.equal(result.generatedAssetId,"lumina:clip:greetings.hey");
 assert.equal(result.sampleRate,24000);
});
