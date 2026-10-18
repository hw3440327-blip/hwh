import React, { useEffect, useRef, useState } from 'react';
import { sceneArtKey } from './visuals.js';
import './scene-atmosphere.css';

export function atmosphereKind(scene) {
  const key = sceneArtKey(scene);
  if (/arrival|shore|spring/.test(key)) return 'coast';
  if (/garden|courtyard/.test(key)) return 'garden';
  if (key === 'bakery' || key === 'market') return 'warmth';
  return 'window';
}

/** Small, composited layers; all motion can be paused without a render loop. */
export default function SceneAtmosphere({ scene, closeup = false, detailId = '', interactive = false }) {
  const kind = atmosphereKind(scene);
  const [touch, setTouch] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const water = kind === 'coast' || /sea|boat|night|washer/.test(detailId);
  const steam = /oven|cup|tea|porridge/.test(detailId) || kind === 'warmth';
  const wetWindow = kind === 'window' && /雨/.test(scene.weather || '') && !/雨后|雨停|雨将停|初歇/.test(scene.weather || '');
  function touchScene(event) {
    if (!interactive || event.target.closest('button')) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setTouch({ x: (event.clientX - bounds.left) / bounds.width * 100, y: (event.clientY - bounds.top) / bounds.height * 100, id: Date.now() });
    clearTimeout(timer.current); timer.current = setTimeout(() => setTouch(null), 1600);
  }
  return <div className={`sa-layer sa-${kind}${closeup ? ' sa-closeup' : ''}${interactive ? ' sa-interactive' : ''}`} aria-hidden="true" onPointerDown={touchScene}>
    <div className="sa-lightshaft" /><div className="sa-dapple" />
    {wetWindow && <div className="sa-glass">{[0, 1, 2, 3, 4].map(i => <i key={i} style={{ '--n': i }} />)}</div>}
    {Array.from({ length: closeup ? 9 : 14 }, (_, i) => <i className="sa-mote" key={i} style={{ '--n': i, left: `${(i * 31 + 7) % 99}%`, top: `${(i * 17 + 8) % 85}%` }} />)}
    {water && <div className="sa-water">{Array.from({ length: 5 }, (_, i) => <i key={i} style={{ '--n': i }} />)}</div>}
    {steam && <div className="sa-steam">{[0, 1, 2].map(i => <i key={i} style={{ '--n': i }} />)}</div>}
    {kind === 'garden' && <div className="sa-foreground"><i /><i /><i /></div>}
    {touch && <div key={touch.id} className={`sa-touch ${water ? 'sa-ripple' : 'sa-glimmer'}`} style={{ left: `${touch.x}%`, top: `${touch.y}%` }}><i /><i /><i /></div>}
  </div>;
}
