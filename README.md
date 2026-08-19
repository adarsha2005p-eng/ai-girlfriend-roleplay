# AI Companion — Roleplay Chat that Grows With You

A private, local-first AI companion. The relationship starts as **Stranger**, and grows to **Soulmate** as you chat. Powered by [Ollama](https://ollama.com) (runs on your machine — no cloud, no API costs, no data leaves your computer).

## Features

- **5 progressive relationship stages** — Stranger → Acquaintance → Friend → Best Friend → Soulmate. The character’s tone, warmth, and memory all shift as you grow closer.
- **Multilingual** — auto-mirrors English, Hindi, or Hinglish from your messages.
- **Persistent memory** — the character remembers small things you share and brings them up later.
- **Streaming responses** (SSE) — replies appear token-by-token, no waiting.
- **Custom character** — change name, bio, interests, or set your own avatar URL.
- **Memory panel** — see and delete what the AI remembers about you.
- **Local & private** — runs entirely on your machine.

## The Persona

The default character **Lasya** is built to chat like a real person texting, not a chatbot. Concretely:

- **Short replies** by default (1–3 sentences), longer only when the moment calls for it
- **Hinglish-first** — natural mix of English and Hindi in Roman script, mirroring the user
- **Casual register** — uses fillers like *yaar, acha, haan, uff, arre, sunao* naturally
- **Light teasing & playful** — *same*, *uff*, 😂, 😌😂 show up the way friends actually talk
- **Emotion-aware** — gentle when you're down, playful when you're up
- **No robotic replies** — never uses "As an AI", never gives 5-bullet lists when you're venting
- **Doesn't ask a question after every message** — conversations flow, not interview
- **Handles typos, lowercase, abbreviations** — real chat is messy
- **Deflects inappropriate topics naturally** — like a real friend, not a corporate safety filter
- **Remembers small things** — references what you've shared before

## Relationship Stages

| Stage | Score | Behavior |
|---|---|---|
| 🌱 Stranger | 0–19 | Polite, reserved, getting to know you |
| 🙂 Acquaintance | 20–39 | Friendly, casual, light humor |
| 😊 Friend | 40–64 | Warm, supportive, comfortable |
| 🥰 Best Friend | 65–84 | Playful, caring, protective |
| 💖 Soulmate | 85–100 | Deeply affectionate, devoted, intimate |

You earn points by chatting, sharing feelings, asking questions, or being kind. Rude one-word replies cost a little. The character never sees the number — it just feels right as you grow.

## Setup (Windows)

### 1. Install Node.js
Download and install LTS from https://nodejs.org (v18+).

### 2. Install Ollama
Download from https://ollama.com/download and install. After install, open a terminal and run:

```powershell
ollama serve
```

Leave that terminal open. In a **new** terminal, pull a model:

```powershell
# Recommended — strong Hinglish/Hindi + English
ollama pull qwen2.5:7b

# Or English-strong alternative
ollama pull llama3.1:8b
```

The first pull is several GB. After that, the model is cached locally.

### 3. Start the app

In the project folder, double-click **`start.bat`**, or:

```powershell
cd "C:\Users\Adarsha Pradhan\ai-girlfriend-roleplay"
copy .env.example .env
npm install
node server.js
```

Then open **http://localhost:3000** in your browser.

## Setup (macOS / Linux)

```bash
cd ai-girlfriend-roleplay
cp .env.example .env
npm install
# in another terminal:
ollama serve &
# pull a model
ollama pull qwen2.5:7b
# start the app
node server.js
```

Open http://localhost:3000.

## Configuration

Edit `.env`:

```
OLLAMA_HOST=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:7b
PORT=3000
DATA_DIR=./data
```

### Recommended models

| Model | Size | Strengths |
|---|---|---|
| `qwen2.5:7b` | ~4.4 GB | Best Hinglish/Hindi + English (default) |
| `llama3.1:8b` | ~4.7 GB | Strong English, decent multilingual |
| `gemma2:9b` | ~5.4 GB | Very natural conversation |
| `mistral:7b` | ~4.1 GB | Fast, good general quality |
| `phi3:medium` | ~7.9 GB | Lightweight, surprisingly good |

If you have a beefy GPU (12 GB+ VRAM), try the larger variants (`qwen2.5:14b`, `llama3.1:70b`).

## API

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/health` | GET | Ollama + model availability |
| `/api/profile` | POST | Create/update profile `{id, name, character}` |
| `/api/profile/:id` | GET | Get profile |
| `/api/profile/:id/character` | PUT | Update character (name/bio/interests/avatar) |
| `/api/status/:id` | GET | Relationship stage + progress |
| `/api/messages/:id` | GET | Chat history |
| `/api/memory/:id` | GET | Memory facts |
| `/api/memory/:id/:idx` | DELETE | Delete one fact |
| `/api/reset/:id` | POST | Reset relationship + history |
| `/api/chat` | POST | Send message, **streams SSE reply** |

## SSE Event Format

`/api/chat` returns these events:

```
event: meta
data: {"scoreUpdate":{"score":22,"delta":2,"type":"small_talk"},"promoted":true,"stage":{...}}

event: token
data: {"text":"Hey"}

event: token
data: {"text":" there"}

event: done
data: {"reply":"Hey there! ...","score":22,"stage":{...},"factsLearned":["my name is Arjun"]}
```

## How Relationship Scoring Works

Each user message is classified by a lightweight heuristic (length, questions, feelings, rude words, etc.) and awarded points. Stage transitions are one-way — you keep every stage you earn. The character **never sees the number**, only the stage description, so its behavior evolves naturally.

## Where Data Lives

- `data/<userId>/profile.json` — your profile
- `data/<userId>/messages.json` — last 500 messages
- `data/<userId>/memory.json` — facts the AI has remembered

Delete the `data/` folder to wipe everything.

## Troubleshooting

**"Ollama not reachable"** — make sure `ollama serve` is running in another terminal, and that `OLLAMA_HOST` in `.env` matches.

**"Model not found"** — run `ollama pull <model>`. The model name in `.env` must match exactly.

**Slow first reply** — Ollama loads the model into memory on first use. Subsequent replies are fast.

**Empty / weird replies** — try a larger or different model. `qwen2.5:7b` is the most reliable default.

**Reset everything** — Settings → Danger zone → Reset, or delete the `data/` folder.

## Privacy

Everything runs locally. Messages, memory, and profile data stay on your machine. The AI model also runs locally via Ollama — nothing is sent to any cloud service.

## License

MIT
