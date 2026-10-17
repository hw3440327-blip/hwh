import test from 'node:test';
import assert from 'node:assert/strict';
import { scenes } from '../src/story.js';
import {
  activityDefinitions, activityProgress, getSceneActivity, normalizeActivities, performActivity,
} from '../src/activities.js';
import { availableChoices, choose, createGame, reincarnate, restoreGame, serializeGame } from '../src/engine.js';

function gameAt(sceneId) {
  const queue = [createGame('小满')];
  const visited = new Set();
  for (let index = 0; index < queue.length; index += 1) {
    const game = queue[index];
    if (game.sceneId === sceneId) return game;
    const key = `${game.sceneId}:${game.flags.slice().sort().join(',')}`;
    if (visited.has(key)) continue;
    visited.add(key);
    for (const choice of availableChoices(game)) queue.push(choose(game, choice.id));
  }
  assert.fail(`无法通过实际故事到达 ${sceneId}`);
}

const action = (game, id, type, details = {}) => performActivity(game, id, { type, ...details });
function breadReady(game) {
  let next = action(game, 'bread', 'flour');
  next = action(next, 'bread', 'water');
  for (let count = 0; count < 3; count += 1) next = action(next, 'bread', 'knead');
  return next;
}
function repairReady(game) {
  let next = game;
  for (const [index, turns] of [3, 1, 2].entries()) {
    for (let count = 0; count < turns; count += 1) next = action(next, 'repair', 'rotate', { index });
  }
  return next;
}
function plantReady(game, seed = 'cosmos') {
  let next = action(game, 'plant', 'select_seed', { seed });
  next = action(next, 'plant', 'water');
  return action(next, 'plant', 'open_window');
}

function freezeDeep(value) {
  Object.freeze(value);
  for (const nested of Object.values(value)) {
    if (nested && typeof nested === 'object' && !Object.isFrozen(nested)) freezeDeep(nested);
  }
  return value;
}

test('三种小事出现在真实可达的场景，具有独立收藏，且不锁住故事', () => {
  assert.deepEqual(activityDefinitions.map((activity) => activity.id), ['bread', 'repair', 'plant']);
  const usedScenes = new Set();
  const memoryIds = new Set();
  for (const activity of activityDefinitions) {
    assert.ok(activity.title && activity.summary && activity.reply);
    assert.ok(!memoryIds.has(activity.memory.id));
    memoryIds.add(activity.memory.id);
    for (const id of activity.sceneIds) {
      assert.ok(Object.hasOwn(scenes, id));
      assert.ok(!usedScenes.has(id), '一个场景只突出一件可做的小事');
      usedScenes.add(id);
      const game = gameAt(id);
      assert.equal(getSceneActivity(game), activity);
      const choice = availableChoices(game)[0];
      assert.equal(choose(game, choice.id).sceneId, choice.next, '不做小事也能继续人生');
    }
  }
  assert.equal(getSceneActivity(gameAt('bakery')).id, 'bread');
  assert.equal(getSceneActivity(gameAt('room')).id, 'plant');
  assert.equal(getSceneActivity(gameAt('life_garden')).id, 'plant');
  for (const game of [null, {}, createGame(), { sceneId: '__proto__' }]) assert.equal(getSceneActivity(game), null);
});

test('每段人生的小事独立，查询进度不会共享或修改数组', () => {
  const first = createGame();
  const second = createGame();
  assert.deepEqual(first.activities, {});
  assert.notEqual(first.activities, second.activities);
  const initial = activityProgress(first, 'bread');
  assert.deepEqual(initial, { ingredients: [], kneads: 0, temperature: 180, completed: false, stage: 'ingredients' });
  initial.ingredients.push('flour');
  assert.deepEqual(activityProgress(first, 'bread').ingredients, []);
  assert.equal(activityProgress(first, 'forged'), null);
  assert.deepEqual(activityProgress(first, 'repair').rotations, [1, 3, 2]);
  assert.equal(activityProgress(first, 'plant').stage, 'seed');
});

test('烘焙需要配料、三次揉面和合适炉温，完成时只送一份温暖', () => {
  const original = freezeDeep(gameAt('bakery'));
  const before = serializeGame(original);
  for (const type of ['knead', 'bake', 'set_temperature']) {
    assert.equal(action(original, 'bread', type, { value: 180 }), original);
  }
  let game = action(original, 'bread', 'water');
  assert.equal(activityProgress(game, 'bread').stage, 'ingredients');
  assert.equal(action(game, 'bread', 'water'), game);
  game = action(game, 'bread', 'flour');
  assert.equal(activityProgress(game, 'bread').stage, 'knead');
  assert.equal(action(game, 'bread', 'bake'), game);
  for (let count = 0; count < 3; count += 1) game = action(game, 'bread', 'knead');
  assert.equal(activityProgress(game, 'bread').stage, 'bake');
  assert.equal(action(game, 'bread', 'knead'), game);
  game = action(game, 'bread', 'set_temperature', { value: 210 });
  assert.equal(action(game, 'bread', 'bake'), game, '过高温度不完成，不扣资源');
  assert.equal(game.energy, original.energy);
  game = action(game, 'bread', 'set_temperature', { value: 180 });
  const finished = action(game, 'bread', 'bake');
  assert.equal(activityProgress(finished, 'bread').stage, 'done');
  assert.equal(finished.energy, original.energy + 4);
  assert.equal(finished.connection, original.connection + 2);
  assert.equal(finished.memories.filter((memory) => memory.id === 'moment_bread').length, 1);
  for (const type of ['bake', 'flour', 'water', 'knead', 'set_temperature']) {
    assert.equal(action(finished, 'bread', type, { value: 150 }), finished);
  }
  for (const key of ['sceneId', 'money', 'history', 'flags', 'visited']) assert.deepEqual(finished[key], original[key]);
  assert.equal(serializeGame(original), before, '动作不修改传入存档');
  assert.deepEqual(restoreGame(serializeGame(finished)), finished);
});

test('炉温边界、无效值与错场景动作都不能绕过烘焙过程', () => {
  const prepared = breadReady(gameAt('bakery'));
  for (const value of [null, '180', NaN, Infinity, 149, 211, -1]) {
    assert.equal(action(prepared, 'bread', 'set_temperature', { value }), prepared);
  }
  for (const value of [170, 190]) {
    const adjusted = action(prepared, 'bread', 'set_temperature', { value });
    assert.equal(activityProgress(action(adjusted, 'bread', 'bake'), 'bread').completed, true);
  }
  const atRoom = choose(prepared, availableChoices(prepared)[0].id);
  assert.equal(atRoom.sceneId, 'room');
  assert.equal(action(atRoom, 'bread', 'bake'), atRoom);
  assert.equal(activityProgress(atRoom, 'bread').stage, 'bake', '离开场景不丢掉手里的进度');
});

test('旧木盒的三块木纹必须转正再粘合，每块保留独立角度', () => {
  const original = freezeDeep(gameAt('workshop'));
  assert.equal(action(original, 'repair', 'mend'), original);
  for (const index of [-1, 3, 0.5, '0', null, undefined]) {
    assert.equal(action(original, 'repair', 'rotate', { index }), original);
  }
  const once = action(original, 'repair', 'rotate', { index: 0 });
  assert.deepEqual(activityProgress(once, 'repair').rotations, [2, 3, 2]);
  assert.deepEqual(activityProgress(original, 'repair').rotations, [1, 3, 2]);
  assert.deepEqual(restoreGame(serializeGame(once)), once);
  const prepared = repairReady(original);
  assert.equal(activityProgress(prepared, 'repair').stage, 'seal');
  const finished = action(prepared, 'repair', 'mend');
  assert.equal(activityProgress(finished, 'repair').completed, true);
  assert.equal(finished.energy, original.energy + 2);
  assert.equal(finished.connection, original.connection + 3);
  assert.equal(finished.memories.filter((memory) => memory.id === 'moment_repair').length, 1);
  assert.equal(action(finished, 'repair', 'mend'), finished);
  assert.equal(action(finished, 'repair', 'rotate', { index: 0 }), finished);
  assert.deepEqual(restoreGame(serializeGame(finished)), finished);
});

test('两种幼苗都要依次浇水、见光和扶叶，重复浇水不增加奖励', () => {
  const original = freezeDeep(gameAt('room'));
  for (const type of ['water', 'open_window', 'support']) assert.equal(action(original, 'plant', type), original);
  assert.equal(action(original, 'plant', 'select_seed', { seed: 'forged' }), original);
  for (const seed of ['cosmos', 'forgetmenot']) {
    let game = action(original, 'plant', 'select_seed', { seed });
    assert.equal(activityProgress(game, 'plant').stage, 'water');
    assert.equal(action(game, 'plant', 'support'), game);
    game = action(game, 'plant', 'water');
    assert.equal(activityProgress(game, 'plant').stage, 'light');
    assert.equal(action(game, 'plant', 'water'), game);
    game = action(game, 'plant', 'open_window');
    assert.equal(activityProgress(game, 'plant').stage, 'care');
    assert.equal(game.energy, original.energy);
    game = action(game, 'plant', 'support');
    assert.equal(activityProgress(game, 'plant').stage, 'done');
    assert.equal(game.energy, original.energy + 5);
    assert.equal(game.connection, original.connection + 1);
    assert.equal(game.memories.filter((memory) => memory.id === 'moment_plant').length, 1);
    for (const type of ['water', 'open_window', 'support']) assert.equal(action(game, 'plant', type), game);
    assert.deepEqual(restoreGame(serializeGame(game)), game);
  }
});

test('旧存档缺少小事字段仍能恢复，部分进度在导出后保留，额外字段会被丢弃', () => {
  const { activities, ...old } = gameAt('room');
  const legacy = restoreGame(JSON.stringify(old));
  assert.ok(legacy);
  assert.deepEqual(legacy.activities, {});
  let partial = action(legacy, 'plant', 'select_seed', { seed: 'forgetmenot' });
  partial = action(partial, 'plant', 'water');
  const restored = restoreGame(serializeGame(partial));
  assert.deepEqual(restored, partial);
  assert.equal(activityProgress(restored, 'plant').stage, 'light');
  const polluted = restoreGame(JSON.stringify({
    ...partial,
    activities: {
      ...partial.activities,
      plant: { ...partial.activities.plant, arbitrary: 'not saved', reward: 1000 },
      unknown: { completed: true },
    },
  }));
  assert.deepEqual(polluted, partial);
});

test('规范化不相信跳过前置的完成标记，也不会在读档时发放奖励', () => {
  assert.deepEqual(normalizeActivities(null), {});
  assert.deepEqual(normalizeActivities(['bread']), {});
  assert.deepEqual(normalizeActivities({ unknown: {}, bread: null }), {});
  const normalized = normalizeActivities({
    bread: { ingredients: ['water', 'flour', 'water', 'milk'], kneads: 100, temperature: 999, completed: true, surprise: 1 },
    repair: { rotations: [-1, 4, '0'], completed: true },
    plant: { seed: null, watered: true, light: true, cared: true, completed: true },
  });
  assert.deepEqual(normalized.bread, { ingredients: ['flour', 'water'], kneads: 3, temperature: 180, completed: true });
  assert.deepEqual(normalized.repair, { rotations: [1, 3, 2], completed: false });
  assert.deepEqual(normalized.plant, { seed: null, watered: false, light: false, cared: false, completed: false });
  const noIngredients = normalizeActivities({ bread: { ingredients: [], kneads: 3, completed: true } });
  assert.equal(noIngredients.bread.kneads, 0);
  assert.equal(noIngredients.bread.completed, false);

  const original = gameAt('bakery');
  const completed = action(breadReady(original), 'bread', 'bake');
  const restored = restoreGame(JSON.stringify({ ...original, activities: completed.activities }));
  assert.ok(restored);
  assert.equal(restored.energy, original.energy);
  assert.deepEqual(restored.memories, original.memories);
  assert.equal(action(restored, 'bread', 'bake'), restored, '只有完成数据的存档不会在读取或再点时补发奖励');
});

test('收藏文案由游戏恢复；已收藏物件不能靠重置进度反复领取资源', () => {
  const game = gameAt('bakery');
  const completed = action(breadReady(game), 'bread', 'bake');
  const tampered = { ...completed, activities: {} };
  const again = action(breadReady(tampered), 'bread', 'bake');
  assert.equal(again.energy, completed.energy);
  assert.equal(again.connection, completed.connection);
  assert.equal(again.memories.filter((memory) => memory.id === 'moment_bread').length, 1);
  const restored = restoreGame(JSON.stringify({
    ...completed,
    memories: completed.memories.map((memory) => memory.id === 'moment_bread'
      ? { ...memory, title: '改过的标题', description: '改过的描述' } : memory),
  }));
  assert.deepEqual(restored.memories.find((memory) => memory.id === 'moment_bread'), activityDefinitions[0].memory);
});

test('轻微收益遵守资源上限；新一生清空手作进度和物件，只继承人生回响', () => {
  const prepared = plantReady({ ...gameAt('room'), energy: 99, connection: 100 });
  const completed = action(prepared, 'plant', 'support');
  assert.equal(completed.energy, 100);
  assert.equal(completed.connection, 100);
  let ending = completed;
  for (let step = 0; !scenes[ending.sceneId].ending && step < 50; step += 1) {
    ending = choose(ending, availableChoices(ending)[0].id);
  }
  assert.equal(scenes[ending.sceneId].ending, true);
  const next = reincarnate(ending);
  assert.deepEqual(next.activities, {});
  assert.ok(!next.memories.some((memory) => memory.id.startsWith('moment_')));
  assert.ok(next.memories.some((memory) => memory.id === `echo:${ending.sceneId}`));
  assert.deepEqual(restoreGame(serializeGame(next)), next);
});

test('未知、未来、畸形和错场景操作稳定地保持原游戏', () => {
  const initial = createGame();
  for (const id of ['bread', 'repair', 'plant', 'future', '__proto__']) {
    for (const invalid of [null, undefined, [], {}, { type: 'future' }, { type: 'bake' }]) {
      assert.equal(performActivity(initial, id, invalid), initial);
    }
  }
  for (const invalidGame of [null, undefined, {}, [], { sceneId: 'bakery' }]) {
    assert.equal(performActivity(invalidGame, 'bread', { type: 'flour' }), invalidGame);
  }
});
