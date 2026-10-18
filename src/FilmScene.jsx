import React, { useEffect, useRef, useState } from 'react';
import { filmForScene } from './films.js';
import './film-scene.css';

export default function FilmScene({ scene, poster, className='', style, paused=false, quiet=false, onImageLoad, interactive=false }) {
  const film=filmForScene(scene); const video=useRef(null);
  const [ready,setReady]=useState(false); const [blocked,setBlocked]=useState(false);
  const [reduced,setReduced]=useState(()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches);
  const canMove=Boolean(film&&!quiet&&!reduced);
  useEffect(()=>{const query=matchMedia('(prefers-reduced-motion: reduce)');const change=()=>setReduced(query.matches);query.addEventListener('change',change);return()=>query.removeEventListener('change',change)},[]);
  useEffect(()=>{
    const element=video.current;if(!element)return;
    let cancelled=false;
    const sync=()=>{if(paused||!canMove||document.hidden){element.pause();return;}Promise.resolve(element.play()).then(()=>{if(!cancelled)setBlocked(false)}).catch(()=>{if(!cancelled)setBlocked(true)})};
    sync();document.addEventListener('visibilitychange',sync);
    return()=>{cancelled=true;document.removeEventListener('visibilitychange',sync);element.pause()};
  },[film?.src,paused,canMove]);
  useEffect(()=>{const element=video.current;setReady(false);setBlocked(false);return()=>{if(element){element.pause();element.removeAttribute('src');element.load()}}},[film?.src,canMove]);
  return <div className={`film-surface ${className}${ready&&canMove?' film-is-ready':''}`} style={style}>
    <img className="film-poster" src={poster||film?.poster} alt="" onLoad={onImageLoad} draggable="false" />
    {canMove&&<video key={film.src} ref={video} className="film-video" src={film.src} muted loop playsInline preload="metadata" autoPlay={!paused} aria-hidden="true" onPlaying={()=>setReady(true)} onError={()=>{setReady(false);setBlocked(true)}} />}
    {interactive&&blocked&&canMove&&<button className="film-start" onClick={()=>video.current?.play().then(()=>setBlocked(false)).catch(()=>{})}>播放这段动态镜头</button>}
  </div>;
}
