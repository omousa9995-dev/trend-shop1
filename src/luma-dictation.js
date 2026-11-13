export const MAX_DICTATION_SECONDS=45;
export function validateDictation(body){
 if(!body||body.audioConsent!==true)throw Error('AUDIO_CONSENT_REQUIRED');
 const source=body.audio,raw=typeof source?.mimeType==='string'?source.mimeType.split(';')[0].toLowerCase():'';
 const mimeType=({'audio/mp4':'audio/m4a','audio/m4a':'audio/m4a','audio/x-m4a':'audio/m4a','audio/webm':'audio/webm','audio/ogg':'audio/ogg','audio/wav':'audio/wav'})[raw];
 if(!mimeType||typeof source.data!=='string'||source.data.length>1400000||source.data.length<64||!/^[A-Za-z0-9+/]+={0,2}$/.test(source.data))throw Error('INVALID_AUDIO');
 if(!Number.isFinite(body.durationSeconds)||body.durationSeconds<=0||body.durationSeconds>MAX_DICTATION_SECONDS)throw Error('INVALID_DURATION');
 let bytes;try{bytes=atob(source.data)}catch{throw Error('INVALID_AUDIO')}
 if(bytes.length>1048576||bytes.length<44)throw Error('INVALID_AUDIO');
 const valid=mimeType==='audio/wav'?bytes.startsWith('RIFF')&&bytes.slice(8,12)==='WAVE':mimeType==='audio/m4a'?bytes.slice(4,8)==='ftyp':mimeType==='audio/ogg'?bytes.startsWith('OggS'):[0x1a,0x45,0xdf,0xa3].every((v,i)=>bytes.charCodeAt(i)===v);
 if(!valid)throw Error('INVALID_AUDIO');
 return {mimeType,data:source.data};
}
// Retired for all clients, including cached tabs. Audio cannot spend provider quota.
export async function publicLumaTranscribe(req,env,{error,sameOrigin}){
 if(!sameOrigin(req)||req.headers.get('x-trend-care')!=='1')return error('طلب غير مصرح',403);
 return error('التسجيلات الصوتية أُلغيت. اكتبي سؤالكِ في المحادثة.',410);
}
