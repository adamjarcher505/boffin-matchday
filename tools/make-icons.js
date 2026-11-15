// Draws the app icons (amber LED dot-matrix "X" (1X2) on graphite) as PNGs. No dependencies.
// Run from the project root:  node tools/make-icons.js
const fs = require("fs"), zlib = require("zlib"), path = require("path");

const GLYPH = [   // 5x7 LED font
  "1...1",
  "1...1",
  ".1.1.",
  "..1..",
  ".1.1.",
  "1...1",
  "1...1"
];
const BG = [15, 17, 19], PANEL = [23, 26, 29], AMBER = [240, 181, 65], DIM = [44, 40, 32];

function draw(size, maskable) {
  const px = Buffer.alloc(size * size * 4);
  const set = (x, y, c, a = 255) => { const i = (y * size + x) * 4; px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = a; };
  // background: full bleed for maskable, rounded panel otherwise
  const r = maskable ? 0 : size * 0.18;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = Math.max(r - x, 0, x - (size - 1 - r)), dy = Math.max(r - y, 0, y - (size - 1 - r));
    const inside = dx * dx + dy * dy <= r * r;
    set(x, y, inside ? PANEL : BG, inside ? 255 : 0);
  }
  // LED grid: 5 cols x 7 rows, centred; maskable keeps it inside the 80% safe zone
  const area = size * (maskable ? 0.52 : 0.62), pitch = area / 7, dot = pitch * 0.38;
  const ox = (size - pitch * 5) / 2 + pitch / 2, oy = (size - pitch * 7) / 2 + pitch / 2;
  for (let gy = 0; gy < 7; gy++) for (let gx = 0; gx < 5; gx++) {
    const on = GLYPH[gy][gx] === "1", cx = ox + gx * pitch, cy = oy + gy * pitch, rr = on ? dot : dot * 0.8;
    for (let y = Math.floor(cy - pitch); y <= cy + pitch; y++) for (let x = Math.floor(cx - pitch); x <= cx + pitch; x++) {
      if (x < 0 || y < 0 || x >= size || y >= size) continue;
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d <= rr) set(x, y, on ? AMBER : DIM);
      else if (on && d <= rr * 1.9) {           // soft glow
        const i = (y * size + x) * 4, k = 0.28 * (1 - (d - rr) / (rr * 0.9));
        for (let c = 0; c < 3; c++) px[i + c] = Math.round(px[i + c] * (1 - k) + AMBER[c] * k);
      }
    }
  }
  return png(size, px);
}

function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); }
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const out = path.join(__dirname, "..", "icons"); fs.mkdirSync(out, { recursive: true });
[["icon-192.png", 192, false], ["icon-512.png", 512, false], ["maskable-512.png", 512, true], ["apple-touch-icon.png", 180, true], ["favicon-32.png", 32, false]]
  .forEach(([f, s, m]) => { fs.writeFileSync(path.join(out, f), draw(s, m)); console.log("wrote icons/" + f); });
