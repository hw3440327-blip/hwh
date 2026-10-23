#!/usr/bin/env python3
"""Assemble verified phrases of the chosen voice with directed, quiet pauses.

Run the existing reference renderer on release/memory-performance/inventory.json
first. Private voice reference files are never copied into public or release ZIPs.
"""
import hashlib,json,re,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'release/memory-performance'
sys.path.insert(0,'/workspace/.local/voice-production/python')
import numpy as np
import soundfile as sf
import sherpa_onnx

def run(args):return subprocess.run(args,check=True,capture_output=True).stdout
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def clean(t):return re.sub(r'[^\u3400-\u9fffA-Za-z0-9]','',t).lower()
def distance(a,b):
    row=list(range(len(b)+1))
    for i,x in enumerate(a):
        new=[i+1]
        for j,y in enumerate(b):new.append(min(new[-1]+1,row[j+1]+1,row[j]+(x!=y)))
        row=new
    return row[-1]

def main():
    source_path=ROOT/'public/audio/memory-box/SOURCES.json'
    source=json.loads(source_path.read_text())
    results=json.loads((WORK/'clips/results.json').read_text())
    assert results['complete'] and not results['failures']
    assert results['voiceConfigHash']==source['voiceConfigHash']
    asr_dir=Path('/workspace/.local/voice-production/models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2025-09-09')
    recognizer=sherpa_onnx.OfflineRecognizer.from_sense_voice(model=str(asr_dir/'model.int8.onnx'),tokens=str(asr_dir/'tokens.txt'),num_threads=1,language='zh',use_itn=True)
    inventory=json.loads((WORK/'inventory.json').read_text())['clips']
    phrase_records={r['id']:r for r in results['clips']}
    assert ''.join(clean(c['text'])for c in inventory)==''.join(clean(c['text'])for c in source['clips'])
    output=[]
    for n,previous in enumerate(source['clips']):
        phrases=inventory[n*3:n*3+3];pieces=[np.zeros(4320,dtype=np.float32)]
        for j,phrase in enumerate(phrases):
            metadata=phrase_records[phrase['id']];assert metadata['asr']['passed']
            raw=WORK/'clips/wav'/(phrase['id']+'.wav')
            assert raw.exists()
            # Gentle phrase pacing; the delivery never changes the chosen reference.
            tempo=[.96,.91,.93][j];gain=[.96,.89,1.0][j]
            wav=WORK/f'phrase-{n}-{j}.wav'
            run(['ffmpeg','-v','error','-y','-i',str(raw),'-af',f'atempo={tempo},highpass=f=65,volume={gain}',str(wav)])
            samples,rate=sf.read(wav,dtype='float32');assert rate==24000 and samples.ndim==1
            # Trim only near-silence, leaving room for consonants and natural breaths.
            window=240;energy=np.array([np.sqrt(np.mean(samples[k:k+window]**2))for k in range(0,len(samples),window)])
            voiced=np.flatnonzero(energy>max(.0006,float(energy.max())*.045))
            if len(voiced):samples=samples[max(0,int(voiced[0])*window-1920):min(len(samples),(int(voiced[-1])+1)*window+2400)]
            pieces.append(samples);pieces.append(np.zeros(int(24000*([.48,.72,.7][j])),dtype=np.float32))
        combined=WORK/(previous['id']+'-performed.wav');sf.write(combined,np.concatenate(pieces),24000,subtype='PCM_16')
        target=ROOT/'public/audio/memory-box'/(previous['id']+'-performed-v43.mp3')
        run(['ffmpeg','-v','error','-y','-i',str(combined),'-af','loudnorm=I=-19:TP=-2.5:LRA=10','-ar','24000','-ac','1','-c:a','libmp3lame','-b:a','64k',str(target)])
        decoded=WORK/(previous['id']+'-decoded.wav');run(['ffmpeg','-v','error','-y','-i',str(target),str(decoded)])
        samples,rate=sf.read(decoded,dtype='float32');stream=recognizer.create_stream();stream.accept_waveform(rate,samples);recognizer.decode_stream(stream)
        transcript=stream.result.text;cer=distance(clean(previous['text']),clean(transcript))/len(clean(previous['text']))
        assert cer<=.12,(previous['id'],transcript,cer)
        seconds=float(json.loads(run(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(target)]))['format']['duration'])
        entry={**previous,'src':'/audio/memory-box/'+target.name,'sha256':sha(target),'bytes':target.stat().st_size,'seconds':seconds,
            'asr':{'model':'SenseVoice-Small-int8-2025-09-09','text':transcript,'characterErrorRate':round(cer,4),'passed':True},
            'performance':{'phrases':len(phrases),'baseVoiceConfigHash':source['voiceConfigHash'],'phraseTempo':[.96,.91,.93],'pauseSeconds':[.48,.72,.7],'phraseSourceSHA256':[phrase_records[p['id']]['sha256']for p in phrases]}}
        output.append(entry);print(json.dumps({'id':entry['id'],'seconds':seconds,'asr':transcript,'cer':cer},ensure_ascii=False),flush=True)
    source.update(version='4.3.0',clips=output,performance='Same selected first-reference voice, independently rendered phrases, gentler pacing, deliberate pauses; room reflections and rain ducking are applied separately at runtime.')
    source_path.write_text(json.dumps(source,ensure_ascii=False,indent=2)+'\n')
    (ROOT/'src/memoryBoxAudio.js').write_text('// Selected first-reference voice, performed phrase by phrase. Private references are not distributed.\nexport const MEMORY_BOX_AUDIO = Object.fromEntries('+json.dumps([[c['id'],c]for c in output],ensure_ascii=False,indent=2)+');\n')
    credits=ROOT/'public/audio/memory-box/CREDITS.txt'
    original=credits.read_text()
    if '4.3.0 演绎处理'not in original:credits.write_text(original+'\n4.3.0 演绎处理：保持玩家选定的第一次参考声线，分句生成，轻缓语速、句间留白。短房间反射与雨声避让由程序独立混音，不向人声文件混入雨声；闭盖和离开均停止。合成声音，不宣称真人表演。\n')

if __name__=='__main__':main()
