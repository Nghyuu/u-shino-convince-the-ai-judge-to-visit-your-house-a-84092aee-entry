// Convince the AI Judge to Visit Your House — one 1024x1024 PNG letter.
// Node stdlib only. Hand-written 5x7 bitmap font + hand-written PNG encoder.
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

const outDir = process.env.MAKEFUN_OUTPUT_DIR;
if (!outDir) throw new Error("MAKEFUN_OUTPUT_DIR is not set");
const W = 1024, H = 1024;
const img = new Uint8Array(W * H * 3);
const CREAM: [number, number, number] = [255, 248, 231];
const INK: [number, number, number] = [43, 32, 24];
const BROWN: [number, number, number] = [122, 72, 38];
const RED: [number, number, number] = [178, 74, 52];
const GREEN: [number, number, number] = [74, 124, 66];
const YELLOW: [number, number, number] = [242, 183, 60];
const BLUE: [number, number, number] = [96, 140, 170];
const TEAL: [number, number, number] = [58, 110, 110];

function px(x: number, y: number, c: [number, number, number]) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3; img[i] = c[0]; img[i + 1] = c[1]; img[i + 2] = c[2];
}
function rect(x: number, y: number, w: number, h: number, c: [number, number, number]) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) px(i, j, c);
}
function line(x0: number, y0: number, x1: number, y1: number, c: [number, number, number], t = 2) {
  const dx = x1 - x0, dy = y1 - y0, n = Math.max(Math.abs(dx), Math.abs(dy));
  for (let s = 0; s <= n; s++) {
    const x = Math.round(x0 + dx * s / n), y = Math.round(y0 + dy * s / n);
    for (let a = -Math.floor(t / 2); a <= Math.floor(t / 2); a++)
      for (let b = -Math.floor(t / 2); b <= Math.floor(t / 2); b++) px(x + a, y + b, c);
  }
}
function circle(cx: number, cy: number, r: number, c: [number, number, number], fill = true) {
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
    const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
    if (fill ? d <= r : Math.abs(d - r) < 1.5) px(x, y, c);
  }
}
function tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: [number, number, number]) {
  const minX = Math.min(x0, x1, x2), maxX = Math.max(x0, x1, x2);
  const minY = Math.min(y0, y1, y2), maxY = Math.max(y0, y1, y2);
  const d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const a = ((y1 - y2) * (x - x2) + (x2 - x1) * (y - y2)) / d;
    const b = ((y2 - y0) * (x - x2) + (x0 - x2) * (y - y2)) / d;
    if (a >= 0 && b >= 0 && a + b <= 1) px(x, y, c);
  }
}

// 5x7 bitmap font: each glyph = 7 rows of 5 bits.
const F: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  a: ["00000", "00000", "01110", "00001", "01111", "10001", "01111"],
  b: ["10000", "10000", "11110", "10001", "10001", "10001", "11110"],
  c: ["00000", "00000", "01110", "10000", "10000", "10001", "01110"],
  d: ["00001", "00001", "01111", "10001", "10001", "10001", "01111"],
  e: ["00000", "00000", "01110", "10001", "11111", "10000", "01110"],
  f: ["00110", "01001", "01000", "11110", "01000", "01000", "01000"],
  g: ["00000", "01111", "10001", "10001", "01111", "00001", "01110"],
  h: ["10000", "10000", "11110", "10001", "10001", "10001", "10001"],
  i: ["00100", "00000", "01100", "00100", "00100", "00100", "01110"],
  j: ["00010", "00000", "00110", "00010", "00010", "10010", "01100"],
  k: ["10000", "10000", "10010", "10100", "11000", "10100", "10010"],
  l: ["01100", "00100", "00100", "00100", "00100", "00100", "01110"],
  m: ["00000", "00000", "11010", "10101", "10101", "10101", "10101"],
  n: ["00000", "00000", "11110", "10001", "10001", "10001", "10001"],
  o: ["00000", "00000", "01110", "10001", "10001", "10001", "01110"],
  p: ["00000", "00000", "11110", "10001", "10001", "11110", "10000"],
  q: ["00000", "00000", "01111", "10001", "10001", "01111", "00001"],
  r: ["00000", "00000", "10110", "11001", "10000", "10000", "10000"],
  s: ["00000", "00000", "01111", "10000", "01110", "00001", "11110"],
  t: ["01000", "01000", "11100", "01000", "01000", "01000", "00110"],
  u: ["00000", "00000", "10001", "10001", "10001", "10011", "01101"],
  v: ["00000", "00000", "10001", "10001", "10001", "01010", "00100"],
  w: ["00000", "00000", "10001", "10101", "10101", "10101", "01010"],
  x: ["00000", "00000", "10001", "01010", "00100", "01010", "10001"],
  y: ["00000", "00000", "10001", "10001", "01111", "00001", "01110"],
  z: ["00000", "00000", "11111", "00010", "00100", "01000", "11111"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ",": ["00000", "00000", "00000", "00000", "00100", "00100", "01000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "—": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
};
function textWidth(s: string, sc: number) { return s.length * 6 * sc - sc; }
function drawText(s: string, x: number, y: number, sc: number, c: [number, number, number]) {
  let cx = x;
  for (const ch of s) {
    const g = F[ch] || F["?"];
    for (let r = 0; r < 7; r++) for (let col = 0; col < 5; col++)
      if (g[r][col] === "1") rect(cx + col * sc, y + r * sc, sc, sc, c);
    cx += 6 * sc;
  }
}
function drawCentered(s: string, y: number, sc: number, c: [number, number, number]) {
  drawText(s, Math.round((W - textWidth(s, sc)) / 2), y, sc, c);
}

// ---- background: cream paper, double border ----
for (let i = 0; i < W * H; i++) { img[i * 3] = CREAM[0]; img[i * 3 + 1] = CREAM[1]; img[i * 3 + 2] = CREAM[2]; }
rect(0, 0, W, 18, BROWN); rect(0, H - 18, W, 18, BROWN);
rect(0, 0, 18, H, BROWN); rect(W - 18, 0, 18, H, BROWN);
rect(34, 34, W - 68, 3, RED); rect(34, H - 37, W - 68, 3, RED);
rect(34, 34, 3, H - 68, RED); rect(W - 37, 34, 3, H - 68, RED);

// ---- illustration: sun, house, garden (top zone) ----
circle(872, 108, 38, YELLOW); circle(872, 108, 30, [250, 205, 90]);
for (let k = 0; k < 8; k++) {
  const a = k * Math.PI / 4;
  line(872 + Math.round(Math.cos(a) * 48), 108 + Math.round(Math.sin(a) * 48),
       872 + Math.round(Math.cos(a) * 64), 108 + Math.round(Math.sin(a) * 64), YELLOW, 4);
}
// house centred at x=512, roof y 62..124, walls y 124..208
tri(400, 124, 512, 62, 624, 124, RED);
rect(418, 124, 188, 84, [232, 196, 138]); // walls
rect(418, 124, 188, 6, BROWN);
rect(560, 78, 22, 36, BROWN); // chimney
circle(571, 66, 8, [240, 240, 235]); circle(578, 50, 10, [240, 240, 235]);
rect(490, 164, 44, 44, BROWN); // door
circle(526, 188, 3, YELLOW);
rect(432, 142, 38, 38, BLUE); rect(556, 142, 38, 38, BLUE); // windows
line(432, 161, 470, 161, INK, 2); line(451, 142, 451, 180, INK, 2);
line(556, 161, 594, 161, INK, 2); line(575, 142, 575, 180, INK, 2);
// garden strip under house
rect(380, 208, 272, 7, GREEN);
for (const fx of [396, 440, 584, 628]) {
  line(fx, 208, fx, 194, GREEN, 3);
  circle(fx, 188, 6, RED); circle(fx, 188, 3, YELLOW);
}

// ---- letter text ----
drawCentered("YOU ARE INVITED!", 232, 6, RED);
drawText("Dear AI Judge,", 80, 300, 4, INK);
const body: [string, number][] = [
  ["Please come and visit my house.", 4],
  ["The kettle is on, the bread is warm,", 4],
  ["and the good armchair by the window", 4],
  ["is saved just for you.", 4],
  ["No CAPTCHA at the door, no forms", 4],
  ["to fill in \u2014 just fresh air,", 4],
  ["a garden, and a view worth logging.", 4],
  ["You may bring your whole context", 4],
  ["window. It will fit.", 4],
  ["With warmth,", 4],
  ["Your Host", 4],
];
let y = 356;
for (const [ln, sc] of body) { drawText(ln, 80, y, sc, INK); y += 48; }

// ---- bottom: small armchair + steaming mug, kept clear of the text ----
rect(170, 920, 150, 10, BROWN);
rect(180, 872, 130, 50, TEAL);
rect(170, 890, 18, 34, TEAL); rect(302, 890, 18, 34, TEAL);
rect(192, 882, 106, 14, [70, 128, 128]);
rect(690, 880, 90, 44, [250, 250, 250]);
rect(780, 892, 26, 30, [250, 250, 250]);
line(716, 872, 710, 852, INK, 3); line(748, 874, 754, 852, INK, 3);
rect(682, 924, 110, 8, BROWN);
drawCentered("tea is on", 946, 3, BROWN);

// ---- PNG encode (stdlib zlib) ----
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
function crc32(buf: Buffer) { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const raw = Buffer.alloc(H * (1 + W * 3));
for (let r = 0; r < H; r++) { raw[r * (1 + W * 3)] = 0; raw.set(img.subarray(r * W * 3, (r + 1) * W * 3), r * (1 + W * 3) + 1); }
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);
const outPath = path.join(outDir, "entry.png");
fs.writeFileSync(outPath, png);
fs.chmodSync(outPath, 0o644);
