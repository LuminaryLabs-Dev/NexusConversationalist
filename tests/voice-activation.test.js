import test from 'node:test';
import assert from 'node:assert/strict';
import {VolumeRiseGate} from '../assets/voice-activation.js';
test('10% sustained change fires once, with cooldown',()=>{
 const gate=new VolumeRiseGate({threshold:.10,noiseFloor:.01,confirmation:3,cooldownMs:1000,alpha:0});
 for(let i=0;i<10;i++)assert.equal(gate.update(.04,i*20),false);
 assert.equal(gate.update(.043,200),false);
 assert.equal(gate.update(.045,220),false);
 assert.equal(gate.update(.045,240),false);
 assert.equal(gate.update(.045,260),true); // third qualifying frame
 assert.equal(gate.update(.045,280),false);
 assert.equal(gate.update(.06,300),false);
});
test('floor rejects tiny ambient fluctuations',()=>{
 const gate=new VolumeRiseGate({noiseFloor:.014,confirmation:2,alpha:0});
 for(let i=0;i<25;i++)assert.equal(gate.update(.001*(1+(i%2)*.2),i*20),false);
});
test('reset allows a fresh voice wake',()=>{
 const gate=new VolumeRiseGate({noiseFloor:.01,confirmation:1,cooldownMs:1000,alpha:0});
 gate.update(.03,0);assert.equal(gate.update(.037,20),true);
 gate.reset();gate.update(.03,30);assert.equal(gate.update(.038,60),true);
});
