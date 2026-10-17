export const NARRATION_STORAGE_KEY = 'next-spring-narration-v1';
export const NARRATION_PREVIEW = '夜晚的灯已经亮了。今天走了很远，先在这里歇一会儿。';
export const DEFAULT_NARRATION_PREFERENCES = { voiceId: '', rate: 0.9, volume: 0.85 };

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export function normalizeNarrationPreferences(value) {
  const saved = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    voiceId: typeof saved.voiceId === 'string' && saved.voiceId.length <= 1000 ? saved.voiceId : '',
    rate: Number.isFinite(saved.rate) ? clamp(saved.rate, 0.75, 1.1) : 0.9,
    volume: Number.isFinite(saved.volume) ? clamp(saved.volume, 0, 1) : 0.85,
  };
}

export function readNarrationPreferences(storage) {
  try {
    const source = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    return normalizeNarrationPreferences(JSON.parse(source?.getItem(NARRATION_STORAGE_KEY) || 'null'));
  } catch { return { ...DEFAULT_NARRATION_PREFERENCES }; }
}

export function saveNarrationPreferences(value, storage) {
  try {
    const source = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    source?.setItem(NARRATION_STORAGE_KEY, JSON.stringify(normalizeNarrationPreferences(value)));
  } catch { /* Private browsing and exhausted storage must not interrupt the story. */ }
}

export function isChineseVoice(voice) {
  return typeof voice?.lang === 'string' && /^(zh|cmn|yue)([-_]|$)/i.test(voice.lang.trim());
}

export function narrationVoiceId(voice) {
  return `${encodeURIComponent(voice.voiceURI || voice.name || '')}|${String(voice.lang || '').toLowerCase().replaceAll('_', '-')}|${voice.localService ? 'local' : 'online'}`;
}

function voiceScore(voice) {
  const name = String(voice.name || '').toLowerCase();
  const language = String(voice.lang || '').replaceAll('_', '-').toLowerCase();
  let score = /^(zh-cn|zh-hans|cmn)(-|$)/.test(language) ? 100 : /^zh-tw/.test(language) ? 50 : 10;
  if (/xiaoxiao|晓晓/.test(name)) score += 300;
  else if (/xiaoyi|晓伊/.test(name)) score += 280;
  else if (/huihui|慧慧/.test(name)) score += 220;
  else if (/tingting|婷婷/.test(name)) score += 180;
  if (/natural|neural|premium|enhanced/.test(name)) score += 60;
  if (voice.localService) score += 15;
  if (voice.default) score += 2;
  return score;
}

export function chineseVoices(voices) {
  const found = new Map();
  for (const voice of Array.from(voices || [])) {
    if (!isChineseVoice(voice)) continue;
    const id = narrationVoiceId(voice);
    if (!found.has(id)) found.set(id, {
      id, name: voice.name || '中文声音', lang: voice.lang,
      localService: voice.localService === true, voice,
    });
  }
  return [...found.values()].sort((left, right) => voiceScore(right.voice) - voiceScore(left.voice)
    || left.name.localeCompare(right.name, 'zh-CN'));
}

// Keep utterances short enough to avoid Chrome's long-utterance stalls. Prefer
// Chinese clause boundaries and retain punctuation; Unicode characters stay intact.
export function splitNarrationText(text, maximum = 40) {
  if (typeof text !== 'string') return [];
  const characters = Array.from(text.replace(/\s+/gu, ' ').trim());
  const limit = Number.isInteger(maximum) && maximum >= 12 && maximum <= 120 ? maximum : 40;
  const chunks = [];
  let cursor = 0;
  while (cursor < characters.length) {
    let end = Math.min(characters.length, cursor + limit);
    if (end < characters.length) {
      for (let index = end - 1; index >= cursor + Math.floor(limit / 2); index -= 1) {
        if (/[，。！？；、,.!?;：:]/u.test(characters[index])) { end = index + 1; break; }
      }
    }
    const chunk = characters.slice(cursor, end).join('').trim();
    if (chunk) chunks.push(chunk);
    cursor = end;
  }
  return chunks;
}
