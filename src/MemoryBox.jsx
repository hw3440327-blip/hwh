import React, { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Ear, Feather, Hand, Leaf, RotateCcw, Sparkles, Volume2, VolumeX, Wrench, X } from 'lucide-react';
import FilmScene from './FilmScene.jsx';
import { MEMORY_BOX_INSPECTIONS, MEMORY_BOX_RECORDINGS, MEMORY_BOX_REPLIES, MEMORY_BOX_STYLES, memoryBoxProgress, memoryBoxStage } from './memoryBox.js';
import './memory-box.css';

const clamp = (n, min = 0, max = 1) => Math.min(max, Math.max(min, n));
const focusable = 'button:not([disabled]),input:not([disabled]),textarea:not([disabled]),[tabindex="0"]';
const stageNames = { inspect: '先看清它走过的日子', sand: '顺着木纹，慢慢打磨', style: '留下一点自己的修法', hinge: '让盒盖重新转得安稳', listen: '打开它，听一场旧雨', reply: '给雨那边的人，留句话', choose: '想让这份牵挂去哪里', done: '有些约定，仍然亮着' };
const stepIndex = { inspect: 0, sand: 1, style: 1, hinge: 1, listen: 2, reply: 3, choose: 3, done: 3 };
const settings = {
  workshop: { poster:'/art/film-workshop.webp', title:'旧物修补铺', caption:'林姨托来的旧木盒' },
  bakery: { poster:'/art/film-bakery.webp', title:'有光面包房', caption:'林姨重新收好的雨声木盒' },
  room: { poster:'/art/immersive-room.webp', title:'蓝门小屋 · 窗边', caption:'暂放在你窗边的雨声木盒' },
};

function BoxArt({ state, stage, id }) {
  const lid = state.repaired ? state.lid : 0;
  const angle = lid * 1.91;
  const frontY = 310 + 115 * Math.cos(angle) - 208 * Math.sin(angle);
  const frontL = 250 - 70 * Math.cos(angle), frontR = 750 + 70 * Math.cos(angle);
  const lidPath = `M250 310 L750 310 L${frontR} ${frontY} L${frontL} ${frontY}Z`;
  const grain = Array.from({ length: 14 }, (_, i) => {
    const y = 70 + i * 32;
    return <path key={i} d={`M100 ${y} C210 ${y-12} 270 ${y+15} 386 ${y+2} S590 ${y-15} 722 ${y+3} S880 ${y-5} 920 ${y+4}`} />;
  });
  return <svg className="mb-box-art" viewBox="0 0 1000 680" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={id+'-top'} x1="0" y1="0" x2=".45" y2="1"><stop stopColor="#d9b780"/><stop offset=".46" stopColor="#bc8f58"/><stop offset="1" stopColor="#a77445"/></linearGradient>
      <linearGradient id={id+'-front'} x1="0" y1="0" x2=".1" y2="1"><stop stopColor="#ae7b4e"/><stop offset=".55" stopColor="#96643f"/><stop offset="1" stopColor="#70482f"/></linearGradient>
      <linearGradient id={id+'-side'}><stop stopColor="#91633f"/><stop offset="1" stopColor="#63442d"/></linearGradient>
      <linearGradient id={id+'-brass'} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#e0c284"/><stop offset=".4" stopColor="#aa8a50"/><stop offset=".7" stopColor="#c8a86a"/><stop offset="1" stopColor="#8e7448"/></linearGradient>
      <radialGradient id={id+'-inside'} cx=".5" cy=".25" r=".8"><stop stopColor="#889186"/><stop offset=".45" stopColor="#536f69"/><stop offset="1" stopColor="#283f3c"/></radialGradient>
      <radialGradient id={id+'-rain-glow'}><stop stopColor="#f8dda2" stopOpacity=".48"/><stop offset=".5" stopColor="#d5e8d9" stopOpacity=".16"/><stop offset="1" stopColor="#c5e4dc" stopOpacity="0"/></radialGradient>
      <clipPath id={id+'-lid-clip'}><path d={lidPath}/></clipPath>
      <clipPath id={id+'-well'}><path d="M264 329 L736 329 L782 406 L218 406Z"/></clipPath>
      <filter id={id+'-shadow'} x="-25%" y="-70%" width="150%" height="240%"><feGaussianBlur stdDeviation="17"/></filter>
    </defs>
    <ellipse cx="505" cy="568" rx="345" ry="32" fill="#16251d" opacity=".46" filter={'url(#'+id+'-shadow)'} />
    <path d="M180 423 L250 310 L750 310 L820 423 L802 548 Q500 582 198 548Z" fill={'url(#'+id+'-front)'} stroke="#67462f" strokeWidth="3"/>
    <path d="M180 423 L250 310 L263 329 L218 406 L210 538 L198 548Z" fill="#bd955f" stroke="#785134" strokeWidth="2"/>
    <path d="M750 310 L820 423 L802 548 L789 538 L782 406 L736 329Z" fill={'url(#'+id+'-side)'} stroke="#65442e" strokeWidth="2"/>
    <path d="M218 406 L264 329 L736 329 L782 406Z" fill={'url(#'+id+'-inside)'} stroke="#746147" strokeWidth="2"/>
    <g clipPath={'url(#'+id+'-well)'} opacity={clamp(lid*1.45)}>
      <ellipse cx="500" cy="362" rx="300" ry="160" fill={'url(#'+id+'-rain-glow)'}/>
      {[0,1,2,3,4].map(i=><ellipse key={i} className="mb-memory-ripple" cx={315+i*83} cy={348+(i%2)*34} rx={12+i*2} ry={3+i*.4} fill="none" stroke="#daece0" strokeWidth="1.1" style={{'--mb-delay':`${i*-1.3}s`}}/>) }
      <path d="M417 338 L596 345 L579 394 L399 387Z" fill="#d8cdb0" stroke="#a59b7c" opacity=".9"/>
      <path d="M432 354 L568 360 M427 365 L552 370 M422 376 L560 381" stroke="#827d63" strokeWidth="1.6" opacity=".6"/>
      <path d="M483 373 Q507 345 535 351 Q522 375 483 373Z" fill="#8a976e" stroke="#677c57" strokeWidth="1"/>
      <path d="M485 374 L530 354" stroke="#d0c89a" strokeWidth="1.3"/>
    </g>
    <path d="M180 423 Q500 448 820 423 L816 442 Q500 468 184 442Z" fill="#c6a16d" stroke="#835a38" strokeWidth="2"/>
    <path d="M197 476 Q495 503 804 476 M198 512 Q501 541 801 512" fill="none" stroke="#d0aa78" strokeOpacity=".22" strokeWidth="2"/>
    <path d="M225 452 L230 545 M770 452 L765 545" stroke="#62432d" opacity=".35" fill="none"/>
    <g fill={'url(#'+id+'-brass)'} stroke="#7d653d" strokeWidth="1.5">
      <path d="M467 438 H534 L530 486 Q500 498 470 486Z"/>
      <path d="M478 448 H524 L521 477 Q500 484 481 477Z" fill="#be9c5e"/>
      <circle cx="501" cy="465" r="6" fill="#5d4c34"/>
      <path d="M498 468 L496 478 H506 L504 468" fill="#5d4c34" stroke="none"/>
    </g>
    <path d={lidPath} fill={'url(#'+id+'-top)'} stroke="#7e5838" strokeWidth="3"/>
    <g clipPath={'url(#'+id+'-lid-clip)'}>
      <g fill="none" stroke="#795433" strokeWidth="1.25" opacity=".3">{grain}</g>
      <path d="M353 134 Q388 111 420 132 Q447 159 417 171 Q384 184 365 160 Q350 146 370 136 Q388 128 405 141" fill="none" stroke="#795334" strokeWidth="2" opacity=".35"/>
      <path d="M645 327 Q665 312 692 327 Q709 343 687 353 Q664 362 650 344 Q641 333 659 329" fill="none" stroke="#785333" strokeWidth="2" opacity=".3"/>
      <g className="mb-unfinished-marks" opacity={Math.max(.07,(1-state.sandProgress)*.62)} fill="none" stroke="#e5c58f" strokeWidth="3" strokeLinecap="round"><path d="M318 359 L401 354 M574 366 L672 360 M392 386 L468 379 M524 342 L585 339"/></g>
      <path d={`M355 ${frontY+(310-frontY)*.52} Q447 ${frontY+(310-frontY)*.55} 532 ${frontY+(310-frontY)*.44}`} fill="none" stroke={state.style==='keep'?'#725234':'#88623e'} strokeWidth={state.style==='keep'?2.5:1.5} opacity=".65"/>
      {state.style==='leaf'&&<g transform={`translate(508 ${frontY+(310-frontY)*.55}) rotate(-14)`}><path d="M-44 5 Q-16-32 36-25 Q20 12-44 5Z" fill="#8a9a6a" stroke="#68744e" strokeWidth="1.5"/><path d="M-44 5 L31-24 M-17-7 L-18-20 M1-13 L3-27 M-21-6 L-7 3 M-2-13 L12-4" fill="none" stroke="#c7c08b" strokeWidth="1.2"/></g>}
      <path d={`M${frontL+18} ${frontY+8} L${frontR-18} ${frontY+8}`} stroke="#eed1a0" strokeWidth="2.5" opacity=".47"/>
    </g>
    <path d={`M${frontL} ${frontY} L${frontR} ${frontY} L${frontR-2} ${frontY+8} L${frontL+2} ${frontY+8}Z`} fill="#91643f" stroke="#755033" strokeWidth="1"/>
    {[0,1].map(i=><g key={i} transform={`translate(${i?668:332} 308)`}><path d="M-20-10 H20 V15 H-20Z" fill={'url(#'+id+'-brass)'} stroke="#79603a" strokeWidth="1.2"/><rect x="-23" y="-2" width="46" height="8" rx="4" fill="#a88b54" stroke="#755f3a"/><circle cx="-10" cy="-6" r="3" fill="#806743"/><circle cx="11" cy="10" r="3" fill="#806743"/><path d="M-12-6 H-8 M9 10 H13" stroke="#d6b67b" strokeWidth="1"/>{state.fasteners[i]>=1&&<path d="M-4 15 L0 19 L7 12" fill="none" stroke="#e7d6a3" strokeWidth="2"/>}</g>)}
    {state.repaired&&lid>.15&&<g className="mb-memory-sparks" opacity={clamp(lid*.45)} fill="#e9dab0">{[0,1,2,3,4].map(i=><circle key={i} cx={355+i*77} cy={291-(i%3)*31} r={1.3+(i%2)*.5} style={{'--mb-delay':`${i*-2.1}s`}}/>)}</g>}
    <path d="M219 540 Q500 570 783 540" fill="none" stroke="#d0a574" strokeWidth="2" opacity=".3"/>
  </svg>;
}

export default function MemoryBox({ game, onAction, onClose, quietMotion=false, onCue, audio={}, place='workshop' }) {
  const state=memoryBoxProgress(game), stage=memoryBoxStage(state), id=useId().replaceAll(':','');
  const setting=settings[place]||settings.workshop;
  const [inspection,setInspection]=useState(null),[sanding,setSanding]=useState(null),[sandFeedback,setSandFeedback]=useState(''),[screwTurn,setScrewTurn]=useState(null),[hidden,setHidden]=useState(document.hidden);
  const [replyDraft,setReplyDraft]=useState(state.reply||'');
  const rootRef=useRef(null),closeRef=useRef(onClose),inspectRef=useRef(inspection),sandDrag=useRef(null),lidDrag=useRef(null),screwDrag=useRef(null),suppressScrew=useRef(false);
  closeRef.current=onClose;inspectRef.current=inspection;
  const current=MEMORY_BOX_RECORDINGS[state.memoryIndex]||MEMORY_BOX_RECORDINGS[0];
  const heardCurrent=state.heard.includes(current.id);
  const readCurrent=(state.read||[]).includes(current.id);
  const understood=new Set([...state.heard,...(state.read||[])]);
  const selectedInspection=MEMORY_BOX_INSPECTIONS.find(item=>item.id===inspection);
  function act(action,cue){if(action.type!=='inspect')setInspection(null);onAction(action);if(cue)onCue?.(cue);}
  function activate(){audio.activate?.();}
  function changeLid(value){activate();act({type:'lid',value:clamp(value)});}
  useEffect(()=>{
    const previous=document.activeElement,overflow=document.body.style.overflow;document.body.style.overflow='hidden';
    rootRef.current?.querySelector('.mb-close')?.focus({preventScroll:true});
    function key(event){
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();if(inspectRef.current)setInspection(null);else closeRef.current();}
      if(event.key==='Tab'){
        const nodes=[...rootRef.current.querySelectorAll(focusable)].filter(node=>node.getClientRects().length&&!node.closest('[inert]'));
        if(!nodes.length){event.preventDefault();rootRef.current.focus();return;}
        if(event.shiftKey&&(document.activeElement===nodes[0]||!rootRef.current.contains(document.activeElement))){event.preventDefault();nodes.at(-1).focus();}
        else if(!event.shiftKey&&(document.activeElement===nodes.at(-1)||!rootRef.current.contains(document.activeElement))){event.preventDefault();nodes[0].focus();}
      }
    }
    const visibility=()=>setHidden(document.hidden);
    document.addEventListener('keydown',key,true);document.addEventListener('visibilitychange',visibility);
    return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',key,true);document.removeEventListener('visibilitychange',visibility);if(previous?.isConnected)previous.focus({preventScroll:true});};
  },[]);
  useEffect(()=>{
    requestAnimationFrame(()=>{
      const root=rootRef.current;if(!root||root.contains(document.activeElement))return;
      const preferred=stage==='listen'?(understood.has(current.id)?'.mb-actions .mb-action-primary':'.mb-lid-controls>button'):{sand:'.mb-sanding-area',style:'[data-memory-style]',hinge:'[data-memory-fastener]:not([disabled])',reply:'textarea',choose:'[data-memory-destination]',done:'.mb-kept-response button'}[stage];
      (preferred&&root.querySelector(preferred)||root.querySelector('.mb-action-primary, .mb-actions button, .mb-close'))?.focus({preventScroll:true});
    });
  },[stage,state.memoryIndex,state.heard.length,state.read?.length]);
  useEffect(()=>{
    if(document.activeElement?.getAttribute('aria-label')!=='留给木盒主人的话')setReplyDraft(state.reply||'');
  },[state.reply,state.replyChoice]);

  function sandStart(event){
    if(!event.isPrimary||event.button!==0||stage!=='sand')return;
    const box=event.currentTarget.getBoundingClientRect();sandDrag.current={x:event.clientX,y:event.clientY,width:box.width,height:box.height,dx:0,dy:0};
    event.currentTarget.setPointerCapture(event.pointerId);setSanding({x:50,y:50});
  }
  function sandMove(event){
    const d=sandDrag.current;if(!d)return;
    const dx=(event.clientX-d.x)/d.width,dy=(event.clientY-d.y)/d.height;
    if(Math.abs(dx)>Math.abs(d.dx)){d.dx=dx;d.dy=dy;}
    const box=event.currentTarget.getBoundingClientRect();setSanding({x:clamp((event.clientX-box.x)/box.width)*100,y:clamp((event.clientY-box.y)/box.height)*100});
  }
  function sandEnd(event,cancelled=false){
    const d=sandDrag.current;sandDrag.current=null;setSanding(null);
    if(d&&!cancelled){
      const along=Math.abs(d.dx)>=.08&&Math.abs(d.dy)<=Math.abs(d.dx)*.65;
      setSandFeedback(along?'这一段木纹，已经平顺了一点。':'试着顺着横向的木纹推，掌心会感觉顺一些。');
      act({type:'sand',dx:clamp(d.dx,-1,1),dy:clamp(d.dy,-1,1)},'wood');
    }
  }
  function lidStart(event){
    if(!state.repaired||!event.isPrimary||event.button!==0)return;
    activate();lidDrag.current={y:event.clientY,value:state.lid,height:event.currentTarget.closest('.mb-art-frame').clientHeight};event.currentTarget.setPointerCapture(event.pointerId);
  }
  function lidMove(event){const d=lidDrag.current;if(d)act({type:'lid',value:clamp(d.value+(d.y-event.clientY)/Math.max(100,d.height*.34))});}
  function lidEnd(cancelled=false){const d=lidDrag.current;lidDrag.current=null;if(cancelled&&d)act({type:'lid',value:d.value});}
  function screwStart(event,index){
    if(!event.isPrimary||event.button!==0)return;
    const b=event.currentTarget.getBoundingClientRect();screwDrag.current={index,x:b.x+b.width/2,y:b.y+b.height/2,start:Math.atan2(event.clientY-b.y-b.height/2,event.clientX-b.x-b.width/2),degrees:0};suppressScrew.current=false;
    event.currentTarget.setPointerCapture(event.pointerId);setScrewTurn({index,degrees:0});
  }
  function screwMove(event){const d=screwDrag.current;if(!d)return;const angle=Math.atan2(event.clientY-d.y,event.clientX-d.x);let delta=angle-d.start;while(delta>Math.PI)delta-=Math.PI*2;while(delta< -Math.PI)delta+=Math.PI*2;d.degrees=delta*180/Math.PI;setScrewTurn({index:d.index,degrees:d.degrees});}
  function screwEnd(cancelled=false){const d=screwDrag.current;screwDrag.current=null;setScrewTurn(null);if(d&&!cancelled&&Math.abs(d.degrees)>=32){suppressScrew.current=true;act({type:'fasten',index:d.index},'wood');}}

  return <section className={`mb-world ${quietMotion?'mb-quiet':''}`} role="dialog" aria-modal="true" aria-label="雨声里的木盒" data-memory-box-stage={stage} data-memory-place={place} data-memory-audio-status={audio.status||'closed'} data-memory-audio-id={audio.currentId||''} ref={rootRef} tabIndex={-1}>
    <FilmScene poster={setting.poster} scene={{id:place}} className="mb-backdrop" quiet={quietMotion} paused={hidden}/>
    <div className="mb-recollection-painting" aria-hidden="true" style={{opacity:state.repaired?clamp((state.lid-.25)*1.2)*.7:0}}><img src="/art/film-night.webp" alt=""/><svg viewBox="0 0 1000 600" preserveAspectRatio="none"><g>{Array.from({length:32},(_,i)=><path key={i} d={`M${25+i*18} ${20+i*37%120}l-4 ${24+i*11%30}`} style={{animationDelay:`${i*-.19}s`}}/>)}</g></svg></div>
    <div className="mb-world-shade" aria-hidden="true"/>
    <header className="mb-header"><div className="mb-heading"><Leaf size={23} strokeWidth={1.2}/><div><span>栖屿镇 · {setting.title}</span><h2>雨声里的木盒</h2></div></div><div className="mb-header-actions"><button type="button" onClick={()=>{activate();audio.toggle?.();}} aria-label={audio.enabled?'关闭木盒声音':'开启木盒声音'} aria-pressed={Boolean(audio.enabled)}>{audio.enabled?<Volume2 size={18}/>:<VolumeX size={18}/>}<span>{audio.enabled?'听着这场雨':'听听木盒'}</span></button><button type="button" className="mb-close" onClick={onClose} aria-label="收好木盒，回到小镇"><X size={23}/></button></div></header>
    <div className="mb-content">
      <div className="mb-workbench">
        <div className="mb-workbench-caption"><span>{setting.caption}</span><p>木纹和划痕，都记得一双手。</p></div>
        <div className="mb-art-frame" data-memory-box-object="true">
          <div className="mb-table-light" aria-hidden="true"/>
          <BoxArt state={state} stage={stage} id={id}/>
          {stage==='inspect'&&MEMORY_BOX_INSPECTIONS.map((item,i)=><button type="button" key={item.id} data-memory-inspect={item.id} className={`mb-object-point mb-inspect-${item.id}`} aria-label={`查看木盒的${item.id==='grain'?'木纹':item.id==='hinge'?'合页':'划痕'}`} onClick={()=>{setInspection(item.id);act({type:'inspect',id:item.id},'wood');}}><i/><span>{item.label}</span></button>)}
          {stage==='sand'&&<button type="button" className="mb-sanding-area" data-memory-sanding="true" aria-label="顺着木纹打磨盒盖" onPointerDown={sandStart} onPointerMove={sandMove} onPointerUp={event=>sandEnd(event)} onPointerCancel={event=>sandEnd(event,true)} onClick={event=>{if(event.detail===0)act({type:'sand',direction:'grain'},'wood');}} onKeyDown={event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();act({type:'sand',direction:'grain'},'wood');}}}><span className="mb-grain-guide"><ArrowLeft size={20}/><Hand size={24}/><ArrowRight size={20}/></span>{sanding&&<i className="mb-sanding-dust" style={{left:`${sanding.x}%`,top:`${sanding.y}%`}}/>}</button>}
          {stage==='hinge'&&[0,1].map(index=><button type="button" key={index} className={`mb-hinge-control mb-hinge-${index}${state.fasteners[index]>=1?' is-fixed':''}`} data-memory-fastener={index} disabled={state.fasteners[index]>=1} aria-label={`拧紧${index?'右':'左'}边的合页`} onPointerDown={event=>screwStart(event,index)} onPointerMove={screwMove} onPointerUp={()=>screwEnd()} onPointerCancel={()=>screwEnd(true)} onClick={event=>{if(event.detail>0&&suppressScrew.current){suppressScrew.current=false;return;}act({type:'fasten',index},'wood');}}><span style={{transform:`rotate(${screwTurn?.index===index?screwTurn.degrees:state.fasteners[index]*180}deg)`}}>{state.fasteners[index]>=1?<Check size={16}/>:<Wrench size={20}/>}</span></button>)}
          {state.repaired&&<div className="mb-lid-grip" data-memory-lid="true" role="slider" tabIndex={0} aria-label="拖动盒盖，慢慢打开" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(state.lid*100)} aria-valuetext={`木盒打开${Math.round(state.lid*100)}%，向上拖动打开，向下拖动合上`} onPointerDown={lidStart} onPointerMove={lidMove} onPointerUp={()=>lidEnd()} onPointerCancel={()=>lidEnd(true)} onKeyDown={event=>{if(['ArrowUp','ArrowRight','ArrowDown','ArrowLeft','Home','End'].includes(event.key)){event.preventDefault();changeLid(event.key==='Home'?0:event.key==='End'?1:state.lid+(['ArrowUp','ArrowRight'].includes(event.key)?.1:-.1));}}} style={{'--mb-open':state.lid}}><Hand size={17}/><span>{state.lid<.2?'握住盒盖，向上轻抬':state.lid>.8?'向下轻放，合上这场雨':'慢慢打开，再靠近一点'}</span></div>}
        </div>
        {state.repaired&&<div className="mb-lid-controls"><button type="button" onClick={()=>changeLid(state.lid<.55?1:0)} aria-label={state.lid<.55?'打开木盒':'合上木盒'}>{state.lid<.55?'打开木盒':'轻轻合上'}<Hand size={15}/></button><label htmlFor={id+'-lid'}>盒盖<input id={id+'-lid'} type="range" min="0" max="100" step="1" aria-label="木盒打开程度" value={Math.round(state.lid*100)} onChange={event=>changeLid(Number(event.target.value)/100)}/><span>{Math.round(state.lid*100)}%</span></label></div>}
      </div>
      <div className="mb-story-side">
        <ol className="mb-chapter-marks" aria-label="木盒的四个片刻">{['看木纹','慢慢修','听旧雨','留句话'].map((text,index)=><li key={text} className={stepIndex[stage]===index?'is-current':stepIndex[stage]>index?'is-done':''}><i>{stepIndex[stage]>index?<Check size={10}/>:index+1}</i>{text}</li>)}</ol>
        <span className="mb-eyebrow">一件可以继续陪人的旧物</span><h3>{stageNames[stage]}</h3>
        {selectedInspection&&<div className="mb-inspection-note" role="status"><p>{selectedInspection.text}</p><button type="button" onClick={()=>setInspection(null)} aria-label="收起木盒的观察笔记"><X size={15}/></button></div>}
        <div className="mb-actions">
          {stage==='inspect'&&<><p>周予没有急着动手。他把木盒转向光亮的一边，让你先摸摸盒盖上顺着生长的纹路。</p><p className="mb-gentle-note">点一点画里的木纹、合页和划痕，看看它真正需要什么。</p><button type="button" className="mb-action-primary" onClick={()=>{setInspection('grain');act({type:'inspect',id:'grain'},'wood');}}>沿着木纹，先看一看<ArrowRight size={16}/></button></>}
          {stage==='sand'&&<><p>纹路已经看清。把掌心放轻，顺着它向两边推。每一笔走过的地方，旧木色会慢慢柔和起来。</p><div className="mb-sanding-meter"><span aria-live="polite">{sandFeedback||'木面正在变得平顺'}</span><div role="progressbar" aria-label="盒盖打磨进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(state.sandProgress*100)}><i style={{width:`${state.sandProgress*100}%`}}/></div><small>{Math.round(state.sandProgress*100)}%</small></div><button type="button" className="mb-action-primary" onClick={()=>act({type:'sand',direction:'grain'},'wood')}>顺纹轻轻磨一笔<ArrowRight size={16}/></button><p className="mb-gentle-note">也可以在盒盖上左右拖动，或用方向键。逆着纹路时，木头会提醒你换个方向。</p></>}
          {stage==='style'&&<><p>旧划痕不必全磨掉。这一次，你想怎样把修补的痕迹留在它身上？</p><div className="mb-style-choices">{MEMORY_BOX_STYLES.map(item=><button type="button" key={item.id} data-memory-style={item.id} onClick={()=>act({type:'style',value:item.id},'wood')}><span>{item.id==='leaf'?<Leaf size={23}/>:<Feather size={23}/>}</span><strong>{item.label}</strong><small>{item.description}</small><ArrowRight size={16}/></button>)}</div></>}
          {stage==='hinge'&&<><p>木面收拾好了，再把两枚合页固定。指尖慢慢转动，盒盖就能重新开合，不会再摇晃。</p><div className="mb-fastener-status">{state.fasteners.map((value,i)=><span key={i} className={value>=1?'is-fixed':''}>{value>=1?<Check size={14}/>:<Wrench size={14}/>} {i?'右':'左'}边{value>=1?'已经稳了':value>0?'还差半圈':'轻轻转两次'}</span>)}</div><p className="mb-gentle-note">转一转画里的合页；也能轻点或用 Enter，慢慢拧稳。</p></>}
          {state.repaired&&<div className={`mb-listening ${audio.speaking?'is-speaking':''}`}>
            <div className="mb-memory-heading"><span><Ear size={16}/>{state.lid>=.55?'雨里，有人开了口':'盒盖里，藏着一场雨'}</span><div className="mb-sound-lines" aria-hidden="true"><i/><i/><i/><i/></div></div>
            <span className="mb-recording-title">{current.title}</span>{state.lid>=.55||understood.has(current.id)?<blockquote data-memory-fragment={current.id}>{current.text}</blockquote>:<p className="mb-unopened-memory">慢慢抬起盒盖。雨声后面，还藏着一句没有说完的旧话。</p>}
            {audio.enabled&&audio.status==='loading'&&<p className="mb-audio-status" role="status">盒子里的声音，正在慢慢靠近……</p>}
            {audio.enabled&&audio.status==='paused'&&state.lid>=.55&&<p className="mb-audio-status">旧话停在刚才那一句。<button type="button" onClick={activate} aria-label="继续听主人的话">接着听<ArrowRight size={13}/></button></p>}
            <div className="mb-memory-switches">{MEMORY_BOX_RECORDINGS.map((item,index)=><button type="button" key={item.id} data-memory-recording={item.id} aria-label={`听${item.title}`} aria-pressed={state.memoryIndex===index} disabled={index>understood.size} onClick={()=>{activate();act({type:'select_memory',id:item.id});}}>{state.heard.includes(item.id)?<Check size={12}/>:state.read?.includes(item.id)?<Feather size={12}/>:<span>{index+1}</span>}</button>)}<button type="button" className="mb-replay" onClick={()=>{activate();audio.replay?.();}} disabled={state.lid<.55||!audio.enabled} aria-label="重听这一段主人的话"><RotateCcw size={14}/><span>再听一遍</span></button></div>
            {audio.error&&<p className="mb-audio-error" role="alert">{typeof audio.error==='string'?audio.error:'这场雨暂时没有响起来，可以再试一次。'}<button type="button" onClick={()=>{activate();audio.replay?.();}}>再试一次</button></p>}
            {!audio.enabled&&<p className="mb-gentle-note">主人的话也留在字幕里。想听时，点右上角的声音。</p>}
            {stage==='listen'&&<>{!understood.has(current.id)&&<button type="button" className="mb-read-memory" data-memory-read={current.id} aria-label="读完这段主人的话" disabled={state.lid<.55} onClick={()=>act({type:'read_memory',id:current.id})}><Feather size={14}/>我已经读完这段话<Check size={13}/></button>}{state.lid<.55?<p className="mb-gentle-note">握住盒盖，向上抬一点。雨声先过来，旧时的声音随后才靠近。</p>:<p className="mb-gentle-note">{heardCurrent?'这句话，已经被你好好听见。':readCurrent?'这句话，已经被你好好读过。':'给这句话一点时间，等它慢慢说完。'}</p>}{understood.has(current.id)&&state.memoryIndex<MEMORY_BOX_RECORDINGS.length-1&&<button type="button" className="mb-action-primary" onClick={()=>{activate();act({type:'next_memory'});}}>听下一段雨声<ArrowRight size={16}/></button>}</>}
          </div>}
          {(stage==='reply'||stage==='choose')&&<><p>雨里的声音，是林姨年轻时送别一位旧友的夜晚。那位朋友后来仍会来信，约好的那盏灯也一直留着。</p><label className="mb-reply-label" htmlFor={id+'-reply'}><Feather size={15}/>你想给她留一句什么？</label><textarea id={id+'-reply'} aria-label="留给木盒主人的话" maxLength={60} rows={2} value={replyDraft} placeholder="也许下一次桂花开的时候，我们能坐下来一起喝茶。" onChange={event=>{setReplyDraft(event.target.value);act({type:'reply',text:event.target.value});}}/><div className="mb-reply-choices">{MEMORY_BOX_REPLIES.map(item=><button type="button" key={item.id} data-memory-reply={item.id} onClick={()=>act({type:'reply_choice',id:item.id})}>{item.text}<ArrowRight size={15}/></button>)}</div><p className="mb-gentle-note">写下的话会随旅程保存，也可以挑一句贴近心意的话。</p></>}
          {stage==='choose'&&<><p>盒子已经能开合，你留下的话也在这里。现在，你想让这份牵挂去哪里？</p><div className="mb-destination-choices"><button type="button" className="mb-action-primary" data-memory-destination="return" onClick={()=>act({type:'destination',value:'return'},'complete')}>把木盒还给林姨<ArrowRight size={16}/></button><button type="button" className="mb-action-secondary" data-memory-destination="window" onClick={()=>act({type:'destination',value:'window'},'complete')}>先留在自己的窗边<Leaf size={16}/></button></div><p className="mb-gentle-note">归还后，她会记得你的修法；留下时，小屋会多一处可以听雨的地方。</p></>}
          {stage==='done'&&<div className="mb-kept-response"><Check size={19}/><p>{state.destination==='return'?'木盒回到了林姨手中。她说想把旧友的来信重新装好，等下一次桂花开时，再一起翻看。':'你把木盒放在蓝门小屋的窗边。风经过时，里面那场雨仍安静地等你打开。'}</p>{state.reply&&<blockquote>{state.reply}</blockquote>}<button type="button" className="mb-action-secondary" onClick={onClose}>收好这一刻，回到小镇<ArrowLeft size={15}/></button></div>}
        </div>
      </div>
    </div>
    <footer className="mb-footer"><span><Leaf size={14}/>{stage==='listen'?'雨声会等你，盒盖也可以随时合上。':'不必赶时间，手上的这一点变化，会替你留下。'}</span><small>初秋的一件小事 · 随旅程保存</small></footer>
  </section>;
}
