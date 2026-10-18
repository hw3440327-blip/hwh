import React, { useId } from 'react';
import { ARTWORK_ASSETS } from './artworkAssets.js';

const settings = {
  'film-arrival': { water:[.69,.47,.34,.12], light:[.29,.38,.16,.21] },
  'film-bakery': { water:[.83,.40,.14,.07], light:[.07,.40,.14,.20], steam:[.135,.575] },
  'film-bookshop': { water:[.76,.37,.20,.09], light:[.74,.26,.3,.3] },
  'film-workshop': { water:[.69,.35,.14,.09], light:[.7,.22,.32,.32] },
  'film-kitchen': { water:[.42,.38,.21,.11], light:[.78,.33,.15,.22], steam:[.26,.46] },
  'film-garden': { water:[.55,.24,.32,.11], light:[.24,.24,.32,.32] },
  'film-shore': { water:[.70,.48,.30,.22], light:[.8,.22,.4,.3] },
  'film-night': { water:[.38,.31,.25,.11], light:[.81,.43,.18,.25] },
  'immersive-room': { water:[.38,.31,.25,.11], light:[.69,.35,.25,.25] },
  'immersive-letters': { water:[.51,.31,.3,.12], light:[.67,.29,.30,.30], steam:[.89,.56] },
  'immersive-community': { water:[.50,.31,.28,.11], light:[.62,.27,.32,.34] },
  'immersive-market': { water:[.75,.38,.15,.08], light:[.72,.25,.32,.35], steam:[.10,.40] },
  'immersive-courtyard': { light:[.66,.30,.3,.35] },
  'immersive-winter-courtyard': { light:[.12,.40,.15,.25] },
  'play-tea-table': { water:[.66,.30,.30,.12], light:[.63,.30,.35,.35] },
};

export default function SceneMotion({ artwork, running=true }) {
  const id = 'scenery-' + useId().replace(/[^a-z0-9]/gi,'');
  const asset = ARTWORK_ASSETS[artwork];
  const key = asset?.motionKey || artwork?.split('/').at(-1)?.replace(/\.[^.]+$/,'');
  const config = settings[key] || { light:[.73,.28,.3,.3] };
  const h = 1000 * (asset?.height || 941) / (asset?.width || 1672);
  const [lx,ly,lr] = config.light;
  const water = config.water;
  return <svg className="scene-motion" data-running={running} data-geometry="fixed" viewBox={`0 0 1000 ${h}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id={id+'light'}><stop stopColor="#ffdf9c" stopOpacity=".5"/><stop offset="1" stopColor="#ffdf9c" stopOpacity="0"/></radialGradient>
      {water&&<clipPath id={id+'water'}><ellipse cx={water[0]*1000} cy={water[1]*h} rx={water[2]*800} ry={water[3]*h*.8}/></clipPath>}
    </defs>
    <ellipse className="scene-light" cx={lx*1000} cy={ly*h} rx={lr*1000} ry={lr*h} fill={`url(#${id}light)`}/>
    {water&&<g clipPath={`url(#${id}water)`}>{Array.from({length:11},(_,i)=>{
      const x=(water[0]-water[2]*.7+((i*37)%100)/100*water[2]*1.4)*1000;
      const y=(water[1]-water[3]*.6+((i*29)%100)/100*water[3]*1.2)*h;
      return <path className="scene-water-glint" key={i} d={`M${x} ${y}h${9+(i*13)%24}`} stroke="#fff0cc" strokeWidth={.65+(i%3)*.25} strokeLinecap="round" style={{'--delay':`${-i*.71}s`,'--duration':`${4.8+i%4}s`}}/>;
    })}</g>}
    {config.steam&&<g transform={`translate(${config.steam[0]*1000},${config.steam[1]*h})`}>
      {[0,1,2].map(i=><path className="scene-steam" key={i} d={`M${i*5} 0c-9-10 11-16 2-28s4-16 1-25`} fill="none" stroke="#fff4df" strokeWidth="1.4" strokeLinecap="round" style={{'--delay':`${-i*2.1}s`}}/>)}
    </g>}
    {Array.from({length:8},(_,i)=><circle key={i} className="scene-dust" cx={48+(i*131)%904} cy={h*(.12+((i*31)%65)/100)} r={.55+(i%3)*.21} fill="#fff0c6" style={{'--delay':`${-i*1.9}s`,'--duration':`${15+i%4*3}s`}}/>)}
  </svg>;
}
