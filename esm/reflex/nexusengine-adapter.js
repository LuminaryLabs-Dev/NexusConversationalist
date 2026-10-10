/** Opt-in provider for NexusEngine Speech Kit; does not modify the engine. */
export function createLuminaSpeechProvider(reflex) {
  if(!reflex?.manifest)throw new Error("Lumina Reflex Kit required");
  return {
    id:"lumina-reflex",version:"1",
    metadata:{engine:"NexusVoice",voice:"af_heart",role:"prerecorded-responses"},
    async initialize(){return true;},
    async synthesize(request){
      const clip=reflex.getClip(request.id)||reflex.manifest.clips.find(x=>x.text===request.text);
      if(!clip)throw new Error("No authored Lumina clip matches the speech request");
      await reflex.prepare(clip.id);
      return {generatedAssetId:"lumina:clip:"+clip.id,sampleRate:24000,channels:1,
        voice:clip.voice,utteranceText:clip.text,clipId:clip.id};
    },
    cancel(){reflex.stop();},reset(){reflex.stop();}
  };
}
export function registerLuminaSpeech(speechApi,reflex){
  if(!speechApi?.registerProvider||!speechApi?.registerVoice)throw new Error("NexusEngine speech API required");
  const provider=createLuminaSpeechProvider(reflex);
  speechApi.registerProvider(provider);
  speechApi.registerVoice({id:"lumina-af-heart",provider:provider.id,language:"en"});
  return provider;
}
