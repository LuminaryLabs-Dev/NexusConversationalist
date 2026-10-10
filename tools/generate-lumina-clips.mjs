#!/usr/bin/env node
// Offline batch synthesis using the existing NexusVoice Node engine, never fake audio.
import {readFile,writeFile,mkdir,stat} from "node:fs/promises";
import {createRequire} from "node:module";
import {resolve,join,dirname} from "node:path";
import {createHash} from "node:crypto";
import {spawn} from "node:child_process";
import {fileURLToPath} from "node:url";
const directory=resolve(dirname(fileURLToPath(import.meta.url)),"../audio/lumina");
const manifest=JSON.parse(await readFile(join(directory,"manifest.json"),"utf8"));
const arg=process.argv.indexOf("--nexusvoice");
const voiceRoot=resolve(arg>=0?process.argv[arg+1]:"../NexusVoice");
const engineFile=join(voiceRoot,"node","engine.cjs");
let engine;
try {engine=createRequire(engineFile)(engineFile);}
catch(e) {console.error("Install NexusVoice Node dependencies first: "+e.message);process.exit(1);}
const run=(program,args)=>new Promise((resolve,reject)=>{
 const child=spawn(program,args,{stdio:["ignore","ignore","pipe"]});let err="";
 child.stderr.on("data",d=>err+=d);child.on("error",reject);
 child.on("exit",code=>code===0?resolve():reject(new Error(err)));
});
for(const [i,clip] of manifest.clips.entries()) {
 console.log((i+1)+"/"+manifest.clips.length+": "+clip.text);
 const wavFile=join(directory,clip.master),opusFile=join(directory,clip.web);
 await mkdir(dirname(wavFile),{recursive:true});
 const result=await engine.synthesize({text:clip.text,voice:"af_heart",speed:.96});
 const wav=result.wav;
 if(!Buffer.isBuffer(wav)||wav.length<60||wav.toString("ascii",0,4)!=="RIFF"||
    wav.toString("ascii",8,12)!=="WAVE"||!wav.subarray(44).some(x=>x!==0))
    throw Error("Invalid Kokoro WAV: "+clip.id);
 await writeFile(wavFile,wav);
 await run("ffmpeg",["-hide_banner","-loglevel","error","-y","-i",wavFile,
   "-ar","24000","-ac","1","-c:a","libopus","-b:a","40k",opusFile]);
 const opus=await readFile(opusFile);
 if(opus.toString("ascii",0,4)!=="OggS"||(await stat(opusFile)).size<500)
   throw Error("Invalid Opus: "+clip.id);
 clip.generated=true;
 clip.sha256=createHash("sha256").update(opus).digest("hex");
 clip.durationMs=Math.round(result.samples/result.sampleRate*1000);
}
manifest.generatedAt=new Date().toISOString();
await writeFile(join(directory,"manifest.json"),JSON.stringify(manifest,null,2)+"\n");
console.log("Verified "+manifest.clips.length+" Kokoro clips");
