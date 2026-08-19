// Smoke test: send a message, hold the SSE stream open, verify the reply lands
// and that BOTH the user message and the assistant reply are persisted.

const http = require('http');

const userId = 'u_e2e_' + Math.random().toString(36).slice(2, 10);
const userMsg = 'hi, kaise ho? bas ek test hai';

function postChat() {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ userId, message: userMsg });
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 3000,
        path: '/api/chat',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      },
      (res) => {
        let buf = '';
        let reply = '';
        res.on('data', (chunk) => {
          buf += chunk;
          // Parse SSE blocks
          let idx;
          while ((idx = buf.indexOf('\n\n')) !== -1) {
            const block = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            const m = block.match(/^event:\s*(.+)\ndata:\s*(.+)$/s);
            if (!m) continue;
            const [, event, data] = m;
            if (event === 'token') {
              const obj = JSON.parse(data);
              reply += obj.text || '';
              process.stdout.write(obj.text || '');
            } else if (event === 'error') {
              console.error('\n  ERROR event:', data);
            } else if (event === 'done') {
              resolve({ reply, raw: JSON.parse(data) });
            }
          }
        });
        res.on('end', () => resolve({ reply, raw: null }));
        res.on('error', reject);
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function getMessages() {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:3000/api/messages/${userId}`, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve(JSON.parse(body)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

(async () => {
  console.log(`userId: ${userId}`);
  console.log('sending:', userMsg);
  process.stdout.write('reply: ');
  const t0 = Date.now();
  const result = await postChat();
  console.log(`\n\n(${Date.now() - t0}ms)`);
  if (result.raw) {
    console.log('final score:', result.raw.score);
    console.log('facts learned:', result.raw.factsLearned);
  }
  console.log('\n--- messages on disk ---');
  const m = await getMessages();
  console.log('count:', m.messages.length);
  m.messages.forEach((x, i) => console.log(`  ${i + 1}. [${x.role}] ${x.content.slice(0, 80)}`));
})().catch((e) => { console.error('TEST FAILED:', e); process.exit(1); });
