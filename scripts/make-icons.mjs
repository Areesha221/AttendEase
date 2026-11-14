// ============================================================
// Generates the PWA icons (PNG) with zero dependencies.
// Run:  node scripts/make-icons.mjs
// Outputs into public/icons plus app/icon.png and app/apple-icon.png
// ============================================================

import zlib from 'node:zlib'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buffer) {
  let c = 0xffffffff
  for (let i = 0; i < buffer.length; i += 1) c = crcTable[(c ^ buffer[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeBuffer = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0)
  return Buffer.concat([length, typeBuffer, data, crc])
}

function encodePng(pixels, size) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0 // filter: none
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  const idat = zlib.deflateSync(raw, { level: 9 })
  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

function insideRounded(x, y, w, h, radius) {
  if (radius <= 0) return true
  const cx = Math.min(Math.max(x, radius), w - radius)
  const cy = Math.min(Math.max(y, radius), h - radius)
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy <= radius * radius
}

function fillCircle(px, size, cx, cy, r, color) {
  const r2 = r * r
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y += 1) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x += 1) {
      if (x < 0 || y < 0 || x >= size || y >= size) continue
      const dx = x - cx
      const dy = y - cy
      if (dx * dx + dy * dy <= r2) {
        const i = (y * size + x) * 4
        px[i] = color[0]
        px[i + 1] = color[1]
        px[i + 2] = color[2]
        px[i + 3] = 255
      }
    }
  }
}

function fillRoundedRect(px, size, x0, y0, w, h, radius, color) {
  for (let y = Math.floor(y0); y < Math.ceil(y0 + h); y += 1) {
    for (let x = Math.floor(x0); x < Math.ceil(x0 + w); x += 1) {
      if (x < 0 || y < 0 || x >= size || y >= size) continue
      if (!insideRounded(x - x0, y - y0, w, h, radius)) continue
      const i = (y * size + x) * 4
      px[i] = color[0]
      px[i + 1] = color[1]
      px[i + 2] = color[2]
      px[i + 3] = 255
    }
  }
}

function makeIcon(size, maskable) {
  const px = Buffer.alloc(size * size * 4)
  const radius = maskable ? 0 : size * 0.22
  const scale = maskable ? 0.82 : 1 // keep content inside the maskable safe zone
  const cx = size / 2
  const offset = (1 - scale) * size * 0.5

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!insideRounded(x, y, size, size, radius)) continue
      const t = (x + y) / (2 * size)
      const i = (y * size + x) * 4
      px[i] = Math.round(79 + (14 - 79) * t)
      px[i + 1] = Math.round(70 + (165 - 70) * t)
      px[i + 2] = Math.round(229 + (233 - 229) * t)
      px[i + 3] = 255
    }
  }

  const content = (value) => offset + value * scale
  fillCircle(px, size, cx, content(size * 0.38), size * 0.14 * scale, [255, 255, 255])
  fillRoundedRect(
    px,
    size,
    content(size * 0.26),
    content(size * 0.58),
    size * 0.48 * scale,
    size * 0.26 * scale,
    size * 0.12 * scale,
    [255, 255, 255],
  )

  return encodePng(px, size)
}

const iconsDir = path.join(root, 'public', 'icons')
fs.mkdirSync(iconsDir, { recursive: true })

const outputs = [
  [path.join(iconsDir, 'icon-192.png'), 192, false],
  [path.join(iconsDir, 'icon-512.png'), 512, false],
  [path.join(iconsDir, 'maskable-512.png'), 512, true],
  [path.join(root, 'app', 'icon.png'), 192, false],
  [path.join(root, 'app', 'apple-icon.png'), 180, false],
]

for (const [file, size, maskable] of outputs) {
  fs.writeFileSync(file, makeIcon(size, maskable))
  console.log('wrote', path.relative(root, file))
}
