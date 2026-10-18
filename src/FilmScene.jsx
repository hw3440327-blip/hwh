import React, { useEffect, useState } from 'react';
import { filmForScene } from './films.js';
import SceneMotion from './SceneMotion.jsx';
import { ARTWORK_ASSETS } from './artworkAssets.js';
import './film-scene.css';

export default function FilmScene({ scene, poster, className='', style, paused=false, quiet=false, onImageLoad }) {
  const source = poster || filmForScene(scene)?.poster;
  const asset = ARTWORK_ASSETS[source];
  const [visible,setVisible] = useState(() => !document.hidden);
  const [reduced,setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(query.matches);
    const visibility = () => setVisible(!document.hidden);
    query.addEventListener('change',change);
    document.addEventListener('visibilitychange',visibility);
    return () => { query.removeEventListener('change',change);document.removeEventListener('visibilitychange',visibility); };
  },[]);
  // A fixed painting and independent vector effects: no image displacement,
  // low-resolution video substitution, or animated scaling of a person's body.
  return <div className={`film-surface ${className}`} style={style} data-scene-resolution={asset ? `${asset.width}×${asset.height}` : undefined}>
    <img className="film-poster" src={source} alt="" width={asset?.width} height={asset?.height} decoding="async" fetchPriority="high" onLoad={onImageLoad} draggable="false" />
    {!quiet&&!reduced&&<SceneMotion artwork={source} scene={scene} running={!paused&&visible} />}
  </div>;
}
