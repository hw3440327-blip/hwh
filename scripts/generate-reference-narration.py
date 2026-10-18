#!/usr/bin/env python3
"""Render exact game prose using a supplied private voice reference.

Models are provisioned separately and checked against official release digests.
No reference recording is copied into the game. Each output is cacheable only
with identical text, reference, model and synthesis settings. Product files are
installed later by build-narration-manifest.mjs after the entire batch passes.
"""
import argparse
import concurrent.futures
import hashlib
import json
import multiprocessing
import os
from pathlib import Path
import re
import subprocess
import sys
import time

MODEL_PACKAGES = {
    'sherpa-onnx-zipvoice-distill-fp32-zh-en-emilia': ('ZipVoice-Distill-FP32-zh-en-Emilia', '3b6729d03bf4ba64deeec113048bdbbe55dbc30580b609be76342e0099fd23a8'),
    'sherpa-onnx-zipvoice-zh-en-emilia': ('ZipVoice-FP32-zh-en-Emilia', '098feeb0566875751eb8776b87060b9889b32b17d3649504e4514ce2b6a85100'),
}
VOCODER_SHA = 'bcb3b970e384161c4d634f0bb9e999ff1c471b34c9bc0b1049a5014065ed3cc0'
LICENSE_URL = 'https://raw.githubusercontent.com/k2-fsa/ZipVoice/master/LICENSE'
worker = {}

def digest(path):
    with Path(path).open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()

def canonical(value):
    # Match JSON.stringify in the manifest builder: Python writes 1.0 while
    # JavaScript writes 1. These are the same setting and must hash identically.
    def normalize(item):
        if isinstance(item, float) and item.is_integer(): return int(item)
        if isinstance(item, dict): return {k: normalize(v) for k, v in item.items()}
        if isinstance(item, list): return [normalize(v) for v in item]
        return item
    return hashlib.sha256(json.dumps(normalize(value), ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()

def write(path, value):
    p=Path(path); tmp=p.with_name(f'.{p.name}.{os.getpid()}.tmp')
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n'); tmp.replace(p)

def run(args):
    return subprocess.run(args, check=True, capture_output=True).stdout

def probe(path):
    d=json.loads(run(['ffprobe','-v','error','-show_entries','format=duration:stream=codec_name,sample_rate,channels','-of','json',str(path)]))
    assert len(d['streams'])==1 and d['streams'][0]['codec_name']=='mp3'
    assert d['streams'][0]['channels']==1 and int(d['streams'][0]['sample_rate'])==24000
    return float(d['format']['duration'])

def distance(a,b):
    row=list(range(len(b)+1))
    for i,x in enumerate(a):
        new=[i+1]
        for j,y in enumerate(b):
            new.append(min(new[-1]+1,row[j+1]+1,row[j]+(x!=y)))
        row=new
    return row[-1]

def initialize(options, config, config_hash):
    sys.path.insert(0,options['python_packages'])
    import numpy as np
    import sherpa_onnx
    import soundfile as sf
    m=Path(options['model_dir']); r=Path(options['asr_model_dir'])
    model=sherpa_onnx.OfflineTtsZipvoiceModelConfig(tokens=str(m/'tokens.txt'),encoder=str(m/'encoder.onnx'),decoder=str(m/'decoder.onnx'),vocoder=options['vocoder'],data_dir=str(m/'espeak-ng-data'),lexicon=str(m/'lexicon.txt'))
    c=sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(zipvoice=model,provider='cpu',num_threads=options['threads']))
    assert c.validate();tts=sherpa_onnx.OfflineTts(c)
    asr=sherpa_onnx.OfflineRecognizer.from_sense_voice(model=str(r/'model.int8.onnx'),tokens=str(r/'tokens.txt'),num_threads=1,language='zh',use_itn=True)
    audio,rate=sf.read(options['reference_wav'],dtype='float32')
    assert audio.ndim==1 and 1<=len(audio)/rate<=15
    gen=sherpa_onnx.GenerationConfig();gen.reference_audio=audio;gen.reference_sample_rate=rate;gen.reference_text=Path(options['reference_text_file']).read_text().strip();gen.num_steps=options['steps'];gen.speed=options['speed'];gen.extra['min_char_in_sentence']='30'
    # The first audition used the library's default guidance. Preserve that exact
    # configuration when completing its cached recordings after a voice revert.
    if not options['first_reference_audition']:gen.extra['guidance_scale']=str(options['guidance'])
    phones={}
    for line in (m/'lexicon.txt').open():
        key,_,value=line.rstrip().partition(' ')
        if len(key)==1 and '\u3400'<=key<='\u9fff':phones[key]=value.replace(' ','')
    worker.update(o=options,c=config,ch=config_hash,np=np,sf=sf,tts=tts,asr=asr,gen=gen,phones=phones)

def transcript(samples,rate):
    s=worker['asr'].create_stream();s.accept_waveform(rate,samples);worker['asr'].decode_stream(s);return s.result.text

def score(text,actual):
    normalize=lambda x:re.sub(r'[^\u3400-\u9fffA-Za-z0-9]','',x).lower()
    expected=normalize(text);actual=normalize(actual);phones=worker['phones']
    raw=distance(expected,actual)/max(1,len(expected))
    a=[phones.get(c,c)for c in expected];b=[phones.get(c,c)for c in actual]
    return round(raw,4),round(distance(a,b)/max(1,len(a)),4)

def render(clip):
    o=worker['o'];folder=Path(o['output_dir']);stem=clip['id'];mp3=folder/(stem+'.mp3');meta_file=folder/(stem+'.json')
    try:
        cached=json.loads(meta_file.read_text())
        if cached['text']==clip['text'] and cached['voiceConfigHash']==worker['ch'] and cached['sha256']==digest(mp3) and cached['bytes']==mp3.stat().st_size and cached['asr']['passed']:
            return cached
    except (OSError,KeyError,ValueError):pass
    started=time.perf_counter();np=worker['np'];sf=worker['sf'];best=None
    for attempt in range(2):
        audio=worker['tts'].generate(clip['text'],worker['gen']);samples=np.asarray(audio.samples,dtype=np.float32)
        assert samples.size>2400 and np.isfinite(samples).all()
        assert float(np.sqrt(np.mean(samples**2)))>.00001
        recognized=transcript(samples,audio.sample_rate);cer,pcer=score(clip['text'],recognized)
        result=(pcer,cer,samples,recognized)
        if best is None or result[:2]<best[:2]:best=result
        if pcer<=.12 and cer<=.24:break
    pcer,cer,samples,recognized=best
    # Ambiguous proper names may be spelled differently by ASR. Keep the raw
    # transcript and both scores for review; never rewrite displayed prose.
    if pcer>.24 or cer>.38:raise ValueError(f'Pronunciation review failed {stem}: {clip["text"]} -> {recognized} (CER {cer}, phonetic {pcer})')
    source=folder/'wav'/(stem+'.wav');tmp=mp3.with_name('.'+mp3.name+'.tmp.mp3');sf.write(source,samples,24000,subtype='PCM_16')
    run(['ffmpeg','-nostdin','-y','-hide_banner','-loglevel','error','-i',str(source),'-map_metadata','-1','-af','highpass=f=55,loudnorm=I=-19:TP=-2.5:LRA=9','-ar','24000','-ac','1','-codec:a','libmp3lame','-b:a','64k','-id3v2_version','3',str(tmp)])
    seconds=probe(tmp);run(['ffmpeg','-nostdin','-v','error','-xerror','-i',str(tmp),'-f','null','-']);tmp.replace(mp3)
    meta={**{k:clip[k]for k in ('id','text','textHash')},'sha256':digest(mp3),'seconds':round(seconds,6),'sourceSeconds':round(len(samples)/24000,6),'sampleRate':24000,'bytes':mp3.stat().st_size,'model':worker['c']['model'],'modelArchiveSha256':worker['c']['modelArchiveSha256'],'license':'Apache-2.0','licenseUrl':LICENSE_URL,'synthetic':True,'sid':0,'speed':o['speed'],'voiceConfig':worker['c'],'voiceConfigHash':worker['ch'],'generationSeconds':round(time.perf_counter()-started,3),'asr':{'model':'SenseVoice-Small-int8-2025-09-09','text':recognized,'characterErrorRate':cer,'phoneticErrorRate':pcer,'passed':True,'reviewSuggested':pcer>.12 or cer>.24}}
    write(meta_file,meta);return meta

def main():
    p=argparse.ArgumentParser(description=__doc__)
    for key in ('model-dir','vocoder','python-packages','inventory','reference-wav','reference-text-file','asr-model-dir','output-dir'):p.add_argument('--'+key,required=True,type=Path)
    p.add_argument('--guidance',type=float,default=1.5);p.add_argument('--steps',type=int,default=16);p.add_argument('--workers',type=int,default=4);p.add_argument('--threads',type=int,default=1);p.add_argument('--speed',type=float,default=1.0);p.add_argument('--limit',type=int,default=0)
    p.add_argument('--first-reference-audition',action='store_true',help='Resume the original four-step, speed 0.94 audition with unchanged synthesis settings.')
    a=p.parse_args();assert 1<=a.workers<=4 and 1<=a.threads<=4 and a.steps in (4,8,12,16) and .7<=a.speed<=1.2 and .5<=a.guidance<=3
    for k,v in vars(a).items():
        if isinstance(v,Path):setattr(a,k,v.resolve())
    model_name,archive_sha=MODEL_PACKAGES[a.model_dir.name]
    assert digest(a.model_dir.parent/(a.model_dir.name+'.tar.bz2'))==archive_sha
    assert digest(a.vocoder)==VOCODER_SHA
    inventory=json.loads(a.inventory.read_text());assert not inventory['unrecordable'];clips=inventory['clips'];assert clips
    for clip in clips:assert clip['id']==clip['textHash']==hashlib.sha256(clip['text'].encode()).hexdigest()
    a.output_dir.mkdir(parents=True,exist_ok=True);(a.output_dir/'wav').mkdir(exist_ok=True)
    if a.limit:clips=clips[:a.limit]
    write(a.output_dir/'failures.json', {})
    config={'model':model_name,'modelArchiveSha256':archive_sha,'vocoderSha256':VOCODER_SHA,'modelFiles':{name:digest(a.model_dir/name)for name in ('encoder.onnx','decoder.onnx','tokens.txt','lexicon.txt')},'referenceSha256':digest(a.reference_wav),'referenceTextSha256':digest(a.reference_text_file),'sid':0,'speed':a.speed,'steps':a.steps,'guidanceScale':a.guidance,'minCharInSentence':30,'sampleRate':24000,'channels':1,'codec':'libmp3lame','bitrate':'64k','loudnorm':{'I':-19,'TP':-2.5,'LRA':9},'highpass':55,'provider':'cpu','numThreads':a.threads,'pipelineVersion':2,'sherpaOnnx':'1.13.8'}
    if a.first_reference_audition:
        assert model_name=='ZipVoice-Distill-FP32-zh-en-Emilia' and a.steps==4 and a.speed==.94 and a.threads==1
        config.pop('guidanceScale');config['pipelineVersion']=1
        assert canonical(config)=='358365d3aa946c0e80c943259352d9a05d9b16bee9583e7fa47f69ee690cc8bd', 'First audition settings or private reference differ; existing audio must not be relabeled.'
    ch=canonical(config);options={k:str(v)if isinstance(v,Path)else v for k,v in vars(a).items()};records={};failures={};started=time.perf_counter()
    def progress():
        d={'count':len(records),'failed':len(failures),'total':len(clips),'audioSeconds':round(sum(c['seconds']for c in records.values()),2),'runtimeSeconds':round(time.perf_counter()-started,2),'voiceConfigHash':ch};write(a.output_dir/'progress.json',d);print('PROGRESS '+json.dumps(d),flush=True)
    progress()
    with concurrent.futures.ProcessPoolExecutor(max_workers=a.workers,mp_context=multiprocessing.get_context('spawn'),initializer=initialize,initargs=(options,config,ch))as pool:
        futures={pool.submit(render,c):c['id']for c in clips}
        for future in concurrent.futures.as_completed(futures):
            try:
                meta=future.result();records[meta['id']]=meta
            except Exception as error:
                failures[futures[future]]=str(error)
                write(a.output_dir/'failures.json',failures)
                print('CLIP_FAILED '+futures[future]+': '+str(error),flush=True)
            if (len(records)+len(failures))%5==0 or len(records)+len(failures)==len(clips):progress()
    ordered=[records[c['id']]for c in clips if c['id']in records];results={'version':1,'complete':not a.limit and not failures,'failures':failures,'model':model_name,'modelArchiveSha256':archive_sha,'license':'Apache-2.0','licenseUrl':LICENSE_URL,'synthetic':True,'sid':0,'speed':a.speed,'inventorySha256':digest(a.inventory),'voiceConfig':config,'voiceConfigHash':ch,'stats':{'clips':len(ordered),'audioSeconds':round(sum(c['seconds']for c in ordered),3),'bytes':sum(c['bytes']for c in ordered),'runtimeSeconds':round(time.perf_counter()-started,2)},'clips':ordered};write(a.output_dir/'results.json',results);print(('INCOMPLETE 'if failures else 'COMPLETE ')+json.dumps(results['stats']),flush=True)
    if failures:raise RuntimeError(f'{len(failures)} clips failed pronunciation validation; product files were not installed')

if __name__=='__main__':
    try:main()
    except Exception as e:print(f'ERROR {type(e).__name__}: {e}',file=sys.stderr,flush=True);sys.exit(1)
