#!/usr/bin/env python3
"""Prepare fixed-geometry 8K backgrounds from enhanced scene illustrations.

The output is explicitly enhanced/upscaled art, not native 8K source detail.
Model and private production inputs are provisioned separately. No source PNG,
model weights, or machine paths enter the published metadata.
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import sys
import time

MODEL_SHA = '5c68d18db561aed8ead4ffedf1b897ea615baaf60ebf6c35f8e641f8fa4a21bf'
FILENAMES = {**{k:'film-'+k+'.webp' for k in ('arrival','bakery','bookshop','workshop','kitchen','garden','shore','night')},
    'room':'immersive-room.webp','letters':'immersive-letters.webp','community':'immersive-community.webp',
    'market':'immersive-market.webp','courtyard':'immersive-courtyard.webp','winter':'immersive-winter-courtyard.webp',
    'tea':'play-tea-table.webp','shells':'play-shell-shore.webp'}

def sha(path):
    with Path(path).open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()

def write(path,value):
    Path(path).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--python-packages',required=True,type=Path)
    p.add_argument('--model',required=True,type=Path)
    p.add_argument('--sources',required=True,type=Path)
    p.add_argument('--enhancements',required=True,type=Path)
    p.add_argument('--output',required=True,type=Path)
    p.add_argument('--only',default='')
    p.add_argument('--install',action='store_true')
    args=p.parse_args();assert sha(args.model)==MODEL_SHA
    sys.path.insert(0,str(args.python_packages.resolve()))
    import cv2
    from PIL import Image
    Image.MAX_IMAGE_PIXELS=120_000_000
    cv2.setNumThreads(4)
    original={r['key']:r for r in json.loads(args.sources.read_text())}
    enhanced=json.loads(args.enhancements.read_text())
    assert set(original)==set(enhanced)==set(FILENAMES)
    args.output.mkdir(parents=True,exist_ok=True)
    (args.output/'previews').mkdir(exist_ok=True)
    model=cv2.dnn_superres.DnnSuperResImpl_create();model.readModel(str(args.model));model.setModel('fsrcnn',4)
    selected=args.only.split(',') if args.only else list(FILENAMES)
    for key in selected:
        started=time.perf_counter();filename=FILENAMES[key];src=Path(enhanced[key]);source_sha=sha(src)
        original_sha=sha(original[key]['source'])
        dest=args.output/filename;preview=args.output/'previews'/filename;meta=args.output/(key+'.json')
        if meta.exists() and dest.exists() and preview.exists():
            cached=json.loads(meta.read_text())
            if cached['enhancedSourceSha256']==source_sha and cached['sourceSha256']==original_sha and cached['sha256']==sha(dest) and cached['previewSha256']==sha(preview):continue
        image=cv2.imread(str(src));assert image is not None
        h,w=image.shape[:2];ow,oh=original[key]['sourceDimensions']
        with Image.open(original[key]['source']) as check:assert check.size==(ow,oh),'Original source dimensions differ from the inventory'
        assert abs((w/h)/(ow/oh)-1)<.003,'Enhancement changed the source aspect ratio'
        up=model.upsample(image)
        width=7680;height=round(width*h/w/2)*2
        result=cv2.resize(up,(width,height),interpolation=cv2.INTER_LANCZOS4)
        del up
        rgb=Image.fromarray(cv2.cvtColor(result,cv2.COLOR_BGR2RGB));del result
        rgb.save(dest,format='WEBP',quality=90,method=5)
        thumb=Image.fromarray(cv2.cvtColor(image,cv2.COLOR_BGR2RGB));thumb.thumbnail((640,480));thumb.save(preview,format='WEBP',quality=86,method=5)
        with Image.open(dest) as check:assert check.size==(width,height);check.load()
        row={'key':key,'src':'/art/'+filename,'width':width,'height':height,'bytes':dest.stat().st_size,'sha256':sha(dest),
            'sourceDimensions':[ow,oh],'enhancedDimensions':[w,h],'enhancedSourceSha256':source_sha,
            'sourceSha256':original_sha,'native8K':False,'resampling':'AI detail restoration; FSRCNN x4; aspect-preserving Lanczos resize; WebP quality 90',
            'modelSha256':MODEL_SHA,'preview':'/art/previews/'+filename,'previewWidth':thumb.width,'previewHeight':thumb.height,
            'previewBytes':preview.stat().st_size,'previewSha256':sha(preview)}
        assert abs((width/height)/(w/h)-1)<.0003
        write(meta,row);print(json.dumps({'key':key,'width':width,'height':height,'bytes':row['bytes'],'seconds':round(time.perf_counter()-started,2)}),flush=True)
    rows=[json.loads((args.output/(key+'.json')).read_text()) for key in FILENAMES if (args.output/(key+'.json')).exists()]
    report={'version':'3.2.0','backgrounds':len(rows),'native8K':False,'modelSha256':MODEL_SHA,'assets':rows,
        'clarity':'Every main background is 7680 pixels wide, enhanced/upscaled from the documented smaller sources. Pixel dimensions do not establish native 8K detail.',
        'motion':'Fixed scene geometry. Independent vector light, reflections, steam and dust. No texture-coordinate displacement or image morphing.'}
    write(args.output/'manifest.json',report)
    if args.install:
        assert len(rows)==16 and not args.only
        root=Path(__file__).resolve().parents[1];art=root/'public/art';(art/'previews').mkdir(exist_ok=True)
        for row in rows:
            filename=Path(row['src']).name
            assert sha(args.output/filename)==row['sha256']
            shutil.copyfile(args.output/filename,art/filename)
            shutil.copyfile(args.output/'previews'/filename,art/'previews'/filename)
        write(art/'ASSETS-8K.json',report)
        entries=[[r['src'],{**{k:r[k] for k in ('width','height','bytes','sha256','preview')},'motionKey':Path(r['src']).stem}] for r in rows]
        (root/'src/artworkAssets.js').write_text('// Generated from verified 8K-output artwork; sources are enhanced/upscaled.\nexport const ARTWORK_ASSETS = Object.fromEntries('+json.dumps(entries,ensure_ascii=False,indent=2)+');\nexport const artworkPreview = source => ARTWORK_ASSETS[source]?.preview || source;\n')
        print(json.dumps({'installed':len(rows),'bytes':sum(r['bytes'] for r in rows)}),flush=True)

if __name__=='__main__':main()
