import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sirv from 'sirv'
import { handlePlacesApi } from './placesSearch.js'
import { handleWhatsAppApi } from './whatsappApi.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const dist = path.join(root, 'dist')
const port = Number(process.env.PORT || 3000)

const staticAssets = sirv(dist, {
  single: true,
  dev: false,
  etag: true,
})

const server = http.createServer(async (req, res) => {
  try {
    const url = req.url || '/'
    if (url.startsWith('/api/places')) {
      await handlePlacesApi(req, res)
      return
    }
    if (url.startsWith('/api/whatsapp')) {
      await handleWhatsAppApi(req, res)
      return
    }
    staticAssets(req, res)
  } catch (err) {
    if (!res.headersSent) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(
        JSON.stringify({
          error: err instanceof Error ? err.message : 'Erro interno',
        }),
      )
    }
  }
})

server.listen(port, () => {
  console.log(`OpenLeads CRM em http://localhost:${port}`)
})
