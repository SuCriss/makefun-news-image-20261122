// make.fun news-image-20261122 authored PNG encoder.
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';

const W = 1024;
const H = 1024;
const px = new Uint8Array(W * H * 3);

const C = {
  bg: [11, 15, 21],
  panel: [19, 25, 33],
  panel2: [24, 32, 42],
  line: [45, 56, 68],
  grid: [26, 34, 44],
  text: [232, 238, 245],
  sub: [150, 164, 178],
  muted: [95, 108, 122],
  gold: [214, 166, 86],
  red: [214, 88, 84],
  orange: [222, 140, 72],
  blue: [94, 145, 217],
  teal: [78, 178, 184],
  green: [96, 182, 126],
  land: [42, 78, 86],
  landEdge: [58, 104, 112]
};

function put(x, y, r, g, b) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = r; px[i + 1] = g; px[i + 2] = b;
}

function rect(x, y, w, h, c) {
  const x0 = Math.max(0, Math.round(x));
  const y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(W, Math.round(x + w));
  const y1 = Math.min(H, Math.round(y + h));
  for (let yy = y0; yy < y1; yy++) {
    const base = yy * W * 3;
    for (let xx = x0; xx < x1; xx++) {
      const i = base + xx * 3;
      px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
    }
  }
}

function frame(x, y, w, h, c, t) {
  const q = t || 1;
  rect(x, y, w, q, c);
  rect(x, y + h - q, w, q, c);
  rect(x, y, q, h, c);
  rect(x + w - q, y, q, h, c);
}

function line(x0, y0, x1, y1, c, t) {
  const q = t || 1;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  if (steps === 0) {
    rect(Math.round(x0 - q / 2), Math.round(y0 - q / 2), q, q, c);
    return;
  }
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x0 + dx * i / steps);
    const y = Math.round(y0 + dy * i / steps);
    rect(Math.round(x - q / 2), Math.round(y - q / 2), q, q, c);
  }
}

function circle(cx, cy, r, c, filled) {
  const r2 = r * r;
  const outer = (r + 0.6) * (r + 0.6);
  const inner = (r - 0.7) * (r - 0.7);
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) {
    for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
      const d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (filled ? d <= r2 : (d <= outer && d >= inner)) {
        put(x, y, c[0], c[1], c[2]);
      }
    }
  }
}

const FONT = {
  'A': [14,17,17,31,17,17,17],
  'B': [30,17,17,30,17,17,30],
  'C': [14,17,16,16,16,17,14],
  'D': [30,17,17,17,17,17,30],
  'E': [31,16,16,30,16,16,31],
  'F': [31,16,16,30,16,16,16],
  'G': [14,17,16,23,17,17,14],
  'H': [17,17,17,31,17,17,17],
  'I': [31,4,4,4,4,4,31],
  'J': [7,2,2,2,2,18,12],
  'K': [17,18,20,24,20,18,17],
  'L': [16,16,16,16,16,16,31],
  'M': [17,27,21,21,17,17,17],
  'N': [17,25,21,19,17,17,17],
  'O': [14,17,17,17,17,17,14],
  'P': [30,17,17,30,16,16,16],
  'Q': [14,17,17,17,21,18,13],
  'R': [30,17,17,30,20,18,17],
  'S': [15,16,16,14,1,1,30],
  'T': [31,4,4,4,4,4,4],
  'U': [17,17,17,17,17,17,14],
  'V': [17,17,17,17,17,10,4],
  'W': [17,17,17,21,21,27,17],
  'X': [17,17,10,4,10,17,17],
  'Y': [17,17,10,4,4,4,4],
  'Z': [31,1,2,4,8,16,31],
  '0': [14,17,19,21,25,17,14],
  '1': [4,12,4,4,4,4,14],
  '2': [14,17,1,2,4,8,31],
  '3': [30,1,1,14,1,1,30],
  '4': [2,6,10,18,31,2,2],
  '5': [31,16,16,30,1,1,30],
  '6': [14,16,16,30,17,17,14],
  '7': [31,1,2,4,8,8,8],
  '8': [14,17,17,14,17,17,14],
  '9': [14,17,17,15,1,1,14],
  ' ': [0,0,0,0,0,0,0],
  '.': [0,0,0,0,0,12,12],
  '-': [0,0,0,31,0,0,0],
  ',': [0,0,0,0,12,12,8],
  ':': [0,12,12,0,12,12,0],
  '/': [1,1,2,4,8,16,16],
  '!': [4,4,4,4,4,0,4]
};

function textWidth(str, s, sp) {
  const scale = s || 1;
  const gap = sp === undefined ? 1 : sp;
  if (str.length === 0) return 0;
  return str.length * (5 + gap) * scale - gap * scale;
}

function text(x, y, str, c, s, sp) {
  const scale = s || 1;
  const gap = sp === undefined ? 1 : sp;
  for (let i = 0; i < str.length; i++) {
    const g = FONT[str[i]] || FONT[' '];
    const gx = x + i * (5 + gap) * scale;
    for (let r = 0; r < 7; r++) {
      const row = g[r];
      for (let col = 0; col < 5; col++) {
        if (row & (1 << (4 - col))) {
          rect(gx + col * scale, y + r * scale, scale, scale, c);
        }
      }
    }
  }
}

function polygon(points, ox, oy, sx, sy, c) {
  const ys = points.map(function (p) { return oy + p[1] * sy; });
  const minY = Math.floor(Math.min.apply(null, ys));
  const maxY = Math.ceil(Math.max.apply(null, ys));
  for (let y = minY; y <= maxY; y++) {
    const sample = y + 0.5;
    const xs = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      const ay = oy + a[1] * sy;
      const by = oy + b[1] * sy;
      if ((ay <= sample && by > sample) || (by <= sample && ay > sample)) {
        const t = (sample - ay) / (by - ay);
        xs.push(ox + a[0] * sx + t * ((ox + b[0] * sx) - (ox + a[0] * sx)));
      }
    }
    xs.sort(function (p, q) { return p - q; });
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const x0 = Math.round(xs[k]);
      const x1 = Math.round(xs[k + 1]);
      if (x1 > x0) rect(x0, y, x1 - x0, 1, c);
    }
  }
}

const CONTINENTS = [
  [[80,55],[140,45],[200,50],[250,45],[290,60],[305,85],[288,112],[262,120],[248,150],[232,165],[214,190],[200,205],[188,188],[180,162],[160,148],[142,128],[118,112],[98,92],[84,72]],
  [[300,20],[344,16],[360,38],[344,66],[318,72],[298,50]],
  [[232,222],[268,218],[294,232],[300,262],[290,298],[280,336],[264,372],[250,402],[240,396],[234,360],[224,324],[218,288],[224,252]],
  [[452,92],[498,86],[528,96],[540,116],[524,138],[504,142],[490,158],[474,152],[462,132],[448,116]],
  [[468,172],[520,168],[556,184],[566,214],[556,250],[540,286],[520,322],[500,340],[486,330],[478,294],[464,258],[458,224],[464,194]],
  [[540,76],[600,58],[680,52],[760,58],[830,68],[892,84],[922,110],[900,136],[860,150],[820,162],[790,182],[760,202],[730,210],[700,196],[670,186],[640,166],[610,150],[585,130],[560,112],[544,96]],
  [[700,196],[722,212],[716,238],[694,224]],
  [[790,208],[822,214],[832,236],[804,242],[788,226]],
  [[830,298],[880,294],[910,310],[905,346],[875,360],[840,350],[824,324]],
  [[920,150],[932,160],[926,178],[914,168]],
  [[452,100],[460,98],[462,116],[452,118]]
];

function icon(kind, cx, cy, c) {
  if (kind === 'summit') {
    circle(cx - 13, cy + 2, 5, c, true);
    circle(cx, cy - 4, 6, c, true);
    circle(cx + 13, cy + 2, 5, c, true);
    rect(cx - 20, cy + 10, 14, 5, c);
    rect(cx - 8, cy + 4, 16, 5, c);
    rect(cx + 7, cy + 10, 14, 5, c);
  } else if (kind === 'deal') {
    frame(cx - 13, cy - 16, 26, 32, c, 2);
    for (let i = 0; i < 4; i++) rect(cx - 8, cy - 9 + i * 7, 16, 2, c);
    rect(cx - 4, cy + 15, 8, 3, c);
  } else if (kind === 'quake') {
    line(cx - 18, cy + 2, cx - 8, cy + 2, c, 2);
    line(cx - 8, cy + 2, cx - 3, cy - 12, c, 2);
    line(cx - 3, cy - 12, cx + 3, cy + 12, c, 2);
    line(cx + 3, cy + 12, cx + 8, cy - 8, c, 2);
    line(cx + 8, cy - 8, cx + 18, cy - 8, c, 2);
  } else if (kind === 'storm') {
    circle(cx - 9, cy - 6, 8, c, true);
    circle(cx + 1, cy - 11, 10, c, true);
    circle(cx + 12, cy - 5, 7, c, true);
    rect(cx - 17, cy - 3, 30, 5, c);
    for (let i = 0; i < 3; i++) line(cx - 10 + i * 10, cy + 4, cx - 13 + i * 10, cy + 12, c, 2);
  } else if (kind === 'protest') {
    for (let i = 0; i < 4; i++) {
      const x = cx - 16 + i * 11;
      circle(x, cy - 8, 3, c, true);
      rect(x - 3, cy - 3, 6, 10, c);
      rect(x - 6, cy - 17, 12, 5, c);
    }
  } else if (kind === 'bridge') {
    line(cx - 20, cy + 8, cx + 20, cy + 8, c, 2);
    for (let i = 0; i <= 20; i++) {
      const x = cx - 20 + i * 2;
      const y = cy + 8 - Math.round(14 * Math.sin(Math.PI * i / 20));
      put(x, y, c[0], c[1], c[2]);
    }
    rect(cx - 14, cy + 8, 3, 10, c);
    rect(cx + 11, cy + 8, 3, 10, c);
  } else if (kind === 'chart') {
    const hs = [8, 14, 20, 26];
    for (let i = 0; i < 4; i++) rect(cx - 16 + i * 9, cy + 14 - hs[i], 6, hs[i], c);
    line(cx - 18, cy + 14, cx + 20, cy + 14, c, 2);
    line(cx - 14, cy - 16, cx - 6, cy - 8, c, 2);
    line(cx - 6, cy - 8, cx + 2, cy - 16, c, 2);
    line(cx - 6, cy - 8, cx + 2, cy - 8, c, 2);
  }
}

function pill(x, y, label, c) {
  const w = textWidth(label, 1, 1) + 16;
  rect(x, y, w, 20, C.panel2);
  frame(x, y, w, 20, c, 1);
  rect(x, y, 3, 20, c);
  text(x + 10, y + 7, label, C.text, 1, 1);
  return w;
}

rect(0, 0, W, H, C.bg);

rect(28, 28, 968, 72, C.panel);
rect(28, 28, 968, 3, C.gold);
frame(28, 28, 968, 72, C.line, 1);
rect(40, 42, 12, 12, C.gold);
rect(43, 45, 6, 6, C.bg);
text(62, 40, 'MAKEFUN WORLD NEWS', C.text, 2, 1);
text(62, 64, 'GLOBAL AFFAIRS / DAILY EDITION 2026', C.muted, 1, 1);
text(566, 44, 'SUNDAY 22 NOVEMBER 2026', C.gold, 3, 1);
rect(28, 104, 968, 2, C.line);

rect(28, 112, 968, 196, C.panel);
frame(28, 112, 968, 196, C.line, 1);
text(40, 122, 'WORLD AT A GLANCE', C.gold, 1, 1);
text(824, 122, 'ACTIVE STORIES 08', C.sub, 1, 1);

const mx = 60, my = 136, msx = 904 / 1000, msy = 148 / 500;
for (let gx = 60; gx <= 964; gx += 48) rect(gx, my, 1, 148, C.grid);
for (let gy = my; gy <= my + 148; gy += 37) rect(mx, gy, 904, 1, C.grid);
for (let i = 0; i < CONTINENTS.length; i++) {
  polygon(CONTINENTS[i], mx, my, msx, msy, C.land);
}
for (let i = 0; i < CONTINENTS.length; i++) {
  const pts = CONTINENTS[i];
  for (let k = 0; k < pts.length; k++) {
    const a = pts[k];
    const b = pts[(k + 1) % pts.length];
    line(mx + a[0] * msx, my + a[1] * msy, mx + b[0] * msx, my + b[1] * msy, C.landEdge, 1);
  }
}

const markers = [
  [748, 148, C.gold],
  [612, 156, C.red],
  [800, 244, C.orange],
  [226, 292, C.orange],
  [272, 306, C.blue],
  [498, 120, C.teal],
  [548, 108, C.red],
  [938, 260, C.green]
];
for (let i = 0; i < markers.length; i++) {
  const m = markers[i];
  const x = mx + m[0] * msx;
  const y = my + m[1] * msy;
  circle(x, y, 7, m[2], false);
  circle(x, y, 3, m[2], true);
}

const regionLabels = [
  [120, 246, 'AMERICAS', C.sub],
  [452, 166, 'EUROPE', C.sub],
  [470, 288, 'AFRICA', C.sub],
  [556, 206, 'MIDDLE EAST', C.sub],
  [764, 178, 'ASIA', C.sub],
  [848, 282, 'PACIFIC', C.sub]
];
for (let i = 0; i < regionLabels.length; i++) {
  const r = regionLabels[i];
  rect(r[0], r[1] + 2, 4, 4, r[3]);
  text(r[0] + 9, r[1] - 1, r[2], r[3], 1, 1);
}

const cards = [
  ['TRUMP XI PUTIN', 'HISTORIC TRILATERAL SUMMIT AFTER APEC SHENZHEN', C.gold, 'summit'],
  ['IRAN DEAL', 'TRUMP SEEKS PERMANENT AGREEMENT AS IRAN WARNS OF RETALIATION', C.red, 'deal'],
  ['INDONESIA QUAKE', '7.2 NEAR MALUKU', C.orange, 'quake'],
  ['PERU QUAKE', '6.7 NEAR CALVARAYO', C.orange, 'quake'],
  ['BRAZIL STORM', 'AT LEAST 3 DEAD IN RIO GRANDE DO SUL', C.blue, 'storm'],
  ['EUROPE YOUTH', 'PROTESTS OVER COSTS AND CLIMATE', C.teal, 'protest'],
  ['UKRAINE BRIDGES', 'RUSSIAN STRIKES ON KYIV CROSSINGS', C.red, 'bridge'],
  ['GTA VI GLOBAL', 'RECORD 3.79B FIRST-DAY RETAIL', C.green, 'chart']
];

for (let i = 0; i < cards.length; i++) {
  const col = i % 2;
  const row = Math.floor(i / 2);
  const x = 28 + col * 492;
  const y = 320 + row * 142;
  const w = 476;
  const h = 130;
  const item = cards[i];
  const accent = item[2];
  rect(x, y, w, h, C.panel);
  frame(x, y, w, h, C.line, 1);
  rect(x, y, 5, h, accent);
  rect(x + 12, y + 14, 58, 58, C.panel2);
  frame(x + 12, y + 14, 58, 58, C.line, 1);
  icon(item[3], x + 41, y + 43, accent);
  text(x + 84, y + 18, item[0], accent, 2, 1);
  text(x + 84, y + 46, item[1], C.sub, 1, 1);
  const idx = String(i + 1);
  const idxLabel = idx.length === 1 ? '0' + idx : idx;
  text(x + w - 30, y + 18, idxLabel, C.muted, 1, 1);
  line(x + 84, y + 64, x + w - 16, y + 64, C.grid, 1);
  rect(x + 84, y + 82, 120, 4, C.line);
  rect(x + 84, y + 82, Math.round(120 * (0.35 + (i % 5) * 0.14)), 4, accent);
  text(x + 84, y + 98, 'BRIEFING ' + idxLabel, C.muted, 1, 1);
  for (let d = 0; d < 3; d++) {
    circle(x + w - 34 - d * 12, y + 100, 3, d === 0 ? accent : C.line, true);
  }
}

rect(28, 888, 968, 96, C.panel);
frame(28, 888, 968, 96, C.line, 1);
text(42, 898, '24H SIGNAL INDEX', C.gold, 1, 1);
const bars = [30, 50, 42, 64, 38, 56, 46, 72];
const barColors = [C.gold, C.red, C.orange, C.orange, C.blue, C.teal, C.red, C.green];
for (let i = 0; i < bars.length; i++) {
  const bx = 44 + i * 56;
  rect(bx, 968 - bars[i], 36, bars[i], C.panel2);
  rect(bx, 968 - bars[i], 36, 4, barColors[i]);
  const lab = String(i + 1);
  text(bx + 10, 974, lab.length === 1 ? '0' + lab : lab, C.muted, 1, 1);
}
line(44, 968, 500, 968, C.line, 1);

text(532, 898, 'REGIONS', C.gold, 1, 1);
let px1 = 532;
px1 += pill(px1, 912, 'ASIA', C.gold) + 10;
px1 += pill(px1, 912, 'EUROPE', C.teal) + 10;
px1 += pill(px1, 912, 'MIDDLE EAST', C.red) + 10;
let px2 = 532;
px2 += pill(px2, 940, 'AMERICAS', C.orange) + 10;
px2 += pill(px2, 940, 'PACIFIC', C.blue) + 10;
px2 += pill(px2, 940, 'AFRICA', C.green) + 10;

text(28, 996, 'MAKEFUN NEWS // VISUAL SUMMARY // SUNDAY 22 NOVEMBER 2026 // FIGURES AS SUPPLIED', C.muted, 1, 1);
text(872, 996, '01 / 01', C.gold, 1, 1);

const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c >>> 0;
}

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(typeName, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(typeName, 'ascii');
  const body = Buffer.concat([t, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crcBuf]);
}

const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;
ihdr[9] = 2;
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const raw = Buffer.alloc(H * (1 + W * 3));
let rp = 0;
for (let y = 0; y < H; y++) {
  raw[rp++] = 0;
  const base = y * W * 3;
  for (let x = 0; x < W; x++) {
    const i = base + x * 3;
    raw[rp++] = px[i];
    raw[rp++] = px[i + 1];
    raw[rp++] = px[i + 2];
  }
}
const idat = zlib.deflateSync(raw, { level: 9 });
const png = Buffer.concat([
  signature,
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0))
]);

const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'entry.png'), png);
