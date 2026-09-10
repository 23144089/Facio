import 'dotenv/config'
import http from 'node:http'
import OpenAI from 'openai'
import { WebSocketServer, WebSocket } from 'ws'

const port = Number(process.env.TRANSCRIPTION_PORT || 8787)
const apiKey = process.env.DEEPGRAM_API_KEY
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null
const httpServer = http.createServer(handleHttpRequest)
const clients = new WebSocketServer({ server: httpServer })

async function handleHttpRequest(request, response) {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, corsHeaders())
    response.end()
    return
  }
  if (request.method !== 'POST' || request.url !== '/api/analyze') {
    response.writeHead(404, corsHeaders())
    response.end(JSON.stringify({ error: 'Not found' }))
    return
  }
  if (!openai) {
    sendJson(response, 503, { error: 'OPENAI_API_KEY が設定されていません。.env を確認してください。' })
    return
  }
  try {
    const body = await readJson(request)
    if (!body.topic || !body.utterance?.text) {
      sendJson(response, 400, { error: 'topic と utterance.text は必須です。' })
      return
    }
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.2,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'opinion_analysis',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              summary: { type: 'string' },
              details: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 3 },
              keywords: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 5 },
              relatedOpinionIds: { type: 'array', items: { type: 'string' } },
              similarity: { type: 'number', minimum: 0, maximum: 1 },
              reasoning: { type: 'string' },
            },
            required: ['summary', 'details', 'keywords', 'relatedOpinionIds', 'similarity', 'reasoning'],
          },
        },
      },
      messages: [
        { role: 'system', content: 'あなたはグループワークの議事整理アシスタントです。日本語で簡潔に分析し、発話にない内容を断定しないでください。既存意見との近さは、意味が近い場合のみIDを返してください。' },
        { role: 'user', content: JSON.stringify({ topic: body.topic, utterance: body.utterance, existingOpinions: body.existingOpinions || [] }) },
      ],
    })
    sendJson(response, 200, JSON.parse(completion.choices[0].message.content))
  } catch (error) {
    console.error('OpenAI analysis failed:', error.message)
    sendJson(response, 502, { error: 'OpenAIによる意見分析に失敗しました。APIキー、モデル、通信状態を確認してください。' })
  }
}

function corsHeaders() {
  return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
}

function sendJson(response, status, body) {
  response.writeHead(status, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(body))
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let data = ''
    request.on('data', (chunk) => { data += chunk })
    request.on('end', () => {
      try { resolve(JSON.parse(data)) } catch { reject(new Error('Invalid JSON')) }
    })
    request.on('error', reject)
  })
}

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

httpServer.listen(port, () => console.log(`Deepgram proxy and OpenAI API listening on http://localhost:${port}`))