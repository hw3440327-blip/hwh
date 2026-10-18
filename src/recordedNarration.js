export const RECORDED_PREVIEW_KEY = 'preview:default';

// Canonical Unicode and line endings only. Names, punctuation and meaningful
// spaces are never removed or replaced to make a different recording match.
export function normalizeNarrationText(value) {
  return typeof value === 'string' ? value.normalize('NFC').replace(/\r\n?/g, '\n') : '';
}

export function normalizeNarrationKey(value) {
  if (typeof value !== 'string') return '';
  const key = value.trim();
  if (key === RECORDED_PREVIEW_KEY) return key;
  const story = key.match(/^story:([a-z][a-z0-9_]*):(\d{1,3})$/);
  if (story) return `story:${story[1]}:${Number(story[2])}`;
  if (/^detail:[a-z][a-z0-9_]*:[a-z][a-z0-9-]*$/.test(key)) return key;
  return '';
}

export function findRecordedNarrationEntry(manifest, utteranceKey, text) {
  const key = normalizeNarrationKey(utteranceKey);
  const exactText = normalizeNarrationText(text);
  if (!key || !exactText || /\{name\}/.test(exactText) || !Array.isArray(manifest?.entries)) return null;
  return manifest.entries.find((entry) => entry?.key === key
    && normalizeNarrationText(entry.text) === exactText
    && Array.isArray(entry.clipIds) && entry.clipIds.length > 0) ?? null;
}

// The inventory deliberately has no src URLs. It becomes playable only after
// actual generated files have been added to a manifest. A full detail binding
// resolves to two clips whose source text must join to the exact displayed text.
export function lookupRecordedNarration(manifest, utteranceKey, text) {
  const entry = findRecordedNarrationEntry(manifest, utteranceKey, text);
  if (!entry || !Array.isArray(manifest?.clips)) return null;
  const byId = new Map(manifest.clips.filter((clip) => typeof clip?.id === 'string').map((clip) => [clip.id, clip]));
  const queue = entry.clipIds.map((id) => byId.get(id));
  if (queue.some((clip) => !clip || typeof clip.src !== 'string' || !clip.src.trim()
    || !normalizeNarrationText(clip.text))) return null;
  const joined = queue.map((clip) => normalizeNarrationText(clip.text)).join('');
  if (joined !== normalizeNarrationText(entry.text)) return null;
  return { ...entry, queue };
}
