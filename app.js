import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const ease = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const SLOW = 0.75; // global animation speed (1 = original)
const AUTO_SEC = 20; // seconds per scene in presentation mode
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (REDUCE) document.documentElement.classList.add('reduce');

/* ---------------- data ---------------- */
const D = await (await fetch('assets/datos.json')).json();
const SIZE = D.sizeKm, VEX = 1.5, N = D.heightmap;
const hm = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'assets/relieve.png'; });
const cv = document.createElement('canvas'); cv.width = cv.height = N;
const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(hm, 0, 0);
const px = cx.getImageData(0, 0, N, N).data;
const HT = new Float32Array(N * N);
for (let i = 0; i < N * N; i++) HT[i] = (D.hMin + (px[i * 4] * 256 + px[i * 4 + 1]) * D.hScale) / 1000 * VEX;
function hAt(u, v) {
  const x = clamp(u, 0, 1) * (N - 1), y = clamp(v, 0, 1) * (N - 1);
  const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(x0 + 1, N - 1), y1 = Math.min(y0 + 1, N - 1), fx = x - x0, fy = y - y0;
  return lerp(lerp(HT[y0 * N + x0], HT[y0 * N + x1], fx), lerp(HT[y1 * N + x0], HT[y1 * N + x1], fx), fy);
}
const W = (u, v, y) => new THREE.Vector3((u - 0.5) * SIZE, y, (v - 0.5) * SIZE);

/* ---------------- renderer ---------------- */
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const PR_MAX = Math.min(devicePixelRatio, 1.5); let PR = PR_MAX;
renderer.setPixelRatio(PR);
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.05, 2000);
camera.position.set(-60, 60, 80);
const world = new THREE.Group(); scene.add(world);

const U = {
  uHolo: { value: 0 }, uSat: { value: 0 }, uTime: { value: 0 }, uScanX: { value: -1e3 },
  uSun: { value: new THREE.Vector3(-0.75, 0.32, -0.35) }, uSunCol: { value: new THREE.Color(1.15, 0.86, 0.62) },
  uFog: { value: new THREE.Color(0.62, 0.58, 0.62) }, uFogDist: { value: 32 },
  uTop: { value: new THREE.Color(0.14, 0.22, 0.40) }, uHor: { value: new THREE.Color(0.92, 0.62, 0.42) },
};
const LOOKS = {
  golden: { sun: [-0.75, 0.32, -0.35], sunCol: [1.15, 0.86, 0.62], fog: [0.62, 0.58, 0.62], top: [0.14, 0.22, 0.40], hor: [0.92, 0.62, 0.42], fogDist: 32 },
  hero: { sun: [-0.7, 0.35, -0.4], sunCol: [1.15, 0.86, 0.62], fog: [0.80, 0.62, 0.52], top: [0.16, 0.24, 0.42], hor: [0.80, 0.62, 0.52], fogDist: 22 },
  day: { sun: [-0.4, 0.8, -0.3], sunCol: [1.0, 0.96, 0.9], fog: [0.78, 0.82, 0.88], top: [0.30, 0.50, 0.78], hor: [0.82, 0.86, 0.90], fogDist: 60 },
};
let lookTarget = LOOKS.golden;

/* scan wipe: holo applies where world x < scanX */
const holoMix = `float holoM(vec3 w){ return clamp((uScanX - w.x)/0.8 + 0.5, 0.0, 1.0); }`;

/* terrain */
const SEG = 511;
const tgeo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); tgeo.rotateX(-Math.PI / 2);
{
  const p = tgeo.attributes.position, uv = tgeo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) / SIZE + 0.5, v = p.getZ(i) / SIZE + 0.5;
    p.setY(i, hAt(u, v)); uv.setXY(i, u, v);
  }
  tgeo.computeVertexNormals();
}
const satTex = await new THREE.TextureLoader().loadAsync('assets/satelite.jpg');
satTex.flipY = false; satTex.anisotropy = renderer.capabilities.getMaxAnisotropy(); satTex.colorSpace = THREE.NoColorSpace;
const tmat = new THREE.ShaderMaterial({
  uniforms: { ...U, map: { value: satTex } },
  vertexShader: `varying vec2 vUv; varying vec3 vW; varying vec3 vN; varying float vH;
    void main(){ vUv=uv; vH=position.y; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vN=normal; gl_Position=projectionMatrix*viewMatrix*w; }`,
  fragmentShader: `uniform sampler2D map; uniform float uHolo,uSat,uTime,uScanX,uFogDist; uniform vec3 uSun,uSunCol,uFog;
    varying vec2 vUv; varying vec3 vW; varying vec3 vN; varying float vH; ${holoMix}
    float gline(float x,float w){ float f=abs(fract(x-.5)-.5)/fwidth(x); return 1.-clamp(f/w,0.,1.); }
    void main(){
      vec3 c=pow(texture2D(map,vUv).rgb,vec3(1.1));
      vec3 n=normalize(vN);
      float dif=max(dot(n,normalize(uSun)),0.);
      vec3 lit=c*(vec3(.30,.34,.44)+uSunCol*dif*1.1);
      lit=mix(lit,c*1.05,uSat);
      float d=length(vW-cameraPosition);
      float fog=(1.-exp(-d/uFogDist))*(1.-uSat);
      float hf=smoothstep(3.65*1.5,3.30*1.5,vH)*.35*(1.-uSat);
      vec3 real=mix(lit,uFog,clamp(fog+hf*step(40.,uFogDist),0.,1.));
      float sh=.25+.75*max(dot(n,normalize(vec3(-.5,.7,-.4))),0.);
      float att=exp(-d/30.);
      vec3 h=vec3(.012,.03,.07)+vec3(.03,.08,.17)*sh;
      h+=vec3(.35,.8,1.)*(gline(vH/.135,1.)*.16+gline(vH/.45,1.4)*.45)*att;
      h+=vec3(.5,.65,1.)*smoothstep(4.1*1.5,4.9*1.5,vH)*sh*.35;
      h=mix(h,vec3(.008,.02,.05),1.-exp(-d/55.));
      float m=holoM(vW);
      vec3 col=mix(real,h,m);
      col+=vec3(.45,.9,1.)*exp(-pow((vW.x-uScanX)/.35,2.))*step(-60.,uScanX)*step(uScanX,60.);
      gl_FragColor=vec4(col,1.);
    }`,
  polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
});
tmat.extensions = { derivatives: true };
const terrain = new THREE.Mesh(tgeo, tmat); world.add(terrain);

/* low-poly wire for hologram */
{
  const S = 16, G = N / S + 1, pts = [], rnd = mulberry(7);
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    let u = i / (G - 1), v = j / (G - 1);
    if (i > 0 && i < G - 1) u += (rnd() - 0.5) * 0.5 / (G - 1);
    if (j > 0 && j < G - 1) v += (rnd() - 0.5) * 0.5 / (G - 1);
    pts.push(W(u, v, hAt(u, v) + 0.02));
  }
  const pos = [];
  const add = (a, b) => { pos.push(pts[a].x, pts[a].y, pts[a].z, pts[b].x, pts[b].y, pts[b].z); };
  for (let j = 0; j < G - 1; j++) for (let i = 0; i < G - 1; i++) {
    const a = j * G + i, b = a + 1, c = a + G, d = c + 1;
    add(a, b); add(a, c);
    if (rnd() > 0.5) add(a, d); else add(b, c);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const m = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; gl_Position.z-=0.0006*gl_Position.w; }`,
    fragmentShader: `uniform float uScanX; varying vec3 vW; ${holoMix}
      void main(){ float d=length(vW-cameraPosition); float a=holoM(vW)*exp(-d/26.); gl_FragColor=vec4(vec3(.22,.6,1.)*.95*a,1.); }`,
  });
  world.add(new THREE.LineSegments(g, m));
}

/* river ribbon */
const RIV = D.river.map(([u, v, wl]) => W(u, v, wl / 1000 * VEX + 0.008));
{
  const s = [0]; for (let i = 1; i < RIV.length; i++) s.push(s[i - 1] + RIV[i].distanceTo(RIV[i - 1]));
  const pos = [], nrm = [], st = [], idx = [];
  for (let i = 0; i < RIV.length; i++) {
    const a = RIV[Math.max(i - 1, 0)], b = RIV[Math.min(i + 1, RIV.length - 1)];
    const t = new THREE.Vector2(b.x - a.x, b.z - a.z).normalize();
    for (const side of [0, 1]) { pos.push(RIV[i].x, RIV[i].y, RIV[i].z); nrm.push(-t.y, 0, t.x); st.push(s[i], side); }
    if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('side', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('st', new THREE.Float32BufferAttribute(st, 2)); g.setIndex(idx);
  const m = new THREE.ShaderMaterial({
    uniforms: { ...U, uWidth: { value: 0.14 } }, transparent: true, depthWrite: false,
    vertexShader: `attribute vec3 side; attribute vec2 st; uniform float uWidth; varying vec2 vST; varying vec3 vW;
      void main(){ vST=st; vec3 p=position+side*(st.y-.5)*uWidth; vec4 w=modelMatrix*vec4(p,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; gl_Position.z-=0.0004*gl_Position.w; }`,
    fragmentShader: `uniform float uTime,uSat,uScanX,uFogDist; uniform vec3 uFog; varying vec2 vST; varying vec3 vW; ${holoMix}
      void main(){
        float t=vST.y, s=vST.x;
        float edge=smoothstep(0.,.3,t)*smoothstep(1.,.7,t);
        float a=sin(s/.055-uTime*5.+t*2.)*sin(s/.023-uTime*7.3-t*3.);
        vec3 water=mix(vec3(.17,.29,.33),vec3(.55,.68,.74),clamp(.4+.3*a,0.,1.)*.35);
        water=mix(water,vec3(.3,.85,1.),uSat);
        float d=length(vW-cameraPosition);
        water=mix(water,uFog,(1.-exp(-d/uFogDist))*.8*(1.-uSat));
        float core=exp(-pow((t-.5)*4.,2.)); float pulse=.6+.4*pow(.5+.5*sin(s/.18-uTime*9.),3.);
        vec3 hw=vec3(.25,.75,1.)*1.3*pulse+vec3(.85,.97,1.)*core*.9;
        float m=holoM(vW);
        gl_FragColor=vec4(mix(water,hw,m), mix(edge*.95, clamp(core*1.2+.25,0.,1.)*edge, m));
      }`,
  });
  var riverMat = m; world.add(new THREE.Mesh(g, m));
}

/* sky + stars */
const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
  uniforms: U, side: THREE.BackSide, depthWrite: false,
  vertexShader: `varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform vec3 uTop,uHor; uniform float uHolo,uSat; varying vec3 vD;
    void main(){ float y=clamp(vD.y*3.,0.,1.); vec3 c=mix(uHor,uTop,pow(y,.6));
      vec3 h=mix(vec3(.02,.05,.12),vec3(.005,.012,.03),pow(y,.5));
      c=mix(c,h,uHolo); c=mix(c,vec3(.02,.04,.08),uSat); gl_FragColor=vec4(c,1.); }`,
}));
scene.add(sky);
const stars = (() => {
  const p = [], r = mulberry(3);
  for (let i = 0; i < 1600; i++) { const th = r() * Math.PI * 2, ph = Math.acos(r() * 0.95); p.push(800 * Math.sin(ph) * Math.cos(th), 800 * Math.cos(ph), 800 * Math.sin(ph) * Math.sin(th)); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  const m = new THREE.PointsMaterial({ color: 0xcfe6ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false });
  const s = new THREE.Points(g, m); scene.add(s); return s;
})();

/* post */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0, 0.55, 0.32);
{ const set = bloom.setSize.bind(bloom); bloom.setSize = (w, h) => set(Math.round(w / 2), Math.round(h / 2)); }
bloom.enabled = false;
composer.addPass(bloom); composer.addPass(new OutputPass());
composer.setPixelRatio(PR);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false); composer.setSize(innerWidth, innerHeight); micro.resize();
});

/* ---------------- camera rails ---------------- */
const RS = smoothPath(RIV, 10);
const RD = smoothPath(RIV, 28).map((p, i, a) => { const b = a[Math.min(i + 1, a.length - 1)], c = a[Math.max(i - 1, 0)]; return new THREE.Vector3(b.x - c.x, 0, b.z - c.z).normalize(); });
function railAt(arr, k) { k = clamp(k, 0, arr.length - 1.001); const i = Math.floor(k), f = k - i; return arr[i].clone().lerp(arr[i + 1], f); }
function rail(k, back, side, up, ahead, drop = 0.2) {
  const T = railAt(RS, k), d = railAt(RD, k).normalize(), s = new THREE.Vector3(d.z, 0, -d.x);
  const ys = world.scale.y; T.y *= ys;
  return { eye: T.clone().addScaledVector(d, -back).addScaledVector(s, side).add(new THREE.Vector3(0, up, 0)), tgt: T.clone().addScaledVector(d, ahead).add(new THREE.Vector3(0, -drop, 0)) };
}
const CEN = W(0.5, 0.5, 4.8);
const SCENES = [
  { cam: (t) => orbit(t, 50, 24, -2.4), holo: 0, look: 'hero' },
  { cam: (t) => orbit(t, 50, 24, -2.4), holo: 0, look: 'hero', photo: 1, dim: 1 },
  { cam: () => ({ eye: new THREE.Vector3(CEN.x + 2, 128, CEN.z + 0.01), tgt: new THREE.Vector3(CEN.x + 2, 0, CEN.z), up: [0, 0, -1] }), holo: 0, sat: 1, look: 'day', pins: 'towns', fov: 40 },
  { cam: (t) => rail(6 + t * 1.2, 7, 2.6, 2.6, 2.5), holo: 0, look: 'golden', pins: 'dato1' },
  { cam: (t) => rail(D.dato2 - 25 + t * 1.2, 8, -3.5, 2.8, 5), holo: 0, look: 'day', pins: 'dato2' },
  { cam: (t) => rail(40 + t * 1.4, 7.5, 2.8, 4.6 + 2.6, 2.5), holo: 1, look: 'golden', frame: 'Cuenca del río Mantaro · modelo de datos' },
  { cam: (t) => rail(60 + t * 2.2, 7.5, 2.8, 4.6 + 2.6, 2.5), holo: 1, frame: 'Cuenca del río Mantaro · modelo de datos', pins: 'townsH' },
  { cam: (t) => rail(60 + t * 2.2, 7.5, 2.8, 4.6 + 2.6, 2.5), holo: 1, dim: 1, frame: 'Cuenca del río Mantaro · modelo de datos' },
  { cam: (t) => { const u = ease(t / 6); return rail(D.dive - 20 * (1 - u), lerp(7, 0.25, u), lerp(2.5, 0, u), lerp(5.2, 0.15, u) + 2.6 * (1 - u), lerp(2.5, 0.3, u), lerp(0.2, 0.6, u)); }, holo: 1, frame: 'Acercamiento al río · valle del Mantaro' },
  { holo: 1, micro: 1, frame: 'Vista microscópica · esquema ilustrativo' },
  { holo: 1, micro: 1, microDim: 1, frame: 'Vista microscópica · esquema ilustrativo' },
  { holo: 1, micro: 1, microDim: 2, frame: 'Lo que dice la evidencia · revisión de alcance' },
  { cam: (t) => orbit(t, 80, 70, -2.0), holo: 1, dim: 1 },
];
function orbit(t, r, h, a0) { const a = a0 + t * 0.03; return { eye: new THREE.Vector3(Math.cos(a) * r, h, Math.sin(a) * r), tgt: new THREE.Vector3(0, 5.5, 0) }; }

/* ---------------- pins ---------------- */
const pinsEl = $('#pins');
const PINS = [];
function mkPin(name, k, col, set, tip, card) {
  const el = document.createElement('div'); el.className = 'pinlab' + (card ? ' card always' : ''); el.tabIndex = 0;
  el.style.setProperty('--c', col);
  el.innerHTML = `<div class="dot"></div><div class="lab">${name}</div><div class="tip">${tip}</div>`;
  pinsEl.appendChild(el); PINS.push({ el, k, set });
}
const altAt = (k) => Math.round(D.river[Math.min(k, D.river.length - 1)][2] / 10) * 10;
for (const [n, k] of Object.entries(D.towns)) {
  mkPin(n, k, '#e8eef5', 'towns', `río ≈ ${altAt(k).toLocaleString('es-PE')} m`);
  mkPin(n, k, '#6fd2ff', 'townsH', `río ≈ ${altAt(k).toLocaleString('es-PE')} m · km ${Math.round(D.profile[Math.min(Math.round(k * 2 / 6), D.profile.length - 1)][0])}`);
}
mkPin('Dato 1 · La Oroya', 2, '#ff6b6b', 'dato1', 'cabecera del tramo en Junín', true);
mkPin('Dato 2 · Valle del Mantaro', D.dato2, '#f5b83d', 'dato2', 'Jauja · Concepción · Huancayo', true);
const tmpV = new THREE.Vector3();
function updatePins(set) {
  for (const p of PINS) {
    const on = p.set === set;
    if (!on) { p.el.classList.remove('on'); continue; }
    tmpV.copy(RIV[Math.min(p.k, RIV.length - 1)]); tmpV.y *= world.scale.y; tmpV.project(camera);
    const vis = tmpV.z < 1 && Math.abs(tmpV.x) < 0.98 && Math.abs(tmpV.y) < 0.95;
    p.el.classList.toggle('on', vis);
    if (vis) { p.el.style.left = ((tmpV.x + 1) / 2 * innerWidth) + 'px'; p.el.style.top = ((1 - tmpV.y) / 2 * innerHeight) + 'px'; }
  }
}

/* ---------------- HUD content ---------------- */
{
  const prof = $('#prof'), pr = D.profile, x0 = 40, x1 = 300, y0 = 10, y1 = 128, lo = 3100, hi = 3800;
  const X = (s) => x0 + s / pr[pr.length - 1][0] * (x1 - x0), Y = (h) => y1 - (h - lo) / (hi - lo) * (y1 - y0);
  let svg = '';
  for (const v of [3200, 3400, 3600, 3800]) svg += `<line x1="${x0}" x2="${x1}" y1="${Y(v)}" y2="${Y(v)}" stroke="rgba(111,210,255,.18)"/><text x="${x0 - 6}" y="${Y(v) + 4}" fill="#93a3b8" font-size="10" text-anchor="end" font-family="JetBrains Mono, monospace">${v}</text>`;
  svg += `<polyline fill="none" stroke="#6fd2ff" stroke-width="2" points="${pr.map(([s, h]) => `${X(s).toFixed(1)},${Y(h).toFixed(1)}`).join(' ')}"/>`;
  for (const [n, k] of Object.entries(D.towns)) {
    if (n === 'Concepción') continue;
    const s = pr[Math.min(Math.round(k * 2 / 6), pr.length - 1)][0], h = D.river[k][2];
    svg += `<circle cx="${X(s)}" cy="${Y(h)}" r="3.5" fill="#b6f36b"/><text x="${X(s) + (n === 'Huancayo' ? -6 : 6)}" y="${Y(h) - 7}" fill="#e8eef5" font-size="10.5" text-anchor="${n === 'Huancayo' ? 'end' : 'start'}" font-family="Inter, sans-serif">${n}</text>`;
  }
  svg += `<text x="${x1}" y="146" fill="#93a3b8" font-size="10" text-anchor="end" font-family="JetBrains Mono, monospace">${Math.round(pr[pr.length - 1][0])} km</text>`;
  prof.innerHTML = svg;
  const bars = [['Muestra Mantaro', 0.19, '--lead'], ['ECA riego y animales', 0.05, '--amber'], ['ECA 1-A1', 0.01, '--cyan'], ['Consumo (MINSA)', 0.010, '--cyan'], ['OMS', 0.01, '--cyan']];
  $('#pbBars').innerHTML = bars.map(([l, v, c]) => `<div class="row" style="align-items:center"><span class="k fly" style="min-width:128px">${l}</span><span class="fly" style="flex:1;height:10px;background:linear-gradient(90deg,var(${c}) ${v / 0.19 * 100}%,transparent 0)"></span><span class="v fly" style="color:var(${c})">${String(v).replace('.', ',')}</span></div>`).join('');
  $('#bigBars').innerHTML = [['Muestra', 0.19, '--lead'], ['ECA riego y animales', 0.05, '--amber'], ['Agua de consumo', 0.01, '--cyan']].map(([l, v, c]) => `<div class="row" style="align-items:center"><span class="k fly" style="min-width:170px">${l}</span><span class="fly" style="flex:1;height:14px;background:linear-gradient(90deg,var(${c}) ${v / 0.19 * 100}%,transparent 0)"></span><span class="v fly" style="color:var(${c})">${String(v).replace('.', ',')}</span></div>`).join('');
  const ica = [['Excelente', '90–100', '#50c878'], ['Bueno', '75–89', '#96d75a'], ['Regular', '45–74', '#f5b83d'], ['Malo', '30–44', '#f0823c'], ['Pésimo', '0–29', '#ff6b6b']];
  $('#ica').innerHTML = ica.map(([n, r, c]) => `<div class="row"><span class="k fly"><b style="color:${c}">■</b> ${n}</span><span class="v fly">${r}</span></div>`).join('');
  const ev = [['Hidrogel de sagú carboximetilado + ácido cítrico', '64,48 mg/g', 'captación de Pb²⁺', 'Keirudin et al. (2020)', 'lime'],
    ['Biopolímero de papa nativa · 5 mg/L · pH 5', '53,6–73,2 %', 'remoción de plomo', 'Choque-Quispe et al. (2022)', 'lime'],
    ['Cáscara de árbol de pan · biosorbente', '82,0 %', 'remoción de Pb(II); no es hidrogel', 'Priyantha et al. (2019)', 'lime'],
    ['Hidrogel de almidón de árbol de pan', 'Sin datos', 'nadie lo ha medido todavía', 'Revisión de alcance del equipo (2026)', 'lead']];
  $('#evid').innerHTML = ev.map(([a, b, c, d, k]) => `<section style="background:var(--panel);border:1px solid ${k === 'lead' ? 'rgba(255,107,107,.7)' : 'var(--rule)'};padding:16px 18px;display:grid;gap:6px;min-width:0"><div class="fly" style="font:600 11px/1.3 var(--f-body);letter-spacing:.14em;text-transform:uppercase;color:var(--muted)">${a}</div><div class="big c-${k} fly">${b}</div><div class="fly">${c}</div><div class="src fly">${d}</div></section>`).join('');
}

/* flying cursors: each text arrives carried by a pointer */
const curLayer = $('#cursors');
const CCOL = ['#ffffff', '#b6f36b', '#6fd2ff', '#f5b83d', '#ff8caa'];
const cursorSVG = (c) => `<svg viewBox="0 0 22 30"><path d="M1 1v24l6.5-5.5L12 29l5-2-4.5-9.5H21z" fill="${c}" stroke="#111" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
function edgePoint(r) {
  const s = Math.floor(r() * 4);
  return s === 0 ? [-40, 80 + r() * (innerHeight - 160)] : s === 1 ? [innerWidth + 40, 80 + r() * (innerHeight - 160)] : s === 2 ? [80 + r() * (innerWidth - 160), -40] : [80 + r() * (innerWidth - 160), innerHeight + 40];
}
let flyToken = 0;
function flyIn(panel, token) {
  const els = $$('.fly', panel);
  if (REDUCE) { els.forEach((e) => e.classList.add('shown')); return; }
  const r = mulberry(Math.floor(Math.random() * 1e6)), step = Math.max(55, Math.min(140, 1600 / els.length)) / SLOW;
  els.forEach((el, i) => {
    setTimeout(() => {
      if (token !== flyToken || !panel.classList.contains('on')) return;
      const b = el.getBoundingClientRect(); if (!b.width) { el.classList.add('shown'); return; }
      const [sx, sy] = edgePoint(r), tx = b.left, ty = b.top + b.height / 2;
      el.classList.add('shown');
      el.animate([{ transform: `translate(${sx - tx}px,${sy - ty}px)` }, { transform: 'none' }], { duration: 850 / SLOW, easing: 'cubic-bezier(.2,.75,.25,1)' });
      const col = CCOL[Math.floor(r() * CCOL.length)];
      const c = document.createElement('div'); c.innerHTML = cursorSVG(col); const sv = c.firstChild; curLayer.appendChild(sv);
      const [ex, ey] = edgePoint(r);
      const a = sv.animate([{ transform: `translate(${sx - 6}px,${sy - 4}px)` }, { transform: `translate(${tx - 6}px,${ty - 4}px)` }], { duration: 850 / SLOW, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'forwards' });
      a.onfinish = () => {
        const ring = document.createElement('div'); ring.className = 'ring'; ring.style.left = (tx - 6) + 'px'; ring.style.top = (ty - 4) + 'px'; ring.style.borderColor = col; curLayer.appendChild(ring);
        ring.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(3.4)', opacity: 0 }], { duration: 420 / SLOW }).onfinish = () => ring.remove();
        sv.animate([{ transform: `translate(${tx - 6}px,${ty - 4}px)`, opacity: 1 }, { transform: `translate(${ex}px,${ey}px)`, opacity: 0 }], { duration: 650 / SLOW, delay: 120 / SLOW, easing: 'ease-in', fill: 'forwards' }).onfinish = () => sv.remove();
      };
    }, 350 / SLOW + i * step);
  });
}

/* ---------------- scene switching ---------------- */
const panels = $$('#hud [data-s]');
let autoT = 0, autoOn = true;
let cur = -1, tScene = 0, holoTarget = 0, exploring = false, holoOverride = null;
const frame = $('#frame'), photo = $('#photo'), micro = makeMicro($('#micro'));
function go(i) {
  i = clamp(i, 0, SCENES.length - 1); if (i === cur) return;
  cur = i; tScene = 0; flyToken++; autoT = 0;
  const S = SCENES[i];
  $('#count').textContent = `${i + 1} / ${SCENES.length}`;
  lookTarget = LOOKS[S.look || 'golden'];
  holoTarget = S.holo; holoOverride = null; syncSeg();
  photo.classList.toggle('on', !!S.photo);
  canvas.classList.toggle('dim', !!S.dim);
  frame.classList.toggle('on', !!S.frame); if (S.frame) $('#frameT').textContent = S.frame;
  micro.show(!!S.micro, S.microDim || 0);
  canvas.style.visibility = S.micro ? 'hidden' : 'visible';
  panels.forEach((p) => {
    const on = p.dataset.s.split(',').map(Number).includes(i);
    if (on && !p.classList.contains('on')) { p.classList.add('on'); flyIn(p, flyToken); }
    if (!on && p.classList.contains('on')) { p.classList.remove('on'); $$('.fly', p).forEach((e) => { e.getAnimations().forEach((a) => a.cancel()); e.classList.remove('shown'); }); }
  });
  if (document.body.classList.contains('present')) {
    const st = $(`.step[data-scene="${i}"] .story`); $('#caption').innerHTML = st ? `<div class="story">${st.innerHTML}</div>` : '';
    $('#caption .go')?.remove();
  }
}

/* scroll mode */
const io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) go(+e.target.dataset.scene); }, { rootMargin: '-45% 0px -45% 0px' });
$$('[data-scene]').forEach((s) => io.observe(s));

/* presentation mode */
function present(on) {
  document.body.classList.toggle('present', on);
  if (on) { try { document.documentElement.requestFullscreen?.().catch(() => {}); } catch (e) {} setAuto(true); const c = cur; cur = -1; go(Math.max(c, 0)); }
  else { try { document.fullscreenElement && document.exitFullscreen(); } catch (e) {} $(`.step[data-scene="${cur}"]`)?.scrollIntoView({ block: 'center' }); }
}
$('#bPresent').onclick = () => present(true); $('#bStart').onclick = () => present(true);
$('#bScroll').onclick = () => $('.step[data-scene="1"]').scrollIntoView({ behavior: 'smooth', block: 'center' });
$('#bExit').onclick = () => present(false);
$('#bNext').onclick = () => go(cur + 1); $('#bPrev').onclick = () => go(cur - 1);
function setAuto(on) { autoOn = on; autoT = 0; const b = $('#bAuto'); b.textContent = on ? '❚❚' : '▶'; b.setAttribute('aria-label', on ? 'Pausar avance automático' : 'Reanudar avance automático'); b.setAttribute('aria-pressed', on); }
$('#bAuto').onclick = () => setAuto(!autoOn);
addEventListener('keydown', (e) => {
  if (!document.body.classList.contains('present')) return;
  if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); go(cur + 1); }
  if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); go(cur - 1); }
  if (e.key === 'Escape') present(false);
  if (e.key === 'p' || e.key === 'P') setAuto(!autoOn);
});
canvas.addEventListener('click', () => { if (document.body.classList.contains('present') && !exploring) go(cur + 1); });
$('#micro').addEventListener('click', () => { if (document.body.classList.contains('present')) go(cur + 1); });

/* explore + style toggles */
const controls = new OrbitControls(camera, canvas); controls.enabled = false; controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.49;
$('#bExplore').onclick = () => {
  exploring = !exploring; controls.enabled = exploring; $('#bExplore').setAttribute('aria-pressed', exploring);
  if (exploring) { controls.target.copy(camTgt); canvas.style.cursor = 'grab'; document.body.style.overflow = 'hidden'; }
  else { canvas.style.cursor = ''; document.body.style.overflow = ''; }
  $('#story').style.visibility = exploring ? 'hidden' : '';
};
function syncSeg() { const h = holoOverride ?? holoTarget; $('#bReal').setAttribute('aria-pressed', h < 0.5); $('#bHolo').setAttribute('aria-pressed', h >= 0.5); }
$('#bReal').onclick = () => { holoOverride = 0; syncSeg(); };
$('#bHolo').onclick = () => { holoOverride = 1; syncSeg(); };

/* ---------------- loop ---------------- */
let holo = 0, sat = 0, last = performance.now(), animT = 0;
const camEye = camera.position.clone(), camTgt = new THREE.Vector3(0, 3, 0), camUp = new THREE.Vector3(0, 1, 0);
const tmpC = new THREE.Color();
$('#loading').remove();
go(0);
function frameLoop(now) {
  const raw = Math.min(1, (now - last) / 1000), rdt = Math.min(0.05, raw); last = now; const dt = rdt * SLOW; tScene += dt; animT += dt;
  const S = SCENES[cur];
  const hT = holoOverride ?? holoTarget;
  holo += (hT - holo) * (1 - Math.exp(-dt * (REDUCE ? 20 : 1.4)));
  if (Math.abs(hT - holo) < 0.002) holo = hT;
  sat += ((S.sat || 0) - sat) * (1 - Math.exp(-dt * 2.5));
  U.uHolo.value = holo; U.uSat.value = sat; U.uTime.value = animT;
  U.uScanX.value = holo <= 0.001 ? -1e3 : holo >= 0.999 ? 1e3 : lerp(-SIZE * 0.62, SIZE * 0.62, holo);
  world.scale.y = lerp(1, 1.7, ease(holo));
  const k = 1 - Math.exp(-dt * 1.5);
  U.uSun.value.lerp(tmpV.fromArray(lookTarget.sun), k);
  for (const [u, key] of [[U.uSunCol, 'sunCol'], [U.uFog, 'fog'], [U.uTop, 'top'], [U.uHor, 'hor']]) u.value.lerp(tmpC.setRGB(...lookTarget[key]), k);
  U.uFogDist.value = lerp(U.uFogDist.value, lookTarget.fogDist, k);
  riverMat.uniforms.uWidth.value = lerp(0.14, 0.42, Math.max(sat, holo * 0.6));
  stars.material.opacity = holo;
  bloom.strength = 0.95 * holo; bloom.enabled = holo > 0.02;
  perf(rdt);
  const presenting = document.body.classList.contains('present');
  if (presenting && autoOn && !exploring && cur < SCENES.length - 1) { autoT += raw; if (autoT >= AUTO_SEC) go(cur + 1); }
  $('#autobar').style.transform = `scaleX(${presenting && autoOn && cur < SCENES.length - 1 ? Math.min(autoT / AUTO_SEC, 1) : 0})`;
  if (S.micro) { micro.draw(dt); requestAnimationFrame(frameLoop); return; }
  if (exploring) controls.update();
  else if (S.cam) {
    const c = S.cam(REDUCE ? 0 : tScene);
    const kk = 1 - Math.exp(-dt * (REDUCE ? 30 : 1.6));
    camEye.lerp(c.eye, kk); camTgt.lerp(c.tgt, kk);
    camUp.lerp(tmpV.fromArray(c.up || [0, 1, 0]), kk).normalize();
    camera.position.copy(camEye); camera.up.copy(camUp); camera.lookAt(camTgt);
    const fov = S.fov || 50; if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = lerp(camera.fov, fov, kk); camera.updateProjectionMatrix(); }
  }
  if (cur === 8) $('#mag').textContent = Math.round(10 ** lerp(0, 6, ease((tScene - 1) / 5))).toLocaleString('es-PE');
  updatePins(S.pins);
  composer.render();
  requestAnimationFrame(frameLoop);
}
requestAnimationFrame(frameLoop);

/* ---------------- microscope ---------------- */
function makeMicro(cvs) {
  const g = cvs.getContext('2d');
  let w, h, sc, sites = [], ions = [], spawnT = 0, active = false, mt = 0;
  function resize() {
    const dpr = Math.min(devicePixelRatio, 1.5); w = innerWidth; h = innerHeight; cvs.width = w * dpr; cvs.height = h * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    sc = Math.min(w / 1920, h / 1080) * 1.15; layout();
  }
  let rings = [];
  function layout() {
    rings = []; sites = [];
    const x0 = w * 0.07, span = Math.min(w * 0.66, w - 380 * (w > 820 ? 1 : 0)), n = 20, dx = span / n;
    for (let r = 0; r < 4; r++) {
      const y = h * (0.28 + r * 0.14), row = [];
      for (let k = 0; k < n; k++) row.push([x0 + k * dx + (r % 2 ? dx / 2 : 0), y + 14 * sc * Math.sin(k * 0.7 + r)]);
      rings.push(row);
    }
    for (let r = 0; r < 4; r++) for (let k = 1; k < n; k += 3) { const s = (k + r) % 2 ? -1 : 1, p = rings[r][k]; sites.push({ x: p[0], y: p[1] + s * 34 * sc, base: p, side: s, ion: null }); }
    ions = [];
  }
  const XL = [[0, 3], [0, 11], [1, 7], [1, 15], [2, 4], [2, 12], [0, 17], [2, 18], [1, 1]];
  function hex(x, y, r) { g.beginPath(); for (let j = 0; j < 6; j++) { const a = Math.PI / 3 * j + Math.PI / 6; g.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)); } g.closePath(); }
  function bg(t) {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#062040'); gr.addColorStop(1, '#020a18'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(60,140,220,.10)'; g.lineWidth = 1;
    for (let x = (t * 12) % 70; x < w; x += 70) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y < h; y += 70) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.strokeStyle = 'rgba(120,200,255,.10)'; g.lineWidth = 2;
    for (let i = 0; i < 7; i++) { g.beginPath(); for (let x = 0; x <= w; x += 24) g.lineTo(x, h * (i + 0.5) / 7 + 18 * Math.sin(x * 0.012 + t * 0.9 + i * 1.7)); g.stroke(); }
  }
  function draw(dt) {
    if (!active) return;
    mt += dt; const t = mt;
    bg(t);
    const c1 = ease(t / 3.2), c2 = ease((t - 3.4) / 2), c3 = ease((t - 5.6) / 1.2);
    g.lineWidth = 3 * sc;
    rings.forEach((row, r) => {
      const n = Math.floor(row.length * clamp(c1 * 1.15 - r * 0.05, 0, 1));
      g.strokeStyle = 'rgba(90,120,160,.9)'; g.beginPath(); for (let k = 0; k < n; k++) g.lineTo(row[k][0], row[k][1]); g.stroke();
      for (let k = 0; k < n; k++) { hex(row[k][0], row[k][1], 16 * sc); g.fillStyle = '#16223a'; g.fill(); g.strokeStyle = '#78aadc'; g.lineWidth = 1.6 * sc; g.stroke(); }
    });
    XL.forEach(([r, k], j) => {
      const p = ease((t - 3.4 - 0.15 * j) / 0.6); if (p <= 0) return;
      const a = rings[r][k], b = rings[r + 1][k];
      g.strokeStyle = '#8fd14f'; g.lineWidth = 4 * sc; g.beginPath(); g.moveTo(a[0], a[1] + 16 * sc); g.lineTo(lerp(a[0], b[0], p), lerp(a[1] + 16 * sc, b[1] - 16 * sc, p)); g.stroke();
    });
    sites.forEach((s, j) => {
      const p = ease((t - 5.6 - 0.04 * j) / 0.4); if (p <= 0) return;
      g.strokeStyle = 'rgba(182,243,107,.7)'; g.lineWidth = 1.5 * sc; g.beginPath(); g.moveTo(s.base[0], s.base[1] + s.side * 16 * sc); g.lineTo(s.x, s.y); g.stroke();
      g.fillStyle = '#b6f36b'; g.beginPath(); g.arc(s.x, s.y, 6 * sc * p, 0, 7); g.fill();
    });
    if (t < 12) {
      const la = Math.min(ease((t - 1) / 0.6), ease((12 - t) / 0.6));
      g.globalAlpha = la; g.fillStyle = '#e8eef5'; g.font = `500 ${15 * Math.max(sc, 0.75)}px Inter, sans-serif`;
      const e = rings[0][0]; g.fillText('Cadena de almidón (glucosa)', e[0] - 10, e[1] - 34 * sc);
      if (t > 4) { const a = rings[1][7]; g.fillText('Puente de ácido cítrico', a[0] + 14, a[1] + 64 * sc); }
      if (t > 6.2) { const s = sites[sites.length - 2]; g.fillStyle = '#b6f36b'; g.fillText('Grupo –COO⁻', s.x + 14, s.y + 5); }
      g.globalAlpha = 1;
    }
    if (t > 7.5) {
      spawnT -= dt;
      if (spawnT <= 0 && ions.length < 90) { spawnT = 0.22; const r = Math.random(); ions.push({ x: -20, y: h * (0.2 + Math.random() * 0.62), v: (140 + Math.random() * 80) * sc * 1.2, ph: Math.random() * 6, amp: 8 + Math.random() * 16, kind: r < 0.62 ? 'Pb' : r < 0.82 ? 'Zn' : 'Cu', bound: null, tb: 0 }); }
    }
    const COL = { Pb: '#ff6b6b', Zn: '#f5b83d', Cu: '#4fd1c5' };
    for (const io of ions) {
      if (io.bound) {
        io.tb += dt; const s = io.bound, p = ease(io.tb / 0.4); io.x = lerp(io.fx, s.x, p); io.y = lerp(io.fy, s.y, p);
        if (p >= 1) { g.strokeStyle = COL[io.kind] + '88'; g.lineWidth = 2; g.beginPath(); g.arc(io.x, io.y, (20 + 4 * Math.sin(io.tb * 5)) * sc, 0, 7); g.stroke(); }
      } else {
        io.x += io.v * dt; io.ph += dt * 2; const y = io.y + io.amp * Math.sin(io.ph);
        if (c3 >= 1) for (const s of sites) {
          if (s.ion) continue;
          if (Math.hypot(s.x - io.x, s.y - y) < 60 * sc && Math.random() < (io.kind === 'Pb' ? 0.35 : 0.03)) { s.ion = io; io.bound = s; io.fx = io.x; io.fy = y; io.tb = 0; break; }
        }
        io.dy = y;
      }
      const yy = io.bound ? io.y : io.dy;
      g.fillStyle = COL[io.kind]; g.beginPath(); g.arc(io.x, yy, 15 * sc, 0, 7); g.fill();
      g.fillStyle = '#0a0c10'; g.font = `700 ${11 * Math.max(sc, 0.8)}px Inter, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(io.kind, io.x, yy + 1); g.textAlign = 'start'; g.textBaseline = 'alphabetic';
    }
    ions = ions.filter((io) => io.bound || io.x < w + 30);
  }
  function show(on, dimmed) {
    if (on && !active) { layout(); mt = 0; }
    active = on; cvs.classList.toggle('on', on); cvs.classList.toggle('dim', on && dimmed === 1); cvs.classList.toggle('faint', on && dimmed === 2);
  }
  resize();
  return { draw, show, resize };
}

/* adaptive quality: lower the render resolution when frames are slow */
let pf = 0, pt = 0, settle = 2.5;
function perf(dt) {
  if (document.hidden) return;
  settle -= dt; if (settle > 0) return;
  pf++; pt += dt;
  if (pf >= 90) {
    const ms = pt / pf * 1000; pf = 0; pt = 0;
    if (ms > 24 && PR > 0.6) {
      PR = Math.max(0.6, PR - 0.25); renderer.setPixelRatio(PR); composer.setPixelRatio(PR);
      renderer.setSize(innerWidth, innerHeight, false); composer.setSize(innerWidth, innerHeight); settle = 1.5;
    }
  }
}

/* ---------------- utils ---------------- */
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function smoothPath(P, r) {
  return P.map((_, i) => { const v = new THREE.Vector3(); let wsum = 0; for (let j = -r * 2; j <= r * 2; j++) { const q = P[clamp(i + j, 0, P.length - 1)], wt = Math.exp(-(j * j) / (2 * r * r)); v.addScaledVector(q, wt); wsum += wt; } return v.multiplyScalar(1 / wsum); });
}
