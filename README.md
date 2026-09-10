# Facio

## Deepgram 音声文字起こし

1. `.env.example` を `.env` にコピーし、`DEEPGRAM_API_KEY` を設定します。
2. `npm run dev` で Vite と Deepgram 中継サーバーを起動します。
3. 議論画面の「聞き取り開始」を押し、ブラウザーのマイク使用を許可します。

APIキーはブラウザーへ渡さず、`server.mjs` が Deepgram との接続を中継します。

## OpenAI 意見分析

プロジェクト直下の `.env` にOpenAIキーを追加します。

```env
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini
```

Deepgramの確定発話が1件できるたびに、ローカルAPI `POST /api/analyze` からOpenAIへ送信します。OpenAIは次のJSONを返します。

- `summary`: 大まかな意見
- `details`: 詳細意見（最大3件）
- `keywords`: 関連キーワード
- `relatedOpinionIds`: 近い既存意見のID
- `similarity`: 既存意見との近さ（0〜1）
- `reasoning`: 判定理由

APIキーを追加した後は、実行中のサーバーを再起動してください。