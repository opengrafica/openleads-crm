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
  const parts = req.query.path
  const segments = Array.isArray(parts) ? parts : parts ? [parts] : []
  const search = req.url?.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''
  const rebuilt = `/api/${segments.join('/')}${search}`

  const nodeReq = req as unknown as IncomingMessage
  const nodeRes = res as unknown as ServerResponse
  nodeReq.url = rebuilt

  if (rebuilt.startsWith('/api/places')) {
    await handlePlacesApi(nodeReq, nodeRes)
    return
  }
  if (rebuilt.startsWith('/api/whatsapp')) {
    await handleWhatsAppApi(nodeReq, nodeRes)
    return
  }

  res.status(404).json({ error: 'API não encontrada', path: rebuilt })
}
