import './style.css'

const speakers = {
  me: { name: '話者 A', color: '#e67d6c', initials: 'A' },
  blue: { name: '話者 B', color: '#4d9bb2', initials: 'B' },
  yellow: { name: '話者 C', color: '#e4ad36', initials: 'C' },
}

const seedOpinions = []

let opinions = [...seedOpinions]

const app = document.querySelector('#app')
const expectedSpeakerIds = [0, 1]
let state = { started: false, ended: false, selected: null, zoomedOpinion: null, mapZoom: 1, panX: 0, panY: 0, topic: '', alertVisible: false }
let transcription = { active: false, connecting: false, text: '', interim: '', interimSpeaker: '話者 A', utterances: [], sessionStartedAt: null, error: '', socket: null, audioContext: null, stream: null, processor: null, source: null }
let analysis = { status: 'idle', result: null, error: '' }
let nextDynamicOpinionId = 1
let facilitator = { lastNotificationAt: 0, lastKey: '' }

function render() {
  app.innerHTML = state.started ? renderDiscussion() : renderSetup()
  bindEvents()
}

function renderSetup() {
  return `
    <main class="stage setup-stage">
      <section class="intro-copy">
        <p class="eyebrow">GROUP WORK COMPANION</p>
        <h1>話し合いを、<br /><em>見える</em>かたちに。</h1>
        <p class="intro-text">Facio が、話の流れとみんなの意見を<br />そっと整理します。</p>
      </section>
      <section class="phone setup-phone" aria-label="議題設定">
        <div class="phone-camera"></div>
        <div class="setup-content">
          <p class="phone-kicker">新しい話し合い</p>
          <h2>今日の議題を<br />入力してください</h2>
          <label for="topic">議題のテーマ</label>
          <input id="topic" type="text" value="今日の晩御飯について" placeholder="例：新歓イベントの企画" />
          <button class="primary-button" id="start-button">話し合いを始める <span>→</span></button>
          <p class="privacy-note">音声は議論の整理のためにのみ利用されます</p>
        </div>
      </section>
    </main>`
}

function renderDiscussion() {
  const topic = state.topic || document.querySelector('#topic')?.value || '今日の晩御飯について'
  const zoomedOpinion = opinions.find((opinion) => opinion.id === state.zoomedOpinion)
  return `
    <main class="stage discussion-stage">
      <section class="phone discussion-phone" aria-label="議論画面">
        <div class="phone-camera"></div>
        <header class="phone-header">
          <div><span class="live-dot"></span><span>SESSION 01</span></div>
          <button class="icon-button" id="end-button" title="話し合いを終了">×</button>
        </header>
        <section class="progress-panel">
          <div class="section-label"><span>AI FACILITATOR</span><strong>いまの進捗</strong></div>
          <div class="progress-track"><span></span></div>
          <p>「${topic}」について、<b>希望条件を集めています</b></p>
          <div class="progress-steps"><span class="done">テーマ</span><span class="active">意見を集める</span><span>決める</span></div>
        </section>
        <section class="canvas-panel ${zoomedOpinion ? 'zoomed-panel' : ''}">
          <div class="canvas-heading"><div><span class="section-label">THOUGHT MAP</span><h2>みんなの意見</h2></div><span class="count-badge">${opinions.length} 意見</span></div>
          ${zoomedOpinion ? renderOpinionDetail(zoomedOpinion) : `<div class="thought-map" data-pan-surface><div class="map-content" data-pan-content style="--map-zoom:${state.mapZoom}; --pan-x:${state.panX}px; --pan-y:${state.panY}px">${opinions.map(renderOpinion).join('')}</div><span class="map-zoom-level">${Math.round(state.mapZoom * 100)}%</span></div>`}
          <div class="legend">${Object.values(speakers).map((speaker) => `<span><i style="background:${speaker.color}"></i>${speaker.name}</span>`).join('')}</div>
        </section>
        <footer class="phone-footer"><button class="mic-button ${transcription.active ? '' : 'paused'}" id="mic-button"><span class="mic-glyph">●</span><span>${transcription.connecting ? '接続中...' : transcription.active ? '聞き取り中' : '聞き取り開始'}</span></button><span class="footer-status">00:42</span></footer>
      </section>
      <aside class="desktop-note">${renderLiveTranscript()}${renderTranscriptLog()}${renderAIAnalysis()}</aside>
    </main>`
}

function renderOpinion(opinion) {
  const speaker = speakers[opinion.speaker]
  return `<button class="opinion-card ${state.selected === opinion.id ? 'selected' : ''}" data-opinion="${opinion.id}" aria-label="${opinion.title}の詳細を表示" style="--speaker-color:${speaker.color}; --opinion-x:${opinion.position[0]}px; --opinion-y:${opinion.position[1]}px"><span class="opinion-avatar">${speaker.initials}</span><span class="opinion-title">${opinion.title}</span><span class="opinion-speaker">${speaker.name}</span><span class="opinion-related">${opinion.related.map((tag) => `#${tag}`).join(' ')}</span><span class="inner-details" aria-hidden="true">${opinion.details.map((detail) => `<i>${detail}</i>`).join('')}</span></button>`
}

function renderOpinionDetail(opinion) {
  const speaker = speakers[opinion.speaker]
  return `<div class="opinion-detail-view" data-detail-view style="--speaker-color:${speaker.color}"><button class="zoom-back" data-zoom-out aria-label="意見マップに戻る">↘ <span>マップへ戻る</span></button><div class="detail-orbit"><div class="detail-core"><span class="opinion-avatar">${speaker.initials}</span><strong>${opinion.title}</strong><small>${speaker.name}</small></div>${opinion.details.map((detail, index) => `<span class="detail-node node-${index + 1}">${detail}</span>`).join('')}</div><p class="zoom-caption">${opinion.detail}</p><span class="zoom-hint">PINCH OUT TO RETURN</span></div>`
}

function renderDetail(opinion = opinions.find((item) => item.id === state.selected)) {
  if (!opinion) return ''
  return `<div class="detail-popover"><span>SELECTED OPINION</span><strong>${opinion.title}</strong><p>${opinion.detail}</p><div>${opinion.related.map((tag) => `<small>#${tag}</small>`).join('')}</div></div>`
}

function renderTranscriptLog() {
  const latestSpeaker = getSpeakerKey({ speaker: transcription.interimSpeaker })
  const latest = transcription.interim ? `<article class="transcript-entry interim-entry"><header><span class="speaker-dot" style="--speaker-color:${speakers[latestSpeaker].color}"></span><strong>${transcription.interimSpeaker || '話者 A'}</strong><time>認識中</time></header><p>${transcription.interim}</p><small>暫定発話</small></article>` : ''
  const entries = transcription.utterances.slice(-4).reverse().map((utterance) => `<article class="transcript-entry"><header><span class="speaker-dot" style="--speaker-color:${speakers[getSpeakerKey(utterance)].color}"></span><strong>${utterance.speaker}</strong><time>${formatElapsed(utterance.startedAt)}</time></header><p>${utterance.text}</p><small>確定発話</small></article>`).join('')
  return `<section class="transcript-log"><div class="transcript-log-heading"><span class="section-label">SESSION NOTES</span><span>${transcription.utterances.length ? `${countWords(transcription.utterances)}文字` : '発話履歴'}</span></div><div class="transcript-entries">${latest || entries ? `${latest}${entries}` : '<p class="empty-transcript">確定した発話がここに蓄積されます</p>'}</div></section>`
}

function renderLiveTranscript() {
  return `<section class="transcript-strip" aria-live="polite"><div class="transcript-strip-heading"><span class="transcript-label">LIVE TRANSCRIPT</span><span>${transcription.utterances.length} 確定発話</span></div><p>${transcription.text || transcription.interim || (transcription.error ? transcription.error : 'マイクを押すと話し合いを聞き取ります')}</p></section>`
}

function renderAIAnalysis() {
  if (analysis.status === 'loading') return '<section class="ai-analysis-panel"><div class="ai-panel-heading"><span>AI ANALYSIS</span><i class="ai-status-dot"></i></div><p class="ai-analysis-loading">AIが意見を整理しています...</p></section>'
  if (analysis.status === 'error') return `<section class="ai-analysis-panel"><div class="ai-panel-heading"><span>AI ANALYSIS</span><i class="ai-status-dot error"></i></div><p class="ai-analysis-error">${analysis.error}</p></section>`
  if (!analysis.result) return '<section class="ai-analysis-panel"><div class="ai-panel-heading"><span>AI ANALYSIS</span><i class="ai-status-dot idle"></i></div><p class="ai-analysis-empty">確定発話を待っています</p></section>'
  return `<section class="ai-analysis-panel"><div class="ai-panel-heading"><span>AI ANALYSIS</span><i class="ai-status-dot ready"></i></div><small class="ai-analysis-caption">最新の発話から抽出</small><h3>${analysis.result.summary}</h3><div class="ai-keywords">${analysis.result.keywords.map((keyword) => `<span>#${keyword}</span>`).join('')}</div><p class="ai-details">${analysis.result.details.join(' / ')}</p><div class="ai-similarity"><span>既存意見との近さ</span><strong>${Math.round(analysis.result.similarity * 100)}%</strong></div><p class="ai-reasoning">${analysis.result.reasoning}</p></section>`
}

function formatElapsed(seconds) {
  const totalSeconds = Math.max(0, Math.floor(seconds || 0))
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`
}

function countWords(utterances) {
  return utterances.reduce((total, utterance) => total + utterance.text.replace(/\s/g, '').length, 0)
}

function bindEvents() {
  bindPanGesture()
  document.querySelector('#start-button')?.addEventListener('click', () => {
    const topic = document.querySelector('#topic').value.trim()
    if (!topic) return document.querySelector('#topic').focus()
    transcription = { active: false, connecting: false, text: '', interim: '', interimSpeaker: '話者 A', utterances: [], sessionStartedAt: null, error: '', socket: null, audioContext: null, stream: null, processor: null, source: null }
    opinions = [...seedOpinions]
    nextDynamicOpinionId = 1
    facilitator = { lastNotificationAt: 0, lastKey: '' }
    state.topic = topic
    state.started = true
    analysis = { status: 'idle', result: null, error: '' }
    render()
  })
  document.querySelector('#end-button')?.addEventListener('click', () => {
    state.ended = true
    renderSummary()
  })
  document.querySelectorAll('[data-opinion]').forEach(bindOpinionCard)
  document.querySelector('[data-zoom-out]')?.addEventListener('click', () => { state.zoomedOpinion = null; render() })
  document.querySelector('[data-detail-view]')?.addEventListener('wheel', (event) => {
    if (!event.ctrlKey) return
    event.preventDefault()
    if (event.deltaY > 0) { state.zoomedOpinion = null; render() }
  }, { passive: false })
  document.querySelector('[data-pan-surface]')?.addEventListener('wheel', (event) => {
    if (!event.ctrlKey) return
    event.preventDefault()
    const previousZoom = state.mapZoom
    const nextZoom = Math.min(4, Math.max(0.35, Number((previousZoom + (event.deltaY < 0 ? 0.1 : -0.1)).toFixed(2))))
    if (nextZoom === previousZoom) return
    state.mapZoom = nextZoom
    const surface = event.currentTarget
    const content = surface.querySelector('[data-pan-content]')
    const zoomLevel = surface.querySelector('.map-zoom-level')
    const bounds = surface.getBoundingClientRect()
    const cursorX = event.clientX - (bounds.left + bounds.width / 2)
    const cursorY = event.clientY - (bounds.top + bounds.height / 2)
    const zoomRatio = state.mapZoom / previousZoom
    state.panX = cursorX - (cursorX - state.panX) * zoomRatio
    state.panY = cursorY - (cursorY - state.panY) * zoomRatio
    content.style.setProperty('--map-zoom', state.mapZoom)
    content.style.setProperty('--pan-x', `${state.panX}px`)
    content.style.setProperty('--pan-y', `${state.panY}px`)
    content.style.setProperty('--detail-opacity', getDetailOpacity(state.mapZoom))
    content.style.setProperty('--detail-scale', getDetailScale(state.mapZoom))
    zoomLevel.textContent = `${Math.round(state.mapZoom * 100)}%`
  }, { passive: false })
  bindFacilitatorAlert()
  document.querySelector('#mic-button')?.addEventListener('click', toggleTranscription)
}

function renderFacilitatorAlert() {
  const result = facilitator.result
  return `<div class="facilitator-alert"><span class="alert-icon">!</span><div><strong>${result?.offTopic ? '話題の流れを確認しましょう' : '発言のバランスを確認しましょう'}</strong><small>${result?.notificationMessage || 'まだ発言していない人にも聞いてみませんか？'}</small></div><button id="dismiss-alert" title="通知を閉じる">×</button></div>`
}

function showFacilitatorAlert() {
  const phone = document.querySelector('.discussion-phone')
  if (!phone || phone.querySelector('.facilitator-alert')) return
  state.alertVisible = true
  phone.insertAdjacentHTML('beforeend', renderFacilitatorAlert())
  bindFacilitatorAlert()
}

function maybeNotifyFacilitator(result, utterance) {
  const elapsedSeconds = utterance.startedAt || 0
  const observedSpeakerIds = new Set(transcription.utterances.map((item) => item.speakerId))
  const shouldCheckInactive = transcription.utterances.length >= 3 && elapsedSeconds >= 20
  const inactiveSpeakerIds = shouldCheckInactive
    ? expectedSpeakerIds.filter((id) => !observedSpeakerIds.has(id))
    : []
  const shouldNotifyInactive = inactiveSpeakerIds.length > 0
  if (!result.offTopic && !shouldNotifyInactive) return
  const notificationResult = {
    ...result,
    inactiveSpeakerIds,
    notificationMessage: result.offTopic
      ? (result.notificationMessage || `議題「${state.topic}」から話がそれています。`)
      : `話者 ${inactiveSpeakerIds.map((id) => String.fromCharCode(65 + id)).join('、')} にも意見を聞いてみませんか？`,
  }
  const key = `${result.offTopic ? 'topic' : ''}:${inactiveSpeakerIds.join(',')}`
  const now = Date.now()
  if (key === facilitator.lastKey && now - facilitator.lastNotificationAt < 15000) return
  facilitator = { lastNotificationAt: now, lastKey: key, result: notificationResult }
  showFacilitatorAlert()
  playNotificationSound()
}

function playNotificationSound() {
  if (!transcription.audioContext) return
  const context = transcription.audioContext
  if (context.state === 'suspended') context.resume()
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.frequency.setValueAtTime(660, context.currentTime)
  oscillator.frequency.setValueAtTime(520, context.currentTime + 0.12)
  gain.gain.setValueAtTime(0.0001, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.28)
  oscillator.connect(gain).connect(context.destination)
  oscillator.start()
  oscillator.stop(context.currentTime + 0.3)
}

function bindFacilitatorAlert() {
  document.querySelector('#dismiss-alert')?.addEventListener('click', () => {
    state.alertVisible = false
    document.querySelector('.facilitator-alert')?.remove()
  })
}

function bindOpinionCard(card) {
  card.addEventListener('click', () => {
    if (card.closest('[data-pan-surface]')?.dataset.dragged === 'true') {
      card.closest('[data-pan-surface]').dataset.dragged = 'false'
      return
    }
    state.selected = card.dataset.opinion
    state.zoomedOpinion = null
    render()
  })
}

async function toggleTranscription() {
  if (transcription.active || transcription.connecting) {
    stopTranscription()
    return
  }
  await startTranscription()
}

async function startTranscription() {
  transcription = { ...transcription, connecting: true, error: '', interim: '', sessionStartedAt: Date.now() }
  updateMicStatus()
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
    const audioContext = new AudioContext()
    const source = audioContext.createMediaStreamSource(stream)
    const processor = audioContext.createScriptProcessor(4096, 1, 1)
    const socket = new WebSocket('ws://localhost:8787')
    socket.binaryType = 'arraybuffer'
    socket.onopen = () => socket.send(JSON.stringify({ type: 'start', sampleRate: audioContext.sampleRate }))
    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data)
      if (payload.type === 'ready') { transcription.active = true; transcription.connecting = false; updateMicStatus() }
      if (payload.type === 'error') { transcription.error = payload.message; stopTranscription(false); updateMicStatus(); updateTranscriptOnly() }
      if (!payload.channel?.alternatives?.[0]) return
      const alternative = payload.channel.alternatives[0]
      const transcript = alternative.transcript || ''
      const detectedSpeaker = getDetectedSpeaker(alternative.words)
      transcription.interimSpeaker = detectedSpeaker.name
      if (payload.is_final && transcript.trim()) {
        const startedAt = (Date.now() - transcription.sessionStartedAt) / 1000
        const utterance = { speaker: detectedSpeaker.name, speakerId: detectedSpeaker.id, text: transcript.trim(), startedAt, isFinal: true, receivedAt: new Date().toISOString() }
        transcription.utterances.push(utterance)
        transcription.text = transcription.utterances.map((utterance) => utterance.text).join(' ')
        transcription.interim = ''
        analyzeUtterance(utterance)
      } else if (!payload.is_final) transcription.interim = transcript
      updateTranscriptOnly()
    }
    socket.onerror = () => { transcription.error = '音声中継サーバーに接続できません。npm run dev で起動してください。'; stopTranscription(false); updateMicStatus(); updateTranscriptOnly() }
    processor.onaudioprocess = (event) => {
      if (socket.readyState !== WebSocket.OPEN) return
      const input = event.inputBuffer.getChannelData(0)
      const pcm = new Int16Array(input.length)
      for (let index = 0; index < input.length; index += 1) pcm[index] = Math.max(-1, Math.min(1, input[index])) * 0x7fff
      socket.send(pcm.buffer)
    }
    source.connect(processor)
    processor.connect(audioContext.destination)
    transcription = { ...transcription, active: false, connecting: true, socket, audioContext, stream, processor, source }
  } catch (error) {
    transcription = { ...transcription, connecting: false, error: error.name === 'NotAllowedError' ? 'マイクの使用が許可されていません。ブラウザー設定を確認してください。' : 'マイクを開始できませんでした。' }
    updateMicStatus()
  }
}

function stopTranscription(clearError = true) {
  transcription.socket?.close()
  transcription.processor?.disconnect()
  transcription.source?.disconnect()
  transcription.stream?.getTracks().forEach((track) => track.stop())
  transcription.audioContext?.close()
  transcription = { ...transcription, active: false, connecting: false, socket: null, audioContext: null, stream: null, processor: null, source: null, error: clearError ? '' : transcription.error }
  updateMicStatus()
}

function updateMicStatus() {
  const button = document.querySelector('#mic-button')
  if (!button) return
  const label = button.querySelector('span:last-child')
  button.classList.toggle('paused', !transcription.active)
  if (label) label.textContent = transcription.connecting ? '接続中...' : transcription.active ? '聞き取り中' : '聞き取り開始'
}

function updateTranscriptOnly() {
  const liveTranscript = document.querySelector('.transcript-strip')
  if (liveTranscript) liveTranscript.outerHTML = renderLiveTranscript()
  const log = document.querySelector('.transcript-log')
  if (log) log.outerHTML = renderTranscriptLog()
  const aiPanel = document.querySelector('.ai-analysis-panel')
  if (aiPanel) aiPanel.outerHTML = renderAIAnalysis()
}

async function analyzeUtterance(utterance) {
  analysis = { status: 'loading', result: null, error: '' }
  updateTranscriptOnly()
  try {
    const response = await fetch('http://localhost:8787/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: state.topic,
        utterance,
        recentUtterances: transcription.utterances.slice(-8),
        expectedSpeakers: expectedSpeakerIds,
        existingOpinions: opinions.map(({ id, title, detail }) => ({ id, title, detail })),
      }),
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'AI分析に失敗しました')
    analysis = { status: 'ready', result, error: '' }
    addOpinionFromAnalysis(utterance, result)
    appendLatestOpinionToMap()
    maybeNotifyFacilitator(result, utterance)
  } catch (error) {
    analysis = { status: 'error', result: null, error: error.message }
  }
  updateTranscriptOnly()
}

function addOpinionFromAnalysis(utterance, result) {
  const speaker = getSpeakerForUtterance(utterance)
  const dynamicIndex = opinions.length - seedOpinions.length
  const column = dynamicIndex % 3
  const row = Math.floor(dynamicIndex / 3)
  const newOpinion = {
    id: `live-${nextDynamicOpinionId}`,
    speaker,
    title: getOpinionTitle(result),
    detail: utterance.text,
    related: result.keywords.slice(0, 2),
    details: result.details.slice(0, 3),
    position: [90 + column * 285, 400 + row * 185],
    sourceUtteranceId: utterance.receivedAt,
  }
  nextDynamicOpinionId += 1
  opinions = [...opinions, newOpinion]
}

function getOpinionTitle(result) {
  const title = result.primaryKeyword || result.keywords?.[0] || result.summary || '新しい意見'
  return title.replace(/[。．.!！?？、,]/g, '').trim().slice(0, 12) || '新しい意見'
}

function getSpeakerKey(utterance) {
  if (utterance.speakerId === 1 || utterance.speaker === '話者 B') return 'blue'
  if (utterance.speakerId >= 2 || utterance.speaker === '話者 C') return 'yellow'
  return 'me'
}

function getSpeakerForUtterance(utterance) {
  return getSpeakerKey(utterance)
}

function getDetectedSpeaker(words = []) {
  const speakerCounts = words.reduce((counts, word) => {
    if (Number.isInteger(word.speaker)) counts[word.speaker] = (counts[word.speaker] || 0) + 1
    return counts
  }, {})
  const detectedIds = Object.keys(speakerCounts).map(Number)
  const id = detectedIds.sort((left, right) => speakerCounts[right] - speakerCounts[left])[0] ?? 0
  return { id, name: `話者 ${String.fromCharCode(65 + id)}` }
}

function appendLatestOpinionToMap() {
  const mapContent = document.querySelector('[data-pan-content]')
  const countBadge = document.querySelector('.count-badge')
  const latestOpinion = opinions[opinions.length - 1]
  if (!mapContent || !latestOpinion) return
  mapContent.insertAdjacentHTML('beforeend', renderOpinion(latestOpinion))
  bindOpinionCard(mapContent.lastElementChild)
  if (countBadge) countBadge.textContent = `${opinions.length} 意見`
}

function getDetailOpacity(zoom) {
  const detailStart = 1.05
  const detailComplete = 2.2
  return Math.min(1, Math.max(0, (zoom - detailStart) / (detailComplete - detailStart))).toFixed(2)
}

function getDetailScale(zoom) {
  return Math.min(1, Math.max(0.55, 0.55 + (zoom - 1) * 0.7)).toFixed(2)
}

function bindPanGesture() {
  const surface = document.querySelector('[data-pan-surface]')
  const content = document.querySelector('[data-pan-content]')
  if (!surface || !content) return
  let dragging = false
  let moved = false
  let startX = 0
  let startY = 0
  let offsetX = state.panX
  let offsetY = state.panY

  surface.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return
    dragging = true
    moved = false
    startX = event.clientX - offsetX
    startY = event.clientY - offsetY
    surface.dataset.dragged = 'false'
    surface.setPointerCapture(event.pointerId)
    surface.classList.add('is-panning')
  })
  surface.addEventListener('pointermove', (event) => {
    if (!dragging) return
    offsetX = event.clientX - startX
    offsetY = event.clientY - startY
    if (Math.abs(offsetX) > 4 || Math.abs(offsetY) > 4) moved = true
    content.style.setProperty('--pan-x', `${offsetX}px`)
    content.style.setProperty('--pan-y', `${offsetY}px`)
    state.panX = offsetX
    state.panY = offsetY
  })
  const stopPan = (event) => {
    if (!dragging) return
    dragging = false
    surface.releasePointerCapture?.(event.pointerId)
    surface.classList.remove('is-panning')
    if (moved) surface.dataset.dragged = 'true'
  }
  surface.addEventListener('pointerup', stopPan)
  surface.addEventListener('pointercancel', stopPan)
}

function renderSummary() {
  app.innerHTML = `<main class="stage summary-stage"><section class="summary-panel"><p class="eyebrow">SESSION COMPLETE</p><h1>話し合いのまとめ</h1><p class="summary-topic">今日の晩御飯について</p><div class="decision-box"><span>決まったこと</span><h2>みんなで野菜カレーを作る</h2><p>手軽さ・健康・満足感の3つの意見をもとに決定しました。</p></div><div class="minutes"><span>議事録</span><p>20分以内で作れること、野菜を取れること、満足感があることを重視。次回は買い出しの担当を決める。</p></div><button class="primary-button" id="new-session">新しい話し合いを始める <span>→</span></button></section></main>`
  document.querySelector('#new-session').addEventListener('click', () => { state = { started: false, ended: false, selected: null, zoomedOpinion: null, mapZoom: 1, panX: 0, panY: 0, alertVisible: false }; facilitator = { lastNotificationAt: 0, lastKey: '' }; render() })
}

render()