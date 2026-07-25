import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { handlePlacesApi } from '../server/placesSearch.js'
import { handleWhatsAppApi } from '../server/whatsappApi.js'

export const config = {
  maxDuration: 300,
  api: {
    bodyParser: false,
    responseLimit: false,
  },
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const incoming = req.url || '/'
  const u = new URL(incoming, 'https://openleads.local')

  // rewrite: /api/:path*  →  /api?p=:path*
  const p = typeof req.query.p === 'string' ? req.query.p : Array.isArray(req.query.p) ? req.query.p.join('/') : ''
  const pathName = p ? `/api/${p}` : u.pathname === '/api' || u.pathname === '/api/' ? '/api' : u.pathname

  const qs = new URLSearchParams(u.search)
  qs.delete('p')
  const search = qs.toString()
  const rebuilt = `${pathName}${search ? `?${search}` : ''}`

  const nodeReq = req as unknown as IncomingMessage
  const nodeRes = res as unknown as ServerResponse
  nodeReq.url = rebuilt
  ;(nodeReq as { method?: string }).method = req.method

  try {
    if (rebuilt.startsWith('/api/places')) {
      await handlePlacesApi(nodeReq, nodeRes)
      return
    }
    if (rebuilt.startsWith('/api/whatsapp')) {
      await handleWhatsAppApi(nodeReq, nodeRes)
      return
    }
    res.status(200).json({
      ok: true,
      service: 'openleads-api',
      hint: 'Use /api/places/* ou /api/whatsapp/*',
      path: rebuilt,
    })
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Erro na API',
      })
    }
  }
}
