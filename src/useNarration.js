import { useCallback, useEffect, useRef, useState } from 'react';
import {
  NARRATION_PREVIEW, chineseVoices, chooseNarrationVoice, narrationFailure,
  narrationStartTimeout, readNarrationPreferences,
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
  const [lastError, setLastError] = useState(null);
  const [voiceHealth, setVoiceHealth] = useState({});
  const lastErrorRef = useRef(null);
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
      if (lastErrorRef.current) setStatus('error');
      else if (nextStatus) setStatus(nextStatus);
    }
  }, []);

  const clearFailure = useCallback(() => {
    lastErrorRef.current = null;
    session.current.notified = '';
    setLastError(null);
  }, []);
  const recordFailure = useCallback((code, voice) => {
    const failure = narrationFailure(code, voice);
    if (!failure) return;
    lastErrorRef.current = failure;
    setLastError(failure);
    setStatus('error');
    if (failure.voiceId) setVoiceHealth((previous) => ({
      ...previous, [failure.voiceId]: { status: 'failed', code: failure.code, message: failure.message },
    }));
    report(failure.message, `${failure.code}:${failure.voiceId}`);
  }, [report]);

  const start = useCallback(({ mode = 'story', source, force = false } = {}) => {
    const active = session.current;
    const frame = currentFrame();
    const content = mode === 'preview' ? source : inputRef.current.text;
    // A refresh, next paragraph, or visibility event must not silently retry a
    // failing OS/cloud voice. Only an explicit player action clears this lock.
    if (lastErrorRef.current) { setStatus('error'); return; }
    if (!supported) {
      cancel('unsupported');
      recordFailure('unsupported');
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
    const selected = chooseNarrationVoice(available.current, preferencesRef.current.voiceId);
    cancel();
    if (!selected) {
      setStatus(voicesLoading.current ? 'loading' : 'unavailable');
      if (!voicesLoading.current) recordFailure('no-chinese-voice');
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
    const failSpeech = (code) => {
      if (!isCurrent()) return;
      cancel('error');
      recordFailure(code, selected);
    };
    const speakChunk = (index) => {
      if (!isCurrent()) return;
      active.nextTimer = null;
      const utterance = new window.SpeechSynthesisUtterance(chunks[index]);
      let started = false;
      utterance.voice = selected.voice;
      utterance.lang = selected.lang;
      utterance.rate = preferencesRef.current.rate;
      utterance.pitch = 1;
      utterance.volume = preferencesRef.current.volume;
      active.utterance = utterance; // Keep a strong reference until completion/cancellation.
      active.timer = setTimeout(() => failSpeech('start-timeout'), narrationStartTimeout(selected));
      utterance.onstart = () => {
        if (!isCurrent() || active.utterance !== utterance) return;
        started = true;
        clearTimeout(active.timer);
        // A bounded watchdog also releases a stalled OS/Chrome voice backend.
        const duration = Math.max(18000, Array.from(chunks[index]).length * 650 / utterance.rate + 6000);
        active.timer = setTimeout(() => failSpeech('stalled'), duration);
        setSpeaking(true);
        setStatus('speaking');
      };
      utterance.onerror = (event) => {
        if (!isCurrent() || active.utterance !== utterance) return;
        if (event?.error === 'interrupted' || event?.error === 'canceled') {
          if (mode === 'story') manualStop.current = true;
          cancel(enabledRef.current ? inputRef.current.paused ? 'paused' : 'ready' : 'off');
          return;
        }
        failSpeech(event?.error);
      };
      utterance.onend = () => {
        if (!isCurrent() || active.utterance !== utterance) return;
        if (!started) { failSpeech('not-started'); return; }
        clearTimeout(active.timer);
        active.utterance = null;
        if (index + 1 < chunks.length) {
          active.nextTimer = setTimeout(() => speakChunk(index + 1), 45);
          return;
        }
        active.mode = null;
        if (mode === 'story') active.completedFrame = frame;
        setVoiceHealth((previous) => ({ ...previous, [selected.id]: { status: 'completed' } }));
        setSpeaking(false);
        setStatus('finished');
        if (mode === 'story') {
          try { inputRef.current.onEnd?.({ utteranceKey: keyAtStart }); } catch { /* Reading can continue by hand. */ }
        }
      };
      try {
        const synth = getSynth();
        if (force && index === 0 && synth.paused === true) synth.resume();
        synth.speak(utterance);
      }
      catch { failSpeech('unknown'); }
    };
    speakChunk(0);
  }, [supported, cancel, recordFailure]);
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
    if (session.current.mode === 'preview' || preferenceTimer.current !== null || lastErrorRef.current) return;
    const changed = before.map((voice) => voice.id).join('\n') !== next.map((voice) => voice.id).join('\n');
    if (autoStart !== false && enabledRef.current && (!session.current.utterance || changed)) startRef.current();
  }, [supported]);

  const setEnabled = useCallback((value) => {
    const next = typeof value === 'function' ? Boolean(value(enabledRef.current)) : Boolean(value);
    enabledRef.current = next;
    updateEnabled(next);
    if (!next) { cancel(supported ? 'off' : 'unsupported'); return; }
    clearFailure();
    manualStop.current = false;
    refreshVoices(false);
    startRef.current({ force: true }); // Run speak directly in the player's click gesture.
  }, [supported, cancel, refreshVoices, clearFailure]);
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
    if (available.current.some((voice) => voice.id === id)) {
      clearFailure();
      updatePreference({ voiceId: id });
    }
  }, [updatePreference, clearFailure]);
  const setRate = useCallback((value) => {
    if (Number.isFinite(value)) updatePreference({ rate: Math.max(0.75, Math.min(1.1, value)) });
  }, [updatePreference]);
  const setVolume = useCallback((value) => {
    if (Number.isFinite(value)) updatePreference({ volume: Math.max(0, Math.min(1, value)) });
  }, [updatePreference]);

  const replay = useCallback(() => {
    clearFailure();
    enabledRef.current = true;
    updateEnabled(true);
    manualStop.current = false;
    refreshVoices(false);
    startRef.current({ force: true });
  }, [refreshVoices, clearFailure]);
  const preview = useCallback((sample = NARRATION_PREVIEW) => {
    clearFailure();
    refreshVoices(false);
    startRef.current({ mode: 'preview', source: typeof sample === 'string' ? sample : NARRATION_PREVIEW, force: true });
  }, [refreshVoices, clearFailure]);
  const tryLocalVoice = useCallback(() => {
    clearFailure();
    refreshVoices(false);
    if (!supported) {
      cancel('unsupported');
      recordFailure('unsupported');
      return;
    }
    const local = available.current.find((voice) => voice.localService === true);
    if (!local) {
      cancel('error');
      recordFailure('no-local-voice');
      return;
    }
    const next = { ...preferencesRef.current, voiceId: local.id };
    preferencesRef.current = next;
    setPreferences(next);
    saveNarrationPreferences(next);
    // This is intentionally synchronous in the fallback button's click gesture.
    // It tests a local voice without enabling narration or advancing the story.
    startRef.current({ mode: 'preview', source: NARRATION_PREVIEW, force: true });
  }, [supported, clearFailure, refreshVoices, cancel, recordFailure]);
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
    if (lastErrorRef.current) { cancel('error'); return; }
    if (!enabledRef.current) { setStatus(supported ? 'off' : 'unsupported'); return; }
    if (paused || hidden()) { cancel('paused'); return; }
    startRef.current();
  }, [text, utteranceKey, paused, enabled, supported, cancel]);

  const selected = chooseNarrationVoice(voices, preferences.voiceId);
  return {
    enabled, setEnabled, toggle, speaking, status, supported, voices, lastError, voiceHealth,
    voiceId: selected?.id ?? '', setVoiceId,
    rate: preferences.rate, setRate, volume: preferences.volume, setVolume,
    replay, stop, preview, tryLocalVoice,
  };
}
