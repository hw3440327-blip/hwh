import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { soundKind } from '../src/useSoundscape.js';
import { SOUND_RECORDINGS, SOUND_ATTRIBUTIONS } from '../src/ambienceClips.js';
import { scenes } from '../src/story.js';
import { sceneArtKey } from '../src/visuals.js';
const audioScene = id => ({...scenes[id], image:sceneArtKey(scenes[id])});

test('实际地点和天气选择相应的自然录音，雨后不误播雨声', () => {
  assert.equal(soundKind(audioScene('shore')), 'sea');
  assert.equal(soundKind({...audioScene('bakery'), weather:'小雨'}), 'rain');
  assert.equal(soundKind({...audioScene('bakery'), weather:'雨后初晴'}), 'bakery');
  assert.equal(soundKind({...audioScene('bookshop'), weather:'微风'}), 'interior');
  assert.equal(soundKind({...audioScene('workshop'), weather:'晴'}), 'workshop');
  assert.equal(soundKind({...audioScene('life_garden'), image:'garden', weather:'晴'}), 'garden');
});

test('十二段环境与生活拟音均有真实 Opus 文件、正确摘要和非静音信号', async () => {
  assert.equal(Object.keys(SOUND_RECORDINGS).length, 12);
  const metadata = JSON.parse(await readFile(new URL('../public/audio/SOUND-SOURCES.json', import.meta.url), 'utf8'));
  for (const clip of Object.values(SOUND_RECORDINGS)) {
    const bytes = await readFile(new URL('../public'+clip.src, import.meta.url));
    assert.equal(bytes.subarray(0,4).toString(), 'OggS');
    assert.ok(bytes.subarray(0,120).includes(Buffer.from('OpusHead')), clip.key);
    assert.equal(bytes.length, clip.bytes, clip.key);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), clip.sha256, clip.key);
    assert.ok(clip.seconds>.2 && clip.seconds<60 && clip.rms>.00001 && clip.peak<.99, clip.key);
    assert.deepEqual(metadata.tracks.find(t=>t.key===clip.key),clip);
  }
});

test('每段录音保留作者、许可与修改说明，未携带制作机路径或原始参考录音', () => {
  const byKey=new Map(SOUND_ATTRIBUTIONS.map(s=>[s.key,s]));
  assert.equal(byKey.size,8);
  for (const clip of Object.values(SOUND_RECORDINGS)) {
    assert.ok(clip.changes.length>20);
    for (const id of clip.sources) {
      const source=byKey.get(id);
      assert.ok(source?.artist && source.page.startsWith('https://commons.wikimedia.org/wiki/File:'));
      assert.ok(['Public domain','CC0','CC BY 3.0','CC BY 4.0'].includes(source.license));
      assert.match(source.sourceSha256,/^[a-f0-9]{64}$/);
      assert.ok(source.licenseUrl.includes('creativecommons.org/'));
    }
  }
  assert.ok(!JSON.stringify({SOUND_RECORDINGS,SOUND_ATTRIBUTIONS}).includes('/workspace/'));
});
