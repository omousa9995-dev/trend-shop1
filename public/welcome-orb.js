import {NXA_ENERGY_ORB_VERTEX_SHADER, NXA_ENERGY_ORB_CONFIGURABLE_FRAGMENT_SHADER} from './vendor/threeui/energy-orb-shaders.js';

// ThreeUI Community Energy Orb, adapted to a soft pearl and rose palette.
// The original shaders and MIT license are kept locally. No CDN or runtime library.
export function renderWelcomePearl(canvas) {
  const host=canvas.parentElement;
  let gl,program,buffer,vertex,fragment,frame=0,disposed=false,lastFrame=0;
  const shaders=[];
  const fallback=()=>{host.dataset.renderer='fallback';canvas.hidden=true;};
  const dispose=()=>{
    if(disposed)return;disposed=true;cancelAnimationFrame(frame);
    document.removeEventListener('visibilitychange',visibility);
    canvas.removeEventListener('webglcontextlost',lost);
    if(gl){if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);shaders.forEach(s=>gl.deleteShader(s));}
    canvas.width=canvas.height=1;
  };
  const lost=e=>{e.preventDefault();dispose();fallback();};
  const visibility=()=>{cancelAnimationFrame(frame);if(!document.hidden&&!disposed)frame=requestAnimationFrame(draw);};
  const compile=(type,source)=>{const shader=gl.createShader(type);if(!shader)throw Error('Shader unavailable');shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error('Shader unavailable');return shader;};
  let timeUniform,resolutionUniform,start=performance.now();
  const draw=now=>{
    if(disposed||document.hidden)return;
    frame=requestAnimationFrame(draw);
    if(now-lastFrame<1000/30)return;lastFrame=now;
    gl.uniform1f(timeUniform,(now-start)/1000*.36);
    gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  };
  try{
    gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:false,antialias:false,powerPreference:'low-power'});
    if(!gl){host.dataset.effectReason='context-unavailable';fallback();return dispose;}
    const pearl=NXA_ENERGY_ORB_CONFIGURABLE_FRAGMENT_SHADER
      .replace('vec3(0.04,0.02,0.12)','vec3(0.57,0.35,0.43)')
      .replace('vec3(0.22,0.16,0.55)','vec3(0.86,0.63,0.69)')
      .replace('vec3(0.62,0.60,0.98)','vec3(1.0,0.94,0.86)')
      .replace('vec3(0.55,0.55,1.0)','vec3(1.0,0.86,0.76)')
      .replace('vec3(0.45,0.42,0.9)','vec3(1.0,0.90,0.82)')
      .replace('vec3(0.55,0.52,1.0)','vec3(0.95,0.67,0.76)')
      .replace('vec3(0.6,0.58,1.0)','vec3(1.0,0.84,0.73)');
    vertex=compile(gl.VERTEX_SHADER,NXA_ENERGY_ORB_VERTEX_SHADER);fragment=compile(gl.FRAGMENT_SHADER,pearl);
    program=gl.createProgram();if(!program)throw Error('Program unavailable');
    gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Program unavailable');
    gl.useProgram(program);buffer=gl.createBuffer();if(!buffer)throw Error('Buffer unavailable');
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    const attribute=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(attribute);gl.vertexAttribPointer(attribute,2,gl.FLOAT,false,0,0);
    const size=Math.min(360,Math.round(canvas.clientWidth*Math.min(window.devicePixelRatio||1,1.4)));
    canvas.width=canvas.height=Math.max(180,size);gl.viewport(0,0,canvas.width,canvas.height);
    timeUniform=gl.getUniformLocation(program,'uT');resolutionUniform=gl.getUniformLocation(program,'uR');
    gl.uniform2f(resolutionUniform,canvas.width,canvas.height);
    for(const [name,value]of Object.entries({uSmokeScale:.8,uSmokeStrength:.55,uSmokeSpeed:.55,uHue:0,uSaturation:.65,uGlow:.48}))gl.uniform1f(gl.getUniformLocation(program,name),value);
    gl.uniform1f(timeUniform,0);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    canvas.hidden=false;host.dataset.renderer='webgl';host.dataset.effectReason='ready';
    canvas.addEventListener('webglcontextlost',lost);document.addEventListener('visibilitychange',visibility);
    frame=requestAnimationFrame(draw);return dispose;
  }catch{dispose();host.dataset.effectReason='shader-unavailable';fallback();return ()=>{};}
}
