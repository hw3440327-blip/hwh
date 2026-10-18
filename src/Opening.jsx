import React, { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Coffee, Compass, Feather, Leaf, Sprout, Upload, Volume2, VolumeX } from 'lucide-react';
import { origins } from './origins.js';
import FilmScene from './FilmScene.jsx';
import './opening.css';

const originIcons = { pause: Coffee, craft: Feather, independent: Compass };
const motes = [0, 1, 2, 3, 4, 5, 6, 7];

export default function Opening({ game, onBegin, onContinue, onImport, onSound, soundEnabled = false, quietMotion = false }) {
  const [settingUp, setSettingUp] = useState(false);
  const [name, setName] = useState(game.name || '旅人');
  const [origin, setOrigin] = useState(game.origin || origins[0].id);
  const [error, setError] = useState('');
  const importRef = useRef(null);
  const nameRef = useRef(null);
  const startRef = useRef(null);
  const id = useId();
  const echo = game.memories?.filter(memory => memory.id?.startsWith('echo:')).at(-1);
  const nameLength = Array.from(name.trim()).length;
  const canContinue = Boolean(game.introDone);

  useEffect(() => {
    setName(game.name || '旅人');
    setOrigin(game.origin || origins[0].id);
    setError('');
    if (game.introDone) setSettingUp(false);
  }, [game.name, game.origin, game.introDone]);

  useEffect(() => {
    if (!settingUp) return;
    nameRef.current?.focus({ preventScroll: true });
    function onKey(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setSettingUp(false);
        requestAnimationFrame(() => startRef.current?.focus({ preventScroll: true }));
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [settingUp]);

  function returnToTitle() {
    setSettingUp(false);
    setError('');
    requestAnimationFrame(() => startRef.current?.focus({ preventScroll: true }));
  }

  function begin(event) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || Array.from(trimmedName).length > 12) {
      setError(trimmedName ? '名字稍微短一些吧，最多可以写 12 个字。' : '写下 1—12 个字，让小镇记住你的名字。');
      nameRef.current?.focus({ preventScroll: true });
      return;
    }
    setError('');
    onBegin({ name: trimmedName, origin });
  }

  return (
    <main className={'spring-opening' + (settingUp ? ' is-setting-up' : '')}>
      <FilmScene scene={{id:'arrival'}} className="opening-landscape" quiet={quietMotion} />
      <div className="opening-film-grade" aria-hidden="true" />
      <div className="opening-atmosphere" aria-hidden="true">
        {motes.map(mote => <i key={mote} className={'opening-mote opening-mote-' + mote} />)}
        <Leaf className="opening-drifting-leaf opening-drifting-leaf-one" size={17} strokeWidth={1.2} />
        <Leaf className="opening-drifting-leaf opening-drifting-leaf-two" size={12} strokeWidth={1.3} />
      </div>

      <div className="opening-film-frame">
        <header className="opening-film-header">
          <div className="opening-wordmark"><Sprout size={19} strokeWidth={1.3} aria-hidden="true" /><span>{settingUp ? '下一次春天' : '栖屿 · 海边小镇'}</span></div>
          {onSound && <button type="button" className="opening-sound" onClick={onSound} aria-pressed={soundEnabled}>{soundEnabled ? <Volume2 size={16} strokeWidth={1.4} aria-hidden="true" /> : <VolumeX size={16} strokeWidth={1.4} aria-hidden="true" />}<span>{soundEnabled ? '配乐与海风' : '听听小镇的声音'}</span></button>}
        </header>

        {!settingUp ? (
          <section className="opening-title-stage" aria-labelledby={id + '-film-title'}>
            <div className="opening-title-emblem" aria-hidden="true"><i /><Leaf size={19} strokeWidth={1.1} /><i /></div>
            <p className="opening-film-kicker">一段属于你的，平凡而珍贵的人生</p>
            <h1 id={id + '-film-title'} className="opening-film-title">下一次春天</h1>
            <p className="opening-film-subtitle">风停在这里，故事从你开始</p>
            <p className="opening-film-intro">{canContinue ? <>你的日子已经在这里留下了痕迹。<br />歇一会儿，再从熟悉的那一页继续。</> : <>二十二岁，你带着行李来到海边。<br />从一间小屋、一顿热饭，开始新的生活。</>}</p>
            <button ref={startRef} type="button" className="opening-depart" onClick={() => canContinue ? onContinue?.() : setSettingUp(true)}><span>{canContinue ? '继续这段人生' : '从这一刻出发'}</span><ArrowRight size={18} strokeWidth={1.3} aria-hidden="true" /></button>
            {echo && <p className="opening-echo" aria-label="上一段人生的回响"><span>你依稀记得……{echo.title.replace(/^梦里的/, '')}</span></p>}
          </section>
        ) : (
          <section className="opening-character-stage" aria-labelledby={id + '-character-title'}>
            <div className="opening-character">
              <button type="button" className="opening-back" onClick={returnToTitle}><ArrowLeft size={15} strokeWidth={1.5} aria-hidden="true" /><span>回到风里</span></button>
              <div className="opening-character-heading"><span className="opening-character-kicker">在故事开始以前</span><h1 id={id + '-character-title'}>让小镇认识你。</h1><p>不用想好往后的一切。<br />先从今天，轻轻迈出一步。</p></div>

              <form className="opening-form" onSubmit={begin} noValidate>
                <label className="opening-label" htmlFor={id + '-name'}>小镇该怎么称呼你？</label>
                <div className={'opening-name-wrap' + (error ? ' has-error' : '')}>
                  <input ref={nameRef} id={id + '-name'} name="traveler-name" value={name} onChange={event => { setName(event.target.value); if (error) setError(''); }} autoComplete="nickname" maxLength={24} aria-required="true" aria-invalid={Boolean(error)} aria-describedby={id + '-name-hint' + (error ? ' ' + id + '-name-error' : '')} />
                  <span className={'opening-name-count' + (nameLength > 12 ? ' over-limit' : '')} aria-hidden="true">{nameLength}<i>/ 12</i></span>
                </div>
                <div className="opening-name-help">{error ? <p id={id + '-name-error'} className="opening-error" role="alert">{error}</p> : <p id={id + '-name-hint'}>可以是本名，也可以是你喜欢的名字。</p>}{error && <span id={id + '-name-hint'} className="opening-sr-only">名字需要填写 1 到 12 个字。</span>}</div>

                <fieldset className="opening-origins" aria-describedby={id + '-origin-hint'}>
                  <legend className="opening-label">这次，你为何而来？</legend>
                  <p id={id + '-origin-hint'} className="opening-origin-hint">每个出发点，都有自己的春天。</p>
                  <div className="opening-origin-list">
                    {origins.map(item => {
                      const Icon = originIcons[item.id] || Leaf;
                      return <label key={item.id} className={'opening-origin' + (origin === item.id ? ' is-selected' : '')}><input type="radio" name={id + '-origin'} value={item.id} checked={origin === item.id} onChange={() => setOrigin(item.id)} /><Icon className="opening-origin-symbol" size={19} strokeWidth={1.25} aria-hidden="true" /><span className="opening-origin-copy"><strong>{item.title}</strong><span>{item.description}</span></span><span className="opening-radio-mark" aria-hidden="true">{origin === item.id && <Check size={10} strokeWidth={2} />}</span></label>;
                    })}
                  </div>
                </fieldset>
                <button className="opening-begin" type="submit"><span>走进小镇</span><ArrowRight size={17} strokeWidth={1.3} aria-hidden="true" /></button>
              </form>
              <p className="opening-character-footnote"><Sprout size={12} strokeWidth={1.3} aria-hidden="true" />每一种生活，都可以慢慢过。</p>
            </div>
          </section>
        )}

        <footer className="opening-film-footer"><span className="opening-keep-note">旅程会自动替你收好</span><button type="button" className="opening-import-button" onClick={() => importRef.current?.click()}><Upload size={13} strokeWidth={1.4} aria-hidden="true" /><span>从存档继续</span></button><input ref={importRef} type="file" accept=".json,application/json" aria-label="导入旅程存档" hidden onChange={onImport} /></footer>
      </div>
    </main>
  );
}
