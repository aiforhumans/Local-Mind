const DEFAULT_BASE = import.meta.env.VITE_COMFYUI_API || 'http://localhost:8188'

export async function sendComfyRequest({ base = DEFAULT_BASE, endpoint = '/', method = 'GET', body = null, headers = {} }) {
  const url = base.replace(/\/$/, '') + endpoint
  const init = { method, headers }
  if (body) {
    if (typeof body === 'string') init.body = body
    else init.body = JSON.stringify(body)
    init.headers = { 'Content-Type': 'application/json', ...init.headers }
  }
  const resp = await fetch(url, init)
  const contentType = resp.headers.get('content-type') || ''
  if (contentType.includes('application/json')) return await resp.json()
  // fallback to blob (images, etc.)
  const blob = await resp.blob()
  // convert to base64 for easy embedding
  const b64 = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
  return { image_base64: b64, _blob_type: blob.type }
}
