// Lumina is a shell over the existing, independently hosted ESM model modules.
// Never move model inference into this file or change the imported public APIs.
import { NexusConversationalist, LFMReasoner } from "../esm/index.js";
import { NexusDictationBrowser } from "https://cdn.jsdelivr.net/gh/LuminaryLabs-Dev/NexusDictation@dfaf2ccb601b70b04e678db777a39a6900949bfc/esm/browser.js";
import { NexusVoiceBrowser } from "https://cdn.jsdelivr.net/gh/LuminaryLabs-Dev/NexusVoice@300549e2e5690d84f570705f7e627ce0a1e92ce0/esm/index.js";
import { MicrophoneWakeMonitor } from "./voice-activation.js";
import { LuminaReflexKit } from "../esm/reflex/index.js";
const $=id=>document.getElementById(id);
const MODELS=[
 {module:"dictation",label:"Parakeet · NexusDictation",status:"asr-status"},
 {module:"lfm",label:"LFM2.5 · NexusConversationalist",status:"llm-status"},
 {module:"voice",label:"Kokoro · NexusVoice",status:"tts-status"}
];
const orb=$("lumina-orb");
let app=null,reflex=null,initialized=false,loading=false,current=-1,autoEnabled=false,callOpen=false,starting=false,preparing=false;
const completed=new Set();
let currentStatus="Ready to connect";
const monitor=new MicrophoneWakeMonitor({
  threshold:.10,
  onVolume:rms=>{
    // RMS displayed in GLSL shader, with audible output animated independently during TTS.
    const boosted=Math.min(1,rms*8);
    const activity=app?.state==="speaking" ? .6 : app?.state==="thinking" ? .25 : 0;
    orb.setParams({intensity:Math.max(boosted,activity)});
  },
  onRise:()=>{
    if(!autoEnabled||!initialized||loading||starting||app?.listeningEnabled||
       (app?.state!=="ready" && app?.state!=="idle"))return;
    void startListening("volume rise");
  }
});
function status(text){currentStatus=text;$("status").textContent=text;}
function controls(){
  $("load").disabled=loading||initialized;
  $("start").disabled=starting;
  $("stop").disabled=!callOpen && !app?.active && !monitor.running;
  $("send").disabled=!initialized;
  $("auto-enable").setAttribute("aria-pressed",String(autoEnabled));
  $("auto-label").textContent=autoEnabled?"Auto-listen on":"Auto-listen off";
  $("auto-toggle").checked=autoEnabled;
}
function state(value){
  const stage=String(value||"idle");
  $("state").textContent=stage.charAt(0).toUpperCase()+stage.slice(1);
  const flags={listening:"listening",thinking:"thinking",speaking:"speaking",ready:"monitoring",idle:"idle",error:"error"};
  orb.setParams({mode:flags[stage]||"idle"});
  monitor.setPaused(["thinking","speaking","listening"].includes(stage));
  $("state-dot").style.background=stage==="listening"?"#69cfcd":stage==="speaking"?"#a6acfa":stage==="error"?"#ea7998":"#6da9bd";
  const titles={listening:["I'm listening","Speak naturally. Pause when you're finished."],
    thinking:["Thinking…","Lumina is putting a response together."],
    speaking:["Lumina is speaking","You can tap the orb to interrupt."],
    ready:["I'm here.","Tap to talk or enable automatic listening."],
    idle:["Hey, I'm Lumina.","Tap the orb to begin a conversation."],
    error:["Something went wrong","Open settings for details and retry."],
    loading:["Getting things ready","Downloading the local models."]};
  const [heading,subtitle]=titles[stage]||titles.ready;
  $("call-heading").textContent=heading;$("call-subtitle").textContent=subtitle;
  $("call-state").textContent=stage==="listening"?"Microphone live":stage==="speaking"?"Voice output":stage==="thinking"?"Processing your message":stage==="ready"?"Ready for your voice":"Tap Lumina to talk";
  controls();
}
function message({role,content}){
  $("history").querySelector(".empty")?.remove();
  const line=document.createElement("div");line.className="message "+(role==="user"?"user":"assistant");
  const label=document.createElement("div");label.className="role";label.textContent=role;
  const value=document.createElement("div");value.textContent=content;
  line.append(label,value);$("history").append(line);$("history").scrollTop=$("history").scrollHeight;
  $("latest-message").textContent=(role==="assistant"?"Lumina: ":"You: ")+content;
}
function progress(event){
  const i=MODELS.findIndex(x=>x.module===event.module);
  if(i<0||i<current||(i===current&&completed.has(event.module)))return;
  const m=MODELS[i];
  if(i!==current){current=i;$("progress-model").textContent=m.label;
    $("progress-step").textContent="Model "+(i+1)+" of 3";
    $("download-progress").removeAttribute("value");
    $("progress-percent").textContent="Preparing…";
    $("progress-bytes").textContent="Transfer size not yet available";}
  const detail=event.detail||event.message||event.phase||"Loading";
  $(m.status).textContent=detail;
  if(event.phase==="ready"){
    completed.add(m.module);$("download-progress").value=100;
    $("progress-percent").textContent="Ready · 100%";
    $("progress-bytes").textContent="Model "+(i+1)+" of 3 complete";
  }else if(Number.isFinite(event.totalBytes)&&event.totalBytes>0&&Number.isFinite(event.loadedBytes)){
    const loaded=Math.max(0,Math.min(event.totalBytes,event.loadedBytes));
    const percent=Math.min(99,Math.max(0,100*loaded/event.totalBytes));
    $("download-progress").value=percent;
    $("progress-percent").textContent=percent.toFixed(1)+"%";
    $("progress-bytes").textContent=(loaded/1e6).toFixed(1)+" / "+(event.totalBytes/1e6).toFixed(1)+" MB";
  }else if(Number.isFinite(event.percent)&&event.percent<100){
    $("download-progress").value=Math.min(99,Math.max(0,event.percent));
    $("progress-percent").textContent=event.percent.toFixed(1)+"%";
  }
  status(m.label+": "+detail);
}
function resetProgress(){
  completed.clear();current=-1;$("download-panel").hidden=false;
  $("download-progress").removeAttribute("value");
  $("progress-model").textContent="Preparing models";
  $("progress-step").textContent="Model 1 of 3";
  $("progress-percent").textContent="Preparing…";
  $("progress-bytes").textContent="Transfer size not yet available";
  for(const m of MODELS)$(m.status).textContent="Waiting";
}
async function loadModels(){
  if(initialized)return true;if(loading)return false;
  loading=true;controls();resetProgress();state("loading");$("load").textContent="Loading…";
  try{
    if(!navigator.gpu||!await navigator.gpu.requestAdapter())throw new Error("WebGPU unavailable. Try current Chrome with hardware acceleration.");
    const response=await fetch(new URL("../audio/lumina/manifest.json",import.meta.url));
    if(!response.ok)throw new Error("Unable to load Lumina clip manifest");
    const voice=new NexusVoiceBrowser({backend:"auto"});
    reflex=new LuminaReflexKit({
      manifest:await response.json(),voice,
      onEvent(event){
        if(event.type==="pack-progress")$("reflex-status").textContent=
          "Prepared "+event.done+"/"+event.total+" clips"+(event.failures?" · "+event.failures+" failed":"");
        if(event.type==="clip-error")$("reflex-status").textContent="Clip error: "+event.message;
      }
    });
    app=new NexusConversationalist({
      dictator:new NexusDictationBrowser(),voice,reflex,
      reasoner:new LFMReasoner({dtype:"q4",maxTokens:110})
    });
    app.on("message",message);app.on("state",state);
    app.on("partial",t=>{$("partial").textContent=t.text;});
    app.on("status",progress);app.on("error",e=>status("Error: "+(e.message||e)));
    await app.initialize();initialized=true;
    $("load").textContent="Models ready";
    $("progress-model").textContent="All models ready";
    $("progress-step").textContent="3 of 3";
    $("download-progress").value=100;$("progress-percent").textContent="Ready";
    $("progress-bytes").textContent="Inference runs locally";
    state("ready");status("Lumina is ready. Tap the orb to talk.");
    // Prime the most common responses; use real NexusVoice synthesis and IndexedDB.
    const warm=await reflex.prepareAll({ids:[
      "greetings.hey","connection.im-here","thinking.one-moment","encouragement.tell-me-more"
    ]});
    $("reflex-status").textContent=warm.failures
      ? "Some quick phrases unavailable · Retry in Settings"
      : "Four quick phrases cached for instant playback";
    return true;
  }catch(error){
    const label=current>=0?MODELS[current].label:"WebGPU";
    status("Initialization failed at "+label+": "+(error.message||error)+". Open settings to retry.");
    if(current>=0)$(MODELS[current].status).textContent="Error · Retry available";
    $("progress-model").textContent="Could not load "+label;
    $("progress-percent").textContent="Failed";
    app?.dispose();app=null;reflex=null;initialized=false;
    $("load").textContent="Retry models";state("error");return false;
  }finally{loading=false;controls();}
}
async function ensureMonitor(){
  if(monitor.running)return;
  await monitor.start();$("mic-status").textContent="Microphone permission granted · Listening locally";
}
async function startListening(source="tap"){
  if(starting)return;
  if(app?.state==="listening"){
    // Tapping while recording finalizes current speech; if silent, resume recording.
    try{const result=await app.dictator.stop({finalize:true});
      if(!result&&app.active){await app.dictator.start();state("listening");}
    }catch(error){status("Dictation error: "+error.message);}return;
  }
  if(app?.state==="speaking"){
    app.reflex?.stop();app.voice.stop();status("Interrupted Lumina. Returning to listening.");return;
  }
  if(app?.state==="thinking")return;
  starting=true;callOpen=true;controls();
  try{
    // Called directly from the click handler: permission can be granted before downloads.
    const pendingMic=ensureMonitor().then(()=>({ok:true}),error=>({ok:false,error}));
    const loaded=await loadModels();
    const mic=await pendingMic;
    if(!mic.ok)throw mic.error;
    if(!loaded)return;
    await app.start();
    status(source==="volume rise"?"Detected a volume rise. Listening…":"Listening. Speak naturally.");
  }catch(error){status("Microphone: "+(error.message||error));state("error");}
  finally{starting=false;controls();}
}
async function toggleAuto(enabled){
  autoEnabled=Boolean(enabled);controls();
  if(!autoEnabled){monitor.setEnabled(false);status("Automatic listening is off. Tap Lumina to talk.");return;}
  try{
    await ensureMonitor(); // user click ensures microphone permission
    monitor.setEnabled(true);
    const loaded=await loadModels();
    if(!loaded){autoEnabled=false;monitor.setEnabled(false);controls();return;}
    callOpen=true;controls();
    status("Auto-listen armed. A 10% rise over ambient volume starts transcription.");
    if(app.state==="idle"||app.state==="ready")state("ready");
  }catch(error){autoEnabled=false;monitor.setEnabled(false);controls();status("Microphone permission failed: "+error.message);}
}
async function endCall(){
  autoEnabled=false;monitor.setEnabled(false);callOpen=false;
  try{await app?.stop();await monitor.stop();state("idle");status("Call ended. Tap Lumina to start again.");}
  catch(error){status("End call: "+error.message);}finally{controls();}
}
function openChat(open){
  $("chat-panel").classList.toggle("open",open);
  $("chat-panel").inert=!open;
  $("scrim").hidden=!open;
  $("chat-toggle").setAttribute("aria-expanded",String(open));
  if(open)$("chat-close").focus();else $("chat-toggle").focus();
}
$("settings-open").addEventListener("click",()=>$("settings").showModal());
$("settings-close").addEventListener("click",()=>$("settings").close());
$("load").addEventListener("click",()=>void loadModels());
$("start").addEventListener("click",()=>void startListening());
$("stop").addEventListener("click",()=>void endCall());
$("auto-enable").addEventListener("click",()=>void toggleAuto(!autoEnabled));
$("auto-toggle").addEventListener("change",e=>void toggleAuto(e.target.checked));
$("wake-threshold").addEventListener("input",e=>{
  const n=Number(e.target.value);monitor.setThreshold(n);$("threshold-value").textContent=n+"%";
});
$("orb-wave").addEventListener("input",e=>{
  const val=Number(e.target.value);orb.setParams({wave:val/100});$("wave-value").textContent=val+"%";
});
$("orb-speed").addEventListener("input",e=>{
  const val=Number(e.target.value);orb.setParams({speed:val/100});$("speed-value").textContent=val+"%";
});
$("chat-toggle").addEventListener("click",()=>openChat(true));
$("chat-close").addEventListener("click",()=>openChat(false));
$("scrim").addEventListener("click",()=>openChat(false));
$("send-form").addEventListener("submit",async e=>{
  e.preventDefault();const value=$("text").value.trim();if(!value)return;
  $("text").value="";$("send").disabled=true;
  try{if(!initialized){const ok=await loadModels();if(!ok)return;}
    if(!app.active)await app.start({listen:false});
    await app.send(value);$("partial").textContent="";
  }catch(error){status("Message failed: "+(error.message||error));}
  finally{controls();}
});
$("clear").addEventListener("click",()=>{
  if(app)app.messages.length=0;$("history").replaceChildren();
  $("latest-message").textContent="A voice-first conversation, right in your browser.";
});
window.addEventListener("keydown",event=>{
  if(event.key==="Escape"&&$("chat-panel").classList.contains("open"))openChat(false);
});
$("reflex-prepare").addEventListener("click",async()=>{
  if(preparing)return;
  if(!initialized && !await loadModels())return;
  if(!reflex)return;
  preparing=true;$("reflex-prepare").disabled=true;
  $("reflex-status").textContent="Preparing Kokoro voice clips locally…";
  try{
    const result=await reflex.prepareAll();
    $("reflex-status").textContent="Cached "+(result.done-result.failures)+" of "+result.total+" clips on this device";
  }catch(error){$("reflex-status").textContent="Preparation failed: "+error.message;}
  finally{preparing=false;$("reflex-prepare").disabled=false;}
});
window.addEventListener("beforeunload",()=>{try{monitor.stop();app?.dispose();}catch{}});
controls();
