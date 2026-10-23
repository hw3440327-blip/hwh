import React, { useId } from 'react';

function AtlasCell({src,region,width=418,height=627}) {
  const id=useId().replaceAll(':',''),[x,y,w,h]=region.split(' ').map(Number);
  return <svg width={width} height={height} viewBox={region} preserveAspectRatio="xMidYMax meet" overflow="hidden"><defs><clipPath id={'atlas-'+id}><rect x={x} y={y} width={w} height={h}/></clipPath></defs><image href={src} width="1254" height="1254" clipPath={`url(#atlas-${id})`}/></svg>;
}

// Each atlas cell is clipped independently, including its transparent gutter.
// The paintings stay still; steam, shadows and hands are separate layers.
export function PaintedBread({ recipe='milk', shape='round', colour=.55, additions=[], className='', steaming=false }) {
  const row=recipe==='fruit'||additions.includes('fruit')?1:recipe==='sesame'||additions.includes('sesame')?2:0;
  const col=shape==='twist'?1:shape==='leaf'?2:0;
  const tone=Math.max(0,Math.min(1,colour));
  return <svg className={`painted-bread ${className}`} viewBox="0 0 420 300" aria-hidden="true" data-bread-flavour={row===1?'fruit':row===2?'sesame':'milk'} data-bread-shape={shape}>
    <svg x="15" y="-39" width="390" height="390" viewBox={`${col*418} ${row*418} 418 418`} overflow="hidden" style={{filter:`saturate(${.55+tone*.65}) brightness(${1.19-tone*.33})`}}><image href="/art/play-bread-atlas.webp" width="1254" height="1254"/></svg>
    {row===1&&additions.includes('sesame')&&Array.from({length:22},(_,i)=><ellipse key={i} cx={115+i*37%187} cy={100+i*31%104} rx="1.7" ry="3.3" fill="#e4c994" transform={`rotate(${i*29} ${115+i*37%187} ${100+i*31%104})`}/>)}
    {steaming&&<g className="painted-steam" stroke="#fff3d3" strokeWidth="2" fill="none" strokeLinecap="round"><path d="M157 33Q143 16 157 0M210 25Q194 9 211-9M261 34Q248 14 260 1"/></g>}
  </svg>;
}

export function PaintedDecoration({item,age=0,className='',surface}) {
  const region={flower:'0 0 430 575',shell:'437 150 380 405',book:'811 157 443 439',basket:'8 580 455 610',lamp:'461 584 370 626',cup:'825 615 429 606'}[item]||'0 0 430 575';
  const placed={flower:'30 95 400 520',shell:'462 365 305 242',book:'788 303 461 329',basket:'20 819 408 375',lamp:'465 671 320 511',cup:'847 838 393 346'}[item];
  const [, ,w,h]=(placed||region).split(' ').map(Number),height=surface?418*h/w:627;
  return <svg className={`painted-decoration ${className}`} viewBox={`0 0 418 ${height}`} aria-hidden="true" data-painted-decoration={item} data-decor-pose={surface?'resting':'inventory'} data-decor-surface={surface} data-growth={age}>
    <AtlasCell src={surface?'/art/play-home-placed.webp':'/art/play-home-atlas.webp'} region={surface?placed:region} height={height}/>
    {item==='flower'&&age>0&&<g className="home-new-leaf" fill="#849765" stroke="#536e43" strokeWidth="1"><path d="M208 370Q257 301 287 318Q283 361 208 370Z"/>{age>1&&<path d="M210 340Q166 286 132 306Q144 342 210 340Z"/>}</g>}
  </svg>;
}

export function PaintedKitchen({kind,className=''}) {
  const region={water:'22 132 436 510',flour:'458 110 382 530',milk:'900 120 300 520',fruit:'10 780 415 320',sesame:'426 750 399 378',soup:'811 699 443 463'}[kind];
  if(!region)return null;
  return <svg className={`painted-kitchen ${className}`} viewBox="0 0 418 627" aria-hidden="true"><AtlasCell src="/art/play-kitchen-atlas.webp" region={region}/></svg>;
}

export function PaintedWorkbench({kind,className='',front=false}) {
  const id=useId().replaceAll(':','');
  const region=kind==='tray'?'637 140 610 500':'15 108 630 510',height=kind==='tray'?230:260;
  return <svg className={className} viewBox={`0 0 420 ${height}`} aria-hidden="true"><defs><clipPath id={'rim-'+id}><path d="M45 103Q210 230 375 103L420 260H0Z"/></clipPath></defs><g clipPath={front?`url(#rim-${id})`:undefined}><AtlasCell src="/art/play-workbench-atlas.webp" region={region} width={420} height={height}/></g></svg>;
}

export function PaintedStone({kind='flat'}) {
  return <svg className={'painted-stone '+(kind==='round'?'is-round':'')} viewBox="0 0 110 76" aria-hidden="true"><AtlasCell src="/art/play-workbench-atlas.webp" region={kind==='heart'?'715 710 490 450':'57 744 580 400'} width={110} height={76}/></svg>;
}

export function PaintedFlour() {
  const id=useId().replaceAll(':','');
  return <g><defs><clipPath id={'flour-'+id}><path d="M67 140Q112 119 145 102Q179 106 206 92Q246 98 269 108L350 145Q208 185 67 140Z"/></clipPath></defs><g clipPath={`url(#flour-${id})`}><svg x="60" y="75" width="300" height="110" viewBox="540 275 190 95" preserveAspectRatio="none"><image href="/art/play-kitchen-atlas.webp" width="1254" height="1254"/></svg></g></g>;
}

export function PaintedBakeryProp({kind,className=''}) {
  const region={bag:'102 35 470 640',coat:'728 0 460 704',cloth:'3 724 700 512',card:'716 750 518 460'}[kind];
  if(!region)return null;
  const [, ,width,height]=region.split(' ').map(Number);
  return <svg className={className} viewBox={`0 0 ${width} ${height}`} aria-hidden="true"><AtlasCell src="/art/play-bakery-details.webp" region={region} width={width} height={height}/></svg>;
}
