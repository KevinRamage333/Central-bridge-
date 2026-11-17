export function createReport(task, entries) {
  const parts = ['# Central Bridge handoff', '## Task', task, '## Replies'];
  for (const entry of entries) {
    parts.push('### ' + entry.provider + ' (' + entry.channel + ')');
    parts.push(entry.error ? 'Request failed: ' + entry.error : entry.answer);
  }
  return parts.join('\n\n') + '\n';
}
