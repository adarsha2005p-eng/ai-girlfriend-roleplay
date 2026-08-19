// AI Companion — frontend logic. Streams via SSE, supports multiple
// sessions per user, an account picker, a model switcher, and export.

const AVATARS_BY_STAGE = {
  stranger: '🌱',
  acquaintance: '🙂',
  friend: '😊',
  best_friend: '🥰',
  soulmate: '💖',
};

const STORAGE = {
  userId: 'ai-companion-userId',
  profile: 'ai-companion-profile',
  currentSession: 'ai-companion-currentSession',
};

const $ = (s) => document.querySelector(s);
const chat = $('#chat');
const input = $('#input');
const send = $('#send');
const toast = $('#toast');

function showToast(msg, ms = 2400) {
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.add('hidden'), ms);
}

function getUserId() {
  let id = localStorage.getItem(STORAGE.userId);
  if (!id) {
    id = 'u_' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(STORAGE.userId, id);
  }
  return id;
}
function setUserId(id) {
  localStorage.setItem(STORAGE.userId, id);
  localStorage.removeItem(STORAGE.currentSession);
  localStorage.removeItem(STORAGE.profile);
}

function setProfileCache(p) { localStorage.setItem(STORAGE.profile, JSON.stringify(p)); }
function getProfileCache() {
  try { return JSON.parse(localStorage.getItem(STORAGE.profile) || 'null'); }
  catch { return null; }
}

function getCurrentSessionId() { return localStorage.getItem(STORAGE.currentSession) || ''; }
function setCurrentSessionId(id) {
  if (id) localStorage.setItem(STORAGE.currentSession, id);
}

// ---------- chat rendering ----------

function addMessage({ role, content, ts }) {
  const wrap = document.createElement('div');
  wrap.className = `msg ${role}`;
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = content;
  wrap.appendChild(bubble);
  if (ts) {
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    wrap.appendChild(meta);
  }
  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
  return { wrap, bubble };
}

function addSystemMessage(text) {
  const wrap = document.createElement('div');
  wrap.className = 'msg system';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;
  wrap.appendChild(bubble);
  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
}

function addTyping() {
  const wrap = document.createElement('div');
  wrap.className = 'msg assistant';
  wrap.dataset.typing = '1';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = '<span class="typing"><span></span><span></span><span></span></span>';
  wrap.appendChild(bubble);
  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
  return wrap;
}

// ---------- status & UI sync ----------

let lastStage = null;

async function refreshStatus({ announce = false } = {}) {
  const res = await fetch(`/api/status/${getUserId()}`);
  const data = await res.json();
  const s = data.stage;
  const p = data.profile;

  $('#char-name').textContent = p.character.name;
  $('#char-status').textContent = `${s.emoji} ${s.label} · ${data.totalMessages} messages`;

  const av = $('#avatar');
  if (p.character.avatar) {
    av.innerHTML = `<img src="${p.character.avatar}" alt="" onerror="this.replaceWith(document.createTextNode('${s.emoji}'))"/>`;
  } else {
    av.textContent = s.emoji;
  }

  $('#rel-emoji').textContent = s.emoji;
  $('#rel-fill').style.width = data.progress.percent + '%';
  $('#rel-next').textContent = data.progress.atMax
    ? 'Maxed 💖'
    : `${data.progress.pointsToNext} pts → ${data.progress.toNextLabel}`;

  if (announce && lastStage && lastStage !== s.id) {
    const promote = $('#rel-promote');
    promote.textContent = `✨ Your relationship just grew — you're now ${s.label} ${s.emoji}`;
    promote.classList.remove('hidden');
    setTimeout(() => promote.classList.add('hidden'), 6000);
  }
  lastStage = s.id;
  return data;
}

// ---------- sessions ----------

let sessionsCache = [];

async function loadSessions() {
  const res = await fetch(`/api/sessions/${getUserId()}`);
  const data = await res.json();
  sessionsCache = data.sessions || [];

  // Decide which session is "current": stored, otherwise the first one (newest activity)
  let current = getCurrentSessionId();
  if (!sessionsCache.find((s) => s.id === current)) {
    current = sessionsCache[0]?.id || '';
    if (current) setCurrentSessionId(current);
  }

  renderSessions(current);
  return current;
}

function renderSessions(currentId) {
  const list = $('#session-list');
  list.innerHTML = '';
  for (const s of sessionsCache) {
    const item = document.createElement('div');
    item.className = 'session-item' + (s.id === currentId ? ' active' : '');
    item.dataset.id = s.id;
    item.innerHTML = `
      <span class="session-title">${escapeHTML(s.title)}</span>
      <span class="session-meta">${s.msgCount} msgs</span>
      <div class="session-actions">
        <button class="sess-rename" title="Rename">✎</button>
        <button class="sess-export" title="Export">⤓</button>
        <button class="sess-delete danger" title="Delete">×</button>
      </div>`;
    item.onclick = (e) => {
      if (e.target.closest('.session-actions')) return;
      switchSession(s.id);
    };
    item.querySelector('.sess-rename').onclick = async (e) => {
      e.stopPropagation();
      const next = prompt('Rename session', s.title);
      if (next == null) return;
      await fetch(`/api/sessions/${getUserId()}/${s.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: next }),
      });
      await loadSessions();
    };
    item.querySelector('.sess-export').onclick = (e) => {
      e.stopPropagation();
      window.location.href = `/api/export/${getUserId()}/${s.id}`;
    };
    item.querySelector('.sess-delete').onclick = async (e) => {
      e.stopPropagation();
      if (!confirm(`Delete session "${s.title}"?`)) return;
      await fetch(`/api/sessions/${getUserId()}/${s.id}`, { method: 'DELETE' });
      await loadSessions();
      // Open the first remaining session
      const first = sessionsCache[0];
      if (first) switchSession(first.id);
      else await loadHistory();
    };
    list.appendChild(item);
  }
}

async function switchSession(id) {
  setCurrentSessionId(id);
  document.querySelectorAll('.session-item').forEach((el) =>
    el.classList.toggle('active', el.dataset.id === id));
  await loadHistory();
}

async function newSession() {
  const res = await fetch(`/api/sessions/${getUserId()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'New chat' }),
  });
  const data = await res.json();
  await loadSessions();
  switchSession(data.session.id);
}

// ---------- chat send (SSE) ----------

let sending = false;
let currentReplyBubble = null;

async function sendMessage(text) {
  if (sending || !text.trim()) return;
  sending = true;
  send.disabled = true;
  input.disabled = true;

  addMessage({ role: 'user', content: text });
  const replyPlaceholder = addTyping();
  let firstToken = true;
  let thisSessionId = getCurrentSessionId();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
      body: JSON.stringify({ userId: getUserId(), message: text, sessionId: thisSessionId }),
    });
    if (!res.ok || !res.body) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const handleEvent = async (event, data) => {
      if (event === 'meta') {
        if (data.sessionId) {
          thisSessionId = data.sessionId;
          setCurrentSessionId(data.sessionId);
        }
        if (data.sessionTitle) {
          // Refresh sidebar if title got auto-renamed
          await loadSessions();
        }
        if (data.stage) {
          $('#char-status').textContent = `${data.stage.emoji} ${data.stage.label} · …`;
        }
      } else if (event === 'token') {
        if (firstToken) {
          replyPlaceholder.remove();
          const m = addMessage({ role: 'assistant', content: '' });
          currentReplyBubble = m.bubble;
          firstToken = false;
        }
        if (currentReplyBubble) {
          currentReplyBubble.textContent += data.text;
          chat.scrollTop = chat.scrollHeight;
        }
      } else if (event === 'done') {
        if (replyPlaceholder.parentNode) replyPlaceholder.remove();
        if (!firstToken && currentReplyBubble && data.reply && data.reply.length) {
          currentReplyBubble.textContent = data.reply;
        } else if (firstToken) {
          replyPlaceholder.remove();
          addMessage({ role: 'assistant', content: data.reply || '(no reply)' });
        }
        const finalStage = await refreshStatus();
        if (data.stage && data.stage.id !== lastStage) {
          const promote = $('#rel-promote');
          promote.textContent = `✨ Your relationship just grew — you're now ${data.stage.label} ${data.stage.emoji}`;
          promote.classList.remove('hidden');
          setTimeout(() => promote.classList.add('hidden'), 6000);
        }
        if (data.factsLearned && data.factsLearned.length) {
          addSystemMessage(`📝 I remembered: ${data.factsLearned.join(' · ')}`);
        }
        await loadSessions(); // refresh msgCount
      } else if (event === 'error') {
        throw new Error(data.error || 'Unknown error');
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const parsed = parseSSE(block);
        if (parsed) await handleEvent(parsed.event, parsed.data);
      }
    }
    if (buffer.trim()) {
      const parsed = parseSSE(buffer);
      if (parsed) await handleEvent(parsed.event, parsed.data);
    }
  } catch (e) {
    if (replyPlaceholder.parentNode) replyPlaceholder.remove();
    addMessage({ role: 'assistant', content: `(${e.message})` });
  } finally {
    sending = false;
    send.disabled = false;
    input.disabled = false;
    input.focus();
    currentReplyBubble = null;
  }
}

function parseSSE(block) {
  let event = 'message';
  const dataLines = [];
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  if (!dataLines.length) return null;
  try { return { event, data: JSON.parse(dataLines.join('\n')) }; }
  catch { return { event, data: dataLines.join('\n') }; }
}

function showOnboarding() {
  const m = $('#onboarding');
  m.classList.remove('hidden');
  $('#onb-save').onclick = async () => {
    const name = $('#onb-name').value.trim();
    const cname = $('#onb-char').value.trim() || 'Aisha';
    const bio = $('#onb-bio').value.trim();
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: getUserId(),
        name: name || 'Friend',
        character: { name: cname, bio, interests: ['music', 'movies', 'minecraft', 'chai', 'late-night chats'] },
      }),
    });
    const data = await res.json();
    setProfileCache(data.profile);
    m.classList.add('hidden');
    await loadSessions();
    await loadHistory();
    await refreshStatus();
  };
}

async function loadHistory() {
  const sid = getCurrentSessionId();
  const url = sid ? `/api/messages/${getUserId()}?sessionId=${encodeURIComponent(sid)}` : `/api/messages/${getUserId()}`;
  const res = await fetch(url);
  const data = await res.json();
  chat.innerHTML = '';
  for (const m of (data.messages || [])) addMessage({ role: m.role, content: m.content, ts: m.ts });
}

// ---------- settings, accounts, models ----------

async function openSettings() {
  const profile = getProfileCache() || (await (await fetch(`/api/profile/${getUserId()}`)).json()).profile;
  setProfileCache(profile);
  $('#set-name').value = profile.name || '';
  $('#set-char-name').value = profile.character.name || '';
  $('#set-bio').value = profile.character.bio || '';
  $('#set-interests').value = (profile.character.interests || []).join(', ');
  $('#set-avatar').value = profile.character.avatar || '';

  const mem = await (await fetch(`/api/memory/${getUserId()}`)).json();
  const list = $('#mem-list');
  list.innerHTML = '';
  if (!mem.memory.facts.length) {
    list.innerHTML = '<div class="mem-empty">Nothing remembered yet — just chat naturally.</div>';
  } else {
    mem.memory.facts.forEach((f, i) => {
      const item = document.createElement('div');
      item.className = 'mem-item';
      item.innerHTML = `<span>${escapeHTML(f)}</span><button data-idx="${i}">×</button>`;
      list.appendChild(item);
    });
    list.querySelectorAll('button').forEach((b) => {
      b.onclick = async () => {
        await fetch(`/api/memory/${getUserId()}/${b.dataset.idx}`, { method: 'DELETE' });
        openSettings();
      };
    });
  }

  // Model picker (Feature 4)
  await loadModelPicker();

  // Account picker (Feature 8)
  await loadAccountPicker();

  $('#settings').classList.remove('hidden');
}

async function loadModelPicker() {
  const sel = $('#set-model');
  const info = $('#model-info');
  sel.innerHTML = '<option>Loading…</option>';
  try {
    const data = await (await fetch('/api/models')).json();
    sel.innerHTML = '';
    if (!data.available.length) {
      sel.innerHTML = `<option>no models</option>`;
      info.textContent = data.ollamaOk ? 'Ollama is running but no models are pulled yet.' : 'Ollama is offline. Run: ollama serve';
      return;
    }
    for (const m of data.available) {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      if (m === data.selected) opt.selected = true;
      sel.appendChild(opt);
    }
    info.textContent = `Selected: ${data.selected}`;
    sel.onchange = async () => {
      const m = sel.value;
      const r = await fetch('/api/models/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: m }),
      });
      const j = await r.json();
      info.textContent = `Selected: ${j.model} ✓`;
      showToast('Model switched ✓');
    };
  } catch {
    sel.innerHTML = '<option>error</option>';
    info.textContent = 'Could not reach Ollama.';
  }
}

async function loadAccountPicker() {
  const wrap = $('#account-list');
  wrap.innerHTML = '';
  try {
    const data = await (await fetch('/api/users')).json();
    data.users.forEach((u) => {
      const div = document.createElement('div');
      div.className = 'account-item' + (u.id === getUserId() ? ' active' : '');
      const av = u.avatar
        ? `<img src="${u.avatar}" onerror="this.replaceWith(document.createTextNode('${u.stage.emoji}'))"/>`
        : u.stage.emoji;
      div.innerHTML = `
        <div class="account-av">${av}</div>
        <div class="account-meta">
          <div class="account-name">${escapeHTML(u.name || '(no name)')} <span class="muted">× ${escapeHTML(u.characterName || '')}</span></div>
          <div class="muted account-sub">${u.emoji || u.stage.emoji} ${u.stage.label} · ${u.totalMessages} msgs</div>
        </div>`;
      div.onclick = async () => {
        if (u.id === getUserId()) return;
        if (!confirm(`Switch to ${u.name || u.id}?`)) return;
        setUserId(u.id);
        await boot();
        $('#settings').classList.add('hidden');
        showToast(`Switched to ${u.name || u.id}`);
      };
      wrap.appendChild(div);
    });
  } catch {}
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

$('#set-close').onclick = async () => {
  const profile = getProfileCache();
  const interests = $('#set-interests').value.split(',').map((s) => s.trim()).filter(Boolean);
  const body = {
    name: $('#set-name').value.trim() || profile.name,
    character: {
      name: $('#set-char-name').value.trim() || profile.character.name,
      bio: $('#set-bio').value.trim() || profile.character.bio,
      interests: interests.length ? interests : profile.character.interests,
      avatar: $('#set-avatar').value.trim() || null,
    },
  };
  const res = await fetch(`/api/profile/${getUserId()}/character`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body.character),
  });
  const data = await res.json();
  await fetch('/api/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: getUserId(), name: body.name, character: data.profile.character }),
  });
  setProfileCache(data.profile);
  $('#settings').classList.add('hidden');
  await refreshStatus();
  showToast('Saved ✓');
};

$('#btn-reset').onclick = async () => {
  if (!confirm('Reset the relationship and clear chat history?')) return;
  await fetch(`/api/reset/${getUserId()}`, { method: 'POST' });
  chat.innerHTML = '';
  $('#settings').classList.add('hidden');
  await refreshStatus();
  await loadSessions();
  showToast('Reset. We can start fresh 🌱');
};

$('#btn-new-session').onclick = newSession;

// ---------- input / send ----------

send.onclick = () => {
  const t = input.value;
  input.value = '';
  autoResize();
  sendMessage(t);
};
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    send.click();
  }
});
input.addEventListener('input', autoResize);
function autoResize() {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 140) + 'px';
}
$('#btn-settings').onclick = openSettings;

// Mobile sidebar toggle
$('#btn-sidebar-toggle').onclick = () => {
  document.querySelector('.sidebar').classList.toggle('open');
};

// ---------- boot ----------

async function boot() {
  const cache = getProfileCache();
  if (!cache || !cache.name || (cache.name === 'Friend' && !cache.character?.name)) {
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: getUserId() }),
    });
    const data = await res.json();
    setProfileCache(data.profile);
    if (!data.profile.name || data.profile.name === 'Friend') {
      showOnboarding();
    }
  } else {
    await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: getUserId(), name: cache.name, character: cache.character }),
    });
  }
  await loadSessions();
  await loadHistory();
  await refreshStatus();

  try {
    const h = await (await fetch('/api/health')).json();
    if (!h.ok) {
      showToast('⚠️ Ollama not reachable. Start it with: ollama serve', 6000);
    } else if (!h.ollama.available) {
      showToast(`⚠️ Model ${h.ollama.model} not found. Run: ollama pull ${h.ollama.model}`, 6000);
    }
  } catch {}
}

boot();
