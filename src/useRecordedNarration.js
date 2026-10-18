import { useCallback, useEffect, useRef, useState } from 'react';
import { NARRATION_PREVIEW } from './narration.js';
import { lookupRecordedNarration, RECORDED_PREVIEW_KEY } from './recordedNarration.js';
import { NARRATION_MANIFEST as MANIFEST } from './narrationClips.js';

export const RECORDED_NARRATION_VOICE = {
  id: 'spring-recorded-v1', name: '春语 · 温柔女声', lang: 'zh-CN',
  kind: 'recorded', localService: true,
};

const PREFERENCE_KEY = 'next-spring-recorded-narration-v1';
const DEFAULTS = { rate: 1, volume: 0.9 };
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function readPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFERENCE_KEY) || 'null');
    return {
      rate: Number.isFinite(saved?.rate) ? clamp(saved.rate, 0.75, 1.1) : DEFAULTS.rate,
      volume: Number.isFinite(saved?.volume) ? clamp(saved.volume, 0, 1) : DEFAULTS.volume,
    };
  } catch { return { ...DEFAULTS }; }
}

function savePreferences(preferences) {
  try { localStorage.setItem(PREFERENCE_KEY, JSON.stringify(preferences)); }
  catch { /* Playback is independent of preference storage. */ }
}

function failureDetails(code) {
  const messages = {
    unsupported: '当前浏览器暂不能播放内置旁白，可以换用系统中文声音，或继续阅读文字。',
    'recording-missing': '这一段暂时没有完全匹配的内置旁白。为避免读错故事，这次没有播放；可以手动选择系统中文声音。',
    'not-allowed': '浏览器尚未允许这次旁白。请直接点击“试听”或“重听”再试。',
    'load-timeout': '这一段内置旁白等待后仍未加载完成。可以点击“重听”，或手动更换声音。',
    network: '这一段内置旁白文件没有加载成功。请确认游戏文件完整，再点击“重听”；也可以手动更换声音。',
    decode: '浏览器没有成功解码这一段旁白。可以重听，或手动选择系统中文声音。',
    format: '浏览器暂不能播放这段音频格式。可以手动选择系统中文声音。',
    stalled: '这一段旁白没有继续播放完成。可以点击“重听”，故事会等你。',
    unknown: '这一段内置旁白暂时没有成功播放。可以点击“重听”，或手动选择系统中文声音。',
  };
  const known = Object.hasOwn(messages, code) ? code : 'unknown';
  return {
    code: known, message: messages[known], voiceId: RECORDED_NARRATION_VOICE.id,
    voiceName: RECORDED_NARRATION_VOICE.name, localService: true, kind: 'recorded',
  };
}

function mediaErrorCode(error) {
  if (error?.name === 'NotAllowedError') return 'not-allowed';
  if (error?.name === 'NotSupportedError') return 'format';
  if (error?.code === 2) return 'network';
  if (error?.code === 3) return 'decode';
  if (error?.code === 4) return 'format';
  return 'unknown';
}

export default function useRecordedNarration({
  text = '', utteranceKey = '', paused = false, onError, onEnd,
} = {}) {
  const supported = typeof window !== 'undefined' && typeof window.Audio === 'function';
  const [preferences, updatePreferences] = useState(readPreferences);
  const [enabled, updateEnabled] = useState(false);
  const [speaking, updateSpeaking] = useState(false);
  const [status, updateStatus] = useState(supported ? 'off' : 'unsupported');
  const [lastError, updateLastError] = useState(null);
  const [voiceHealth, updateVoiceHealth] = useState({});
  const mountedRef = useRef(true);
  const enabledRef = useRef(false);
  const preferencesRef = useRef(preferences);
  const inputsRef = useRef({ text, utteranceKey, paused, onError, onEnd });
  const audioRef = useRef(null);
  const manualStopRef = useRef(false);
  const lastErrorRef = useRef(null);
  const frameRef = useRef(`${utteranceKey}\u0000${text}`);
  const startRef = useRef(() => {});
  const sessionRef = useRef({
    generation: 0, clipToken: 0, mode: null, frame: '', completedFrame: '',
    timer: null, nextTimer: null, detach: null, rearmWatchdog: null, notified: '',
  });
  inputsRef.current = { text, utteranceKey, paused, onError, onEnd };

  const clearResource = useCallback(() => {
    const session = sessionRef.current;
    clearTimeout(session.timer); clearTimeout(session.nextTimer);
    session.timer = null; session.nextTimer = null;
    session.rearmWatchdog = null;
    session.detach?.(); session.detach = null;
    const audio = audioRef.current;
    if (audio) {
      try { audio.pause(); } catch { /* A detached audio device is harmless during cancellation. */ }
      try { audio.removeAttribute('src'); audio.load(); } catch { /* Release the current resource where supported. */ }
    }
  }, []);

  const cancel = useCallback((nextStatus) => {
    sessionRef.current.generation += 1;
    sessionRef.current.clipToken += 1;
    sessionRef.current.mode = null;
    clearResource();
    if (mountedRef.current) {
      updateSpeaking(false);
      if (lastErrorRef.current) updateStatus('error');
      else if (nextStatus) updateStatus(nextStatus);
    }
  }, [clearResource]);

  const clearFailure = useCallback(() => {
    lastErrorRef.current = null;
    sessionRef.current.notified = '';
    updateLastError(null);
  }, []);

  const fail = useCallback((code) => {
    const failure = failureDetails(code);
    cancel('error');
    lastErrorRef.current = failure;
    updateLastError(failure); updateStatus('error');
    updateVoiceHealth(previous => ({
      ...previous, [RECORDED_NARRATION_VOICE.id]: { status: 'failed', code: failure.code, message: failure.message },
    }));
    const notification = `${failure.code}:${inputsRef.current.utteranceKey}`;
    if (sessionRef.current.notified !== notification) {
      sessionRef.current.notified = notification;
      try { inputsRef.current.onError?.(failure.message); } catch { /* Optional UI feedback cannot strand audio. */ }
    }
  }, [cancel]);

  const ensureAudio = useCallback(() => {
    if (!audioRef.current) {
      if (!supported) { fail('unsupported'); return null; }
      // Only explicit enable, replay and preview actions call this constructor.
      const audio = new window.Audio();
      audio.preload = 'none';
      audio.setAttribute('playsinline', '');
      audioRef.current = audio;
    }
    return audioRef.current;
  }, [supported, fail]);

  const start = useCallback(({ mode = 'story', force = false, allowCreate = false } = {}) => {
    const session = sessionRef.current;
    const input = inputsRef.current;
    const frame = `${input.utteranceKey}\u0000${input.text}`;
    if (lastErrorRef.current) { updateStatus('error'); return; }
    if (document.hidden || (mode === 'story' && (input.paused || !enabledRef.current))) {
      cancel(enabledRef.current ? 'paused' : 'off'); return;
    }
    if (mode === 'story' && manualStopRef.current && !force) return;
    if (!force && session.mode === mode && session.frame === frame && (session.detach || session.nextTimer)) return;
    if (!force && mode === 'story' && session.completedFrame === frame) { updateStatus('finished'); return; }
    const source = mode === 'preview' ? NARRATION_PREVIEW : input.text;
    const key = mode === 'preview' ? RECORDED_PREVIEW_KEY : input.utteranceKey;
    if (!source) { cancel(input.paused ? 'paused' : enabledRef.current ? 'ready' : 'off'); return; }
    const entry = lookupRecordedNarration(MANIFEST, key, source);
    if (!entry) { fail('recording-missing'); return; }
    let audio = audioRef.current;
    try { if (!audio && allowCreate) audio = ensureAudio(); }
    catch { fail('unknown'); return; }
    if (!audio) { updateStatus(supported ? 'ready' : 'unsupported'); return; }
    cancel();
    const generation = session.generation;
    const keyAtStart = input.utteranceKey;
    session.mode = mode;
    session.frame = frame;
    if (mode === 'story' && force) session.completedFrame = '';
    updateStatus('starting');
    const current = () => mountedRef.current && session.generation === generation
      && session.mode === mode && session.frame === `${inputsRef.current.utteranceKey}\u0000${inputsRef.current.text}`
      && !document.hidden && (mode === 'preview' || (!inputsRef.current.paused && enabledRef.current));
    const playClip = (index) => {
      if (!current()) return;
      clearResource();
      const clip = entry.queue[index];
      const token = ++session.clipToken;
      let started = false;
      let expectedSource = '';
      const valid = () => current() && session.clipToken === token && audioRef.current === audio;
      const matchesResource = () => audio.currentSrc === expectedSource;
      const failClip = (code) => { if (valid()) fail(code); };
      const rearmWatchdog = () => {
        if (!valid() || !started) return;
        clearTimeout(session.timer);
        const remaining = Number.isFinite(audio.duration) && audio.duration > 0
          ? Math.max(0, audio.duration - audio.currentTime) * 1000 / preferencesRef.current.rate
          : Array.from(clip.text).length * 650 / preferencesRef.current.rate;
        session.timer = setTimeout(() => failClip('stalled'), Math.max(18000, remaining + 10000));
      };
      const onPlaying = () => {
        if (!valid() || !matchesResource() || audio.paused || audio.ended || audio.readyState < 2) return;
        started = true;
        clearTimeout(session.timer);
        session.rearmWatchdog = rearmWatchdog;
        rearmWatchdog();
        updateSpeaking(true); updateStatus('speaking');
      };
      const onEnded = () => {
        // An old queued event on the reused element cannot complete a new clip:
        // require this resource to have actually played and now be truly ended.
        if (!valid() || !matchesResource() || !started || audio.ended !== true || audio.currentTime < 0.03) return;
        if (Number.isFinite(audio.duration) && audio.duration > 0 && audio.currentTime < audio.duration - 0.15) return;
        clearResource();
        if (index + 1 < entry.queue.length) {
          // Keep speaking/ducking active through the short breath between clips.
          session.nextTimer = setTimeout(() => { session.nextTimer = null; playClip(index + 1); }, 100);
          return;
        }
        session.mode = null;
        session.generation += 1;
        if (mode === 'story') session.completedFrame = frame;
        updateVoiceHealth(previous => ({ ...previous, [RECORDED_NARRATION_VOICE.id]: { status: 'completed' } }));
        updateSpeaking(false); updateStatus('finished');
        if (mode === 'story') {
          try { inputsRef.current.onEnd?.({ utteranceKey: keyAtStart }); } catch { /* Manual reading remains available. */ }
        }
      };
      const onError = () => {
        // A canceled load can leave an already queued error event on the reused
        // element. Only a current MediaError belongs to the current resource.
        if (!valid() || !audio.error || audio.src !== expectedSource) return;
        if (audio.error?.code === 1) { manualStopRef.current = mode === 'story'; cancel(enabledRef.current ? 'ready' : 'off'); return; }
        failClip(mediaErrorCode(audio.error));
      };
      const onPause = () => {
        if (!valid() || !started || !audio.paused || audio.ended) return;
        if (mode === 'story') manualStopRef.current = true;
        cancel(enabledRef.current ? inputsRef.current.paused ? 'paused' : 'ready' : 'off');
      };
      const handlers = { playing: onPlaying, ended: onEnded, error: onError, pause: onPause };
      for (const [event, handler] of Object.entries(handlers)) audio.addEventListener(event, handler);
      session.detach = () => { for (const [event, handler] of Object.entries(handlers)) audio.removeEventListener(event, handler); };
      try {
        audio.volume = preferencesRef.current.volume;
        audio.playbackRate = preferencesRef.current.rate;
        audio.preservesPitch = true;
        if ('webkitPreservesPitch' in audio) audio.webkitPreservesPitch = true;
        audio.src = clip.src;
        expectedSource = audio.src;
        session.timer = setTimeout(() => failClip('load-timeout'), 15000);
        const playing = audio.play();
        Promise.resolve(playing).catch(error => {
          if (!valid()) return;
          if (error?.name === 'AbortError') {
            if (mode === 'story') manualStopRef.current = true;
            cancel(enabledRef.current ? inputsRef.current.paused ? 'paused' : 'ready' : 'off');
          } else failClip(mediaErrorCode(error));
        });
      } catch (error) { failClip(mediaErrorCode(error)); }
    };
    playClip(0);
  }, [cancel, clearResource, ensureAudio, fail, supported]);
  startRef.current = start;

  const setEnabled = useCallback((value) => {
    if (!mountedRef.current) return;
    const next = typeof value === 'function' ? Boolean(value(enabledRef.current)) : Boolean(value);
    enabledRef.current = next; updateEnabled(next);
    if (!next) { cancel(supported ? 'off' : 'unsupported'); return; }
    clearFailure(); manualStopRef.current = false;
    try { if (!ensureAudio()) return; } catch { fail('unknown'); return; }
    startRef.current({ force: true, allowCreate: true });
  }, [cancel, clearFailure, ensureAudio, fail, supported]);
  const toggle = useCallback(() => setEnabled(!enabledRef.current), [setEnabled]);

  const replay = useCallback(() => {
    if (!mountedRef.current) return;
    clearFailure(); manualStopRef.current = false;
    enabledRef.current = true; updateEnabled(true);
    try { if (!ensureAudio()) return; } catch { fail('unknown'); return; }
    startRef.current({ force: true, allowCreate: true });
  }, [clearFailure, ensureAudio, fail]);
  const preview = useCallback(() => {
    if (!mountedRef.current) return;
    clearFailure();
    startRef.current({ mode: 'preview', force: true, allowCreate: true });
  }, [clearFailure]);
  const stop = useCallback(() => {
    if (sessionRef.current.mode !== 'preview') manualStopRef.current = true;
    cancel(supported ? enabledRef.current ? inputsRef.current.paused ? 'paused' : 'ready' : 'off' : 'unsupported');
  }, [cancel, supported]);
  const setVoiceId = useCallback((id) => { if (id === RECORDED_NARRATION_VOICE.id) clearFailure(); }, [clearFailure]);

  const updatePreference = useCallback((patch) => {
    const next = { ...preferencesRef.current, ...patch };
    preferencesRef.current = next; updatePreferences(next); savePreferences(next);
    const audio = audioRef.current;
    if (audio) {
      try {
        audio.volume = next.volume; audio.playbackRate = next.rate;
        audio.preservesPitch = true;
        if ('webkitPreservesPitch' in audio) audio.webkitPreservesPitch = true;
        sessionRef.current.rearmWatchdog?.();
      } catch { fail('unknown'); }
    }
  }, [fail]);
  const setRate = useCallback((value) => {
    if (Number.isFinite(value)) updatePreference({ rate: clamp(value, 0.75, 1.1) });
  }, [updatePreference]);
  const setVolume = useCallback((value) => {
    if (Number.isFinite(value)) updatePreference({ volume: clamp(value, 0, 1) });
  }, [updatePreference]);

  useEffect(() => {
    mountedRef.current = true;
    const visibilityChanged = () => {
      if (document.hidden) cancel(enabledRef.current ? 'paused' : 'off');
      else if (enabledRef.current) startRef.current();
    };
    document.addEventListener('visibilitychange', visibilityChanged);
    return () => {
      mountedRef.current = false;
      document.removeEventListener('visibilitychange', visibilityChanged);
      cancel(); audioRef.current = null;
    };
  }, [cancel]);

  useEffect(() => {
    const frame = `${utteranceKey}\u0000${text}`;
    const changed = frameRef.current !== frame;
    if (changed) {
      frameRef.current = frame; manualStopRef.current = false;
      sessionRef.current.completedFrame = '';
    }
    if (changed || paused || sessionRef.current.mode === 'preview') cancel();
    if (lastErrorRef.current) { cancel('error'); return; }
    if (!enabledRef.current) { updateStatus(supported ? 'off' : 'unsupported'); return; }
    if (paused || document.hidden) { cancel('paused'); return; }
    startRef.current();
  }, [text, utteranceKey, paused, enabled, supported, cancel]);

  return {
    enabled, setEnabled, toggle, speaking, status, supported, lastError, voiceHealth,
    voices: [RECORDED_NARRATION_VOICE], voiceId: RECORDED_NARRATION_VOICE.id,
    kind: 'recorded', setVoiceId, rate: preferences.rate, setRate, volume: preferences.volume, setVolume,
    replay, stop, preview, tryLocalVoice: preview,
  };
}
