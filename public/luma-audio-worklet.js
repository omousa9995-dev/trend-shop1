import {PcmCapture} from './luma-pcm.js?v=5.17.2';
class LumaCaptureProcessor extends AudioWorkletProcessor {
 constructor(){super();this.capture=new PcmCapture(sampleRate);this.muted=false;this.port.onmessage=e=>{this.muted=e.data?.muted===true;this.capture.reset()}}
 process(inputs){const samples=inputs[0]?.[0];if(samples&&!this.muted)this.capture.push(samples,bytes=>this.port.postMessage(bytes.buffer,[bytes.buffer]));return true}
}
registerProcessor('luma-pcm-capture',LumaCaptureProcessor);
