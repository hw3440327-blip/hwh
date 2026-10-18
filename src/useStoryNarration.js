import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import useNarration from './useNarration.js';
import useRecordedNarration, { RECORDED_NARRATION_VOICE } from './useRecordedNarration.js';

const MODE_KEY = 'next-spring-narration-mode-v2';

function readMode() {
  try { return localStorage.getItem(MODE_KEY) === 'system' ? 'system' : 'recorded'; }
  catch { return 'recorded'; }
}

function saveMode(mode) {
  try { localStorage.setItem(MODE_KEY, mode); } catch { /* A private window can still choose voices. */ }
}

export default function useStoryNarration({
  text = '', utteranceKey = '', paused = false, onError, onEnd,
} = {}) {
  // The new mode preference deliberately ignores the old OS/cloud voice choice.
  const [mode, updateMode] = useState(readMode);
  const [enabled, updateEnabled] = useState(false);
  const modeRef = useRef(mode);
  const enabledRef = useRef(false);
  const inputsRef = useRef({ utteranceKey, text, paused, onError, onEnd });
  const enginesRef = useRef(null);
  modeRef.current = mode;
  inputsRef.current = { utteranceKey, text, paused, onError, onEnd };

  const recordedError = useCallback(message => {
    if (modeRef.current === 'recorded') inputsRef.current.onError?.(message);
  }, []);
  const systemError = useCallback(message => {
    if (modeRef.current === 'system') inputsRef.current.onError?.(message);
  }, []);
  const recordedEnd = useCallback(payload => {
    if (modeRef.current === 'recorded' && enabledRef.current && !inputsRef.current.paused
      && payload?.utteranceKey === inputsRef.current.utteranceKey) inputsRef.current.onEnd?.(payload);
  }, []);
  const systemEnd = useCallback(payload => {
    if (modeRef.current === 'system' && enabledRef.current && !inputsRef.current.paused
      && payload?.utteranceKey === inputsRef.current.utteranceKey) inputsRef.current.onEnd?.(payload);
  }, []);

  // Both hooks are always called. The inactive engine receives no story frame.
  const recorded = useRecordedNarration({
    text: mode === 'recorded' ? text : '', utteranceKey: mode === 'recorded' ? utteranceKey : '',
    paused: mode !== 'recorded' || paused, onError: recordedError, onEnd: recordedEnd,
  });
  const system = useNarration({
    text: mode === 'system' ? text : '', utteranceKey: mode === 'system' ? utteranceKey : '',
    paused: mode !== 'system' || paused, onError: systemError, onEnd: systemEnd,
  });
  enginesRef.current = { recorded, system };

  const setEnabled = useCallback(value => {
    const next = typeof value === 'function' ? Boolean(value(enabledRef.current)) : Boolean(value);
    enabledRef.current = next; updateEnabled(next);
    const engines = enginesRef.current;
    const current = modeRef.current;
    const inactive = current === 'recorded' ? 'system' : 'recorded';
    engines[inactive].setEnabled(false); engines[inactive].stop();
    engines[current].setEnabled(next);
  }, []);
  const toggle = useCallback(() => setEnabled(!enabledRef.current), [setEnabled]);

  const switchMode = useCallback((next, voiceId) => {
    const previous = modeRef.current;
    if (next !== previous) {
      enginesRef.current[previous].stop();
      enginesRef.current[previous].setEnabled(false);
      modeRef.current = next;
      saveMode(next);
      // Commit the new frame synchronously while still inside the voice-picker
      // gesture. A preview must not start against the inactive engine's empty key.
      flushSync(() => updateMode(next));
    } else saveMode(next);
    const engine = enginesRef.current[next];
    if (voiceId) engine.setVoiceId(voiceId);
    // Settle the newly active engine's enabled effect before a caller starts a
    // diagnostic preview; otherwise that effect would immediately cancel it.
    if (next !== previous) flushSync(() => engine.setEnabled(enabledRef.current));
    return engine;
  }, []);

  const setVoiceId = useCallback(id => {
    if (id === RECORDED_NARRATION_VOICE.id) switchMode('recorded', id);
    else if (enginesRef.current.system.voices.some(voice => voice.id === id)) switchMode('system', id);
  }, [switchMode]);
  const replay = useCallback(() => {
    enabledRef.current = true; updateEnabled(true);
    const current = modeRef.current;
    const inactive = current === 'recorded' ? 'system' : 'recorded';
    enginesRef.current[inactive].setEnabled(false); enginesRef.current[inactive].stop();
    enginesRef.current[current].replay();
  }, []);
  const preview = useCallback(sample => {
    const current = modeRef.current;
    const inactive = current === 'recorded' ? 'system' : 'recorded';
    enginesRef.current[inactive].setEnabled(false); enginesRef.current[inactive].stop();
    enginesRef.current[current].preview(sample);
  }, []);
  const stop = useCallback(() => {
    enginesRef.current.recorded.stop(); enginesRef.current.system.stop();
  }, []);
  const tryLocalVoice = useCallback(() => {
    // Keep the existing OS diagnostics available; never silently substitute an
    // OS voice when a recording fails. This is an explicit recovery action.
    const engine = switchMode('system');
    engine.tryLocalVoice();
  }, [switchMode]);
  const tryRecordedVoice = useCallback(() => {
    const engine = switchMode('recorded', RECORDED_NARRATION_VOICE.id);
    engine.preview();
    return engine.supported;
  }, [switchMode]);
  const setRate = useCallback(value => enginesRef.current[modeRef.current].setRate(value), []);
  const setVolume = useCallback(value => enginesRef.current[modeRef.current].setVolume(value), []);

  useEffect(() => {
    const inactive = mode === 'recorded' ? system : recorded;
    inactive.setEnabled(false); inactive.stop();
  }, [mode, recorded.setEnabled, recorded.stop, system.setEnabled, system.stop]);

  const active = mode === 'recorded' ? recorded : system;
  return {
    ...active, enabled, setEnabled, toggle, replay, preview, stop, tryLocalVoice, tryRecordedVoice,
    setVoiceId, setRate, setVolume, kind: mode === 'recorded' ? 'recorded' : 'system',
    supported: recorded.supported || system.supported,
    voices: [RECORDED_NARRATION_VOICE, ...system.voices.map(voice => ({ ...voice, kind: 'system' }))],
    voiceId: mode === 'recorded' ? RECORDED_NARRATION_VOICE.id : system.voiceId,
    voiceHealth: { ...system.voiceHealth, ...recorded.voiceHealth },
  };
}
