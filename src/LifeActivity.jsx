import React, { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Droplets, Flame, Flower2, Hand, Leaf, RotateCw, Sparkles, Sun, Wheat, Wind, X } from 'lucide-react';
import { activityProgress } from './activities.js';
import { artwork } from './visuals.js';
import './life-activity.css';

const activityCopy = {
  bread: {
    eyebrow: '把平凡的一天，揉进香气里',
    person: '林姨',
    steps: ['拌好面团', '慢慢揉匀', '守着炉火'],
    stages: { ingredients: 0, knead: 1, bake: 2, done: 3 },
    hints: {
      ingredients: '先把面粉和温水放进木碗。手边的东西，都是刚刚好的。',
      knead: '轻按面团，或用手指慢慢推开、收回来。慢慢来，三次就好。',
      bake: '把炉火调到温暖的金色区间。这里没有赶时间的人。',
      done: '你看，原来一双手，也可以把普通的一天变得香喷喷的。',
    },
  },
  repair: {
    eyebrow: '有些裂缝，也可以留住光',
    person: '周予',
    steps: ['找回木纹', '仔细合拢'],
    stages: { arrange: 0, seal: 1, done: 2 },
    hints: {
      arrange: '点一点三块木片，让刻下的叶纹都朝向上方。每次会转四分之一圈。',
      seal: '叶纹已经接上了。沿着留下的接缝，仔细涂上木胶，轻轻合拢。',
      done: '修补的地方不必藏起来。它也是这个木盒走过的日子。',
    },
  },
  plant: {
    eyebrow: '给明天，留一点会长大的期待',
    person: '你',
    steps: ['挑一株幼苗', '浇一点水', '让光进来', '托住新叶'],
    stages: { seed: 0, water: 1, light: 2, care: 3, done: 4 },
    hints: {
      seed: '这只空花盆，想住进什么颜色的春天？选一株带着花苞的幼苗吧。',
      water: '幼苗已经在花盆里站稳了。沿着花盆边缘，浇一点清水。',
      light: '叶片沾上了水光。把窗推开一点，让窗外柔和的光照进来。',
      care: '它正在试着伸展。轻轻托住新叶，陪它站稳这一下。',
      done: '小小的花开了。你给出的耐心，已经有了自己的颜色。',
    },
  },
};

function DoughArt({ progress, baked = false, id }) {
  const flour = progress.ingredients.includes('flour');
  const water = progress.ingredients.includes('water');
  const kneads = progress.kneads;
  return <svg className="la-dough-art" viewBox="0 0 400 284" role="img" aria-label={baked ? '金黄的圆面包冒着柔和的热气' : flour && water ? `木碗里的柔软面团，已经揉了${kneads}次` : '木碗里等待拌匀的面粉与温水'}>
    <defs>
      <linearGradient id={id + '-dough'} x1="0" y1="0" x2="0.7" y2="1"><stop stopColor={baked ? '#e9b26c' : '#faf0cc'} /><stop offset="1" stopColor={baked ? '#ae6c3b' : '#d6c092'} /></linearGradient>
      <linearGradient id={id + '-bowl'} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#bc9870" /><stop offset="1" stopColor="#8b694c" /></linearGradient>
      <filter id={id + '-shadow'} x="-30%" y="-30%" width="160%" height="170%"><feGaussianBlur stdDeviation="6" /></filter>
    </defs>
    <ellipse cx="200" cy="251" rx="135" ry="13" fill="#56614c" opacity=".10" filter={'url(#' + id + '-shadow)'} />
    <g className={baked ? 'la-bread-loaf' : 'la-bowl'}>
      {!baked && <><path d="M63 152 Q74 253 200 254 Q325 253 337 152Z" fill={'url(#' + id + '-bowl)'} stroke="#82664d" strokeWidth="2" /><path d="M82 186 Q200 220 319 186M98 219 Q199 245 302 218" fill="none" stroke="#ebc294" opacity=".28" strokeWidth="2" /><ellipse cx="200" cy="150" rx="137" ry="39" fill="#d1b389" stroke="#88694d" strokeWidth="3" /><ellipse cx="200" cy="150" rx="121" ry="28" fill="#85654b" /> </>}
      {flour && !water && <><path d="M110 154 Q143 147 159 112 Q172 98 187 121 Q201 131 213 113 Q237 123 256 141 L287 159 Q202 185 110 154Z" fill="#f8efd8" /><path d="M164 139 Q180 132 196 143 M214 148 L233 144" stroke="#d6c7a6" strokeWidth="2" fill="none" strokeLinecap="round" /></>}
      {water && !flour && <ellipse cx="200" cy="153" rx="114" ry="21" fill="#9ab5ac" opacity=".8" />}
      {flour && water && <g key={kneads} style={{ transformOrigin: '200px 162px', transform: !baked && kneads === 1 ? 'scale(1.08, .9)' : !baked && kneads === 2 ? 'scale(.95, 1.05)' : 'scale(1)' }} className="la-dough-shape"><path d={baked ? 'M105 202 C101 125 137 74 204 76 C270 73 305 127 299 201 C275 236 137 239 105 202Z' : 'M104 157 C111 107 152 91 204 98 C259 92 294 119 298 156 C276 187 138 188 104 157Z'} fill={'url(#' + id + '-dough)'} stroke={baked ? '#9e6f43' : '#c4ac7c'} strokeWidth="2" />
        {baked ? <><path d="M155 116 Q196 138 218 163 M200 100 Q244 120 265 153 M130 148 Q166 161 188 185" stroke="#f8d591" strokeWidth="10" strokeLinecap="round" /><path d="M157 115 Q194 135 216 160 M202 99 Q243 117 263 149 M132 146 Q166 158 185 181" stroke="#966039" strokeWidth="2" strokeLinecap="round" /><path d="M126 203 Q200 228 278 201" fill="none" stroke="#e8bb78" strokeWidth="3" /></> : <><path d={kneads > 1 ? 'M142 144 Q175 124 209 143 Q232 153 259 139' : 'M135 147 Q165 134 191 145 M219 133 Q240 139 256 151'} stroke="#c5ad7e" strokeWidth="3" fill="none" opacity=".65" strokeLinecap="round" /><path d="M154 118 Q174 109 196 111" stroke="#fff9e8" strokeWidth="4" fill="none" opacity=".7" strokeLinecap="round" /></>}
      </g>}
    </g>
    {!baked && <><circle cx="79" cy="226" r="2" fill="#eee2bc" /><circle cx="320" cy="211" r="3" fill="#eee2bc" /><circle cx="310" cy="229" r="1.5" fill="#eee2bc" /></>}
    {baked && <g className="la-steam" fill="none" stroke="#b6ac91" strokeWidth="2.2" strokeLinecap="round" opacity=".55"><path d="M167 60 Q153 47 165 32 Q175 19 165 6" /><path d="M207 55 Q193 42 205 28 Q215 15 205 2" /><path d="M247 63 Q235 49 248 35 Q258 22 249 10" /></g>}
  </svg>;
}

function RepairArt({ progress, completed = false, id, onRotate }) {
  const pieces = [
    { path: 'M82 76 Q82 63 96 63 H200 V153 L116 190 H82Z', cx: 144, cy: 132, leaf: <><path d="M145 174 Q166 130 185 85" /><path d="M162 135 Q122 136 134 100 Q160 99 162 135Z" /><path d="M174 109 Q205 110 200 82 Q178 82 174 109Z" /></> },
    { path: 'M200 63 H304 Q318 63 318 76 V190 H284 L200 153Z', cx: 253, cy: 131, leaf: <><path d="M208 163 Q245 127 291 101" /><path d="M249 128 Q224 101 250 85 Q269 103 249 128Z" /><path d="M273 112 Q303 131 308 103 Q291 90 273 112Z" /></> },
    { path: 'M82 190 H116 L200 153 L284 190 H318 V223 Q318 236 304 236 H96 Q82 236 82 223Z', cx: 200, cy: 207, leaf: <><path d="M201 238 L201 188" /><path d="M201 219 Q168 215 174 192 Q196 193 201 219Z" /><path d="M201 205 Q225 207 234 186 Q211 179 201 205Z" /></> },
  ];
  return <svg className="la-repair-art" viewBox="0 0 400 284" role={onRotate ? 'group' : 'img'} aria-label={completed ? '修复完好的旧木盒，木片之间留着细细的接缝' : '旧木盒盖分成三块木片，旋转叶纹，让每块的叶子都朝上'}>
    <defs><linearGradient id={id + '-wood'} x1="0" y1="0" x2=".6" y2="1"><stop stopColor="#d6b88d" /><stop offset="1" stopColor="#b28d65" /></linearGradient>{pieces.map((piece, index) => <clipPath key={index} id={id + '-piece-' + index}><path d={piece.path} /></clipPath>)}</defs>
    <ellipse cx="200" cy="257" rx="123" ry="12" fill="#596e51" opacity=".12" />
    <path d="M82 218 L82 242 Q200 269 318 242 L318 218Z" fill="#93734f" stroke="#866748" strokeWidth="2" /><path d="M95 243 Q200 263 306 243" stroke="#b08c62" fill="none" strokeWidth="2" />
    {pieces.map((piece, index) => <g key={index} className={'la-wood-piece' + (progress.rotations[index] === 0 ? ' is-aligned' : '')} role={onRotate ? 'button' : undefined} tabIndex={onRotate ? 0 : undefined} aria-label={onRotate ? `转动第${index + 1}块木片` : undefined} onClick={onRotate ? () => onRotate(index) : undefined} onKeyDown={onRotate ? event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onRotate(index); } } : undefined}>
      <path d={piece.path} fill={'url(#' + id + '-wood)'} stroke={completed ? '#a1845e' : '#91724c'} strokeWidth={completed ? '3.5' : '2'} strokeLinejoin="round" />
      <g clipPath={'url(#' + id + '-piece-' + index + ')'}><path d={index === 0 ? 'M97 84 Q136 78 181 86 M93 97 Q134 91 183 97 M95 164 Q118 160 134 163' : index === 1 ? 'M217 78 Q260 88 304 80 M218 92 Q264 102 305 94 M280 169 Q294 173 307 170' : 'M101 214 Q137 221 165 213 M239 214 Q266 222 303 214 M101 225 Q140 232 175 223'} fill="none" stroke="#8d6f4b" strokeWidth="1.2" opacity=".35" /><g className="la-piece-pattern" style={{ transform: `rotate(${(completed ? 0 : progress.rotations[index]) * 90}deg)`, transformOrigin: `${piece.cx}px ${piece.cy}px` }} fill="#73906a" fillOpacity=".5" stroke="#647e5e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{piece.leaf}</g></g>
      {!completed && <circle cx={piece.cx} cy={piece.cy} r="28" fill="#fffef4" opacity=".06" />}
    </g>)}
    {completed && <><path d="M200 64 L200 153 L116 190 H83 M200 153 L284 190 H318" stroke="#9a7b53" strokeWidth="3" fill="none" strokeLinejoin="round" /><path d="M201 65 L201 153 L117 190 M201 153 L284 190" stroke="#e6c997" strokeWidth="1.1" fill="none" /><rect x="187" y="231" width="26" height="14" rx="3" fill="#b9a06c" stroke="#8d784c" strokeWidth="1.4" /><circle cx="200" cy="238" r="2" fill="#74613e" /></>}
  </svg>;
}

function PlantArt({ progress, id }) {
  const grown = progress.watered;
  const blooming = progress.completed;
  const blue = progress.seed === 'forgetmenot';
  const petals = blue ? '#9eb9d2' : '#dba6aa';
  return <svg className={'la-plant-art' + (progress.light ? ' has-sunlight' : '')} viewBox="0 0 400 316" role="img" aria-label={blooming ? `花盆里开出一朵${blue ? '浅蓝色勿忘我' : '粉色波斯菊'}` : grown ? '陶土花盆里，一株嫩芽正朝着窗边伸展' : progress.seed ? '陶土花盆里已经栽好一株带花苞的幼苗' : '一只盛着松软泥土的空花盆'}>
    <defs><linearGradient id={id + '-pot'} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#c79875" /><stop offset="1" stopColor="#9b6b53" /></linearGradient><radialGradient id={id + '-light'}><stop stopColor="#f4db94" stopOpacity=".5" /><stop offset="1" stopColor="#f4db94" stopOpacity="0" /></radialGradient></defs>
    <g className="la-window-light" opacity={progress.light ? 1 : .12}><circle cx="300" cy="56" r="110" fill={'url(#' + id + '-light)'} /><path d="M333 15 L236 231 M362 34 L270 242" stroke="#e7cc82" opacity=".22" strokeWidth="19" /></g>
    <ellipse cx="201" cy="290" rx="100" ry="11" fill="#6c7054" opacity=".12" />
    <path d="M133 215 L150 281 Q200 296 249 281 L269 215Z" fill={'url(#' + id + '-pot)'} stroke="#956e53" strokeWidth="2" /><path d="M143 236 Q200 250 257 236" fill="none" stroke="#dfb594" strokeWidth="2" opacity=".6" /><path d="M190 267 Q200 258 210 267 Q204 279 200 281 Q194 278 190 267Z" fill="#d5b598" opacity=".65" /><ellipse cx="201" cy="214" rx="70" ry="19" fill="#c9a080" stroke="#a67e5d" strokeWidth="2" /><ellipse cx="201" cy="213" rx="61" ry="13" fill={progress.watered ? '#695443' : '#8a6b51'} /><path d="M155 211 L162 215 M229 210 L236 213 M180 206 L184 209" stroke="#b08d65" strokeWidth="2" strokeLinecap="round" />
    {progress.seed && !grown && <><path d="M200 214 Q196 188 204 163" stroke="#718850" fill="none" strokeWidth="3" /><path d="M200 196 Q172 195 173 176 Q195 177 200 196Z M201 184 Q223 184 229 165 Q208 165 201 184Z" fill="#9bb77a" stroke="#738d57" strokeWidth="1.3" /><ellipse cx="205" cy="162" rx="5" ry="7" fill={petals} stroke="#8b9c68" strokeWidth="1" /></>}
    {grown && <g className="la-growing-plant"><path d={blooming ? 'M200 214 Q203 173 198 142 Q194 103 201 76' : progress.light ? 'M200 214 Q199 171 206 131' : 'M200 214 Q194 191 202 171'} stroke="#6f8752" strokeWidth={blooming ? '5' : '4'} fill="none" strokeLinecap="round" />
      <path d={progress.light ? 'M200 180 Q150 188 151 151 Q187 145 200 180Z' : 'M199 195 Q170 201 169 177 Q193 173 199 195Z'} fill="#8da772" stroke="#6b8956" strokeWidth="1.5" /><path d={progress.light ? 'M200 155 Q242 158 250 122 Q215 121 200 155Z' : 'M200 187 Q227 190 234 167 Q211 166 200 187Z'} fill="#a5ba82" stroke="#76925c" strokeWidth="1.5" />
      {progress.light && <><path d="M156 155 L197 178 M246 126 L204 153" fill="none" stroke="#6f8956" strokeWidth="1.5" opacity=".7" /><path d="M204 131 Q193 111 210 102 Q225 119 204 131Z" fill="#9eb779" stroke="#718c57" strokeWidth="1.5" /></>}
      {blooming && <g className="la-bloom" transform="translate(201 71)">{Array.from({ length: blue ? 5 : 8 }, (_, i) => <ellipse key={i} cx="0" cy="-16" rx={blue ? '12' : '9'} ry={blue ? '17' : '21'} transform={`rotate(${i * (blue ? 72 : 45)})`} fill={petals} stroke={blue ? '#7f9fb9' : '#bd858e'} strokeWidth="1.2" />)}<circle r="10" fill="#d8b666" /><circle r="5" fill="#b29146" opacity=".55" /><circle cx="-3" cy="-3" r="1.5" fill="#f1d99a" /></g>}
      {!blooming && progress.light && <ellipse cx="206" cy="131" rx="6" ry="8" fill={petals} stroke="#80905c" strokeWidth="1.5" />}
    </g>}
    {progress.watered && <g fill="#9ab5b1" opacity=".65"><path d="M111 186 Q103 198 111 200 Q119 198 111 186Z" /><path d="M287 205 Q281 214 287 216 Q293 214 287 205Z" /></g>}
  </svg>;
}

function KneadObject({ progress, onAction, id }) {
  const pointer = useRef(null);
  const suppressClick = useRef(false);
  function release(event, cancelled = false) {
    const drag = pointer.current;
    pointer.current = null;
    event.currentTarget.style.setProperty('--knead-push', '0px');
    event.currentTarget.removeAttribute('data-dragging');
    if (drag && !cancelled && drag.distance >= 22) {
      suppressClick.current = true;
      onAction({ type: 'knead' });
    }
  }
  return <button type="button" className="la-touch-object la-knead-object"
    aria-label={`轻轻揉一下面团，已经揉了${progress.kneads}次，还需要${3 - progress.kneads}次`}
    onPointerDown={event => { if (!event.isPrimary || event.button !== 0) return; suppressClick.current = false; pointer.current = { x: event.clientX, y: event.clientY, distance: 0 }; event.currentTarget.setPointerCapture(event.pointerId); event.currentTarget.dataset.dragging = 'true'; }}
    onPointerMove={event => { const drag = pointer.current; if (!drag) return; drag.distance = Math.max(drag.distance, Math.hypot(event.clientX - drag.x, event.clientY - drag.y)); event.currentTarget.style.setProperty('--knead-push', `${Math.max(-18, Math.min(18, (event.clientY - drag.y) * .25))}px`); }}
    onPointerUp={event => release(event)} onPointerCancel={event => release(event, true)}
    onClick={event => { if (event.detail > 0 && suppressClick.current) { suppressClick.current = false; return; } suppressClick.current = false; onAction({ type: 'knead' }); }}>
    <DoughArt progress={progress} id={id} /><span className="la-object-invitation"><Hand size={15} aria-hidden="true" />轻按或拖动，慢慢揉一揉</span>
  </button>;
}

function BreadActivity({ progress, onAction, id, setFeedback }) {
  const atTemperature = progress.temperature >= 170 && progress.temperature <= 190;
  function bake() {
    if (!atTemperature) {
      setFeedback(progress.temperature < 170 ? '炉火还很轻，再往金色的区间调一点点。面团会等你的。' : '炉火有些热了，往金色的区间退一点点就好。');
      return;
    }
    onAction({ type: 'bake' });
  }
  return <div className={'la-workbench la-bread-workbench la-stage-' + progress.stage}>
    <div className="la-stage-art">
      {progress.stage === 'knead' ? <KneadObject progress={progress} id={id} onAction={onAction} /> : <DoughArt progress={progress} baked={progress.completed} id={id} />}
      {progress.stage === 'knead' && <div className="la-knead-marks" aria-label={`已揉${progress.kneads}次，共3次`}>{[0, 1, 2].map(index => <span key={index} className={progress.kneads > index ? 'is-done' : ''}>{progress.kneads > index ? <Check size={13} /> : <i />}</span>)}</div>}
    </div>
    {progress.stage === 'ingredients' && <div className="la-ingredient-tray" aria-label="面团原料"><button type="button" className={'la-ingredient' + (progress.ingredients.includes('flour') ? ' is-added' : '')} disabled={progress.ingredients.includes('flour')} onClick={() => onAction({ type: 'flour' })}><span className="la-ingredient-icon"><Wheat size={28} strokeWidth={1.3} /></span><strong>一勺面粉</strong><small>{progress.ingredients.includes('flour') ? '已经放进木碗' : '轻点，撒进木碗'}</small>{progress.ingredients.includes('flour') && <Check className="la-added-mark" size={17} />}</button><button type="button" className={'la-ingredient' + (progress.ingredients.includes('water') ? ' is-added' : '')} disabled={progress.ingredients.includes('water')} onClick={() => onAction({ type: 'water' })}><span className="la-ingredient-icon la-water-icon"><Droplets size={28} strokeWidth={1.3} /></span><strong>一杯温水</strong><small>{progress.ingredients.includes('water') ? '已经倒进木碗' : '轻点，倒进木碗'}</small>{progress.ingredients.includes('water') && <Check className="la-added-mark" size={17} />}</button></div>}
    {progress.stage === 'bake' && <div className="la-oven-controls"><div className="la-temperature-heading"><label htmlFor={id + '-temperature'}><Flame size={17} aria-hidden="true" />照看炉火</label><output htmlFor={id + '-temperature'}>{progress.temperature}<span> °C</span></output></div><div className="la-temperature-track"><span className="la-golden-range" aria-hidden="true" /><input id={id + '-temperature'} type="range" min="150" max="210" step="5" value={progress.temperature} onChange={event => { setFeedback(''); onAction({ type: 'set_temperature', value: Number(event.target.value) }); }} aria-valuetext={`${progress.temperature}摄氏度，${atTemperature ? '适合烘烤的温暖炉火' : progress.temperature < 170 ? '炉火稍轻，可以调高一点' : '炉火稍热，可以调低一点'}`} /></div><div className="la-temperature-labels"><span>轻轻的火</span><span>温暖的金色</span><span>旺一些的火</span></div><button type="button" className="la-primary" onClick={bake}><Flame size={17} aria-hidden="true" />把面团送进炉里<ArrowRight size={16} aria-hidden="true" /></button></div>}
  </div>;
}

function RepairActivity({ progress, onAction, id }) {
  return <div className={'la-workbench la-repair-workbench la-stage-' + progress.stage}>
    <div className="la-stage-art la-repair-stage"><RepairArt progress={progress} completed={progress.completed} id={id} onRotate={progress.stage === 'arrange' ? index => onAction({ type: 'rotate', index }) : undefined} />{progress.stage === 'arrange' && <div className="la-piece-controls" aria-label="旋转三块木片">{progress.rotations.map((rotation, index) => <button type="button" key={index} className={'la-piece-button la-piece-' + index + (rotation === 0 ? ' is-aligned' : '')} onClick={() => onAction({ type: 'rotate', index })} aria-label={`旋转第${index + 1}块木片，${rotation === 0 ? '叶纹已经朝上' : '叶纹还没有朝上'}`}>{rotation === 0 ? <Check size={18} aria-hidden="true" /> : <RotateCw size={19} aria-hidden="true" />}<span>第{['一', '二', '三'][index]}片</span></button>)}</div>}</div>
    {progress.stage === 'arrange' && <div className="la-alignment-note"><Leaf size={15} aria-hidden="true" /><span>{progress.rotations.every(rotation => rotation !== 0) ? '让每片叶子的尖端，都朝向上方。' : `有${['零', '一', '两', '三'][progress.rotations.filter(rotation => rotation === 0).length]}片木片已经找回了方向。`}</span></div>}
    {progress.stage === 'seal' && <button type="button" className="la-primary" onClick={() => onAction({ type: 'mend' })}><Sparkles size={17} aria-hidden="true" />沿着接缝，仔细合拢<ArrowRight size={16} aria-hidden="true" /></button>}
  </div>;
}

function PlantActivity({ progress, onAction, id }) {
  return <div className={'la-workbench la-plant-workbench la-stage-' + progress.stage}>
    <div className="la-stage-art"><PlantArt progress={progress} id={id} /></div>
    {progress.stage === 'seed' && <div className="la-seed-tray" aria-label="选择一株带花苞的幼苗"><button type="button" className="la-seed-packet la-cosmos-seed" onClick={() => onAction({ type: 'select_seed', seed: 'cosmos' })}><Flower2 size={30} strokeWidth={1.2} aria-hidden="true" /><span><strong>波斯菊</strong><small>一小片，温柔的粉色</small></span><ArrowRight size={15} aria-hidden="true" /></button><button type="button" className="la-seed-packet la-blue-seed" onClick={() => onAction({ type: 'select_seed', seed: 'forgetmenot' })}><Flower2 size={30} strokeWidth={1.2} aria-hidden="true" /><span><strong>勿忘我</strong><small>像海风一样的浅蓝</small></span><ArrowRight size={15} aria-hidden="true" /></button></div>}
    {progress.stage === 'water' && <button type="button" className="la-primary la-water-button" onClick={() => onAction({ type: 'water' })}><Droplets size={18} aria-hidden="true" />沿着花盆边，浇一点水<ArrowRight size={16} aria-hidden="true" /></button>}
    {progress.stage === 'light' && <button type="button" className="la-primary" onClick={() => onAction({ type: 'open_window' })}><Sun size={18} aria-hidden="true" />推开窗，让柔光进来<ArrowRight size={16} aria-hidden="true" /></button>}
    {progress.stage === 'care' && <button type="button" className="la-primary" onClick={() => onAction({ type: 'support' })}><Hand size={18} aria-hidden="true" />轻轻托住，刚长出的新叶<ArrowRight size={16} aria-hidden="true" /></button>}
  </div>;
}

/** Quiet, tangible activities. Every meaningful gesture is stored by the game engine. */
export default function LifeActivity({ game, activity, onAction, onClose, quietMotion = false }) {
  const progress = activityProgress(game, activity.id);
  const copy = activityCopy[activity.id] || activityCopy.bread;
  const id = 'life-' + useId().replace(/[^a-z0-9]/gi, '');
  const dialogRef = useRef(null);
  const previousFocus = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const previousStage = useRef(progress.stage);
  const [feedback, setFeedback] = useState('');
  const [gesture, setGesture] = useState(null);
  const gestureTimer = useRef(null);
  useEffect(() => () => clearTimeout(gestureTimer.current), []);
  const stageIndex = copy.stages[progress.stage] ?? 0;
  const status = feedback || copy.hints[progress.stage] || '';
  const progressKey = JSON.stringify(progress);

  useEffect(() => {
    previousFocus.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.querySelector('.la-close')?.focus({ preventScroll: true });
    function keyboard(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
      } else if (event.key === 'Tab') {
        const focusable = [...(dialogRef.current?.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex="0"]') || [])].filter(node => node.getClientRects().length > 0);
        if (!focusable.length) { event.preventDefault(); return; }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', keyboard, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', keyboard, true);
      requestAnimationFrame(() => { if (previousFocus.current?.isConnected) previousFocus.current.focus({ preventScroll: true }); });
    };
  }, []);

  useEffect(() => {
    if (previousStage.current !== progress.stage) {
      previousStage.current = progress.stage;
      setFeedback('');
    }
    const timer = requestAnimationFrame(() => {
      const current = document.activeElement;
      if (!current || current === document.body || !dialogRef.current?.contains(current) || current.disabled) {
        (dialogRef.current?.querySelector('.la-primary, .la-touch-object, .la-seed-packet, .la-piece-button, .la-ingredient:not([disabled])') || dialogRef.current?.querySelector('.la-close'))?.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(timer);
  }, [progressKey]);

  function act(action) {
    setFeedback('');
    if (action.type !== 'set_temperature') {
      setGesture({ kind: action.type, sequence: Date.now() });
      clearTimeout(gestureTimer.current); gestureTimer.current = setTimeout(() => setGesture(null), 1800);
    }
    onAction(action);
  }

  return <div className={'la-backdrop' + (quietMotion ? ' la-quiet' : '')} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} data-gesture={gesture?.kind || ''} className={'la-dialog la-kind-' + activity.id + (progress.completed ? ' la-completed' : '')} role="dialog" aria-modal="true" aria-labelledby={id + '-title'} aria-describedby={id + '-intro'}>
      <header className="la-header"><div className="la-heading"><span className="la-eyebrow"><Leaf size={13} strokeWidth={1.3} aria-hidden="true" />小镇里的慢时光</span><h2 id={id + '-title'}>{activity.title}</h2><p id={id + '-intro'}>{copy.eyebrow}</p></div><button type="button" className="la-close" onClick={onClose} aria-label="收好手边的事，返回故事"><X size={21} strokeWidth={1.4} aria-hidden="true" /></button></header>
      <div className="la-scroll-area">
        <div className="la-tableau-banner" aria-hidden="true"><img src={artwork[activity.id === 'bread' ? 'bakery' : activity.id === 'repair' ? 'community' : 'vegetable-garden']} alt="" draggable="false" /><span>{activity.id === 'bread' ? '清晨的面包房' : activity.id === 'repair' ? '靠窗的手作桌' : '有阳光的窗边'}</span><i /></div>
        <ol className="la-step-rail" aria-label="这件小事的进度">{copy.steps.map((step, index) => <li key={step} className={stageIndex > index || progress.completed ? 'is-done' : stageIndex === index ? 'is-current' : ''} aria-current={stageIndex === index && !progress.completed ? 'step' : undefined}><span>{stageIndex > index || progress.completed ? <Check size={12} aria-hidden="true" /> : <i />}</span><small>{step}</small></li>)}</ol>
        <div className="la-npc-note"><span className="la-npc-seal" aria-hidden="true">{copy.person[0]}</span><div><span>{activity.id === 'plant' ? '你在心里，轻轻说' : activity.id === 'repair' ? '想起周予的叮嘱' : copy.person + '轻声说'}</span><p role="status" aria-live="polite" aria-atomic="true">{status}</p></div></div>
        {gesture && <div key={gesture.sequence} className={'la-gesture-effects la-effect-' + gesture.kind} aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ '--n': i }} />)}</div>}
        {activity.id === 'bread' && <BreadActivity progress={progress} onAction={act} setFeedback={setFeedback} id={id} />}
        {activity.id === 'repair' && <RepairActivity progress={progress} onAction={act} id={id} />}
        {activity.id === 'plant' && <PlantActivity progress={progress} onAction={act} id={id} />}
        {progress.completed && <section className="la-completion" aria-label="亲手留下的纪念"><div className="la-keepsake-label"><Sparkles size={14} aria-hidden="true" /><span>一件亲手留下的纪念</span><i /></div><h3>{activity.memory?.title || '今天的小小温暖'}</h3><p className="la-keepsake-description">{activity.memory?.description}</p><blockquote>{activity.reply || copy.hints.done}</blockquote><p className="la-album-note"><Check size={14} aria-hidden="true" />已经替你收进人生相册</p><button type="button" className="la-primary" onClick={onClose}>把这份温暖，带回故事<ArrowRight size={17} aria-hidden="true" /></button></section>}
      </div>
      <footer className="la-footer"><span><Wind size={13} aria-hidden="true" />{progress.completed ? '温柔的日子，会留在这里。' : '手边的进度，会替你好好收着。'}</span><button type="button" onClick={onClose}><ArrowLeft size={14} aria-hidden="true" />{progress.completed ? '回到故事' : '一会儿再来'}</button></footer>
    </section>
  </div>;
}
