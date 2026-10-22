// A remembered rainstorm inside a repaired object. It never advances the life story.
export const MEMORY_BOX_MEMORY = {
  id: 'memory_rain_box',
  title: '一只留住雨声的木盒',
  description: '你顺着木纹修好了林姨的旧盒。雨声里，有临行前慢慢喝完的一杯茶，也有等桂花再开时重逢的约定。你留下的话，陪这段旧时光有了新的去处。',
};

// These exact lines are also the source texts of the bundled voice recordings.
// Changing a line requires regenerating and verifying its audio first.
export const MEMORY_BOX_RECORDINGS = [
  { id: 'rain-table', title: '临行前的雨夜', text: '雨还没停，先把手暖一暖。明天你就要走了，今晚这杯茶，我们慢慢喝。' },
  { id: 'rain-window', title: '寄一封普通的信', text: '到了那边，记得给我写信。不用写什么大事，就说说今天吃了什么，路上有没有下雨。' },
  { id: 'rain-home', title: '桂花再开的时候', text: '等院子里的桂花再开，我们就在这扇窗边见。来晚一点也没关系，我会给你留一盏灯。' },
];
export const MEMORY_BOX_INSPECTIONS = [
  { id: 'grain', label: '摸一摸木纹', text: '细细的木纹横着经过盒盖。掌心顺着它移动时很平，反过来摸，翘起的毛刺会留住手指。周予把砂布放在旁边，让你先认清这个方向。' },
  { id: 'hinge', label: '看看松动的合页', text: '两颗小螺丝都还在，孔边也没有裂开。旧合页不必换掉，清好表面，再一点点拧稳，盒盖就能重新慢慢打开。' },
  { id: 'scratch', label: '靠近那道旧划痕', text: '划痕绕开了中央的木纹，像一条转过弯的小路。林姨说那是很多年前替旧友收拾行李时留下的，手摸到这里，就会想起那个下雨的晚上。' },
];
export const MEMORY_BOX_STYLES = [
  { id: 'keep', label: '留下旧划痕', name: '留下旧划痕', description: '只磨平扎手的边缘，保留主人熟悉的那条小路。' },
  { id: 'leaf', label: '嵌进一片木叶', name: '嵌进一片木叶', description: '用浅色木片补好边角，留下一片你亲手带来的叶子。' },
];
export const MEMORY_BOX_REPLIES = [
  { id: 'letter', text: '想说的话，现在寄出去也来得及。', response: '林姨把抽屉里的旧地址找出来，重新写了一张明信片。她没有急着说对方会不会收到，先把今天的小镇天气认真写了上去。' },
  { id: 'window', text: '桂花再开时，这扇窗边还可以坐一坐。', response: '她把窗边积着的小物件挪开，留出两个杯子的位置：“那就先替下一次见面，空出这一点地方。”' },
  { id: 'listen', text: '我听见了。那个约定，仍然有人好好记着。', response: '林姨摸了摸盒盖，慢慢点头。她把那张一直没有写完的明信片翻过来，添上了新的日期。' },
];
export const MEMORY_BOX_DESTINATIONS = [
  { id: 'return', label: '亲手还给林姨', description: '把修好的木盒与自己的话，一起带回面包房。' },
  { id: 'window', label: '借放在自己的窗边', description: '林姨愿意借你留一阵，让这段雨声陪你写完一张新的明信片。' },
];

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const allowed = list => new Set(list.map(item => item.id));
const inspectionIds = allowed(MEMORY_BOX_INSPECTIONS);
const styleIds = allowed(MEMORY_BOX_STYLES);
const recordingIds = allowed(MEMORY_BOX_RECORDINGS);
const destinationIds = allowed(MEMORY_BOX_DESTINATIONS);
const safeText = value => typeof value === 'string'
  ? Array.from(value.replace(/[\u0000-\u001f\u007f]/g, '').trim()).slice(0, 60).join('') : '';
const fraction = (value, fallback = 0) => Number.isFinite(value) ? Math.round(Math.max(0, Math.min(1, value)) * 1000) / 1000 : fallback;
const unique = values => [...new Set(values)];
const orderedRecordingIds = values => MEMORY_BOX_RECORDINGS.map(item => item.id).filter(id => values.includes(id));
const understoodIds = state => MEMORY_BOX_RECORDINGS.map(item => item.id).filter(id => state.heard.includes(id) || state.read.includes(id));
const hasReply = state => understoodIds(state).length === MEMORY_BOX_RECORDINGS.length && state.reply.length > 0;

export function normalizeMemoryBox(value) {
  const saved = object(value) ? value : {};
  const inspected = Array.isArray(saved.inspected) ? unique(saved.inspected.filter(id => inspectionIds.has(id))) : [];
  const sandProgress = inspected.includes('grain') ? fraction(saved.sandProgress) : 0;
  const style = sandProgress === 1 && styleIds.has(saved.style) ? saved.style : null;
  const fasteners = [0, 1].map(index => style && Array.isArray(saved.fasteners) && [0, .5, 1].includes(saved.fasteners[index]) ? saved.fasteners[index] : 0);
  const repaired = Boolean(style && fasteners.every(value => value === 1));
  const heardSource = repaired && Array.isArray(saved.heard) ? saved.heard.filter(id => recordingIds.has(id)) : [];
  const readSource = repaired && Array.isArray(saved.read) ? saved.read.filter(id => recordingIds.has(id)) : [];
  const understood = [];
  for (const item of MEMORY_BOX_RECORDINGS) {
    if (!heardSource.includes(item.id) && !readSource.includes(item.id)) break;
    understood.push(item.id);
  }
  const heard = understood.filter(id => heardSource.includes(id));
  const read = understood.filter(id => readSource.includes(id));
  const maximumIndex = Math.min(understood.length, MEMORY_BOX_RECORDINGS.length - 1);
  const memoryIndex = repaired && Number.isInteger(saved.memoryIndex) && saved.memoryIndex >= 0 && saved.memoryIndex <= maximumIndex ? saved.memoryIndex : 0;
  const replyChoice = understood.length === MEMORY_BOX_RECORDINGS.length && MEMORY_BOX_REPLIES.some(item => item.id === saved.replyChoice) ? saved.replyChoice : null;
  const reply = understood.length === MEMORY_BOX_RECORDINGS.length
    ? replyChoice ? MEMORY_BOX_REPLIES.find(item => item.id === replyChoice).text : safeText(saved.reply) : '';
  const destination = reply && destinationIds.has(saved.destination) ? saved.destination : null;
  return { version: 1, inspected, sandProgress, style, fasteners, repaired,
    lid: repaired ? fraction(saved.lid) : 0, heard, read, memoryIndex, reply, replyChoice,
    destination, completed: destination !== null };
}

export function memoryBoxProgress(game) { return normalizeMemoryBox(game?.memoryBox); }

export function memoryBoxStage(gameOrState) {
  const state = object(gameOrState) && (Object.hasOwn(gameOrState, 'memoryBox') || Object.hasOwn(gameOrState, 'sceneId'))
    ? memoryBoxProgress(gameOrState) : normalizeMemoryBox(gameOrState);
  if (!state.inspected.includes('grain')) return 'inspect';
  if (state.sandProgress < 1) return 'sand';
  if (!state.style) return 'style';
  if (!state.repaired) return 'hinge';
  if (understoodIds(state).length < MEMORY_BOX_RECORDINGS.length) return 'listen';
  if (!state.reply) return 'reply';
  if (!state.destination) return 'choose';
  return 'done';
}

export function memoryBoxUnderstood(gameOrState) {
  const state = object(gameOrState) && (Object.hasOwn(gameOrState, 'memoryBox') || Object.hasOwn(gameOrState, 'sceneId'))
    ? memoryBoxProgress(gameOrState) : normalizeMemoryBox(gameOrState);
  return understoodIds(state);
}

export function memoryBoxEcho(game, place) {
  const state = memoryBoxProgress(game);
  if (!state.completed) return null;
  const style = state.style === 'leaf'
    ? '林姨用指腹摸过那片浅色木叶，说下一次见面时，也想把这处新修补指给旧友看。'
    : '林姨认出了盒盖上留下的旧划痕，说那条小路还在，手便知道该往哪里放。';
  const response = MEMORY_BOX_REPLIES.find(item => item.id === state.replyChoice)?.response
    || '林姨认真读过你留下的话，把旧地址抄在一张新的明信片上。她想先写一写今天，给下一次重逢留一个开头。';
  if (state.destination === 'return' && place === 'bakery') return {
    title: '柜台边，多了一只旧木盒', text: `${style}${response}`,
    objectLabel: '林姨柜台上的雨声木盒', destination: state.destination, showBox: true,
  };
  if (state.destination === 'window' && place === 'room') return {
    title: '窗边，留住了一小段雨声', text: '林姨把木盒借你留一阵。你给它找了一个能看见天光的位置，旁边放着还可以继续写下去的明信片。她约好有空来喝茶，一起看看桂花什么时候开。',
    objectLabel: '借放在窗边的雨声木盒', destination: state.destination, showBox: true,
  };
  if (place === 'bakery') return {
    title: '林姨重新写起了明信片', text: `${style}${response}`,
    objectLabel: '关于下一次见面的明信片', destination: state.destination, showBox: false,
  };
  if (place === 'workshop') return {
    title: '那一处修补，已经有了去处', text: state.destination === 'return'
      ? '周予听说你亲手把木盒还给了林姨，把桌角的砂布叠好：“修好以后，还要有人愿意继续用它。这样就很好。”'
      : '周予给借放在你窗边的木盒留了一小块软垫。下次开合时，旧合页仍能慢慢转，不必怕碰坏了那段雨声。',
    objectLabel: '再听一次木盒里的雨', destination: state.destination, showBox: false,
  };
  return null;
}

export function memoryBoxFollowUp(game, placeOrPerson) {
  const place = ({lin:'bakery',zhou:'workshop',he:'bookshop'})[placeOrPerson] || placeOrPerson;
  return memoryBoxEcho(game, place);
}

export function memoryBoxJournal(game) {
  const state = memoryBoxProgress(game);
  return {
    title: '木盒里的一场雨', stage: memoryBoxStage(state),
    memories: MEMORY_BOX_RECORDINGS.map((item, index) => ({ ...item, heard: state.heard.includes(item.id), read: state.read.includes(item.id), available: index <= understoodIds(state).length })),
    reply: state.reply, destination: state.destination,
    response: MEMORY_BOX_REPLIES.find(item => item.id === state.replyChoice)?.response || '',
    completed: state.completed,
  };
}

export function performMemoryBoxAction(game, action) {
  if (!object(game) || !object(action) || typeof action.type !== 'string') return game;
  const state = memoryBoxProgress(game);
  let next;
  switch (action.type) {
    case 'inspect':
      if (!inspectionIds.has(action.id) || state.inspected.includes(action.id)) return game;
      next = { ...state, inspected: [...state.inspected, action.id] }; break;
    case 'sand': {
      if (!state.inspected.includes('grain') || state.sandProgress >= 1) return game;
      let amount = 0;
      if (action.direction === 'grain') amount = .2;
      else if (Number.isFinite(action.dx) && Number.isFinite(action.dy)
        && Math.abs(action.dx) <= 1 && Math.abs(action.dy) <= 1
        && Math.abs(action.dx) >= .08 && Math.abs(action.dy) <= Math.abs(action.dx) * .65) amount = Math.min(.3, Math.abs(action.dx) * .8);
      if (!amount) return game;
      next = { ...state, sandProgress: fraction(state.sandProgress + amount) }; break;
    }
    case 'style':
      if (state.sandProgress !== 1 || state.repaired || !styleIds.has(action.value) || state.style === action.value) return game;
      next = { ...state, style: action.value, fasteners: [0, 0] }; break;
    case 'fasten': {
      if (!state.style || state.repaired || ![0, 1].includes(action.index) || state.fasteners[action.index] >= 1) return game;
      const fasteners = state.fasteners.map((value, index) => index === action.index ? Math.min(1, value + .5) : value);
      next = { ...state, fasteners, repaired: fasteners.every(value => value === 1) }; break;
    }
    case 'lid': {
      if (!state.repaired || !Number.isFinite(action.value) || action.value < 0 || action.value > 1) return game;
      const lid = fraction(action.value);
      if (lid === state.lid) return game;
      next = { ...state, lid }; break;
    }
    case 'select_memory': {
      if (!state.repaired) return game;
      const memoryIndex = MEMORY_BOX_RECORDINGS.findIndex(item => item.id === action.id);
      if (memoryIndex < 0 || memoryIndex > Math.min(understoodIds(state).length, MEMORY_BOX_RECORDINGS.length - 1) || memoryIndex === state.memoryIndex) return game;
      next = { ...state, memoryIndex }; break;
    }
    case 'next_memory': {
      if (!state.repaired || !understoodIds(state).includes(MEMORY_BOX_RECORDINGS[state.memoryIndex].id) || state.memoryIndex >= MEMORY_BOX_RECORDINGS.length - 1) return game;
      const memoryIndex = Math.min(state.memoryIndex + 1, understoodIds(state).length, MEMORY_BOX_RECORDINGS.length - 1);
      if (memoryIndex === state.memoryIndex) return game;
      next = { ...state, memoryIndex }; break;
    }
    case 'heard': {
      if (!state.repaired || state.lid < .55 || state.heard.includes(action.id)
        || MEMORY_BOX_RECORDINGS[state.memoryIndex]?.id !== action.id
        || state.memoryIndex > understoodIds(state).length) return game;
      next = { ...state, heard: orderedRecordingIds([...state.heard, action.id]) }; break;
    }
    case 'read_memory': {
      if (!state.repaired || state.lid < .55 || state.read.includes(action.id)
        || MEMORY_BOX_RECORDINGS[state.memoryIndex]?.id !== action.id
        || state.memoryIndex > understoodIds(state).length) return game;
      next = { ...state, read: orderedRecordingIds([...state.read, action.id]) }; break;
    }
    case 'reply': {
      if (understoodIds(state).length !== MEMORY_BOX_RECORDINGS.length || typeof action.text !== 'string' || state.completed) return game;
      const reply = safeText(action.text);
      if (reply === state.reply) return game;
      next = { ...state, reply, replyChoice: null }; break;
    }
    case 'reply_choice': {
      if (understoodIds(state).length !== MEMORY_BOX_RECORDINGS.length || state.completed) return game;
      const choice = MEMORY_BOX_REPLIES.find(item => item.id === action.id);
      if (!choice || (state.replyChoice === choice.id && state.reply === choice.text)) return game;
      next = { ...state, reply: choice.text, replyChoice: choice.id }; break;
    }
    case 'destination':
      if (!hasReply(state) || state.destination || !destinationIds.has(action.value)) return game;
      next = { ...state, destination: action.value, completed: true }; break;
    default: return game;
  }
  const memories = action.type === 'destination' && !game.memories?.some(memory => memory.id === MEMORY_BOX_MEMORY.id)
    ? [...(Array.isArray(game.memories) ? game.memories : []), { ...MEMORY_BOX_MEMORY }] : game.memories;
  return { ...game, memoryBox: next, ...(memories !== game.memories ? { memories } : {}) };
}
