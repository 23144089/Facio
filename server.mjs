import 'dotenv/config'
import { WebSocketServer, WebSocket } from 'ws'

const port = Number(process.env.TRANSCRIPTION_PORT || 8787)
const apiKey = process.env.DEEPGRAM_API_KEY
const clients = new WebSocketServer({ port })

clients.on('connection', (client) => {
  let deepgram

  const closeDeepgram = () => {
    if (deepgram && deepgram.readyState === WebSocket.OPEN) deepgram.close()
    deepgram = undefined
  }

  client.on('message', (message, isBinary) => {
    if (!isBinary) {
      let payload
      try { payload = JSON.parse(message.toString()) } catch { return }
      if (payload.type !== 'start') return
      if (!apiKey) {
        client.send(JSON.stringify({ type: 'error', message: 'DEEPGRAM_API_KEY が設定されていません。.env を確認してください。' }))
        return
      }
      closeDeepgram()
      const query = new URLSearchParams({
        model: 'nova-3',
        language: 'ja',
        encoding: 'linear16',
        sample_rate: String(payload.sampleRate || 16000),
        channels: '1',
        interim_results: 'true',
        punctuate: 'true',
        smart_format: 'true',
      })
      deepgram = new WebSocket(`wss://api.deepgram.com/v1/listen?${query}`, {
        headers: { Authorization: `Token ${apiKey}` },
      })
      deepgram.on('open', () => client.send(JSON.stringify({ type: 'ready' })))
      deepgram.on('message', (data) => {
        if (client.readyState === WebSocket.OPEN) client.send(data.toString())
      })
      deepgram.on('error', () => client.send(JSON.stringify({ type: 'error', message: 'Deepgramへの接続に失敗しました。APIキーと通信状態を確認してください。' })))
      deepgram.on('close', () => {
        if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify({ type: 'closed' }))
      })
      return
    }
    if (deepgram?.readyState === WebSocket.OPEN) deepgram.send(message)
  })
  client.on('close', closeDeepgram)
})

console.log(`Deepgram proxy listening on ws://localhost:${port}`)