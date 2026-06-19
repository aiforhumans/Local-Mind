import React, { useState } from 'react'
import { sendComfyRequest } from './api'

const WHITESPACE_RE = /\s+/g
const BASE64_RE = /^(?:[A-Za-z0-9+/]+={0,2})$/

function normalizeBase64(value) {
  if (typeof value !== 'string') return null
  const normalized = value.replace(WHITESPACE_RE, '')
  const remainder = normalized.length % 4
  if (remainder === 1) return null
  if (remainder === 0) return normalized
  return normalized + '='.repeat(4 - remainder)
}

function getNormalizedBase64(value, minLength = 100) {
  if (typeof value !== 'string') return null
  const normalized = normalizeBase64(value)
  if (!normalized || normalized.length < minLength) return null
  if (!BASE64_RE.test(normalized)) return null
  return normalized
}

function findBase64(obj) {
  if (!obj) return null
  if (typeof obj === 'string') {
    if (obj.startsWith('data:')) return getNormalizedBase64(obj.split(',')[1] || '')
    return getNormalizedBase64(obj)
  }
  if (typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      const v = obj[k]
      if (typeof v === 'string') {
        if (v.startsWith('data:')) {
          const normalizedDataUrl = getNormalizedBase64(v.split(',')[1] || '')
          if (normalizedDataUrl) return normalizedDataUrl
        }
        const normalized = getNormalizedBase64(v)
        if (normalized) return normalized
      }
      if (typeof v === 'object') {
        const found = findBase64(v)
        if (found) return found
      }
    }
  }
  return null
}

function buildObsidianMarkdown(response, date, imageName = null) {
  const formattedJson = JSON.stringify(response, null, 2)

  return `---
source: ComfyUI
date: ${date}
---

# ComfyUI Response

${imageName ? `Image:\n\n![[${imageName}]]\n` : ''}

---

JSON response:

\`\`\`\`json
${formattedJson}
\`\`\`\`
`
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
    const date = new Date().toISOString()
    const imageName = `comfyui-output-${timestamp}.png`
    let markdownImageName = null
    if (b64) {
      try {
        const byteChars = atob(b64)
        const byteNumbers = new Array(byteChars.length)
        for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i)
        const byteArray = new Uint8Array(byteNumbers)
        const blob = new Blob([byteArray], { type: 'image/png' })
        download(imageName, blob)
        markdownImageName = imageName
      } catch (err) {
        console.error('Failed to decode base64 image data; continuing without image export. The payload may be malformed or truncated.', err)
      }
    }
    const md = buildObsidianMarkdown(response, date, markdownImageName)
    const mdBlob = new Blob([md], { type: 'text/markdown' })
    download(`comfyui-note-${timestamp}.md`, mdBlob)
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
