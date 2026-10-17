import React, { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpFromLine, BookOpen, Check, ChevronRight, Feather, Flower2, Heart, Image, Leaf, Mail, NotebookPen, Pencil, RotateCcw, Route, Settings2, Sprout, Wallet, X } from 'lucide-react';
import { chapters, scenes } from './story.js';
import { origins } from './origins.js';
import { STORAGE_KEY, createGame, availableChoices, choose, serializeGame, restoreGame, reincarnate, finishIntroduction, getSceneParagraphs, replyToLetter } from './engine.js';
import { unlockedLetters } from './letters.js';
import { memoryArt } from './visuals.js';
import Opening from './Opening.jsx';
import CinematicScene from './CinematicScene.jsx';
import LettersPanel from './LettersPanel.jsx';
import LifeReview from './LifeReview.jsx';
import useSoundscape from './useSoundscape.js';
import './styles.css';
import './immersive.css';

const PREF_KEY = 'next-spring-preferences-v1';
const NOTES_KEY = 'next-spring-notes-v1';
const READING_KEY = 'next-spring-reading-v2';
const tabs = [
  { id: 'journey', label: '这段旅程', icon: BookOpen }, { id: 'album', label: '人生相册', icon: Image },
  { id: 'letters', label: '小镇来信', icon: Mail }, { id: 'note', label: '随身手记', icon: NotebookPen },
  { id: 'life', label: '人生回望', icon: Route }, { id: 'settings', label: '阅读与声音', icon: Settings2 },
];
function read(key, fallback = '') { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } }
function parse(key, fallback) { try { return JSON.parse(read(key)) ?? fallback; } catch { return fallback; } }
function validReading(value, game) {
  return { sceneId: game.sceneId, paragraphIndex: value?.sceneId === game.sceneId && Number.isInteger(value.paragraphIndex) ? Math.max(0, Math.min(scenes[game.sceneId].paragraphs.length - 1, value.paragraphIndex)) : 0 };
}

export default function ImmersiveApp() {
  const [game, setGame] = useState(() => restoreGame(read(STORAGE_KEY)) || createGame());
  const [showTitle, setShowTitle] = useState(true);
  const [sceneSession, setSceneSession] = useState(0);
  const [menu, setMenu] = useState(null);
  const [detail, setDetail] = useState(null);
  const [note, setNote] = useState(() => read(NOTES_KEY));
  const [reading, setReading] = useState(() => validReading(parse(READING_KEY, null), game));
  const [preferences, setPreferences] = useState(() => {
    const saved = parse(PREF_KEY, {});
    return { largeText: saved.largeText === true, quietMotion: saved.quietMotion === true,
      textSpeed: [0, 18, 30].includes(saved.textSpeed) ? saved.textSpeed : 18,
      cycles: Number.isSafeInteger(saved.cycles) && saved.cycles > 0 ? saved.cycles : 1 };
  });
  const [toast, setToast] = useState('');
  const [saveError, setSaveError] = useState(false);
  const [nameInput, setNameInput] = useState(game.name);
  const [nameError, setNameError] = useState('');
  const importRef = useRef(null);
  const toastTimer = useRef(null);
  const menuTrigger = useRef(null);
  const scene = scenes[game.sceneId];
  const chapter = chapters[scene.chapter];
  const sound = useSoundscape(scene, { onError: message => notify(message) });
  function notify(message) { clearTimeout(toastTimer.current); setToast(message); toastTimer.current = setTimeout(() => setToast(''), 3600); }
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, serializeGame(game)); setSaveError(false); } catch { setSaveError(true); } }, [game]);
  useEffect(() => { try { localStorage.setItem(NOTES_KEY, note); } catch { setSaveError(true); } }, [note]);
  useEffect(() => { try { localStorage.setItem(PREF_KEY, JSON.stringify(preferences)); } catch { /* Still playable. */ } }, [preferences]);
  useEffect(() => { try { localStorage.setItem(READING_KEY, JSON.stringify(reading)); } catch { /* The main save is independent. */ } }, [reading]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  function openMenu(tab = 'journey') { menuTrigger.current = document.activeElement; setDetail(null); setMenu(tab); }
  function closeMenu() { setMenu(null); setDetail(null); requestAnimationFrame(() => { if (menuTrigger.current?.isConnected) menuTrigger.current.focus(); }); }
  function personalize(text) { return text.replaceAll('{name}', game.name); }
  function begin(details) { setGame(finishIntroduction(game, details)); setShowTitle(false); setReading({ sceneId: 'arrival', paragraphIndex: 0 }); }
  function makeChoice(choice) {
    const next = choose(game, choice.id);
    setReading({ sceneId: next.sceneId, paragraphIndex: 0 }); setGame(next);
    if (unlockedLetters(next).length > unlockedLetters(game).length) notify('有一封信，在旅程手记里等你。');
    else if (choice.memory) notify(`记住了这一刻 · ${choice.memory.title}`);
  }
  function recordProgress({ paragraphIndex }) {
    if (Number.isInteger(paragraphIndex)) setReading(current => current.sceneId === game.sceneId && current.paragraphIndex === paragraphIndex ? current : validReading({ sceneId: game.sceneId, paragraphIndex }, game));
  }
  function exportSave() {
    const payload = JSON.stringify({ save: game, note, cycles: preferences.cycles, reading }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = '下一次春天-我的旅程.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); notify('这段旅程，已经替你好好收好了。');
  }
  async function importSave(event) {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error('size');
      const parsed = JSON.parse(await file.text()); const restored = restoreGame(JSON.stringify(parsed.save ?? parsed));
      if (!restored) throw new Error('invalid');
      setGame(restored); setReading(validReading(parsed.reading, restored)); setSceneSession(value => value + 1);
      setNote(typeof parsed.note === 'string' ? parsed.note.slice(0, 5000) : '');
      if (Number.isSafeInteger(parsed.cycles) && parsed.cycles > 0) setPreferences(p => ({ ...p, cycles: parsed.cycles }));
      closeMenu(); setShowTitle(!restored.introDone); notify('风翻回了熟悉的那一页。');
    } catch { notify('这份存档还没有读懂，请选择之前导出的旅程文件。'); }
    event.target.value = '';
  }
  function nextLife(carry) {
    const next = carry ? reincarnate(game) : createGame(game.name, game.origin);
    setGame(next); setReading({ sceneId: 'arrival', paragraphIndex: 0 });
    if (carry) setPreferences(p => ({ ...p, cycles: p.cycles + 1 }));
    closeMenu(); setShowTitle(true);
  }
  function rename(event) {
    event.preventDefault(); const value = nameInput.trim();
    if (!value || [...value].length > 12) { setNameError('给自己一个 1—12 个字的名字吧。'); return; }
    setGame({ ...game, name: value }); setDetail(null); setNameError('');
  }
  const unread = unlockedLetters(game).filter(letter => !game.letterReplies?.[letter.id]).length;
  const origin = origins.find(item => item.id === game.origin) || origins[0];
  const isTitle = showTitle || !game.introDone;

  return <div className={`immersive-shell ${preferences.largeText ? 'large-text' : ''} ${preferences.quietMotion ? 'quiet-motion' : ''}`}>
    <div className="story-layer" inert={menu !== null} aria-hidden={menu !== null}>
      {isTitle ? <Opening game={game} onBegin={begin} onContinue={() => setShowTitle(false)} onImport={importSave} onSound={sound.toggle} soundEnabled={sound.enabled} /> : <CinematicScene key={sceneSession}
        game={game} scene={scene} chapter={chapter} paragraphs={getSceneParagraphs(game).map(personalize)} choices={availableChoices(game)}
        initialParagraphIndex={reading.sceneId === game.sceneId ? reading.paragraphIndex : 0}
        onChoose={makeChoice} onMenu={() => openMenu()} onSound={sound.toggle} soundEnabled={sound.enabled}
        preferences={{ ...preferences, paused: menu !== null }} onReincarnate={() => nextLife(true)} onReview={() => openMenu('life')} onProgress={recordProgress}
      />}
    </div>
    {menu && <JourneyDialog onClose={closeMenu}>
      <header className="journey-header"><div><Sprout size={23} strokeWidth={1.2} /><div><span className="eyebrow">LET THE STORY REST A MOMENT</span><h2>旅程手记</h2></div></div><button className="journey-close" onClick={closeMenu} aria-label="返回故事"><X size={23} strokeWidth={1.3} /></button></header>
      <nav className="journey-tabs" aria-label="旅程手记分类">{tabs.map(({ id, label, icon: Icon }) => <button className={menu === id ? 'selected' : ''} key={id} onClick={() => { setMenu(id); setDetail(null); }} aria-current={menu === id ? 'page' : undefined}><Icon size={16} strokeWidth={1.4} /><span>{label}</span>{id === 'letters' && unread > 0 && <small>{unread}</small>}</button>)}</nav>
      <div className="journey-content">
        {detail ? <>
          <button className="journey-back" onClick={() => { setDetail(null); setNameError(''); }}><ArrowLeft size={15} />返回手记</button>
          {detail.type === 'memory' && <article className="kept-memory"><img src={memoryArt(detail.memory)} alt="记忆里的手绘小镇" /><span className="eyebrow">A LITTLE LIGHT YOU KEPT</span><h2>{detail.memory.title}</h2><p>{personalize(detail.memory.description)}</p><Flower2 size={25} strokeWidth={1} /></article>}
          {detail.type === 'chapter' && <section className="chapter-recollection"><span className="eyebrow">THE PAGES YOU HAVE LIVED</span><h2>{chapters[detail.index].title} · {chapters[detail.index].subtitle}</h2>{game.history.filter(entry => scenes[entry.sceneId].chapter === detail.index).map((entry, i) => <div key={i}><small>{scenes[entry.sceneId].age} 岁 · {scenes[entry.sceneId].title}</small><p>{entry.choiceTitle}</p></div>)}</section>}
          {detail.type === 'name' && <form className="journey-small-form" onSubmit={rename}><Feather size={25} strokeWidth={1} /><h2>想让小镇，怎样称呼你？</h2><label htmlFor="rename-player">你的名字</label><input id="rename-player" className="name-input" value={nameInput} maxLength={24} onChange={event => setNameInput(event.target.value)} />{nameError && <p role="alert" className="field-error">{nameError}</p>}<button className="primary-button" type="submit">收好这个名字<Check size={16} /></button></form>}
          {detail.type === 'reset' && <div className="journey-small-form"><Sprout size={29} strokeWidth={1} /><h2>开始一段新的生活？</h2><p>当前的人生进度和相册会重新开始，手记保留。可以先把这一次的旅程导出，留作纪念。</p><button className="secondary-button full-width" onClick={exportSave}><ArrowDownToLine size={16} />先收藏现在的旅程</button><button className="primary-button full-width" onClick={() => nextLife(false)}>重新出发<ArrowRight size={16} /></button></div>}
          {detail.type === 'import' && <div className="journey-small-form"><BookOpen size={29} strokeWidth={1} /><h2>翻回熟悉的那一页。</h2><p>导入会替换现在的进度和手记。旧版本的存档也可以继续。</p><button className="secondary-button full-width" onClick={exportSave}><ArrowDownToLine size={16} />先备份当前旅程</button><button className="primary-button full-width" onClick={() => importRef.current?.click()}><ArrowUpFromLine size={16} />选择存档并继续</button></div>}
        </> : <>
          {menu === 'journey' && <>
            <div className="journey-profile"><div className="journey-avatar"><Flower2 size={31} strokeWidth={1.1} /></div><div><span className="eyebrow">YOUR ORDINARY, PRECIOUS LIFE</span><h2>{game.name}的第 {preferences.cycles} 段人生<button onClick={() => { setNameInput(game.name); setDetail({ type: 'name' }); }} aria-label="修改名字"><Pencil size={14} /></button></h2><p>{scene.age} 岁 · {chapter.title} · {scene.location}</p></div></div>
            <div className="journey-origin"><Leaf size={17} strokeWidth={1.2} /><span>当初，你是为了「{origin.title}」而来。</span></div>
            <div className="quiet-stats"><div><Leaf size={17} /><strong>{game.energy}</strong><span>生活的余裕</span></div><div><Wallet size={17} /><strong>¥ {game.money.toLocaleString()}</strong><span>手边的积蓄</span></div><div><Heart size={17} /><strong>{game.connection}</strong><span>与小镇的羁绊</span></div></div>
            <div className="journey-section-label"><span>日子，一章一章地走</span><small>已走到第 {scene.chapter + 1} 章</small></div>
            <div className="quiet-chapters">{chapters.map((item, i) => <button key={item.id} disabled={!game.history.some(entry => scenes[entry.sceneId].chapter === i)} onClick={() => setDetail({ type: 'chapter', index: i })}><span>{String(i + 1).padStart(2, '0')}</span><div><strong>{item.title}</strong><small>{item.subtitle}</small></div>{i < scene.chapter ? <Check size={15} /> : i === scene.chapter ? <Sprout size={15} /> : <span className="chapter-unwritten" />}</button>)}</div>
            <div className="journey-save-actions"><button onClick={exportSave}><ArrowDownToLine size={16} />收藏这段旅程</button><button onClick={() => setDetail({ type: 'import' })}><ArrowUpFromLine size={16} />从存档继续</button></div><p className={`quiet-save-status ${saveError ? 'warning' : ''}`}><span />{saveError ? '暂时无法自动保存，可以先导出旅程。' : '旅程正在这个浏览器里，安静地替你收好。'}</p>
          </>}
          {menu === 'album' && <><PanelHeading eyebrow="THE LITTLE THINGS THAT STAY" title="有些温暖，记得就不会走远。" subtitle={`${game.memories.length} 段回忆，都有各自的光。`} /><div className="quiet-album">{game.memories.map((memory, i) => <button key={memory.id} className="quiet-photo" onClick={() => setDetail({ type: 'memory', memory })}><img src={memoryArt(memory)} alt="手绘动画里的生活回忆" loading="lazy" /><div><span>NO. {String(i + 1).padStart(2, '0')}</span><h3>{memory.title}</h3><p>{personalize(memory.description)}</p><small>翻开回忆<ChevronRight size={13} /></small></div></button>)}</div></>}
          {menu === 'letters' && <LettersPanel game={game} onReply={(id, reply) => setGame(replyToLetter(game, id, reply.id))} onNotify={notify} />}
          {menu === 'note' && <><PanelHeading eyebrow="DEAR ME, HOW WAS YOUR DAY?" title="这一页，留给你自己。" subtitle="想说的话，可以先轻轻写下来。" /><label className="sr-only" htmlFor="private-note">随身手记</label><textarea id="private-note" className="quiet-note" maxLength={5000} placeholder={'今天的海风是什么味道的？\n有没有一件，让你想记住的小事……'} value={note} onChange={event => setNote(event.target.value)} /><div className="quiet-note-footer"><Feather size={15} /><span>随写随存，只有你自己看见。</span><small>{note.length} / 5000</small></div></>}
          {menu === 'life' && <><PanelHeading eyebrow="A LIFE, ONE DAY AT A TIME" title="原来，已经走了这么远。" subtitle="起点、相遇和选择，慢慢成为了你。" /><LifeReview game={game} onContinue={closeMenu} onRecall={index => setDetail({ type: 'chapter', index })} /></>}
          {menu === 'settings' && <><PanelHeading eyebrow="MAKE YOURSELF COMFORTABLE" title="找一个，舒服的节奏。" subtitle="把声音和阅读，调成自己喜欢的样子。" /><div className="quiet-setting"><div><strong>听见小镇</strong><small>海风、细雨和窗边的轻响</small></div><Toggle label="环境声音" checked={sound.enabled} onChange={sound.toggle} /></div><div className="quiet-setting"><div><strong>声音轻一点</strong><small>{Math.round(sound.volume * 100)}%</small></div><input type="range" aria-label="环境音量" min="0" max="1" step="0.02" value={sound.volume} onChange={event => sound.setVolume(Number(event.target.value))} /></div><div className="quiet-setting"><div><strong>文字出现的速度</strong><small>也可以轻点一句，立即读完整段</small></div><select aria-label="文字出现的速度" value={preferences.textSpeed} onChange={event => setPreferences(p => ({ ...p, textSpeed: Number(event.target.value) }))}><option value={30}>慢慢说</option><option value={18}>自然地说</option><option value={0}>整句出现</option></select></div><div className="quiet-setting"><div><strong>大一点的故事文字</strong><small>给眼睛多一点余裕</small></div><Toggle label="故事文字放大" checked={preferences.largeText} onChange={() => setPreferences(p => ({ ...p, largeText: !p.largeText }))} /></div><div className="quiet-setting"><div><strong>减少动态</strong><small>让画面停在安静的时刻</small></div><Toggle label="减少动态" checked={preferences.quietMotion} onChange={() => setPreferences(p => ({ ...p, quietMotion: !p.quietMotion }))} /></div><div className="quiet-setting-actions"><button onClick={() => { closeMenu(); setShowTitle(true); }}><BookOpen size={16} />回到标题画面</button><button onClick={() => setDetail({ type: 'reset' })}><RotateCcw size={15} />开始新的生活</button></div></>}
        </>}
      </div>
      <footer className="journey-footer"><button onClick={closeMenu}><ArrowLeft size={15} />回到故事里</button><span><Sprout size={13} />日子很长，我们慢慢来。</span></footer>
    </JourneyDialog>}
    <input ref={importRef} className="sr-only" tabIndex={-1} type="file" accept=".json,application/json" aria-label="导入旅程文件" onChange={importSave} />
    {toast && <div className="immersive-toast" role="status"><Sprout size={16} strokeWidth={1.2} />{toast}</div>}
  </div>;
}
function PanelHeading({ eyebrow, title, subtitle }) { return <div className="quiet-panel-heading"><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{subtitle}</p></div>; }
function Toggle({ label, checked, onChange }) { return <button type="button" className={`toggle ${checked ? 'checked' : ''}`} role="switch" aria-label={label} aria-checked={checked} onClick={onChange}><span /></button>; }
function JourneyDialog({ children, onClose }) {
  const ref = useRef(null); const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement; const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const dialog = ref.current; dialog.querySelector('button')?.focus();
    const selector = 'button:not([disabled]), input:not([disabled]):not([type="file"]), select, textarea, [tabindex="0"]';
    const observer = new MutationObserver(() => { if (!dialog.contains(document.activeElement)) (dialog.querySelector('input:not([type="file"]),textarea') || dialog.querySelector('button'))?.focus(); });
    observer.observe(dialog, { childList: true, subtree: true });
    function onKey(event) {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close.current(); }
      if (event.key === 'Tab') {
        const nodes = [...dialog.querySelectorAll(selector)].filter(node => node.getClientRects().length);
        if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1)?.focus(); }
        else if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0]?.focus(); }
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => { observer.disconnect(); document.body.style.overflow = overflow; document.removeEventListener('keydown', onKey, true); previous?.focus(); };
  }, []);
  return <div className="journey-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="journey-dialog" ref={ref} role="dialog" aria-modal="true" aria-label="旅程手记">{children}</section></div>;
}
