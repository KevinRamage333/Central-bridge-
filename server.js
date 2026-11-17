import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const models = {
  Grok: process.env.GROK_MODEL,
  Claude: process.env.CLAUDE_MODEL,
  Gemini: process.env.GEMINI_MODEL,
  OpenAI: process.env.OPENAI_MODEL,
};
const assets = new Map([
  ['/', ['index.html', 'text/html']],
  ['/app.js', ['app.js', 'text/javascript']],
  ['/style.css', ['style.css', 'text/css']],
]);
const key = process.env.AI_GATEWAY_API_KEY;
const port = Number(process.env.PORT || 3030);
const origin = 'http://127.0.0.1:' + port;

function json(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(value));
}

async function runModel(provider, prompt) {
  try {
    const upstream = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: models[provider], messages: [{ role: 'user', content: prompt }], max_tokens: 600,
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!upstream.ok) return { provider, error: 'Gateway request failed (HTTP ' + upstream.status + ').' };
    const body = await upstream.json();
    const answer = body.choices?.[0]?.message?.content;
    return typeof answer === 'string' && answer.trim()
      ? { provider, answer }
      : { provider, error: 'The model returned no text.' };
  } catch {
    return { provider, error: 'The gateway request failed or timed out.' };
  }
}

let busy = false;
const server = createServer(async (request, response) => {
  const { pathname } = new URL(request.url, origin);
  if (request.headers.host !== new URL(origin).host) return json(response, 403, { error: 'Unexpected host.' });
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none'; base-uri 'none'");
  try {
    if (request.method === 'GET' && assets.has(pathname)) {
      const [file, type] = assets.get(pathname);
      response.writeHead(200, { 'Content-Type': type + '; charset=utf-8' });
      return response.end(await readFile(new URL('./public/' + file, import.meta.url)));
    }
    if (request.method === 'GET' && pathname === '/api/providers') {
      return json(response, 200, Object.keys(models).map(name => ({ name, configured: Boolean(key && models[name]) })));
    }
    if (request.method !== 'POST' || pathname !== '/api/review') return json(response, 404, { error: 'Route not found.' });
    if (request.headers.origin !== origin || request.headers['content-type'] !== 'application/json') {
      return json(response, 403, { error: 'Only requests from the local app are accepted.' });
    }
    if (busy) return json(response, 429, { error: 'A review is already running.' });
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 64_000) return json(response, 413, { error: 'Request is too large.' });
      chunks.push(chunk);
    }
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { return json(response, 400, { error: 'Invalid JSON.' }); }
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
    const providers = Array.isArray(body?.providers) ? [...new Set(body.providers)] : [];
    if (!prompt || prompt.length > 12_000 || !providers.length ||
        providers.some(name => typeof name !== 'string' || !Object.hasOwn(models, name))) {
      return json(response, 400, { error: 'Enter a task of up to 12,000 characters and select valid providers.' });
    }
    if (!key || providers.some(name => !models[name])) {
      return json(response, 503, { error: 'Configure the gateway key and selected models first.' });
    }
    if (busy) return json(response, 429, { error: 'A review is already running.' });
    busy = true;
    try { return json(response, 200, await Promise.all(providers.map(name => runModel(name, prompt)))); }
    finally { busy = false; }
  } catch {
    if (!response.headersSent) json(response, 500, { error: 'The bridge could not complete the request.' });
    else response.end();
  }
});
server.listen(port, '127.0.0.1', () => console.log('Cletus AI Bridge: ' + origin));
