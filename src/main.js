import './style.css'

const speakers = {
  me: { name: 'あなた', color: '#e67d6c', initials: 'A' },
  blue: { name: '参加者 B', color: '#4d9bb2', initials: 'B' },
  yellow: { name: '参加者 C', color: '#e4ad36', initials: 'C' },
}

const opinions = [
  { id: 'cost', speaker: 'me', title: '手軽さ', detail: '冷蔵庫にある材料で、20分以内に作れるものがよさそう。', related: ['時短', '在庫'], details: ['20分以内', '冷蔵庫の材料', '洗い物が少ない'], position: [40, 45] },
  { id: 'budget', speaker: 'me', title: '予算', detail: '今日買い足すものは少なく、予算も抑えたいです。', related: ['節約', '買い物'], details: ['1,000円以内', '買い足し少なめ', '家にあるもの'], position: [325, 35] },
  { id: 'prep', speaker: 'me', title: '準備', detail: '作り始めるまでの準備が少ないと助かります。', related: ['下ごしらえ', '簡単'], details: ['切るだけ', '片付けやすい', 'すぐ開始'], position: [610, 75] },
  { id: 'healthy', speaker: 'blue', title: '健康', detail: '野菜をしっかり取れるメニューにしたいです。', related: ['栄養', '野菜'], details: ['野菜を多めに', '油は控えめ', '明日の元気'], position: [85, 285] },
  { id: 'nutrition', speaker: 'blue', title: '栄養', detail: '主食・主菜・副菜のバランスも意識したいです。', related: ['バランス', 'たんぱく質'], details: ['主菜を入れる', '彩りを足す', '不足を補う'], position: [360, 245] },
  { id: 'balance', speaker: 'blue', title: 'バランス', detail: '重すぎず、明日にも影響しない食事が理想です。', related: ['量', '体調'], details: ['食べすぎない', '腹八分目', '明日に残さない'], position: [650, 320] },
  { id: 'taste', speaker: 'yellow', title: '満足感', detail: '今日は少しこってりしたものが食べたい気分です。', related: ['気分', 'ボリューム'], details: ['食べ応え', '温かい料理', 'ご飯に合う'], position: [35, 545] },
  { id: 'comfort', speaker: 'yellow', title: '安心感', detail: 'みんなが知っている味だと、好みの差も少なそうです。', related: ['定番', '好み'], details: ['慣れた味', '苦手が少ない', '家族向け'], position: [340, 520] },
  { id: 'share', speaker: 'yellow', title: '楽しさ', detail: '一緒に作ったり選んだりできるメニューがいいです。', related: ['協力', '会話'], details: ['役割分担', '一緒に作る', '会話が弾む'], position: [625, 565] },
]

const app = document.querySelector('#app')
let state = { started: false, ended: false, selected: null, zoomedOpinion: null, mapZoom: 1, panX: 0, panY: 0, alertVisible: false }
let transcription = { active: false, connecting: false, text: '', interim: '', error: '', socket: null, audioContext: null, stream: null, processor: null, source: null }

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
  const topic = document.querySelector('#topic')?.value || '今日の晩御飯について'
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
          <div class="canvas-heading"><div><span class="section-label">THOUGHT MAP</span><h2>みんなの意見</h2></div><span class="count-badge">9 意見</span></div>
          ${zoomedOpinion ? renderOpinionDetail(zoomedOpinion) : `<div class="thought-map" data-pan-surface><div class="map-content" data-pan-content style="--map-zoom:${state.mapZoom}; --pan-x:${state.panX}px; --pan-y:${state.panY}px">${opinions.map(renderOpinion).join('')}</div><span class="map-zoom-level">${Math.round(state.mapZoom * 100)}%</span></div>`}
          <div class="legend">${Object.values(speakers).map((speaker) => `<span><i style="background:${speaker.color}"></i>${speaker.name}</span>`).join('')}</div>
        </section>
        ${state.alertVisible ? `<div class="facilitator-alert"><span class="alert-icon">!</span><div><strong>話題の流れを確認しましょう</strong><small>まだ発言していない人にも聞いてみませんか？</small></div><button id="dismiss-alert" title="通知を閉じる">×</button></div>` : ''}
        <div class="transcript-strip" aria-live="polite"><span class="transcript-label">LIVE TRANSCRIPT</span><p>${transcription.text || transcription.interim || (transcription.error ? transcription.error : 'マイクを押すと話し合いを聞き取ります')}</p></div>
        <footer class="phone-footer"><button class="mic-button ${transcription.active ? '' : 'paused'}" id="mic-button"><span class="mic-glyph">●</span><span>${transcription.connecting ? '接続中...' : transcription.active ? '聞き取り中' : '聞き取り開始'}</span></button><span class="footer-status">00:42</span></footer>
      </section>
      <aside class="desktop-note"><span class="note-line"></span><p>マップをズームすると<br /><b>詳細な意見が見えてきます</b></p>${zoomedOpinion ? renderDetail(zoomedOpinion) : '<p class="hint">円の上でも余白でも<br />そのまま拡大・縮小できます</p>'}</aside>
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

function bindEvents() {
  bindPanGesture()
  document.querySelector('#start-button')?.addEventListener('click', () => {
    const topic = document.querySelector('#topic').value.trim()
    if (!topic) return document.querySelector('#topic').focus()
    state.started = true
    render()
    window.setTimeout(() => { state.alertVisible = true; render() }, 2500)
  })
  document.querySelector('#end-button')?.addEventListener('click', () => {
    state.ended = true
    renderSummary()
  })
  document.querySelectorAll('[data-opinion]').forEach((card) => card.addEventListener('click', () => {
    if (card.closest('[data-pan-surface]')?.dataset.dragged === 'true') {
      card.closest('[data-pan-surface]').dataset.dragged = 'false'
      return
    }
    state.selected = card.dataset.opinion
    state.zoomedOpinion = null
    render()
  }))
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
  document.querySelector('#dismiss-alert')?.addEventListener('click', () => { state.alertVisible = false; render() })
  document.querySelector('#mic-button')?.addEventListener('click', toggleTranscription)
}

async function toggleTranscription() {
  if (transcription.active || transcription.connecting) {
    stopTranscription()
    return
  }
  await startTranscription()
}

async function startTranscription() {
  transcription = { ...transcription, connecting: true, error: '' }
  render()
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
      if (payload.type === 'ready') { transcription.active = true; transcription.connecting = false; render() }
      if (payload.type === 'error') { transcription.error = payload.message; stopTranscription(false); render() }
      if (!payload.channel?.alternatives?.[0]) return
      const transcript = payload.channel.alternatives[0].transcript || ''
      if (payload.is_final) { transcription.text = `${transcription.text} ${transcript}`.trim(); transcription.interim = '' }
      else transcription.interim = transcript
      updateTranscriptOnly()
    }
    socket.onerror = () => { transcription.error = '音声中継サーバーに接続できません。npm run dev で起動してください。'; stopTranscription(false); render() }
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
    render()
  }
}

function stopTranscription(clearError = true) {
  transcription.socket?.close()
  transcription.processor?.disconnect()
  transcription.source?.disconnect()
  transcription.stream?.getTracks().forEach((track) => track.stop())
  transcription.audioContext?.close()
  transcription = { ...transcription, active: false, connecting: false, socket: null, audioContext: null, stream: null, processor: null, source: null, error: clearError ? '' : transcription.error }
}

function updateTranscriptOnly() {
  const strip = document.querySelector('.transcript-strip p')
  if (strip) strip.textContent = transcription.text || transcription.interim || '聞き取り中...'
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
  document.querySelector('#new-session').addEventListener('click', () => { state = { started: false, ended: false, selected: null, zoomedOpinion: null, mapZoom: 1, panX: 0, panY: 0, alertVisible: false }; render() })
}

render()