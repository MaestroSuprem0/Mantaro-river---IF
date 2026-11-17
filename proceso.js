/* Parte 2 · Del almidón al hidrogel. Canvas 2D: esquema molecular de la receta y mallas de cada material. */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const ease = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const SLOW = 0.75;      // velocidad global de las animaciones (igual que la Parte 1)
const AUTO_SEC = 40;    // segundos por escena en modo presentación
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (REDUCE) document.documentElement.classList.add('reduce');
const NSCENES = 15;

const C = { ink: '#1f2b22', muted: '#6e7c70', sage: '#5e8c61', light: '#96b494', leaf: '#2f6b3a', ochre: '#b07d28', lead: '#c0533a', gel: [46, 124, 98] };
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const mixc = (a, b, t) => a.map((v, i) => Math.round(lerp(v, b[i], t)));

/* ---------------- canvas ---------------- */
const cv = $('#stage'), g = cv.getContext('2d');
let w = 0, h = 0, dpr = 1;
function resize() { dpr = Math.min(devicePixelRatio || 1, 2); w = innerWidth; h = innerHeight; cv.width = w * dpr; cv.height = h * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); }
addEventListener('resize', resize); resize();
const mobile = () => w <= 820;

/* ---------------- mallas ---------------- */
const NU = 44, NV = 24, NP = NU * NV;
const UU = new Float32Array(NP), VV = new Float32Array(NP);
for (let i = 0; i < NV; i++) for (let j = 0; j < NU; j++) { UU[i * NU + j] = j / NU; VV[i * NU + j] = i / (NV - 1); }
function build(fn) { const P = new Float32Array(NP * 3); for (let k = 0; k < NP; k++) { const th = UU[k] * Math.PI * 2, ph = VV[k] * Math.PI, v = VV[k]; const p = fn(th, ph, v); P[k * 3] = p[0]; P[k * 3 + 1] = p[1]; P[k * 3 + 2] = p[2]; } return P; }
const sph = (th, ph) => [Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)];
const angd = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const SHAPES = {
  papa: build((th, ph) => {
    let r = 1 + 0.07 * Math.sin(3 * th + 1) * Math.sin(2 * ph) + 0.05 * Math.cos(5 * th - 3 * ph) + 0.04 * Math.sin(2 * th + 4 * ph);
    for (const [t0, p0] of [[0.4, 1.0], [2.2, 1.9], [3.9, 1.3], [5.1, 2.3], [1.3, 2.5]]) { const d = angd(th - t0); r -= 0.09 * Math.exp(-(d * d + (ph - p0) ** 2) / (2 * 0.13 * 0.13)); }
    const s = sph(th, ph); return [1.32 * s[0] * r, 0.80 * s[1] * r, 0.92 * s[2] * r];
  }),
  sagu: build((th, ph, v) => { const R = 0.62 * (1 + 0.045 * Math.cos(2 * Math.PI * v * 8)) * Math.pow(clamp(Math.min(v, 1 - v) / 0.05, 0, 1), 0.4); return [R * Math.cos(th), (v - 0.5) * -2.5, R * Math.sin(th)]; }),
  yuca: build((th, ph, v) => { const R = 0.46 * Math.pow(Math.sin(Math.PI * v), 0.62) * (1.12 - 0.35 * v) * (1 + 0.03 * Math.sin(46 * v)); const y = 0.28 * Math.sin(Math.PI * v) - 0.1; return [(v - 0.5) * 3.2, y + R * Math.cos(th), R * Math.sin(th)]; }),
  alca: build((th, ph, v) => {
    const row = Math.floor(v * 7), pet = Math.pow(0.5 + 0.5 * Math.cos(7 * th + row * Math.PI / 2), 3);
    const r = 1 + 0.16 * pet * Math.sqrt(Math.sin(ph)); const s = sph(th, ph);
    let x = s[0] * r * 0.92, y = s[1] * r * 1.05, z = s[2] * r * 0.92;
    if (v < 0.18) y += (0.18 - v) * 1.2;
    if (v > 0.86) { const k = (v - 0.86) / 0.14; x = lerp(x, 0.17 * Math.cos(th), k); z = lerp(z, 0.17 * Math.sin(th), k); y -= k * 0.55; }
    return [x, y, z];
  }),
  pan: build((th, ph, v) => {
    const r = 1 + 0.035 * Math.abs(Math.sin(9 * th) * Math.sin(9 * ph)); const s = sph(th, ph);
    let x = s[0] * r, y = s[1] * r * 1.08, z = s[2] * r;
    if (v < 0.08) { const k = (0.08 - v) / 0.08; x = lerp(x, 0.07 * Math.cos(th), k); z = lerp(z, 0.07 * Math.sin(th), k); y += k * 0.35; }
    return [x, y, z];
  }),
};
const sgp = (x, e) => Math.sign(x) * Math.pow(Math.abs(x), e);
const gel = (e, sx, sy) => build((th, ph) => [sx * sgp(Math.sin(ph), e) * sgp(Math.cos(th), e), sy * sgp(Math.cos(ph), e), sx * sgp(Math.sin(ph), e) * sgp(Math.sin(th), e)]);
const GELS = { papa: gel(0.3, 1.25, 0.28), sagu: gel(0.38, 0.92, 0.78), yuca: gel(0.75, 0.88, 0.88), pan: gel(0.6, 0.9, 0.9) };
const NOISE = (() => { const r = mulberry(5), a = new Float32Array(NP * 3); for (let k = 0; k < NP * 3; k++) { const u = r() || 1e-6, v = r(); a[k] = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); } return a; })();
const WORK = new Float32Array(NP * 3), QX = new Float32Array(NP), QY = new Float32Array(NP), FR = new Float32Array(NP);
function morph(A, B, m) {
  if (!B || m <= 0) { WORK.set(A); return WORK; }
  for (let k = 0; k < NP; k++) {
    const e = ease((m - 0.45 * VV[k]) / 0.55), s = Math.sin(Math.PI * e) * 0.32;
    for (let c = 0; c < 3; c++) WORK[k * 3 + c] = A[k * 3 + c] * (1 - e) + B[k * 3 + c] * e + s * NOISE[k * 3 + c];
  }
  return WORK;
}
function project(P, yaw, pitch, cx, cy, sc, dist = 4.5) {
  const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  for (let k = 0; k < NP; k++) {
    const X = P[k * 3], Y = P[k * 3 + 1], Z = P[k * 3 + 2];
    const x = X * cyw + Z * syw, z = -X * syw + Z * cyw, y2 = Y * cp - z * sp, z2 = Y * sp + z * cp, f = dist / (dist + z2);
    QX[k] = cx + sc * x * f; QY[k] = cy - sc * y2 * f; FR[k] = Math.pow(clamp(1 - (z2 + 1.3) / 2.6, 0, 1), 1.4);
  }
}
const BINS = 6, binPaths = Array.from({ length: BINS }, () => []);
function drawMesh(col, a, reveal) {
  for (const b of binPaths) b.length = 0;
  const seg = (k0, k1) => { if (VV[k1] > reveal && VV[k0] > reveal) return; const z = (FR[k0] + FR[k1]) / 2; binPaths[Math.min(BINS - 1, Math.floor(z * BINS))].push(k0, k1); };
  for (let i = 0; i < NV; i++) for (let j = 0; j < NU; j++) seg(i * NU + j, i * NU + (j + 1) % NU);
  for (let j = 0; j < NU; j += 2) for (let i = 0; i < NV - 1; i++) seg(i * NU + j, (i + 1) * NU + j);
  for (let b = 0; b < BINS; b++) {
    const p = binPaths[b]; if (!p.length) continue; const z = (b + 0.5) / BINS;
    g.strokeStyle = rgba(col, (0.10 + 0.80 * z) * a); g.lineWidth = z > 0.55 ? 1.5 : 1.0; g.beginPath();
    for (let q = 0; q < p.length; q += 2) { g.moveTo(QX[p[q]], QY[p[q]]); g.lineTo(QX[p[q + 1]], QY[p[q + 1]]); }
    g.stroke();
  }
}
function ion(x, y, a, label, r = 6) {
  g.strokeStyle = rgba([192, 83, 58], 0.35 * a); g.lineWidth = 1; g.beginPath(); g.arc(x, y, r + 6, 0, 7); g.stroke();
  g.fillStyle = rgba([192, 83, 58], a); g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  if (label) { g.fillStyle = rgba([192, 83, 58], a); g.font = '600 13px Inter, sans-serif'; g.textBaseline = 'middle'; g.fillText('Pb²⁺', x + 12, y - 11); }
}
function label(txt, x, y, col, a, size = 12, track = 0.3) {
  g.save(); g.font = `600 ${size}px Inter, sans-serif`; g.fillStyle = rgba(col, a); g.textAlign = 'center'; g.textBaseline = 'middle';
  if ('letterSpacing' in g) { g.letterSpacing = `${size * track}px`; g.fillText(txt, x + size * track / 2, y); } else g.fillText(txt.split('').join(' '), x, y);
  g.restore();
}

const MATS = {
  8: { key: 'papa', col: [168, 120, 58], gel: true, lab: 'BIOPOLÍMERO (PELÍCULA)' },
  9: { key: 'sagu', col: [140, 92, 52], gel: true, lab: 'HIDROGEL' },
  10: { key: 'yuca', col: [150, 118, 70], gel: true, lab: 'HIDROGEL' },
  11: { key: 'alca', col: [64, 128, 58], gel: false, lab: 'RESIDUO SECO' },
  12: { key: 'pan', col: [78, 132, 40], gel: true, lab: 'HIDROGEL HIPOTÉTICO', hyp: true },
  0: { key: 'pan', col: [78, 132, 40], gel: false, hero: true },
};
function drawMaterial(M, t, a) {
  const mob = mobile();
  const cx = M.hero ? (mob ? w * 0.5 : w * 0.84) : (mob ? w * 0.5 : w * 0.25);
  const cy = M.hero ? (mob ? h * 0.24 : h * 0.5) : (mob ? h * 0.6 : h * 0.4);
  const sc = M.hero ? Math.min(w, h) * (mob ? 0.16 : 0.2) : (mob ? Math.min(w * 0.24, h * 0.12) : Math.min(w * 0.15, h * 0.21)) * (M.key === 'alca' ? 0.9 : 1);
  const m = M.gel ? ease((t - 4) / 6.5) : 0, hyp = !!M.hyp;
  const P = morph(SHAPES[M.key], M.gel ? GELS[M.key] : null, m);
  project(P, t * 0.42 + 0.6, 0.32, cx, cy, sc);
  let col = mixc(M.col, hyp ? [176, 125, 40] : C.gel, m);
  if (M.key === 'alca') col = mixc(M.col, [138, 110, 62], ease((t - 5) / 4));
  // mancha suave detrás
  const gr = g.createRadialGradient(cx, cy, 0, cx, cy, sc * 1.9); gr.addColorStop(0, rgba([214, 228, 206], 0.75 * a)); gr.addColorStop(1, rgba([214, 228, 206], 0));
  g.fillStyle = gr; g.fillRect(cx - sc * 2, cy - sc * 2, sc * 4, sc * 4);
  drawMesh(col, a * (M.hero ? 0.55 : 1), REDUCE ? 2 : ease(t / 2.2) * 1.05);
  if (M.hero) return;
  const lab = m > 0.6 ? M.lab : (M.key === 'alca' && t > 6 ? 'RESIDUO SECO' : 'MATERIA PRIMA');
  label(lab, cx, cy + sc * 1.55, col, a * 0.9, 12);
  if (M.gel && t > 4 && t < 10.5) label('SÍNTESIS EN CURSO', cx, cy + sc * 1.55 + 22, [110, 124, 112], a * Math.min(ease((t - 4) / 0.5), ease((10.5 - t) / 0.5)), 10);
  // iones de plomo
  const r = mulberry(M.key.length * 31 + 7), t0 = M.gel ? 10.5 : 7;
  for (let i = 0; i < 14; i++) {
    const ts = t0 + i * 0.75, ang = Math.PI + (r() - 0.5) * 2.5, dist = sc * (2.1 + r() * 0.7);
    const vi = 3 + Math.floor(r() * (NV - 6)), vj = Math.floor(r() * NU), k = vi * NU + vj;
    const sx = Math.max(-20, cx + dist * Math.cos(ang)), sy = cy + dist * Math.sin(ang) * 0.75;
    const p = (t - ts) / 2.4; if (p <= 0) continue;
    const tx = QX[k], ty = QY[k];
    if (hyp) { const e = ease(Math.min(p, 1)) * 0.62; ion(lerp(sx, tx, e) + 8 * Math.sin(t * 2 + i), lerp(sy, ty, e) + 8 * Math.cos(t * 1.7 + i), 0.75 * a, i < 2); continue; }
    if (p < 1) { const e = ease(p), wv = Math.sin(Math.PI * e) * 40; ion(lerp(sx, tx, e) + wv * Math.sin(ang * 3), lerp(sy, ty, e) + wv * Math.cos(ang * 3), a, i < 3); }
    else {
      ion(tx, ty, (0.25 + 0.75 * FR[k]) * a, false, 5);
      const q = (p - 1) * 2.4 / 0.5; if (q < 1) { g.strokeStyle = rgba([47, 107, 58], (1 - q) * a); g.lineWidth = 2; g.beginPath(); g.arc(tx, ty, 8 + 24 * q, 0, 7); g.stroke(); }
    }
  }
  if (hyp && m > 0.6) {
    g.fillStyle = rgba([176, 125, 40], a * ease((t - 10) / 1) * (0.75 + 0.25 * Math.sin(t * 2.5)));
    g.font = `300 ${sc * 0.9}px Inter, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', cx, cy); g.textAlign = 'start';
  }
}

/* ---------------- receta (esquema molecular) ---------------- */
const NHEX = 11, BRIDGES = [[0, 1], [0, 4], [0, 7], [0, 9], [1, 2], [1, 5], [1, 8], [1, 10]];
const CIT = (() => { const r = mulberry(9); return Array.from({ length: 10 }, () => [r(), r(), r() * 6.28]); })();
const ph = { O: 0, C: 0, Cit: 0, Br: 0, Wash: 0, Sw: 0, Pb: 0 };
const TARGETS = { 1: {}, 2: { O: 1 }, 3: { O: 1, C: 1 }, 4: { O: 1, C: 1, Cit: 1 }, 5: { O: 1, C: 1, Cit: 1, Br: 1 }, 6: { O: 1, C: 1, Cit: 1, Br: 1, Wash: 1, Sw: 1 }, 7: { O: 1, C: 1, Cit: 1, Br: 1, Wash: 1, Sw: 1, Pb: 1 } };
const stag = (v, k, n) => clamp(v * 2 - k / n, 0, 1);
function hexagon(x, y, r) { g.beginPath(); for (let k = 0; k < 6; k++) { const an = Math.PI / 3 * k + Math.PI / 6; g.lineTo(x + r * Math.cos(an), y + r * Math.sin(an)); } g.closePath(); }
function drawRecipe(t, a, scene, tw) {
  const mob = mobile();
  const x0 = mob ? w * 0.08 : w * 0.40, x1 = mob ? w * 0.92 : w * 0.95, DX = (x1 - x0) / (NHEX - 1);
  const R = Math.min(DX * 0.26, h * 0.024), gap = Math.min(h * 0.13, 150) * (1 + 0.16 * ease(ph.Sw)), yc = mob ? h * 0.40 : h * 0.46;
  const rows = [yc - gap, yc, yc + gap];
  const hp = (i, j) => [x0 + j * DX, rows[i] + R * 0.45 * Math.sin(j * 0.9 + i + tw * 0.6)];
  // leyenda
  const ly = rows[0] - R * 4.2; let lx = x0;
  g.font = '12px Inter, sans-serif'; g.textBaseline = 'middle';
  for (const [c, s] of [[C.sage, 'Glucosa (almidón)'], [C.leaf, 'Grupo –COO⁻'], [C.ochre, 'Ácido cítrico / puente éster'], [C.lead, 'Ion Pb²⁺']]) {
    if (mob && s.length > 20) continue;
    g.globalAlpha = a; g.fillStyle = c; g.beginPath(); g.arc(lx + 5, ly, 5, 0, 7); g.fill(); g.fillStyle = C.muted; g.fillText(s, lx + 16, ly); lx += g.measureText(s).width + 44;
  }
  g.globalAlpha = 1;
  // puentes
  BRIDGES.forEach(([i, j], k) => {
    const q = stag(ph.Br, k, BRIDGES.length); if (q <= 0) return;
    const p0 = hp(i, j), p1 = hp(i + 1, j);
    g.strokeStyle = rgba([176, 125, 40], q * a); g.lineWidth = 3; g.beginPath(); g.moveTo(p0[0], p0[1] + R); g.lineTo(p1[0], p1[1] - R); g.stroke();
    g.fillStyle = rgba([176, 125, 40], q * a); g.beginPath(); g.arc((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, 4.5, 0, 7); g.fill();
  });
  // cadenas
  const da = ease(t / 1.5) * a;
  for (let i = 0; i < 3; i++) {
    g.strokeStyle = rgba([150, 180, 148], da); g.lineWidth = 2;
    for (let j = 0; j < NHEX - 1; j++) { const p = hp(i, j), q = hp(i, j + 1); g.beginPath(); g.moveTo(p[0] + R, p[1]); g.lineTo(q[0] - R, q[1]); g.stroke(); }
    g.strokeStyle = rgba([94, 140, 97], da); g.fillStyle = rgba([252, 251, 246], da);
    for (let j = 0; j < NHEX; j++) { const p = hp(i, j); hexagon(p[0], p[1], R); g.fill(); g.stroke(); }
  }
  // sitios
  const sites = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < NHEX; j++) {
    if ((i + j) % 2 || BRIDGES.some(([bi, bj]) => bj === j && (bi === i || bi + 1 === i))) continue;
    const up = i === 0 ? -1 : i === 2 ? 1 : (j % 4 === 0 ? -1 : 1), c = hp(i, j); sites.push([c[0], c[1] + up * R * 2.1, c, up]);
  }
  g.textAlign = 'center'; g.font = `600 ${Math.max(10, R * 0.55)}px Inter, sans-serif`;
  sites.forEach(([x, y, c, up], k) => {
    const q1 = stag(ph.O, k, sites.length), q2 = stag(ph.C, k, sites.length); if (q1 <= 0) return;
    const col = q2 > 0.5 ? [47, 107, 58] : [94, 140, 97];
    g.strokeStyle = rgba(col, q1 * a); g.lineWidth = 1.6; g.beginPath(); g.moveTo(c[0], c[1] + up * R); g.lineTo(x, y - up * R * 0.45); g.stroke();
    g.fillStyle = rgba(col, (q2 < 0.5 ? q1 * (1 - q2 * 2) : q2 * 2 - 1) * a); g.fillText(q2 < 0.5 ? 'O⁻' : 'COO⁻', x, y);
  });
  g.textAlign = 'start';
  // ácido cítrico
  CIT.forEach(([u, v, phs], k) => {
    let q = stag(ph.Cit, k, CIT.length); if (q <= 0) return;
    let x = lerp(x0, x1, u) + 26 * Math.sin(tw * 0.7 + phs), y = lerp(rows[0] - gap * 0.4, rows[2] + gap * 0.4, v) + 18 * Math.cos(tw * 0.9 + phs);
    if (k < BRIDGES.length) {
      const [i, j] = BRIDGES[k], p0 = hp(i, j), p1 = hp(i + 1, j), mm = ease(ph.Br * 1.3 - k * 0.04);
      if (mm >= 1) return; x = lerp(x, (p0[0] + p1[0]) / 2, mm); y = lerp(y, (p0[1] + p1[1]) / 2, mm);
    } else q *= 1 - ease(ph.Wash * 1.5);
    g.strokeStyle = rgba([176, 125, 40], q * a); g.fillStyle = g.strokeStyle; g.lineWidth = 2.5;
    for (let k2 = 0; k2 < 3; k2++) { const an = phs + k2 * 2.094 + tw * 0.4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 12 * Math.cos(an), y + 12 * Math.sin(an)); g.stroke(); }
    g.beginPath(); g.arc(x, y, 3.5, 0, 7); g.fill();
  });
  // lavado
  if (scene === 6 && t < 7) {
    const wq = Math.min(ease((t - 0.3) / 0.6), ease((7 - t) / 1)), r = mulberry(4);
    g.strokeStyle = rgba(C.gel, 0.35 * wq * a); g.lineWidth = 2;
    for (let k = 0; k < 46; k++) { const x = lerp(x0 - 20, x1 + 20, r()), sp = 300 + r() * 220, y = rows[0] - gap + ((t * sp + r() * 600) % (gap * 3.2)); g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 16); g.stroke(); }
  }
  // Pb²⁺
  sites.slice(0, 12).forEach(([x, y, c, up], k) => {
    const p = stag(ph.Pb, k, 12); if (p <= 0) return;
    const r = mulberry(100 + k), sx = r() > 0.5 ? w + 30 : x0 - 60, sy = h * (0.15 + r() * 0.7), e = ease(p);
    ion(lerp(sx, x, e), lerp(sy, y + up * R * 1.2, e), a, k < 2 && p < 1);
  });
}

/* ---------------- condiciones dinámicas ---------------- */
function updateCond(scene) {
  let v, s;
  if (scene === 4) { v = 'CMS 60 % (p/v)'; s = 'Ácido cítrico 10 % (p/p)'; }
  else if (scene === 5) { const hh = ph.Br; v = hh < 0.25 ? `60 °C · ${(hh / 0.25 * 2).toFixed(1).replace('.', ',')} h` : `50 °C · ${Math.round((hh - 0.25) / 0.75 * 48)} h`; s = 'Esterificación → puentes éster'; }
  else { v = 'Secado a 60 °C'; s = 'Lavado con agua destilada'; }
  $('#condV').textContent = v; $('#condS').textContent = s;
}
function updateSteps(scene) {
  $$('#pSteps li').forEach((li, k) => { li.classList.toggle('act', scene - 2 === k || (scene === 7 && k === 4)); li.classList.toggle('done', k < scene - 2); });
}

/* ---------------- punteros que cargan cada texto ---------------- */
const curLayer = $('#cursors');
const CCOL = ['#1f2b22', '#2f6b3a', '#5e8c61', '#b07d28'];
const cursorSVG = (c) => `<svg viewBox="0 0 22 30"><path d="M1 1v24l6.5-5.5L12 29l5-2-4.5-9.5H21z" fill="${c}" stroke="#fcfbf6" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
function edgePoint(r) { const s = Math.floor(r() * 4); return s === 0 ? [-40, 80 + r() * (h - 160)] : s === 1 ? [w + 40, 80 + r() * (h - 160)] : s === 2 ? [80 + r() * (w - 160), -40] : [80 + r() * (w - 160), h + 40]; }
const fmtNum = (v, d) => v.toFixed(d).replace('.', ',');
function countUp(el) {
  const vals = el.dataset.count.split(',').map(Number), d = +el.dataset.dec, fmt = el.dataset.fmt, t0 = performance.now(), dur = 1600 / SLOW;
  const tick = (now) => { const k = ease((now - t0) / dur); let i = 0; el.textContent = fmt.replace(/\{\}/g, () => fmtNum(vals[i++] * k, d)); if (k < 1 && el.isConnected) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}
let flyToken = 0;
function flyIn(panel, token) {
  const els = $$('.fly', panel);
  if (REDUCE) { els.forEach((e) => e.classList.add('shown')); return; }
  const r = mulberry(Math.floor(Math.random() * 1e6)), step = Math.max(70, Math.min(260, 3200 / els.length)) / SLOW;
  els.forEach((el, i) => {
    setTimeout(() => {
      if (token !== flyToken || !panel.classList.contains('on')) return;
      const b = el.getBoundingClientRect(); if (!b.width) { el.classList.add('shown'); return; }
      const [sx, sy] = edgePoint(r), tx = b.left, ty = b.top + Math.min(b.height / 2, 20);
      el.classList.add('shown'); if (el.dataset.count) countUp(el);
      el.animate([{ transform: `translate(${sx - tx}px,${sy - ty}px)` }, { transform: 'none' }], { duration: 850 / SLOW, easing: 'cubic-bezier(.2,.75,.25,1)' });
      const col = CCOL[Math.floor(r() * CCOL.length)];
      const c = document.createElement('div'); c.innerHTML = cursorSVG(col); const sv = c.firstChild; curLayer.appendChild(sv);
      const [ex, ey] = edgePoint(r);
      const an = sv.animate([{ transform: `translate(${sx - 6}px,${sy - 4}px)` }, { transform: `translate(${tx - 6}px,${ty - 4}px)` }], { duration: 850 / SLOW, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'forwards' });
      an.onfinish = () => {
        const ring = document.createElement('div'); ring.className = 'ring'; ring.style.left = (tx - 6) + 'px'; ring.style.top = (ty - 4) + 'px'; ring.style.borderColor = col; curLayer.appendChild(ring);
        ring.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(3.4)', opacity: 0 }], { duration: 420 / SLOW }).onfinish = () => ring.remove();
        sv.animate([{ transform: `translate(${tx - 6}px,${ty - 4}px)`, opacity: 1 }, { transform: `translate(${ex}px,${ey}px)`, opacity: 0 }], { duration: 650 / SLOW, delay: 120 / SLOW, easing: 'ease-in', fill: 'forwards' }).onfinish = () => sv.remove();
      };
    }, 350 / SLOW + i * step);
  });
}

/* ---------------- escenas ---------------- */
const panels = $$('#hud [data-s]');
let cur = -1, tScene = 0, autoT = 0, autoOn = true, fade = 1, prev = -1;
function go(i) {
  i = clamp(i, 0, NSCENES - 1); if (i === cur) return;
  prev = cur; cur = i; tScene = 0; fade = 0; flyToken++; autoT = 0;
  $('#count').textContent = `${i + 1} / ${NSCENES}`;
  updateSteps(i);
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
const io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) go(+e.target.dataset.scene); }, { rootMargin: '-45% 0px -45% 0px' });
$$('[data-scene]').forEach((s) => io.observe(s));

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
cv.addEventListener('click', () => { if (document.body.classList.contains('present')) go(cur + 1); });

/* ---------------- bucle ---------------- */
let last = performance.now(), animT = 0;
go(0);
function loop(now) {
  const raw = Math.min(1, (now - last) / 1000), dt = Math.min(0.05, raw) * SLOW; last = now; tScene += dt; animT += dt;
  fade = Math.min(1, fade + dt / 0.6);
  // fases de la receta: se acercan a su objetivo (también hacia atrás)
  const T = TARGETS[cur] || (cur > 7 ? null : {});
  if (T) for (const k in ph) { const tg = T[k] || 0, sp = (k === 'Br' ? 1 / 5.5 : 1 / 2.5) * (REDUCE ? 20 : 1); ph[k] = tg > ph[k] ? Math.min(tg, ph[k] + dt * sp) : Math.max(tg, ph[k] - dt * sp * 2); }
  g.clearRect(0, 0, w, h);
  const a = ease(fade);
  if (cur >= 1 && cur <= 7) { drawRecipe(tScene + (prev >= 1 && prev <= 7 ? 2 : 0), 1, cur, animT); if (cur >= 4 && cur <= 6) updateCond(cur); }
  else if (MATS[cur]) drawMaterial(MATS[cur], REDUCE ? 30 : tScene, a);
  const presenting = document.body.classList.contains('present');
  if (presenting && autoOn && cur < NSCENES - 1) { autoT += raw; if (autoT >= AUTO_SEC) go(cur + 1); }
  $('#autobar').style.transform = `scaleX(${presenting && autoOn && cur < NSCENES - 1 ? Math.min(autoT / AUTO_SEC, 1) : 0})`;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
