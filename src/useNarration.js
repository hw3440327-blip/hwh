import { useCallback, useEffect, useRef, useState } from 'react';
import {
  NARRATION_PREVIEW, chineseVoices, readNarrationPreferences,
  saveNarrationPreferences, splitNarrationText,
} from './narration.js';

export default function useNarration({
  text = '', utteranceKey = '', paused = false, onError, onEnd,
} = {}) {
  const supported = typeof window !== 'undefined'
    && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
  const [preferences, setPreferences] = useState(readNarrationPreferences);
  const [enabled, updateEnabled] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [status, setStatus] = useState(supported ? 'off' : 'unsupported');
  const [voices, setVoices] = useState([]);
  const mounted = useRef(true);
  const enabledRef = useRef(false);
  const preferencesRef = useRef(preferences);
  const inputRef = useRef({ text, utteranceKey, paused, onError, onEnd });
  inputRef.current = { text, utteranceKey, paused, onError, onEnd };
  const available = useRef([]);
  const voicesLoading = useRef(true);
  const manualStop = useRef(false);
  const startRef = useRef(() => {});
  const frameRef = useRef(`${utteranceKey}\u0000${text}`);
  const session = useRef({
    generation: 0, utterance: null, timer: null, nextTimer: null,
    mode: null, source: '', frame: '', notified: '', completedFrame: '',
  });
  const preferenceTimer = useRef(null);
  const preferencePreview = useRef(null);
  const getSynth = () => supported ? window.speechSynthesis : null;
  const hidden = () => typeof document !== 'undefined' && document.hidden;
  const currentFrame = () => `${inputRef.current.utteranceKey}\u0000${inputRef.current.text}`;

  const report = useCallback((message, key) => {
    if (session.current.notified === key) return;
    session.current.notified = key;
    try { inputRef.current.onError?.(message); } catch { /* Consumer callbacks cannot strand a voice. */ }
  }, []);

  const cancel = useCallback((nextStatus) => {
    const active = session.current;
    active.generation += 1;
    clearTimeout(active.timer);
    clearTimeout(active.nextTimer);
    clearTimeout(preferenceTimer.current);
    preferenceTimer.current = null;
    preferencePreview.current = null;
    active.timer = null;
    active.nextTimer = null;
    if (active.utterance) {
      active.utterance.onstart = null;
      active.utterance.onend = null;
      active.utterance.onerror = null;
      try { window.speechSynthesis.cancel(); } catch { /* Unsupported OS speech backend. */ }
    }
    active.utterance = null;
    active.mode = null;
    if (mounted.current) {
      setSpeaking(false);
      if (nextStatus) setStatus(nextStatus);
    }
  }, []);

  const start = useCallback(({ mode = 'story', source, force = false } = {}) => {
    const active = session.current;
    const frame = currentFrame();
    const content = mode === 'preview' ? source : inputRef.current.text;
    if (!supported) {
      cancel('unsupported');
      report('当前浏览器不支持系统朗读，可以继续安静阅读。', 'unsupported');
      return;
    }
    if (hidden() || (mode === 'story' && (inputRef.current.paused || !enabledRef.current))) {
      cancel(enabledRef.current ? 'paused' : 'off');
      return;
    }
    if (mode === 'story' && manualStop.current && !force) return;
    if (!force && active.mode === mode && active.frame === frame && (active.utterance || active.nextTimer)) return;
    if (!force && mode === 'story' && active.completedFrame === frame) {
      setStatus('finished');
      return;
    }
    const selected = available.current.find((voice) => voice.id === preferencesRef.current.voiceId)
      ?? available.current[0];
    cancel();
    if (!selected) {
      setStatus(voicesLoading.current ? 'loading' : 'unavailable');
      if (!voicesLoading.current) report('这台设备还没有可用的中文声音。请在系统里添加中文语音，或换用带中文朗读的浏览器。', 'no-chinese-voice');
      return;
    }
    const chunks = splitNarrationText(content);
    if (!chunks.length) { setStatus(inputRef.current.paused ? 'paused' : enabledRef.current ? 'ready' : 'off'); return; }
    const generation = session.current.generation;
    const keyAtStart = inputRef.current.utteranceKey;
    active.mode = mode;
    active.source = content;
    active.frame = frame;
    active.completedFrame = mode === 'story' && force ? '' : active.completedFrame;
    active.notified = '';
    setStatus('starting');
    const isCurrent = () => mounted.current && active.generation === generation
      && !hidden() && (mode === 'preview' || (!inputRef.current.paused && enabledRef.current))
      && active.frame === currentFrame();
    const failSpeech = (message) => {
      if (!isCurrent()) return;
      cancel('error');
      report(message, `speech:${generation}`);
    };
    const speakChunk = (index) => {
      if (!isCurrent()) return;
      active.nextTimer = null;
      const utterance = new window.SpeechSynthesisUtterance(chunks[index]);
      utterance.voice = selected.voice;
      utterance.lang = selected.lang;
      utterance.rate = preferencesRef.current.rate;
      utterance.pitch = 1;
      utterance.volume = preferencesRef.current.volume;
      active.utterance = utterance; // Keep a strong reference until completion/cancellation.
      active.timer = setTimeout(() => failSpeech('中文朗读暂时没有启动。请点击“重听”，或试试另一种中文声音。'), 8000);
      utterance.onstart = () => {
        if (!isCurrent() || active.utterance !== utterance) return;
        clearTimeout(active.timer);
        // A bounded watchdog also releases a stalled OS/Chrome voice backend.
        const duration = Math.max(18000, Array.from(chunks[index]).length * 650 / utterance.rate + 6000);
        active.timer = setTimeout(() => failSpeech('朗读暂时停住了。可以点击“重听”，接着听这一段。'), duration);
        setSpeaking(true);
        setStatus('speaking');
      };
      utterance.onerror = () => {
        if (!isCurrent() || active.utterance !== utterance) return;
        failSpeech('这个中文声音暂时无法播放。可以重听，或在设置里选择另一种声音；在线声音需要网络。');
      };
      utterance.onend = () => {
        if (!isCurrent() || active.utterance !== utterance) return;
        clearTimeout(active.timer);
        active.utterance = null;
        if (index + 1 < chunks.length) {
          active.nextTimer = setTimeout(() => speakChunk(index + 1), 45);
          return;
        }
        active.mode = null;
        if (mode === 'story') active.completedFrame = frame;
        setSpeaking(false);
        setStatus('finished');
        if (mode === 'story') {
          try { inputRef.current.onEnd?.({ utteranceKey: keyAtStart }); } catch { /* Reading can continue by hand. */ }
        }
      };
      try { getSynth().speak(utterance); }
      catch { failSpeech('系统暂时无法播放中文朗读。请点击“重听”再试一次。'); }
    };
    speakChunk(0);
  }, [supported, cancel, report]);
  startRef.current = start;

  const refreshVoices = useCallback((autoStart = true) => {
    if (!supported || !mounted.current) return;
    let next;
    try { next = chineseVoices(window.speechSynthesis.getVoices()); }
    catch { next = []; }
    const before = available.current;
    available.current = next;
    const metadata = next.map(({ voice, ...details }) => details);
    setVoices((previous) => JSON.stringify(previous) === JSON.stringify(metadata) ? previous : metadata);
    if (next.length) voicesLoading.current = false;
    if (session.current.mode === 'preview' || preferenceTimer.current !== null) return;
    const changed = before.map((voice) => voice.id).join('\n') !== next.map((voice) => voice.id).join('\n');
    if (autoStart !== false && enabledRef.current && (!session.current.utterance || changed)) startRef.current();
  }, [supported]);

  const setEnabled = useCallback((value) => {
    const next = typeof value === 'function' ? Boolean(value(enabledRef.current)) : Boolean(value);
    enabledRef.current = next;
    updateEnabled(next);
    if (!next) { cancel(supported ? 'off' : 'unsupported'); return; }
    manualStop.current = false;
    refreshVoices(false);
    startRef.current({ force: true }); // Run speak directly in the player's click gesture.
  }, [supported, cancel, refreshVoices]);
  const toggle = useCallback(() => setEnabled(!enabledRef.current), [setEnabled]);

  const updatePreference = useCallback((patch) => {
    const next = { ...preferencesRef.current, ...patch };
    preferencesRef.current = next;
    setPreferences(next);
    saveNarrationPreferences(next);
    const previewSource = session.current.mode === 'preview' ? session.current.source : preferencePreview.current;
    cancel();
    clearTimeout(preferenceTimer.current);
    preferencePreview.current = previewSource;
    preferenceTimer.current = setTimeout(() => {
      preferenceTimer.current = null;
      preferencePreview.current = null;
      if (previewSource) startRef.current({ mode: 'preview', source: previewSource, force: true });
      else if (enabledRef.current && !manualStop.current) startRef.current({ force: true });
    }, 150);
  }, [cancel]);

  const setVoiceId = useCallback((id) => {
    if (available.current.some((voice) => voice.id === id)) updatePreference({ voiceId: id });
  }, [updatePreference]);
  const setRate = useCallback((value) => {
    if (Number.isFinite(value)) updatePreference({ rate: Math.max(0.75, Math.min(1.1, value)) });
  }, [updatePreference]);
  const setVolume = useCallback((value) => {
    if (Number.isFinite(value)) updatePreference({ volume: Math.max(0, Math.min(1, value)) });
  }, [updatePreference]);

  const replay = useCallback(() => {
    enabledRef.current = true;
    updateEnabled(true);
    manualStop.current = false;
    refreshVoices(false);
    startRef.current({ force: true });
  }, [refreshVoices]);
  const preview = useCallback((sample = NARRATION_PREVIEW) => {
    refreshVoices(false);
    startRef.current({ mode: 'preview', source: typeof sample === 'string' ? sample : NARRATION_PREVIEW, force: true });
  }, [refreshVoices]);
  const stop = useCallback(() => {
    if (session.current.mode !== 'preview') manualStop.current = true;
    clearTimeout(preferenceTimer.current);
    cancel(!supported ? 'unsupported' : enabledRef.current ? inputRef.current.paused ? 'paused' : 'ready' : 'off');
  }, [cancel, supported]);

  useEffect(() => {
    mounted.current = true;
    if (!supported) return () => { mounted.current = false; };
    const synth = window.speechSynthesis;
    refreshVoices();
    const timers = [150, 750, 2000].map((delay) => setTimeout(refreshVoices, delay));
    timers.push(setTimeout(() => {
      voicesLoading.current = false;
      refreshVoices();
    }, 4000));
    const previousVoicesChanged = synth.onvoiceschanged;
    const legacyVoicesChanged = () => {
      try { previousVoicesChanged?.call(synth); } catch { /* Preserve unrelated listeners safely. */ }
      refreshVoices();
    };
    if (synth.addEventListener) synth.addEventListener('voiceschanged', refreshVoices);
    else synth.onvoiceschanged = legacyVoicesChanged;
    const visibilityChanged = () => {
      clearTimeout(preferenceTimer.current);
      if (hidden()) cancel(enabledRef.current ? 'paused' : 'off');
      else if (enabledRef.current) startRef.current();
    };
    document.addEventListener('visibilitychange', visibilityChanged);
    return () => {
      mounted.current = false;
      timers.forEach(clearTimeout);
      clearTimeout(preferenceTimer.current);
      if (synth.removeEventListener) synth.removeEventListener('voiceschanged', refreshVoices);
      else if (synth.onvoiceschanged === legacyVoicesChanged) synth.onvoiceschanged = previousVoicesChanged;
      document.removeEventListener('visibilitychange', visibilityChanged);
      cancel();
    };
  }, [supported, refreshVoices, cancel]);

  useEffect(() => {
    const frame = `${utteranceKey}\u0000${text}`;
    const changed = frameRef.current !== frame;
    if (changed) {
      frameRef.current = frame;
      manualStop.current = false;
      session.current.completedFrame = '';
    }
    clearTimeout(preferenceTimer.current);
    if (changed || paused || session.current.mode === 'preview') cancel();
    if (!enabledRef.current) { setStatus(supported ? 'off' : 'unsupported'); return; }
    if (paused || hidden()) { cancel('paused'); return; }
    startRef.current();
  }, [text, utteranceKey, paused, enabled, supported, cancel]);

  const selected = voices.find((voice) => voice.id === preferences.voiceId) ?? voices[0];
  return {
    enabled, setEnabled, toggle, speaking, status, supported, voices,
    voiceId: selected?.id ?? '', setVoiceId,
    rate: preferences.rate, setRate, volume: preferences.volume, setVolume,
    replay, stop, preview,
  };
}
