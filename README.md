# chromie-agent

Chrome Heartass Hub: static site (`index.html`, `css/`, `js/`), Vercel serverless Twitter proxy (`api/`), and Chromie character JSON (`characters/`).

## Run locally

- **Site:** `python3 -m http.server 8080` or `npm run site`
- **Lite chat (OpenAI + `characters/chromie.json`):** `cd chromie-lite && cp .env.example .env` → set `OPENAI_API_KEY` → `npm install && npm start`

## Deploy (Vercel)

Set `TWITTER_BEARER_TOKEN` (and optional `TWITTER_USERNAME`) in the Vercel project. See `.env.example` at the repo root.

## Full elizaOS

Not vendored here (large upstream monorepo). Clone [elizaOS/eliza](https://github.com/elizaos/eliza) elsewhere and point it at `characters/chromie.json` if you need the full agent runtime.
