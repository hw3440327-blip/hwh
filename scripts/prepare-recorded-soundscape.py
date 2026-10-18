#!/usr/bin/env python3
"""Prepare credited field recordings and quiet foley, from verified local sources.

Source acquisition is separate; sources.json records Wikimedia SHA-1, SHA-256,
author, license, and description page. This script never downloads audio.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import numpy as np
from scipy.signal import butter,sosfilt

RATE=24000

def run(args):return subprocess.run(args,check=True,capture_output=True).stdout

def sha(path):
    with Path(path).open('rb')as f:return hashlib.file_digest(f,'sha256').hexdigest()

def load(path):
    raw=run(['ffmpeg','-nostdin','-v','error','-i',str(path),'-map','0:a:0','-ar',str(RATE),'-ac','2','-f','f32le','pipe:1'])
    return np.frombuffer(raw,dtype='<f4').reshape(-1,2).copy()

def filtered(a,high=70,low=7000):
    return sosfilt(butter(2,[high,low],fs=RATE,btype='bandpass',output='sos'),a,axis=0).astype(np.float32)

def normalize(a,rms=.042):
    volume=float(np.sqrt(np.mean(a.astype(np.float64)**2)));peak=float(np.max(np.abs(a)))
    assert volume>1e-6 and np.isfinite(a).all()
    return a*min(rms/volume,.72/max(peak,1e-6))

def loop(a,fade=1.5):
    n=min(int(fade*RATE),len(a)//4);w=np.linspace(0,np.pi/2,n,dtype=np.float32)[:,None]
    return np.concatenate([a[-n:]*np.cos(w)+a[:n]*np.sin(w),a[n:-n]],axis=0)

def part(a,start,seconds):return a[int(start*RATE):int((start+seconds)*RATE)]
def tile(a,seconds):return np.tile(a,(int(np.ceil(seconds*RATE/len(a)))+1,1))[:int(seconds*RATE)]

def transient(a,window=.5,search_start=0,search_end=None):
    begin=int(search_start*RATE);end=min(len(a),int((search_end or len(a)/RATE)*RATE));chunk=a[begin:end];block=int(.02*RATE);levels=np.array([np.mean(chunk[i:i+block]**2)for i in range(0,len(chunk)-block,block)]);peak=begin+int(np.argmax(levels))*block
    start=max(begin,peak-int(.04*RATE));out=a[start:min(end,start+int(window*RATE))].copy();n=min(int(.015*RATE),len(out)//4);out[:n]*=np.linspace(0,1,n)[:,None];out[-n:]*=np.linspace(1,0,n)[:,None];return out,start/RATE

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--sources',required=True,type=Path);p.add_argument('--output',required=True,type=Path);p.add_argument('--metadata',required=True,type=Path);p.add_argument('--module',required=True,type=Path);args=p.parse_args()
    rows=json.loads(args.sources.read_text());sources={r['key']:r for r in rows};a={}
    for key,r in sources.items():
        assert r['license']in ('Public domain','CC0','CC BY 3.0','CC BY 4.0')
        assert sha(r['file'])==r['sourceSha256'];a[key]=load(r['file'])
    sea=loop(filtered(part(a['sea'],18,48),70,6800),2)
    rain=loop(filtered(part(a['rain'],2,41),140,6500),2)
    leaf=loop(filtered(part(a['leaves'],.5,17),100,6500),1.8)
    birds=loop(filtered(part(a['garden'],2,45),170,8500),2)
    fire=loop(filtered(part(a['fire'],.5,16.5),90,3800),1.8)
    garden=loop(normalize(tile(birds,43))*.67+normalize(tile(leaf,43))*.33,1.5)
    interior=loop(filtered(normalize(tile(leaf,38))*.87+normalize(tile(birds,38))*.07,100,1350),2)
    bakery=loop(normalize(tile(fire,39))*.8+normalize(tile(leaf,39))*.12,1.8)
    workshop=loop(filtered(normalize(tile(leaf,35))*.9+normalize(tile(birds,35))*.055,110,2100),1.5)
    wood,wood_at=transient(filtered(a['wood'],80,5500),.48,0,2)
    touch,touch_at=transient(filtered(a['paper'],220,6000),.36,0,12)
    page,page_at=transient(filtered(a['paper'],130,6800),1.1,12,36)
    water=loop(filtered(part(a['water'],4,4),120,7000),.45)
    pour=loop(filtered(part(a['water'],3.5,6),100,7800),.8)
    complete=np.concatenate([wood*.65,np.zeros((int(RATE*.12),2)),wood*.38],axis=0)
    tracks={
      'sea':(sea,['sea'],'shore waves; excerpt from 18 s; bandpass, equal-power overlap, gain'),
      'rain':(rain,['rain'],'rain excerpt from 2 s; bandpass, equal-power overlap, gain'),
      'garden':(garden,['garden','leaves'],'garden birds with quiet rustling leaves; layered, bandpass, seamless overlap, gain'),
      'interior':(interior,['leaves','garden'],'window-side air made from attenuated outdoor recordings; lowpass, seamless overlap, gain; not an indoor field recording'),
      'bakery':(bakery,['fire','leaves'],'quiet hearth texture and distant leaves; layered, bandpass, seamless overlap, gain'),
      'workshop':(workshop,['leaves','garden'],'quiet window-side outdoor texture; lowpass, seamless overlap, gain'),
      'wood':(wood,['wood'],f'wood touch excerpt from {wood_at:.3f} s; bandpass and short edge fades'),
      'touch':(touch,['paper'],f'paper surface excerpt from {touch_at:.3f} s; bandpass and short edge fades'),
      'page':(page,['paper'],f'book/paper excerpt from {page_at:.3f} s; bandpass and short edge fades'),
      'water':(water,['water'],'real water into a mug excerpt from 4 s; bandpass, seamless overlap, gain'),
      'pour':(pour,['water'],'real water into a mug excerpt from 3.5 s; bandpass, seamless overlap, gain'),
      'complete':(complete,['wood'],'two attenuated wooden taps; splice and gain; no electronic completion tone'),
    }
    args.output.mkdir(parents=True,exist_ok=True);records=[]
    for key,(samples,used,edits)in tracks.items():
        samples=samples.copy();edge=min(int(.022*RATE),len(samples)//6);taper=np.sin(np.linspace(0,np.pi/2,edge,dtype=np.float32))[:,None];samples[:edge]*=taper;samples[-edge:]*=taper[::-1]
        samples=normalize(samples,.046 if key in ('wood','touch','page','water','pour','complete') else .042)
        path=args.output/(key+'.ogg')
        with tempfile.NamedTemporaryFile(suffix='.f32',dir='/tmp')as tmp:
            tmp.write(samples.astype('<f4').tobytes());tmp.flush()
            run(['ffmpeg','-nostdin','-y','-hide_banner','-loglevel','error','-f','f32le','-ar',str(RATE),'-ac','2','-i',tmp.name,'-map_metadata','-1','-codec:a','libopus','-b:a','72k'if key not in ('wood','touch','complete')else'56k','-application','audio',str(path)])
        decoded=load(path);assert abs(len(decoded)-len(samples))<RATE*.02;assert np.isfinite(decoded).all()
        records.append({'key':key,'src':'/audio/ambience/'+path.name,'bytes':path.stat().st_size,'sha256':sha(path),'seconds':round(len(decoded)/RATE,6),'sampleRate':RATE,'channels':2,'rms':round(float(np.sqrt(np.mean(decoded.astype(np.float64)**2))),6),'peak':round(float(np.max(np.abs(decoded))),6),'sources':used,'changes':edits})
    public_sources=[{k:r[k]for k in ('key','title','artist','license','licenseUrl','page','url','sourceSha256')}for r in rows]
    out={'version':1,'codec':'Opus in Ogg','method':'Licensed real recordings; excerpts, filtering, gain, layering and loop overlap. No procedural noise bed or synthetic bird oscillator.','sources':public_sources,'tracks':records};args.metadata.parent.mkdir(parents=True,exist_ok=True);args.metadata.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n');args.module.write_text('// Generated from verified field recordings and foley.\nexport const SOUND_RECORDINGS = '+json.dumps({t['key']:t for t in records},ensure_ascii=False,indent=2)+';\nexport const SOUND_ATTRIBUTIONS = '+json.dumps(public_sources,ensure_ascii=False,indent=2)+';\n');print(json.dumps({'tracks':len(records),'bytes':sum(t['bytes']for t in records),'seconds':sum(t['seconds']for t in records)}))

if __name__=='__main__':main()
