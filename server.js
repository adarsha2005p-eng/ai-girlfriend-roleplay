// AI Companion — Express server.
// Routes: profile, status, chat (SSE streaming), messages, memory, settings.

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const ollama = require('./ollama');
const storage = require('./storage');
const rel = require('./relationship');
const prompts = require('./prompts');

const app = express();
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept'],
}));
app.options('*', cors());
app.use(express.json({ limit: '1mb' }));

const DATA_DIR = process.env.DATA_DIR || './data';
storage.setDataDir(DATA_DIR);
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

app.use(express.static(path.join(__dirname, 'public')));

// ---------- helpers ----------

function getOrCreateProfile(userId) {
  let profile = storage.getProfile(userId);
  if (!profile) {
    profile = {
      id: userId,
      name: 'Friend',
      character: {
        name: 'Lasya',
        bio: "A kind, fun, slightly mischievous young woman. Loves music, late-night chats, games (especially Minecraft), memes, chai, and noticing the small things about people. Warm, easy to talk to, and a little playful.",
        interests: ['music', 'movies', 'minecraft', 'coding', 'late-night chats', 'memes', 'chai', 'starry skies'],
        avatar: null,
      },
      relationshipScore: 0,
      totalMessages: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    storage.saveProfile(userId, profile);
  }
  return profile;
}

// Extract memorable facts using the local LLM itself.
async function extractFactsWithModel(userText, assistantText) {
  if (!userText || userText.trim().length < 5) return [];

  const extractionPrompt = `You are a memory extraction assistant.
Extract 1 to 3 concise, permanent personal facts about the user from this conversation turn (e.g., likes, dislikes, job, location, pets, relationships, habits, personality traits).
- Do NOT extract transient statements (e.g., "I'm going to sleep now", "I said hello").
- Do NOT extract facts about the assistant.
- If no meaningful personal user facts were mentioned, return an empty JSON array [].
- Output MUST be valid JSON array of strings only.

User said: "${userText}"
Assistant replied: "${assistantText}"

JSON Output:`;

  try {
    const raw = await ollama.chatOnce({
      messages: [{ role: 'user', content: extractionPrompt }],
      temperature: 0.1,
      format: 'json',
    });

    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((f) => String(f).trim())
        .filter((f) => f.length > 3 && f.length < 150);
    }
    return [];
  } catch (err) {
    console.warn('[memory] extraction skipped:', err.message);
    return [];
  }
}

// ---------- routes ----------

// Health / readiness
app.get('/api/health', async (req, res) => {
  const p = await ollama.ping();
  res.json({
    ok: p.ok,
    ollama: p,
    server: { time: new Date().toISOString(), dataDir: DATA_DIR },
  });
});

// Create or fetch profile
app.post('/api/profile', (req, res) => {
  const { id, name, character } = req.body || {};
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'id is required' });
  const profile = getOrCreateProfile(String(id).slice(0, 64));
  if (name && typeof name === 'string') profile.name = name.slice(0, 40);
  if (character && typeof character === 'object') {
    profile.character = {
      ...profile.character,
      ...character,
      name: (character.name || profile.character.name || 'Lasya').slice(0, 40),
    };
  }
  storage.saveProfile(profile.id, profile);
  res.json({ profile });
});

app.get('/api/profile/:id', (req, res) => {
  const profile = getOrCreateProfile(req.params.id);
  res.json({ profile });
});

// Update character settings (name, bio, interests, avatar URL)
app.put('/api/profile/:id/character', (req, res) => {
  const profile = getOrCreateProfile(req.params.id);
  const c = req.body || {};
  profile.character = {
    ...profile.character,
    name: (c.name || profile.character.name || 'Lasya').slice(0, 40),
    bio: (c.bio || profile.character.bio || '').slice(0, 500),
    interests: Array.isArray(c.interests) ? c.interests.slice(0, 12).map(String) : profile.character.interests,
    avatar: c.avatar ? String(c.avatar).slice(0, 500) : null,
  };
  storage.saveProfile(profile.id, profile);
  res.json({ profile });
});

// Status (relationship, etc.)
app.get('/api/status/:id', (req, res) => {
  const profile = getOrCreateProfile(req.params.id);
  const stage = rel.getStage(profile.relationshipScore);
  const progress = rel.progressToNext(profile.relationshipScore);
  const next = rel.nextStage(profile.relationshipScore);
  const memory = storage.getMemory(profile.id);
  res.json({
    profile,
    stage: {
      id: stage.id,
      label: stage.label,
      emoji: stage.emoji,
      score: stage.score,
      avatarMood: stage.avatarMood,
    },
    progress: {
      percent: progress.percent,
      atMax: progress.atMax,
      toNextLabel: next ? next.label : null,
      pointsToNext: next ? Math.max(0, next.min - stage.score) : 0,
    },
    memoryCount: memory.facts.length,
    totalMessages: profile.totalMessages || 0,
  });
});

// Reset relationship
app.post('/api/reset/:id', (req, res) => {
  const profile = getOrCreateProfile(req.params.id);
  profile.relationshipScore = 0;
  profile.totalMessages = 0;
  storage.saveProfile(profile.id, profile);
  const sessions = storage.listSessions(profile.id);
  for (const s of sessions) storage.deleteSession(profile.id, s.id);
  storage.clearMemory(profile.id);
  res.json({ ok: true });
});

// ---------- sessions API ----------

app.get('/api/sessions/:id', (req, res) => {
  getOrCreateProfile(req.params.id);
  let sessions = storage.listSessions(req.params.id);
  if (!sessions.length) {
    const first = storage.createSession(req.params.id, { title: 'New chat' });
    sessions = [first];
  }
  res.json({ sessions, currentSessionId: req.query.sessionId || sessions[0].id });
});

app.post('/api/sessions/:id', (req, res) => {
  getOrCreateProfile(req.params.id);
  const { title } = req.body || {};
  const session = storage.createSession(req.params.id, { title });
  res.json({ session });
});

app.put('/api/sessions/:id/:sid', (req, res) => {
  const { title } = req.body || {};
  const session = storage.renameSession(req.params.id, req.params.sid, title);
  if (!session) return res.status(404).json({ error: 'not found' });
  res.json({ session });
});

app.delete('/api/sessions/:id/:sid', (req, res) => {
  storage.migrateLegacy(req.params.id);
  const ok = storage.deleteSession(req.params.id, req.params.sid);
  if (!ok) return res.status(404).json({ error: 'not found' });
  let remaining = storage.listSessions(req.params.id);
  if (!remaining.length) {
    const fresh = storage.createSession(req.params.id, { title: 'New chat' });
    remaining = [fresh];
  }
  res.json({ ok: true, sessions: remaining });
});

// Messages history
app.get('/api/messages/:id', (req, res) => {
  const sessionId = req.query.sessionId;
  const list = storage.getMessages(req.params.id, sessionId);
  res.json({ messages: list });
});

// Memory list
app.get('/api/memory/:id', (req, res) => {
  const memory = storage.getMemory(req.params.id);
  res.json({ memory });
});

// Delete memory fact
app.delete('/api/memory/:id/:idx', (req, res) => {
  const idx = Number(req.params.idx);
  const mem = storage.getMemory(req.params.id);
  if (Number.isInteger(idx) && idx >= 0 && idx < mem.facts.length) {
    mem.facts.splice(idx, 1);
    const file = path.join(DATA_DIR, req.params.id, 'memory.json');
    fs.writeFileSync(file, JSON.stringify(mem, null, 2), 'utf8');
  }
  res.json({ memory: mem });
});

// Export session
app.get('/api/export/:id/:sid', (req, res) => {
  const session = storage.getSession(req.params.id, req.params.sid);
  if (!session) return res.status(404).json({ error: 'not found' });
  const messages = storage.getMessages(req.params.id, req.params.sid);
  const profile = storage.getProfile(req.params.id);
  const lines = [];
  lines.push(`# ${profile?.name || 'User'} × ${profile?.character?.name || 'AI'}`);
  lines.push(`# Session: ${session.title}`);
  lines.push(`# Exported: ${new Date().toISOString()}`);
  lines.push('');
  for (const m of messages) {
    const who = m.role === 'user' ? (profile?.name || 'You') : (profile?.character?.name || 'AI');
    lines.push(`[${new Date(m.ts).toLocaleString()}] ${who}:`);
    lines.push(m.content);
    lines.push('');
  }
  const text = lines.join('\n');
  const safe = session.title.replace(/[^a-z0-9-_]+/gi, '_').slice(0, 40);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="chat_${safe}.txt"`);
  res.send(text);
});

// Chat endpoint (SSE stream)
app.post('/api/chat', async (req, res) => {
  const { userId, message, sessionId: requestedSessionId } = req.body || {};
  if (!userId || !message) return res.status(400).json({ error: 'userId and message required' });

  const profile = getOrCreateProfile(userId);

  let sessionId = requestedSessionId;
  if (!sessionId || !storage.getSession(profile.id, sessionId)) {
    let sessions = storage.listSessions(profile.id);
    if (!sessions.length) sessions = [storage.createSession(profile.id, { title: 'New chat' })];
    sessionId = sessions[0].id;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const send = (event, data) => {
    if (!res.writableEnded) {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };

  try {
    const before = profile.relationshipScore;
    const scoreUpdate = rel.applyPoints(profile.relationshipScore, message);
    profile.relationshipScore = scoreUpdate.score;
    profile.totalMessages = (profile.totalMessages || 0) + 1;

    const beforeStage = rel.getStage(before).id;
    const afterStage = rel.getStage(profile.relationshipScore).id;
    const promoted = beforeStage !== afterStage;

    storage.saveProfile(profile.id, profile);
    storage.appendMessage(profile.id, sessionId, { role: 'user', content: message });

    const sessionMeta = storage.getSession(profile.id, sessionId);
    if (sessionMeta && sessionMeta.msgCount <= 1 && /^new chat$/i.test(sessionMeta.title)) {
      const guess = message.replace(/\s+/g, ' ').trim().slice(0, 40);
      storage.renameSession(profile.id, sessionId, guess || 'New chat');
    }

    const memory = storage.getMemory(profile.id);
    const stage = rel.getStage(profile.relationshipScore);

    const systemPrompt = prompts.buildSystemPrompt({
      character: profile.character,
      stage,
      userName: profile.name,
      memory: memory.facts,
      language: 'auto',
      sessionTitle: sessionMeta?.title,
    });

    const history = storage.getMessages(profile.id, sessionId).slice(0, -1);
    const messages = prompts.buildMessages(systemPrompt, history, message);

    const currentModelName = ollama.MODEL || ollama.getModel() || 'qwen2.5:1.5b';
    console.log(`[chat] start (userId=${profile.id}, session=${sessionId}, model=${currentModelName}, msgs=${messages.length})`);

    send('meta', {
      scoreUpdate,
      promoted,
      sessionId,
      sessionTitle: storage.getSession(profile.id, sessionId)?.title,
      stage: { id: stage.id, label: stage.label, emoji: stage.emoji, score: stage.score },
    });

    let fullReply = '';
    try {
      fullReply = await ollama.chatStream({
        messages,
        temperature: 0.85,
        onToken: (token) => send('token', { text: token }),
      });
      console.log(`[chat] done (userId=${profile.id}, replyLen=${fullReply.length})`);
    } catch (e) {
      console.error(`[chat] error (userId=${profile.id}): ${e.message}`);
      send('error', { error: e.message });
      return res.end();
    }

    storage.appendMessage(profile.id, sessionId, { role: 'assistant', content: fullReply });

    // Extract facts asynchronously with the model
    const facts = await extractFactsWithModel(message, fullReply);
    for (const f of facts) {
      storage.addMemory(profile.id, f);
    }

    send('done', {
      reply: fullReply,
      score: profile.relationshipScore,
      stage: { id: stage.id, label: stage.label, emoji: stage.emoji, score: stage.score },
      sessionId,
      sessionTitle: storage.getSession(profile.id, sessionId)?.title,
      factsLearned: facts,
    });
    res.end();
  } catch (e) {
    console.error('[chat] fatal outer error:', e.message);
    try { send('error', { error: e.message }); } catch {}
    res.end();
  }
});

// Model list & switch
app.get('/api/models', async (req, res) => {
  const p = await ollama.ping();
  res.json({
    selected: p.model,
    available: p.models || [],
    ollamaOk: p.ok,
  });
});

app.post('/api/models/select', async (req, res) => {
  const { model } = req.body || {};
  if (!model) return res.status(400).json({ error: 'model required' });
  ollama.setModel(model);
  try {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      let s = fs.readFileSync(envPath, 'utf8');
      if (/^OLLAMA_MODEL=.*$/m.test(s)) s = s.replace(/^OLLAMA_MODEL=.*$/m, `OLLAMA_MODEL=${model}`);
      else s += `\nOLLAMA_MODEL=${model}\n`;
      fs.writeFileSync(envPath, s, 'utf8');
    }
  } catch {}
  res.json({ ok: true, model });
});

// Users list
app.get('/api/users', (req, res) => {
  const users = storage.listUsers().map((id) => {
    const p = storage.getProfile(id);
    return {
      id,
      name: p?.name || null,
      characterName: p?.character?.name || null,
      totalMessages: p?.totalMessages || 0,
      relationshipScore: p?.relationshipScore || 0,
      avatar: p?.character?.avatar || null,
      stage: rel.getStage(p?.relationshipScore || 0),
    };
  });
  res.json({ users });
});

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
const currentModel = process.env.OLLAMA_MODEL || ollama.getModel() || 'qwen2.5:1.5b';

app.listen(PORT, () => {
  console.log(`\n  AI Companion running at http://localhost:${PORT}`);
  console.log(`  Ollama: ${process.env.OLLAMA_HOST || 'http://127.0.0.1:11434'}`);
  console.log(`  Model:  ${currentModel}`);
  console.log(`  Data:   ${path.resolve(DATA_DIR)}\n`);

  console.log('  Preloading model into VRAM (one-time, ~10–30s)...');
  ollama.chatOnce({
    messages: [{ role: 'user', content: 'hi' }],
    temperature: 0,
  })
    .then(() => console.log('  ✓ Model preloaded.\n'))
    .catch((e) => console.log(`  ! Model preload failed: ${e.message}\n`));
});