/**
 * Lumina's embeddable GLSL custom element.
 * Usage: <script type="module" src="/assets/lumina-orb.js"></script>
 *        <lumina-orb intensity="0.2" pulse="0.5" wave="0.4" speed="1" hue="0.62"></lumina-orb>
 * Parameters change live via el.setParams({ intensity, pulse, wave, speed, hue, mode }).
 * mode: idle | monitoring | listening | thinking | speaking | error.
 * No Three.js dependency or external network requirement. WebGL2 with CSS fallback.
 */
const VERT = `#version 300 es
precision highp float;
layout(location=0) in vec2 a_position;
out vec2 v_uv;
void main(){v_uv=a_position*.5+.5;gl_Position=vec4(a_position,0.,1.);}`;
export const LUMINA_GLSL = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_intensity;
uniform float u_pulse;
uniform float u_wave;
uniform float u_speed;
uniform float u_hue;
uniform float u_mode;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float f=0.,a=.5;for(int i=0;i<4;i++){f+=a*noise(p);p=p*2.03+12.19;a*=.5;}return f;}
vec3 palette(float t){return .5+.5*cos(6.28318*(vec3(.0,.20,.38)+t));}
void main(){
  vec2 p=(v_uv-.5)*2.;p.x*=u_resolution.x/max(u_resolution.y,1.);
  float tm=u_time*u_speed;
  float ang=atan(p.y,p.x);
  float radius=length(p);
  float pulse=sin(tm*1.55)*.5+.5;
  float voice=clamp(u_intensity,0.,1.);
  float energy=.5+.5*sin(tm*.55);
  float field=fbm(vec2(ang*2.3,tm*.20))*.5+.5*noise(p*5.5+vec2(tm*.15,-tm*.21));
  float deform=u_wave*(.028*sin(ang*7.+tm*1.2)+.02*sin(ang*13.-tm*1.6)+.02*(field-.5));
  float r=.535+deform+.025*u_pulse*pulse+.042*voice;
  float dist=radius-r;
  float body=1.-smoothstep(-.016,.032,dist);
  float glow=exp(-max(0.,dist)*14.)*.20 + exp(-radius*radius*2.7)*.035;
  float fac=clamp(radius/max(r,.001),0.,1.);
  float z=sqrt(max(0.,1.-fac*fac));
  vec3 n=normalize(vec3(p/max(r,.001),z*.83+.13));
  vec2 flow=vec2(ang*1.1+field*3.,z*2.8+tm*.12);
  float curl=fbm(flow*2.5)+.36*sin(13.*p.x+9.*p.y+tm*1.7)*sin(10.*p.y-4.*p.x-tm);
  float band=smoothstep(.08,.94,curl);
  vec3 deep=vec3(.028,.17,.30);
  vec3 aqua=vec3(.14,.72,.85);
  vec3 lavender=vec3(.43,.32,.77);
  vec3 teal=vec3(.13,.94,.79);
  vec3 col=mix(deep,aqua,clamp(.22+.83*(band*.66+z*.33),0.,1.));
  col=mix(col,lavender,clamp(.12+.31*sin(ang*1.8-tm*.38+field*3.+u_hue*4.),0.,.55));
  col+=teal*pow(max(0.,sin(ang*3.+tm*.8+curl*6.)),8.)*.23;
  float fresnel=pow(1.-max(0.,z),2.55);
  col+=vec3(.28,.60,.87)*fresnel*.65;
  float spec=pow(max(0.,dot(n,normalize(vec3(-.42,.7,1.1)))),16.);
  col+=vec3(.78,.96,1.)*spec*.45;
  col=mix(col,vec3(.20,.85,.78),u_mode*.16);
  col*=.86+.1*energy+.30*voice+.05*pulse;
  float alpha=clamp(body+glow,0.,1.);
  fragColor=vec4(col*body+mix(vec3(.05,.36,.55),col,.5)*glow,alpha);
}`;

const PARAMS = { intensity: .12, pulse:.48, wave:.38, speed:.85, hue:.62, mode:"idle" };
const MODES = { idle:0, monitoring:.1, listening:.35, thinking:.5, speaking:.9, error:.1 };
function compile(gl,type,source){
  const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
  if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
    const error=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw new Error(error);
  }
  return shader;
}
export class LuminaOrb extends HTMLElement {
  static observedAttributes=["intensity","pulse","wave","speed","hue","mode"];
  constructor(){super();this.params={...PARAMS};this.raf=0;this.rendered=false;this._onFrame=this.draw.bind(this);}
  connectedCallback(){
    if(this.rendered)return;this.rendered=true;
    this.style.position="relative";
    for(const name of LuminaOrb.observedAttributes){if(this.hasAttribute(name))this.readAttribute(name,this.getAttribute(name));}
    this.canvas=document.createElement("canvas");this.canvas.setAttribute("aria-hidden","true");
    this.append(this.canvas);
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(this);
    this.reducedMotion=matchMedia("(prefers-reduced-motion: reduce)");
    this.visibility=()=>{if(document.hidden){cancelAnimationFrame(this.raf);this.raf=0;}else this.start();};
    document.addEventListener("visibilitychange",this.visibility);
    this.setup();this.resize();this.start();
  }
  attributeChangedCallback(name,oldValue,newValue){this.readAttribute(name,newValue);}
  readAttribute(name,value){if(name==="mode"){this.params.mode=MODES[value]!==undefined?value:"idle";return;}
    const n=Number(value);if(value!==null&&Number.isFinite(n))this.params[name]=Math.max(0,Math.min(name==="speed"?3:1,n));
  }
  setParams(values={}){for(const [key,value] of Object.entries(values)){
    if(!LuminaOrb.observedAttributes.includes(key))continue;
    this.setAttribute(key,String(value));
  }}
  setup(){
    try{
      const gl=this.canvas.getContext("webgl2",{alpha:true,antialias:true,premultipliedAlpha:false,powerPreference:"low-power"});
      if(!gl)throw new Error("WebGL2 unavailable");
      const program=gl.createProgram(),v=compile(gl,gl.VERTEX_SHADER,VERT),f=compile(gl,gl.FRAGMENT_SHADER,LUMINA_GLSL);
      gl.attachShader(program,v);gl.attachShader(program,f);gl.linkProgram(program);gl.deleteShader(v);gl.deleteShader(f);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
      const vao=gl.createVertexArray();gl.bindVertexArray(vao);
      const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
      this.gl=gl;this.program=program;this.vao=vao;this.buffer=buffer;
      this.uniforms={};for(const name of ["u_resolution","u_time","u_intensity","u_pulse","u_wave","u_speed","u_hue","u_mode"])
        this.uniforms[name]=gl.getUniformLocation(program,name);
      this.canvas.addEventListener("webglcontextlost",e=>{e.preventDefault();cancelAnimationFrame(this.raf);this.raf=0;this.gl=null;this.classList.add("fallback");});
      this.canvas.addEventListener("webglcontextrestored",()=>{this.classList.remove("fallback");this.setup();this.start();});
    }catch(error){this.classList.add("fallback");this.dataset.shaderError=error.message;}
  }
  resize(){if(!this.canvas)return;const rect=this.getBoundingClientRect();const dpr=Math.min(window.devicePixelRatio||1,1.75);
    const w=Math.max(1,Math.floor(rect.width*dpr)),h=Math.max(1,Math.floor(rect.height*dpr));
    if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
  }
  start(){if(this.raf||document.hidden)return;this.startTime??=performance.now();this.raf=requestAnimationFrame(this._onFrame);}
  draw(now){this.raf=0;const gl=this.gl;
    if(gl){const {width:w,height:h}=this.canvas;
      gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(this.program);gl.bindVertexArray(this.vao);
      gl.uniform2f(this.uniforms.u_resolution,w,h);
      gl.uniform1f(this.uniforms.u_time,this.reducedMotion?.matches ? 0 : (now-this.startTime)/1000);
      for(const key of ["intensity","pulse","wave","speed","hue"])
        gl.uniform1f(this.uniforms["u_"+key],this.params[key]);
      gl.uniform1f(this.uniforms.u_mode,MODES[this.params.mode]||0);
      gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    }
    if(!document.hidden)this.raf=requestAnimationFrame(this._onFrame);
  }
  disconnectedCallback(){cancelAnimationFrame(this.raf);this.resizeObserver?.disconnect();document.removeEventListener("visibilitychange",this.visibility);
    if(this.gl){this.gl.deleteBuffer(this.buffer);this.gl.deleteVertexArray(this.vao);this.gl.deleteProgram(this.program);}this.gl=null;this.rendered=false;
  }
}
if(!customElements.get("lumina-orb"))customElements.define("lumina-orb",LuminaOrb);
