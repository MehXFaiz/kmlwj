import fs from 'fs';
import path from 'path';

const logoPath = path.resolve(process.cwd(), 'src/assets/logo.png');
console.log('Checking logo file at:', logoPath);

if (!fs.existsSync(logoPath)) {
  console.log('File does not exist!');
  process.exit(1);
}

const stats = fs.statSync(logoPath);
console.log('File size:', stats.size, 'bytes');

// Read PNG header bytes
const buf = fs.readFileSync(logoPath);
console.log('PNG Header Magic:', buf.slice(0, 8).toString('hex'));

// Check IHDR chunk
// Width: bytes 16-19, Height: bytes 20-23, Bit depth: byte 24, Color type: byte 25
const width = buf.readUInt32BE(16);
const height = buf.readUInt32BE(20);
const bitDepth = buf[24];
const colorType = buf[25];

console.log(`Dimensions: ${width}x${height}`);
console.log(`Bit Depth: ${bitDepth}`);
console.log(`Color Type: ${colorType} (${colorType === 6 ? 'RGBA (with alpha)' : colorType === 2 ? 'RGB (no alpha)' : colorType === 3 ? 'Indexed' : 'Other'})`);
