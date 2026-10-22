import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, Compass, Feather, Flame, Flower2, Gift, Hand, Heart, Leaf, MapPin, Moon, PackageOpen, Plus, ShoppingBag, Sprout, Sun, Volume2, VolumeX, Wheat, Wind, X } from 'lucide-react';
import FilmScene from './FilmScene.jsx';
import { ARTWORK_ASSETS, artworkPreview } from './artworkAssets.js';
import { TOWN_PLACES, TOWN_PEOPLE, TOWN_RECIPES, TOWN_SHAPES, TOWN_DECORATIONS, TOWN_SLOTS, townProgress, townDialogue, townJournal, townStage, townDecorationUnlocked } from './townDay.js';
import { memoryBoxProgress, memoryBoxFollowUp } from './memoryBox.js';
import { bakeryConsequences } from './bakeryLife.js';
import './town-day.css';

const days = ['雨后的第一天', '有人记得的第二天', '把生活留下的第三天'];
const spotIcon = { room: Flower2, bakery: Wheat, bookshop: BookOpen, workshop: Hand, shore: Wind };
const personPositions = { lin: [23, 51], he: [45, 52], zhou: [51, 52] };
const focusable = 'button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex="0"]';
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const textureText = {pale:'浅色柔软',soft:'松软',crisp:'脆边',toasty:'焦香'};

function BreadArt({ recipe = 'milk', shape = 'round', baked = true, heat = 180, kneads = 0, ingredients = [], tiny = false, handmade = null }) {
  if(handmade?.finish==='soup')return <svg className={'td-bread-art'+(tiny?' is-tiny':'')} viewBox="0 0 360 245" aria-hidden="true"><ellipse cx="181" cy="215" rx="145" ry="14" fill="#53472d" opacity=".15"/><path d="M140 121Q151 218 241 218Q320 217 329 121Z" fill="#a7b99b" stroke="#71856d" strokeWidth="2"/><ellipse cx="235" cy="120" rx="94" ry="28" fill="#d8c399" stroke="#7c9275" strokeWidth="3"/><ellipse cx="235" cy="120" rx="79" ry="20" fill="#b88b55"/>{[0,1,2,3].map(i=><path key={i} d={`M${24+i*36} ${120+i%2*10}q-5-38 19-43q26 0 29 40l3 72q-20 12-43-1Z`} fill="#bc8f55" stroke="#967448" strokeWidth="2"/>)}<path d="M207 77Q195 60 208 41M251 74Q243 56 257 36" fill="none" stroke="#c4b598" strokeWidth="2"/></svg>;
  const crust = heat >= 195 ? '#ac734b' : heat <= 165 ? '#e7bc82' : '#d3995a';
  return <svg className={'td-bread-art' + (tiny ? ' is-tiny' : '')} viewBox="0 0 360 245" aria-hidden="true" focusable="false">
    <ellipse cx="180" cy="214" rx="119" ry="13" fill="#6c5840" opacity=".12" />
    {!baked && <g><path d="M49 137 Q56 226 180 227 Q305 226 311 137Z" fill="#ac8059" stroke="#795c43" strokeWidth="2"/><path d="M62 165 Q179 200 298 165M79 197 Q179 225 281 197" stroke="#d6b07f" strokeWidth="2" opacity=".6" fill="none"/><ellipse cx="180" cy="137" rx="131" ry="35" fill="#d0ac7d" stroke="#8b6846" strokeWidth="2"/><ellipse cx="180" cy="137" rx="115" ry="25" fill="#785e44"/>
      {ingredients.length === 1 && <path d="M92 138 Q120 126 145 98 Q168 91 180 111 Q201 92 221 117 L267 143 Q180 168 92 138Z" fill="#f4e8c9"/>}
      {ingredients.length > 1 && <g className="td-dough-body" style={{ '--knead-shape': kneads % 2 ? '.94' : '1' }}><path d="M84 146 C88 103 129 76 184 83 C236 78 275 102 278 146 C246 180 116 180 84 146Z" fill="#e8d4a5" stroke="#c3a778" strokeWidth="2"/><path d="M117 132 Q143 117 177 133 Q206 147 242 127" stroke="#c6ac7c" fill="none" strokeWidth="3" strokeLinecap="round"/><path d="M132 105 Q152 97 171 99" stroke="#fff6df" strokeWidth="4" fill="none" strokeLinecap="round"/></g>}
    </g>}
    {baked && <g>
      <path d={shape === 'leaf' ? 'M75 191 Q77 99 179 50 Q282 95 285 191 Q180 233 75 191Z' : shape === 'twist' ? 'M72 183 Q58 140 100 123 Q91 82 139 79 Q164 41 196 76 Q241 62 254 104 Q294 108 288 158 Q304 197 265 206 Q155 234 72 183Z' : 'M73 184 C66 106 108 63 181 64 C252 63 293 112 286 183 C256 220 103 224 73 184Z'} fill={crust} stroke="#9e754e" strokeWidth="2"/>
      {shape === 'twist' ? <path d="M113 106 Q160 123 182 159 Q214 186 257 183 M164 84 Q191 113 235 127 M88 154 Q123 151 146 192" stroke="#f2d29b" strokeWidth="12" strokeLinecap="round" fill="none"/> : shape === 'leaf' ? <path d="M178 84 L178 195 M133 129 L175 157 M224 130 L181 160 M114 165 L175 191 M243 167 L183 193" stroke="#f3d5a0" strokeWidth="9" strokeLinecap="round" fill="none"/> : <path d="M124 111 Q149 124 169 151 M175 90 Q205 110 224 141 M103 149 Q127 162 145 185" stroke="#f4d49c" strokeWidth="11" strokeLinecap="round" fill="none"/>}
      <path d="M90 184 Q181 220 270 182" stroke="#f5d29a" strokeWidth="3" opacity=".65" fill="none"/>
      {recipe === 'fruit' && [ [109,154],[142,91],[209,170],[242,135],[178,195] ].map(([x,y],i)=><ellipse key={i} cx={x} cy={y} rx="5" ry="7" transform={`rotate(${i*27} ${x} ${y})`} fill="#8c5f48"/>)}
      {recipe === 'sesame' && Array.from({length:16},(_,i)=><ellipse key={i} cx={102+(i*41)%149} cy={101+(i*23)%87} rx="2" ry="4" transform={`rotate(${i*37} ${102+(i*41)%149} ${101+(i*23)%87})`} fill="#eddaad"/>)}
    </g>}
    {baked && !tiny && <g className="td-bread-steam" fill="none" stroke="#b1a489" strokeWidth="2" strokeLinecap="round"><path d="M146 45 Q134 31 147 19 Q154 9 148 1"/><path d="M186 41 Q173 26 186 13 Q191 7 188 0"/><path d="M224 49 Q213 36 226 23 Q232 14 228 5"/></g>}
  </svg>;
}

function DecorationArt({ item, age = 0 }) {
  if (item === 'flower') return <svg viewBox="0 0 100 120" aria-hidden="true"><ellipse cx="50" cy="109" rx="31" ry="5" fill="#34402b" opacity=".15"/><path d="M28 77 L34 106 Q50 116 67 106 L72 77Z" fill="#b88665" stroke="#895e48"/><ellipse cx="50" cy="77" rx="23" ry="6" fill="#d2a17b"/><ellipse cx="50" cy="76" rx="19" ry="4" fill="#645341"/><path d={age > 0 ? 'M50 77 Q54 54 49 29' : 'M50 77 Q47 59 52 49'} fill="none" stroke="#62774e" strokeWidth="3"/><path d={age > 0 ? 'M50 60 Q29 61 30 45 Q46 43 50 60 M50 48 Q69 51 73 33 Q57 34 50 48' : 'M50 68 Q34 70 35 58 Q46 55 50 68 M51 58 Q65 59 67 48 Q56 48 51 58'} fill="#8fa478" stroke="#647f50" strokeWidth=".7"/>{age > 1 ? <g transform="translate(49 27)">{[0,60,120,180,240,300].map(a=><ellipse key={a} cy="-10" rx="7" ry="12" transform={`rotate(${a})`} fill={age > 1 ? '#d9b0b1' : '#e5c3c2'} stroke="#b48791" strokeWidth=".5"/>)}<circle r="5" fill="#d7b66d"/></g> : <ellipse cx={age>0?49:52} cy={age>0?28:47} rx="4" ry="7" fill="#d8b3b5"/>}</svg>;
  if (item === 'shell') return <svg viewBox="0 0 100 100" aria-hidden="true"><ellipse cx="50" cy="79" rx="34" ry="6" fill="#544a37" opacity=".13"/><path d="M17 60 Q9 42 24 35 Q24 18 39 21 Q48 8 59 21 Q77 18 78 35 Q94 40 83 60 L61 78 Q49 84 39 77Z" fill="#ddc9ae" stroke="#ac9375" strokeWidth="1.2"/><path d="M50 74 L24 38 M50 74 L39 24 M50 74 L59 24 M50 74 L77 38 M50 74 L18 58 M50 74 L82 58" stroke="#b79e81" fill="none" strokeWidth="1.4"/><path d="M39 78 Q49 70 61 78" stroke="#f5ead3" strokeWidth="4" fill="none"/></svg>;
  if (item === 'book') return <svg viewBox="0 0 100 100" aria-hidden="true"><ellipse cx="51" cy="81" rx="36" ry="5" fill="#34402b" opacity=".15"/><path d="M17 35 L54 23 L86 43 L84 77 L47 88 L17 66Z" fill="#819483" stroke="#526b5d"/><path d="M20 41 L49 60 L83 49 L82 71 L48 81 L20 62Z" fill="#e8dfc5"/><path d="M22 48 L48 66 L80 56 M22 55 L48 73 L80 63" stroke="#c0b79b" strokeWidth=".9" fill="none"/><path d="M17 35 L48 56 L86 43 M48 56 L47 88" stroke="#526b5d" fill="none"/><path d="M56 33 L63 35 L59 45 L52 43Z" fill="#b67d69"/></svg>;
  return <svg viewBox="0 0 100 100" aria-hidden="true"><ellipse cx="50" cy="88" rx="29" ry="5" fill="#34402b" opacity=".15"/><path d="M25 35 L35 27 L69 28 L77 37 L74 85 Q50 92 25 85Z" fill="#c9ad7c" stroke="#967e57" strokeWidth="1"/><path d="M25 35 L35 42 L69 41 L77 37 L67 50 L35 49Z" fill="#9f8358" stroke="#8b744f" strokeWidth=".7"/><path d="M32 43 Q28 15 45 13 Q64 14 60 45Z" fill="#d5a26b" stroke="#a97b4b"/><path d="M48 44 Q49 20 65 21 Q81 26 72 45Z" fill="#dcb27a" stroke="#b38a55"/><path d="M38 24 L48 32 M58 29 L66 35" stroke="#f5dba7" strokeWidth="4" strokeLinecap="round"/><path d="M25 43 L36 50 L67 49 L77 39 L74 85 Q51 91 26 85Z" fill="#d1b788" stroke="#a28d63"/><path d="M35 52 L35 84 M68 51 L68 84 M28 80 Q49 87 73 81" stroke="#b19a70" fill="none" strokeWidth="1"/><path d="M44 63 Q50 59 56 63 L56 72 Q50 76 44 72Z" fill="none" stroke="#9a9870"/><path d="M46 64 L53 71 M51 64 L48 71" stroke="#9a9870" strokeWidth=".7"/></svg>;
}

function KneadDough({ craft, onKnead }) {
  const drag = useRef(null), suppress = useRef(false);
  function finish(event, cancelled = false) {
    const moved = drag.current?.distance || 0;
    drag.current = null;
    event.currentTarget.style.setProperty('--dough-push', '0px');
    event.currentTarget.removeAttribute('data-dragging');
    if (!cancelled && moved >= 24) { suppress.current = true; onKnead(); }
  }
  return <button type="button" className="td-dough" aria-label="轻轻揉一下面团" onPointerDown={event=>{
    if (!event.isPrimary || event.button !== 0) return;
    suppress.current = false;drag.current = {x:event.clientX,y:event.clientY,distance:0};
    event.currentTarget.setPointerCapture(event.pointerId);event.currentTarget.dataset.dragging='true';
  }} onPointerMove={event=>{
    const d=drag.current;if(!d)return;d.distance=Math.max(d.distance,Math.hypot(event.clientX-d.x,event.clientY-d.y));
    event.currentTarget.style.setProperty('--dough-push',`${clamp((event.clientY-d.y)*.25,-15,15)}px`);
  }} onPointerUp={event=>finish(event)} onPointerCancel={event=>finish(event,true)} onClick={event=>{
    if(event.detail>0&&suppress.current){suppress.current=false;return;}suppress.current=false;onKnead();
  }}><BreadArt baked={false} {...craft}/><span><Hand size={15}/>轻按，或推开再收回来</span></button>;
}

export default function TownDay({ game, onAction, onClose, quietMotion=false, onCue, onSound, soundEnabled=false, onMemoryBox, onBakery, paused=false }) {
  const town=townProgress(game), journal=townJournal(game);
  const place=TOWN_PLACES.find(p=>p.id===town.place)||TOWN_PLACES[0];
  const person=TOWN_PEOPLE.find(p=>p.place===town.place);
  const [panel,setPanel]=useState(null),[selectedPerson,setSelectedPerson]=useState(null),[detail,setDetail]=useState(null);
  const [selectedSlot,setSelectedSlot]=useState('window'),[giftId,setGiftId]=useState(''),[cardText,setCardText]=useState(town.card||'');
  const [message,setMessage]=useState(''),[ghost,setGhost]=useState(null),[showIntro,setShowIntro]=useState(town.explored.length===0);
  const [frame,setFrame]=useState({width:1672,height:941});
  const [readyArt,setReadyArt]=useState(null),[previousArt,setPreviousArt]=useState(null);
  const lastLoadedArt=useRef(null),currentArt=useRef(place.art);currentArt.current=place.art;
  const rootRef=useRef(null),stageRef=useRef(null),panelRef=useRef(null),closeRef=useRef(onClose),panelState=useRef(panel),panelTrigger=useRef(null),last=useRef(town),decorDrag=useRef(null),suppressDecor=useRef(false),messageTimer=useRef(null),panDrag=useRef(null);
  closeRef.current=onClose;panelState.current=panel;
  const recipe=TOWN_RECIPES.find(r=>r.id===town.craft.recipe)||TOWN_RECIPES[0];
  const stage=townStage(town.craft);
  const dialogue=selectedPerson?townDialogue(game,selectedPerson):null;
  const pickedBread=town.breads.find(b=>b.id===giftId)||town.breads[0];
  const alreadyGifted=Boolean(selectedPerson&&town.gifts.some(g=>g.day===town.day&&g.person===selectedPerson));
  const seenCount=place.hotspots.filter(h=>town.explored.includes(h.id)).length;
  const boxState=memoryBoxProgress(game),boxEcho=memoryBoxFollowUp(game,place.id);
  const pausedRef=useRef(paused);pausedRef.current=paused;
  const personEcho=selectedPerson?memoryBoxFollowUp(game,selectedPerson):null;
  const bakeryEcho=bakeryConsequences(game);

  function flash(text){clearTimeout(messageTimer.current);setMessage(text);messageTimer.current=setTimeout(()=>setMessage(''),5200);}
  function act(action,cue='touch'){onAction(action);if(cue)onCue?.(cue);}
  function openPanel(value){panelTrigger.current=document.activeElement;setPanel(value);setShowIntro(false);}
  function closePanel(){setPanel(null);setDetail(null);setGhost(null);decorDrag.current=null;requestAnimationFrame(()=>{if(panelTrigger.current?.isConnected)panelTrigger.current.focus({preventScroll:true});});}
  function visit(id){act({type:'visit',place:id},'paper');setPanel(null);setDetail(null);setShowIntro(false);}
  function explore(hotspot){act({type:'explore',hotspot:hotspot.id},'paper');setDetail(hotspot);openPanel('detail');}
  function talk(id){setSelectedPerson(id);setGiftId('');openPanel('talk');}

  useEffect(()=>{
    const previous=document.activeElement,overflow=document.body.style.overflow;document.body.style.overflow='hidden';
    rootRef.current?.querySelector('.td-close')?.focus({preventScroll:true});
    function key(event){
      const root=rootRef.current;if(!root||pausedRef.current||root.closest('[inert]'))return;
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();if(panelState.current){setPanel(null);setGhost(null);decorDrag.current=null;requestAnimationFrame(()=>panelTrigger.current?.isConnected&&panelTrigger.current.focus({preventScroll:true}));}else closeRef.current();}
      if(event.key==='Tab'){
        const nodes=[...root.querySelectorAll(focusable)].filter(n=>n.getClientRects().length&&!n.closest('[inert]'));
        if(!nodes.length){event.preventDefault();root.focus();return;}
        const active=document.activeElement;
        if(event.shiftKey&&(active===nodes[0]||!root.contains(active))){event.preventDefault();nodes.at(-1).focus();}
        else if(!event.shiftKey&&(active===nodes.at(-1)||!root.contains(active))){event.preventDefault();nodes[0].focus();}
      }
    }
    document.addEventListener('keydown',key,true);
    return()=>{clearTimeout(messageTimer.current);document.body.style.overflow=overflow;document.removeEventListener('keydown',key,true);if(previous?.isConnected)previous.focus({preventScroll:true});};
  },[]);
  useEffect(()=>{
    if(panel)requestAnimationFrame(()=>panelRef.current?.querySelector('button,input,select,textarea')?.focus({preventScroll:true}));
  },[panel]);
  useEffect(()=>{
    if(town.gifts.length>last.current.gifts.length){const gift=town.gifts.at(-1);flash(gift.response);}
    if(town.day!==last.current.day){flash(`第${town.day}天。昨天留下的小事，今天还在。`);setCardText(town.card||'');}
    if(town.completed&&!last.current.completed)flash('初秋的三天，已经放进你的人生相册。');
    last.current=town;
  },[town.gifts.length,town.day,town.completed]);
  useEffect(()=>{if(lastLoadedArt.current&&lastLoadedArt.current!==place.art)setPreviousArt(lastLoadedArt.current);},[place.art]);
  useEffect(()=>{if(readyArt!==place.art)return;const timer=setTimeout(()=>setPreviousArt(null),quietMotion?0:460);return()=>clearTimeout(timer);},[readyArt,place.art,quietMotion]);
  useEffect(()=>{if(document.activeElement!==document.body)return;if(panel==='craft'&&stage==='bake')panelRef.current?.querySelector('input[type=range]')?.focus({preventScroll:true});else if(panel==='talk'&&dialogue?.selected)(panelRef.current?.querySelector('.td-gift-choice select,.td-gift-area button')||panelRef.current?.querySelector('button'))?.focus({preventScroll:true});},[stage,dialogue?.selected,panel]);
  useEffect(()=>{
    const viewport=stageRef.current;if(!viewport)return;
    const asset=ARTWORK_ASSETS[place.art],ratio=asset?asset.width/asset.height:1672/941;
    function measure(){const width=Math.max(viewport.clientWidth,viewport.clientHeight*ratio);setFrame({width,height:width/ratio});}
    measure();const observer=new ResizeObserver(measure);observer.observe(viewport);
    return()=>observer.disconnect();
  },[place.art]);
  useEffect(()=>{const viewport=stageRef.current;if(viewport)requestAnimationFrame(()=>{viewport.scrollLeft=(viewport.scrollWidth-viewport.clientWidth)/2;viewport.scrollTop=0;});},[place.id,frame.width,frame.height]);
  useEffect(()=>{if(panel!=='decorate')setCardText(town.card||'');},[town.card,panel]);

  function panDown(event){
    if(event.pointerType!=='mouse'||event.button!==0||event.target.closest('button,input,textarea,select'))return;
    const v=event.currentTarget;panDrag.current={x:event.clientX,y:event.clientY,left:v.scrollLeft,top:v.scrollTop};v.setPointerCapture(event.pointerId);v.dataset.panning='true';event.preventDefault();
  }
  function panMove(event){const d=panDrag.current;if(!d)return;event.currentTarget.scrollLeft=d.left-(event.clientX-d.x);event.currentTarget.scrollTop=d.top-(event.clientY-d.y);}
  function panEnd(event){panDrag.current=null;delete event.currentTarget.dataset.panning;}
  function decorationDown(event,item){
    if(!event.isPrimary||event.button!==0||!townDecorationUnlocked(game,item))return;
    suppressDecor.current=false;decorDrag.current={item,x:event.clientX,y:event.clientY,distance:0};event.currentTarget.setPointerCapture(event.pointerId);
  }
  function decorationMove(event){
    const d=decorDrag.current;if(!d)return;d.distance=Math.max(d.distance,Math.hypot(event.clientX-d.x,event.clientY-d.y));
    if(d.distance>7)setGhost({item:d.item,x:event.clientX,y:event.clientY});
  }
  function decorationUp(event,cancelled=false){
    const d=decorDrag.current;decorDrag.current=null;setGhost(null);if(!d)return;
    if(d.distance>7){suppressDecor.current=true;if(!cancelled){const slot=[...rootRef.current.querySelectorAll('[data-town-slot]')].find(node=>{const b=node.getBoundingClientRect();return event.clientX>=b.left&&event.clientX<=b.right&&event.clientY>=b.top&&event.clientY<=b.bottom;});if(slot){setSelectedSlot(slot.dataset.townSlot);act({type:'decorate',slot:slot.dataset.townSlot,item:d.item},'wood');flash('一件喜欢的东西，找到了自己的位置。');}else flash('可以把它放进画面里的虚线位置，也可以先选位置，再轻点物件。');}}
  }
  const placeIcon=spotIcon[place.id]||Leaf;
  const PlaceIcon=placeIcon;
  const hint=town.explored.length===0?'先看看画面里的小光点。每一件东西，都可能藏着一点生活的线索。':town.gifts.length===0?'可以听听居民的近况，再亲手做一只面包，带给想见的人。':'你送出的东西、说过的话和屋里的摆放，都会被这个小镇记住。';

  return <section className={`td-world ${quietMotion?'td-quiet':''} ${paused?'td-paused':''} ${panel?'has-panel':''} ${panel==='decorate'?'td-arranging':''} ${readyArt!==place.art?'td-loading':''}`} role="dialog" aria-modal="true" aria-label="初秋的三天" tabIndex={-1} ref={rootRef} data-town-place={place.id} data-town-day={town.day}>
    <header className="td-header">
      <div className="td-day-mark"><Sprout size={23} strokeWidth={1.2}/><div><span>初来小镇 · 二十二岁的初秋</span><h2>{days[town.day-1]}</h2></div><ol aria-label={`初秋三天，现在是第${town.day}天`}>{[1,2,3].map(d=><li key={d} className={town.day===d?'is-today':town.day>d?'is-lived':''}><span>{d<town.day?<Check size={11}/>:d}</span></li>)}</ol></div>
      <nav aria-label="随身物件" className="td-top-actions">{onSound&&<button type="button" onClick={onSound} aria-label={soundEnabled?'关闭小镇声音':'开启小镇声音'} aria-pressed={soundEnabled}>{soundEnabled?<Volume2 size={19}/>:<VolumeX size={19}/>}<span>{soundEnabled?'声音已开启':'听听小镇'}</span></button>}<button type="button" onClick={()=>openPanel('map')} aria-label="打开小镇地图"><Compass size={20}/><span>小镇地图</span></button><button type="button" onClick={()=>openPanel('bag')} aria-label="打开随身布袋"><ShoppingBag size={19}/><span>随身布袋</span>{town.breads.length>0&&<i>{town.breads.length}</i>}</button><button type="button" onClick={()=>openPanel('journal')} aria-label="翻开初秋手记"><BookOpen size={19}/><span>初秋手记</span></button><button type="button" className="td-close" onClick={onClose} aria-label="收好这一天，回到故事"><X size={24}/></button></nav>
    </header>

    <div className="td-scene-wrap">
      <div className="td-place-caption"><PlaceIcon size={17} strokeWidth={1.3}/><span>{place.name}</span><small>{readyArt===place.art?place.subtitle:'正在慢慢走近…'}</small></div>
      <div className="td-scene-view" ref={stageRef} onPointerDown={panDown} onPointerMove={panMove} onPointerUp={panEnd} onPointerCancel={panEnd} aria-label={`${place.name}的可探索画面，可左右滑动`}>
        <div className="td-scene-map" data-town-painting={place.id} aria-busy={readyArt!==place.art} style={{width:frame.width,height:frame.height}}>
          <FilmScene key={place.art} poster={place.art} scene={{id:place.id}} quiet={quietMotion} paused={paused} className="td-painting" onImageLoad={()=>{if(currentArt.current===place.art){setReadyArt(place.art);lastLoadedArt.current=place.art;}}}/>{previousArt&&<FilmScene poster={previousArt} quiet={true} className={`td-painting td-painting-previous ${readyArt===place.art?'is-leaving':''}`}/>}
          <div className="td-scene-vignette" aria-hidden="true"/>
          {place.id==='room'&&TOWN_SLOTS.map(slot=>{
            const decoration=town.decor[slot.id];const age=decoration?Math.max(0,town.day-decoration.placedDay):0;
            return <button key={slot.id} type="button" className={`td-decor-slot ${panel==='decorate'?'is-arranging':''} ${selectedSlot===slot.id&&panel==='decorate'?'is-chosen':''} ${decoration?'has-item':''}`} data-town-slot={slot.id} data-town-growth={decoration?.item==='flower'?age:undefined} style={{left:`${slot.x}%`,top:`${slot.y}%`}} aria-label={`${slot.name}${decoration?'，已摆放'+(TOWN_DECORATIONS.find(i=>i.id===decoration.item)?.name||'物件'):''}`} onClick={()=>{setSelectedSlot(slot.id);if(panel!=='decorate')openPanel('decorate');}}>
              {decoration?<DecorationArt item={decoration.item} age={age}/>:panel==='decorate'?<Plus size={20}/>:null}
              <span>{slot.name}{decoration?.item==='flower'&&age>0?(age>1?' · 花开了':' · 长新叶了'):''}</span>
            </button>;
          })}
          {place.id==='room'&&town.card&&<button type="button" className="td-room-card" onClick={()=>openPanel('decorate')} aria-label="看看留在家里的卡片" style={{left:'37%',top:'66%'}}><Feather size={12}/><span>{town.card}</span></button>}
          {onMemoryBox&&(place.id==='workshop'||boxEcho?.showBox)&&<button type="button" className="td-memory-box-object" data-town-memory-box style={{left:place.id==='workshop'?'67%':place.id==='room'?'57%':'76%',top:place.id==='workshop'?'74%':place.id==='room'?'62%':'67%'}} aria-label={place.id==='workshop'?'修复雨声里的木盒':boxEcho.objectLabel} onClick={onMemoryBox}><svg viewBox="0 0 160 110" aria-hidden="true"><ellipse cx="82" cy="96" rx="68" ry="7" fill="#222b22" opacity=".18"/><path d="M17 42L81 18L146 42L143 84L78 104L20 80Z" fill="#aa805a" stroke="#674a33" strokeWidth="2"/><path d="M17 42L79 65L146 42L81 18Z" fill="#c8a67d" stroke="#82613f" strokeWidth="2"/><path d="M79 65L78 104M27 48L77 67L135 47M32 61L67 73M91 72L134 57M32 73L64 84M93 86L129 73" stroke="#806040" strokeWidth="1.4" fill="none" opacity=".5"/><path d="M52 34Q76 46 103 37M45 42Q74 54 112 43" stroke="#ead3a8" fill="none" opacity=".6"/>{boxState.style==='leaf'&&<path d="M67 41Q75 26 94 33Q89 48 67 41Z" fill="#b5bb88" stroke="#6e7e54"/>}<path d="M72 65H85V79H72Z" fill="#bda475" stroke="#6b593d"/><circle cx="78" cy="72" r="2" fill="#5c4b34"/>{boxState.repaired&&<path d="M44 18Q35 10 45 3M85 12Q78 4 88-2M119 23Q110 14 120 5" stroke="#e9d8b5" opacity=".65" fill="none" strokeWidth="2"/>}</svg><span>{place.id==='workshop'?'雨声里的木盒':'修好的雨声木盒'}<ChevronDown size={12}/></span></button>}
          {place.id==='bakery'&&onBakery&&bakeryEcho.recipes>0&&<button type="button" className="td-bakery-recipe-keepsake" data-bakery-keepsake onClick={onBakery} style={{left:'65%',top:'74%'}} aria-label="看看我留在面包房的配方"><Feather size={14}/><span>你留下的 {bakeryEcho.recipes} 张配方</span></button>}
          {place.id==='bakery'&&onBakery&&<button type="button" className="td-bakery-life-entry" onClick={onBakery} aria-label="走近面包房工作台，亲手过一个下午" style={{left:'54%',top:'81%'}}><Hand size={20}/><span>走近工作台</span></button>}
          {place.id==='bakery'&&<div className="td-recipe-prop" aria-hidden="true"><i/><i/><i/><span>牛奶 · 轻火</span></div>}
          {place.id==='room'&&<div className="td-address-prop" aria-hidden="true"><i/><span>小镇散步</span></div>}
          {place.hotspots.map(h=><button key={h.id} type="button" className={`td-hotspot ${town.explored.includes(h.id)?'is-known':''}`} data-town-hotspot={h.id} style={{left:`${h.id==='bakery-recipe'?53:h.x}%`,top:`${h.id==='bakery-recipe'?72:h.y}%`}} onClick={()=>explore(h)} aria-label={`查看${h.label}`}><i><span/></i><span>{h.label}</span>{town.explored.includes(h.id)&&<Check size={11}/>}</button>)}
          {person&&<button type="button" className="td-person-point" data-town-person={person.id} style={{left:`${personPositions[person.id][0]}%`,top:`${personPositions[person.id][1]}%`}} onClick={()=>talk(person.id)} aria-label={`和${person.name}聊聊`}><span><Heart size={13} strokeWidth={1.3}/></span><span>{person.name}<small>在这里</small></span></button>}
        </div>
      </div>
      <span className="td-pan-hint"><ArrowLeft size={11}/>左右滑动，看看画面的另一边<ArrowRight size={11}/></span>
      {showIntro&&!panel&&<div className="td-introduction"><span>这一次，让脚步带着故事走。</span><p>从蓝门小屋出发，去看看今天的小镇。听一句近况，做一只面包，再给自己的窗边留点喜欢的东西。</p><button type="button" onClick={()=>{setShowIntro(false);stageRef.current?.querySelector('.td-hotspot')?.focus({preventScroll:true});}}>先在这里看看<ArrowRight size={15}/></button></div>}
      <div className="td-scene-note"><span>{String(seenCount).padStart(2,'0')} / {String(place.hotspots.length).padStart(2,'0')}</span><p>{place.description}</p></div>
    </div>

    <footer className="td-footer"><div className="td-current-invitation"><Leaf size={15} strokeWidth={1.2}/><p>{hint}</p></div><div className="td-place-actions">
      {place.id==='bakery'&&<button type="button" className="td-main-action" onClick={()=>onBakery?onBakery():openPanel('craft')} aria-label="在面包房烤一炉面包"><Wheat size={18}/>烤一炉自己的面包<ArrowRight size={15}/></button>}
      {place.id==='workshop'&&onMemoryBox&&<button type="button" className="td-main-action" onClick={onMemoryBox}><PackageOpen size={17}/>{boxState.repaired?'再听听木盒里的雨':'修好一只留住雨声的木盒'}<ArrowRight size={15}/></button>}
      {person&&<button type="button" onClick={()=>talk(person.id)} aria-label={`和${person.name}聊聊`}><Heart size={16}/>和{person.name}坐一会儿</button>}
      {place.id==='room'&&<><button type="button" className="td-main-action" onClick={()=>openPanel('decorate')} aria-label="布置我的小屋"><Flower2 size={17}/>把小屋布置成喜欢的样子</button><button type="button" onClick={()=>openPanel('rest')} aria-label="让今天慢慢结束"><Moon size={17}/>{town.day<3?'让今天慢慢结束':'收好这段初秋'}</button></>}
      {place.id==='shore'&&<button type="button" className="td-main-action" onClick={()=>explore(place.hotspots[0])}><Wind size={17}/>在海边停一会儿</button>}
    </div></footer>

    {panel&&<div className="td-panel-shade" onPointerDown={event=>{if(event.target===event.currentTarget)closePanel();}}><section className={`td-panel td-panel-${panel}`} ref={panelRef} aria-label={{map:'小镇地图',bag:'随身布袋',journal:'初秋手记',detail:detail?.label||'发现的小事',talk:'和居民坐一会儿',craft:'面包房操作台',decorate:'布置小屋',rest:'一天的尾声'}[panel]}>
      <button type="button" className="td-panel-close" onClick={closePanel} aria-label="收起眼前的小事"><X size={20}/></button>
      {panel==='map'&&<><span className="td-eyebrow">路不远，可以慢慢走</span><h3>今天，想去哪里？</h3><p className="td-panel-intro">同一条小路，今天也许会遇到不同的话。</p><div className="td-map-places">{TOWN_PLACES.map(p=>{const Icon=spotIcon[p.id]||MapPin;return <button type="button" key={p.id} onClick={()=>visit(p.id)} aria-label={`去${p.name}`} aria-current={p.id===place.id?'location':undefined} data-town-destination={p.id}><img src={artworkPreview(p.art)} alt=""/><span><Icon size={16}/><strong>{p.name}</strong><small>{p.subtitle}</small></span>{p.id===place.id?<span className="td-here">你在这里</span>:<ArrowRight size={15}/>}</button>;})}</div></>}
      {panel==='detail'&&detail&&<><span className="td-eyebrow">在这里，多停留一会儿</span><h3>{detail.label}</h3><p className="td-discovery-text">{detail.text}</p>{detail.clue&&<div className="td-found-clue"><Feather size={17}/><p>{TOWN_PEOPLE.some(p=>p.id===detail.clue)?`你记下了：${TOWN_PEOPLE.find(p=>p.id===detail.clue).name}喜欢${TOWN_PEOPLE.find(p=>p.id===detail.clue).preference}。`:'这一点小发现，已经收进初秋手记。'}</p></div>}<p className="td-quiet-note"><Check size={14}/>这件小事，已经记在初秋手记里。</p>{detail.id==='bakery-recipe'&&<button type="button" className="td-primary" onClick={()=>setPanel('craft')}>照着旧食谱试一炉<Wheat size={16}/></button>}<button type="button" className="td-primary" onClick={closePanel}>再看看周围<ArrowRight size={15}/></button></>}
      {panel==='bag'&&<><span className="td-eyebrow">出门时，带上一点心意</span><h3>随身的布袋</h3><p className="td-panel-intro">手里的面包可以留给自己，也可以去居民身边，亲手递给他们。</p>{town.breads.length?<div className="td-bag-breads">{town.breads.map(b=><article key={b.id}><BreadArt {...b} baked tiny/><div><h4>{b.name}</h4><p>{textureText[b.texture]||'亲手烘烤的香气'}</p><small>第{b.day}天亲手做的 · {TOWN_SHAPES.find(s=>s.id===b.shape)?.name}</small><button type="button" className="td-snack-button" onClick={()=>{act({type:'eat',breadId:b.id},'paper');flash('给自己留的一只，也要坐下来好好吃。');}} aria-label={`留给自己尝尝：${b.name}`}>留给自己尝尝<Heart size={12}/></button></div></article>)}</div>:<div className="td-empty-bag"><ShoppingBag size={34} strokeWidth={1}/><p>布袋还是轻轻的。</p><small>去面包房试着做一炉，或者先逛逛也好。</small><button type="button" className="td-text-button" onClick={()=>visit('bakery')}>去有光面包房<ArrowRight size={14}/></button></div>}<div className="td-bag-keepsakes"><h4>找到的小物件</h4><div>{TOWN_DECORATIONS.filter(i=>townDecorationUnlocked(game,i.id)).map(i=><span key={i.id}><DecorationArt item={i.id}/>{i.name}</span>)}</div><button type="button" className="td-text-button" onClick={()=>visit('room')}>带回小屋，找个喜欢的位置<ArrowRight size={14}/></button></div></>}
      {panel==='talk'&&dialogue&&<><span className="td-eyebrow">{dialogue.person.role} · 第{town.day}天</span><h3>和{dialogue.person.name}坐一会儿</h3><div className="td-dialogue" data-town-dialogue={selectedPerson}><span className="td-speaker">{dialogue.person.name}</span><p>{dialogue.line}</p>{dialogue.recalledGift&&<span className="td-recalled"><Gift size={13}/>还记得你上次送来的面包</span>}{dialogue.response&&<div className="td-answer"><span>你们又多说了几句</span><p>{dialogue.response}</p></div>}</div>{!dialogue.selected&&<div className="td-replies">{dialogue.choices.map(choice=><button key={choice.id} type="button" data-town-reply={choice.id} onClick={()=>act({type:'talk',person:selectedPerson,reply:choice.id},'paper')}>{choice.text}<ArrowRight size={14}/></button>)}</div>}
        {selectedPerson==='lin'&&bakeryEcho.text&&<aside className="td-memory-box-echo"><Wheat size={19}/><div><h4>昨天的味道，留到了今天</h4><p>{bakeryEcho.text}</p></div></aside>}{personEcho&&<aside className="td-memory-box-echo"><PackageOpen size={19}/><div><h4>{personEcho.title}</h4><p>{personEcho.text}</p></div></aside>}
        <div className="td-gift-area"><h4><Gift size={15}/>把手里的温暖，递过去</h4>{alreadyGifted?<p className="td-gift-response">{town.gifts.find(g=>g.day===town.day&&g.person===selectedPerson)?.response}</p>:town.breads.length?<><label htmlFor="td-gift-bread">挑一只亲手做的面包</label><div className="td-gift-choice"><BreadArt {...pickedBread} baked tiny/><select id="td-gift-bread" aria-label="挑选送出的面包" value={pickedBread?.id||''} onChange={event=>setGiftId(event.target.value)}>{town.breads.map(b=><option key={b.id} value={b.id}>{b.name} · {textureText[b.texture]||'亲手做的'}</option>)}</select></div><button type="button" className="td-primary" onClick={()=>act({type:'gift',person:selectedPerson,breadId:pickedBread.id},'complete')}>送出这只面包<Gift size={16}/></button></>:<p className="td-quiet-note">今天还没有随身的面包。听过近况，再去烤一炉也来得及。</p>}</div></>}
      {panel==='craft'&&<><span className="td-eyebrow">有光面包房 · 借用一角操作台</span><h3>把今天，揉进面香里</h3><p className="td-panel-intro">{stage==='done'?'这一炉已经装进布袋。想把它带给谁？':stage==='knead'?'用手推开面团，再慢慢收回来。它会记得你的手温。':stage==='bake'?'火轻一点更柔软，火旺一点更酥香。每一种都有自己的味道。':'先想想，今天想做什么味道。原料还没拌齐时，都可以重新选。'}</p>
        <div className="td-craft-layout"><div className={'td-workbench td-craft-'+stage}>{stage==='knead'?<KneadDough craft={town.craft} onKnead={()=>act({type:'knead'},'touch')}/>:<BreadArt {...town.craft} baked={stage==='done'}/>}<div className="td-craft-progress"><span className={stage==='ingredients'?'is-active':''}>拌入原料</span><i/><span className={stage==='knead'?'is-active':''}>揉进手温</span><i/><span className={stage==='bake'||stage==='done'?'is-active':''}>守一炉香气</span></div>{stage==='knead'&&<div className="td-knead-count" aria-label={`已揉${town.craft.kneads}次，共三次`}>{[1,2,3].map(i=><span key={i} className={town.craft.kneads>=i?'is-done':''}>{town.craft.kneads>=i?<Check size={12}/>:i}</span>)}</div>}</div>
          <div className="td-craft-controls">{stage==='ingredients'&&<><fieldset><legend>今天的味道</legend><div className="td-recipe-choices">{TOWN_RECIPES.map(r=><button type="button" key={r.id} data-town-recipe={r.id} className={town.craft.recipe===r.id?'selected':''} aria-pressed={town.craft.recipe===r.id} onClick={()=>act({type:'recipe',value:r.id})}>{r.name}</button>)}</div><p>{recipe.description}</p></fieldset><fieldset><legend>做成喜欢的样子</legend><div className="td-shape-choices">{TOWN_SHAPES.map(s=><button type="button" key={s.id} data-town-shape={s.id} className={town.craft.shape===s.id?'selected':''} aria-pressed={town.craft.shape===s.id} onClick={()=>act({type:'shape',value:s.id})}>{s.name}</button>)}</div></fieldset><div className="td-ingredients">{recipe.ingredients.map(ingredient=><button key={ingredient.id} type="button" disabled={town.craft.ingredients.includes(ingredient.id)} aria-label={`加入${ingredient.label}`} onClick={()=>act({type:'ingredient',ingredient:ingredient.id},'touch')}><span>{town.craft.ingredients.includes(ingredient.id)?<Check size={19}/>:<Plus size={19}/>}</span>{ingredient.label}<small>{town.craft.ingredients.includes(ingredient.id)?'已经拌进木碗':'轻点，放进木碗'}</small></button>)}</div></>}
            {stage==='knead'&&<div className="td-craft-margin-note"><Hand size={30} strokeWidth={1}/><p>不需要赶时间。</p><span>拖动面团，推开再收回；也可以轻按三次，或用 Enter 操作。</span><small>揉好后，我们再照看炉火。</small></div>}
            {stage==='bake'&&<div className="td-oven-controls"><label htmlFor="td-bread-heat"><Flame size={19}/>今天的炉火<output>{town.craft.heat}°C</output></label><div className="td-heat-track"><input id="td-bread-heat" type="range" min="150" max="210" step="5" aria-label="调整面包炉火" value={town.craft.heat} onChange={event=>act({type:'heat',value:Number(event.target.value)},null)}/></div><div className="td-heat-labels"><span>柔软一些</span><span>温暖金黄</span><span>酥香一些</span></div><p>{town.craft.heat<=165?'留一点柔软，配茶慢慢吃。':town.craft.heat>=195?'边缘会更酥，适合喜欢麦香的人。':'恰好的暖意，外皮和内里各留一点余地。'}</p>{town.breads.length>=6&&<p className="td-quiet-note">布袋装满了。可以先送出一只，或打开布袋给自己留一只。<button type="button" className="td-text-button" onClick={()=>openPanel('bag')}>整理布袋</button></p>}<button type="button" className="td-primary" disabled={town.breads.length>=6} onClick={()=>{act({type:'bake'},'complete');flash('新烤的面包已经装进随身布袋。');}}>把面团送进烤箱<Flame size={16}/></button></div>}
            {['knead','bake'].includes(stage)&&<button type="button" className="td-text-button" onClick={()=>act({type:'new_batch'})}>重新选这一炉的配方<ArrowLeft size={13}/></button>}
            {stage==='done'&&<div className="td-craft-finished"><span className="td-paper-seal"><Check size={24}/></span><h4>这一炉，有了你的样子。</h4><p>面包已装好。到居民身边，便可以亲手送给他们；明天再见面，也许会多聊到今天。</p><button type="button" className="td-primary" onClick={()=>talk('lin')}>先听听林姨的近况<Heart size={15}/></button><button type="button" className="td-text-button" onClick={()=>act({type:'new_batch'})}>再做一炉<Plus size={14}/></button></div>}
          </div>
        </div>
      </>}
      {panel==='decorate'&&<><span className="td-eyebrow">蓝门小屋 · 留下自己的痕迹</span><h3>让这里，慢慢像你的家</h3><p className="td-panel-intro">把物件拖到画里的位置；也可以先选位置，再轻点喜欢的东西。</p><div className="td-slot-choices">{TOWN_SLOTS.map(s=><button key={s.id} type="button" className={selectedSlot===s.id?'selected':''} aria-pressed={selectedSlot===s.id} onClick={()=>{setSelectedSlot(s.id);const node=rootRef.current.querySelector(`[data-town-slot="${s.id}"]`);node?.scrollIntoView({block:'nearest',inline:'center',behavior:quietMotion?'instant':'smooth'});}} aria-label={`选择${s.name}`}>{s.name}</button>)}</div><div className="td-decor-tray">{TOWN_DECORATIONS.map(item=>{const unlocked=townDecorationUnlocked(game,item.id);return <button key={item.id} type="button" className={`td-decor-object ${unlocked?'':'is-locked'}`} data-town-decoration={item.id} disabled={!unlocked} aria-label={`摆放${item.name}`} onPointerDown={event=>decorationDown(event,item.id)} onPointerMove={decorationMove} onPointerUp={event=>decorationUp(event)} onPointerCancel={event=>decorationUp(event,true)} onClick={event=>{if(event.detail>0&&suppressDecor.current){suppressDecor.current=false;return;}suppressDecor.current=false;act({type:'decorate',slot:selectedSlot,item:item.id},'wood');}}><DecorationArt item={item.id}/><strong>{item.name}</strong><small>{unlocked?'拖动或轻点摆放':item.description}</small></button>;})}</div>{town.decor[selectedSlot]&&<button type="button" className="td-text-button" onClick={()=>act({type:'decorate',slot:selectedSlot,item:null},'wood')}>把这个位置暂时留空<X size={13}/></button>}<div className="td-card-form"><label htmlFor="td-home-card"><Feather size={15}/>给今天，写一句自己的话</label><textarea id="td-home-card" aria-label="留在小屋的卡片" rows={2} maxLength={40} value={cardText} placeholder="例如：今天终于知道，林姨喜欢什么味道。" onChange={event=>{setCardText(event.target.value);onAction({type:'card',text:event.target.value});}}/><div><span>{[...cardText].length} / 40</span><button type="button" className="td-small-primary" onClick={()=>{act({type:'card',text:cardText},'paper');flash('这句话，会和你布置的小屋一起留下。');}}>收好这句话<Check size={13}/></button></div></div><p className="td-quiet-note"><Sprout size={15}/>明天回来，看看窗边的花有没有新的变化。</p></>}
      {panel==='rest'&&<><span className="td-eyebrow">今天已经做得很好了</span><h3>{town.day<3?'把一天，轻轻放下来':'这三天，已经有了你的痕迹'}</h3><p className="td-discovery-text">{town.day<3?'小镇不会催你把所有事情做完。睡一觉，手里的面包和未完成的制作仍会好好留下。明天，居民会记得你，窗边也会有新的变化。':'走过的小路、送出的面包、认真听过的话，都可以成为人生里值得收藏的一小段。收好以后，仍然可以回到这里慢慢逛。'}</p><div className="td-rest-traces"><span><Compass size={16}/>发现了 {town.explored.length} 件小事</span><span><Heart size={16}/>留下了 {town.gifts.length} 份心意</span><span><Flower2 size={16}/>{Object.values(town.decor).filter(Boolean).length} 处自己的摆放</span></div>{town.day===3&&!journal.completionReady&&!town.completed&&<div className="td-completion-hints"><p>还有几件小事，可以慢慢试试：</p><ul>{(journal.completionHints||[]).map((h,i)=><li key={i}>{h}</li>)}</ul></div>}{town.day<3?<button type="button" className="td-primary" onClick={()=>{act({type:'rest'},'paper');setPanel(null);}}>睡到第{town.day===1?'二':'三'}天<Moon size={16}/></button>:<button type="button" className="td-primary" disabled={!journal.completionReady&&!town.completed} onClick={()=>{act({type:'finish'},'complete');setPanel('journal');}}>收好初秋的三天<Leaf size={16}/></button>}<button type="button" className="td-text-button" onClick={closePanel}>还想再逛一会儿<ArrowLeft size={14}/></button></>}
      {panel==='journal'&&<><span className="td-eyebrow">一件小事，接着另一件小事</span><h3>{journal.title}</h3><p className="td-panel-intro">{journal.summary}</p>{town.completed&&<div className="td-kept-day"><Sprout size={22} strokeWidth={1.2}/><span>初秋的三天，已收入人生相册</span></div>}<div className="td-people-notes">{journal.people.map(p=><article key={p.id}><span>{p.name}</span><h4>{p.label}</h4><p>{p.text}</p></article>)}</div><div className="td-journal-entries">{journal.entries.length?journal.entries.map(e=><article key={e.id}><i/><div><h4>{e.title}</h4><p>{e.text}</p></div></article>):<p className="td-quiet-note">先去画面里看看。手记会从你亲手发现的小事开始。</p>}</div>{town.card&&<blockquote className="td-kept-card"><Feather size={17}/><p>{town.card}</p><small>你留在小屋里的话</small></blockquote>}</>}
    </section></div>}
    {ghost&&<div className="td-drag-ghost" style={{left:ghost.x,top:ghost.y}}><DecorationArt item={ghost.item}/></div>}
    {message&&<div className="td-feedback" role="status"><Leaf size={15}/><p>{message}</p></div>}
  </section>;
}
