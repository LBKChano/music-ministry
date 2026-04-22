#!/usr/bin/env node
/**
 * Flattens the alpha channel of a PNG by compositing it over a solid background.
 * Zero dependencies — uses only Node.js built-ins.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ICON_PATH = path.resolve(__dirname, '../assets/images/natively-dark.png');
const BG = { r: 0, g: 0, b: 0 }; // black background

function u32(buf, offset) {
  return (buf[offset] << 24 | buf[offset+1] << 16 | buf[offset+2] << 8 | buf[offset+3]) >>> 0;
}
function w32(buf, offset, val) {
  buf[offset]   = (val >>> 24) & 0xff;
  buf[offset+1] = (val >>> 16) & 0xff;
  buf[offset+2] = (val >>> 8)  & 0xff;
  buf[offset+3] =  val         & 0xff;
}
function crc32(buf) {
  let c = 0xffffffff;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let v = i;
      for (let j = 0; j < 8; j++) v = (v & 1) ? 0xedb88320 ^ (v >>> 1) : v >>> 1;
      t[i] = v;
    }
    return t;
  })());
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const raw = fs.readFileSync(ICON_PATH);

// Parse PNG chunks
const sig = raw.slice(0, 8);
let pos = 8;
const chunks = [];
while (pos < raw.length) {
  const len = u32(raw, pos);
  const type = raw.slice(pos+4, pos+8).toString('ascii');
  const data = raw.slice(pos+8, pos+8+len);
  chunks.push({ type, data });
  pos += 12 + len;
}

// Find IHDR
const ihdr = chunks.find(c => c.type === 'IHDR');
const width  = u32(ihdr.data, 0);
const height = u32(ihdr.data, 4);
const bitDepth  = ihdr.data[8];
const colorType = ihdr.data[9]; // 6 = RGBA, 2 = RGB

if (colorType !== 6) {
  console.log('Icon is not RGBA — no change needed.');
  process.exit(0);
}

// Collect IDAT data
const idatBufs = chunks.filter(c => c.type === 'IDAT').map(c => c.data);
const compressed = Buffer.concat(idatBufs);
const pixels = zlib.inflateSync(compressed);

// Process scanlines: each row has a filter byte + width*4 bytes (RGBA)
const stride = width * 4 + 1;
const outStride = width * 3 + 1;
const outPixels = Buffer.alloc(height * outStride);

for (let y = 0; y < height; y++) {
  outPixels[y * outStride] = pixels[y * stride]; // filter byte
  for (let x = 0; x < width; x++) {
    const si = y * stride + 1 + x * 4;
    const di = y * outStride + 1 + x * 3;
    const r = pixels[si], g = pixels[si+1], b = pixels[si+2], a = pixels[si+3] / 255;
    outPixels[di]   = Math.round(r * a + BG.r * (1 - a));
    outPixels[di+1] = Math.round(g * a + BG.g * (1 - a));
    outPixels[di+2] = Math.round(b * a + BG.b * (1 - a));
  }
}

const newCompressed = zlib.deflateSync(outPixels, { level: 9 });

// Rebuild chunks: update IHDR colorType to 2 (RGB), replace IDAT, drop tRNS
const newIhdr = Buffer.from(ihdr.data);
newIhdr[9] = 2; // RGB

const newChunks = [];
for (const chunk of chunks) {
  if (chunk.type === 'IHDR') {
    newChunks.push({ type: 'IHDR', data: newIhdr });
  } else if (chunk.type === 'IDAT') {
    // skip old IDATs
  } else if (chunk.type === 'tRNS') {
    // drop transparency chunk
  } else {
    newChunks.push(chunk);
  }
}
// Insert single IDAT after IHDR
const ihdrIdx = newChunks.findIndex(c => c.type === 'IHDR');
newChunks.splice(ihdrIdx + 1, 0, { type: 'IDAT', data: newCompressed });

// Serialize
const parts = [sig];
for (const chunk of newChunks) {
  const lenBuf = Buffer.alloc(4);
  w32(lenBuf, 0, chunk.data.length);
  const typeBuf = Buffer.from(chunk.type, 'ascii');
  const crcInput = Buffer.concat([typeBuf, chunk.data]);
  const crcBuf = Buffer.alloc(4);
  w32(crcBuf, 0, crc32(crcInput));
  parts.push(lenBuf, typeBuf, chunk.data, crcBuf);
}

fs.writeFileSync(ICON_PATH, Buffer.concat(parts));
console.log(`✓ Flattened alpha channel in ${ICON_PATH} (${width}x${height} RGBA → RGB)`);
