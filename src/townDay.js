// A self-contained memory of the first autumn. Its days never advance the life story.
export const TOWN_MEMORY = {
  id: 'town_three_days',
  title: '初秋，镇上的三天',
  description: '你记得一只送到别人手里的面包、一句隔天被记住的话，还有亲手布置的那扇窗。小镇是在这些具体的小事里，慢慢熟悉起来的。',
};

export const TOWN_PLACES = [
  { id: 'room', name: '蓝门小屋', subtitle: '把这里慢慢住成自己的样子', art: '/art/immersive-room.webp', description: '这是初到栖屿镇时的一段回忆。屋里的窗还不太好推，空白的纸卡等着写上今天的一句话。', hotspots: [
    { id: 'room-window', label: '推开有些涩的窗', x: 68, y: 36, text: '你托住窗框往上抬，再慢慢推开。海风把屋里潮湿的味道带走一点。窗台刚好放得下一只小花盆，明天可以再来看它。' },
    { id: 'room-letter', label: '桌角的手写地址', x: 35, y: 62, text: '林姨把面包房、书店和修补铺画在同一张纸上，旁边写着：“有空就走走，不必一天认全。”你把纸留在桌上，出门时已经没那么慌。' },
  ] },
  { id: 'bakery', name: '有光面包房', subtitle: '今天这一炉，想分给谁', art: '/art/film-bakery.webp', description: '门没关严，炉口亮着。林姨给你留了一小块工作台，试做的原料都在手边。', hotspots: [
    { id: 'bakery-recipe', label: '翻看沾着面粉的食谱', x: 48, y: 63, clue: 'lin', text: '食谱边上有林姨的字：“牛奶面包，火轻些，自己吃。”她每天给别人烤脆皮包，给自己的那一只却总要柔软一些。夹在书里的纸袋可以带回家装面包。' },
    { id: 'bakery-oven', label: '在炉门前停一会儿', x: 8, y: 41, text: '林姨告诉你，低一些的炉火让颜色浅、口感软，旺一些会多一点焦香。试做没有客人催，烤得深了就切薄一点，拿来配汤也很好。' },
  ] },
  { id: 'bookshop', name: '沿海书店', subtitle: '借一本书，也借一点闲暇', art: '/art/film-bookshop.webp', description: '阿禾在窗边整理归还的书。桌上留着一张借书卡，书页下压着准备出门的车票。', hotspots: [
    { id: 'book-margin', label: '看见书页间的便笺', x: 40, y: 81, clue: 'he', text: '便笺上写着阿禾想走的路线，背面却是一家果干面包店的地址。她说旅途中最喜欢能慢慢嚼出果香的小面包。旁边那本短篇集已经登记好，可以借回屋里。' },
    { id: 'book-window', label: '坐一坐靠窗的位置', x: 70, y: 43, text: '你往里挪了一点椅子，没有碰到窗台上的书。阿禾说这里下午的光最好，如果哪天回来得早，就给自己留半个小时。' },
  ] },
  { id: 'workshop', name: '旧物修补铺', subtitle: '先看看，再决定怎样下手', art: '/art/film-workshop.webp', description: '周予把旧椅子翻过来检查，没有急着上胶。木屑扫到一旁，桌边空出了能坐下的位置。', hotspots: [
    { id: 'workshop-grain', label: '看木盒上的旧划痕', x: 56, y: 59, text: '盒盖的划痕绕过了中央的叶纹。周予说不是每一道痕迹都需要磨掉，有些地方留下来，主人一摸就认得。' },
    { id: 'workshop-cup', label: '递过工具旁的茶杯', x: 24, y: 58, clue: 'zhou', text: '茶已经不烫了。周予把剩下的一小片芝麻面包收进纸袋：“我喜欢边烤得脆一点，做完活配茶吃，不沾手。”你记下了他的习惯。' },
  ] },
  { id: 'shore', name: '洗衣店外的海堤', subtitle: '把眼睛从近处移向远处', art: '/art/film-shore.webp', description: '洗衣机隔着门转动。海水退下去，台阶边露出几枚平整的贝壳。', hotspots: [
    { id: 'shore-shell', label: '拾起退潮留下的贝壳', x: 53, y: 76, text: '你挑了一枚没有缺口的小白贝，擦去砂粒，把其余的留在原处。这一枚可以放在家里的窗边，提醒自己屋外还有海。' },
    { id: 'shore-tide', label: '听一会儿浪声', x: 78, y: 48, text: '船尾的一道白浪散开，后面又来了一道。你没有需要立刻作答的问题，也没有错过什么；回去之前，坐多久都可以。' },
  ] },
];

export const TOWN_PEOPLE = [
  { id: 'lin', name: '林姨', place: 'bakery', role: '有光面包房的店主', color: '#bd8969', preference: '柔软一点的牛奶面包', recipe: 'milk' },
  { id: 'he', name: '阿禾', place: 'bookshop', role: '正在准备一次远行的书店店员', color: '#aa8e9b', preference: '带着果香的小面包', recipe: 'fruit' },
  { id: 'zhou', name: '周予', place: 'workshop', role: '巷子里的旧物修补师', color: '#8a9a7c', preference: '边缘脆些的芝麻面包', recipe: 'sesame' },
];
export const TOWN_RECIPES = [
  { id: 'milk', name: '牛奶面包', description: '淡淡奶香，火轻一些会更柔软。', ingredients: [{ id: 'flour', label: '面粉' }, { id: 'milk', label: '温牛奶' }] },
  { id: 'fruit', name: '果干面包', description: '揉进一小把果干，慢慢嚼会有甜味。', ingredients: [{ id: 'flour', label: '面粉与温水' }, { id: 'fruit', label: '切好的果干' }] },
  { id: 'sesame', name: '芝麻面包', description: '烘得深些，边缘会带一点脆香。', ingredients: [{ id: 'flour', label: '面粉与温水' }, { id: 'sesame', label: '炒香的芝麻' }] },
];
export const TOWN_SHAPES = [
  { id: 'round', name: '小圆包', description: '握在手里刚刚好。' },
  { id: 'twist', name: '双股辫', description: '分成两条，慢慢交在一起。' },
  { id: 'leaf', name: '叶子形', description: '留下像叶脉一样的割纹。' },
];
export const TOWN_DECORATIONS = [
  { id: 'flower', name: '一盆小花', description: '明天回来时，会多一片新叶。' },
  { id: 'shell', name: '海边的小白贝', description: '海堤上拾来的那一枚。', hotspot: 'shore-shell' },
  { id: 'book', name: '借来的短篇集', description: '还没读完的那一页，可以明天接着读。', hotspot: 'book-margin' },
  { id: 'basket', name: '装面包的纸袋', description: '为自己留一点，也能给人带一点。', hotspot: 'bakery-recipe' },
];
export const TOWN_SLOTS = [
  { id: 'window', name: '窗台', x: 68, y: 50 },
  { id: 'desk', name: '木桌', x: 35, y: 63 },
  { id: 'door', name: '门边', x: 86, y: 70 },
];

const DIALOGUES = {
  lin: [
    { line: '林姨把抹布搭在水池边：“手腕这阵子有点酸。早上忙着给客人装袋，自己倒还没吃上。”', choices: [
      { id: 'share', text: '今天试做的第一只，给你留着', response: '“那我可要坐下来好好吃。”她没有再把话岔回客人的订单，先给自己倒了杯热水。', tomorrow: '林姨把热水放在桌上：“昨天听了你的，今天先坐着吃完早饭再开门。差那五分钟，客人也等得。”' },
      { id: 'ask', text: '问问她的手腕，今天什么活可以少做一点', response: '她看了一眼高处的空烤盘：“那一摞今天先不搬。总觉得该做完，倒没想过可以留到明天。”', tomorrow: '高处的烤盘仍在原位。林姨说：“昨天那件事，我真留着没做。手腕轻松一点了。”' },
    ] },
    { line: '林姨在门外翻过营业牌：“今天开门前，我想先把这张旧食谱抄清楚。字小，看着费眼。”', choices: [
      { id: 'copy', text: '替她把用量抄大一些', response: '你把“牛奶”两个字写得很开。林姨把纸靠近看了看：“这下不用一边揉面一边找眼镜了。”', tomorrow: '林姨把抄好的食谱贴到炉边。最常用的几行写得很大，她抬眼就能看见。' },
      { id: 'learn', text: '请她讲讲这张食谱从哪里来', response: '“刚开店那会儿，试坏了好几炉才记下来的。”她翻过纸背，上面还有当年算过的成本。', tomorrow: '旧食谱多了一个透明纸套。林姨说起昨天翻到的旧账，顺手把最早的一行配方指给你看。' },
    ] },
    { line: '门口的风铃响了一下。林姨看见你，已经不用再问名字：“还是老地方坐？今天可以慢慢吃。”', choices: [
      { id: 'sit', text: '坐下，把今天的面包分成两半', response: '她把小盘子推近一些。你们一人拿了一半，等门外的脚步经过，也没有急着填满沉默。' },
      { id: 'promise', text: '告诉她，之后路过还会进来坐坐', response: '“行。忙的时候递个纸袋，闲的时候喝杯水。”她说得很平常，像在商量一件做得到的事。' },
    ] },
  ],
  he: [
    { line: '阿禾把一张车票夹进书里：“想出去走走，可是店里的班还没排开。我在想，要不要把出发日期往后挪一点。”', choices: [
      { id: 'route', text: '请她讲讲最想去的地方', response: '她摊开地图，没有先说景点，而是圈了一条靠海的小路：“这段想用脚走，走累了就停。”', tomorrow: '阿禾把那条小路单独画在便笺上：“昨天讲给你听以后，路线倒清楚了。想走的地方不多，慢慢来得及。”' },
      { id: 'time', text: '陪她把休息和排班一项项写下来', response: '你们把能换的半天圈出来，留下不能动的部分。她呼了口气：“原来只差一次好好开口。”', tomorrow: '阿禾指着改过的排班表：“问过了，同事愿意换那半天。昨天写下来以后，开口容易多了。”' },
    ] },
    { line: '她在桌边留了一本短篇集：“有一篇想推荐给你。不过要是你这阵子不想读长东西，也可以只看一页。”', choices: [
      { id: 'borrow', text: '借回去，想读的时候再翻开', response: '她在借书卡上写下你的名字：“不设今天必须读几页。等你想聊的时候，再说。”', tomorrow: '阿禾还记得你借了书：“读到哪里都行。那张借书卡，我给你夹在靠窗的抽屉里了。”' },
      { id: 'listen', text: '请她先讲讲为什么喜欢这一篇', response: '“里面的人终于允许自己改变主意。”她把书合上，“我想把这句话带到路上。”', tomorrow: '阿禾把昨天提过的那句话写进旅行本：“我也可以改变主意。不走满所有地方，也算出门了。”' },
    ] },
    { line: '阿禾收好旅行本，给窗边的座位换了一张干净垫子：“出门前还得值几天班。要是你来，坐这里看海。”', choices: [
      { id: 'postcard', text: '约好等她寄一张路上的明信片', response: '“就寄普通邮票那种，路上想到什么写什么。”她把你的地址抄在本子里，旁边留了很宽的一行。' },
      { id: 'window', text: '说这扇窗会替她留着小镇的天气', response: '她笑了：“那我回来也坐这里。到时候交换天气。”窗外有人推车经过，书页被风掀起一角。' },
    ] },
  ],
  zhou: [
    { line: '周予把一把旧椅子转了半圈：“主人想把划痕都磨掉。可这块木头已经薄了，再磨就容易松。”', choices: [
      { id: 'keep', text: '问问能不能留下划痕，只把受力处修稳', response: '他点头，把需要加固的地方画出来：“先让人坐得放心，痕迹的事可以和主人慢慢说。”', tomorrow: '那把椅子已经加固。周予说主人愿意留下划痕，还指出一道小时候搬家留下的印子。' },
      { id: 'explain', text: '陪他想一句能说清楚情况的话', response: '你们把“不能修”改成“这样修还能陪你用”。他说：“先把能做的讲清，对方也好决定。”', tomorrow: '周予把写过的纸留在工具箱上：“照昨天说的讲了，主人听明白了，没有勉强磨掉那一层。”' },
    ] },
    { line: '周予把工具往里面挪一点：“想试试吗？先摸摸木纹，不动刀。知道它往哪儿长，手就不用硬推。”', choices: [
      { id: 'touch', text: '沿着木纹，慢慢摸过那块木头', response: '顺着的方向平一些，反过来便有细细的阻力。周予让你停在那里：“今天认出这个，就够了。”', tomorrow: '周予把昨天那块木头留在手边：“今天再摸摸。手记得住，比我说十遍有用。”' },
      { id: 'watch', text: '先坐在旁边，看他修完这一步', response: '他放慢了一点，让你看清夹具怎样固定：“坐着看也算学，不一定马上就得上手。”', tomorrow: '桌边的椅子留着。周予给你指了昨天没有做完的那一步，先等胶干透，再往下继续。' },
    ] },
    { line: '修好的椅子已经被取走，桌上腾出一小块空处。周予说：“有空来坐。带点木屑回去也没关系，扫得掉。”', choices: [
      { id: 'return', text: '记下下一次想学的小修补', response: '你说起屋里有些松的抽屉把手。他先问螺丝的样子，约好改天带来一起看，不急着替你做完。' },
      { id: 'tea', text: '把茶杯挪到桌边，陪他歇一会儿', response: '他放下手里的砂纸，把木屑扫开。茶已经不烫，刚好一口一口喝。' },
    ] },
  ],
};

const own = (value,key) => value && typeof value === 'object' && !Array.isArray(value) && Object.hasOwn(value,key);
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const ids = values => new Set(values.map(value=>value.id));
const placeIds=ids(TOWN_PLACES), peopleIds=ids(TOWN_PEOPLE), recipeIds=ids(TOWN_RECIPES), shapeIds=ids(TOWN_SHAPES), decorationIds=ids(TOWN_DECORATIONS), slotIds=ids(TOWN_SLOTS);
const allHotspots=TOWN_PLACES.flatMap(place=>place.hotspots);
const hotspotIds=ids(allHotspots);
const unique = values => [...new Set(values)];
const bounded = (value,min,max,fallback=min) => Number.isFinite(value) ? Math.max(min,Math.min(max,Math.round(value))) : fallback;
const safeText = (text,max=40) => typeof text==='string' ? Array.from(text.replace(/[\u0000-\u001f\u007f]/g,'').trim()).slice(0,max).join('') : '';
const initialCraft = () => ({recipe:'milk',shape:'round',heat:180,ingredients:[],kneads:0,baked:false});
function textureFor(heat) { return heat<170?'pale':heat<=185?'soft':heat<=200?'crisp':'toasty'; }
const textureNames={pale:'浅色柔软',soft:'松软',crisp:'脆边',toasty:'焦香'};
function breadFrom(value,day,serial) {
  if(!object(value)||!/^bread-[1-9]\d{0,3}$/.test(value.id)||Number(value.id.slice(6))>serial||!recipeIds.has(value.recipe)||!shapeIds.has(value.shape)||!Number.isInteger(value.day)||value.day<1||value.day>day||!Number.isInteger(value.heat)||value.heat<150||value.heat>210)return null;
  const recipe=TOWN_RECIPES.find(item=>item.id===value.recipe);
  const shape=TOWN_SHAPES.find(item=>item.id===value.shape);
  const texture=textureFor(value.heat);
  return {id:value.id,day:value.day,recipe:value.recipe,shape:value.shape,heat:value.heat,texture,name:`${textureNames[texture]}的${recipe.name} · ${shape.name}`};
}
function matchedGift(person,bread) {
  return person.recipe===bread.recipe&&(person.id!=='lin'||['pale','soft'].includes(bread.texture))&&(person.id!=='zhou'||['crisp','toasty'].includes(bread.texture));
}
function responseForGift(person,bread) {
  const matched=matchedGift(person,bread);
  const openings={
    lin:matched?'林姨掰开面包，松软的内里慢慢弹回来：“正好是我想吃的那种。你还记得。”':'林姨接过纸袋，先给自己摆好盘子：“你做的这一只，今天就坐下来尝尝。”',
    he:matched?'阿禾闻到果香，把书签夹好：“这味道真适合带在路上。你连这种小事也记住了。”':'阿禾挪开地图，替这只面包留出位置：“路线可以晚点画，先吃你带来的这一只。”',
    zhou:matched?'周予咬到脆脆的芝麻边，停了一下：“是我喜欢的。正好，做完这一步就泡茶。”':'周予把工具放回原位，认真洗了手：“多谢你想着我。先放下活，尝尝这一只。”',
  };
  const textures={pale:'颜色浅一些，切开能闻到淡淡的麦香。',soft:'他没有急着吃完，把松软的一角慢慢掰开。',crisp:'边缘发出轻轻的脆响，碎屑落在纸袋里。',toasty:'烤得深一些，带着浓一点的焦香；切成薄片配茶正合适。'};
  let detail=textures[bread.texture];
  if(bread.texture==='soft'&&person.id!=='zhou')detail='柔软的一角被慢慢掰开，余下的仍仔细留在纸袋里。';
  if(bread.shape==='leaf')detail+='那道像叶脉的割纹被多看了一眼。';
  if(bread.shape==='twist')detail+='两股交织的面包可以慢慢撕开，分给身边的人。';
  return openings[person.id]+detail;
}
function decorationUnlocked(state,itemId) {
  const item=TOWN_DECORATIONS.find(item=>item.id===itemId);
  return Boolean(item&&(!item.hotspot||state.explored.includes(item.hotspot)));
}
function completionHints(state) {
  const hints=[];
  if(state.day<3)hints.push('等到第三天，再把这段日子收好');
  if(state.explored.length<3)hints.push('在画里发现三件小事');
  if(Object.keys(state.talks).length<2)hints.push('和居民好好说上两次话');
  if(state.gifts.length<1)hints.push('把亲手烤的一只面包送给居民');
  if(!state.decoratedSlots.length)hints.push('给屋里留下一处自己的布置');
  return hints;
}

export function normalizeTownDay(value) {
  const saved=object(value)?value:{};
  const day=Number.isInteger(saved.day)&&saved.day>=1&&saved.day<=3?saved.day:1;
  const serial=bounded(saved.serial,0,9999,0);
  const explored=Array.isArray(saved.explored)?unique(saved.explored.filter(id=>hotspotIds.has(id))):[];
  const state={version:1,day,place:placeIds.has(saved.place)?saved.place:'room',explored,talks:{},gifts:[],craft:initialCraft(),breads:[],decor:{window:null,desk:null,door:null},card:safeText(saved.card),completed:false,serial,decoratedSlots:[],lastSnack:null,flowerPlantedDay:null};
  if(object(saved.talks))for(let d=1;d<=day;d++)for(const person of TOWN_PEOPLE){
    const key=`${d}:${person.id}`;
    if(own(saved.talks,key)&&DIALOGUES[person.id][d-1].choices.some(choice=>choice.id===saved.talks[key]))state.talks[key]=saved.talks[key];
  }
  const giftKeys=new Set(),usedBread=new Set();
  if(Array.isArray(saved.gifts))for(const value of saved.gifts.slice(0,30)){
    if(!object(value)||!peopleIds.has(value.person)||!Number.isInteger(value.day)||value.day<1||value.day>day)continue;
    const bread=breadFrom({...value,id:value.breadId},day,serial),key=`${value.day}:${value.person}`;
    if(!bread||bread.day>value.day||giftKeys.has(key)||usedBread.has(bread.id))continue;
    giftKeys.add(key);usedBread.add(bread.id);
    const person=TOWN_PEOPLE.find(item=>item.id===value.person);
    state.gifts.push({day:value.day,person:value.person,breadId:bread.id,recipe:bread.recipe,shape:bread.shape,heat:bread.heat,texture:bread.texture,matched:matchedGift(person,bread),response:responseForGift(person,bread)});
  }
  if(Array.isArray(saved.breads))for(const value of saved.breads.slice(0,30)){
    const bread=breadFrom(value,day,serial);
    if(!bread||usedBread.has(bread.id))continue;
    usedBread.add(bread.id);state.breads.push(bread);
    if(state.breads.length>=6)break;
  }
  if(object(saved.craft)){
    const craft=saved.craft,recipe=TOWN_RECIPES.find(item=>item.id===craft.recipe)||TOWN_RECIPES[0];
    const ingredients=Array.isArray(craft.ingredients)?unique(craft.ingredients.filter(id=>recipe.ingredients.some(item=>item.id===id))):[];
    const kneads=ingredients.length===recipe.ingredients.length?bounded(craft.kneads,0,3):0;
    state.craft={recipe:recipe.id,shape:shapeIds.has(craft.shape)?craft.shape:'round',heat:bounded(craft.heat,150,210,180),ingredients,kneads,baked:craft.baked===true&&kneads===3&&serial>0};
  }
  const placedItems=new Set();
  if(object(saved.decor))for(const slot of TOWN_SLOTS){
    const item=saved.decor[slot.id];
    if(object(item)&&decorationIds.has(item.item)&&!placedItems.has(item.item)&&decorationUnlocked(state,item.item)){state.decor[slot.id]={item:item.item,placedDay:bounded(item.placedDay,1,day,day)};placedItems.add(item.item);}
  }
  const placedFlower=Object.values(state.decor).find(item=>item?.item==='flower');
  const savedFlowerDay=Number.isInteger(saved.flowerPlantedDay)&&saved.flowerPlantedDay>=1&&saved.flowerPlantedDay<=day?saved.flowerPlantedDay:null;
  state.flowerPlantedDay=savedFlowerDay===null?(placedFlower?.placedDay||null):Math.min(savedFlowerDay,placedFlower?.placedDay||day);
  if(placedFlower)placedFlower.placedDay=state.flowerPlantedDay;
  state.decoratedSlots=unique([...(Array.isArray(saved.decoratedSlots)?saved.decoratedSlots.filter(id=>slotIds.has(id)):[]),...TOWN_SLOTS.filter(slot=>state.decor[slot.id]).map(slot=>slot.id)]);
  if(object(saved.lastSnack)){const snack=breadFrom(saved.lastSnack,day,serial);if(snack&&!usedBread.has(snack.id))state.lastSnack={...snack,eatenDay:bounded(saved.lastSnack.eatenDay,snack.day,day,day)};}
  state.completed=saved.completed===true&&completionHints(state).length===0;
  return state;
}
export function townProgress(game) { return normalizeTownDay(game?.townDay); }
export function townStage(craft) {
  if(craft?.baked)return 'done';
  const recipe=TOWN_RECIPES.find(item=>item.id===craft?.recipe)||TOWN_RECIPES[0];
  if((craft?.ingredients?.length||0)<recipe.ingredients.length)return 'ingredients';
  return craft.kneads<3?'knead':'bake';
}
export function townDecorationUnlocked(game,itemId) {return decorationUnlocked(townProgress(game),itemId);}

export function townDialogue(game,personId) {
  if(!peopleIds.has(personId))return null;
  const state=townProgress(game),person=TOWN_PEOPLE.find(item=>item.id===personId),current=DIALOGUES[personId][state.day-1];
  const previous=state.day>1?DIALOGUES[personId][state.day-2].choices.find(choice=>choice.id===state.talks[`${state.day-1}:${personId}`]):null;
  const recalledGift=[...state.gifts].reverse().find(gift=>gift.person===personId&&gift.day<state.day)||null;
  const recalled=recalledGift?`${recalledGift.day===state.day-1?'昨天':'前天'}你送来的${TOWN_RECIPES.find(item=>item.id===recalledGift.recipe).name}，${person.name}还记得。${recalledGift.matched?'“你记得我的口味，我很高兴。”':'“收到别人惦记的一份，做事时也会想起来。”'}`:'';
  const selected=state.talks[`${state.day}:${personId}`]||null;
  const metBefore=Object.keys(state.talks).some(key=>key.endsWith(':'+personId)&&Number(key.split(':')[0])<state.day)||Boolean(recalledGift);
  const firstGreetings={
    lin:'炉门合上后，店主擦了擦手，问你怎么称呼。“叫我林姨就行。要不要在窗边坐坐？”她把一只干净的小盘子放到空位上。',
    he:'书店店员从归还的书后面抬起头：“我叫阿禾。想找什么书，还是想坐一会儿？”她挪开桌上的旅行本，给你留了一块放东西的地方。',
    zhou:'修补师先把手里的夹具放稳，才转过来：“我是周予。屋里有木屑，进来时小心。”他问了你的名字，把桌边的椅子往外拉了一点。',
  };
  const line=state.day>1&&!metBefore?firstGreetings[personId]:current.line;
  return {person,day:state.day,line:[recalled,previous?.tomorrow,line].filter(Boolean).join('\n\n'),choices:current.choices.map(choice=>({id:choice.id,text:choice.text,response:choice.response})),selected,response:current.choices.find(choice=>choice.id===selected)?.response||'',recalledGift};
}

export function townJournal(game) {
  const state=townProgress(game),entries=[];
  for(const hotspot of allHotspots)if(state.explored.includes(hotspot.id))entries.push({id:'explore:'+hotspot.id,title:hotspot.label,text:hotspot.text});
  for(const person of TOWN_PEOPLE)for(let day=1;day<=state.day;day++){
    const choice=DIALOGUES[person.id][day-1].choices.find(item=>item.id===state.talks[`${day}:${person.id}`]);
    if(choice)entries.push({id:`talk:${day}:${person.id}`,title:`第${day}天 · 与${person.name}说的话`,text:choice.text+'。'+choice.response});
  }
  for(const gift of state.gifts)entries.push({id:'gift:'+gift.breadId,title:`第${gift.day}天 · 给${TOWN_PEOPLE.find(item=>item.id===gift.person).name}的面包`,text:gift.response});
  if(state.lastSnack)entries.push({id:'snack:'+state.lastSnack.id,title:`第${state.lastSnack.eatenDay}天 · 给自己留的一只`,text:`你把${state.lastSnack.name}留给自己。坐下来吃完这一份，也算认真照顾了今天。`});
  const people=TOWN_PEOPLE.map(person=>{
    const conversations=Object.keys(state.talks).filter(key=>key.endsWith(':'+person.id)).length;
    const gifts=state.gifts.filter(gift=>gift.person===person.id);
    const clue=allHotspots.find(h=>h.clue===person.id&&state.explored.includes(h.id));
    return {id:person.id,name:person.name,label:gifts.length?'会记得你带来的那一只':conversations>1?'聊过的事，隔天还记得':conversations?'已经能自然地坐下说话':'还没有好好聊过',text:clue?`你发现了：${person.preference}。`:conversations?'还有一些习惯，等着你慢慢发现。':'路过时，可以先打个招呼。'};
  });
  const decorations=TOWN_SLOTS.filter(slot=>state.decor[slot.id]).map(slot=>{
    const placed=state.decor[slot.id],age=state.day-placed.placedDay;
    const item=TOWN_DECORATIONS.find(item=>item.id===placed.item);
    return {slot:slot.id,item:item.id,age,label:item.id==='flower'?(age>=2?'小花已经舒展开花瓣':age===1?'小花长出了一片新叶':'刚放好的小花，叶上还留着水光'):item.name};
  });
  const hints=completionHints(state);
  return {title:'初秋，镇上的三天',summary:state.completed?'这一段日子已经收好。想再去走走时，小镇仍在这里。':`第${state.day}天。初来时的回忆可以慢慢过，主线人生会等你回来。`,entries,people,decorations,completionReady:hints.length===0,completionHints:hints};
}

export function performTownAction(game,action) {
  if(!object(game)||!object(action)||typeof action.type!=='string')return game;
  const state=townProgress(game);
  let next=null;
  switch(action.type){
    case 'visit':
      if(!placeIds.has(action.place)||action.place===state.place)return game;
      next={...state,place:action.place};break;
    case 'explore':{
      const place=TOWN_PLACES.find(item=>item.id===state.place);
      if(!place.hotspots.some(item=>item.id===action.hotspot)||state.explored.includes(action.hotspot))return game;
      next={...state,explored:[...state.explored,action.hotspot]};break;
    }
    case 'talk':{
      const person=TOWN_PEOPLE.find(item=>item.id===action.person);
      if(!person||person.place!==state.place||own(state.talks,`${state.day}:${person.id}`))return game;
      const dialogue=DIALOGUES[person.id][state.day-1];
      if(!dialogue.choices.some(choice=>choice.id===action.reply))return game;
      next={...state,talks:{...state.talks,[`${state.day}:${person.id}`]:action.reply}};break;
    }
    case 'recipe':
      if(state.place!=='bakery'||!recipeIds.has(action.value)||(state.craft.recipe===action.value&&!state.craft.baked))return game;
      next={...state,craft:{...initialCraft(),recipe:action.value}};break;
    case 'shape':
      if(state.place!=='bakery'||!shapeIds.has(action.value)||state.craft.baked||state.craft.shape===action.value)return game;
      next={...state,craft:{...state.craft,shape:action.value}};break;
    case 'ingredient':{
      const recipe=TOWN_RECIPES.find(item=>item.id===state.craft.recipe);
      if(state.place!=='bakery'||state.craft.baked||!recipe.ingredients.some(item=>item.id===action.ingredient)||state.craft.ingredients.includes(action.ingredient))return game;
      next={...state,craft:{...state.craft,ingredients:[...state.craft.ingredients,action.ingredient]}};break;
    }
    case 'knead':
      if(state.place!=='bakery'||townStage(state.craft)!=='knead')return game;
      next={...state,craft:{...state.craft,kneads:state.craft.kneads+1}};break;
    case 'heat':{
      if(state.place!=='bakery'||townStage(state.craft)!=='bake'||!Number.isFinite(action.value)||action.value<150||action.value>210)return game;
      const heat=Math.round(action.value);
      if(heat===state.craft.heat)return game;
      next={...state,craft:{...state.craft,heat}};break;
    }
    case 'bake':{
      if(state.place!=='bakery'||townStage(state.craft)!=='bake'||state.breads.length>=6||state.serial>=9999)return game;
      const serial=state.serial+1;
      const bread=breadFrom({id:'bread-'+serial,day:state.day,recipe:state.craft.recipe,shape:state.craft.shape,heat:state.craft.heat},state.day,serial);
      next={...state,serial,craft:{...state.craft,baked:true},breads:[...state.breads,bread]};break;
    }
    case 'new_batch':
      if(state.place!=='bakery'||(townStage(state.craft)==='ingredients'&&state.craft.ingredients.length===0))return game;
      next={...state,craft:{...initialCraft(),recipe:state.craft.recipe}};break;
    case 'gift':{
      const person=TOWN_PEOPLE.find(item=>item.id===action.person),bread=state.breads.find(item=>item.id===action.breadId);
      if(!person||person.place!==state.place||!bread||state.gifts.some(gift=>gift.day===state.day&&gift.person===person.id))return game;
      const gift={day:state.day,person:person.id,breadId:bread.id,recipe:bread.recipe,shape:bread.shape,heat:bread.heat,texture:bread.texture,matched:matchedGift(person,bread),response:responseForGift(person,bread)};
      next={...state,breads:state.breads.filter(item=>item.id!==bread.id),gifts:[...state.gifts,gift]};break;
    }
    case 'eat':{
      const bread=state.breads.find(item=>item.id===action.breadId);
      if(!bread)return game;
      next={...state,breads:state.breads.filter(item=>item.id!==bread.id),lastSnack:{...bread,eatenDay:state.day}};break;
    }
    case 'decorate':{
      if(state.place!=='room'||!slotIds.has(action.slot)||(action.item!==null&&!decorationUnlocked(state,action.item)))return game;
      const previous=state.decor[action.slot];
      if((previous?.item||null)===action.item)return game;
      const earlier=Object.values(state.decor).find(item=>item?.item===action.item);
      const decor={...state.decor};
      for(const slot of TOWN_SLOTS)if(decor[slot.id]?.item===action.item)decor[slot.id]=null;
      const plantedDay=state.flowerPlantedDay||(action.item==='flower'?state.day:null);
      decor[action.slot]=action.item===null?null:{item:action.item,placedDay:action.item==='flower'?plantedDay:earlier?.placedDay||state.day};
      next={...state,decor,flowerPlantedDay:plantedDay,decoratedSlots:action.item===null?state.decoratedSlots:unique([...state.decoratedSlots,action.slot])};break;
    }
    case 'card':{
      if(state.place!=='room'||typeof action.text!=='string')return game;
      const card=safeText(action.text);
      if(card===state.card)return game;
      next={...state,card};break;
    }
    case 'rest':
      if(state.place!=='room'||state.day>=3||state.completed)return game;
      next={...state,day:state.day+1};break;
    case 'finish':
      if(state.place!=='room'||state.completed||completionHints(state).length)return game;
      next={...state,completed:true};break;
    default:return game;
  }
  const memories=action.type==='finish'&&!game.memories?.some(memory=>memory.id===TOWN_MEMORY.id)?[...(game.memories||[]),{...TOWN_MEMORY}]:game.memories;
  return {...game,townDay:next,...(memories!==game.memories?{memories}:{})};
}
