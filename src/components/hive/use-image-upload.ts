'use client'

// Direct-to-Cloudinary image upload. Fetches a short-lived signature from our
// server, then uploads the file straight to Cloudinary (bytes never touch our
// server). Returns the secure_url. Enforces the per-file size cap client-side.
import { useState, useCallback } from 'react'
import { MAX_IMAGE_BYTES, MAX_IMAGES_PER_POST } from '@/lib/hive/constants'

interface SignResponse {
  cloudName: string
  apiKey: string
  timestamp: number
  folder: string
  signature: string
}

export function useImageUpload(initial: string[] = []) {
  const [images, setImages] = useState<string[]>(initial)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upload = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files)
      if (list.length === 0) return
      setError(null)

      if (images.length + list.length > MAX_IMAGES_PER_POST) {
        setError(`Up to ${MAX_IMAGES_PER_POST} images per post.`)
        return
      }
      for (const f of list) {
        if (f.size > MAX_IMAGE_BYTES) {
          setError('Each image must be under 5 MB.')
          return
        }
      }

      setUploading(true)
      try {
        const signRes = await fetch('/api/hive/upload/sign', { method: 'POST' })
        if (!signRes.ok) throw new Error('Could not start upload.')
        const sig: SignResponse = await signRes.json()

        const uploaded: string[] = []
        for (const file of list) {
          const form = new FormData()
          form.append('file', file)
          form.append('api_key', sig.apiKey)
          form.append('timestamp', String(sig.timestamp))
          form.append('folder', sig.folder)
          form.append('signature', sig.signature)
          const res = await fetch(
            `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
            { method: 'POST', body: form },
          )
          if (!res.ok) throw new Error('Upload failed.')
          const data = await res.json()
          if (data.secure_url) uploaded.push(data.secure_url as string)
        }
        setImages((prev) => [...prev, ...uploaded])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed.')
      } finally {
        setUploading(false)
      }
    },
    [images.length],
  )

  const remove = useCallback((url: string) => {
    setImages((prev) => prev.filter((u) => u !== url))
  }, [])

  return { images, uploading, error, upload, remove, setImages }
}
