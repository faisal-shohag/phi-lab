// Cloudinary signed-upload helper. No SDK: we sign the upload params server-side
// with a sha1 of the sorted params + API secret (Cloudinary's documented
// signature scheme), and the browser POSTs the file directly to Cloudinary's
// REST endpoint with that signature. The folder is fixed server-side so clients
// can't scatter uploads elsewhere.
import { createHash } from 'node:crypto'
import { CLOUDINARY_FOLDER } from './constants'

export interface UploadSignature {
  cloudName: string
  apiKey: string
  timestamp: number
  folder: string
  signature: string
}

/** Build a signature for a direct browser upload, or null if unconfigured. */
export function signUpload(): UploadSignature | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET
  if (!cloudName || !apiKey || !apiSecret) return null

  const timestamp = Math.floor(Date.now() / 1000)
  const folder = CLOUDINARY_FOLDER

  // Params to sign, alphabetically sorted, joined as key=value&…, then the
  // secret appended, hashed with sha1. Must match exactly what the client sends.
  const toSign = `folder=${folder}&timestamp=${timestamp}`
  const signature = createHash('sha1').update(toSign + apiSecret).digest('hex')

  return { cloudName, apiKey, timestamp, folder, signature }
}

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  )
}
