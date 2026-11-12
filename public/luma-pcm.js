// Raw little-endian PCM only. No recording, speech recognition or transcription.
export function pcmToFloat(bytes){const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),out=new Float32Array(Math.floor(bytes.byteLength/2));for(let i=0;i<out.length;i++)out[i]=view.getInt16(i*2,true)/32768;return out}
export function bytesToBase64(bytes){let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary)}
export function base64ToBytes(value){const binary=atob(value),out=new Uint8Array(binary.length);for(let i=0;i<out.length;i++)out[i]=binary.charCodeAt(i);return out}
export class PcmCapture {
 constructor(inputRate,frameSamples=320){this.rate=inputRate;this.frameSamples=frameSamples;this.reset()}
 reset(){this.phase=0;this.sum=0;this.count=0;this.at=0;this.frame=new Int16Array(this.frameSamples)}
 push(samples,emit){for(const raw of samples){this.sum+=Number.isFinite(raw)?raw:0;this.count++;this.phase+=16000;if(this.phase>=this.rate){this.phase-=this.rate;const sample=Math.max(-1,Math.min(1,this.sum/this.count));this.frame[this.at++]=Math.round(sample*(sample<0?32768:32767));this.sum=0;this.count=0;if(this.at===this.frameSamples){const bytes=new Uint8Array(this.frameSamples*2),view=new DataView(bytes.buffer);for(let i=0;i<this.frameSamples;i++)view.setInt16(i*2,this.frame[i],true);emit(bytes);this.at=0}}}}
}
