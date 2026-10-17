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
  return [...found.values()].sort((left, right) => Number(right.localService) - Number(left.localService)
    || voiceScore(right.voice) - voiceScore(left.voice)
    || left.name.localeCompare(right.name, 'zh-CN'));
}

export function chooseNarrationVoice(voices, preferredId = '') {
  return voices.find((voice) => voice.id === preferredId)
    ?? voices.find((voice) => voice.localService === true) ?? voices[0] ?? null;
}

export function narrationStartTimeout(voice) {
  return voice?.localService === true ? 8000 : 15000;
}

// The browser reports these codes; an installed/listed voice is not proof that
// its OS or online synthesis service can actually play audio on this device.
export function narrationFailure(code, voice) {
  if (code === 'interrupted' || code === 'canceled') return null;
  const local = voice?.localService === true;
  const messages = {
    network: local
      ? '浏览器报告语音网络错误，这个声音暂时未能播放。可以重试或更换中文声音。'
      : '浏览器未能播放该联网音色，可能语音服务连接失败。可以重试，或改用本机中文声音。',
    'not-allowed': '浏览器没有允许这次朗读。请直接点击“试听”或“重听”再试；如果仍不能播放，可改用另一种中文声音。',
    'audio-busy': '设备的语音通道正忙，可能正被其他页面或应用使用。请暂停其他朗读后再试。',
    'audio-hardware': '浏览器无法使用音频输出设备。请检查系统声音输出和耳机、扬声器连接后重试。',
    'voice-unavailable': '这个中文音色当前不可用。可以选择另一种声音，或尝试本机中文声音。',
    'language-unavailable': '系统暂时不能用这个音色朗读中文。请添加中文语音，或选择另一种中文声音。',
    'synthesis-unavailable': '系统的语音合成服务暂时不可用。请稍后重试，或选择另一种中文声音。',
    'synthesis-failed': '浏览器的语音合成未能完成，原因尚不明确。可以重听，或更换中文声音。',
    'start-timeout': local
      ? '本机中文声音未能及时启动。请点击“重听”，或检查系统中文语音是否已安装。'
      : '联网中文声音等待后仍未启动，可能是语音服务连接较慢或不可用。可以重试，或改用本机中文声音。',
    'not-started': local
      ? '该音色没有开始播放，浏览器也没有说明具体原因。可以重试，或更换中文声音。'
      : '该音色没有开始播放，浏览器也没有说明具体原因。可以重试，或切换为本机中文声音。',
    stalled: '朗读没有继续完成。可以重听这一段，或更换中文声音。',
    unsupported: '当前浏览器不支持系统朗读，可以继续安静阅读。',
    'no-chinese-voice': '这台设备还没有可用的中文声音。请在系统里添加中文语音，或换用带中文朗读的浏览器。',
    'no-local-voice': '这台设备还没有可用的本机中文声音。可以在系统语音设置里安装中文语音包，安装后重新打开页面；也可以继续阅读文字。',
    unknown: '这个中文声音未能播放，浏览器没有说明具体原因。可以重试，或更换中文声音。',
  };
  const recognized = Object.hasOwn(messages, code) ? code : 'unknown';
  return {
    code: recognized,
    message: messages[recognized],
    voiceId: voice?.id ?? '',
    voiceName: voice?.name ?? '',
    localService: voice ? local : null,
  };
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
