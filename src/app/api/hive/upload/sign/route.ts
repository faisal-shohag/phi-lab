// Returns a short-lived Cloudinary upload signature so the browser can upload an
// image directly to Cloudinary (the file bytes never touch our server). The
// folder is fixed server-side; the client sends back exactly { folder,
// timestamp, signature, api_key } plus the file.
import { requireHiveUser } from '@/lib/hive/roles'
import { hiveError } from '@/lib/hive/errors'
import { signUpload } from '@/lib/hive/cloudinary'

export async function POST() {
  const { error } = await requireHiveUser()
  if (error) return hiveError(error)

  const sig = signUpload()
  if (!sig) return hiveError('SERVER_ERROR', 'Image uploads are not configured on this server.')

  return Response.json(sig)
}
