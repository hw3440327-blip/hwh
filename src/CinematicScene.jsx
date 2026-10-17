import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, BookOpen, ChevronRight, Eye, Leaf, MapPin,
  RotateCcw, Sprout, Volume2, VolumeX, X,
} from 'lucide-react';
import { getSceneArt, sceneDescription, sceneDetails } from './visuals.js';
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
  const currentArt = getSceneArt(scene);
  const artRef = useRef(currentArt);
  const ageRef = useRef(scene.age || 22);
  const progressRef = useRef(onProgress);
  progressRef.current = onProgress;
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
  const rainy = /雨/.test(scene.weather || '') && !/雨后|雨停|停雨|无雨/.test(scene.weather || '');
  const chapterIndex = Number.isInteger(scene.chapter) ? scene.chapter : 0;
  const details = sceneDetails(scene);
  const textSpeed = preferences.textSpeed === 0 ? 0 : Math.min(100, Math.max(8, Number(preferences.textSpeed) || 18));

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
    artRef.current = currentArt;
    const timer = setTimeout(() => setPreviousArt(null), quietMotion ? 0 : 1400);
    return () => clearTimeout(timer);
  }, [currentArt, quietMotion]);

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
        if (landscape) { setLandscape(false); setObserving(null); }
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
  }, [paused, landscape, typing, paragraphIndex, characters.length, lastParagraph, scene.id, ageTransition, onMenu]);

  const readableHint = typing ? '轻点，读完这一句' : lastParagraph
    ? scene.ending ? '春天，会记得你' : '把故事交给你的选择' : '轻点，听故事继续';

  return (
    <section
      ref={screenRef}
      className={`cm-screen${quietMotion ? ' cm-quiet' : ''}${paused ? ' cm-paused' : ''}${landscape ? ' cm-landscape-mode' : ''}${preferences.largeText ? ' cm-large-text' : ''}${ready ? ' cm-ready' : ''}`}
      aria-label={`${chapter?.title || '人生旅程'} · ${scene.title}`}
    >
      <div className="cm-world" aria-hidden="true">
        <img key={currentArt} className="cm-world-image" src={currentArt} alt="" />
        {previousArt && <img className="cm-world-image cm-world-previous" src={previousArt} alt="" />}
        <div className="cm-world-shade" />
        <div className="cm-world-grain" />
        {rainy ? <div className="cm-rain">{Array.from({ length: 16 }, (_, index) => (
          <i key={index} style={{ '--i': index }} />
        ))}</div> : <div className="cm-leaves">{Array.from({ length: 5 }, (_, index) => (
          <i key={index} style={{ '--i': index }} />
        ))}</div>}
      </div>
      <p className="cm-accessible-text">{sceneDescription(scene)}</p>

      <header className="cm-header">
        <div className="cm-brand"><Sprout size={24} strokeWidth={1.25} aria-hidden="true" />
          <span>下一次春天<small>A LITTLE LIFE, A LITTLE LIGHT</small></span>
        </div>
        <div className="cm-header-actions">
          <button className="cm-sound-button" onClick={onSound} disabled={paused}
            aria-label={soundEnabled ? '关闭环境声音' : '开启环境声音'} aria-pressed={soundEnabled}>
            {soundEnabled ? <Volume2 size={19} strokeWidth={1.4} /> : <VolumeX size={19} strokeWidth={1.4} />}
            <span>{soundEnabled ? '聆听小镇' : '开启声音'}</span>
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

      {landscape ? <div className="cm-landscape" onClick={() => { setLandscape(false); setObserving(null); }}>
        <div className="cm-detail-points" aria-label="观察身边的风景">
          {details.map((detail) => <button key={detail.id} className={`cm-detail-point${observing?.id === detail.id ? ' is-observing' : ''}`}
            style={{ left: `${Math.min(88, Math.max(12, detail.x))}%`, top: `${Math.min(72, Math.max(20, detail.y))}%` }}
            onClick={(event) => { event.stopPropagation(); setObserving(detail); }} disabled={paused}
            aria-label={`仔细看看${detail.label}`} aria-pressed={observing?.id === detail.id}>
            <span className="cm-detail-glow" /><span className="cm-detail-label">{detail.label}</span>
          </button>)}
        </div>
        {observing && <div className="cm-observation" role="status" onClick={(event) => event.stopPropagation()}>
          <span className="cm-observation-label">{observing.label}</span>
          <p>{observing.text}</p>
          <button onClick={() => setObserving(null)} aria-label="收起这段风景描写"><X size={14} strokeWidth={1.4} aria-hidden="true" /></button>
        </div>}
        <div className="cm-landscape-thought"><Leaf size={20} strokeWidth={1} aria-hidden="true" /><p>{scene.note || '什么也不用着急，先在这里待一会儿。'}</p></div>
        <button className="cm-return-story" onClick={(event) => { event.stopPropagation(); setLandscape(false); }} aria-label="返回故事，继续当前段落">
          <ArrowLeft size={16} strokeWidth={1.3} aria-hidden="true" />返回故事
        </button>
      </div> : <main className="cm-story-stage">
        <div className="cm-reader" key={scene.id}>
          <div className="cm-reader-topline">
            <span className="cm-day-label">{scene.age || 22} 岁<span />{scene.season || '初秋'}<span />{scene.weather || '微风'}</span>
            <button className="cm-landscape-button" onClick={() => setLandscape(true)} disabled={paused} aria-label="暂时收起文字，看看风景">
              <Eye size={15} strokeWidth={1.3} aria-hidden="true" />看看风景
            </button>
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

      <footer className="cm-screen-foot" aria-hidden="true"><span>栖屿镇</span><i />时间在这里，走得慢一些。</footer>
    </section>
  );
}
