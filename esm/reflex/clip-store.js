/** Cache generated Kokoro clips in this browser only. */
export class IndexedClipStore {
  constructor({ dbName="lumina-reflex-v1", indexedDB=globalThis.indexedDB }={}) {
    this.dbName=dbName; this.factory=indexedDB; this.opening=null;
  }
  async open() {
    if(!this.factory) return null;
    if(this.opening) return this.opening;
    this.opening=new Promise((resolve,reject)=>{
      const req=this.factory.open(this.dbName,1);
      req.onupgradeneeded=()=>{ if(!req.result.objectStoreNames.contains("clips")) req.result.createObjectStore("clips"); };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
    }).catch(e=>{ this.opening=null; throw e; });
    return this.opening;
  }
  async get(id) {
    const db=await this.open(); if(!db) return null;
    return new Promise((resolve,reject)=>{
      const q=db.transaction("clips","readonly").objectStore("clips").get(id);
      q.onsuccess=()=>resolve(q.result||null); q.onerror=()=>reject(q.error);
    });
  }
  async set(id,value) {
    const db=await this.open(); if(!db)return false;
    return new Promise((resolve,reject)=>{
      const tx=db.transaction("clips","readwrite");tx.objectStore("clips").put(value,id);
      tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error);
    });
  }
}
export function isWavBuffer(input) {
  if(!(input instanceof ArrayBuffer) || input.byteLength<46)return false;
  const b=new Uint8Array(input);
  return String.fromCharCode(...b.slice(0,4))==="RIFF"&&String.fromCharCode(...b.slice(8,12))==="WAVE";
}
