import { useCallback, useEffect, useRef, useState } from 'react';
import { MUSIC_SCORE, SCORE_DURATION_SECONDS } from './musicScore.js';

const VOLUME_KEY = 'next-spring-music-volume-v1';
const DEFAULT_VOLUME = 0.42;
const BEAT_SECONDS = 60 / MUSIC_SCORE.bpm;
const LOOKAHEAD_SECONDS = 0.45;
const MAX_VOICES = 64;

const EVENTS = MUSIC_SCORE.bars.flatMap((bar, barIndex) => {
  const offset = barIndex * MUSIC_SCORE.beatsPerBar;
  const notes = ['melody', 'bass', 'arpeggio'].flatMap(part => (bar[part] || []).map(note => ({
    ...note, beat: offset + note.beat, part, barIndex,
  })));
  if (bar.pad?.length) notes.push({
    beat: offset, midi: bar.pad, duration: MUSIC_SCORE.beatsPerBar * 0.88,
    velocity: 0.58, part: 'pad', barIndex,
  });
  return notes;
}).sort((a, b) => a.beat - b.beat);

function readVolume() {
  try {
    const stored = localStorage.getItem(VOLUME_KEY);
    const value = stored === null || stored.trim() === '' ? NaN : Number(stored);
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : DEFAULT_VOLUME;
  } catch { return DEFAULT_VOLUME; }
}

function disconnect(node) {
  try { node.disconnect(); } catch { /* A device may already have disconnected. */ }
}

function ramp(parameter, value, now, duration = 0.45) {
  if (typeof parameter.cancelAndHoldAtTime === 'function') parameter.cancelAndHoldAtTime(now);
  else {
    const current = parameter.value;
    parameter.cancelScheduledValues(now);
    parameter.setValueAtTime(current, now);
  }
  parameter.linearRampToValueAtTime(value, now + duration);
}

function trackNode(session, node) {
  session.nodes.add(node);
  return node;
}

function createWave(context, harmonics) {
  const real = new Float32Array(harmonics.length + 1);
  const imaginary = new Float32Array(harmonics.length + 1);
  harmonics.forEach((amplitude, index) => { imaginary[index + 1] = amplitude; });
  return context.createPeriodicWave(real, imaginary);
}

function roomImpulse(context) {
  const length = Math.ceil(context.sampleRate * 1.65);
  const buffer = context.createBuffer(2, length, context.sampleRate);
  let seed = 72419;
  for (let channel = 0; channel < 2; channel += 1) {
    const samples = buffer.getChannelData(channel);
    let previous = 0;
    for (let i = 0; i < length; i += 1) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const noise = (seed / 4294967296) * 2 - 1;
      previous = previous * 0.68 + noise * 0.32;
      const time = i / context.sampleRate;
      // A tiny, warm room rather than a long, blurred concert-hall tail.
      samples[i] = previous * Math.exp(-time * 4.6) * Math.min(1, time / 0.025);
    }
  }
  return buffer;
}

function sceneColour(scene) {
  const image = String(scene?.image || '').toLowerCase();
  const night = /夜|凌晨/.test(String(scene?.time || '')) || /night/.test(image);
  if (night) return { cutoff: 2450, wet: 0.17 };
  if (/雨/.test(String(scene?.weather || '')) && !/雨停|雨后|放晴/.test(String(scene?.weather || ''))) return { cutoff: 2850, wet: 0.2 };
  if (/spring|garden|arrival/.test(image)) return { cutoff: 3900, wet: 0.22 };
  return { cutoff: /bakery/.test(image) ? 3400 : 3150, wet: 0.18 };
}

function updateColour(session, scene) {
  const colour = sceneColour(scene);
  ramp(session.filter.frequency, colour.cutoff, session.context.currentTime, 1.4);
  ramp(session.wet.gain, colour.wet, session.context.currentTime, 1.4);
}

function cleanupVoice(session, voice) {
  if (voice.finished) return;
  voice.finished = true;
  voice.source.onended = null;
  try { voice.source.stop(); } catch { /* It may already have reached its release. */ }
  for (const node of voice.nodes) {
    disconnect(node);
    session.nodes.delete(node);
  }
  session.sources.delete(voice.source);
  session.voices.delete(voice);
}

function playNote(session, note, when, instrument) {
  if (session.voices.size >= MAX_VOICES) return;
  const { context } = session;
  const source = trackNode(session, context.createOscillator());
  session.sources.add(source);
  const envelope = trackNode(session, context.createGain());
  const voice = { source, nodes: [source, envelope], finished: false };
  session.voices.add(voice);
  const frequency = 440 * 2 ** ((note.midi - 69) / 12);
  const gate = Math.max(0.08, note.duration * BEAT_SECONDS);
  const profiles = {
    piano: { attack: 0.018, peak: 0.22, sustain: 0.16, release: 0.75 },
    marimba: { attack: 0.012, peak: 0.12, sustain: 0.035, release: 0.3 },
    bass: { attack: 0.035, peak: 0.18, sustain: 0.3, release: 0.42 },
    pad: { attack: Math.min(0.9, gate * 0.3), peak: 0.05, sustain: 0.68, release: 0.85 },
  };
  const profile = profiles[instrument];
  const peak = profile.peak * note.velocity;
  source.setPeriodicWave(session.waves[instrument]);
  source.frequency.setValueAtTime(frequency, when);
  // The tiny fixed detuning avoids a glassy, perfectly mathematical pad sound.
  if (instrument === 'pad') source.detune.setValueAtTime(note.midi % 2 ? -2.5 : 2.5, when);
  const decayAt = when + Math.min(gate * 0.7, profile.attack + (instrument === 'pad' ? 0.7 : 0.26));
  envelope.gain.setValueAtTime(0, when);
  envelope.gain.linearRampToValueAtTime(peak, when + profile.attack);
  envelope.gain.exponentialRampToValueAtTime(Math.max(0.00001, peak * (instrument === 'pad' ? 0.9 : 0.43)), decayAt);
  envelope.gain.exponentialRampToValueAtTime(Math.max(0.00001, peak * profile.sustain), when + gate);
  envelope.gain.exponentialRampToValueAtTime(0.00001, when + gate + profile.release);
  source.connect(envelope);
  if (typeof context.createStereoPanner === 'function') {
    const panner = trackNode(session, context.createStereoPanner());
    voice.nodes.push(panner);
    panner.pan.value = instrument === 'pad' ? (note.midi % 2 ? -0.24 : 0.24)
      : instrument === 'bass' ? -0.05 : Math.max(-0.24, Math.min(0.24, (note.midi - 64) * 0.012));
    envelope.connect(panner).connect(session.filter);
  } else envelope.connect(session.filter);
  voice.stopAt = when + gate + profile.release + 0.04;
  source.onended = () => cleanupVoice(session, voice);
  source.start(when);
  source.stop(voice.stopAt);
}

function seek(session, relativeSeconds) {
  const elapsed = Math.max(0, relativeSeconds);
  session.cycle = Math.floor(elapsed / SCORE_DURATION_SECONDS);
  const beat = (elapsed % SCORE_DURATION_SECONDS) / BEAT_SECONDS;
  session.eventIndex = EVENTS.findIndex(event => event.beat >= beat - 0.025);
  if (session.eventIndex < 0) { session.eventIndex = 0; session.cycle += 1; }
}

function stopScheduler(session) {
  clearTimeout(session.schedulerTimer);
  session.schedulerTimer = null;
}

function startScheduler(session) {
  if (!session.active || session.context.state !== 'running' || document.hidden || session.schedulerTimer !== null) return;
  const tick = () => {
    session.schedulerTimer = null;
    if (!session.active || session.context.state !== 'running' || document.hidden) return;
    try {
      const now = session.context.currentTime;
      for (const voice of [...session.voices]) if (voice.stopAt < now - 0.3) cleanupVoice(session, voice);
      let event = EVENTS[session.eventIndex];
      let when = session.origin + session.cycle * SCORE_DURATION_SECONDS + event.beat * BEAT_SECONDS;
      // A busy foreground tab can skip ahead without bursting all missed notes.
      if (when < now - 2) {
        seek(session, now - session.origin);
        event = EVENTS[session.eventIndex];
        when = session.origin + session.cycle * SCORE_DURATION_SECONDS + event.beat * BEAT_SECONDS;
      }
      let scheduled = 0;
      while (when < now + LOOKAHEAD_SECONDS && scheduled < 128) {
        if (when >= now - 0.08) {
          const start = Math.max(when, now + 0.008);
          if (event.part === 'pad') {
            for (const midi of event.midi) playNote(session, { ...event, midi }, start, 'pad');
          } else {
            const sunny = /garden|spring/.test(String(session.sceneRef.current?.image || ''));
            const instrument = event.part === 'bass' ? 'bass' : event.part === 'arpeggio'
              ? (sunny || Math.floor(event.barIndex / 16) % 2 ? 'marimba' : 'piano') : 'piano';
            const velocity = event.velocity * (event.part === 'arpeggio' ? 0.66 : 1);
            playNote(session, { ...event, velocity }, start, instrument);
          }
        }
        session.eventIndex += 1;
        if (session.eventIndex >= EVENTS.length) { session.eventIndex = 0; session.cycle += 1; }
        event = EVENTS[session.eventIndex];
        when = session.origin + session.cycle * SCORE_DURATION_SECONDS + event.beat * BEAT_SECONDS;
        scheduled += 1;
      }
      session.schedulerTimer = setTimeout(tick, 100);
    } catch { session.onFailure(); }
  };
  tick();
}

function destroySession(session) {
  if (!session || session.destroyed) return;
  session.active = false;
  session.destroyed = true;
  stopScheduler(session);
  clearTimeout(session.retirementTimer);
  for (const voice of [...session.voices]) cleanupVoice(session, voice);
  for (const source of session.sources) {
    source.onended = null;
    try { source.stop(); } catch { /* A failed setup can leave an unstarted source. */ }
  }
  for (const node of session.nodes) disconnect(node);
  session.sources.clear(); session.nodes.clear();
  try {
    if (session.context.state !== 'closed') Promise.resolve(session.context.close()).catch(() => {});
  } catch { /* Cleanup must not interrupt the story. */ }
}

export default function useMusic({ scene, ducked = false, onError } = {}) {
  const [enabled, updateEnabled] = useState(false);
  const [volume, updateVolume] = useState(readVolume);
  const enabledRef = useRef(false);
  const volumeRef = useRef(volume);
  const sceneRef = useRef(scene);
  const duckedRef = useRef(ducked);
  const errorRef = useRef(onError);
  const errorReportedRef = useRef(false);
  const mountedRef = useRef(true);
  const sessionRef = useRef(null);
  const retiredRef = useRef(new Set());
  const positionRef = useRef(0);
  sceneRef.current = scene;
  duckedRef.current = ducked;
  errorRef.current = onError;

  const release = useCallback((session, fade = false) => {
    if (!session || session.destroyed) return;
    session.active = false;
    stopScheduler(session);
    positionRef.current = Math.max(0, session.context.currentTime - session.origin) % SCORE_DURATION_SECONDS;
    const finish = () => { retiredRef.current.delete(session); destroySession(session); };
    if (fade && session.context.state === 'running') {
      try {
        ramp(session.master.gain, 0, session.context.currentTime, 0.16);
        retiredRef.current.add(session);
        session.retirementTimer = setTimeout(finish, 210);
        return;
      } catch { /* Finish synchronously if the audio device disappeared. */ }
    }
    finish();
  }, []);

  const fail = useCallback((session, message = '音乐暂时未能播放，故事仍可以继续。') => {
    if (session && sessionRef.current !== session) return;
    enabledRef.current = false;
    sessionRef.current = null;
    release(session);
    if (!mountedRef.current) return;
    updateEnabled(false);
    if (!errorReportedRef.current) {
      errorReportedRef.current = true;
      try { errorRef.current?.(message); } catch { /* Notifications are optional. */ }
    }
  }, [release]);

  const syncVisibility = useCallback(function sync(session, firstResume = false) {
    if (!session.active || sessionRef.current !== session || !enabledRef.current) return;
    if (document.hidden) stopScheduler(session);
    if (session.pendingVisibility) return;
    const shouldRun = firstResume || !document.hidden;
    if (!firstResume && session.context.state === (shouldRun ? 'running' : 'suspended')) {
      if (shouldRun) startScheduler(session);
      return;
    }
    try {
      // A first resume stays in the synchronous stack of the enabling gesture.
      const operation = shouldRun ? session.context.resume() : session.context.suspend();
      session.pendingVisibility = true;
      Promise.resolve(operation).then(() => {
        session.pendingVisibility = false;
        if (!session.active || sessionRef.current !== session) return;
        const visible = !document.hidden;
        if (visible !== shouldRun) sync(session);
        else if (session.context.state !== (shouldRun ? 'running' : 'suspended')) fail(session);
        else if (visible) startScheduler(session);
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
    if (enabledRef.current && sessionRef.current?.active) {
      syncVisibility(sessionRef.current);
      return;
    }
    for (const retired of [...retiredRef.current]) { destroySession(retired); retiredRef.current.delete(retired); }
    errorReportedRef.current = false;
    let session;
    try {
      const AudioContextClass = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
      if (!AudioContextClass) { fail(null, '当前浏览器暂不支持背景音乐。'); return; }
      const context = new AudioContextClass();
      session = {
        context, nodes: new Set(), sources: new Set(), voices: new Set(), active: true, destroyed: false,
        schedulerTimer: null, sceneRef, origin: context.currentTime + 0.12 - positionRef.current,
      };
      sessionRef.current = session;
      session.onFailure = () => fail(session);
      session.master = trackNode(session, context.createGain());
      session.master.gain.setValueAtTime(0, context.currentTime);
      session.master.gain.linearRampToValueAtTime(volumeRef.current, context.currentTime + 0.9);
      session.ducker = trackNode(session, context.createGain());
      session.ducker.gain.value = duckedRef.current ? 0.23 : 1;
      session.filter = trackNode(session, context.createBiquadFilter());
      session.filter.type = 'lowpass'; session.filter.Q.value = 0.45;
      session.filter.frequency.value = sceneColour(sceneRef.current).cutoff;
      const dry = trackNode(session, context.createGain()); dry.gain.value = 0.86;
      const reverb = trackNode(session, context.createConvolver()); reverb.buffer = roomImpulse(context);
      session.wet = trackNode(session, context.createGain()); session.wet.gain.value = sceneColour(sceneRef.current).wet;
      const limiter = trackNode(session, context.createDynamicsCompressor());
      limiter.threshold.value = -21; limiter.knee.value = 18; limiter.ratio.value = 3;
      limiter.attack.value = 0.025; limiter.release.value = 0.35;
      session.filter.connect(dry).connect(session.ducker);
      session.filter.connect(reverb).connect(session.wet).connect(session.ducker);
      session.ducker.connect(session.master).connect(limiter).connect(context.destination);
      session.waves = {
        piano: createWave(context, [1, 0.28, 0.095, 0.041, 0.018, 0.008, 0.003]),
        marimba: createWave(context, [1, 0.035, 0.14, 0.012, 0.025]),
        bass: createWave(context, [1, 0.12, 0.04, 0.014]),
        pad: createWave(context, [1, 0.09, 0.035, 0.009]),
      };
      seek(session, positionRef.current);
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
      try { ramp(session.master.gain, next, session.context.currentTime, 0.3); }
      catch { fail(session); }
    }
  }, [fail]);

  useEffect(() => {
    try { localStorage.setItem(VOLUME_KEY, String(volume)); } catch { /* Playback works without preference storage. */ }
  }, [volume]);

  useEffect(() => {
    const session = sessionRef.current;
    if (!session?.active) return;
    try { ramp(session.ducker.gain, ducked ? 0.23 : 1, session.context.currentTime, ducked ? 0.3 : 0.9); }
    catch { fail(session); }
  }, [ducked, fail]);

  useEffect(() => {
    const session = sessionRef.current;
    if (!session?.active) return;
    try { updateColour(session, scene); } catch { fail(session); }
  }, [scene?.image, scene?.weather, scene?.time, fail]);

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

  return { enabled, toggle, setEnabled, volume, setVolume, trackTitle: MUSIC_SCORE.title };
}
