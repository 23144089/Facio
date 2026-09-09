# Facio

## Deepgram 音声文字起こし

1. `.env.example` を `.env` にコピーし、`DEEPGRAM_API_KEY` を設定します。
2. `npm run dev` で Vite と Deepgram 中継サーバーを起動します。
3. 議論画面の「聞き取り開始」を押し、ブラウザーのマイク使用を許可します。

APIキーはブラウザーへ渡さず、`server.mjs` が Deepgram との接続を中継します。