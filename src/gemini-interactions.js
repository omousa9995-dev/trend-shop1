// Stateless Interactions adapter. Preserve original tool/thought steps verbatim
// between rounds; never create stored conversations or expose their contents.
const schema=value=>Array.isArray(value)?value.map(schema):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,k==='type'&&typeof v==='string'?v.toLowerCase():schema(v)])):value;
export function interactionRequest(model,payload){
 const input=[];
 for(const content of payload.contents||[]){
  const original=content.parts?.find(p=>p.interactionSteps)?.interactionSteps;
  if(original){input.push(...original);continue}
  const ordinary=[];
  for(const part of content.parts||[]){
   if(part.functionResponse){if(ordinary.length)throw Error('MIXED_TOOL_RESULT');const f=part.functionResponse;input.push({type:'function_result',call_id:f.id,name:f.name,result:[{type:'text',text:JSON.stringify(f.response)}]})}
   else if(typeof part.text==='string')ordinary.push({type:'text',text:part.text});
   else if(part.inlineData)ordinary.push({type:part.inlineData.mimeType.startsWith('image/')?'image':'audio',mime_type:part.inlineData.mimeType,data:part.inlineData.data});
  }
  if(ordinary.length)input.push({type:content.role==='model'?'model_output':'user_input',content:ordinary});
 }
 const tools=(payload.tools||[]).flatMap(t=>t.functionDeclarations||[]).map(t=>({type:'function',name:t.name,description:t.description,parameters:schema(t.parameters)}));
 return {model,store:false,input,system_instruction:(payload.systemInstruction?.parts||[]).map(p=>p.text||'').join('\n'),tools,generation_config:{max_output_tokens:payload.generationConfig?.maxOutputTokens||4096,thinking_level:payload.generationConfig?.thinkingConfig?.thinkingLevel||'low',...(tools.length?{tool_choice:'any'}:{})}};
}
export function interactionResponse(value){
 if(value?.status==='incomplete')throw Object.assign(Error('PROVIDER_INCOMPLETE'),{reason:'OUTPUT_INCOMPLETE'});
 if(!['completed','requires_action'].includes(value?.status)||!Array.isArray(value.steps))throw Error('PROVIDER_RESPONSE_INVALID');
 const parts=[{interactionSteps:value.steps.filter(s=>s.type!=='user_input')}];
 for(const step of value.steps){
  if(step.type==='function_call')parts.push({functionCall:{id:step.id,name:step.name,args:step.arguments}});
  if(step.type==='model_output')for(const content of step.content||[])if(content.type==='text'&&typeof content.text==='string')parts.push({text:content.text});
 }
 if(parts.length===1)throw Error('EMPTY_REPLY');
 const usage=value.usage||{};
 return {candidates:[{finishReason:'STOP',content:{role:'model',parts}}],usageMetadata:{promptTokenCount:usage.total_input_tokens||0,candidatesTokenCount:usage.total_output_tokens||0}};
}
