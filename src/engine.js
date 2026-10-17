import { initialMemory, scenes } from './story.js';
import { origins } from './origins.js';
import { unlockedLetters } from './letters.js';
import { activityDefinitions, normalizeActivities } from './activities.js';

export const STORAGE_KEY = 'next-spring-save-v1';

const clamp = (value, minimum, maximum = Infinity) =>
  Math.min(maximum, Math.max(minimum, value));

const unique = (values) => [...new Set(values)];
const hasText = (value, maximum = 120) =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= maximum;
const isDate = (value) =>
  typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value));
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const copyMemory = (memory) => ({ ...memory });
const validOrigin = (origin) => origins.some((item) => item.id === origin);
const legacyEndingIds = new Set([
  'ending_bakery', 'ending_workshop', 'ending_bookshop', 'ending_return',
]);

function normalizeName(name) {
  const text = typeof name === 'string' ? name.trim() : '';
  return Array.from(text).slice(0, 12).join('') || '旅人';
}

export function createGame(name = '旅人', origin = 'pause') {
  return {
    version: 1,
    name: normalizeName(name),
    origin: validOrigin(origin) ? origin : 'pause',
    introDone: false,
    letterReplies: {},
    activities: {},
    sceneId: 'arrival',
    energy: 72,
    money: 860,
    connection: 12,
    flags: [],
    memories: [copyMemory(initialMemory)],
    history: [],
    visited: ['arrival'],
    startedAt: new Date().toISOString(),
  };
}

export function finishIntroduction(game, { name, origin } = {}) {
  if (game?.sceneId !== 'arrival' || !Array.isArray(game.history) || game.history.length !== 0) {
    throw new Error('只能在初来车站、尚未作出选择时修改开场');
  }
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  const length = Array.from(trimmedName).length;
  if (length < 1 || length > 12) throw new Error('名字请填写 1–12 个字');
  if (!validOrigin(origin)) throw new Error('请选择一个有效的来时故事');
  return { ...game, name: trimmedName, origin, introDone: true };
}

function endingMemories() {
  return new Map(
    Object.values(scenes).filter((scene) => scene.ending || legacyEndingIds.has(scene.id)).map((scene) => [
      `echo:${scene.id}`,
      {
        id: `echo:${scene.id}`,
        title: `梦里的${scene.title}`,
        description: `你依稀记得：${scene.note}`,
      },
    ]),
  );
}

export function reincarnate(game) {
  const scene = Object.hasOwn(scenes, game?.sceneId) ? scenes[game.sceneId] : null;
  if (!scene?.ending) throw new Error('只有在人生片段结束后，才能开启下一次春天');

  const memories = endingMemories();
  const latestId = `echo:${scene.id}`;
  const previousIds = Array.isArray(game.memories)
    ? game.memories.map((memory) => memory?.id).filter((id) => memories.has(id) && id !== latestId)
    : [];
  const inheritedIds = [...unique(previousIds), latestId].slice(-4);
  const next = createGame(game.name, game.origin);
  return {
    ...next,
    memories: [...next.memories, ...inheritedIds.map((id) => copyMemory(memories.get(id)))],
  };
}

function meetsCondition(game, condition) {
  if (!condition) return true;
  if (condition.flag && !game.flags.includes(condition.flag)) return false;
  if (condition.notFlag && game.flags.includes(condition.notFlag)) return false;
  if (condition.origin && game.origin !== condition.origin) return false;
  return true;
}

export function getSceneParagraphs(game) {
  const scene = Object.hasOwn(scenes, game?.sceneId) ? scenes[game.sceneId] : null;
  if (!scene) return [];
  const paragraphs = [...scene.paragraphs];
  for (const variant of scene.paragraphVariants ?? []) {
    if (Number.isInteger(variant.at) && variant.at >= 0 && variant.at < paragraphs.length
      && meetsCondition(game, variant.condition)) {
      paragraphs[variant.at] = variant.text;
    }
  }
  if (scene.id === 'arrival') {
    const origin = origins.find((item) => item.id === game.origin) ?? origins.find((item) => item.id === 'pause');
    paragraphs[2] = origin.arrivalParagraph;
  }
  return paragraphs;
}

export function availableChoices(game) {
  const scene = Object.hasOwn(scenes, game?.sceneId) ? scenes[game.sceneId] : null;
  if (!scene || !Array.isArray(game.flags)) return [];
  return scene.choices.filter((choice) => meetsCondition(game, choice.condition));
}

export function replyToLetter(game, letterId, replyId) {
  const letter = unlockedLetters(game).find((item) => item.id === letterId);
  if (!letter) throw new Error('这封信尚未送达');
  if (!letter.replies.some((reply) => reply.id === replyId)) throw new Error('请选择有效的回信');
  if (Object.hasOwn(game.letterReplies ?? {}, letterId)) throw new Error('这封信已经回复过了');
  return { ...game, letterReplies: { ...game.letterReplies, [letterId]: replyId } };
}

export function choose(game, choiceId) {
  const choice = availableChoices(game).find((item) => item.id === choiceId);
  if (!choice) throw new Error(`当前无法选择：${choiceId}`);
  if (!Object.hasOwn(scenes, choice.next)) {
    throw new Error(`故事场景不存在：${choice.next}`);
  }

  const effects = choice.effects ?? {};
  const memories = game.memories.map(copyMemory);
  if (choice.memory && !memories.some((memory) => memory.id === choice.memory.id)) {
    memories.push(copyMemory(choice.memory));
  }

  return {
    ...game,
    introDone: true,
    sceneId: choice.next,
    energy: clamp(game.energy + (effects.energy ?? 0), 0, 100),
    money: clamp(game.money + (effects.money ?? 0), 0),
    connection: clamp(game.connection + (effects.connection ?? 0), 0, 100),
    flags: unique([...game.flags, ...(choice.flag ? [choice.flag] : [])]),
    memories,
    history: [
      ...game.history,
      {
        sceneId: game.sceneId,
        choiceId: choice.id,
        choiceTitle: choice.title,
        at: new Date().toISOString(),
      },
    ],
    visited: unique([...game.visited, choice.next]),
  };
}

export function serializeGame(game) {
  return JSON.stringify(game);
}

export function restoreGame(raw) {
  if (typeof raw !== 'string' || raw.length > 1_000_000) return null;

  try {
    const saved = JSON.parse(raw);
    if (!isObject(saved) || saved.version !== 1) return null;
    if (typeof saved.name !== 'string') return null;
    const name = saved.name.trim();
    if (Array.from(name).length < 1 || Array.from(name).length > 12) return null;
    const origin = Object.hasOwn(saved, 'origin') ? saved.origin : 'pause';
    const introDone = Object.hasOwn(saved, 'introDone') ? saved.introDone : true;
    if (!validOrigin(origin) || typeof introDone !== 'boolean') return null;
    if (!hasText(saved.sceneId) || !Object.hasOwn(scenes, saved.sceneId)) return null;
    if (![saved.energy, saved.money, saved.connection].every(Number.isFinite)) return null;
    if (!isDate(saved.startedAt)) return null;

    const knownFlags = new Set(
      Object.values(scenes).flatMap((scene) => [
        ...scene.choices.flatMap((choice) => [choice.flag, choice.condition?.flag, choice.condition?.notFlag]),
        ...(scene.paragraphVariants ?? []).flatMap((variant) => [variant.condition?.flag, variant.condition?.notFlag]),
      ].filter(Boolean)),
    );
    if (!Array.isArray(saved.flags) || !saved.flags.every((flag) => typeof flag === 'string' && knownFlags.has(flag))) return null;

    const knownMemories = new Map([
      [initialMemory.id, initialMemory],
      ...Object.values(scenes).flatMap((scene) =>
        scene.choices.filter((choice) => choice.memory).map((choice) => [choice.memory.id, choice.memory]),
      ),
      ...endingMemories(),
      ...activityDefinitions.map((activity) => [activity.memory.id, activity.memory]),
    ]);
    if (!Array.isArray(saved.memories) || !saved.memories.length) return null;
    if (!saved.memories.every((memory) =>
      isObject(memory) && knownMemories.has(memory.id) && hasText(memory.title) && hasText(memory.description, 2_000),
    )) return null;
    if (!saved.memories.some((memory) => memory.id === initialMemory.id)) return null;

    if (!Array.isArray(saved.visited) || !saved.visited.every((id) => typeof id === 'string' && Object.hasOwn(scenes, id))) return null;
    if (!saved.visited.includes('arrival') || !saved.visited.includes(saved.sceneId)) return null;
    if (!Array.isArray(saved.history) || !saved.history.every((entry) => {
      if (!isObject(entry) || !hasText(entry.sceneId) || !Object.hasOwn(scenes, entry.sceneId)) return false;
      const choice = scenes[entry.sceneId].choices.find((item) => item.id === entry.choiceId);
      return Boolean(choice) && hasText(entry.choiceTitle) && isDate(entry.at);
    })) return null;
    if (!introDone && (saved.sceneId !== 'arrival' || saved.history.length !== 0)) return null;

    const letterReplies = Object.hasOwn(saved, 'letterReplies') ? saved.letterReplies : {};
    if (!isObject(letterReplies)) return null;
    const delivered = new Map(unlockedLetters(saved).map((letter) => [letter.id, letter]));
    if (!Object.entries(letterReplies).every(([id, replyId]) =>
      typeof replyId === 'string' && delivered.get(id)?.replies.some((reply) => reply.id === replyId),
    )) return null;

    return {
      version: 1,
      name,
      origin,
      introDone,
      letterReplies: { ...letterReplies },
      activities: normalizeActivities(saved.activities),
      sceneId: saved.sceneId,
      energy: clamp(saved.energy, 0, 100),
      money: clamp(saved.money, 0),
      connection: clamp(saved.connection, 0, 100),
      flags: unique(saved.flags),
      memories: unique(saved.memories.map((memory) => memory.id)).map((id) => copyMemory(knownMemories.get(id))),
      history: saved.history.slice(-500).map((entry) => ({
        sceneId: entry.sceneId,
        choiceId: entry.choiceId,
        choiceTitle: scenes[entry.sceneId].choices.find((choice) => choice.id === entry.choiceId).title,
        at: entry.at,
      })),
      visited: unique(saved.visited),
      startedAt: saved.startedAt,
    };
  } catch {
    return null;
  }
}
