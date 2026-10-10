/** Relative RMS rise gate; no backend and no recording storage. */
export class VolumeRiseGate {
  constructor({threshold=.10,noiseFloor=.014,confirmation=3,cooldownMs=2600,alpha=.045}={}){
    this.threshold=threshold;this.noiseFloor=noiseFloor;this.confirmation=confirmation;
    this.cooldownMs=cooldownMs;this.alpha=alpha;this.baseline=0;this.samples=0;
    this.consecutive=0;this.lastFire=-Infinity;
  }
  update(volume,now=performance.now()){
    if(!Number.isFinite(volume))return false;
    const level=Math.max(0,Math.min(1,volume));
    if(this.samples===0)this.baseline=level;
    this.samples++;
    const floor=Math.max(this.baseline,this.noiseFloor);
    const rise=level>=this.noiseFloor && level>=floor*(1+this.threshold);
    if(now-this.lastFire<this.cooldownMs){this.consecutive=0;return false;}
    this.consecutive=rise?this.consecutive+1:0;
    // Learn ambient background only when input is not rising.
    if(!rise)this.baseline=this.baseline*(1-this.alpha)+level*this.alpha;
    if(this.consecutive<this.confirmation)return false;
    this.lastFire=now;this.consecutive=0;
    return true;
  }
  reset(){this.consecutive=0;this.samples=0;this.baseline=0;this.lastFire=-Infinity;}
}
export class MicrophoneWakeMonitor {
  constructor({onVolume=()=>{},onRise=()=>{},threshold=.10}={}){
    this.onVolume=onVolume;this.onRise=onRise;this.gate=new VolumeRiseGate({threshold});
    this.running=false;this.enabled=false;this.raf=0;this.pauseDetection=false;
  }
  setThreshold(percent){this.gate.threshold=Math.max(.1,Math.min(.8,percent/100));this.gate.reset();}
  setEnabled(enabled){this.enabled=Boolean(enabled);this.gate.reset();}
  setPaused(paused){this.pauseDetection=Boolean(paused);if(paused)this.gate.reset();}
  async start(){
    if(this.running)return;
    if(!navigator.mediaDevices?.getUserMedia)throw new Error("Microphone needs HTTPS and browser permission");
    // Call this synchronously in the user's click handler, before model downloads.
    const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
    try {
      this.stream=stream;
      this.context=new (window.AudioContext||window.webkitAudioContext)();
      await this.context.resume();
      this.source=this.context.createMediaStreamSource(stream);
      this.analyser=this.context.createAnalyser();this.analyser.fftSize=1024;
      this.analyser.smoothingTimeConstant=.28;
      this.data=new Float32Array(this.analyser.fftSize);
      this.source.connect(this.analyser); // no path to speakers
      this.running=true;
      this.gate.reset();this.sample();
    }catch(error){stream.getTracks().forEach(t=>t.stop());await this.closeContext();throw error;}
  }
  sample(){
    if(!this.running)return;
    this.analyser.getFloatTimeDomainData(this.data);
    let sum=0;for(const n of this.data)sum+=n*n;
    const rms=Math.sqrt(sum/this.data.length);
    this.onVolume(rms);
    if(this.enabled&&!this.pauseDetection&&this.gate.update(rms))this.onRise(rms);
    this.raf=requestAnimationFrame(()=>this.sample());
  }
  async closeContext(){try{this.source?.disconnect();await this.context?.close();}catch{}
    this.context=this.source=this.analyser=null;}
  async stop(){this.running=false;cancelAnimationFrame(this.raf);this.raf=0;
    this.stream?.getTracks().forEach(track=>track.stop());this.stream=null;
    await this.closeContext();this.gate.reset();}
}
