import { useCallback, useEffect, useRef, useState } from 'react';
import { MEMORY_BOX_RECORDINGS } from './memoryBox.js';
import { MEMORY_BOX_AUDIO } from './memoryBoxAudio.js';
import { SOUND_RECORDINGS } from './ambienceClips.js';

const PREF = 'next-spring-memory-box-sound-v1';
const initialEnabled = () => { try { return localStorage.getItem(PREF) !== 'off'; } catch { return true; } };
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
function ramp(parameter, target, context, seconds = .13) {
  const now = context.currentTime;
  if (parameter.cancelAndHoldAtTime) parameter.cancelAndHoldAtTime(now);
  else { parameter.cancelScheduledValues(now); parameter.setValueAtTime(parameter.value, now); }
  parameter.linearRampToValueAtTime(target, now + seconds);
}

/** Real, packaged role recordings and field rain; the lid controls their mix. */
export default function useMemoryBoxAudio({ active = false, box, onHeard } = {}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [visible, setVisible] = useState(() => !document.hidden);
  const [status, setStatus] = useState('closed');
  const [speaking, setSpeaking] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const session = useRef(null), mounted = useRef(true), enabledRef = useRef(enabled);
  const frame = useRef({ active, box, visible, onHeard });
  frame.current = { active, box, visible, onHeard }; enabledRef.current = enabled;
  const currentId = MEMORY_BOX_RECORDINGS[box?.memoryIndex || 0]?.id || 'rain-table';
  const clip = MEMORY_BOX_AUDIO[currentId];

  const pauseVoice = useCallback(s => {
    if (!s) return;
    clearTimeout(s.pauseTimer); s.pauseTimer = null;
    if (s.voice) {
      s.offsets.set(s.voiceId, Math.min(s.voiceBuffer.duration, s.voiceOffset + Math.max(0, s.context.currentTime - s.voiceStarted)));
      s.voice.onended = null;
      try { s.voice.stop(); } catch { /* Already ended. */ }
      s.voice.disconnect(); s.voice = null;
    }
    if (mounted.current) setSpeaking(false);
  }, []);
  const dispose = useCallback(() => {
    const s = session.current; if (!s) return;
    session.current = null; s.disposed = true; s.token += 1;
    clearTimeout(s.pauseTimer); pauseVoice(s); s.abort.abort();
    try { s.rain?.stop(); } catch { /* Released. */ }
    for (const node of [s.rain,s.rainGain,s.rainFilter,s.voiceGain,s.master]) try { node?.disconnect(); } catch { /* Released. */ }
    s.buffers.clear(); s.offsets.clear();
    if (s.context.state !== 'closed') Promise.resolve(s.context.close()).catch(() => {});
    if (mounted.current) { setReady(false); setProgress(0); }
  }, [pauseVoice]);

  const failure = useCallback((s, message) => {
    if (s && session.current !== s) return;
    dispose();
    if (mounted.current) { setStatus('error'); setError(message || '这段旧话暂时没有播放成功。可以点重听再试，也可以先读字幕。'); }
  }, [dispose]);

  const bufferFor = useCallback(async (s, metadata) => {
    if (s.buffers.has(metadata.src)) return s.buffers.get(metadata.src);
    const pending = (async () => {
      const response = await fetch(metadata.src, { signal: s.abort.signal });
      if (!response.ok) throw Error('音频没有载入完整');
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength !== metadata.bytes) throw Error('音频文件不完整');
      if (s.disposed) throw Error('cancelled');
      const decoded = await s.context.decodeAudioData(bytes);
      if (!Number.isFinite(decoded.duration) || Math.abs(decoded.duration - metadata.seconds) > .3) throw Error('音频解码异常');
      return decoded;
    })();
    s.buffers.set(metadata.src, pending);
    try { return await pending; } catch (e) { s.buffers.delete(metadata.src); throw e; }
  }, []);

  const reconcile = useCallback(async () => {
    const s = session.current, f = frame.current;
    if (!s || s.disposed || s.context.state === 'closed') return;
    const token = ++s.token;
    if (!f.active || !f.visible || !enabledRef.current || !f.box?.repaired) {
      pauseVoice(s); ramp(s.master.gain, 0, s.context, .10);
      if (mounted.current) setStatus(!enabledRef.current ? 'muted' : 'paused');
      return;
    }
    const lid = clamp(Number(f.box.lid) || 0, 0, 1);
    const id = MEMORY_BOX_RECORDINGS[f.box.memoryIndex || 0]?.id;
    const metadata = MEMORY_BOX_AUDIO[id];
    if (!metadata) { failure(s, '这段旧话还没有完整收好，可以先读字幕。'); return; }
    if (s.selectedId !== id) {
      pauseVoice(s); s.selectedId = id; s.offsets.set(id, 0); s.completed.delete(id);
      setProgress(0);
    }
    ramp(s.master.gain, .85, s.context);
    ramp(s.rainGain.gain, Math.pow(lid, .9) * .52, s.context);
    ramp(s.rainFilter.frequency, 650 + lid * 7600, s.context);
    const voiceOpen = lid >= .55;
    if (voiceOpen) { clearTimeout(s.pauseTimer); s.pauseTimer = null; }
    ramp(s.voiceGain.gain, voiceOpen ? .5 + ((lid - .55) / .45) * .48 : 0, s.context);
    if (!voiceOpen) {
      if (s.voice && !s.pauseTimer) s.pauseTimer = setTimeout(() => {
        if (session.current === s && (frame.current.box?.lid || 0) < .55) { pauseVoice(s); setStatus('closed'); }
      }, 145);
      else setStatus(lid > .04 ? 'rain' : 'closed');
      if (!s.rain && lid > .04) {
        try {
          const rain = await bufferFor(s, SOUND_RECORDINGS.rain);
          if (s.disposed || session.current !== s || token !== s.token || !frame.current.active || !frame.current.visible || !enabledRef.current) return;
          if (!s.rain) { s.rain = s.context.createBufferSource(); s.rain.buffer = rain; s.rain.loop = true; s.rain.connect(s.rainGain); s.rain.start(); }
        } catch (e) { if (!s.disposed && session.current === s && token === s.token && e.name !== 'AbortError') failure(s); }
      }
      return;
    }
    if (s.voice || s.completed.has(id)) {
      if (!s.voice) setStatus('finished');
      return;
    }
    setStatus('loading');
    try {
      const [rain, voice] = await Promise.all([bufferFor(s,SOUND_RECORDINGS.rain),bufferFor(s,metadata)]);
      const latest = frame.current;
      if (s.disposed || session.current !== s || token !== s.token || !latest.active || !latest.visible || !enabledRef.current || latest.box?.lid < .55 || MEMORY_BOX_RECORDINGS[latest.box?.memoryIndex || 0]?.id !== id) return;
      if (s.context.state !== 'running') { setStatus('paused'); return; }
      if (!s.rain) { s.rain=s.context.createBufferSource();s.rain.buffer=rain;s.rain.loop=true;s.rain.connect(s.rainGain);s.rain.start(); }
      let offset = s.offsets.get(id) || 0;
      if (offset >= voice.duration - .04) offset = 0;
      const source=s.context.createBufferSource();source.buffer=voice;source.connect(s.voiceGain);
      s.voice=source;s.voiceId=id;s.voiceBuffer=voice;s.voiceOffset=offset;s.voiceStarted=s.context.currentTime;
      source.onended=()=>{
        if (s.disposed || session.current!==s || s.voice!==source) return;
        s.voice=null;source.disconnect();setSpeaking(false);
        const now=frame.current;
        if (now.active && now.visible && enabledRef.current && now.box?.repaired && now.box?.lid>=.55 && MEMORY_BOX_RECORDINGS[now.box?.memoryIndex||0]?.id===id && s.context.state==='running') {
          s.completed.add(id);s.offsets.set(id,voice.duration);setProgress(1);setStatus('finished');now.onHeard?.(id);
        } else { s.offsets.set(id,0);setStatus('paused'); }
      };
      source.start(0,offset);setReady(true);setSpeaking(true);setStatus('playing');
    } catch (e) { if (!s.disposed && session.current === s && token === s.token && e.name !== 'AbortError') failure(s); }
  }, [bufferFor, failure, pauseVoice]);

  const activate = useCallback(() => {
    if (!frame.current.active || !enabledRef.current || !frame.current.box?.repaired) return;
    let s=session.current;
    if (!s) {
      const Context=window.AudioContext||window.webkitAudioContext;
      if (!Context) { setError('这个浏览器暂时不能播放盒里的声音，可以读字幕继续。');setStatus('error');return; }
      try {
        const context=new Context({latencyHint:'interactive'}),master=context.createGain(),rainGain=context.createGain(),rainFilter=context.createBiquadFilter(),voiceGain=context.createGain();
        master.gain.value=0;rainGain.gain.value=0;voiceGain.gain.value=0;rainFilter.type='lowpass';rainFilter.frequency.value=650;rainFilter.Q.value=.4;
        rainGain.connect(rainFilter);rainFilter.connect(master);voiceGain.connect(master);master.connect(context.destination);
        s={context,master,rainGain,rainFilter,voiceGain,rain:null,voice:null,buffers:new Map(),offsets:new Map(),completed:new Set(),abort:new AbortController(),token:0,disposed:false,selectedId:null,pauseTimer:null};
        session.current=s;setError('');
      } catch { failure(null,'暂时没有连上声音设备。可以重听再试，也可以先读字幕。');return; }
    }
    const captured=s;
    // Resume synchronously within the player's gesture, before fetching media.
    Promise.resolve(s.context.resume()).then(()=>{if(session.current===captured)reconcile();}).catch(()=>failure(captured,'浏览器还没有允许这次播放，点一下重听就好。'));
  }, [failure,reconcile]);

  const toggle = useCallback(() => {
    const next=!enabledRef.current;enabledRef.current=next;setEnabled(next);
    try { localStorage.setItem(PREF,next?'on':'off'); } catch { /* Still playable. */ }
    if (next) activate(); else { const s=session.current;if(s){pauseVoice(s);ramp(s.master.gain,0,s.context,.12);}setStatus('muted'); }
  }, [activate,pauseVoice]);
  const replay = useCallback(() => {
    enabledRef.current=true;setEnabled(true);setError('');
    try { localStorage.setItem(PREF,'on'); } catch { /* Still playable. */ }
    const s=session.current,id=MEMORY_BOX_RECORDINGS[frame.current.box?.memoryIndex||0]?.id;
    if (s) {pauseVoice(s);s.offsets.set(id,0);s.completed.delete(id);}
    setProgress(0);activate();
  }, [activate,pauseVoice]);
  const pause = useCallback(() => { const s=session.current;if(s){pauseVoice(s);ramp(s.master.gain,0,s.context,.12);}setStatus('paused'); },[pauseVoice]);

  useEffect(()=>{ if(!active){dispose();setStatus('closed');setError('');return;}reconcile(); },[active,box?.lid,box?.repaired,box?.memoryIndex,enabled,visible,reconcile,dispose]);
  useEffect(()=>{
    const update=()=>{setVisible(!document.hidden);if(document.hidden){const s=session.current;if(s){pauseVoice(s);ramp(s.master.gain,0,s.context,.08);}}};
    document.addEventListener('visibilitychange',update);return()=>document.removeEventListener('visibilitychange',update);
  },[pauseVoice]);
  useEffect(()=>{
    if(!active)return;
    const timer=setInterval(()=>{const s=session.current;if(s?.voice){const seconds=s.voiceOffset+s.context.currentTime-s.voiceStarted;setProgress(clamp(seconds/s.voiceBuffer.duration,0,1));}},160);
    return()=>clearInterval(timer);
  },[active]);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;dispose();};},[dispose]);
  return {enabled,ready,speaking,error,status,currentId,progress,duration:clip?.seconds||0,activate,toggle,replay,pause};
}
