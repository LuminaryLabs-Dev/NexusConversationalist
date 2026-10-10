// Root GitHub Pages ESM app. Independent modules, pinned by immutable GitHub commit.
import { NexusConversationalist, LFMReasoner } from "../esm/index.js";
import { NexusDictationBrowser } from "https://cdn.jsdelivr.net/gh/LuminaryLabs-Dev/NexusDictation@dfaf2ccb601b70b04e678db777a39a6900949bfc/esm/browser.js";
import { NexusVoiceBrowser } from "https://cdn.jsdelivr.net/gh/LuminaryLabs-Dev/NexusVoice@300549e2e5690d84f570705f7e627ce0a1e92ce0/esm/index.js";
const $=id=>document.getElementById(id);
let app=null,initialized=false;
function report(value){$("status").textContent=value;}
function buttons(){
  $("load").disabled=initialized;
  $("start").disabled=!initialized||app?.listeningEnabled||(app?.active&&app.state!=="ready");
  $("stop").disabled=!app?.active;
  $("send").disabled=!initialized;
}
function state(value){
  $("state").textContent=value;
  $("state-dot").style.background=value==="listening"?"#4ed3ac":value==="error"?"#fa7a83":"#edbd64";
  buttons();
}
function message({role,content}){
  $("history").querySelector(".empty")?.remove();
  const line=document.createElement("div");line.className="message "+(role==="user"?"user":"assistant");
  const title=document.createElement("div");title.className="role";title.textContent=role;
  const body=document.createElement("div");body.textContent=content;
  line.append(title,body);$("history").append(line);$("history").scrollTop=$("history").scrollHeight;
}
$("load").addEventListener("click",async()=>{
  $("load").disabled=true;
  try{
    if(!navigator.gpu||!await navigator.gpu.requestAdapter())throw new Error("WebGPU unavailable. Use current Chrome or compatible browser.");
    report("Initializing models. Hugging Face downloads may take several minutes.");
    app=new NexusConversationalist({
      dictator:new NexusDictationBrowser(),
      voice:new NexusVoiceBrowser({backend:"auto"}),
      reasoner:new LFMReasoner({dtype:"q4",maxTokens:110})
    });
    app.on("message",message);
    app.on("state",state);
    app.on("partial",t=>{$("partial").textContent=t.text;});
    app.on("error",e=>report("Error: "+(e.message||e)));
    app.on("status",event=>{
      const target={dictation:"asr-status",lfm:"llm-status",voice:"tts-status"}[event.module];
      const detail=event.detail||event.message||event.phase||"Loading";
      if(target)$(target).textContent=detail;
      report((event.module||"model")+": "+detail);
    });
    await app.initialize();
    $("asr-status").textContent="Loaded · WebGPU";
    $("llm-status").textContent="Loaded · WebGPU";
    $("tts-status").textContent="Loaded";
    initialized=true;state("Models ready");
    report("Three models ready. Start listening or type a message.");
  }catch(error){
    report("Initialization failed: "+(error.message||error));
    app?.dispose();app=null;initialized=false;buttons();
  }
});
$("start").addEventListener("click",async()=>{
  try{
    await app.start();
    buttons();report("Listening. Speak then pause to submit your question.");
  }catch(error){report("Microphone failed: "+error.message);buttons();}
});
$("stop").addEventListener("click",async()=>{
  try{await app.stop();report("Stopped.");}
  catch(error){report("Stop failed: "+error.message);}
  $("partial").textContent="";state("Stopped");
});
$("send-form").addEventListener("submit",async event=>{
  event.preventDefault();if(!app)return;
  const value=$("text").value.trim();if(!value)return;
  $("text").value="";$("send").disabled=true;
  try{
    if(!app.active)await app.start({listen:false});
    await app.send(value);
    $("partial").textContent="";
  }catch(error){report("Message failed: "+(error.message||error));}
  finally{buttons();}
});
$("clear").addEventListener("click",()=>{
  if(app)app.messages.length=0;
  $("history").replaceChildren();
});
window.addEventListener("beforeunload",()=>{try{app?.dispose();}catch{}});
buttons();