// ============================================================
// Server-only selfie fingerprinting.
//
// `sharp` decodes the JPEG/PNG from the data URL and shrinks it to a
// 9x8 grayscale thumbnail. Comparing neighbouring pixels produces a
// 64-bit "dHash": two visually identical photos (even after a re-encode
// or a small crop) end up within a couple of bits, while two different
// selfies are far apart.
//
// A SHA-256 of the raw bytes is stored as well, so a byte-for-byte
// replay is caught even if the image cannot be decoded.
//
// Never import this from a Client Component.
// ============================================================

import crypto from 'node:crypto'
import sharp from 'sharp'

export type PhotoFingerprint = {
  /** SHA-256 of the decoded image bytes — identical uploads share it. */
  sha: string
  /** 16-character hex dHash, or null when the image could not be decoded. */
  dhash: string | null
}

/** Decode a `data:image/...;base64,` URL into bytes. */
export function decodeImageDataUrl(dataUrl: string): Buffer | null {
  const comma = dataUrl.indexOf(',')
  if (comma === -1) return null
  if (!dataUrl.slice(0, comma).includes(';base64')) return null
  try {
    const bytes = Buffer.from(dataUrl.slice(comma + 1), 'base64')
    return bytes.length > 0 ? bytes : null
  } catch {
    return null
  }
}

/** Compute the SHA-256 + perceptual hash used by duplicate-selfie detection. */
export async function photoFingerprint(dataUrl: string): Promise<PhotoFingerprint | null> {
  const bytes = decodeImageDataUrl(dataUrl)
  if (!bytes) return null

  const sha = crypto.createHash('sha256').update(bytes).digest('hex')

  let dhash: string | null = null
  try {
    const { data } = await sharp(bytes)
      .rotate() // honour EXIF orientation before hashing
      .resize(9, 8, { fit: 'fill' })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true })

    if (data.length >= 72) {
      let bits = ''
      for (let y = 0; y < 8; y += 1) {
        for (let x = 0; x < 8; x += 1) {
          const left = data[y * 9 + x]
          const right = data[y * 9 + x + 1]
          bits += left > right ? '1' : '0'
        }
      }
      dhash = ''
      for (let i = 0; i < 64; i += 4) {
        dhash += parseInt(bits.slice(i, i + 4), 2).toString(16)
      }
    }
  } catch {
    // Undecodable image: keep the SHA-256 so an exact replay is still caught.
    dhash = null
  }

  return { sha, dhash }
}
