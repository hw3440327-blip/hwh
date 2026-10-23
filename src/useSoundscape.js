import { useCallback, useEffect, useRef, useState } from 'react';
import { SOUND_RECORDINGS } from './ambienceClips.js';

const VOLUME_KEY = 'next-spring-volume-v2';
const DEFAULT_VOLUME = 0.32;
const FADE_TIME = 1.6;

function readVolume() {
  try {
    const stored = localStorage.getItem(VOLUME_KEY);
    const value = stored === null || stored.trim() === '' ? NaN : Number(stored);
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : DEFAULT_VOLUME;
  } catch { return DEFAULT_VOLUME; }
}

export function soundKind(scene) {
  const image = String(scene?.image || '').toLowerCase();
  const weather = String(scene?.weather || '');
  const time = String(scene?.time || '');
  if (/雨/.test(weather) && !/雨(?:已经|已)?停|雨过|雨后|停雨|无雨|放晴|雨初歇/.test(weather)) return 'rain';
  if (/workshop/.test(image)) return 'workshop';
  if (/bakery/.test(image)) return 'bakery';
  if (/garden|courtyard|market/.test(image)) return 'garden';
  if (/room|letters|interior|bookshop|\bday\b|\bnight\b/.test(image)) return 'interior';
  if (/arrival|station|spring|站台/.test(image)) return 'sea';
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

function disconnect(node) { try { node.disconnect(); } catch { /* Detached. */ } }
function clearLayerTimers(layer) {
  layer.active = false;
  for (const timer of layer.timers) clearTimeout(timer);
  layer.timers.clear();
}
function destroyLayer(layer) {
  if (!layer || layer.disposed) return;
  layer.disposed = true; clearLayerTimers(layer);
  for (const source of layer.sources) {
    source.onended = null;
    try { source.stop(); } catch { /* Already ended. */ }
  }
  for (const node of layer.nodes) disconnect(node);
  layer.sources.clear(); layer.nodes.clear(); layer.session.layers.delete(layer);
  if (layer.session.retiringLayer === layer) layer.session.retiringLayer = null;
  if (layer.session.audibleLayer === layer) layer.session.audibleLayer = null;
  if (layer.session.pourLayer === layer) layer.session.pourLayer = null;
}
function destroySession(session) {
  if (session.destroyed) return;
  session.active = false; session.destroyed = true;
  session.abort.abort(); clearTimeout(session.retirementTimer);
  for (const layer of [...session.layers]) destroyLayer(layer);
  session.recordings.clear(); disconnect(session.master); disconnect(session.limiter);
  try { if (session.context.state !== 'closed') Promise.resolve(session.context.close()).catch(() => {}); } catch { /* Device disconnected. */ }
}
function addNode(layer, node, source = false) {
  layer.nodes.add(node); if (source) layer.sources.add(node); return node;
}
function makeLayer(session, kind) {
  const layer = { session, kind, nodes: new Set(), sources: new Set(), timers: new Set(), active: true, disposed: false, pending: 0 };
  session.layers.add(layer);
  layer.gain = addNode(layer, session.context.createGain());
  layer.gain.gain.value = 0; layer.gain.connect(session.master);
  return layer;
}

async function recording(session, key) {
  if (!SOUND_RECORDINGS[key]) throw new Error('Unknown field recording');
  if (session.recordings.has(key)) return session.recordings.get(key);
  const promise = (async () => {
    const response = await fetch(SOUND_RECORDINGS[key].src, { signal: session.abort.signal });
    if (!response.ok) throw new Error('Recording could not be loaded');
    const bytes = await response.arrayBuffer();
    if (session.destroyed) throw new Error('Sound session closed');
    const buffer = await session.context.decodeAudioData(bytes);
    if (!Number.isFinite(buffer.duration) || Math.abs(buffer.duration - SOUND_RECORDINGS[key].seconds) > .12) throw new Error('Recording duration mismatch');
    return buffer;
  })();
  session.recordings.set(key, promise);
  // Keep the decoded working set bounded on phones. Active sources retain their
  // own buffers, so evicting a cache entry cannot interrupt a playing recording.
  while (session.recordings.size > 4) session.recordings.delete(session.recordings.keys().next().value);
  try { return await promise; }
  catch (error) { if (session.recordings.get(key) === promise) session.recordings.delete(key); throw error; }
}

function retire(layer, seconds = FADE_TIME) {
  if (!layer || layer.disposed) return;
  clearLayerTimers(layer);
  ramp(layer.gain.gain, 0, layer.session.context.currentTime, seconds);
  const timer = setTimeout(() => { layer.timers.delete(timer); destroyLayer(layer); }, (seconds + .08) * 1000);
  layer.timers.add(timer);
}
function scheduleAccent(layer) {
  if (!['interior', 'workshop'].includes(layer.kind)) return;
  const timer = setTimeout(() => {
    layer.timers.delete(timer);
    if (!layer.active || !layer.session.active) return;
    if (layer.session.context.state === 'running' && !document.hidden) playFoley(layer, 'page', .11, .85);
    scheduleAccent(layer);
  }, 18000 + Math.random() * 26000);
  layer.timers.add(timer);
}
function playFoley(layer, key, level, duration) {
  const { session } = layer;
  if (!layer.active || layer.pending + layer.sources.size >= 4) return false;
  layer.pending += 1;
  recording(session, key).then(buffer => {
    if (!layer.active || layer.disposed || !session.active || document.hidden || session.context.state !== 'running' || layer.sources.size >= 4) return;
    const { context } = session;
    const source = addNode(layer, context.createBufferSource(), true);
    const envelope = addNode(layer, context.createGain());
    const pan = addNode(layer, context.createStereoPanner());
    source.buffer = buffer; pan.pan.value = (Math.random() * 2 - 1) * .18;
    const start = context.currentTime, seconds = Math.min(duration || buffer.duration, buffer.duration);
    envelope.gain.setValueAtTime(0, start); envelope.gain.linearRampToValueAtTime(level, start + .012);
    envelope.gain.setValueAtTime(level, start + Math.max(.02, seconds - .07)); envelope.gain.linearRampToValueAtTime(0, start + seconds);
    source.connect(envelope).connect(pan).connect(layer.gain);
    let ended = false, timer;
    const finish = () => {
      if (ended) return; ended = true; clearTimeout(timer); layer.timers.delete(timer); source.onended = null;
      try { source.stop(); } catch { /* Ended. */ }
      for (const node of [source, envelope, pan]) { disconnect(node); layer.nodes.delete(node); }
      layer.sources.delete(source);
    };
    source.onended = finish; source.start(start, 0, seconds); source.stop(start + seconds + .02);
    timer = setTimeout(finish, (seconds + .18) * 1000); layer.timers.add(timer);
  }).catch(() => { if (session.active && !session.destroyed && layer.active) session.onFailure(); })
    .finally(() => { layer.pending -= 1; });
  return true;
}
function cueLayer(session) {
  if (session.cueLayer) return session.cueLayer;
  const layer = makeLayer(session, 'cues'); layer.gain.gain.value = 1;
  layer.lastCueAt = -Infinity; layer.lastCompleteAt = -Infinity; session.cueLayer = layer; return layer;
}
function playInteractionCue(session, kind) {
  if (!['touch', 'wood', 'water', 'complete', 'page'].includes(kind)) return false;
  const layer = cueLayer(session), now = session.context.currentTime;
  if (kind === 'complete' ? now - layer.lastCompleteAt < .8 : now - layer.lastCueAt < .14) return false;
  if (kind === 'complete') layer.lastCompleteAt = now;
  layer.lastCueAt = now;
  const levels = { touch: .18, wood: .29, water: .34, complete: .28, page: .17 };
  return playFoley(layer, kind, levels[kind], kind === 'water' ? 1.05 : undefined);
}
function changePouring(session, wanted) {
  if (!wanted) { const old = session.pourLayer; session.pourLayer = null; retire(old, .16); return; }
  if (session.pourLayer?.active) return;
  const layer = makeLayer(session, 'pour'); session.pourLayer = layer;
  recording(session, 'pour').then(buffer => {
    if (!layer.active || layer.disposed || !session.active || session.pourLayer !== layer || document.hidden) return;
    const source = addNode(layer, session.context.createBufferSource(), true); source.buffer = buffer; source.loop = true;
    source.connect(layer.gain); source.start();
    ramp(layer.gain.gain, .46, session.context.currentTime, .22);
  }).catch(() => { if (session.active && layer.active && !session.destroyed) session.onFailure(); });
}
function createLayer(session, kind) {
  const layer = makeLayer(session, kind);
  const levels = { sea: .62, rain: .53, garden: .48, interior: .19, bakery: .4, workshop: .25 };
  recording(session, kind).then(buffer => {
    if (!layer.active || layer.disposed || !session.active || session.currentLayer !== layer) return;
    const source = addNode(layer, session.context.createBufferSource(), true); source.buffer = buffer; source.loop = true;
    source.connect(layer.gain); source.start(0, Math.random() * Math.max(0, buffer.duration - 2));
    ramp(layer.gain.gain, levels[kind] ?? .4, session.context.currentTime, FADE_TIME);
    scheduleAccent(layer);
    // Keep the last audible place until its replacement really starts. Rapid
    // scene changes can cancel a pending download without cutting off the sea.
    if (session.retiringLayer) destroyLayer(session.retiringLayer);
    const previous = session.audibleLayer;
    session.audibleLayer = layer;
    if (previous && previous !== layer) {
      session.retiringLayer = previous;
      retire(previous);
    }
  }).catch(() => { if (session.active && layer.active && !session.destroyed) session.onFailure(); });
  return layer;
}
function changeLayer(session, kind) {
  if (!session.active || session.currentLayer?.kind === kind) return;
  const previous = session.currentLayer;
  if (previous && previous !== session.audibleLayer) destroyLayer(previous);
  if (session.audibleLayer?.active && session.audibleLayer.kind === kind) {
    session.currentLayer = session.audibleLayer;
    return;
  }
  const next = createLayer(session, kind); session.currentLayer = next;
}

export default function useSoundscape(scene, { onError, ducked = false } = {}) {
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
  const duckedRef = useRef(Boolean(ducked));
  duckedRef.current = Boolean(ducked);
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
      session = { context, layers: new Set(), active: true, destroyed: false, sceneRef, recordings: new Map(), abort: new AbortController() };
      sessionRef.current = session;
      session.onFailure = () => fail(session);
      session.master = context.createGain();
      session.master.gain.setValueAtTime(0, context.currentTime);
      session.master.gain.linearRampToValueAtTime(volumeRef.current * (duckedRef.current ? 0.34 : 1), context.currentTime + 0.55);
      session.limiter = context.createDynamicsCompressor();
      session.limiter.threshold.value = -18; session.limiter.knee.value = 18;
      session.limiter.ratio.value = 3; session.limiter.attack.value = 0.03; session.limiter.release.value = 0.4;
      session.master.connect(session.limiter).connect(context.destination);
      changeLayer(session, kindRef.current);
      recording(session, 'pour').catch(() => {});
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
      try { ramp(session.master.gain, next * (duckedRef.current ? 0.34 : 1), session.context.currentTime, 0.25); }
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

  const setPouring = useCallback((value) => {
    const session = sessionRef.current;
    if (!session?.active || !enabledRef.current) return false;
    try { changePouring(session, Boolean(value) && session.context.state === 'running' && !document.hidden); return true; }
    catch { fail(session); return false; }
  }, [fail]);

  useEffect(() => {
    try { localStorage.setItem(VOLUME_KEY, String(volume)); } catch { /* Sound remains available without storage. */ }
  }, [volume]);

  useEffect(() => {
    const session = sessionRef.current;
    if (!enabledRef.current || !session?.active) return;
    try { ramp(session.master.gain, volumeRef.current * (ducked ? 0.34 : 1), session.context.currentTime, ducked ? 0.35 : 0.8); }
    catch { fail(session); }
  }, [ducked, fail]);

  useEffect(() => {
    const session = sessionRef.current;
    if (!enabledRef.current || !session?.active) return;
    try { changeLayer(session, kind); } catch { fail(session); }
  }, [kind, fail]);

  useEffect(() => {
    mountedRef.current = true;
    const onVisibility = () => {
      const session = sessionRef.current;
      if (enabledRef.current && session?.active) { if (document.hidden) changePouring(session, false); syncVisibility(session); }
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

  return { enabled, toggle, setEnabled, volume, setVolume, kind, playCue, setPouring };
}
