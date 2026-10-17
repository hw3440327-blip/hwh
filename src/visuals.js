import { scenes } from './story.js';

export const artwork = {
  arrival: '/art/immersive-arrival.png', spring: '/art/immersive-arrival.png',
  bakery: '/art/immersive-bakery.png', room: '/art/immersive-room.png',
  'room-night': '/art/immersive-room-night.png', workshop: '/art/immersive-workshop.png',
  letters: '/art/immersive-letters.png', garden: '/art/immersive-garden.png',
  bookshop: '/art/immersive-bookshop.webp', market: '/art/immersive-market.webp',
  courtyard: '/art/immersive-courtyard.webp', shore: '/art/immersive-shore.webp',
};
const sceneOverrides = {
  bookshop: 'bookshop', ending_bookshop: 'bookshop', farewell_bookshop: 'bookshop',
  morning: 'market', ending_workshop: 'market', laundry: 'courtyard', winter: 'courtyard',
  shore: 'shore', workshop: 'workshop', letter: 'letters', life_midlife: 'room-night',
};
export function sceneArtKey(scene) {
  if (!scene) return 'arrival';
  if (sceneOverrides[scene.id]) return sceneOverrides[scene.id];
  const location = scene.location || '';
  if (/书店/.test(location)) return 'bookshop';
  if (/菜市场|小集/.test(location)) return 'market';
  if (/公用小院/.test(location)) return 'courtyard';
  if (/海堤|洗衣店外/.test(location)) return 'shore';
  if (/旧物铺/.test(location)) return 'workshop';
  const hour = Number((scene.time || '').match(/\b(\d{1,2}):\d{2}/)?.[1]);
  const isNight = /夜晚|晚上|深夜/.test(scene.time || '') || (Number.isFinite(hour) && (hour >= 19 || hour < 6));
  if (isNight && /住处|小屋/.test(location)) return 'room-night';
  if (scene.image === 'room' && isNight) return 'room-night';
  return Object.hasOwn(artwork, scene.image) ? scene.image : 'arrival';
}
export const getSceneArt = scene => artwork[sceneArtKey(scene)];
export function memoryArt(memory) {
  const momentImage = { moment_bread: 'bakery', moment_repair: 'workshop', moment_plant: 'room' }[memory.id];
  if (momentImage) return artwork[momentImage];
  const scene = memory.id.startsWith('echo:') ? scenes[memory.id.slice(5)] : Object.values(scenes).find(item => item.choices.some(choice => choice.memory?.id === memory.id));
  return getSceneArt(scene);
}
export function sceneDescription(scene) {
  return ({
    arrival: '手绘动画中的海边木造车站，雨后站台通向蓝色海湾，远山和小镇浸在柔光里',
    spring: '清透的手绘海边小镇，木造站房、海风与远处的山',
    bakery: '手绘动画般朴素的木面包房，烤箱透着暖光，桌上有纸袋和茶杯',
    room: '明亮的手绘小租屋，阳光落在旧木桌上，亚麻窗帘旁有一盆绿植',
    'room-night': '安静的手绘夜景，暖台灯照亮小租屋，窗外是深蓝的海湾',
    workshop: '有使用痕迹的木工作台、修补中的木盒与工具，海风从窗外吹来',
    letters: '柔光照着木桌上摊开的旧信、照片和眼镜，茶杯旁留下温暖的影子',
    garden: '手绘的海边坡道与小花园，树影落在旧木长椅上，白发的背影望着远处',
    bookshop: '海边木书店的窗边座位，书架与日常小物静静立在柔和的天光里',
    market: '小镇早市的窄巷，热粥摊、蔬菜与藤篮迎来一个普通早晨',
    courtyard: '后街居民共用的小院，晾衣绳、旧水池与盆栽留着生活的痕迹',
    shore: '洗衣店外的海堤，石阶与近岸礁石延伸向安静的海面',
  })[sceneArtKey(scene)] || '手绘动画中的海边小镇';
}
const details = {
  arrival: [
    { id: 'platform', label: '湿漉漉的站台', x: 28, y: 65, text: '鞋底踩过浅浅的积水。站房木檐上的雨，隔一会儿才落下一滴。' },
    { id: 'sea', label: '远处的海', x: 73, y: 43, text: '风把一点咸味带到这里。船慢慢过去，海面又合上了那道细长的白线。' },
  ],
  bakery: [
    { id: 'oven', label: '烤箱的暖光', x: 7, y: 39, zoom: 2.3, text: '砖砌炉口里亮着橙色的火光，铁盘边缘已经被多年烘烤熏暗。面包外皮轻轻裂开，黄油和面粉的味道从柜台后面散出来。有人每天很早起床，才有这一炉可以递到别人手里的热。' },
    { id: 'cup', label: '柜台上的茶杯', x: 14, y: 60, zoom: 2.7, text: '白瓷杯上画着几片蓝叶，杯旁的格纹布巾叠得并不齐。木柜台被擦过很多次，边缘磨出一小圈柔亮的颜色。即使只坐几分钟，这里也给一双疲惫的手留了地方。' },
  ],
  room: [
    { id: 'curtain', label: '窗边的风', x: 65, y: 33, text: '帘子鼓起来，又慢慢落回去。屋里很安静，能听见楼下有人收起晾衣杆。' },
    { id: 'desk', label: '旧木桌与空白页', x: 29, y: 50, zoom: 2.3, text: '抽屉把手下方的木色比别处深一些，是经常被碰到的地方。桌上摊着一本本子，笔安静地横在旁边。把账目、菜谱或者今天的一句话写下来，都有足够的位置。' },
  ],
  'room-night': [
    { id: 'lamp', label: '那盏小台灯', x: 82, y: 43, zoom: 2.4, text: '布灯罩把光拢在床边的小桌上，木板接缝和书脊都变得柔和。灯座旁放着一小只碗和绿植，没有哪件东西特别贵重。夜已经深了，屋里仍有一处可以让人安稳坐下。' },
    { id: 'night', label: '海湾的灯火', x: 38, y: 28, text: '对岸的灯散在山脚下，一点一点落进深蓝的水里。小船经过时，倒影会短暂地断开，又慢慢接起来。你不知道那些窗后住着谁，只知道今晚也有别人正在回家。' },
  ],
  workshop: [
    { id: 'wood', label: '修补中的木盒', x: 55, y: 59, zoom: 2.5, text: '盒盖上的木纹并不笔直，边角留着细小的碰痕。卸下的合页和螺丝被放在旁边，没有急着装回去。先看清哪里松了，才知道怎样让一件东西继续陪人生活。' },
    { id: 'tools', label: '有使用痕迹的工具', x: 25, y: 58, zoom: 2.5, text: '木柄被掌心磨得发亮，夹具的螺杆上还有一点旧木屑。东西各有位置，常用的就放在伸手够得到的地方。熟练往往就藏在这些不用大声解释的习惯里。' },
  ],
  letters: [
    { id: 'paper', label: '信纸与旧照片', x: 48, y: 58, zoom: 2.1, text: '拆开的信封彼此压着，纸边留着来回折叠的痕迹。两张照片从旧相册旁滑出来，画面里的日子已经过去很久。把纸慢慢展开，那些被认真保存的小事仍有自己的位置。' },
    { id: 'tea', label: '茶杯旁的眼镜', x: 89, y: 58, zoom: 2.5, text: '眼镜摘下来放在茶杯旁，细细的镜腿在桌面投下一道影子。笔尖已经合上，杯里的茶可以等一会儿再喝。读到心里发酸的地方，暂时停下来也没有关系。' },
  ],
  garden: [
    { id: 'bench', label: '修补过的长椅', x: 25, y: 57, zoom: 2.2, text: '椅背中间的一块木板颜色浅些，能看出后来更换的痕迹。脚边的小花长到了石墙下，没有人把它们修得完全齐整。树荫慢慢移动，长椅始终给路过的人留着一个位置。' },
    { id: 'leaves', label: '树影里的小花', x: 12, y: 63, zoom: 2.6, text: '蓝色的绣球挨着细小的白花，叶片边缘被光照得透亮。风从坡道上来时，花影先动了一下，随后才听见头顶的叶响。这样的变化很小，坐久一点就会发现。' },
  ],
  bookshop: [
    { id: 'book', label: '摊开的书', x: 39, y: 82, zoom: 2.5, text: '打开的书平放在木桌上，页边已经被翻得柔软。窗外的光落到纸面，细小的纸纹也看得见。读到哪一页都不必着急，离开之前折好书签就行。' },
    { id: 'library-card', label: '借书卡与木印章', x: 66, y: 88, zoom: 2.7, text: '一张小小的借书卡挨着木印章，边缘被来往的手磨得发毛。借走、归还、再放回架上，一本书就这样认识了许多人。店员每天做的琐事，也给这些相遇留下了顺序。' },
  ],
  market: [
    { id: 'porridge', label: '一锅热粥', x: 10, y: 40, focusX: 14, focusY: 45, zoom: 2.3, text: '锅边的白汽一阵阵升起来，摊主把用过的勺子搁回碗旁。叠好的瓷碗还带着热水洗过的温度。一顿早饭谈不上丰盛，却能让空着的胃踏实下来。' },
    { id: 'vegetables', label: '竹篮里的青菜', x: 82, y: 65, focusX: 83, focusY: 68, zoom: 2.5, text: '菜叶的边缘还卷着水珠，竹篮底部已经磨得发白。摊主把不太整齐的几根也拢在一起，又替客人添了一小把。饭桌上的踏实，常常从这些很小的买卖开始。' },
  ],
  courtyard: [
    { id: 'blue-door', label: '那扇蓝色旧门', x: 43, y: 39, zoom: 2.1, text: '门漆在常被碰到的地方浅了一点，木纹从下面慢慢露出来。门边的石板经年被脚步磨平，回家时不必再低头找路。这些来回走的小路，让一处住址慢慢成为家。' },
    { id: 'laundry', label: '晾晒的白衬衣', x: 68, y: 27, zoom: 2.4, text: '白衬衣在绳上撑开，袖口比别的地方干得慢一些。风从布料中间穿过去，洗衣皂的味道散得很轻。等它晒干、收回屋里，今天的一件小事就算完成了。' },
  ],
  shore: [
    { id: 'washer', label: '洗衣机的圆窗', x: 11, y: 40, zoom: 2.4, text: '圆窗里的衣服一圈圈翻动，湿布贴到玻璃上，又慢慢落回去。洗衣店里留着淡淡的皂香，机器替你做完这件暂时急不来的事。二十六分钟，可以交给一页书，也可以交给海。' },
    { id: 'boat', label: '慢行的小渔船', x: 78, y: 47, zoom: 2.7, text: '小船沿着海堤外的水面慢慢经过，船尾留着细细的一线白浪。风声里偶尔混进一声汽笛，过很久才散开。等一件衣服烘干的时间，足够把眼睛从近处移向很远的地方。' },
  ],
};
const sceneConnections = {
  arrival: '今天你刚到栖屿镇，袖口还湿着；站台外那间亮灯的面包房，是这一段生活最先出现的邀请。',
  bakery: '林姨递来的毛巾和这一小块柜台，都在告诉初来的你：不必先讲清离开的原因，也能歇一会儿。',
  room: '找到蓝门小屋以后，换掉湿衣服、关好窗，就已经是今晚值得完成的事。',
  morning: '一碗粥吃完，路口还有三份招工消息；先问清班次和报酬，比急着决定整个人生更实际。',
  trial_bakery: '清晨的工作有时比想象中累，林姨说清的工时与报酬，让这一炉暖意也有了现实的分量。',
  workshop: '周予正在教你修一把椅子：先稳住受力的地方，等胶干透，才让主人带回家。',
  bookshop: '阿禾把班次和培训工时说清楚，也在忙完一天后把窗边的椅子让给你；喜欢的生活，正从这些琐碎里成形。',
  first_week: '两周的工资和日常开支都落进了本子里，你开始知道，怎样安排才能让日子过得下去。',
  laundry: '在这个共用的小院里，一次晾衣和几句闲谈，正让你与邻居慢慢熟悉。',
  shore: '洗衣机还剩二十六分钟；阿禾只是骑车经过、打了个招呼，没有要求你解释这个安静的下午。',
  winter: '从初冬到冬末，回家的路渐渐熟悉；你也在工作、开销和休息之间，试出自己能承受的节奏。',
  letter: '续租提醒与城里的工作邀请在同一天到来；桌上的纸，正帮你把留下和离开的打算一项项想清。',
  ending_bakery: '这个春天，你与林姨谈好下一季的工作，愿意把面包房的早晨认真接住。',
  ending_workshop: '修补桌终于摆进周末小集，预算、工具和能接的活都算过了，新的开始才有了可站稳的位置。',
  ending_bookshop: '排班和校对工作都安排好了，窗边这一小段空闲，也被你认真留在生活里。',
  ending_return: '合同和住处已经确认；这次回城，你带着认真告别过、也认真生活过的一段日子。',
  life_bridge: '二十八岁的普通晚饭后，你替储蓄和休息各留一页；人生正在一顿饭、一个星期二里继续。',
  life_budget: '三十岁时重新核对日常开销，让眼下的喜欢和往后的余地，都能在同一本账里找到位置。',
  life_boundary: '三十二岁的这个晚上，你练习把能做的与不能接下的说清，给自己的生活留一道温和的边界。',
  life_craft: '三十五岁，你已能看出哪些工作值得慢慢做，也知道不必把每一份委托都接下来。',
  life_midlife: '夜里九点多，维修费、工作与家人的检查挤在同一张日历上；把事情分开安排，已经是在照顾眼前的自己。',
  life_companion: '这顿晚饭关乎怎样相处：把需要说清楚，也给对方留出能做到与做不到的空间。',
  life_change: '五十岁的活动室里，新东西仍然可以慢慢学；把不懂的问出来，也是一种有经验的做法。',
  life_rest: '五十二岁的午后，你开始把休息当作生活中该有的一部分，窗边这一会儿不需要拿成果来交换。',
  life_retire: '六十五岁，工作之外终于有了更多空白；在小院坐一坐，也是在学习怎样度过新的日常。',
  life_lin_letter: '林姨的女儿寄来信与旧食谱；想念可以慢慢来，今天仍要替自己做一顿热饭。',
  life_teaching: '七十岁，你把会做的事一点点讲给后来的人，也允许他们用自己的速度学会。',
  life_garden: '七十三岁，照看菜畦需要记住浇水，也需要接受天气；小院里的日子仍有值得等的变化。',
  life_slow: '七十九岁，动作慢下来以后，一把椅子、一扇窗和一次愿意等你的探望，都变得具体。',
  life_album: '八十岁，翻相册时留下来的并不只有大事，许多普通照片也证明你曾认真度过那些日子。',
  life_farewell: '八十二岁的这个下午，你想说的话可以慢慢说完；灯什么时候开，也仍然可以照自己的意愿决定。',
  life_ticket: '梦里的旧车站又出现了；这次你不用急着找答案，可以先看看这一生愿意带走的东西。',
  farewell_bakery: '又一个春天的清晨，面包房仍有人为后来的人留灯，你珍惜过的日常正在继续。',
  farewell_workshop: '靠窗的长桌边，后来的人继续修补、学习；耐心通过一双双手留了下来。',
  farewell_bookshop: '书仍会被借走再归还，靠窗的位置也会有人坐下；你留下的从容，成了下一次相遇的余地。',
  farewell_return: '车门将开，过去的日子没有被留在身后，而是成为下一次出发时能够认出的温暖。',
};
export function sceneDetails(scene) {
  const key = sceneArtKey(scene);
  return (details[key === 'spring' ? 'arrival' : key] || details.arrival).map(detail => ({
    ...detail,
    connection: sceneConnections[scene?.id] || `在${scene?.location || '栖屿镇'}，这些普通的物件陪你停一会儿，再回到今天的故事。`,
  }));
}
