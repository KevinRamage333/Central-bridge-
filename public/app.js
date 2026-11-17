import { createReport } from './report.js';

const form = document.querySelector('#review');
const manual = document.querySelector('#manual');
const task = document.querySelector('#task');
const providerList = document.querySelector('#providers');
const submit = document.querySelector('#submit');
const status = document.querySelector('#status');
const report = document.querySelector('#report');
const reportTask = document.querySelector('#report-task');
const results = document.querySelector('#results');
const reviews = new Map();
let running = false;
const selected = () => Array.from(providerList.querySelectorAll('input:checked'), input => input.value);
const currentTask = () => task.value.trim();
const updateSubmit = () => { submit.disabled = running || !selected().length || !currentTask(); };

async function loadProviders() {
  try {
    const response = await fetch('/api/providers');
    if (!response.ok) throw new Error();
    providerList.replaceChildren();
    for (const { name, configured } of await response.json()) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = name;
      input.disabled = !configured;
      label.append(input, ' ' + name + (configured ? '' : ' · setup needed'));
      providerList.append(label);
    }
  } catch {
    providerList.textContent = 'Provider configuration could not be loaded.';
  }
}

function renderReport() {
  const key = currentTask();
  const entries = reviews.get(key) ?? [];
  report.hidden = entries.length === 0;
  reportTask.textContent = key;
  results.replaceChildren();
  for (const entry of entries) {
    const card = document.createElement('article');
    const title = document.createElement('h3');
    const text = document.createElement('p');
    title.textContent = entry.provider + ' · ' + entry.channel;
    text.textContent = entry.answer ?? entry.error;
    card.append(title, text);
    results.append(card);
  }
}

function addEntries(key, entries) {
  const saved = reviews.get(key) ?? [];
  for (const entry of entries) {
    const index = saved.findIndex(item => item.channel === entry.channel && item.provider === entry.provider);
    if (index === -1) saved.push(entry);
    else saved[index] = entry;
  }
  reviews.set(key, saved);
  renderReport();
}

async function copy(text, confirmation) {
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = confirmation;
  } catch {
    status.textContent = 'Clipboard access is unavailable. Download the handoff or copy the task from its field.';
  }
}

providerList.addEventListener('change', updateSubmit);
task.addEventListener('input', () => { updateSubmit(); renderReport(); });
document.querySelector('#copy-task').addEventListener('click', () => {
  const key = currentTask();
  if (key) void copy(key, 'Task copied.');
  else status.textContent = 'Enter a task first.';
});
document.querySelector('#copy-report').addEventListener('click', () => {
  const key = currentTask();
  const entries = reviews.get(key);
  if (entries?.length) void copy(createReport(key, entries), 'Handoff copied.');
});
document.querySelector('#download-report').addEventListener('click', () => {
  const key = currentTask();
  const entries = reviews.get(key);
  if (!entries?.length) return;
  const url = URL.createObjectURL(new Blob([createReport(key, entries)], { type: 'text/markdown;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'central-bridge-handoff.md';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  status.textContent = 'Handoff downloaded.';
});

manual.addEventListener('submit', event => {
  event.preventDefault();
  const key = currentTask();
  const source = document.querySelector('#source').value;
  const reply = document.querySelector('#reply');
  const answer = reply.value.trim();
  if (!key || !answer) { status.textContent = 'Enter a task and a reply first.'; return; }
  addEntries(key, [{ provider: source, channel: 'Pasted reply', answer }]);
  reply.value = '';
  status.textContent = 'Reply added.';
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  const prompt = currentTask();
  const providers = selected();
  if (running || !prompt || !providers.length) return;
  running = true;
  updateSubmit();
  status.textContent = 'Waiting for model responses…';
  try {
    const response = await fetch('/api/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, providers }),
    });
    const data = await response.json();
    if (!response.ok) { status.textContent = data.error; return; }
    addEntries(prompt, data.map(entry => ({ ...entry, channel: 'Model API' })));
    status.textContent = currentTask() === prompt ? 'Review finished.' : 'Review finished for the task you sent. Restore that task text to see its replies.';
  } catch {
    status.textContent = 'Could not reach the bridge.';
  } finally {
    running = false;
    updateSubmit();
  }
});
void loadProviders();
