#!/usr/bin/env python3
"""Restore the approved paintings from Git and resample without new detail.

Only Pillow is needed. No generated replacement, super-resolution model,
sharpening, colour filter or local deformation enters this pipeline.
8K describes the output pixels, not the source's native detail.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
import shutil
import subprocess
import time

SOURCE_REVISION = 'a7b8c74d61b9a2c62aada7c5f222a59bac624fc6'
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
    p.add_argument('--output',required=True,type=Path)
    p.add_argument('--install',action='store_true')
    args=p.parse_args()
    from PIL import Image, ImageChops, ImageStat
    Image.MAX_IMAGE_PIXELS=120_000_000
    root=Path(__file__).resolve().parents[1]
    args.output.mkdir(parents=True,exist_ok=True)
    (args.output/'previews').mkdir(exist_ok=True)
    rows=[]
    for key,filename in FILENAMES.items():
        started=time.perf_counter()
        source_path='public/art/'+filename
        source=subprocess.check_output(['git','show',SOURCE_REVISION+':'+source_path],cwd=root)
        original=Image.open(io.BytesIO(source)).convert('RGB')
        ow,oh=original.size
        width=7680;height=round(width*oh/ow/2)*2
        # One ordinary resize from the exact previously published painting.
        result=original.resize((width,height),Image.Resampling.BICUBIC)
        dest=args.output/filename;preview=args.output/'previews'/filename
        result.save(dest,format='WEBP',quality=94,method=5)
        thumb=original.copy();thumb.thumbnail((640,480),Image.Resampling.LANCZOS)
        thumb.save(preview,format='WEBP',quality=90,method=5)
        with Image.open(dest) as check:
            assert check.size==(width,height)
            restored=check.convert('RGB').resize((ow,oh),Image.Resampling.BICUBIC)
        difference=ImageStat.Stat(ImageChops.difference(original,restored))
        error=sum(difference.mean)/3
        assert error<3,'Resampling changed the painting beyond the fidelity budget'
        row={'key':key,'src':'/art/'+filename,'width':width,'height':height,
            'bytes':dest.stat().st_size,'sha256':sha(dest),'sourceRevision':SOURCE_REVISION,
            'sourcePath':source_path,'sourceDimensions':[ow,oh],
            'sourceSha256':hashlib.sha256(source).hexdigest(),'native8K':False,
            'generativeEnhancement':False,'sharpening':False,
            'resampling':'Original 3.1.0 painting; one aspect-preserving bicubic resize; WebP quality 94. No added detail or colour processing.',
            'roundTripMeanAbsoluteError':round(error,6),
            'preview':'/art/previews/'+filename,'previewWidth':thumb.width,'previewHeight':thumb.height,
            'previewBytes':preview.stat().st_size,'previewSha256':sha(preview)}
        assert abs((width/height)/(ow/oh)-1)<.0003
        rows.append(row)
        print(json.dumps({'key':key,'bytes':row['bytes'],'sourceError':row['roundTripMeanAbsoluteError'],
            'seconds':round(time.perf_counter()-started,2)}),flush=True)
    version=json.loads((root/'package.json').read_text())['version']
    report={'version':version,'backgrounds':len(rows),'native8K':False,
        'sourceRevision':SOURCE_REVISION,'generativeEnhancement':False,'sharpening':False,'assets':rows,
        'clarity':'Original 3.1.0 paintings resampled to 7680 pixels wide. No new detail is generated. Source colour, brushwork and composition are retained. These are not native 8K paintings.',
        'motion':'Fixed scene geometry. Independent vector light, reflections, steam and dust. No texture-coordinate displacement or image morphing.'}
    write(args.output/'manifest.json',report)
    if args.install:
        assert len(rows)==16
        art=root/'public/art';(art/'previews').mkdir(exist_ok=True)
        for row in rows:
            filename=Path(row['src']).name
            assert sha(args.output/filename)==row['sha256']
            shutil.copyfile(args.output/filename,art/filename)
            shutil.copyfile(args.output/'previews'/filename,art/'previews'/filename)
        write(art/'ASSETS-8K.json',report)
        entries=[[r['src'],{**{k:r[k] for k in ('width','height','bytes','sha256','preview')},'motionKey':Path(r['src']).stem}] for r in rows]
        (root/'src/artworkAssets.js').write_text('// Restored original paintings, resampled without added detail.\nexport const ARTWORK_ASSETS = Object.fromEntries('+json.dumps(entries,ensure_ascii=False,indent=2)+');\nexport const artworkPreview = source => ARTWORK_ASSETS[source]?.preview || source;\n')
        print(json.dumps({'installed':len(rows),'bytes':sum(r['bytes'] for r in rows)}),flush=True)

if __name__=='__main__':main()
