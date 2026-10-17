import test from 'node:test';
import assert from 'node:assert/strict';
import { scenes, chapters, initialMemory } from '../src/story.js';
import { origins } from '../src/origins.js';
import { letters, unlockedLetters } from '../src/letters.js';
import {
  STORAGE_KEY,
  availableChoices,
  choose,
  createGame,
  finishIntroduction,
  getSceneParagraphs,
  reincarnate,
  replyToLetter,
  restoreGame,
  serializeGame,
} from '../src/engine.js';

const reachableCache = new Map();
function reachableGames(origin = 'pause') {
  if (reachableCache.has(origin)) return reachableCache.get(origin);
  const games = [];
  const queue = [createGame('小满', origin)];
  const seen = new Set();
  // Keep flags that can change later choices or prose; branches that only give a
  // different collectible can share a traversal representative after converging.
  const relevantFlags = new Set(Object.values(scenes).flatMap((scene) => [
    ...scene.choices.map((choice) => choice.condition),
    ...(scene.paragraphVariants ?? []).map((variant) => variant.condition),
  ].flatMap((condition) => [condition?.flag, condition?.notFlag].filter(Boolean))));

  for (let index = 0; index < queue.length; index += 1) {
    const game = queue[index];
    const key = `${game.sceneId}:${game.flags.filter((flag) => relevantFlags.has(flag)).sort().join(',')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    assert.ok(seen.size < 10_000, '故事应能在有限分支内遍历完成');
    games.push(game);
    for (const choice of availableChoices(game)) queue.push(choose(game, choice.id));
  }
  reachableCache.set(origin, games);
  return games;
}

function findChoice(predicate) {
  for (const game of reachableGames()) {
    const choice = availableChoices(game).find(predicate);
    if (choice) return { game, choice };
  }
  assert.fail('故事中未找到用于验证的选择');
}

function freezeDeep(value) {
  Object.freeze(value);
  for (const nested of Object.values(value)) {
    if (nested && typeof nested === 'object' && !Object.isFrozen(nested)) freezeDeep(nested);
  }
  return value;
}

test('新的人生拥有独立状态，并规范化玩家名字', () => {
  const first = createGame('  小满  ');
  const second = createGame();
  assert.equal(STORAGE_KEY, 'next-spring-save-v1');
  assert.equal(first.name, '小满');
  assert.equal(first.sceneId, 'arrival');
  assert.equal(first.energy, 72);
  assert.equal(first.money, 860);
  assert.equal(first.connection, 12);
  assert.equal(first.origin, 'pause');
  assert.equal(first.introDone, false);
  assert.deepEqual(first.letterReplies, {});
  assert.notEqual(first.letterReplies, second.letterReplies);
  assert.deepEqual(first.memories, [initialMemory]);
  assert.equal(second.name, '旅人');
  assert.equal(createGame('   ').name, '旅人');
  assert.equal(Array.from(createGame('春'.repeat(20)).name).length, 12);
  assert.notEqual(first.memories[0], second.memories[0]);
  assert.notEqual(first.flags, second.flags);
  assert.equal(createGame('小满', 'craft').origin, 'craft');
  assert.equal(createGame('小满', 'unknown').origin, 'pause');
});

test('开场可以选择名字和背景，保留回响与状态，离开车站后不能重写', () => {
  const original = freezeDeep(createGame('旅人'));
  const before = serializeGame(original);
  const named = finishIntroduction(original, { name: '  小满 🌱  ', origin: 'independent' });
  assert.equal(named.name, '小满 🌱');
  assert.equal(named.origin, 'independent');
  assert.equal(named.introDone, true);
  assert.equal(named.money, original.money);
  assert.deepEqual(named.memories, original.memories);
  assert.deepEqual(named.history, []);
  assert.equal(serializeGame(original), before);
  assert.deepEqual(restoreGame(serializeGame(named)), named);
  assert.equal(finishIntroduction(createGame(), { name: '🌱'.repeat(12), origin: 'craft' }).name, '🌱'.repeat(12));

  for (const name of ['', '  ', '春'.repeat(13), 12, null]) {
    assert.throws(() => finishIntroduction(original, { name, origin: 'pause' }), /1–12/);
  }
  for (const origin of ['unknown', null, {}, '__proto__']) {
    assert.throws(() => finishIntroduction(original, { name: '小满', origin }), /有效/);
  }
  const started = choose(named, availableChoices(named)[0].id);
  assert.throws(() => finishIntroduction(started, { name: '新名字', origin: 'craft' }), /尚未作出选择/);
  assert.throws(() => finishIntroduction({ ...started, sceneId: 'arrival' }, { name: '新名字', origin: 'craft' }), /尚未作出选择/);
});

test('来时背景实际改变开场文字，并且不会修改故事的原始段落', () => {
  const original = [...scenes.arrival.paragraphs];
  const texts = origins.map((origin) => {
    const game = freezeDeep(createGame('小满', origin.id));
    const paragraphs = getSceneParagraphs(game);
    assert.notEqual(paragraphs, scenes.arrival.paragraphs);
    assert.equal(paragraphs[2], origin.arrivalParagraph);
    assert.equal(paragraphs[0], original[0]);
    return paragraphs[2];
  });
  assert.equal(new Set(texts).size, origins.length);
  assert.deepEqual(scenes.arrival.paragraphs, original);
  assert.deepEqual(getSceneParagraphs({ sceneId: '__proto__' }), []);
});

test('背景条件控制实际故事选项，不能用choiceId越过身份条件', () => {
  const conditional = origins.flatMap((origin) => reachableGames(origin.id))
    .map((game) => ({ game, choice: availableChoices(game).find((item) => item.condition?.origin) }))
    .find((candidate) => candidate.choice);
  assert.ok(conditional, '故事应提供与开场背景呼应的选择');
  const { game, choice } = conditional;
  const otherOrigin = origins.find((origin) => origin.id !== choice.condition.origin);
  const unavailable = { ...game, origin: otherOrigin.id };
  assert.ok(!availableChoices(unavailable).some((item) => item.id === choice.id));
  assert.throws(() => choose(unavailable, choice.id), /当前无法选择/);
  assert.equal(choose(game, choice.id).sceneId, choice.next);
});

test('收到的信可以回复，选择与存档一同保存且不会覆盖已寄出的回信', () => {
  const game = reachableGames().find((candidate) => unlockedLetters(candidate).length > 0);
  assert.ok(game, '游玩时应实际收到信');
  const letter = unlockedLetters(game)[0];
  assert.ok(letter.replies.length >= 2, '回信应提供真实选择');
  const original = freezeDeep(game);
  const before = serializeGame(original);
  const replied = replyToLetter(original, letter.id, letter.replies[0].id);
  assert.equal(serializeGame(original), before);
  assert.notEqual(replied.letterReplies, original.letterReplies);
  assert.equal(replied.letterReplies[letter.id], letter.replies[0].id);
  assert.deepEqual(restoreGame(serializeGame(replied)), replied);
  assert.throws(() => replyToLetter(replied, letter.id, letter.replies[1].id), /已经回复/);
  assert.throws(() => replyToLetter(game, letter.id, 'forged-reply'), /有效/);
  assert.throws(() => replyToLetter(createGame(), 'missing-letter', 'anything'), /尚未送达/);
  const locked = letters.find((item) => !unlockedLetters(createGame()).some((delivered) => delivered.id === item.id));
  assert.ok(locked, '尚未发生的故事不能提前回信');
  assert.throws(() => replyToLetter(createGame(), locked.id, locked.replies[0].id), /尚未送达/);
});

test('每封信均随实际经历送达；轮回清空本世回信而保留上一世回响', () => {
  const games = origins.flatMap((origin) => reachableGames(origin.id));
  for (const letter of letters) {
    assert.ok(games.some((game) => unlockedLetters(game).some((item) => item.id === letter.id)), `${letter.id} 应能在真实游玩中收到`);
  }
  let ending = games.find((game) => game.sceneId === 'farewell_bookshop');
  for (const letter of unlockedLetters(ending)) ending = replyToLetter(ending, letter.id, letter.replies[0].id);
  assert.ok(Object.keys(ending.letterReplies).length > 0);
  const next = reincarnate(ending);
  assert.deepEqual(next.letterReplies, {});
  assert.equal(next.memories.at(-1).id, 'echo:farewell_bookshop');
  assert.deepEqual(restoreGame(serializeGame(next)), next);
});

test('实际人生路线会替换对应段落，未满足条件时保留原文', () => {
  const returning = reachableGames().find((game) => game.flags.includes('route_return')
    && scenes[game.sceneId].paragraphVariants?.some((variant) => variant.condition?.flag === 'route_return'));
  assert.ok(returning, '回城人生应有自己的生活细节');
  const scene = scenes[returning.sceneId];
  const variant = scene.paragraphVariants.find((item) => item.condition?.flag === 'route_return');
  const original = [...scene.paragraphs];
  const paragraphs = getSceneParagraphs(freezeDeep(returning));
  assert.equal(paragraphs[variant.at], variant.text);
  assert.deepEqual(scene.paragraphs, original);
  assert.equal(getSceneParagraphs({ ...returning, flags: returning.flags.filter((flag) => flag !== 'route_return') })[variant.at], original[variant.at]);
});

test('故事引用完整，八章与所有场景、四个人生终局都可以通过实际选择抵达', () => {
  const allScenes = Object.values(scenes);
  assert.equal(chapters.length, 8);
  assert.ok(allScenes.length >= 32, '人生应覆盖从初来到晚年的完整篇章');
  assert.deepEqual([...new Set(allScenes.map((scene) => scene.chapter))].sort(), [0, 1, 2, 3, 4, 5, 6, 7]);

  for (const [id, scene] of Object.entries(scenes)) {
    assert.equal(scene.id, id);
    assert.equal(new Set(scene.choices.map((choice) => choice.id)).size, scene.choices.length);
    if (scene.ending) assert.equal(scene.choices.length, 0);
    else assert.ok(scene.choices.length > 0, `${id} 应有下一步`);
    for (const choice of scene.choices) {
      assert.ok(Object.hasOwn(scenes, choice.next), `${id}/${choice.id} 引用的场景应存在`);
    }
  }

  const games = origins.flatMap((origin) => reachableGames(origin.id));
  const reached = new Set(games.map((game) => game.sceneId));
  assert.equal(reached.size, allScenes.length, '每个已写好的场景都应可达');
  const endings = allScenes.filter((scene) => scene.ending);
  assert.deepEqual(endings.map((scene) => scene.id).sort(), [
    'farewell_bakery', 'farewell_bookshop', 'farewell_return', 'farewell_workshop',
  ]);
  for (const ending of endings) assert.ok(reached.has(ending.id), `${ending.id} 应可抵达`);
  for (const route of ['bakery', 'workshop', 'bookshop', 'return']) {
    assert.ok(games.some((game) => game.sceneId === `farewell_${route}` && game.flags.includes(`route_${route}`)), `${route} 应能走完一生`);
  }
});

test('选择推进故事、保留足迹，并且不修改原来的存档', () => {
  const original = freezeDeep(createGame('小满'));
  const before = serializeGame(original);
  const choice = availableChoices(original)[0];
  const result = choose(original, choice.id);

  assert.equal(serializeGame(original), before);
  assert.notEqual(result, original);
  assert.notEqual(result.memories, original.memories);
  assert.equal(result.sceneId, choice.next);
  assert.deepEqual(result.visited, ['arrival', choice.next]);
  assert.equal(result.history.length, 1);
  assert.equal(result.history[0].sceneId, 'arrival');
  assert.equal(result.history[0].choiceId, choice.id);
  assert.equal(result.history[0].choiceTitle, choice.title);
  assert.ok(Number.isFinite(Date.parse(result.history[0].at)));
  assert.equal(result.introDone, true);
});

test('四条生活方向从初来、成长到晚年实际产生不同的记忆与结局', () => {
  const games = reachableGames();
  const endings = ['bakery', 'workshop', 'bookshop', 'return'].map((route) =>
    games.find((game) => game.sceneId === `farewell_${route}` && game.flags.includes(`route_${route}`)),
  );
  assert.ok(endings.every(Boolean));
  assert.equal(new Set(endings.map((game) => game.sceneId)).size, 4);
  assert.equal(new Set(endings.map((game) => reincarnate(game).memories.at(-1).id)).size, 4);
  for (const ending of endings) {
    assert.equal(new Set(ending.visited.map((id) => scenes[id].chapter)).size, 8);
    assert.ok(ending.history.length >= 24);
    const next = reincarnate(ending);
    assert.equal(next.memories.at(-1).id, `echo:${ending.sceneId}`);
  }
});

test('不能通过直接传入 choiceId 绕过尚未满足的故事条件', () => {
  const { game, choice } = findChoice((item) => Boolean(item.condition?.flag));
  const unavailable = { ...game, flags: game.flags.filter((flag) => flag !== choice.condition.flag) };
  assert.ok(!availableChoices(unavailable).some((item) => item.id === choice.id));
  assert.throws(() => choose(unavailable, choice.id), /当前无法选择/);
  assert.throws(() => choose(game, 'missing-choice'), /当前无法选择/);
  assert.deepEqual(availableChoices({ ...game, sceneId: 'toString' }), []);
});

test('结局停止推进，但允许开启拥有独立状态的新人生', () => {
  const ending = reachableGames().find((game) => scenes[game.sceneId].ending);
  assert.ok(ending);
  assert.deepEqual(availableChoices(ending), []);
  assert.throws(() => choose(ending, 'continue'), /当前无法选择/);
  const restart = createGame(ending.name);
  assert.equal(restart.sceneId, 'arrival');
  assert.equal(restart.history.length, 0);
  assert.equal(restart.memories.length, 1);
  assert.ok(ending.history.length > 0);
});

test('走完一生后轮回并继续选择，导出和恢复仍保留完整进度与上一世回响', () => {
  const ending = freezeDeep(reachableGames().find((game) => game.sceneId === 'farewell_bakery'));
  const before = serializeGame(ending);
  let next = reincarnate(ending);

  assert.equal(serializeGame(ending), before);
  assert.equal(next.name, ending.name);
  assert.equal(next.sceneId, 'arrival');
  assert.equal(next.money, 860);
  assert.equal(next.history.length, 0);
  assert.equal(next.introDone, false);
  assert.deepEqual(next.flags, []);
  assert.deepEqual(next.visited, ['arrival']);
  assert.equal(next.memories.length, 2);
  assert.equal(next.memories[1].id, 'echo:farewell_bakery');
  assert.equal(next.memories[1].title, `梦里的${scenes.farewell_bakery.title}`);
  assert.ok(next.memories[1].description.includes(scenes.farewell_bakery.note));

  for (let step = 0; step < 3; step += 1) next = choose(next, availableChoices(next)[0].id);
  assert.equal(next.history.length, 3);
  assert.ok(next.memories.some((memory) => memory.id === 'echo:farewell_bakery'));
  assert.deepEqual(restoreGame(serializeGame(next)), next);
});

test('旧版春天结局的v1存档可以继续成长，旧回响也能恢复并传入下一生', () => {
  for (const route of ['bakery', 'workshop', 'bookshop', 'return']) {
    const checkpoint = reachableGames().find((game) => game.sceneId === `ending_${route}`);
    assert.ok(checkpoint);
    const { origin, introDone, letterReplies, ...oldSave } = checkpoint;
    const restored = restoreGame(JSON.stringify(oldSave));
    assert.ok(restored, '旧存档不因原结局成为中途章节而丢失');
    assert.equal(restored.origin, 'pause');
    assert.equal(restored.introDone, true);
    assert.deepEqual(restored.letterReplies, {});
    assert.equal(scenes[restored.sceneId].ending, false);
    assert.equal(scenes[restored.sceneId].seasonEnd, true);
    const continuation = availableChoices(restored).find((choice) => choice.flag === `route_${route}`);
    assert.ok(continuation);
    const continued = choose(restored, continuation.id);
    assert.ok(continued.flags.includes(`route_${route}`));
    assert.equal(scenes[continued.sceneId].chapter, 4);
    assert.throws(() => reincarnate(restored), /只有在人生片段结束后/);

    const previousEcho = {
      id: `echo:ending_${route}`,
      title: `梦里的${scenes[`ending_${route}`].title}`,
      description: `你依稀记得：${scenes[`ending_${route}`].note}`,
    };
    const { origin: ignoredOrigin, introDone: ignoredIntro, letterReplies: ignoredReplies, ...legacyNewLife } = createGame('小满');
    legacyNewLife.memories.push(previousEcho);
    const withEcho = restoreGame(JSON.stringify(legacyNewLife));
    assert.ok(withEcho);
    assert.ok(withEcho.memories.some((memory) => memory.id === previousEcho.id));
    const completed = reachableGames().find((game) => game.sceneId === `farewell_${route}`);
    let replayed = withEcho;
    for (const entry of completed.history) replayed = choose(replayed, entry.choiceId);
    const nextLife = reincarnate(replayed);
    assert.ok(nextLife.memories.some((memory) => memory.id === previousEcho.id));
    assert.equal(nextLife.memories.at(-1).id, `echo:farewell_${route}`);
    assert.equal(nextLife.introDone, false);
    const introduced = finishIntroduction(nextLife, { name: '小满', origin: 'craft' });
    assert.deepEqual(introduced.memories, nextLife.memories);
    assert.deepEqual(restoreGame(serializeGame(introduced)), introduced);
  }
});

test('轮回收集至多四个有效结局的回响，重返相同结局不会重复继承', () => {
  const routes = reachableGames().filter((game) => scenes[game.sceneId].ending);
  const endingIds = Object.values(scenes).filter((scene) => scene.ending).map((scene) => scene.id);
  let game = createGame('小满');

  for (const endingId of [...endingIds, endingIds[0]]) {
    const route = routes.find((candidate) => candidate.sceneId === endingId);
    for (const entry of route.history) game = choose(game, entry.choiceId);
    game = reincarnate(game);
    assert.deepEqual(restoreGame(serializeGame(game)), game);
  }

  assert.equal(game.memories.length, 5);
  assert.equal(new Set(game.memories.map((memory) => memory.id)).size, 5);
  assert.deepEqual(new Set(game.memories.slice(1).map((memory) => memory.id)), new Set(endingIds.map((id) => `echo:${id}`)));
  assert.equal(game.memories.at(-1).id, `echo:${endingIds[0]}`);

  const ending = routes[0];
  const cleansed = reincarnate({
    ...ending,
    memories: [...ending.memories, { id: 'echo:arrival', title: '无效回响', description: '不能从普通场景继承' }],
  });
  assert.ok(!cleansed.memories.some((memory) => memory.id === 'echo:arrival'));
  assert.equal(cleansed.memories.length, 2);

  const legacyEcho = {
    id: 'echo:ending_bakery', title: '梦里的面包房', description: '曾经抵达的春天',
  };
  let inheritance = { ...createGame(), memories: [initialMemory, legacyEcho] };
  for (const endingId of endingIds) {
    const route = routes.find((candidate) => candidate.sceneId === endingId);
    for (const entry of route.history) inheritance = choose(inheritance, entry.choiceId);
    inheritance = reincarnate(inheritance);
  }
  assert.equal(inheritance.memories.length, 5);
  assert.ok(!inheritance.memories.some((memory) => memory.id === legacyEcho.id), '第五个较新的回响会替换最早的旧回响');
});

test('尚未抵达结局时不能通过轮回清除人生进度', () => {
  assert.throws(() => reincarnate(createGame()), /只有在人生片段结束后/);
  assert.throws(() => reincarnate({ ...createGame(), sceneId: 'missing-ending' }), /只有在人生片段结束后/);
  const game = reachableGames().find((candidate) => candidate.history.length >= 2 && !scenes[candidate.sceneId].ending);
  assert.ok(game);
  assert.throws(() => reincarnate(game), /只有在人生片段结束后/);
});

test('体力、牵挂与积蓄保持有效边界', () => {
  const energyGain = findChoice((choice) => choice.effects?.energy > 0);
  const energyCost = findChoice((choice) => choice.effects?.energy < 0);
  const connectionGain = findChoice((choice) => choice.effects?.connection > 0);
  const moneyCost = findChoice((choice) => choice.effects?.money < 0);

  assert.equal(choose({ ...energyGain.game, energy: 100 }, energyGain.choice.id).energy, 100);
  assert.equal(choose({ ...energyCost.game, energy: 0 }, energyCost.choice.id).energy, 0);
  assert.equal(choose({ ...connectionGain.game, connection: 100 }, connectionGain.choice.id).connection, 100);
  assert.equal(choose({ ...moneyCost.game, money: 0 }, moneyCost.choice.id).money, 0);
});

test('再次经历同一记忆时不会重复收藏，足迹与旗标也不会重复', () => {
  const { game, choice } = findChoice((item) => Boolean(item.memory && item.flag));
  const once = choose(game, choice.id);
  const again = choose({ ...once, sceneId: game.sceneId }, choice.id);
  assert.equal(again.memories.filter((memory) => memory.id === choice.memory.id).length, 1);
  assert.equal(again.flags.filter((flag) => flag === choice.flag).length, 1);
  assert.equal(new Set(again.visited).size, again.visited.length);
  assert.equal(again.history.length, once.history.length + 1);
});

test('各条路线的代表性存档都可以完整保存和恢复', () => {
  for (const game of origins.flatMap((origin) => reachableGames(origin.id))) {
    assert.deepEqual(restoreGame(serializeGame(game)), game, game.sceneId);
  }
});

test('损坏、过时或缺失必要字段的存档返回 null', () => {
  for (const raw of [null, '', '{broken', '{}', 'null', '[]', '42']) {
    assert.equal(restoreGame(raw), null);
  }
  const valid = createGame();
  const invalid = [
    { version: 2 },
    { name: '' },
    { name: '春'.repeat(13) },
    { name: 123 },
    { origin: 'unknown-origin' },
    { origin: null },
    { origin: ['pause'] },
    { introDone: 'true' },
    { introDone: null },
    { letterReplies: null },
    { letterReplies: [] },
    { letterReplies: 'reply' },
    { letterReplies: { 'forged-letter': 'forged-reply' } },
    { sceneId: 'missing-scene' },
    { sceneId: '__proto__' },
    { energy: '72' },
    { money: null },
    { connection: Infinity },
    { flags: ['unknown-flag'] },
    { flags: null },
    { memories: [] },
    { memories: [{ id: 'unknown-memory', title: '记忆', description: '内容' }] },
    { memories: [initialMemory, { id: 'echo:arrival', title: '伪造的回响', description: '普通场景并不是结局' }] },
    { history: [{ sceneId: 'arrival', choiceId: 'missing', choiceTitle: '继续', at: new Date().toISOString() }] },
    { visited: [] },
    { visited: ['arrival', 'unknown-scene'] },
    { startedAt: 'not-a-date' },
  ];
  for (const replacement of invalid) {
    assert.equal(restoreGame(JSON.stringify({ ...valid, ...replacement })), null, JSON.stringify(replacement));
  }
  const started = choose(valid, availableChoices(valid)[0].id);
  assert.equal(restoreGame(JSON.stringify({ ...started, introDone: false })), null);
  const locked = letters.find((letter) => !unlockedLetters(valid).some((item) => item.id === letter.id));
  assert.equal(restoreGame(JSON.stringify({ ...valid, letterReplies: { [locked.id]: locked.replies[0].id } })), null);
  const deliveredGame = reachableGames().find((game) => unlockedLetters(game).length > 0);
  const deliveredLetter = unlockedLetters(deliveredGame)[0];
  assert.equal(restoreGame(JSON.stringify({ ...deliveredGame, letterReplies: { [deliveredLetter.id]: 'forged-reply' } })), null);
});

test('恢复时裁剪越界资源、去除重复项，并使用故事的原始记忆文案', () => {
  const game = createGame('小满');
  const restored = restoreGame(JSON.stringify({
    ...game,
    energy: 999,
    connection: -10,
    money: -999,
    visited: ['arrival', 'arrival'],
    memories: [{ ...initialMemory, title: '被意外修改的标题' }, initialMemory],
  }));
  assert.ok(restored);
  assert.equal(restored.energy, 100);
  assert.equal(restored.connection, 0);
  assert.equal(restored.money, 0);
  assert.deepEqual(restored.visited, ['arrival']);
  assert.deepEqual(restored.memories, [initialMemory]);
});
