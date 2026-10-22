import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpFromLine, BookOpen, Check, ChevronRight, Compass, Feather, Flower2, HandHeart, Heart, Image, Leaf, Mail, NotebookPen, Pencil, RotateCcw, Route, Settings2, Sprout, Wallet, X } from 'lucide-react';
import { chapters, scenes } from './story.js';
import { origins } from './origins.js';
import { STORAGE_KEY, createGame, availableChoices, choose, serializeGame, restoreGame, reincarnate, finishIntroduction, getSceneParagraphs, replyToLetter } from './engine.js';
import { unlockedLetters } from './letters.js';
import { memoryArt, sceneArtKey } from './visuals.js';
import { activityDefinitions, activityProgress, getSceneActivity, performActivity } from './activities.js';
import Opening from './Opening.jsx';
import CinematicScene from './CinematicScene.jsx';
import LettersPanel from './LettersPanel.jsx';
import LifeReview from './LifeReview.jsx';
import LifeActivity from './LifeActivity.jsx';
import useSoundscape from './useSoundscape.js';
import useMusic from './useMusic.js';
import useNarration from './useStoryNarration.js';
import AudioSettings from './AudioSettings.jsx';
import DiscoveryScene, { PhotoCollection } from './DiscoveryScene.jsx';
import { discoveryDefinitions, discoveryProgress, sceneDiscoveries, performDiscovery } from './discoveries.js';
import TownDay from './TownDay.jsx';
import { townProgress, townJournal, performTownAction } from './townDay.js';
import './styles.css';
import './immersive.css';
import './cinematic-experience.css';
import './clarity.css';
import './town-entry.css';

const PREF_KEY = 'next-spring-preferences-v1';
const NOTES_KEY = 'next-spring-notes-v1';
const READING_KEY = 'next-spring-reading-v2';
const tabs = [
  { id: 'journey', label: '这段旅程', icon: BookOpen }, { id: 'album', label: '人生相册', icon: Image },
  { id: 'moments', label: '小镇日常', icon: HandHeart },
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
  const [activityId, setActivityId] = useState(null);
  const [discoveryId, setDiscoveryId] = useState(null);
  const [townOpen, setTownOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [note, setNote] = useState(() => read(NOTES_KEY));
  const [reading, setReading] = useState(() => validReading(parse(READING_KEY, null), game));
  const [narrationFrame, setNarrationFrame] = useState({ text: '', utteranceKey: '', paused: true });
  const [narrationCompleted, setNarrationCompleted] = useState({ utteranceKey: '', sequence: 0 });
  const [preferences, setPreferences] = useState(() => {
    const saved = parse(PREF_KEY, {});
    return { largeText: saved.largeText === true, quietMotion: saved.quietMotion === true, filmMotion: saved.filmMotion !== false,
      autoNarration: saved.autoNarration !== false,
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
  const activityTrigger = useRef(null);
  const townReturn = useRef(null);
  const scene = scenes[game.sceneId];
  const chapter = chapters[scene.chapter];
  const sceneActivity = getSceneActivity(game);
  const activeActivity = activityDefinitions.find(item => item.id === activityId);
  const activeDiscovery = discoveryDefinitions.find(item => item.id === discoveryId);
  const overlayOpen = menu !== null || Boolean(activeActivity) || Boolean(activeDiscovery) || townOpen;
  const town = townProgress(game);
  const townNotes = townJournal(game);
  const isTitle = showTitle || !game.introDone;
  const handleNarrationEnd = useCallback(({ utteranceKey }) => {
    setNarrationCompleted(previous => ({ utteranceKey, sequence: previous.sequence + 1 }));
  }, []);
  const narration = useNarration({
    text: narrationFrame.text,
    utteranceKey: narrationFrame.utteranceKey,
    paused: isTitle || overlayOpen || narrationFrame.paused || narrationFrame.utteranceKey.split(':')[1] !== scene.id,
    onError: message => notify(message), onEnd: handleNarrationEnd,
  });
  const audioScene = townOpen
    ? { id: `town-${town.place}`, image: town.place, weather: '雨后微风', time: '初秋，白天 10:00' }
    : { ...scene, image: sceneArtKey(scene) };
  const music = useMusic({ scene: audioScene, ducked: narration.speaking, onError: message => notify(message) });
  const sound = useSoundscape(audioScene, { ducked: narration.speaking, onError: message => notify(message) });
  const anySound = sound.enabled || music.enabled;
  function toggleSound() {
    const next = !anySound;
    music.setEnabled(next);
    sound.setEnabled(next);
  }
  function notify(message) { clearTimeout(toastTimer.current); setToast(message); toastTimer.current = setTimeout(() => setToast(''), 3600); }
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, serializeGame(game)); setSaveError(false); } catch { setSaveError(true); } }, [game]);
  useEffect(() => { try { localStorage.setItem(NOTES_KEY, note); } catch { setSaveError(true); } }, [note]);
  useEffect(() => { try { localStorage.setItem(PREF_KEY, JSON.stringify(preferences)); } catch { /* Still playable. */ } }, [preferences]);
  useEffect(() => { try { localStorage.setItem(READING_KEY, JSON.stringify(reading)); } catch { /* The main save is independent. */ } }, [reading]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  function openMenu(tab = 'journey') { menuTrigger.current = document.activeElement; setDetail(null); setMenu(tab); }
  function toggleNarration() {
    if (!narration.supported || narration.voices.length === 0) { openMenu('settings'); return; }
    setNarrationCompleted(current => ({ utteranceKey: '', sequence: current.sequence + 1 }));
    narration.toggle();
  }
  function replayNarration() {
    setNarrationCompleted(current => ({ utteranceKey: '', sequence: current.sequence + 1 }));
    narration.replay();
  }
  function resetNarrationSession() {
    narration.stop();
    setNarrationFrame({ text: '', utteranceKey: '', paused: true });
    setNarrationCompleted(current => ({ utteranceKey: '', sequence: current.sequence + 1 }));
  }
  function returnToTitle() { resetNarrationSession(); closeMenu(); setShowTitle(true); }
  function closeMenu() { setMenu(null); setDetail(null); requestAnimationFrame(() => { if (menuTrigger.current?.isConnected) menuTrigger.current.focus(); }); }
  function openTown() {
    townReturn.current = { element: document.activeElement, menu };
    resetNarrationSession();
    setMenu(null); setDetail(null); setActivityId(null); setDiscoveryId(null); setTownOpen(true);
  }
  function closeTown() {
    const previous = townReturn.current;
    setTownOpen(false);
    if (previous?.menu) setMenu(previous.menu);
    requestAnimationFrame(() => {
      const target = previous?.element?.isConnected ? previous.element
        : previous?.menu ? document.querySelector('.town-journal-entry button')
          : document.querySelector('.cm-town-button, .opening-town-button');
      target?.focus({ preventScroll: true });
    });
  }
  function actInTown(action) { setGame(current => performTownAction(current, action)); }
  function openDiscovery(id) {
    if (!sceneDiscoveries(game).some(d => d.id === id) && !(id !== 'photo' && discoveryProgress(game, id)?.completed)) return;
    activityTrigger.current = document.activeElement; setMenu(null); setActivityId(null); setDiscoveryId(id);
  }
  function closeDiscovery() { setDiscoveryId(null); requestAnimationFrame(() => activityTrigger.current?.isConnected && activityTrigger.current.focus()); }
  function actOnDiscovery(action) {
    setGame(current => performDiscovery(current, discoveryId, action));
    if (action.type === 'pour' && action.manual) sound.playCue?.('water');
    else if (!['pour', 'place'].includes(action.type)) sound.playCue?.(action.type === 'capture' ? 'wood' : 'touch');
  }
  function openActivity(activity = sceneActivity) {
    if (!activity) return;
    activityTrigger.current = document.activeElement;
    setMenu(null); setDetail(null); setActivityId(activity.id);
  }
  function closeActivity() {
    setActivityId(null);
    requestAnimationFrame(() => {
      const target = activityTrigger.current?.isConnected ? activityTrigger.current : document.querySelector('.cm-activity-button, .cm-menu-button');
      target?.focus();
    });
  }
  function actOnMoment(id, action) {
    const next = performActivity(game, id, action);
    if (next === game) return;
    if (action.type !== 'set_temperature') {
      const finished = activityProgress(next, id).completed && !activityProgress(game, id).completed;
      sound.playCue?.(finished ? 'complete' : id === 'repair' ? 'wood' : id === 'plant' && action.type === 'water' ? 'water' : 'touch');
    }
    setGame(current => performActivity(current, id, action));
  }
  function personalize(text) { return text.replaceAll('{name}', game.name); }
  function begin(details) { resetNarrationSession(); setGame(finishIntroduction(game, details)); setShowTitle(false); setReading({ sceneId: 'arrival', paragraphIndex: 0 }); }
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
      resetNarrationSession();
      setGame(restored); setReading(validReading(parsed.reading, restored)); setSceneSession(value => value + 1);
      setNote(typeof parsed.note === 'string' ? parsed.note.slice(0, 5000) : '');
      if (Number.isSafeInteger(parsed.cycles) && parsed.cycles > 0) setPreferences(p => ({ ...p, cycles: parsed.cycles }));
      setActivityId(null); setDiscoveryId(null); setTownOpen(false); closeMenu(); setShowTitle(!restored.introDone); notify('风翻回了熟悉的那一页。');
    } catch { notify('这份存档还没有读懂，请选择之前导出的旅程文件。'); }
    event.target.value = '';
  }
  function nextLife(carry) {
    resetNarrationSession();
    const next = carry ? reincarnate(game) : createGame(game.name, game.origin);
    setGame(next); setReading({ sceneId: 'arrival', paragraphIndex: 0 });
    if (carry) setPreferences(p => ({ ...p, cycles: p.cycles + 1 }));
    setActivityId(null); setDiscoveryId(null); setTownOpen(false); closeMenu(); setShowTitle(true);
  }
  function rename(event) {
    event.preventDefault(); const value = nameInput.trim();
    if (!value || [...value].length > 12) { setNameError('给自己一个 1—12 个字的名字吧。'); return; }
    setGame({ ...game, name: value }); setDetail(null); setNameError('');
  }
  const unread = unlockedLetters(game).filter(letter => !game.letterReplies?.[letter.id]).length;
  const origin = origins.find(item => item.id === game.origin) || origins[0];

  return <div className={`immersive-shell ${preferences.largeText ? 'large-text' : ''} ${preferences.quietMotion ? 'quiet-motion' : ''}`}>
    <div className="story-layer" inert={overlayOpen} aria-hidden={overlayOpen}>
      {isTitle ? <Opening quietMotion={preferences.quietMotion || !preferences.filmMotion} game={game} onBegin={begin} onContinue={() => setShowTitle(false)} onTown={openTown} onImport={importSave} onSound={toggleSound} soundEnabled={anySound} /> : <CinematicScene key={sceneSession}
        game={game} scene={scene} chapter={chapter} paragraphs={getSceneParagraphs(game).map(personalize)} choices={availableChoices(game)}
        initialParagraphIndex={reading.sceneId === game.sceneId ? reading.paragraphIndex : 0}
        onChoose={makeChoice} onMenu={() => openMenu()} onSound={toggleSound} soundEnabled={anySound}
        onNarrationChange={setNarrationFrame} onNarration={toggleNarration} onNarrationReplay={replayNarration}
        narrationEnabled={narration.enabled} narrationSupported={narration.supported}
        narrationSpeaking={narration.speaking} narrationCompleted={narrationCompleted} autoNarration={preferences.autoNarration}
        preferences={{ ...preferences, paused: overlayOpen }} onReincarnate={() => nextLife(true)} onReview={() => openMenu('life')} onProgress={recordProgress}
        discoveries={sceneDiscoveries(game)} onDiscover={openDiscovery}
        onTown={openTown} townDay={town.day} townCompleted={town.completed}
        activity={sceneActivity} activityDone={Boolean(sceneActivity && activityProgress(game, sceneActivity.id).completed)} onActivity={() => openActivity()}
      />}
    </div>
    {townOpen && <TownDay game={game} onAction={actInTown} onClose={closeTown} quietMotion={preferences.quietMotion || !preferences.filmMotion} onCue={cue => sound.playCue?.(cue === 'paper' ? 'touch' : cue)} onSound={toggleSound} soundEnabled={anySound} />}
    {activeDiscovery && <DiscoveryScene onPouringChange={sound.setPouring} game={game} scene={scene} discovery={activeDiscovery} onAction={actOnDiscovery} onClose={closeDiscovery} quiet={preferences.quietMotion || !preferences.filmMotion} />}
    {activeActivity && <LifeActivity game={game} activity={activeActivity} onAction={action => actOnMoment(activeActivity.id, action)} onClose={closeActivity} quietMotion={preferences.quietMotion} />}
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
          {menu === 'album' && <><PhotoCollection game={game} /><PanelHeading eyebrow="THE LITTLE THINGS THAT STAY" title="有些温暖，记得就不会走远。" subtitle={`${game.memories.length} 段回忆，都有各自的光。`} /><div className="quiet-album">{game.memories.map((memory, i) => <button key={memory.id} className="quiet-photo" onClick={() => setDetail({ type: 'memory', memory })}><img src={memoryArt(memory,{preview:true})} alt="手绘动画里的生活回忆" loading="lazy" /><div><span>NO. {String(i + 1).padStart(2, '0')}</span><h3>{memory.title}</h3><p>{personalize(memory.description)}</p><small>翻开回忆<ChevronRight size={13} /></small></div></button>)}</div></>}
          {menu === 'moments' && <>
            <PanelHeading eyebrow="A DAY HELD IN YOUR HANDS" title="有些日子，要亲手过一过。" subtitle="在面粉、木纹和一盆小花里，慢慢和小镇熟起来。" />
            <section className="town-journal-entry">
              <img src={memoryArt({ id: 'town_three_days' }, { preview: true })} alt="初秋面包房的暖光" loading="lazy" />
              <div><span className="eyebrow">初秋的三天 · 22 岁时的小镇</span><h3>{town.completed ? '那些日子，留下了你的痕迹。' : '走出故事，亲自过三个普通的日子。'}</h3><p>在五个地方走走，听听居民的近况。做一只想送给谁的面包，再把小屋布置成喜欢的样子。</p><button onClick={openTown} aria-label="走进初秋的三天"><Compass size={17} strokeWidth={1.3} />{town.completed ? '回小镇看看' : `去过第${['一','二','三'][town.day - 1] || '一'}天`}<ArrowRight size={16} /></button></div>
            </section>
            {(town.explored.length > 0 || Object.keys(town.talks).length > 0) && <div className="town-relationship-notes" aria-label="居民记得的事">{townNotes.people.map(person => <article key={person.id}><strong>{person.name}</strong><span>{person.label}</span><p>{person.text}</p></article>)}</div>}
            <p className="moment-collection-count"><HandHeart size={18} strokeWidth={1.3} />留下了 {activityDefinitions.filter(item => activityProgress(game, item.id).completed).length} 件亲手做的小事<span>进度会跟着旅程一起保存</span></p>
            <div className="moment-collection">{activityDefinitions.map(item => {
              const progress = activityProgress(game, item.id);
              const here = sceneActivity?.id === item.id;
              return <article key={item.id} className={`moment-card${progress.completed ? ' is-complete' : ''}`}>
                <div className="moment-card-art"><img src={memoryArt(item.memory,{preview:true})} alt={`${item.place}的手绘场景`} loading="lazy" /><span>{progress.completed ? <><Check size={14} />已好好记住</> : item.place}</span></div>
                <div className="moment-card-copy"><h3>{item.title}</h3><p>{item.summary}</p><button disabled={!here && !progress.completed} onClick={() => openActivity(item)}>{progress.completed ? '看看亲手留下的成果' : here ? '就在这里，试着做一做' : `路过${item.place}时，可以试试`}<ChevronRight size={15} /></button></div>
              </article>;
            })}</div>
            <div className="ds-new-discoveries">{discoveryDefinitions.map(item => { const here = item.sceneIds.includes(game.sceneId); const progress = discoveryProgress(game, item.id); return <button key={item.id} disabled={!here && !progress.completed} onClick={() => openDiscovery(item.id)}><HandHeart size={22} strokeWidth={1.2}/><span><strong>{item.title}</strong><small>{progress.completed ? '翻开亲手留下的这一刻' : here ? item.subtitle : `路过${item.place}时，可以亲手留下一刻。`}{progress.completed ? ' · 已经留下纪念' : ''}</small></span><ChevronRight size={16}/></button>; })}</div>
            <p className="moment-gentle-note"><Leaf size={15} strokeWidth={1.2} />这些小事可以慢慢做，也可以先让故事继续。</p>
          </>}
          {menu === 'letters' && <LettersPanel game={game} onReply={(id, reply) => setGame(replyToLetter(game, id, reply.id))} onNotify={notify} />}
          {menu === 'note' && <><PanelHeading eyebrow="DEAR ME, HOW WAS YOUR DAY?" title="这一页，留给你自己。" subtitle="想说的话，可以先轻轻写下来。" /><label className="sr-only" htmlFor="private-note">随身手记</label><textarea id="private-note" className="quiet-note" maxLength={5000} placeholder={'今天的海风是什么味道的？\n有没有一件，让你想记住的小事……'} value={note} onChange={event => setNote(event.target.value)} /><div className="quiet-note-footer"><Feather size={15} /><span>随写随存，只有你自己看见。</span><small>{note.length} / 5000</small></div></>}
          {menu === 'life' && <><PanelHeading eyebrow="A LIFE, ONE DAY AT A TIME" title="原来，已经走了这么远。" subtitle="起点、相遇和选择，慢慢成为了你。" /><LifeReview game={game} onContinue={closeMenu} onRecall={index => setDetail({ type: 'chapter', index })} /></>}
          {menu === 'settings' && <><PanelHeading eyebrow="MAKE YOURSELF COMFORTABLE" title="找一个，舒服的节奏。" subtitle="把声音和阅读，调成自己喜欢的样子。" />
            <AudioSettings music={music} sound={sound} narration={{ ...narration, toggle: toggleNarration }} autoNarration={preferences.autoNarration} onAutoNarration={() => setPreferences(p => ({ ...p, autoNarration: !p.autoNarration }))} />
            <div className="quiet-setting"><div><strong>流动的场景</strong><small>海面反光、炉光和茶汽轻轻流动，人物与建筑保持稳定</small></div><Toggle label="场景环境动效" checked={preferences.filmMotion} onChange={() => setPreferences(p => ({ ...p, filmMotion: !p.filmMotion }))} /></div>
            <div className="quiet-setting"><div><strong>文字出现的速度</strong><small>也可以轻点一句，立即读完整段</small></div><select aria-label="文字出现的速度" value={preferences.textSpeed} onChange={event => setPreferences(p => ({ ...p, textSpeed: Number(event.target.value) }))}><option value={30}>慢慢说</option><option value={18}>自然地说</option><option value={0}>整句出现</option></select></div><div className="quiet-setting"><div><strong>大一点的故事文字</strong><small>给眼睛多一点余裕</small></div><Toggle label="故事文字放大" checked={preferences.largeText} onChange={() => setPreferences(p => ({ ...p, largeText: !p.largeText }))} /></div><div className="quiet-setting"><div><strong>减少动态</strong><small>让画面停在安静的时刻</small></div><Toggle label="减少动态" checked={preferences.quietMotion} onChange={() => setPreferences(p => ({ ...p, quietMotion: !p.quietMotion }))} /></div><div className="quiet-setting-actions"><button onClick={returnToTitle}><BookOpen size={16} />回到标题画面</button><button onClick={() => setDetail({ type: 'reset' })}><RotateCcw size={15} />开始新的生活</button></div></>}
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
