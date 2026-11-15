# Humanizer

A web app that rewrites AI-sounding text so it reads like a person wrote it, without changing what it says.

- **Rules:** the [blader/humanizer](https://github.com/blader/humanizer) skill (MIT), vendored in `skills/humanizer/SKILL.md` and sent to the model as its system instruction. It's based on Wikipedia's *Signs of AI writing*.
- **Model:** Gemini (`gemini-4-hydrogen` by default) via the Interactions API, streamed to the browser.
- **Deep pass:** optional second pass that audits the draft for remaining tells and checks facts against the original.
- **Tell scanner:** client-side highlighter that flags patterns from the rulebook (stock AI words, not-X-but-Y, dashes, chatbot residue, uniform sentence length…) and scores before/after.
- **Voice sample:** paste your own writing and the rewrite matches it.
- **Access:** single shared password (`APP_PASSWORD`), httpOnly session cookie, per-IP rate limits.

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `GEMINI_API_KEY` | yes | From Google AI Studio |
| `APP_PASSWORD` | yes | Shared password for the site |
| `SESSION_SECRET` | recommended | Random string used to sign the session cookie |
| `GEMINI_MODEL` | no | Defaults to `gemini-4-hydrogen` |
| `MAX_CHARS` | no | Max input length, default 15000 |
| `RATE_LIMIT_PER_MIN` | no | Rewrites per IP per minute, default 15 |
| `NODE_ENV` | no | Set to `production` for secure cookies |

## Run locally

```bash
npm install
GEMINI_API_KEY=... APP_PASSWORD=... npm start
# open http://localhost:3000
```

To update the rules, replace `skills/humanizer/SKILL.md` with the latest version from GitHub.
