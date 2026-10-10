import {IndexedClipStore,isWavBuffer} from "./clip-store.js";
import {ReflexAudioScheduler} from "./audio-scheduler.js";
import {routeReflex,chooseEventClip} from "./reflex-router.js";
export class LuminaReflexKit {
  constructor({manifest,voice,store=new IndexedClipStore(),scheduler=new ReflexAudioScheduler(),
    fetcher=globalThis.fetch?.bind(globalThis),baseUrl=new URL("../../audio/lumina/",import.meta.url),
    onEvent=()=>{}}={}) {
    if(!manifest||!Array.isArray(manifest.clips)||!voice)throw new Error("Manifest and NexusVoice required");
    Object.assign(this,{manifest,voice,store,scheduler,fetcher,baseUrl,onEvent});
    this.cooldowns=new Map();this.cache=new Map();this.inflight=new Map();this.epoch=0;
  }
  route(text){return routeReflex(text,this.manifest);}
  event(name,options){return chooseEventClip(name,this.manifest,options);}
  getClip(id){return this.manifest.clips.find(c=>c.id===id)||null;}
  async load(id) {
    if(this.cache.has(id))return this.cache.get(id);
    const clip=this.getClip(id);if(!clip)return null;
    let record=await this.store.get(id).catch(()=>null);
    if(!record&&clip.generated&&clip.web&&this.fetcher) {
      const response=await this.fetcher(new URL(clip.web,this.baseUrl)).catch(()=>null);
      if(response?.ok)record={bytes:await response.arrayBuffer(),mimeType:"audio/ogg"};
    }
    if(record)this.cache.set(id,record);
    return record;
  }
  async prepare(id) {
    const clip=this.getClip(id);if(!clip)return false;
    if(await this.load(id))return true;
    if(this.inflight.has(id))return this.inflight.get(id);
    const task=(async()=>{
      const wav=await this.voice.generate(clip.text,{voice:clip.voice,speed:.96});
      if(!isWavBuffer(wav))throw new Error("Invalid NexusVoice WAV: "+id);
      const record={bytes:wav,mimeType:"audio/wav"};
      await this.store.set(id,record).catch(()=>false);
      this.cache.set(id,record);
      this.onEvent({type:"clip-ready",id});
      return true;
    })();
    this.inflight.set(id,task);
    try{return await task;}finally{this.inflight.delete(id);}
  }
  async prepareAll({ids=this.manifest.clips.map(c=>c.id),signal}={}) {
    let done=0,failures=0;
    for(const id of ids){
      if(signal?.aborted)break;
      try{await this.prepare(id);}catch(error){
        failures++;this.onEvent({type:"clip-error",id,message:error.message});
      }
      done++;this.onEvent({type:"pack-progress",done,total:ids.length,failures});
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    return {done,total:ids.length,failures};
  }
  async play(id,{priority,ignoreCooldown=false,signal}={}) {
    const clip=this.getClip(id);if(!clip)return false;
    if(!ignoreCooldown&&Date.now()<(this.cooldowns.get(id)||0))return false;
    const epoch=this.epoch;
    const record=await this.load(id);
    if(epoch!==this.epoch||signal?.aborted||!record)return false;
    const played=await this.scheduler.play(record,{priority:priority??clip.priority,signal});
    if(played)this.cooldowns.set(id,Date.now()+clip.cooldownMs);
    return played;
  }
  stop(){this.epoch++;this.scheduler.stop();}
}
export {routeReflex,chooseEventClip,IndexedClipStore,ReflexAudioScheduler};
