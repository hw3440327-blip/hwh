import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { scenes } from '../src/story.js';
import { origins } from '../src/origins.js';
import { createGame, getSceneParagraphs, restoreGame, serializeGame } from '../src/engine.js';
import { sceneDetails } from '../src/visuals.js';
import { NARRATION_PREVIEW } from '../src/narration.js';
import {
  findRecordedNarrationEntry, lookupRecordedNarration, normalizeNarrationKey,
  normalizeNarrationText, RECORDED_PREVIEW_KEY,
} from '../src/recordedNarration.js';
import { collectNarrationInventory } from '../scripts/list-narration.mjs';
import { buildNarrationManifest, validateNarrationInventory, validateRecordingMetadata } from '../scripts/build-narration-manifest.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const inventory = collectNarrationInventory();

test('可复现旁白清单完整覆盖三种背景与所有路径段落变体', () => {
  assert.deepEqual(inventory, collectNarrationInventory());
  assert.equal(inventory.stats.scenes, 36);
  assert.equal(inventory.stats.baseParagraphs, 145);
  assert.equal(inventory.stats.storyVersions, 154);
  assert.equal(inventory.stats.recordableClips, 213);
  assert.equal(inventory.entries.length, 227);
  assert.deepEqual(inventory.unrecordable, []);
  const conditionalFlags = [...new Set(Object.values(scenes).flatMap((scene) => (scene.paragraphVariants ?? [])
    .flatMap((variant) => [variant.condition?.flag, variant.condition?.notFlag]).filter(Boolean)))];
  // Enumerate prose conditions independently of the inventory's path traversal.
  // This also covers old saves that lack a route flag and conflicting flags,
  // where getSceneParagraphs deliberately applies the last matching variant.
  for (const origin of origins) {
    for (let mask = 0; mask < 2 ** conditionalFlags.length; mask += 1) {
      const flags = conditionalFlags.filter((_flag, index) => mask & (1 << index));
      for (const scene of Object.values(scenes)) {
        const game = { ...createGame('小晴', origin.id), sceneId: scene.id, flags };
        getSceneParagraphs(game).forEach((text, index) => {
          const entry = findRecordedNarrationEntry(inventory, `story:${scene.id}:${index}`, text.replaceAll('{name}', game.name));
          assert.ok(entry, `${scene.id}:${index}/${origin.id}/${flags}`);
        });
      }
    }
  }
});

test('二十二处风景基础与三十六场景联系按显示全文逐字拼接', () => {
  const clips = new Map(inventory.clips.map((clip) => [clip.id, clip]));
  const bases = new Set();
  const connections = new Set();
  let bindings = 0;
  for (const scene of Object.values(scenes)) {
    for (const detail of sceneDetails(scene)) {
      const body = `${detail.label}。${detail.text}`;
      const text = `${body}${detail.connection}`;
      const entry = findRecordedNarrationEntry(inventory, `detail:${scene.id}:${detail.id}`, text);
      assert.ok(entry);
      assert.equal(entry.clipIds.length, 2);
      const [first, second] = entry.clipIds.map((id) => clips.get(id));
      assert.equal(first.kind, 'detail-base');
      assert.equal(first.text, body);
      assert.equal(second.kind, 'scene-connection');
      assert.equal(second.text, detail.connection);
      assert.equal(first.text + second.text, text);
      bases.add(first.id); connections.add(second.id); bindings += 1;
    }
  }
  assert.equal(bases.size, 22);
  assert.equal(connections.size, 36);
  assert.equal(bindings, 72);
  assert.ok(findRecordedNarrationEntry(inventory, RECORDED_PREVIEW_KEY, NARRATION_PREVIEW));
});

test('任何文字变化、错误键或没有真实音频的清单都不能播放默认录音', () => {
  for (const entry of inventory.entries) {
    assert.equal(findRecordedNarrationEntry(inventory, entry.key, entry.text + '误'), null);
    assert.equal(lookupRecordedNarration(inventory, entry.key, entry.text), null, '纯文本清单没有可播放音频');
  }
  for (const key of ['', '__proto__', 'story:arrival:-1', 'detail:arrival:../sea', 'preview:unknown']) {
    assert.equal(normalizeNarrationKey(key), '');
    assert.equal(findRecordedNarrationEntry(inventory, key, inventory.entries[0].text), null);
  }
  assert.equal(normalizeNarrationKey(' story:arrival:00 '), 'story:arrival:0');
  assert.equal(normalizeNarrationText(' 你。\r\n'), ' 你。\n');
});

test('三处姓名叙述不绑定别人的名字，玩家改名与旧存档仍保留姓名', () => {
  const targets = [['bakery', 2], ['laundry', 1], ['ending_return', 3]];
  for (const [sceneId, index] of targets) {
    const texts = ['小晴', '另一位旅人'].map((name) => getSceneParagraphs({ ...createGame(name), sceneId })[index].replaceAll('{name}', name));
    assert.equal(texts[0], texts[1]);
    assert.doesNotMatch(texts[0], /\{name\}|小晴|另一位旅人/);
    assert.ok(findRecordedNarrationEntry(inventory, `story:${sceneId}:${index}`, texts[0]));
    assert.equal(findRecordedNarrationEntry(inventory, `story:${sceneId}:${index}`, '小晴' + texts[0]), null);
  }
  const { activities, letterReplies, ...legacy } = createGame('保留姓名');
  assert.equal(restoreGame(JSON.stringify(legacy)).name, '保留姓名');
  assert.equal(restoreGame(serializeGame(createGame('新姓名'))).name, '新姓名');
});

test('构建拒绝旧清单、改动的全文和不一致的文本SHA', () => {
  assert.equal(validateNarrationInventory(inventory), inventory);
  const changed = structuredClone(inventory);
  changed.entries[0].text += '误';
  assert.throws(() => validateNarrationInventory(changed), /current story/);
  const stale = structuredClone(inventory);
  stale.clips[0].text = '已经改掉的故事';
  assert.throws(() => validateNarrationInventory(stale), /current story/);
});

test('录音元数据校验拒绝错误姓名文本、文件ID、体积、音频摘要和未知授权', () => {
  // Bytes here exercise the integrity validator only. They are never decoded,
  // copied to public/, or advertised as a real spoken recording.
  const bytes = Buffer.from('integrity-validator-unit-fixture');
  const expected = inventory.clips[0];
  const config = { channels: 1, codec: 'libmp3lame', model: 'Kokoro-82M-v1.1-zh',
    modelArchiveSha256: hash('model-fixture'), sampleRate: 24000, sid: 3, speed: 0.94 };
  const metadata = {
    id: expected.id, text: expected.text, textHash: expected.textHash,
    sha256: hash(bytes), bytes: bytes.length, seconds: 10, sampleRate: 24000,
    model: 'Kokoro-82M-v1.1-zh', license: 'Apache-2.0', synthetic: true, sid: 3, speed: 0.94,
    modelArchiveSha256: config.modelArchiveSha256, voiceConfig: config,
    voiceConfigHash: hash(JSON.stringify(config)),
  };
  assert.equal(validateRecordingMetadata(metadata, expected, bytes), metadata);
  for (const patch of [
    { id: '../wrong' }, { text: metadata.text + '别人' }, { textHash: hash('wrong') },
    { bytes: bytes.length + 1 }, { sha256: hash('wrong') }, { license: 'unknown' },
    { seconds: 0 }, { sampleRate: 0 }, { sid: -1 }, { synthetic: false },
    { voiceConfigHash: hash('wrong config') }, { voiceConfig: { ...config, sid: 4 } },
  ]) assert.throws(() => validateRecordingMetadata({ ...metadata, ...patch }, expected, bytes));
  assert.throws(() => validateRecordingMetadata(metadata, expected, Buffer.from('changed audio')));
});

test('缺录音或批次不完整时构建完全不触碰已有产品文件', async () => {
  const folder = await mkdtemp(path.join(tmpdir(), 'next-spring-build-rejection-'));
  try {
    const inventoryPath = path.join(folder, 'inventory.json');
    const inventoryBytes = JSON.stringify(inventory);
    await writeFile(inventoryPath, inventoryBytes);
    const recordingsDir = path.join(folder, 'recordings');
    const destinationRoot = path.join(folder, 'product');
    await mkdir(recordingsDir);
    await mkdir(path.join(destinationRoot, 'src'), { recursive: true });
    await mkdir(path.join(destinationRoot, 'public', 'audio', 'narration'), { recursive: true });
    const previousManifest = path.join(destinationRoot, 'src', 'narrationClips.js');
    const previousAudio = path.join(destinationRoot, 'public', 'audio', 'narration', 'existing.mp3');
    await writeFile(previousManifest, 'previous manifest');
    await writeFile(previousAudio, 'previous recording');
    const options = { inventoryPath, recordingsDir, destinationRoot };
    await assert.rejects(buildNarrationManifest(options), /results.json/);
    await writeFile(path.join(recordingsDir, 'results.json'), JSON.stringify({ complete: false, clips: [] }));
    await assert.rejects(buildNarrationManifest(options), /not complete/);
    await writeFile(path.join(recordingsDir, 'results.json'), JSON.stringify({
      complete: true, stats: { clips: inventory.clips.length }, inventorySha256: hash(inventoryBytes),
      clips: inventory.clips.map((clip) => ({ id: clip.id })),
    }));
    await assert.rejects(buildNarrationManifest(options), /metadata is missing/);
    assert.equal(await readFile(previousManifest, 'utf8'), 'previous manifest');
    assert.equal(await readFile(previousAudio, 'utf8'), 'previous recording');
  } finally { await rm(folder, { recursive: true, force: true }); }
});

// Do not register a skipped or fake integrity pass before recordings exist.
// Once the real builder emits this module, the normal test command verifies
// every published MP3 and every playback binding against that actual manifest.
const manifestUrl = new URL('../src/narrationClips.js', import.meta.url);
let manifestExists = false;
try { manifestExists = (await stat(manifestUrl)).isFile(); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
if (manifestExists) {
  test('正式录音manifest的全部音频实际存在、SHA一致且227处全文均可播放', async () => {
    const { NARRATION_MANIFEST: manifest } = await import(pathToFileURL(manifestUrl.pathname).href);
    assert.equal(manifest.voice.id, 'spring-recorded-v1');
    assert.equal(manifest.voice.kind, 'recorded');
    assert.equal(manifest.voice.synthetic, true);
    assert.equal(manifest.voice.license, 'Apache-2.0');
    assert.equal(manifest.clips.length, inventory.clips.length);
    assert.equal(manifest.entries.length, inventory.entries.length);
    for (const entry of inventory.entries) {
      const playback = lookupRecordedNarration(manifest, entry.key, entry.text);
      assert.ok(playback, entry.key);
      assert.equal(playback.queue.map((clip) => clip.text).join(''), entry.text);
    }
    for (const clip of manifest.clips) {
      assert.equal(clip.src, `/audio/narration/${clip.id}.mp3`);
      const bytes = await readFile(new URL(`../public${clip.src}`, import.meta.url));
      assert.equal(bytes.length, clip.bytes, clip.id);
      assert.equal(hash(bytes), clip.sha256, clip.id);
      assert.equal(hash(normalizeNarrationText(clip.text)), clip.id, clip.id);
      assert.ok(clip.seconds > 0 && clip.durationMs > 0 && clip.sampleRate === 24000);
    }
  });
}
