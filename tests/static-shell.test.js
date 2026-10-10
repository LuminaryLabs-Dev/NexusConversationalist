import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const file=p=>readFileSync(new URL(p,root),'utf8');
test('static root includes preserved conversation integration and controls',()=>{
 const html=file('index.html');
 for(const id of ['start','stop','load','send-form','text','clear','history','download-panel','progress-model','progress-percent','progress-bytes','settings-open','settings','auto-enable']){
  assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.match(html,/<lumina-orb/);assert.match(html,/>Lumina</);
 assert.match(html,/assets\/main.js/);
});
test('ESM integrates the existing model repositories',()=>{
 const source=file('assets/main.js');
 for(const name of ['NexusDictationBrowser','NexusVoiceBrowser','NexusConversationalist','LFMReasoner'])assert.ok(source.includes(name));
 assert.ok(source.includes('new MicrophoneWakeMonitor'));
});
test('shader custom element exported with configurable GLSL uniforms',()=>{
 const source=file('assets/lumina-orb.js');
 assert.match(source,/customElements.define\("lumina-orb"/);
 for(const name of ['u_intensity','u_pulse','u_wave','u_speed','u_hue','u_time'])assert.ok(source.includes(name));
});
