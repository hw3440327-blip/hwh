import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {MEMORY_BOX_RECORDINGS} from '../src/memoryBox.js';
import {MEMORY_BOX_AUDIO} from '../src/memoryBoxAudio.js';
import {NARRATION_MANIFEST} from '../src/narrationClips.js';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

test('木盒三段角色配音逐字对应旧友约定，实际文件摘要和MP3编码可核对',async()=>{
  const source=JSON.parse(await readFile(new URL('../public/audio/memory-box/SOURCES.json',import.meta.url),'utf8'));
  assert.equal(source.sourceReferenceIncluded,false);
  assert.equal(source.voiceConfigHash,NARRATION_MANIFEST.voice.voiceConfigHash);
  assert.equal(source.voiceConfigHash,'358365d3aa946c0e80c943259352d9a05d9b16bee9583e7fa47f69ee690cc8bd');
  assert.deepEqual(Object.keys(MEMORY_BOX_AUDIO),MEMORY_BOX_RECORDINGS.map(item=>item.id));
  let duration=0;
  for(const recording of MEMORY_BOX_RECORDINGS){
    const clip=MEMORY_BOX_AUDIO[recording.id];
    assert.equal(clip.text,recording.text);assert.equal(clip.title,recording.title);
    assert.equal(clip.textHash,hash(recording.text));
    assert.deepEqual(source.clips.find(item=>item.id===recording.id),clip);
    assert.equal(clip.synthetic,true);assert.equal(clip.asr.passed,true);
    const bytes=await readFile(new URL('../public'+clip.src,import.meta.url));
    assert.equal(bytes.length,clip.bytes);assert.equal(hash(bytes),clip.sha256);
    let offset=0;
    if(bytes.subarray(0,3).toString()==='ID3')offset=10+((bytes[6]&127)<<21)+((bytes[7]&127)<<14)+((bytes[8]&127)<<7)+(bytes[9]&127);
    while(offset<bytes.length-4&&!(bytes[offset]===255&&(bytes[offset+1]&224)===224))offset++;
    assert.ok(offset<bytes.length-4,'A real MP3 frame must be present');
    const version=(bytes[offset+1]>>3)&3;
    assert.equal((bytes[offset+1]>>1)&3,1,'MPEG Layer III');
    const rate=[44100,48000,32000][(bytes[offset+2]>>2)&3]/(version===3?1:version===2?2:4);
    assert.equal(rate,24000);assert.equal(bytes[offset+3]>>6,3,'mono role recording');
    assert.ok(clip.seconds>2&&clip.seconds<20);duration+=clip.seconds;
  }
  assert.ok(duration>20&&duration<40);
  const files=await readdir(new URL('../public/audio/memory-box/',import.meta.url));
  assert.deepEqual(files.filter(name=>!name.endsWith('.mp3')).sort(),['CREDITS.txt','SOURCES.json']);
});
