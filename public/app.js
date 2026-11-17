const form = document.querySelector('form');
const task = document.querySelector('#task');
const providerList = document.querySelector('#providers');
const submit = document.querySelector('#submit');
const status = document.querySelector('#status');
const results = document.querySelector('#results');
const selected = () => Array.from(providerList.querySelectorAll('input:checked'), input => input.value);

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

providerList.addEventListener('change', () => { submit.disabled = !selected().length; });
document.querySelector('#copy').addEventListener('click', async () => {
  if (!task.value.trim()) { status.textContent = 'Enter a task first.'; return; }
  try {
    await navigator.clipboard.writeText(task.value.trim());
    status.textContent = 'Task copied.';
  } catch {
    task.select();
    status.textContent = 'Task selected. Copy it from the text field.';
  }
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  const prompt = task.value.trim();
  const providers = selected();
  if (!prompt || !providers.length) { status.textContent = 'Enter a task and select providers.'; return; }
  submit.disabled = true;
  providerList.querySelectorAll('input').forEach(input => {
    if (!input.disabled) { input.dataset.running = 'true'; input.disabled = true; }
  });
  results.replaceChildren();
  status.textContent = 'Waiting for model responses…';
  try {
    const response = await fetch('/api/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, providers }),
    });
    const data = await response.json();
    if (!response.ok) { status.textContent = data.error; return; }
    for (const entry of data) {
      const card = document.createElement('article');
      const title = document.createElement('h2');
      const text = document.createElement('p');
      title.textContent = entry.provider;
      text.textContent = entry.answer ?? entry.error;
      card.append(title, text);
      results.append(card);
    }
    status.textContent = 'Review finished.';
  } catch {
    status.textContent = 'Could not reach the bridge.';
  } finally {
    providerList.querySelectorAll('[data-running]').forEach(input => {
      input.disabled = false;
      delete input.dataset.running;
    });
    submit.disabled = !selected().length;
  }
});
loadProviders();
