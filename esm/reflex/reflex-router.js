/** Exact whole-utterance shortcuts only; uncertain intent goes to LFM. */
export function normalizeUtterance(value) {
  return String(value||"").toLowerCase().replace(/[^a-z0-9\s']/g," ").replace(/\s+/g," ").trim();
}
export function routeReflex(text,manifest) {
  const n=normalizeUtterance(text);
  const routes=[
    [/^(?:hey|hi|hello)(?: there| lumina)?$/,"greetings.hey"],
    [/^(?:are you there|lumina are you there)$/,"connection.im-here"],
    [/^(?:i'm ready|im ready|ready when you are)$/,"connection.ready-when-you-are"],
    [/^(?:can you help me (?:work through|think through) (?:this|an) idea(?: i've got| i have)?|can i run an idea by you)$/,"encouragement.tell-me-more"],
    [/^(?:bye|goodbye|talk to you later|see you later)$/,"goodbye.talk-soon"],
    [/^(?:say that again|i couldn't hear you|i didnt hear you)$/,"clarification.could-you-repeat-that"]
  ];
  const matched=routes.find(([re])=>re.test(n));
  if(!matched)return null;
  const clip=manifest?.clips?.find(c=>c.id===matched[1]);
  return clip?{type:"reflex",clip,text:clip.text}:null;
}
export function chooseEventClip(name,manifest,{confirmed=false}={}) {
  if(["actions_completed","agreement","corrections"].includes(name) && !confirmed)return null;
  return manifest?.clips?.find(c=>c.category===name)||null;
}
