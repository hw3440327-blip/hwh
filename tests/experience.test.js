import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { scenes } from '../src/story.js';
import { getSceneArt, sceneArtKey, sceneDescription, sceneDetails } from '../src/visuals.js';
import {
  chineseVoices, normalizeNarrationPreferences, readNarrationPreferences,
  saveNarrationPreferences, splitNarrationText,
} from '../src/narration.js';

test('中文讲述只提供中文音色，优先自然普通话且不受系统英语默认项影响', () => {
  const english = { name: 'English default', lang: 'en-US', voiceURI: 'en', default: true };
  const regular = { name: '中文声音', lang: 'zh_CN', voiceURI: 'zh', localService: true };
  const natural = { name: 'Microsoft Xiaoxiao Natural', lang: 'zh-CN', voiceURI: 'zh-natural', localService: false };
  const voices = chineseVoices([english, regular, natural, { ...natural }]);
  assert.equal(voices.length, 2);
  assert.equal(voices[0].name, natural.name);
  assert.equal(voices[0].localService, false);
  assert.equal(voices[1].localService, true);
  assert.notEqual(voices[0].id, voices[1].id);
  assert.equal(chineseVoices([english]).length, 0);
  assert.equal(chineseVoices([]).length, 0);
});

test('语音后加载时，稳定音色ID不依赖列表顺序，香港和台湾中文也可明确选择', () => {
  const voices = [
    { name: '粤语', lang: 'yue-HK', voiceURI: 'cantonese', localService: true },
    { name: '国语', lang: 'zh-TW', voiceURI: 'taiwan', localService: true },
    { name: '普通话', lang: 'cmn-Hans-CN', voiceURI: 'mandarin', localService: true },
  ];
  const first = chineseVoices(voices);
  assert.deepEqual(first.map(voice => voice.id), chineseVoices([...voices].reverse()).map(voice => voice.id));
  assert.equal(first.length, 3);
});

test('长旁白按中文标点分段，保留全文与Unicode字符，不因浏览器分句而丢字', () => {
  const text = '你把旧书轻轻摊开，窗边的风停了一会儿。' + '今天不必赶路，先喝一杯温茶。'.repeat(12) + '🌱下一次春天，再来看看。';
  const chunks = splitNarrationText(text);
  assert.ok(chunks.length > 3);
  assert.equal(chunks.join(''), text);
  assert.ok(chunks.every(chunk => [...chunk].length <= 40 && chunk.length > 0));
  assert.deepEqual(splitNarrationText('   '), []);
});

test('损坏语音偏好和受限存储不影响故事，速度音量始终处于有效范围', () => {
  assert.deepEqual(normalizeNarrationPreferences(null), { voiceId: '', rate: 0.9, volume: 0.85 });
  assert.deepEqual(normalizeNarrationPreferences({ voiceId: 'saved', rate: -4, volume: 9 }), { voiceId: 'saved', rate: 0.75, volume: 1 });
  assert.equal(normalizeNarrationPreferences({ rate: NaN }).rate, 0.9);
  assert.equal(readNarrationPreferences({ getItem() { throw new Error('unavailable'); } }).rate, 0.9);
  assert.doesNotThrow(() => saveNarrationPreferences({ rate: 1 }, { setItem() { throw new Error('full'); } }));
});

test('每一幕都有真实本地插画、可读描述与两处不同细节，故事联系按当前场景提供', async () => {
  const imageFiles = new Set();
  for (const scene of Object.values(scenes)) {
    const image = getSceneArt(scene);
    imageFiles.add(image);
    assert.ok(image.startsWith('/art/'), scene.id);
    assert.ok(sceneDescription(scene).length > 10, scene.id);
    const details = sceneDetails(scene);
    assert.equal(details.length, 2, scene.id);
    assert.notEqual(details[0].id, details[1].id, scene.id);
    for (const detail of details) {
      assert.ok(detail.x >= 0 && detail.x <= 100 && detail.y >= 0 && detail.y <= 100, scene.id);
      assert.ok(detail.text.length > 15 && detail.connection.length > 15, scene.id);
    }
    // A caller must not be able to modify another scene's observation text.
    const saved = details[0].connection;
    details[0].connection = 'changed';
    assert.equal(sceneDetails(scene)[0].connection, saved);
  }
  for (const image of imageFiles) await access(new URL(`../public${image}`, import.meta.url));
});

test('书店、市场、海堤与旧物铺使用各自地点画面，夜晚住处避开白天窗景', () => {
  for (const scene of Object.values(scenes)) {
    if (/书店/.test(scene.location)) assert.equal(sceneArtKey(scene), 'bookshop', scene.id);
    if (/菜市场|小集/.test(scene.location)) assert.equal(sceneArtKey(scene), 'market', scene.id);
    if (/海堤|洗衣店外/.test(scene.location)) assert.equal(sceneArtKey(scene), 'shore', scene.id);
    if (/旧物铺/.test(scene.location)) assert.equal(sceneArtKey(scene), 'workshop', scene.id);
  }
  assert.equal(sceneArtKey(scenes.room), 'room-night');
  assert.equal(sceneArtKey(scenes.life_midlife), 'room-night');
  assert.notEqual(sceneDetails(scenes.bookshop)[0].connection, sceneDetails(scenes.farewell_bookshop)[0].connection);
});
