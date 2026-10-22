import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, BookOpen, ChevronRight, Eye, Leaf, MapPin,
  Compass, HandHeart, Headphones, RotateCcw, Sprout, Volume2, VolumeX, X,
} from 'lucide-react';
import { getSceneArt, sceneDescription, sceneDetails, sceneArtKey } from './visuals.js';
import FilmScene from './FilmScene.jsx';
import { filmForScene } from './films.js';
import { ARTWORK_ASSETS } from './artworkAssets.js';
import './cinematic-scene.css';

const chapterNumbers = ['一', '二', '三', '四', '五', '六', '七', '八'];

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

function isInteractive(target) {
  return target instanceof Element && Boolean(target.closest(
    'button, a, input, textarea, select, [contenteditable="true"], [role="button"], [role="dialog"]',
  ));
}

/** The story stays mounted underneath the journal so opening it never turns a page. */
export default function CinematicScene({
  game, scene, chapter, paragraphs = [], choices = [], onChoose, onMenu,
  onSound, soundEnabled = false, preferences = {}, onReincarnate, onReview, onProgress,
  initialParagraphIndex = 0,
  activity = null, activityDone = false, onActivity, discoveries = [], onDiscover,
  onTown, townDay = 1, townCompleted = false,
  onNarrationChange, onNarration, onNarrationReplay, narrationEnabled = false,
  narrationSupported = false, narrationSpeaking = false, narrationCompleted = null, autoNarration = true,
}) {
  const reducedMotion = useReducedMotion();
  const quietMotion = Boolean(preferences.quietMotion || reducedMotion);
  const paused = Boolean(preferences.paused);
  const startingIndex = Math.min(Math.max(0, initialParagraphIndex), Math.max(0, paragraphs.length - 1));
  const [reading, setReading] = useState({ sceneId: scene.id, index: startingIndex, characters: 0 });
  const [landscape, setLandscape] = useState(false);
  const [observing, setObserving] = useState(null);
  const [ageTransition, setAgeTransition] = useState(null);
  const [previousArt, setPreviousArt] = useState(null);
  const [readyArt, setReadyArt] = useState(null);
  const currentArt = getSceneArt(scene);
  const artRef = useRef(currentArt);
  const ageRef = useRef(scene.age || 22);
  const progressRef = useRef(onProgress);
  progressRef.current = onProgress;
  const narrationRef = useRef(onNarrationChange);
  narrationRef.current = onNarrationChange;
  const autoCompletedRef = useRef(new Set());
  const observationTriggerRef = useRef(null);
  const landscapeButtonRef = useRef(null);
  const wasLandscapeRef = useRef(false);
  const screenRef = useRef(null);
  const activeReading = reading.sceneId === scene.id
    ? reading : { sceneId: scene.id, index: startingIndex, characters: 0 };
  const paragraphIndex = Math.min(activeReading.index, Math.max(paragraphs.length - 1, 0));
  const paragraph = paragraphs[paragraphIndex] || '';
  const characters = useMemo(() => Array.from(paragraph), [paragraph]);
  const visibleCount = Math.min(activeReading.characters, characters.length);
  const typing = visibleCount < characters.length;
  const lastParagraph = paragraphIndex >= paragraphs.length - 1;
  const ready = lastParagraph && !typing;
  const chapterIndex = Number.isInteger(scene.chapter) ? scene.chapter : 0;
  const details = sceneDetails(scene);
  const textSpeed = preferences.textSpeed === 0 ? 0 : Math.min(100, Math.max(8, Number(preferences.textSpeed) || 18));
  const storyUtteranceKey = `story:${scene.id}:${paragraphIndex}`;
  const narrationText = observing ? `${observing.label}。${observing.text}${observing.connection}` : landscape ? '' : paragraph;
  const narrationKey = observing ? `detail:${scene.id}:${observing.id}` : landscape ? '' : storyUtteranceKey;
  const narrationPaused = Boolean(paused || ageTransition || (landscape && !observing));
  const filmQuiet = quietMotion || preferences.filmMotion === false;

  useEffect(() => {
    narrationRef.current?.({ text: narrationText, utteranceKey: narrationKey, paused: narrationPaused });
  }, [narrationText, narrationKey, narrationPaused]);
  useEffect(() => () => {
    narrationRef.current?.({ text: '', utteranceKey: '', paused: true });
  }, []);

  useEffect(() => {
    const completedKey = narrationCompleted?.utteranceKey;
    const sequence = narrationCompleted?.sequence;
    if (!narrationEnabled || !autoNarration || paused || landscape || ageTransition || lastParagraph
      || completedKey !== storyUtteranceKey || sequence == null) return;
    const token = `${completedKey}:${sequence}`;
    if (autoCompletedRef.current.has(token)) return;
    const timer = setTimeout(() => {
      autoCompletedRef.current.add(token);
      if (autoCompletedRef.current.size > 128) autoCompletedRef.current.delete(autoCompletedRef.current.values().next().value);
      setReading(previous => previous.sceneId === scene.id && previous.index === paragraphIndex
        ? { sceneId: scene.id, index: paragraphIndex + 1, characters: 0 } : previous);
    }, 650);
    return () => clearTimeout(timer);
  }, [narrationCompleted?.utteranceKey, narrationCompleted?.sequence, narrationEnabled, autoNarration,
    paused, landscape, ageTransition, lastParagraph, storyUtteranceKey, scene.id, paragraphIndex]);

  useEffect(() => {
    if (!landscape && wasLandscapeRef.current) requestAnimationFrame(() => landscapeButtonRef.current?.focus({ preventScroll: true }));
    wasLandscapeRef.current = landscape;
  }, [landscape]);

  useEffect(() => {
    setReading((previous) => previous.sceneId === scene.id
      ? previous : { sceneId: scene.id, index: startingIndex, characters: 0 });
    setLandscape(false);
    setObserving(null);
    if (!quietMotion && (scene.age || 22) - ageRef.current >= 4) {
      setAgeTransition({ age: scene.age, season: scene.season });
    } else {
      setAgeTransition(null);
    }
    ageRef.current = scene.age || 22;
  }, [scene.id]);

  useEffect(() => {
    if (!ageTransition || paused) return;
    if (quietMotion) { setAgeTransition(null); return; }
    const timer = setTimeout(() => setAgeTransition(null), 1200);
    return () => clearTimeout(timer);
  }, [ageTransition, paused, quietMotion]);

  useEffect(() => {
    if (currentArt === artRef.current) {
      if (quietMotion) setPreviousArt(null);
      return;
    }
    setPreviousArt(artRef.current);
  }, [currentArt, quietMotion]);

  useEffect(() => {
    if (readyArt !== currentArt) return;
    const timer = setTimeout(() => setPreviousArt(null), quietMotion ? 0 : 820);
    return () => clearTimeout(timer);
  }, [readyArt,currentArt,quietMotion]);

  useEffect(() => {
    if (paused || landscape || ageTransition) return;
    if (quietMotion || textSpeed === 0) {
      setReading((previous) => previous.sceneId === scene.id && previous.index === paragraphIndex
        ? { ...previous, characters: characters.length } : previous);
      return;
    }
    if (!typing) return;
    const timer = setInterval(() => {
      setReading((previous) => {
        if (previous.sceneId !== scene.id || previous.index !== paragraphIndex
          || previous.characters >= characters.length) return previous;
        return { ...previous, characters: previous.characters + 1 };
      });
    }, textSpeed);
    return () => clearInterval(timer);
  }, [scene.id, paragraphIndex, characters.length, quietMotion, paused, landscape, ageTransition, textSpeed, typing]);

  useEffect(() => {
    progressRef.current?.({ paragraphIndex, typing });
  }, [paragraphIndex, typing]);

  function advance() {
    if (paused) return;
    if (ageTransition) { setAgeTransition(null); return; }
    if (landscape) { setLandscape(false); return; }
    if (typing) {
      setReading({ sceneId: scene.id, index: paragraphIndex, characters: characters.length });
    } else if (!lastParagraph) {
      setReading({ sceneId: scene.id, index: paragraphIndex + 1, characters: 0 });
    }
  }

  function previousParagraph() {
    if (paused || paragraphIndex === 0) return;
    const previousIndex = paragraphIndex - 1;
    setReading({ sceneId: scene.id, index: previousIndex,
      characters: Array.from(paragraphs[previousIndex] || '').length });
  }

  function revealChoices() {
    if (paused) return;
    const finalIndex = Math.max(paragraphs.length - 1, 0);
    setReading({ sceneId: scene.id, index: finalIndex,
      characters: Array.from(paragraphs[finalIndex] || '').length });
  }

  useEffect(() => {
    function onKey(event) {
      if (paused || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        if (observing) setObserving(null);
        else if (landscape) { setLandscape(false); setObserving(null); }
        else if (ageTransition) setAgeTransition(null);
        else onMenu?.();
        return;
      }
      if (isInteractive(event.target)) return;
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault(); advance();
      } else if (event.key === 'ArrowLeft' && !landscape) {
        event.preventDefault(); previousParagraph();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paused, landscape, observing, typing, paragraphIndex, characters.length, lastParagraph, scene.id, ageTransition, onMenu]);

  const readableHint = typing ? '轻点，读完这一句' : lastParagraph
    ? scene.ending ? '春天，会记得你' : '把故事交给你的选择' : '轻点，听故事继续';

  return (
    <section
      ref={screenRef}
      className={`cm-screen${quietMotion ? ' cm-quiet' : ''}${paused ? ' cm-paused' : ''}${landscape ? ' cm-landscape-mode' : ''}${observing ? ' cm-has-observation' : ''}${preferences.largeText ? ' cm-large-text' : ''}${ready ? ' cm-ready' : ''}`}
      aria-label={`${chapter?.title || '人生旅程'} · ${scene.title}`}
    >
      <div className="cm-world" aria-hidden="true">
        <FilmScene key={currentArt} scene={scene} poster={currentArt} className="cm-world-plate" paused={paused || Boolean(observing)} quiet={filmQuiet}
          onImageLoad={() => { artRef.current=currentArt;setReadyArt(currentArt); }} />
        {previousArt && <img className={`cm-world-image cm-world-previous${readyArt===currentArt?' is-leaving':''}`} src={previousArt} alt="" />}
        <div className="cm-world-shade" />
        <div className="cm-world-grain" />
      </div>
      <p className="cm-accessible-text">{sceneDescription(scene)}</p>

      <header className="cm-header" inert={Boolean(observing)} aria-hidden={Boolean(observing)}>
        <div className="cm-brand"><Sprout size={24} strokeWidth={1.25} aria-hidden="true" />
          <span>下一次春天<small>A LITTLE LIFE, A LITTLE LIGHT</small></span>
        </div>
        <div className="cm-header-actions">
          <button className={`cm-narration-button${narrationSpeaking ? ' is-speaking' : ''}`} onClick={onNarration}
            disabled={paused || !narrationSupported} aria-pressed={narrationEnabled}
            aria-label={!narrationSupported ? '此浏览器暂不支持故事朗读' : narrationEnabled ? '关闭故事朗读' : '开启故事朗读'}
            title={!narrationSupported ? '此浏览器暂不支持故事朗读' : '故事朗读'}>
            <Headphones size={18} strokeWidth={1.4} aria-hidden="true" /><span>故事朗读</span>
          </button>
          {narrationEnabled && onNarrationReplay && <button className="cm-replay-button" onClick={onNarrationReplay} disabled={paused} aria-label="重听当前这段故事" title="重听">
            <RotateCcw size={15} strokeWidth={1.4} aria-hidden="true" /><span>重听</span>
          </button>}
          <button className="cm-sound-button" onClick={onSound} disabled={paused}
            aria-label={soundEnabled ? '关闭配乐与海风' : '开启配乐与海风'} aria-pressed={soundEnabled}>
            {soundEnabled ? <Volume2 size={19} strokeWidth={1.4} /> : <VolumeX size={19} strokeWidth={1.4} />}
            <span>配乐与海风</span>
          </button>
          <button className="cm-menu-button" onClick={onMenu} disabled={paused} aria-label="打开旅程手记">
            <BookOpen size={18} strokeWidth={1.35} aria-hidden="true" /><span>旅程手记</span>
          </button>
        </div>
      </header>

      {ageTransition && <button className="cm-age-transition" onClick={() => setAgeTransition(null)} disabled={paused} aria-label="时光流转，点击继续故事">
        <span className="cm-age-kicker">时光轻轻走过</span>
        <span className="cm-age-number">{ageTransition.age}<small>岁</small></span>
        <span className="cm-age-season">又一个{ageTransition.season || '春天'}，你还在这里。</span>
        <span className="cm-age-skip">轻点，继续故事</span>
      </button>}

      {!landscape && <div className="cm-scene-caption" key={scene.id}>
        <span className="cm-chapter-label"><span />第{chapterNumbers[chapterIndex] || chapterIndex + 1}章 · {chapter?.title || '春天'}</span>
        <h1>{scene.title}</h1>
        <p><MapPin size={12} strokeWidth={1.4} aria-hidden="true" />{scene.location}<span className="cm-meta-divider">/</span>{scene.time}</p>
      </div>}

      {landscape ? <div className="cm-landscape cf-exploring" inert={Boolean(observing)} aria-hidden={Boolean(observing)}
        >
        <div className="cf-wander-heading"><span>这一页，先不急着翻过去。</span><h2>{scene.location.split('·').at(-1).trim()}</h2><p>{filmForScene(scene) ? '让视线随风走一走，靠近那些有光的地方。' : '在细小的日常里，找一处愿意停下的地方。'}</p></div>
        <div className="cm-detail-points" aria-label="观察身边的风景">
          {details.map(detail => <button key={detail.id} className="cm-detail-point" style={{left:`${Math.min(88,Math.max(12,detail.x))}%`,top:`${Math.min(66,Math.max(22,detail.y))}%`}} disabled={paused}
            onClick={event => { observationTriggerRef.current = event.currentTarget; setObserving(detail); }} aria-label={`仔细看看${detail.label}`}>
            <span className="cm-detail-glow"/><span className="cm-detail-label">{detail.label}</span>
          </button>)}
        </div>
        <div className="cf-explore-bottom"><p>{scene.note || '什么也不用着急，先在这里待一会儿。'}</p><div className="cf-explore-actions">
          {onTown && <button className="cm-town-button" onClick={onTown} disabled={paused} aria-label="走进初秋的三天"><Compass size={16} /><span>{scene.age > 25 ? '回到初秋的小镇' : '去小镇走走'}</span><ChevronRight size={14} /></button>}
          {discoveries.map(item => <button className={'cf-discover cf-discover-'+item.id} key={item.id} onClick={() => onDiscover?.(item.id)} disabled={paused}><span>{item.id === 'photo' ? '留一束光' : item.id === 'tea' ? '沏一盏茶' : '拾起潮汐的信'}</span><ChevronRight size={14}/></button>)}
          {activity && <button className="cm-landscape-activity" onClick={() => onActivity?.()} disabled={paused}><HandHeart size={16}/>{activityDone ? '看看手作的成果' : activity.title}</button>}
          <button className="cm-return-story" onClick={() => setLandscape(false)} aria-label="返回故事，继续当前段落"><ArrowLeft size={15}/>回到故事里</button>
        </div></div>
      </div> : <main className="cm-story-stage">
        <div className="cm-reader" key={scene.id}>
          <div className="cm-reader-topline">
            <span className="cm-day-label">{scene.age || 22} 岁<span />{scene.season || '初秋'}<span />{scene.weather || '微风'}</span>
            <div className="cm-reader-tools">
            {onTown && <button className="cm-town-button" onClick={onTown} disabled={paused} aria-label="走进初秋的三天" title={townCompleted ? '回到亲手留下痕迹的小镇' : `初秋的三天 · 第${townDay}天`}><Compass size={16} strokeWidth={1.3} /><span>{scene.age > 25 ? '回到初秋' : '去小镇走走'}</span><i aria-hidden="true" /></button>}
            {activity && !onTown && <button className={`cm-activity-button${activityDone ? ' is-kept' : ''}`} onClick={onActivity} disabled={paused}>
              <HandHeart size={15} strokeWidth={1.3} aria-hidden="true" /><span>{activityDone ? '看看小成果' : activity.actionLabel || '做件小事'}</span>{!activityDone && <i aria-hidden="true" />}
            </button>}
            <button ref={landscapeButtonRef} className="cm-landscape-button" onClick={() => setLandscape(true)} disabled={paused} aria-label="暂时收起文字，看看风景">
              <Eye size={15} strokeWidth={1.3} aria-hidden="true" />看看风景
            </button>
            </div>
          </div>

          <button
            className={`cm-dialogue${typing ? ' cm-is-typing' : ''}`}
            onClick={advance} disabled={paused}
            aria-label={`${paragraph}。${typing ? '点击立即显示完整段落' : lastParagraph ? '本段已读完，可在下方作出选择' : '点击阅读下一段'}`}
          >
            <span className="cm-dialogue-text" aria-hidden="true">
              <span className="cm-text-reserve">{paragraph || ' '}</span>
              <span className="cm-text-visible">{characters.slice(0, visibleCount).join('')}
                {typing && <span className="cm-type-caret" />}
              </span>
            </span>
            <span className="cm-continue-hint" aria-hidden="true">{readableHint}{!ready && <ChevronRight size={13} strokeWidth={1.3} />}</span>
          </button>

          <div className="cm-reading-controls">
            <button className="cm-previous" onClick={previousParagraph} disabled={paused || paragraphIndex === 0} aria-label="回看上一段文字">
              <ArrowLeft size={14} strokeWidth={1.4} aria-hidden="true" /><span>上一段</span>
            </button>
            <div className="cm-page-dots" role="img" aria-label={`第 ${paragraphIndex + 1} 段，共 ${paragraphs.length} 段`}>
              {paragraphs.map((_, index) => <i key={index} className={index === paragraphIndex ? 'is-current' : index < paragraphIndex ? 'is-read' : ''} />)}
            </div>
            {!ready ? <button className="cm-skip" onClick={revealChoices} disabled={paused} aria-label={scene.ending ? '直接读完，查看人生终幕' : '跳过本场剩余文字，直接查看选择'}>
              {scene.ending ? '读到最后' : '直接查看选择'}<ChevronRight size={12} strokeWidth={1.4} aria-hidden="true" />
            </button> : <span className="cm-read-complete">这一页，慢慢读过了</span>}
          </div>

          {ready && !scene.ending && <div className="cm-choices" aria-label="你的选择">
            <p className="cm-choice-prompt"><span />这一刻，你想……</p>
            {choices.map((choice, index) => (
              <button className="cm-choice" key={choice.id} onClick={() => onChoose?.(choice)} disabled={paused}
                aria-label={`${choice.title}${choice.description ? `。${choice.description}` : ''}`} style={{ '--choice-index': index }}>
                <span className="cm-choice-number">0{index + 1}</span>
                <span className="cm-choice-copy"><strong>{choice.title}</strong>{choice.description && <small>{choice.description}</small>}</span>
                <ArrowRight size={19} strokeWidth={1.25} aria-hidden="true" />
              </button>
            ))}
          </div>}

          {ready && scene.ending && <div className="cm-ending" aria-label="这一生的终幕">
            <p className="cm-ending-kicker">这一生，你好好地来过。</p>
            <p className="cm-ending-facts">{scene.age || 82} 岁<span>·</span>{game.history?.length || 0} 次选择<span>·</span>{game.memories?.length || 0} 段珍藏的回忆</p>
            <div className="cm-ending-actions">
              <button className="cm-reincarnate" onClick={onReincarnate} disabled={paused} aria-label="带着这一生的回忆，开启下一次春天"><Sprout size={17} strokeWidth={1.3} aria-hidden="true" />带着回忆，再看一次春天<ArrowRight size={16} strokeWidth={1.3} aria-hidden="true" /></button>
              <button className="cm-review" onClick={onReview} disabled={paused} aria-label="回望这一生的选择和回忆"><RotateCcw size={14} strokeWidth={1.3} aria-hidden="true" />回望这一生</button>
            </div>
          </div>}
        </div>
      </main>}

      {observing && <ObservationDialog key={`${scene.id}:${observing.id}`} detail={observing} scene={scene} art={currentArt}
        onClose={() => setObserving(null)} returnTo={observationTriggerRef.current} paused={paused}
        onReplay={narrationEnabled ? onNarrationReplay : null} quiet={filmQuiet} />}
      <footer className="cm-screen-foot" aria-hidden="true"><span>栖屿镇</span><i />时间在这里，走得慢一些。</footer>
    </section>
  );
}

function ObservationDialog({ detail, scene, art, onClose, returnTo, paused, onReplay, quiet }) {
  const dialogRef = useRef(null);
  const frameRef = useRef(null);
  const closeRef = useRef(onClose);
  const pausedRef = useRef(paused);
  closeRef.current = onClose; pausedRef.current = paused;
  const [pan, setPan] = useState({x:0,y:0});
  const [lens, setLens] = useState(1);
  const pointer = useRef(null);
  const [frameSize, setFrameSize] = useState({ width: 800, height: 400 });
  const [imageSize, setImageSize] = useState(ARTWORK_ASSETS[art] || { width: 1672, height: 941 });
  const scale = Math.max(frameSize.width / imageSize.width, frameSize.height / imageSize.height) * (detail.zoom || 2.15) * lens;
  const imageWidth = imageSize.width * scale;
  const imageHeight = imageSize.height * scale;
  const left = Math.min(0, Math.max(frameSize.width - imageWidth, frameSize.width / 2 - imageWidth * (detail.focusX ?? detail.x) / 100 + pan.x));
  const top = Math.min(0, Math.max(frameSize.height - imageHeight, frameSize.height / 2 - imageHeight * (detail.focusY ?? detail.y) / 100 + pan.y));

  useEffect(() => {
    const frame = frameRef.current;
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      if (width && height) setFrameSize({ width, height });
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current.querySelector('button')?.focus({ preventScroll: true });
    function onKey(event) {
      if (pausedRef.current) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); closeRef.current(); return; }
      if (event.key === 'Tab') {
        const buttons = [...dialogRef.current.querySelectorAll('button:not([disabled])')].filter(button => button.getClientRects().length);
        if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1)?.focus(); }
        else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0]?.focus(); }
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey, true);
      requestAnimationFrame(() => { if (returnTo?.isConnected && !pausedRef.current) returnTo.focus({ preventScroll: true }); });
    };
  }, []);

  return <div className="cm-closeup-backdrop" onClick={event => { event.stopPropagation(); if (event.target === event.currentTarget) onClose(); }}>
    <section className="cm-closeup-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-label={`仔细看看${detail.label}`}
      aria-describedby="cm-detail-description cm-detail-connection" onClick={event => event.stopPropagation()}>
      <div ref={frameRef} className="cm-closeup-frame cf-lens-frame" onPointerDown={event => { if(event.target.closest('button'))return; pointer.current={x:event.clientX,y:event.clientY,pan};event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={event => { const start=pointer.current;if(start)setPan({x:start.pan.x+event.clientX-start.x,y:start.pan.y+event.clientY-start.y}); }} onPointerUp={() => pointer.current=null} onPointerCancel={() => pointer.current=null}>
        <FilmScene scene={scene} poster={art} className="film-observation" paused={paused} quiet={quiet}
          onImageLoad={event => setImageSize({width:event.currentTarget.naturalWidth,height:event.currentTarget.naturalHeight})} style={{width:imageWidth,height:imageHeight,left,top}} />
        <div className="cm-closeup-vignette"/>
        <span className="cm-closeup-touch-hint">拖动镜头，慢慢靠近</span>
        <div className="cf-lens-controls"><button onClick={() => { setLens(l=>Math.max(.75,l-.12));setPan({x:0,y:0}); }} aria-label="镜头退远一点">−</button><span>近处的生活</span><button onClick={() => { setLens(l=>Math.min(1.4,l+.12));setPan({x:0,y:0}); }} aria-label="镜头靠近一点">＋</button></div>
        <span className="cm-closeup-location"><MapPin size={12} strokeWidth={1.4} aria-hidden="true" />{scene.location}</span>
        <button className="cm-closeup-close" onClick={onClose} disabled={paused} aria-label="关闭细节特写"><X size={21} strokeWidth={1.4} aria-hidden="true" /></button>
      </div>
      <div className="cm-closeup-copy">
        <span className="cm-closeup-kicker">靠近一点，生活在这里。</span>
        <h2 id="cm-detail-title">{detail.label}</h2>
        <p id="cm-detail-description" className="cm-closeup-description">{detail.text}</p>
        <div className="cm-closeup-connection" id="cm-detail-connection"><Leaf size={16} strokeWidth={1.2} aria-hidden="true" /><p>{detail.connection}</p></div>
        <div className="cm-closeup-actions">
          <button className="cm-closeup-return" onClick={onClose} disabled={paused}><ArrowLeft size={15} strokeWidth={1.4} aria-hidden="true" />返回这片风景</button>
          {onReplay && <button className="cm-closeup-replay" onClick={onReplay} disabled={paused} aria-label="重听这处风景的讲述"><RotateCcw size={14} strokeWidth={1.4} aria-hidden="true" />重听讲述</button>}
        </div>
      </div>
    </section>
  </div>;
}
