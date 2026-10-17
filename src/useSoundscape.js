import { useCallback, useEffect, useRef, useState } from 'react';

const VOLUME_KEY = 'next-spring-volume-v2';
const DEFAULT_VOLUME = 0.32;
const FADE_TIME = 1.1;

function readVolume() {
  try {
    const stored = localStorage.getItem(VOLUME_KEY);
    const value = stored === null || stored.trim() === '' ? NaN : Number(stored);
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : DEFAULT_VOLUME;
  } catch { return DEFAULT_VOLUME; }
}

function soundKind(scene) {
  const image = String(scene?.image || '').toLowerCase();
  const weather = String(scene?.weather || '');
  const time = String(scene?.time || '');
  if (/雨/.test(weather) && !/雨(?:已经|已)?停|雨过|雨后|停雨|无雨|放晴/.test(weather)) return 'rain';
  if (/workshop/.test(image)) return 'workshop';
  if (/bakery/.test(image)) return 'bakery';
  if (/room|letters|interior|\bday\b|\bnight\b/.test(image)) return 'interior';
  if (/arrival|station|spring|garden|站台/.test(image)) return 'sea';
  return /夜晚|深夜|凌晨/.test(time) ? 'interior' : 'sea';
}

function ramp(parameter, value, now, duration) {
  if (typeof parameter.cancelAndHoldAtTime === 'function') parameter.cancelAndHoldAtTime(now);
  else {
    const current = parameter.value;
    parameter.cancelScheduledValues(now);
    parameter.setValueAtTime(current, now);
  }
  parameter.linearRampToValueAtTime(value, now + duration);
}

function disconnect(node) {
  try { node.disconnect(); } catch { /* Already disconnected. */ }
}

function clearLayerTimers(layer) {
  layer.active = false;
  for (const timer of layer.timers) clearTimeout(timer);
  layer.timers.clear();
}

function destroyLayer(layer) {
  if (!layer || layer.disposed) return;
  layer.disposed = true;
  clearLayerTimers(layer);
  for (const source of layer.sources) {
    source.onended = null;
    try { source.stop(); } catch { /* A short accent may already have ended. */ }
  }
  for (const node of layer.nodes) disconnect(node);
  layer.sources.clear();
  layer.nodes.clear();
  layer.session.layers.delete(layer);
  if (layer.session.retiringLayer === layer) layer.session.retiringLayer = null;
}

function destroySession(session) {
  if (session.destroyed) return;
  session.active = false;
  session.destroyed = true;
  clearTimeout(session.retirementTimer);
  for (const layer of [...session.layers]) destroyLayer(layer);
  disconnect(session.master);
  disconnect(session.limiter);
  try {
    if (session.context.state !== 'closed') Promise.resolve(session.context.close()).catch(() => {});
  } catch { /* Cleanup must remain safe after a device disconnect. */ }
}

function noiseBuffers(context) {
  const length = Math.ceil(context.sampleRate * 5);
  const white = context.createBuffer(1, length, context.sampleRate);
  const brown = context.createBuffer(1, length, context.sampleRate);
  const fine = white.getChannelData(0);
  const soft = brown.getChannelData(0);
  let previous = 0;
  for (let i = 0; i < length; i += 1) {
    fine[i] = Math.random() * 2 - 1;
    previous = previous * 0.985 + fine[i] * 0.035;
    soft[i] = Math.tanh(previous * 2);
  }
  // Taper the boundary over a few milliseconds so the looping air never clicks.
  const seam = Math.min(256, Math.floor(length / 8));
  for (let i = 0; i < seam; i += 1) {
    const fraction = Math.sin((i / (seam - 1)) * Math.PI * 0.5);
    fine[i] *= fraction; fine[length - 1 - i] *= fraction;
    soft[i] *= fraction; soft[length - 1 - i] *= fraction;
  }
  return { white, brown };
}

function addNode(layer, node, source = false) {
  layer.nodes.add(node);
  if (source) layer.sources.add(node);
  return node;
}

function playTone(layer, frequency, offset, duration, level, bird = false) {
  const { context } = layer.session;
  const start = context.currentTime + offset;
  const oscillator = addNode(layer, context.createOscillator(), true);
  const envelope = addNode(layer, context.createGain());
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, start);
  if (bird) {
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.27, start + duration * 0.28);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.93, start + duration * 0.8);
  }
  envelope.gain.setValueAtTime(0, start);
  envelope.gain.linearRampToValueAtTime(level, start + (bird ? 0.035 : 0.025));
  envelope.gain.exponentialRampToValueAtTime(0.00001, start + duration);
  oscillator.connect(envelope).connect(layer.gain);
  oscillator.onended = () => {
    disconnect(oscillator);
    disconnect(envelope);
    layer.sources.delete(oscillator);
    layer.nodes.delete(oscillator);
    layer.nodes.delete(envelope);
  };
  oscillator.start(start);
  oscillator.stop(start + duration + 0.05);
}

function scheduleAccent(layer, first = false) {
  const delay = first ? 14000 + Math.random() * 11000 : 26000 + Math.random() * 22000;
  const timer = setTimeout(() => {
    layer.timers.delete(timer);
    if (!layer.active || !layer.session.active) return;
    const { session } = layer;
    if (session.context.state === 'running' && !document.hidden) {
      try {
        const night = /夜|凌晨/.test(String(session.sceneRef.current?.time || ''));
        if (layer.kind === 'sea' && !night && Math.random() > 0.3) {
          const pitch = 1800 + Math.random() * 550;
          playTone(layer, pitch, 0, 0.19, 0.009, true);
          playTone(layer, pitch * 1.04, 0.26, 0.14, 0.006, true);
        } else if (layer.kind !== 'rain' && Math.random() > 0.35) {
          // An original, sparse three-note colour; no repeating melody or music loop.
          const notes = [392, 440, 523.25, 587.33, 659.25];
          const root = Math.floor(Math.random() * 3);
          [notes[root], notes[root + 2], notes[root + 1]].forEach((pitch, index) => {
            playTone(layer, pitch, index * 0.42, 2.8, 0.016 - index * 0.003);
            playTone(layer, pitch * 2, index * 0.42, 1.4, 0.003);
          });
        }
      } catch { session.onFailure(); return; }
    }
    scheduleAccent(layer);
  }, delay);
  layer.timers.add(timer);
}

function cueLayer(session) {
  if (session.cueLayer) return session.cueLayer;
  const layer = {
    session, kind: 'cues', nodes: new Set(), sources: new Set(), timers: new Set(),
    active: true, disposed: false, lastCueAt: -Infinity, lastCompleteAt: -Infinity,
  };
  session.layers.add(layer);
  session.cueLayer = layer;
  layer.gain = addNode(layer, session.context.createGain());
  layer.gain.gain.value = 1;
  layer.gain.connect(session.master);
  return layer;
}

function cueVoice(layer, frequency, endFrequency, offset, duration, level) {
  const { context } = layer.session;
  const start = context.currentTime + offset;
  const oscillator = addNode(layer, context.createOscillator(), true);
  const envelope = addNode(layer, context.createGain());
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration * 0.8);
  envelope.gain.setValueAtTime(0, start);
  envelope.gain.linearRampToValueAtTime(level, start + 0.012);
  envelope.gain.exponentialRampToValueAtTime(0.00001, start + duration);
  oscillator.connect(envelope).connect(layer.gain);
  let finished = false;
  let timer;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    layer.timers.delete(timer);
    oscillator.onended = null;
    try { oscillator.stop(); } catch { /* Already ended. */ }
    disconnect(oscillator); disconnect(envelope);
    layer.sources.delete(oscillator);
    layer.nodes.delete(oscillator); layer.nodes.delete(envelope);
  };
  oscillator.onended = finish;
  oscillator.start(start);
  oscillator.stop(start + duration + 0.025);
  // Also release short voices while the AudioContext is paused in a hidden tab.
  timer = setTimeout(finish, (offset + duration + 0.12) * 1000);
  layer.timers.add(timer);
}

function playInteractionCue(session, kind) {
  if (!['touch', 'wood', 'water', 'complete'].includes(kind)) return false;
  const layer = cueLayer(session);
  const now = session.context.currentTime;
  if (kind === 'complete' ? now - layer.lastCompleteAt < 0.8 : now - layer.lastCueAt < 0.11) return false;
  // At most four tiny voices can coexist, including a completion's two notes.
  const voices = kind === 'wood' || kind === 'complete' ? 2 : 1;
  if (layer.sources.size + voices > 4) return false;
  if (kind === 'complete') layer.lastCompleteAt = now;
  layer.lastCueAt = now;
  if (kind === 'touch') cueVoice(layer, 155, 105, 0, 0.15, 0.022);
  else if (kind === 'wood') {
    cueVoice(layer, 410, 250, 0, 0.11, 0.016);
    cueVoice(layer, 815, 670, 0, 0.07, 0.003);
  } else if (kind === 'water') cueVoice(layer, 1060, 540, 0, 0.22, 0.018);
  else {
    cueVoice(layer, 523.25, 523.25, 0, 0.58, 0.014);
    cueVoice(layer, 659.25, 659.25, 0.16, 0.62, 0.012);
  }
  return true;
}

function createLayer(session, kind) {
  const { context } = session;
  const layer = { session, kind, nodes: new Set(), sources: new Set(), timers: new Set(), active: true, disposed: false };
  session.layers.add(layer);
  try {
    const profiles = {
      rain: { fine: true, high: 240, low: 3800, level: 0.17, swell: 0.013, speed: 0.09 },
      sea: { high: 75, low: 720, level: 0.23, swell: 0.07, speed: 0.075 },
      interior: { high: 90, low: 410, level: 0.038, swell: 0.008, speed: 0.11 },
      bakery: { high: 100, low: 550, level: 0.052, swell: 0.009, speed: 0.085 },
      workshop: { high: 110, low: 680, level: 0.058, swell: 0.012, speed: 0.065 },
    };
    const profile = profiles[kind] || profiles.sea;
    const source = addNode(layer, context.createBufferSource(), true);
    source.buffer = session.buffers[profile.fine ? 'white' : 'brown'];
    source.loop = true;
    const highpass = addNode(layer, context.createBiquadFilter());
    highpass.type = 'highpass'; highpass.frequency.value = profile.high; highpass.Q.value = 0.45;
    const lowpass = addNode(layer, context.createBiquadFilter());
    lowpass.type = 'lowpass'; lowpass.frequency.value = profile.low; lowpass.Q.value = 0.45;
    const air = addNode(layer, context.createGain());
    air.gain.value = profile.level;
    layer.gain = addNode(layer, context.createGain());
    layer.gain.gain.setValueAtTime(0, context.currentTime);
    layer.gain.gain.linearRampToValueAtTime(1, context.currentTime + FADE_TIME);
    const tide = addNode(layer, context.createOscillator(), true);
    const swell = addNode(layer, context.createGain());
    tide.type = 'sine'; tide.frequency.value = profile.speed;
    swell.gain.value = profile.swell;
    tide.connect(swell).connect(air.gain);
    source.connect(highpass).connect(lowpass).connect(air).connect(layer.gain).connect(session.master);
    source.start(); tide.start();
    scheduleAccent(layer, true);
    return layer;
  } catch (error) { destroyLayer(layer); throw error; }
}

function changeLayer(session, kind) {
  if (!session.active || session.currentLayer?.kind === kind) return;
  if (session.retiringLayer) destroyLayer(session.retiringLayer);
  const previous = session.currentLayer;
  const next = createLayer(session, kind);
  session.currentLayer = next;
  if (!previous) return;
  clearLayerTimers(previous);
  session.retiringLayer = previous;
  ramp(previous.gain.gain, 0, session.context.currentTime, FADE_TIME);
  const timer = setTimeout(() => {
    previous.timers.delete(timer);
    destroyLayer(previous);
  }, (FADE_TIME + 0.08) * 1000);
  previous.timers.add(timer);
}

export default function useSoundscape(scene, { onError } = {}) {
  const [enabled, updateEnabled] = useState(false);
  const [volume, updateVolume] = useState(readVolume);
  const kind = soundKind(scene);
  const enabledRef = useRef(false);
  const volumeRef = useRef(volume);
  const sceneRef = useRef(scene);
  const kindRef = useRef(kind);
  const errorRef = useRef(onError);
  const sessionRef = useRef(null);
  const retiredRef = useRef(new Set());
  const mountedRef = useRef(true);
  const errorReportedRef = useRef(false);
  sceneRef.current = scene;
  kindRef.current = kind;
  errorRef.current = onError;

  const release = useCallback((session, fade = false) => {
    if (!session || session.destroyed) return;
    session.active = false;
    for (const layer of session.layers) clearLayerTimers(layer);
    const finish = () => { retiredRef.current.delete(session); destroySession(session); };
    if (fade && session.context.state === 'running') {
      try {
        ramp(session.master.gain, 0, session.context.currentTime, 0.18);
        retiredRef.current.add(session);
        session.retirementTimer = setTimeout(finish, 220);
        return;
      } catch { /* Fall back to immediate, complete cleanup. */ }
    }
    finish();
  }, []);

  const fail = useCallback((session, message = '环境音暂时无法播放，你仍然可以安静地读故事。') => {
    if (session && sessionRef.current !== session) return;
    enabledRef.current = false;
    sessionRef.current = null;
    release(session);
    if (!mountedRef.current) return;
    updateEnabled(false);
    if (!errorReportedRef.current) {
      errorReportedRef.current = true;
      try { errorRef.current?.(message); } catch { /* A notification cannot break cleanup. */ }
    }
  }, [release]);

  const syncVisibility = useCallback(function sync(session, firstResume) {
    if (!session.active || sessionRef.current !== session || !enabledRef.current || session.pendingVisibility) return;
    const shouldRun = Boolean(firstResume) || !document.hidden;
    if (!firstResume && ((shouldRun && session.context.state === 'running') || (!shouldRun && session.context.state === 'suspended'))) return;
    try {
      // The first resume is invoked synchronously from the user's enabling gesture.
      const operation = shouldRun ? session.context.resume() : session.context.suspend();
      session.pendingVisibility = true;
      Promise.resolve(operation).then(() => {
        session.pendingVisibility = false;
        if (!session.active || sessionRef.current !== session) return;
        if (session.context.state === 'closed') { fail(session); return; }
        // Only a new visibility state warrants another operation; never retry a
        // resolved-but-blocked resume in a microtask loop.
        if (!document.hidden !== shouldRun) sync(session);
        else if (session.context.state !== (shouldRun ? 'running' : 'suspended')) fail(session);
      }).catch(() => { session.pendingVisibility = false; fail(session); });
    } catch { fail(session); }
  }, [fail]);

  const setEnabled = useCallback((value) => {
    const next = typeof value === 'function' ? Boolean(value(enabledRef.current)) : Boolean(value);
    if (!mountedRef.current) return;
    if (!next) {
      enabledRef.current = false;
      updateEnabled(false);
      const session = sessionRef.current;
      sessionRef.current = null;
      release(session, true);
      return;
    }
    if (enabledRef.current && sessionRef.current?.active) return;
    // A quick off/on closes the old fading graph before a new one can be audible.
    for (const retired of [...retiredRef.current]) { destroySession(retired); retiredRef.current.delete(retired); }
    errorReportedRef.current = false;
    let session;
    try {
      const AudioContextClass = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
      if (!AudioContextClass) {
        fail(null, '当前浏览器暂不支持环境音，你仍然可以安静地读故事。');
        return;
      }
      // Never create an AudioContext from an effect, scene change, or visibility event.
      const context = new AudioContextClass();
      session = { context, layers: new Set(), active: true, destroyed: false, sceneRef };
      sessionRef.current = session;
      session.onFailure = () => fail(session);
      session.master = context.createGain();
      session.master.gain.setValueAtTime(0, context.currentTime);
      session.master.gain.linearRampToValueAtTime(volumeRef.current, context.currentTime + 0.55);
      session.limiter = context.createDynamicsCompressor();
      session.limiter.threshold.value = -18; session.limiter.knee.value = 18;
      session.limiter.ratio.value = 3; session.limiter.attack.value = 0.03; session.limiter.release.value = 0.4;
      session.master.connect(session.limiter).connect(context.destination);
      session.buffers = noiseBuffers(context);
      changeLayer(session, kindRef.current);
      enabledRef.current = true;
      updateEnabled(true);
      syncVisibility(session, true);
    } catch { fail(session); }
  }, [fail, release, syncVisibility]);

  const toggle = useCallback(() => setEnabled(!enabledRef.current), [setEnabled]);

  const setVolume = useCallback((value) => {
    const input = typeof value === 'function' ? value(volumeRef.current) : value;
    const numeric = Number(input);
    if (!Number.isFinite(numeric)) return;
    const next = Math.max(0, Math.min(1, numeric));
    volumeRef.current = next;
    updateVolume(next);
    const session = sessionRef.current;
    if (session?.active) {
      try { ramp(session.master.gain, next, session.context.currentTime, 0.25); }
      catch { fail(session); }
    }
  }, [fail]);

  const playCue = useCallback((cue) => {
    const session = sessionRef.current;
    if (!mountedRef.current || !enabledRef.current || !session?.active
      || session.context.state !== 'running' || document.hidden || volumeRef.current <= 0) return false;
    try { return playInteractionCue(session, cue); }
    catch { fail(session); return false; }
  }, [fail]);

  useEffect(() => {
    try { localStorage.setItem(VOLUME_KEY, String(volume)); } catch { /* Sound remains available without storage. */ }
  }, [volume]);

  useEffect(() => {
    const session = sessionRef.current;
    if (!enabledRef.current || !session?.active) return;
    try { changeLayer(session, kind); } catch { fail(session); }
  }, [kind, fail]);

  useEffect(() => {
    mountedRef.current = true;
    const onVisibility = () => {
      const session = sessionRef.current;
      if (enabledRef.current && session?.active) syncVisibility(session);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      mountedRef.current = false;
      enabledRef.current = false;
      document.removeEventListener('visibilitychange', onVisibility);
      const session = sessionRef.current;
      sessionRef.current = null;
      release(session);
      for (const retired of [...retiredRef.current]) destroySession(retired);
      retiredRef.current.clear();
    };
  }, [release, syncVisibility]);

  return { enabled, toggle, setEnabled, volume, setVolume, kind, playCue };
}
