import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Bookmark, Check, Hand, Leaf, RotateCcw, Waves, X } from 'lucide-react';
import { PaintedDecoration, PaintedStone } from './PaintedObjects.jsx';
import './town-ritual.css';

const BOOKS={
  tide:{title:'海风经过的地方',colour:'#7c998e',pages:[['小船靠岸时，天还没有黑。','她在码头坐了一会儿，把鞋里的沙慢慢倒干净。','今天没有走到灯塔。可路边的花，倒是好好看过了。'],['临窗的房间里，有人替她留了一壶热水。','她写下今天见过的一棵树，和一个没有记住名字的人。','原来，旅行也可以只写这些。'],['第二天，她还是走向了那条小路。','这次没有带上写满安排的纸，只带了一本薄薄的书。','走累的时候，恰好读到一句：你可以在这里停下来。']]},
  garden:{title:'等一片新叶',colour:'#a49b73',pages:[['搬来的第一天，她把空花盆放在窗边。','邻居给了一小袋种子，没有问她打算住多久。','“先种下吧。想走的时候，也能带着。”'],['有一天早晨，泥土里多了一点绿色。','那天的信仍然没有寄到，水壶却已经装满了。','她先给小苗浇水，然后替自己做了早饭。'],['后来，窗边有了阴影。','她把新叶画在明信片背后，寄给很远的朋友。','有些日子看起来一样，原来一直在生长。']]},
  letters:{title:'未寄出的星期六',colour:'#a38b81',pages:[['信写到一半，雨落下来了。','他没有把“你什么时候回来”写进去。','只说这条街新开了一间面包房，明天会去尝尝。'],['回信是在星期六收到的。','纸上有一滴晕开的墨，没有解释是什么。','“你说的那间店，给我留一个靠窗的位置吧。”'],['那把空椅子被擦得很干净。','窗外又落起雨，面包恰好出炉。','他把信放进木盒，起身去开门。']]},
};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export default function TownRitual({place,town,onAction,onClose,onCue,quietMotion}) {
  const shore=place==='shore',reading=town.reading,book=BOOKS[reading.book];
  const root=useRef(null),surface=useRef(null),drag=useRef(null),animation=useRef(null),washTimer=useRef(null),markDrag=useRef(null);
  const [aim,setAim]=useState(null),[flight,setFlight]=useState(null),[washing,setWashing]=useState(false),[turn,setTurn]=useState(0),[note,setNote]=useState(''),[markPreview,setMarkPreview]=useState(null);
  const action=useRef(onAction);action.current=onAction;
  const [words,setWords]=useState(town.shore.words),[quote,setQuote]=useState(reading.quote);
  useEffect(()=>{root.current?.querySelector('button')?.focus({preventScroll:true});return()=>{cancelAnimationFrame(animation.current);clearTimeout(washTimer.current);};},[]);
  function pageTo(page){onAction({type:'reading',page});setTurn(n=>n+1);onCue?.('page');}
  function markAt(event,commit=false){const b=surface.current?.getBoundingClientRect();if(!b)return;const line=clamp(Math.floor(((event.clientY-b.top)/b.height-.18)*5),0,2);if(commit){keepLine(line);setMarkPreview(null);}else setMarkPreview(line);}
  function keepLine(i){onAction({type:'reading',mark:i,keep:true});setNote('书签留在这里。明天来，仍能接着读。');onCue?.('page');}
  function cast(strength=.7,lean=0){
    if(flight)return;
    const skips=clamp(Math.round(1+strength*4+(town.shore.stone==='flat'?1:town.shore.stone==='heart'?-1:0)),1,6);
    if(quietMotion){onAction({type:'shore_cast',skips});setAim(null);setNote(`石子在水面轻轻走了 ${skips} 步，最后安静地沉进海里。`);onCue?.('water');return;}
    const length=1000+skips*330;let elapsed=0,last=null;
    setAim(null);onCue?.('water');setNote('石子离开掌心，向海面走去。');
    const step=time=>{if(!document.hidden){if(last!==null)elapsed+=Math.min(60,time-last);last=time;}else last=null;
      const progress=clamp(elapsed/length,0,1);setFlight({progress,skips,lean});
      if(progress<1)animation.current=requestAnimationFrame(step);else {action.current({type:'shore_cast',skips});setFlight(null);setNote(`石子在水面轻轻走了 ${skips} 步。最后一圈涟漪，也被海收好了。`);}
    };animation.current=requestAnimationFrame(step);
  }
  function down(e){if(!e.isPrimary||e.button!==0||flight)return;drag.current={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);setAim({distance:0,dx:0,dy:0});}
  function move(e){const d=drag.current;if(!d)return;const r=surface.current.getBoundingClientRect(),dx=(e.clientX-d.x)/r.width,dy=(e.clientY-d.y)/r.height;setAim({distance:Math.hypot(dx,dy),dx,dy});}
  function up(e,cancel=false){const d=drag.current;drag.current=null;if(!d)return;const r=surface.current.getBoundingClientRect(),dx=(e.clientX-d.x)/r.width,dy=(e.clientY-d.y)/r.height;setAim(null);if(!cancel&&Math.hypot(dx,dy)>.035)cast(clamp(Math.hypot(dx,dy)*4,.1,1),clamp(dx-dy,-.4,.4));}
  function wash(){if(washing||!words)return;setWashing(true);onCue?.('water');washTimer.current=setTimeout(()=>{onAction({type:'shore_wash'});setWashing(false);setNote('你写过的话，海已经听见了。想再写一句，也可以。');},quietMotion?100:2800);}
  const t=flight?.progress||0,first=.27,local=t<first?t/first:(t-first)/(1-first),hop=t<first?0:Math.min(flight?.skips||1,Math.floor(local*(flight?.skips||1))),phase=t<first?local:(local*(flight?.skips||1))%1;
  const stone=flight?(t<first?{x:650-330*phase,y:480-290*phase-120*Math.sin(phase*Math.PI)}:{x:320-local*190+(flight.lean||0)*60,y:190-local*100-Math.sin(phase*Math.PI)*45*(1-local)}):{x:650,y:480};
  const previewSkips=aim?clamp(Math.round(1+clamp(aim.distance*4,.1,1)*4+(town.shore.stone==='flat'?1:town.shore.stone==='heart'?-1:0)),1,6):0;
  const aimPath='M650 480C540 258 430 161 320 190';
  return <section className={`tr-world ${shore?'tr-shore':'tr-reading'} ${quietMotion?'tr-quiet':''}`} ref={root} role="dialog" aria-modal="true" aria-label={shore?'海边的慢时光':'书店里的一页光'}>
    <img className="tr-background" src={shore?'/art/play-shell-shore.webp':'/art/film-bookshop.webp'} alt=""/>
    <div className="tr-shade" aria-hidden="true"/>
    <header className="tr-header"><div><span>{shore?'沿着海堤，走到水边':'沿海书店 · 阿禾留的靠窗位置'}</span><h3>{shore?'把心事，放轻一点':'今天，只读喜欢的一页'}</h3></div><button type="button" onClick={onClose} aria-label="收好手边的小事，回到小镇"><X size={24}/></button></header>
    {shore?<>
      <div className="tr-sea-stage" ref={surface}>
        <svg viewBox="0 0 1000 660" className="tr-sea-effects" aria-hidden="true" preserveAspectRatio="none">
          <defs><radialGradient id="tr-stone-light"><stop stopColor="#c1b6a1"/><stop offset="1" stopColor="#6d7c76"/></radialGradient></defs>
          {flight&&Array.from({length:hop},(_,i)=><g key={i} className="tr-impact" style={{'--ripple-age':`${i*-.13}s`}}><ellipse cx={320-i*190/flight.skips} cy={190-i*100/flight.skips} rx={8+(hop-i)*9} ry={3+(hop-i)*3} fill="none" stroke="#f7f9da" strokeWidth="1.5" opacity={.7-(hop-i)*.08}/><path d={`M${320-i*190/flight.skips-4} ${190-i*100/flight.skips}q-7-12-10-9m14 9q4-18 8-13`} stroke="#f7f9de" strokeWidth="1.2" fill="none"/></g>)}
          {flight&&<><ellipse cx={stone.x} cy={stone.y+10} rx="9" ry="2.5" fill="#2b4d4855"/><ellipse cx={stone.x} cy={stone.y} rx="7" ry="4" fill="url(#tr-stone-light)" transform={`rotate(${t*680} ${stone.x} ${stone.y})`}/></>}
          {aim&&<g className="tr-aim-guide" data-shore-aim>
            <path className="tr-aim-outline" d={aimPath}/>
            <path className="tr-aim-line" d={aimPath}/>
            <path className="tr-aim-arrow" d="M342 171L320 190L348 198"/>
            {Array.from({length:previewSkips},(_,i)=><g key={i} className="tr-aim-landing" opacity={1-i*.09}><ellipse cx={320-i*190/previewSkips} cy={190-i*100/previewSkips} rx={i?11:21} ry={i?5:10}/><circle cx={320-i*190/previewSkips} cy={190-i*100/previewSkips} r="2.5"/></g>)}
          </g>}
          {washing&&<path className="tr-wash" d="M-150 100Q400 0 900 450Q1100 600 1200 900" fill="none" stroke="#e8f7e7bb" strokeWidth="150"/>}
        </svg>
        {!flight&&<button type="button" className={`tr-stone tr-stone-${town.shore.stone}`} data-shore-stone onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={e=>up(e,true)} onClick={e=>{if(e.detail===0)cast();}} onKeyDown={e=>{if(e.key==='ArrowUp'){e.preventDefault();cast(.95);}if(e.key==='ArrowDown'){e.preventDefault();cast(.3);}}} aria-label="握住石子，向后拉再松手；Enter轻抛，上方向键远抛"><PaintedStone kind={town.shore.stone}/><span>{aim?'松开，让它向海面走去':'握住，向后拉，再松开'}</span></button>}
        <div className={`tr-sand-words ${washing||town.shore.washed?'is-washed':''}`}>{words&&!town.shore.washed?Array.from(words).map((letter,i)=><span key={i} style={{'--letter-tilt':`${[-5,2,-2,4,0][i%5]}deg`,'--letter-rise':`${[0,-1,1,0,-2][i%5]}px`}}>{letter}</span>):''}</div>
        {aim&&<div className="tr-aim-hint" role="status">力道{aim.distance<.1?'轻轻':aim.distance<.2?'适中':'饱满'} · 预计轻跳 {previewSkips} 次</div>}
      </div>
      <aside className="tr-shore-tools"><div className="tr-stone-choices" aria-label="挑一枚顺手的石子">{[['flat','扁平的小石'],['round','圆润的小石'],['heart','心形的小石']].map(([id,name])=><button type="button" key={id} disabled={Boolean(flight)} aria-pressed={town.shore.stone===id} onClick={()=>{onAction({type:'shore_stone',stone:id});onCue?.('wood');}}><span className="tr-pebble-paint"><PaintedStone kind={id}/></span>{name}</button>)}</div><div className="tr-sand-form"><label htmlFor="tr-sand">写在沙上的一句话</label><input id="tr-sand" aria-label="写在沙上的一句话" maxLength={24} value={words} placeholder="今天，先对自己温柔一点。" onChange={e=>{setWords(e.target.value);onAction({type:'shore_words',text:e.target.value});}}/><button type="button" onClick={wash} disabled={washing||!words||town.shore.washed}><Waves size={15}/>让海水带走这句话</button></div></aside>
    </>:<>
      <nav className="tr-books" aria-label="挑一本想读的书">{Object.entries(BOOKS).map(([id,item])=><button type="button" key={id} aria-pressed={reading.book===id} onClick={()=>{onAction({type:'reading',book:id});setTurn(n=>n+1);onCue?.('page');}} style={{'--book-colour':item.colour}}><BookSpine/><span>{item.title}</span></button>)}</nav>
      <div className="tr-open-book" ref={surface} key={reading.book}>
        <div className="tr-book-cover"/>
        <article className="tr-book-left"><span>栖屿文库 · 午后的短篇</span><h4>{book.title}</h4><div className="tr-book-illustration"><PaintedDecoration item={reading.book==='garden'?'flower':reading.book==='letters'?'book':'shell'}/></div><p>阿禾在借书卡上写：<br/>“读到哪里都行，<br/>想回来时，留着这一页。”</p><small>可以拖动书签，也能轻点想留下的那句话。</small></article>
        <article className="tr-book-page" data-reading-page={reading.page} key={turn}><span className="tr-page-head">{book.title}</span><div className="tr-page-lines">{book.pages[reading.page].map((line,i)=><button type="button" className={reading.kept&&reading.keptBook===reading.book&&reading.keptPage===reading.page&&reading.mark===i?'is-marked':''} key={line} onClick={()=>keepLine(i)} aria-label={`把书签留在：${line}`}>{line}</button>)}</div><span className="tr-page-number">{String(reading.page+1).padStart(2,'0')}</span><div className="tr-page-speckle"/></article>
        <button type="button" className="tr-bookmark" data-reading-bookmark style={{top:`${19+(markPreview??reading.mark)*15}%`}} aria-label="拖动书签，留在想再读的一句" onPointerDown={e=>{if(!e.isPrimary||e.button!==0)return;markDrag.current=true;e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(markDrag.current)markAt(e);}} onPointerUp={e=>{if(markDrag.current)markAt(e,true);markDrag.current=null;}} onPointerCancel={()=>{markDrag.current=null;setMarkPreview(null);}} onKeyDown={e=>{if(['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();keepLine(clamp(reading.mark+(e.key==='ArrowUp'?-1:1),0,2));}}}><Bookmark size={20}/></button>
        <button type="button" className="tr-page-back" disabled={reading.page===0} onClick={()=>pageTo(reading.page-1)} aria-label="翻回前一页"><ArrowLeft size={20}/></button><button type="button" className="tr-page-next" disabled={reading.page===2} onClick={()=>pageTo(reading.page+1)} aria-label="翻到下一页"><ArrowRight size={20}/></button>
      </div>
      <div className="tr-reading-note"><label htmlFor="tr-quote"><Leaf size={15}/>写一句自己的页边话</label><input id="tr-quote" value={quote} maxLength={40} aria-label="留在借书卡上的话" placeholder="读到这里，想到了什么？" onChange={e=>{setQuote(e.target.value);onAction({type:'reading',quote:e.target.value});}}/><button type="button" onClick={()=>{onAction({type:'reading',keep:true});setNote('书签、页边话和借书卡，都替你收好了。小屋的书也可以摆起来了。');onCue?.('page');}}><Check size={16}/>{reading.kept?'书签已留好':'把这一页收进借书卡'}</button></div>
    </>}
    <footer className="tr-footer"><Hand size={16}/><p role="status">{note||(shore?'换一枚石子，试试不同的力道。没有分数，海会接住每一次。':'读书不用赶进度。翻页、留书签、写页边话，明天仍能从这里继续。')}</p>{shore&&town.shore.casts>0&&<small>已经陪海坐了 {town.shore.casts} 个片刻</small>}</footer>
  </section>;
}
function BookSpine(){return <svg viewBox="0 0 28 38" aria-hidden="true"><path d="M4 4Q12 0 24 4V33Q12 29 4 34Z" fill="var(--book-colour)" stroke="#e1d1ad"/><path d="M8 5V31M12 11H21M12 14H20" fill="none" stroke="#e6d9b4" strokeWidth=".8"/></svg>;}
