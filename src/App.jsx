import React, { useState } from 'react'
import { sendComfyRequest } from './api'

function findBase64(obj) {
  if (!obj) return null
  if (typeof obj === 'string' && /^([A-Za-z0-9+/]+=*)$/.test(obj)) return obj
  if (typeof obj === 'string' && obj.startsWith('data:')) return obj.split(',')[1]
  if (typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      const v = obj[k]
      if (typeof v === 'string' && (v.length > 100 && /^(?:[A-Za-z0-9+/]+=*)$/.test(v.replace(/\n/g,'')))) return v
      if (typeof v === 'string' && v.startsWith('data:')) return v.split(',')[1]
      if (typeof v === 'object') {
        const found = findBase64(v)
        if (found) return found
      }
    }
  }
  return null
}

export default function App() {
  const [base, setBase] = useState(import.meta.env.VITE_COMFYUI_API || 'http://localhost:8188')
  const [endpoint, setEndpoint] = useState('/api/generate')
  const [method, setMethod] = useState('POST')
  const [body, setBody] = useState('')
  const [response, setResponse] = useState(null)
  const [loading, setLoading] = useState(false)

  async function send() {
    setLoading(true)
    try {
      const parsedBody = body ? JSON.parse(body) : null
      const res = await sendComfyRequest({ base, endpoint, method, body: parsedBody })
      setResponse(res)
    } catch (err) {
      setResponse({ error: String(err) })
    } finally { setLoading(false) }
  }

  function download(filename, blob) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  function saveToObsidian() {
    if (!response) return
    const b64 = findBase64(response)
    const timestamp = new Date().toISOString().replace(/[:.]/g,'-')
    const imageName = `comfyui-output-${timestamp}.png`
    if (b64) {
      const byteChars = atob(b64)
      const byteNumbers = new Array(byteChars.length)
      for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i)
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: 'image/png' })
      // trigger image download
      download(imageName, blob)
      // create markdown referencing the image file (Obsidian-friendly)
      const md = `---\nsource: ComfyUI\ndate: ${new Date().toISOString()}\n---\n\n# ComfyUI Output\n\n![[${imageName}]]\n\n\n---\n\nJSON response:\n\n\n\n\`
${JSON.stringify(response, null, 2)}
\n\n\n`
      const mdBlob = new Blob([md], { type: 'text/markdown' })
      download(`comfyui-note-${timestamp}.md`, mdBlob)
    } else {
      // No base64: save JSON response as a note
      const md = `---\nsource: ComfyUI\ndate: ${new Date().toISOString()}\n---\n\n# ComfyUI Response\n\n\n\n\`
${JSON.stringify(response, null, 2)}
\n\n\n`
      const mdBlob = new Blob([md], { type: 'text/markdown' })
      download(`comfyui-note-${timestamp}.md`, mdBlob)
    }
  }

  return (
    <div className="container">
      <h1>ComfyUI Web UI — Obsidian Export</h1>
      <div className="row">
        <label>API Base URL</label>
        <input value={base} onChange={e => setBase(e.target.value)} />
      </div>
      <div className="row">
        <label>Endpoint</label>
        <input value={endpoint} onChange={e => setEndpoint(e.target.value)} />
      </div>
      <div className="row small">
        <label>Method</label>
        <select value={method} onChange={e=>setMethod(e.target.value)}>
          <option>GET</option>
          <option>POST</option>
        </select>
      </div>
      <div className="row">
        <label>Request JSON body (if POST)</label>
        <textarea value={body} onChange={e => setBody(e.target.value)} placeholder='{"nodes": [...]}' />
      </div>
      <div className="row buttons">
        <button onClick={send} disabled={loading}>{loading ? 'Sending...' : 'Send Request'}</button>
        <button onClick={saveToObsidian} disabled={!response}>Download Obsidian Note</button>
      </div>

      <h2>Response</h2>
      <div className="response">
        <pre>{response ? JSON.stringify(response, null, 2) : 'No response yet'}</pre>
      </div>
    </div>
  )
}
