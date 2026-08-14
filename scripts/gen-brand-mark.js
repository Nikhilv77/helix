/*
 * Turns public/brand/trailgrad-icon.png into a PDF-ready image stream.
 *
 * The PDF writer runs in the browser and emits a plain ASCII string, so the
 * pixels are deflated and hex encoded here, once, and checked in as a module.
 * Alpha is flattened onto the report background because PDF image XObjects
 * cannot carry an alpha channel without a separate soft mask.
 */
const fs = require("fs");
const zlib = require("zlib");

const SRC = "public/brand/trailgrad-icon.png";
const OUT = "src/lib/report-brand-mark.ts";
const TARGET = 96;
const BG = [54, 87, 180]; // #3657b4

function readChunks(buffer) {
  if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error("not a png");
  const chunks = [];
  let offset = 8;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    chunks.push({ type, data: buffer.subarray(offset + 8, offset + 8 + length) });
    offset += 12 + length;
  }
  return chunks;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

function unfilter(raw, width, height, channels, bitDepth) {
  const stride = Math.ceil((width * channels * bitDepth) / 8);
  const bpp = Math.max(1, Math.ceil((channels * bitDepth) / 8));
  const out = Buffer.alloc(stride * height);
  let pos = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[pos];
    pos += 1;
    const line = raw.subarray(pos, pos + stride);
    pos += stride;
    const target = out.subarray(y * stride, (y + 1) * stride);
    const prior = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;

    for (let x = 0; x < stride; x += 1) {
      const rawByte = line[x];
      const left = x >= bpp ? target[x - bpp] : 0;
      const up = prior ? prior[x] : 0;
      const upLeft = prior && x >= bpp ? prior[x - bpp] : 0;
      let value;
      switch (filter) {
        case 0: value = rawByte; break;
        case 1: value = rawByte + left; break;
        case 2: value = rawByte + up; break;
        case 3: value = rawByte + ((left + up) >> 1); break;
        case 4: value = rawByte + paeth(left, up, upLeft); break;
        default: throw new Error(`unsupported filter ${filter}`);
      }
      target[x] = value & 0xff;
    }
  }
  return out;
}

const png = fs.readFileSync(SRC);
const chunks = readChunks(png);
const ihdr = chunks.find((chunk) => chunk.type === "IHDR").data;
const width = ihdr.readUInt32BE(0);
const height = ihdr.readUInt32BE(4);
const bitDepth = ihdr[8];
const colorType = ihdr[9];
const interlace = ihdr[12];
if (interlace !== 0) throw new Error("interlaced png unsupported");

const channelsByType = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
const channels = channelsByType[colorType];
if (!channels) throw new Error(`color type ${colorType} unsupported`);
if (colorType !== 3 && bitDepth !== 8) throw new Error(`bit depth ${bitDepth} unsupported`);

const palette = chunks.find((chunk) => chunk.type === "PLTE")?.data ?? null;
const transparency = chunks.find((chunk) => chunk.type === "tRNS")?.data ?? null;
if (colorType === 3 && !palette) throw new Error("palette png without PLTE");

const idat = Buffer.concat(chunks.filter((chunk) => chunk.type === "IDAT").map((chunk) => chunk.data));
const pixels = unfilter(zlib.inflateSync(idat), width, height, channels, bitDepth);
const stride = Math.ceil((width * channels * bitDepth) / 8);

/** Returns [r, g, b, a] for a source pixel, whatever the png encoding is. */
function sample(x, y) {
  if (colorType === 3) {
    const bitPos = x * bitDepth;
    const byte = pixels[y * stride + (bitPos >> 3)];
    const shift = 8 - bitDepth - (bitPos & 7);
    const index = (byte >> shift) & ((1 << bitDepth) - 1);
    return [
      palette[index * 3],
      palette[index * 3 + 1],
      palette[index * 3 + 2],
      transparency && index < transparency.length ? transparency[index] : 255
    ];
  }
  const index = y * stride + x * channels;
  if (colorType === 6) return [pixels[index], pixels[index + 1], pixels[index + 2], pixels[index + 3]];
  if (colorType === 2) return [pixels[index], pixels[index + 1], pixels[index + 2], 255];
  if (colorType === 4) return [pixels[index], pixels[index], pixels[index], pixels[index + 1]];
  return [pixels[index], pixels[index], pixels[index], 255];
}

// Box-filter down to TARGET square, compositing alpha over the report blue.
const out = Buffer.alloc(TARGET * TARGET * 3);
for (let ty = 0; ty < TARGET; ty += 1) {
  for (let tx = 0; tx < TARGET; tx += 1) {
    const x0 = Math.floor((tx * width) / TARGET);
    const x1 = Math.max(x0 + 1, Math.floor(((tx + 1) * width) / TARGET));
    const y0 = Math.floor((ty * height) / TARGET);
    const y1 = Math.max(y0 + 1, Math.floor(((ty + 1) * height) / TARGET));

    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const [sr, sg, sb, alpha] = sample(x, y);
        const a = alpha / 255;
        r += sr * a + BG[0] * (1 - a);
        g += sg * a + BG[1] * (1 - a);
        b += sb * a + BG[2] * (1 - a);
        count += 1;
      }
    }
    const target = (ty * TARGET + tx) * 3;
    out[target] = Math.round(r / count);
    out[target + 1] = Math.round(g / count);
    out[target + 2] = Math.round(b / count);
  }
}

const hex = zlib.deflateSync(out, { level: 9 }).toString("hex");
const wrapped = hex.replace(/(.{96})/g, "$1\n").trim();

fs.writeFileSync(
  OUT,
  `/**
 * The Trailgrad mark from public/brand/trailgrad-icon.png, prepared for the
 * report PDF: downscaled to ${TARGET}px, its transparency flattened onto the
 * report background, then deflated and hex encoded so the generated file stays
 * pure ASCII and can be written from the browser.
 *
 * Regenerate with scripts/gen-brand-mark.js if the source icon changes.
 */
export const brandMark = {
  width: ${TARGET},
  height: ${TARGET},
  /** Deflated RGB samples, hex encoded: /Filter [/ASCIIHexDecode /FlateDecode] */
  data: \`
${wrapped}
\`.replace(/\\s+/g, "")
};
`
);

console.log(`png ${width}x${height} colorType=${colorType} -> ${TARGET}px, hex ${hex.length} chars`);
