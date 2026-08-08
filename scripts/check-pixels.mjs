import fs from 'fs';
import zlib from 'zlib';

const buf = fs.readFileSync('src/assets/logo.png');

// Find IDAT chunks
let offset = 8;
const idatChunks = [];
let width = 0, height = 0;

while (offset < buf.length) {
  const len = buf.readUInt32BE(offset);
  const type = buf.toString('ascii', offset + 4, offset + 8);
  if (type === 'IHDR') {
    width = buf.readUInt32BE(offset + 8);
    height = buf.readUInt32BE(offset + 12);
  } else if (type === 'IDAT') {
    idatChunks.push(buf.slice(offset + 8, offset + 8 + len));
  }
  offset += 12 + len;
}

const compressed = Buffer.concat(idatChunks);
const decompressed = zlib.inflateSync(compressed);

console.log(`Decompressed IDAT size: ${decompressed.length} bytes (Expected approx ${(width * 4 + 1) * height})`);

// Sample corner pixel (0, 0)
// PNG scanlines have 1 filter byte at start of each line
const line0 = decompressed.slice(0, width * 4 + 1);
const r = line0[1], g = line0[2], b = line0[3], a = line0[4];
console.log(`Pixel (0,0) RGBA: r=${r}, g=${g}, b=${b}, a=${a}`);

// Check if any pixels have alpha == 0
let transparentPixels = 0;
let whiteOpaquePixels = 0;
for (let y = 0; y < height; y++) {
  const lineStart = y * (width * 4 + 1);
  const filter = decompressed[lineStart];
  for (let x = 0; x < width; x++) {
    const p = lineStart + 1 + x * 4;
    const pxA = decompressed[p + 3];
    const pxR = decompressed[p], pxG = decompressed[p + 1], pxB = decompressed[p + 2];
    if (pxA === 0) transparentPixels++;
    if (pxA === 255 && pxR > 240 && pxG > 240 && pxB > 240) whiteOpaquePixels++;
  }
}

console.log(`Total pixels: ${width * height}`);
console.log(`Transparent pixels (alpha=0): ${transparentPixels}`);
console.log(`White/near-white opaque pixels: ${whiteOpaquePixels}`);
