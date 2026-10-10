/** Single playback channel with cancellation, priority, and no overlap. */
export class ReflexAudioScheduler {
  constructor({createAudio=()=>new Audio(),URLAPI=globalThis.URL}={}) {
    this.createAudio=createAudio;this.URLAPI=URLAPI;this.current=null;this.counter=0;
  }
  get playing(){return Boolean(this.current);}
  async play(record,{priority=40,signal}={}) {
    if(!record?.bytes||signal?.aborted)return false;
    if(this.current&&priority<this.current.priority)return false;
    this.stop();
    const url=this.URLAPI.createObjectURL(new Blob([record.bytes],{type:record.mimeType||"audio/wav"}));
    const player=this.createAudio(),instance={id:++this.counter,player,priority,url};
    this.current=instance;
    return new Promise((resolve,reject)=>{
      let finished=false;
      const done=(value,error)=>{
        if(finished)return;finished=true;
        player.onended=player.onerror=null;
        signal?.removeEventListener("abort",abort);
        try{player.pause();}catch{}
        this.URLAPI.revokeObjectURL(url);
        if(this.current===instance)this.current=null;
        if(error)reject(error);else resolve(value);
      };
      const abort=()=>done(false);
      instance.finish=()=>done(false);
      signal?.addEventListener("abort",abort,{once:true});
      player.onended=()=>done(true);
      player.onerror=()=>done(false,new Error("Reflex audio playback failed"));
      player.src=url;
      Promise.resolve().then(()=>player.play()).catch(error=>done(false,error));
    });
  }
  stop(){const active=this.current;if(!active)return;this.current=null;active.finish?.();}
}
