// Small, optional things to do with your hands. Progress belongs to this life,
// so leaving a scene never erases an unfinished object or grants its gift twice.
export const activityDefinitions = [
  {
    id: 'bread',
    title: '烤一只小面包',
    actionLabel: '烤一只小面包',
    place: '面包房',
    reply: '林姨把纸袋递过来：“还热着，慢慢吃。”',
    summary: '把面粉和温水拌在一起，慢慢揉匀。今天不赶时间，烤出自己的那一只就好。',
    sceneIds: ['bakery', 'trial_bakery', 'winter', 'ending_bakery'],
    memory: {
      id: 'moment_bread',
      title: '亲手烤的小面包',
      description: '掌心揉过的面团，在炉里鼓起一点金黄。形状并不整齐，却有属于今天的温度。',
    },
    reward: { energy: 4, connection: 2 },
  },
  {
    id: 'repair',
    title: '拼好一只旧木盒',
    actionLabel: '拼好一只旧木盒',
    place: '旧物铺',
    reply: '木片重新合拢，指尖抚过，接缝已经平稳了。',
    summary: '顺着木纹转一转散开的盒盖，让三块旧木片重新靠在一起，再轻轻粘牢。',
    sceneIds: ['workshop', 'life_craft', 'life_change', 'life_teaching', 'ending_workshop'],
    memory: {
      id: 'moment_repair',
      title: '重新合拢的旧木盒',
      description: '三块木片顺着纹路重新接上了。盒盖仍留着细细的缝，却又能安稳地收下一件小东西。',
    },
    reward: { energy: 2, connection: 3 },
  },
  {
    id: 'plant',
    title: '照顾窗边的小花',
    actionLabel: '照顾窗边的小花',
    place: '窗边',
    reply: '窗缝里有风。叶子扶起来以后，你也慢慢松开了肩膀。',
    summary: '挑一株喜欢的幼苗，给它一点水和柔和的光，再把垂下的叶子轻轻扶好。',
    sceneIds: ['room', 'first_week', 'life_rest', 'life_retire', 'life_garden', 'life_slow'],
    memory: {
      id: 'moment_plant',
      title: '窗边的一小盆新绿',
      description: '你给幼苗浇过水，打开窗，让柔和的光落到叶子上。以后的日子里，多了一件值得慢慢照顾的小事。',
    },
    reward: { energy: 5, connection: 1 },
  },
];

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const definitionFor = (id) => activityDefinitions.find((activity) => activity.id === id);
const clampResource = (value) => Math.min(100, Math.max(0, value));
const hasOwn = (object, key) => isObject(object) && Object.hasOwn(object, key);

function initialProgress(id) {
  if (id === 'bread') return { ingredients: [], kneads: 0, temperature: 180, completed: false };
  if (id === 'repair') return { rotations: [1, 3, 2], completed: false };
  if (id === 'plant') return { seed: null, watered: false, light: false, cared: false, completed: false };
  return null;
}

function normalizeProgress(id, value) {
  const initial = initialProgress(id);
  if (!initial || !isObject(value)) return initial;
  if (id === 'bread') {
    const ingredients = ['flour', 'water'].filter((ingredient) =>
      Array.isArray(value.ingredients) && value.ingredients.includes(ingredient));
    const kneads = ingredients.length === 2 && Number.isInteger(value.kneads)
      ? Math.max(0, Math.min(3, value.kneads)) : 0;
    const temperature = Number.isFinite(value.temperature)
      && value.temperature >= 150 && value.temperature <= 210 ? Math.round(value.temperature) : 180;
    return {
      ingredients,
      kneads,
      temperature,
      completed: value.completed === true && ingredients.length === 2 && kneads === 3
        && temperature >= 170 && temperature <= 190,
    };
  }
  if (id === 'repair') {
    const rotations = initial.rotations.map((fallback, index) => {
      const rotation = Array.isArray(value.rotations) ? value.rotations[index] : null;
      return Number.isInteger(rotation) && rotation >= 0 && rotation < 4 ? rotation : fallback;
    });
    return { rotations, completed: value.completed === true && rotations.every((rotation) => rotation === 0) };
  }
  const seed = ['cosmos', 'forgetmenot'].includes(value.seed) ? value.seed : null;
  const watered = seed !== null && value.watered === true;
  const light = watered && value.light === true;
  const cared = light && value.cared === true;
  return { seed, watered, light, cared, completed: value.completed === true && cared };
}

// Save restoration keeps only known activities and their legal fields. It does
// not apply rewards: loading a finished object is just loading a finished object.
export function normalizeActivities(value) {
  if (!isObject(value)) return {};
  return Object.fromEntries(activityDefinitions
    .filter((activity) => hasOwn(value, activity.id) && isObject(value[activity.id]))
    .map((activity) => [activity.id, normalizeProgress(activity.id, value[activity.id])]));
}

export function activityProgress(game, id) {
  if (!definitionFor(id)) return null;
  const saved = hasOwn(game?.activities, id) ? game.activities[id] : null;
  const progress = normalizeProgress(id, saved);
  let stage;
  if (progress.completed) stage = 'done';
  else if (id === 'bread') stage = progress.ingredients.length < 2 ? 'ingredients' : progress.kneads < 3 ? 'knead' : 'bake';
  else if (id === 'repair') stage = progress.rotations.every((rotation) => rotation === 0) ? 'seal' : 'arrange';
  else stage = !progress.seed ? 'seed' : !progress.watered ? 'water' : !progress.light ? 'light' : 'care';
  return { ...progress, stage };
}

export function getSceneActivity(game) {
  return activityDefinitions.find((activity) => activity.sceneIds.includes(game?.sceneId)) ?? null;
}

export function performActivity(game, id, action) {
  const definition = definitionFor(id);
  if (!definition || !isObject(game) || !isObject(action)
    || !definition.sceneIds.includes(game.sceneId)
    || !Array.isArray(game.memories) || !Number.isFinite(game.energy)
    || !Number.isFinite(game.connection)) return game;

  const progress = activityProgress(game, id);
  if (progress.completed) return game;
  const { stage, ...next } = progress;
  let changed = false;

  if (id === 'bread') {
    if (stage === 'ingredients' && ['flour', 'water'].includes(action.type)
      && !next.ingredients.includes(action.type)) {
      next.ingredients = ['flour', 'water'].filter((ingredient) =>
        ingredient === action.type || next.ingredients.includes(ingredient));
      changed = true;
    } else if (stage === 'knead' && action.type === 'knead') {
      next.kneads += 1;
      changed = true;
    } else if (stage === 'bake' && action.type === 'set_temperature'
      && Number.isFinite(action.value) && action.value >= 150 && action.value <= 210) {
      const temperature = Math.round(action.value);
      changed = temperature !== next.temperature;
      next.temperature = temperature;
    } else if (stage === 'bake' && action.type === 'bake'
      && next.temperature >= 170 && next.temperature <= 190) {
      next.completed = true;
      changed = true;
    }
  } else if (id === 'repair') {
    if (action.type === 'rotate' && Number.isInteger(action.index)
      && action.index >= 0 && action.index < next.rotations.length) {
      next.rotations = next.rotations.map((rotation, index) =>
        index === action.index ? (rotation + 1) % 4 : rotation);
      changed = true;
    } else if (stage === 'seal' && action.type === 'mend') {
      next.completed = true;
      changed = true;
    }
  } else if (stage === 'seed' && action.type === 'select_seed'
    && ['cosmos', 'forgetmenot'].includes(action.seed)) {
    next.seed = action.seed;
    changed = true;
  } else if (stage === 'water' && action.type === 'water') {
    next.watered = true;
    changed = true;
  } else if (stage === 'light' && action.type === 'open_window') {
    next.light = true;
    changed = true;
  } else if (stage === 'care' && action.type === 'support') {
    next.cared = true;
    next.completed = true;
    changed = true;
  }

  if (!changed) return game;
  const alreadyRemembered = game.memories.some((memory) => memory?.id === definition.memory.id);
  const receiveGift = next.completed && !alreadyRemembered;
  return {
    ...game,
    activities: { ...normalizeActivities(game.activities), [id]: next },
    energy: receiveGift ? clampResource(game.energy + definition.reward.energy) : game.energy,
    connection: receiveGift ? clampResource(game.connection + definition.reward.connection) : game.connection,
    memories: receiveGift ? [...game.memories, { ...definition.memory }] : game.memories,
  };
}
