import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, finishIntroduction, restoreGame, serializeGame, availableChoices, choose, reincarnate } from '../src/engine.js';
import { scenes } from '../src/story.js';
import {
  MEMORY_BOX_MEMORY, MEMORY_BOX_RECORDINGS, MEMORY_BOX_REPLIES,
  normalizeMemoryBox, memoryBoxProgress, memoryBoxStage, memoryBoxUnderstood,
  memoryBoxJournal, memoryBoxEcho, memoryBoxFollowUp, performMemoryBoxAction,
} from '../src/memoryBox.js';

const act = (game, type, fields = {}) => performMemoryBoxAction(game, { type, ...fields });
const start = () => finishIntroduction(createGame('小晴'), { name: '小晴', origin: 'pause' });
function repaired(initial = start(), style = 'keep') {
  let game = act(initial, 'inspect', { id: 'grain' });
  for (let i = 0; i < 5; i++) game = act(game, 'sand', { direction: 'grain' });
  game = act(game, 'style', { value: style });
  for (const index of [0, 1, 0, 1]) game = act(game, 'fasten', { index });
  return game;
}
function understood(initial = repaired(), method = 'heard') {
  let game = act(initial, 'lid', { value: .9 });
  for (const recording of MEMORY_BOX_RECORDINGS) {
    game = act(game, 'select_memory', { id: recording.id });
    game = act(game, method, { id: recording.id });
  }
  return game;
}
function finished(destination = 'return', initial = understood()) {
  let game = act(initial, 'reply_choice', { id: 'letter' });
  return act(game, 'destination', { value: destination });
}
function freeze(value) {
  if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze); }
  return value;
}

test('观察木纹、顺纹打磨、留下修复痕迹和固定旧合页构成连续修复经历', () => {
  const initial = freeze(start());
  let game = act(initial, 'inspect', { id: 'scratch' });
  assert.equal(memoryBoxStage(game), 'inspect');
  game = act(game, 'inspect', { id: 'grain' });
  assert.equal(memoryBoxStage(game), 'sand');
  for (let i = 0; i < 5; i++) game = act(game, 'sand', { dx: .25, dy: .02 });
  assert.equal(memoryBoxStage(game), 'style');
  game = act(game, 'style', { value: 'leaf' });
  assert.equal(memoryBoxStage(game), 'hinge');
  for (const index of [0, 0, 1]) game = act(game, 'fasten', { index });
  assert.equal(memoryBoxProgress(game).repaired, false);
  game = act(game, 'fasten', { index: 1 });
  assert.equal(memoryBoxStage(game), 'listen');
  assert.equal(memoryBoxProgress(game).repaired, true);
  assert.equal(memoryBoxProgress(game).style, 'leaf');
  for (const key of ['sceneId', 'history', 'visited', 'flags', 'energy', 'money', 'connection', 'startedAt', 'townDay']) assert.deepEqual(game[key], initial[key]);
  assert.deepEqual(memoryBoxProgress(initial), normalizeMemoryBox());
});

test('打磨需要先摸清木纹，逆纹与无效笔划不会扣掉已有进度或偷偷推进', () => {
  const initial = start();
  assert.equal(act(initial, 'sand', { direction: 'grain' }), initial);
  let game = act(initial, 'inspect', { id: 'grain' });
  game = act(game, 'sand', { dx: -.25, dy: .03 });
  assert.equal(memoryBoxProgress(game).sandProgress, .2);
  for (const fields of [{ dx: .15, dy: .6 }, { dx: .01, dy: 0 }, { dx: NaN, dy: 0 }, { dx: 3, dy: 0 }, { direction: 'against-grain' }]) {
    assert.equal(act(game, 'sand', fields), game);
  }
  const next = act(game, 'sand', { direction: 'grain' });
  assert.equal(memoryBoxProgress(next).sandProgress, .4);
});

test('个人修法与合页有前置，修好前换修法会重新固定，修好后不会凭空改变外观', () => {
  let game = start();
  assert.equal(act(game, 'fasten', { index: 0 }), game);
  assert.equal(act(game, 'style', { value: 'leaf' }), game);
  game = act(game, 'inspect', { id: 'grain' });
  for (let i = 0; i < 5; i++) game = act(game, 'sand', { direction: 'grain' });
  game = act(game, 'style', { value: 'keep' });
  game = act(game, 'fasten', { index: 0 });
  assert.deepEqual(memoryBoxProgress(game).fasteners, [.5, 0]);
  game = act(game, 'style', { value: 'leaf' });
  assert.deepEqual(memoryBoxProgress(game).fasteners, [0, 0]);
  for (const index of [0, 0, 1, 1]) game = act(game, 'fasten', { index });
  assert.equal(act(game, 'style', { value: 'keep' }), game);
  assert.equal(act(game, 'fasten', { index: 1 }), game);
});

test('盒盖可连续开合，关盖保存原位但不伪造听完，只有修好后能打开', () => {
  const initial = start();
  assert.equal(act(initial, 'lid', { value: 1 }), initial);
  let game = repaired();
  game = act(game, 'lid', { value: .347 });
  assert.equal(memoryBoxProgress(game).lid, .347);
  const first = MEMORY_BOX_RECORDINGS[0].id;
  assert.equal(act(game, 'heard', { id: first }), game);
  game = act(game, 'lid', { value: .8 });
  game = act(game, 'lid', { value: 0 });
  assert.deepEqual(memoryBoxProgress(game).heard, []);
  for (const value of [NaN, Infinity, -.1, 1.1, '1']) assert.equal(act(game, 'lid', { value }), game);
});

test('真实录音结束仅标记当前段；下一段需要明确前进，无法跳过尚未听读的段落', () => {
  let game = act(repaired(), 'lid', { value: 1 });
  const [first, second, third] = MEMORY_BOX_RECORDINGS;
  assert.equal(act(game, 'select_memory', { id: third.id }), game);
  assert.equal(act(game, 'heard', { id: second.id }), game);
  assert.equal(act(game, 'next_memory'), game);
  game = act(game, 'heard', { id: first.id });
  assert.equal(memoryBoxProgress(game).memoryIndex, 0);
  assert.equal(act(game, 'heard', { id: first.id }), game);
  game = act(game, 'next_memory');
  assert.equal(memoryBoxProgress(game).memoryIndex, 1);
  game = act(game, 'heard', { id: second.id });
  game = act(game, 'next_memory');
  game = act(game, 'heard', { id: third.id });
  assert.equal(memoryBoxStage(game), 'reply');
  assert.deepEqual(memoryBoxProgress(game).heard, MEMORY_BOX_RECORDINGS.map(item => item.id));
  assert.equal(memoryBoxProgress(game).memoryIndex, 2);
  assert.equal(act(game, 'next_memory'), game);
});

test('关闭到语音门槛以下时不能把结束回调计为听完，重新打开后可以继续完成', () => {
  let game = act(repaired(), 'lid', { value: .9 });
  const id = MEMORY_BOX_RECORDINGS[0].id;
  game = act(game, 'lid', { value: .54 });
  assert.equal(act(game, 'heard', { id }), game);
  assert.deepEqual(memoryBoxProgress(game).heard, []);
  game = act(game, 'lid', { value: .55 });
  game = act(game, 'heard', { id });
  assert.deepEqual(memoryBoxProgress(game).heard, [id]);
});

test('声音关闭也能显式读完完整故事、回应和选择去处，阅读不会冒充实际听见', () => {
  let game = understood(repaired(), 'read_memory');
  assert.equal(memoryBoxStage(game), 'reply');
  assert.deepEqual(memoryBoxProgress(game).heard, []);
  assert.deepEqual(memoryBoxProgress(game).read, MEMORY_BOX_RECORDINGS.map(item => item.id));
  game = act(game, 'reply', { text: '等桂花开了，我也想来窗边坐坐。' });
  game = act(game, 'destination', { value: 'window' });
  assert.equal(memoryBoxStage(game), 'done');
  assert.equal(memoryBoxProgress(game).completed, true);
  assert.deepEqual(memoryBoxProgress(game).heard, []);
  assert.equal(game.memories.filter(item => item.id === MEMORY_BOX_MEMORY.id).length, 1);
});

test('听与读可以混合，回看早先段落后的归档顺序和存档规整仍一致', () => {
  let game = act(repaired(), 'lid', { value: .8 });
  const [first, second, third] = MEMORY_BOX_RECORDINGS;
  game = act(game, 'read_memory', { id: first.id });
  game = act(game, 'next_memory');
  game = act(game, 'heard', { id: second.id });
  game = act(game, 'select_memory', { id: first.id });
  game = act(game, 'heard', { id: first.id });
  game = act(game, 'select_memory', { id: third.id });
  game = act(game, 'read_memory', { id: third.id });
  assert.deepEqual(memoryBoxProgress(game).heard, [first.id, second.id]);
  assert.deepEqual(memoryBoxProgress(game).read, [first.id, third.id]);
  assert.deepEqual(memoryBoxUnderstood(game), [first.id, second.id, third.id]);
  assert.deepEqual(normalizeMemoryBox(game.memoryBox), game.memoryBox);
  assert.equal(memoryBoxJournal(game).memories[2].read, true);
  assert.equal(memoryBoxJournal(game).memories[2].heard, false);
});

test('三段尚未听读完不能替主人作结；回应按六十字和安全正文保存', () => {
  const initial = repaired();
  assert.equal(act(initial, 'reply', { text: '我会记得。' }), initial);
  assert.equal(act(initial, 'destination', { value: 'return' }), initial);
  let game = understood();
  game = act(game, 'reply', { text: ' \u0000' + '🌿'.repeat(75) + '\n ' });
  assert.equal(Array.from(memoryBoxProgress(game).reply).length, 60);
  assert.equal(memoryBoxProgress(game).reply.includes('\n'), false);
  assert.equal(memoryBoxProgress(game).replyChoice, null);
  game = act(game, 'reply_choice', { id: 'letter' });
  assert.equal(memoryBoxProgress(game).reply, MEMORY_BOX_REPLIES[0].text);
  assert.equal(memoryBoxStage(game), 'choose');
});

test('归还与借放留下不同可见后续，决定后仍能开合回听且不会重复奖励', () => {
  const returned = finished('return', understood(repaired(start(), 'leaf')));
  const kept = finished('window');
  assert.equal(memoryBoxEcho(returned, 'bakery').showBox, true);
  assert.match(memoryBoxEcho(returned, 'bakery').text, /浅色木叶/);
  assert.match(memoryBoxFollowUp(returned, 'lin').text, /明信片/);
  assert.equal(memoryBoxEcho(returned, 'room'), null);
  assert.equal(memoryBoxEcho(kept, 'room').showBox, true);
  assert.equal(memoryBoxEcho(kept, 'bakery').showBox, false);
  assert.match(memoryBoxEcho(kept, 'workshop').text, /软垫/);
  let replay = act(returned, 'lid', { value: 0 });
  replay = act(replay, 'select_memory', { id: MEMORY_BOX_RECORDINGS[0].id });
  replay = act(replay, 'lid', { value: 1 });
  assert.equal(memoryBoxProgress(replay).completed, true);
  assert.equal(act(replay, 'heard', { id: MEMORY_BOX_RECORDINGS[0].id }), replay);
  assert.equal(act(replay, 'destination', { value: 'window' }), replay);
  assert.equal(act(replay, 'reply', { text: '改写已经交出去的话。' }), replay);
  assert.equal(replay.memories.filter(item => item.id === MEMORY_BOX_MEMORY.id).length, 1);
});

test('恶意或残缺存档只能恢复合法连续进度，忽略伪造完成、孤立后段和未知字段', () => {
  const forged = normalizeMemoryBox({ inspected: [], sandProgress: 1, style: 'leaf', fasteners: [1, 1], repaired: true,
    lid: 1, heard: MEMORY_BOX_RECORDINGS.map(item => item.id), reply: '已完成', destination: 'return', completed: true, privateField: 'never' });
  assert.equal(forged.repaired, false);
  assert.equal(forged.lid, 0);
  assert.deepEqual(forged.heard, []);
  assert.equal(forged.completed, false);
  assert.equal('privateField' in forged, false);
  const partial = normalizeMemoryBox({ ...repaired().memoryBox, heard: ['rain-home'], read: [], memoryIndex: 2, destination: 'return' });
  assert.deepEqual(partial.heard, []);
  assert.equal(partial.memoryIndex, 0);
  assert.equal(partial.destination, null);
  for (const raw of [null, false, [], 'box']) assert.deepEqual(normalizeMemoryBox(raw), normalizeMemoryBox());
  const game = start();
  for (const action of [null, [], { type: '__proto__' }, { type: 'inspect', id: '__proto__' }, { type: 'sand', dx: Infinity, dy: 0 }]) assert.equal(performMemoryBoxAction(game, action), game);
});

test('完整木盒进度和合法回忆经过正式存档严格往返，旧档保持人生位置并得到默认木盒', () => {
  const game = finished('return');
  const restored = restoreGame(serializeGame(game));
  assert.deepEqual(restored, game);
  const legacy = start(); delete legacy.memoryBox;
  const migrated = restoreGame(serializeGame(legacy));
  assert.ok(migrated);
  assert.equal(migrated.sceneId, legacy.sceneId);
  assert.deepEqual(migrated.history, legacy.history);
  assert.deepEqual(migrated.memoryBox, normalizeMemoryBox());
  const forgedMemory = { ...game, memories: game.memories.map(item => item.id === MEMORY_BOX_MEMORY.id ? { ...item, title: '伪造标题' } : item) };
  assert.deepEqual(restoreGame(serializeGame(forgedMemory)).memories.find(item => item.id === MEMORY_BOX_MEMORY.id), MEMORY_BOX_MEMORY);
});

test('新一生按既有回响规则重新开始，不继承木盒修复、收听与归还进度', () => {
  let game = start();
  for (let i = 0; i < 100 && !scenes[game.sceneId].ending; i++) game = choose(game, availableChoices(game)[0].id);
  assert.equal(scenes[game.sceneId].ending, true);
  game = finished('window', understood(repaired(game)));
  const next = reincarnate(game);
  assert.deepEqual(next.memoryBox, normalizeMemoryBox());
  assert.equal(next.memories.some(item => item.id === MEMORY_BOX_MEMORY.id), false);
  assert.equal(next.memories.some(item => item.id.startsWith('echo:')), true);
  assert.deepEqual(restoreGame(serializeGame(next)), next);
});
