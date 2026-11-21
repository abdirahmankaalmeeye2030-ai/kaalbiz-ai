# KaalBiz AI

KaalBiz is a business-operations assistant for small shops, restaurants, salons, boutiques, and hardware stores in Kampala. You tell it what happened. It organizes the record and helps you see the day.

> Tell your assistant what happened in your business. It organizes the information and helps you understand your business.

Records stay in this browser (`localStorage`). There is no account, database, inventory, or WhatsApp. Money is shown as whole shillings, for example `UGX 25,000`.

## Run it locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:38471](http://localhost:38471).

```bash
npm test
npm run lint
npm run build
```

## Environment variables

Set these on the server only. Do not prefix them with `NEXT_PUBLIC_`.

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `OPENROUTER_API_KEY` | For real AI | none | Bearer token for OpenRouter. Without it, text uses a labelled rule-based parser. |
| `OPENROUTER_MODEL` | No | `x-ai/grok-4.3` | Text extraction and the daily note. |
| `OPENROUTER_VISION_MODEL` | No | `google/gemini-2.5-flash` | Receipt photos. |
| `OPENROUTER_AUDIO_MODEL` | No | `google/gemini-2.5-flash` | Voice transcription. The model must accept audio input. |
| `OPENROUTER_SITE_URL` | No | `http://localhost:38471` | Sent as the `HTTP-Referer` header. |

The app also sends `X-Title: KaalBiz AI`.

Checked against the OpenRouter model list on 21 Nov 2026:

- `x-ai/grok-4-fast` is not in the catalog. `x-ai/grok-4.3` is a current Grok model, cheaper than the flagship, and supports chat completions. `x-ai/grok-4.7` is the flagship if you want it instead.
- `google/gemini-2.5-flash` exists and accepts images. `x-ai/grok-4.7` also accepts images if you prefer one Grok model for both jobs.
- Voice uses the same Gemini model by default because it accepts audio. Checked against [OpenRouter audio](https://openrouter.ai/docs/features/multimodal/audio): chat completions takes `{ type: "input_audio", input_audio: { data, format } }` and passes through formats the model supports (`webm`, `mp4`, `ogg`, `wav`, `mp3`). The Responses API only documents `wav` and `mp3`, which a phone or laptop recorder does not produce, so transcription stays on chat completions.

The provider call lives in `src/lib/ai/provider.ts`. Change that file to point at another OpenAI-compatible API.

## What the screens do

1. **Record** — Text, voice, or a receipt photo. Voice records with the microphone for up to 2 minutes, sends the audio to `/api/transcribe`, and puts the transcript in the box for review. Nothing is saved until you tap Read this, then Confirm. Receipts are resized in the browser before upload. Take photo opens the camera. Upload from gallery / files opens the gallery or file picker.
2. **Confirm** — Each extracted record is an editable card. Low-confidence cards are highlighted. Nothing is saved until you tap Confirm.
3. **Ledger** — Confirmed records, with filters and delete confirmation.
4. **Today** — Sales, money spent, money in, money out, cash left, what customers owe, a 7-day chart, and recent records. The math is in `src/lib/calculations.ts`. The model never calculates totals.
5. **Daily note** — Pick a date. The figures are calculated first. OpenRouter may write a short note and two or three tips. Without a key, a template writes the note and says so.

`/api/health` powers the corner pill: **AI ready** when `OPENROUTER_API_KEY` is set, otherwise **Demo mode**.

## Deploy to Vercel

1. Push the repository and import it in Vercel.
2. Framework preset: Next.js. Build command: `npm run build`.
3. Add `OPENROUTER_API_KEY`, and optionally `OPENROUTER_MODEL`, `OPENROUTER_VISION_MODEL`, `OPENROUTER_AUDIO_MODEL`, and `OPENROUTER_SITE_URL` (your public URL).
4. Deploy. Records still live in each visitor's browser, not on Vercel.

## Two-minute judge demo

1. Open the app. Point at **Demo mode** in the corner if no API key is set, or **AI ready** if one is.
2. On Record, tap **Use an example** (Mama Grace, sugar, part paid) and **Read this**.
3. Show the badge: `AI extracted · …` or `Demo mode: rule-based parser, not real AI`. Show the two cards (cash and still owed) and the “Please check this one” highlight. Edit if you want, then **Confirm all**.
4. Open **Today**. Sales, money spent, cash left, and the 7-day chart should include the new records.
5. Open **Daily note**. The figures are already there. The paragraph underneath is either written by the model or marked as a template.
6. Open **Voice**. Tap to speak, then **Stop** (or wait for 2:00). The transcript fills the box. Edit it if you need to, then **Read this**. Nothing is saved until you confirm. Without `OPENROUTER_API_KEY`, the screen says transcription needs that key and does not invent words.
7. Open **Receipt**, upload any photo. Without a key, KaalBiz says the photo was not read and offers a labelled sample card. Do not confirm it unless you want the sample in the ledger.
8. Tap **Load demo data** for a week of Kampala sample records (marked Sample), then **Clear all data** when you are done.

## Known limitations

- No login. Anyone with the phone can see and clear the records. Clearing the browser storage deletes them.
- The demo parser is a keyword and amount guess. It is labelled and should be checked. It will miss messy sentences.
- Customer debt is matched by the name as written. “Mama Grace” and “Grace” are different people.
- “Cash left” is money in minus money out. It is not profit, tax, or a balance sheet. Stock you bought counts as money spent.
- Voice needs a microphone and HTTPS (localhost counts). It records audio in the browser and transcribes it with OpenRouter. Without `OPENROUTER_API_KEY` there is no transcript. Receipt reading does nothing useful without an AI key.
- Amounts are treated as UGX. The app does not convert currency.
- A failed model call falls back to the labelled parser for text, or an empty receipt result. It does not pretend the model succeeded.
