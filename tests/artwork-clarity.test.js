import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { ARTWORK_ASSETS } from '../src/artworkAssets.js';
import { getSceneArt } from '../src/visuals.js';
import { scenes } from '../src/story.js';

function dimensions(bytes) {
  assert.equal(bytes.subarray(0,4).toString(),'RIFF');
  assert.equal(bytes.subarray(8,12).toString(),'WEBP');
  const kind=bytes.subarray(12,16).toString();
  if(kind==='VP8X')return [bytes.readUIntLE(24,3)+1,bytes.readUIntLE(27,3)+1];
  assert.equal(kind,'VP8 ');
  assert.equal(bytes.subarray(23,26).toString('hex'),'9d012a');
  return [bytes.readUInt16LE(26)&0x3fff,bytes.readUInt16LE(28)&0x3fff];
}

test('所有主背景实际编码为 7680 像素宽，原比例、摘要和缩略图均可核对',async()=>{
  assert.equal(Object.keys(ARTWORK_ASSETS).length,16);
  const metadata=JSON.parse(await readFile(new URL('../public/art/ASSETS-8K.json',import.meta.url),'utf8'));
  assert.equal(metadata.native8K,false);
  assert.equal(metadata.sourceRevision,'a7b8c74d61b9a2c62aada7c5f222a59bac624fc6');
  assert.equal(metadata.generativeEnhancement,false);
  assert.equal(metadata.sharpening,false);
  for(const row of metadata.assets){
    const asset=ARTWORK_ASSETS[row.src];
    assert.ok(asset,row.src);
    const bytes=await readFile(new URL('../public'+row.src,import.meta.url));
    assert.deepEqual(dimensions(bytes),[7680,row.height]);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256);
    assert.equal(bytes.length,row.bytes);
    assert.ok(Math.abs((row.width/row.height)/(row.sourceDimensions[0]/row.sourceDimensions[1])-1)<.0003);
    assert.equal(row.sourceRevision,metadata.sourceRevision);
    const original=execFileSync('git',['show',row.sourceRevision+':'+row.sourcePath],{cwd:new URL('../',import.meta.url),maxBuffer:16*1024*1024});
    assert.equal(createHash('sha256').update(original).digest('hex'),row.sourceSha256);
    assert.equal(row.generativeEnhancement,false);
    assert.equal(row.sharpening,false);
    assert.ok(row.roundTripMeanAbsoluteError<3);
    const preview=await readFile(new URL('../public'+row.preview,import.meta.url));
    const [w,h]=dimensions(preview);assert.ok(w<=640&&h<=480);
    assert.equal(createHash('sha256').update(preview).digest('hex'),row.previewSha256);
  }
});

test('全部故事地点均使用已核对的 8K 背景',()=>{
  for(const scene of Object.values(scenes))assert.equal(ARTWORK_ASSETS[getSceneArt(scene)]?.width,7680,scene.id);
});
