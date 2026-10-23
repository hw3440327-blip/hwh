import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, finishIntroduction, restoreGame, serializeGame, availableChoices, choose, reincarnate } from '../src/engine.js';
import { TOWN_MEMORY, TOWN_PLACES, TOWN_PEOPLE, TOWN_RECIPES, TOWN_SLOTS, normalizeTownDay, townProgress, townStage, townDialogue, townJournal, townDecorationUnlocked, performTownAction } from '../src/townDay.js';

const act=(game,type,fields={})=>performTownAction(game,{type,...fields});
const visit=(game,place)=>act(game,'visit',{place});
const start=()=>finishIntroduction(createGame('小满'),{name:'小满',origin:'pause'});
function bake(game,{recipe='milk',shape='round',heat=180}={}){
  let next=visit(game,'bakery');
  if(townProgress(next).craft.baked||townProgress(next).craft.ingredients.length)next=act(next,'new_batch');
  next=act(next,'recipe',{value:recipe});
  next=act(next,'shape',{value:shape});
  for(const ingredient of TOWN_RECIPES.find(item=>item.id===recipe).ingredients)next=act(next,'ingredient',{ingredient:ingredient.id});
  for(let i=0;i<3;i++)next=act(next,'knead');
  next=act(next,'heat',{value:heat});
  return act(next,'bake');
}
function livedDay(initial=start()){
  let game=initial;
  game=act(game,'explore',{hotspot:'room-window'});
  game=act(game,'decorate',{slot:'window',item:'flower'});
  game=act(game,'card',{text:'给明天留一扇开着的窗'});
  game=visit(game,'bakery');
  game=act(game,'explore',{hotspot:'bakery-recipe'});
  game=act(game,'talk',{person:'lin',reply:'share'});
  game=bake(game,{recipe:'milk',shape:'leaf',heat:175});
  const bread=townProgress(game).breads.at(-1);
  game=act(game,'gift',{person:'lin',breadId:bread.id});
  game=visit(game,'bookshop');
  game=act(game,'explore',{hotspot:'book-margin'});
  game=act(game,'talk',{person:'he',reply:'route'});
  return visit(game,'room');
}
function completed(){
  let game=livedDay();
  game=act(game,'rest');
  game=act(game,'rest');
  return act(game,'finish');
}
function ending(){
  const queue=[start()],seen=new Set();
  for(let i=0;i<queue.length;i++){
    const game=queue[i];
    if(game.sceneId==='farewell_bakery')return game;
    const key=game.sceneId+':'+game.flags.slice().sort().join(',');
    if(seen.has(key))continue;
    seen.add(key);
    queue.push(...availableChoices(game).map(choice=>choose(game,choice.id)));
  }
  assert.fail('Ending is unreachable');
}

test('探索线索、定制面包、赠礼和布置构成连续经历，第二天居民和屋里都有回应',()=>{
  const original=start();let game=livedDay(original),state=townProgress(game);
  assert.equal(state.gifts[0].matched,true);
  assert.match(state.gifts[0].response,/你还记得/);
  assert.match(state.gifts[0].response,/叶脉/);
  assert.equal(state.breads.length,0);
  assert.equal(townDecorationUnlocked(game,'book'),true);
  assert.match(townJournal(game).people.find(person=>person.id==='lin').text,/牛奶面包/);
  game=act(game,'rest');state=townProgress(game);
  const dialogue=townDialogue(game,'lin');
  assert.match(dialogue.line,/昨天你送来的牛奶面包/);
  assert.match(dialogue.line,/先坐着吃完早饭再开门/);
  assert.equal(dialogue.recalledGift.breadId,'bread-1');
  assert.equal(townJournal(game).decorations[0].age,1);
  assert.match(townJournal(game).decorations[0].label,/新叶/);
  assert.equal(state.card,'给明天留一扇开着的窗');
  for(const key of ['sceneId','history','visited','money','energy','connection','flags','startedAt'])assert.deepEqual(game[key],original[key],key);
});

test('对话选择留下不同的次日结果，每人每天只能回答一次',()=>{
  let first=visit(start(),'bakery'),second=first;
  first=act(first,'talk',{person:'lin',reply:'share'});
  assert.equal(act(first,'talk',{person:'lin',reply:'ask'}),first);
  second=act(second,'talk',{person:'lin',reply:'ask'});
  first=act(visit(first,'room'),'rest');second=act(visit(second,'room'),'rest');
  assert.match(townDialogue(first,'lin').line,/先坐着吃完早饭/);
  assert.match(townDialogue(second,'lin').line,/烤盘仍在原位/);
  assert.notEqual(townDialogue(first,'lin').line,townDialogue(second,'lin').line);
  assert.equal(townDialogue(first,'he').recalledGift,null);
  assert.equal(townDialogue(first,'unknown'),null);
});

test('制作需要原料与揉面；任何合法炉火都能做成，不靠失败或资源扣除施压',()=>{
  let game=visit(start(),'bakery');
  assert.equal(act(game,'bake'),game);
  assert.equal(act(game,'knead'),game);
  game=act(game,'ingredient',{ingredient:'flour'});
  assert.equal(act(game,'ingredient',{ingredient:'flour'}),game);
  assert.equal(act(game,'knead'),game);
  assert.equal(act(game,'ingredient',{ingredient:'sesame'}),game);
  const pale=bake(start(),{heat:150,shape:'round'}),deep=bake(start(),{heat:210,shape:'twist'});
  assert.equal(townProgress(pale).breads[0].texture,'pale');
  assert.equal(townProgress(deep).breads[0].texture,'toasty');
  assert.match(townProgress(deep).breads[0].name,/双股辫/);
  assert.equal(townStage(townProgress(deep).craft),'done');
  assert.equal(act(deep,'bake'),deep);
  assert.equal(deep.money,start().money);
});

test('配方、口感与收礼人的偏好相关，未匹配的礼物仍有真诚回应',()=>{
  for(const [person,recipe,heat,matched] of [['lin','milk',180,true],['lin','milk',205,false],['he','fruit',190,true],['zhou','sesame',195,true],['zhou','sesame',175,false]]){
    let game=bake(start(),{recipe,heat});
    game=visit(game,TOWN_PEOPLE.find(item=>item.id===person).place);
    game=act(game,'gift',{person,breadId:townProgress(game).breads[0].id});
    assert.equal(townProgress(game).gifts[0].matched,matched,person+heat);
    assert.ok(townProgress(game).gifts[0].response.length>30);
    assert.equal(game.connection,start().connection);
  }
});

test('同一面包只能送出一次，每位居民每天收一份，无法隔空送礼',()=>{
  let game=bake(start()),bread=townProgress(game).breads[0];
  assert.equal(act(game,'gift',{person:'he',breadId:bread.id}),game);
  game=act(game,'gift',{person:'lin',breadId:bread.id});
  assert.equal(act(game,'gift',{person:'lin',breadId:bread.id}),game);
  game=bake(game,{recipe:'fruit'});bread=townProgress(game).breads[0];
  assert.equal(act(game,'gift',{person:'lin',breadId:bread.id}),game);
  game=act(visit(game,'room'),'rest');
  game=visit(game,'bakery');
  game=act(game,'gift',{person:'lin',breadId:bread.id});
  assert.equal(townProgress(game).gifts.length,2);
  assert.equal(townProgress(game).breads.length,0);
});

test('背包六只上限后可自留品尝腾出位置，不能重复吃或刷取奖励',()=>{
  let game=start();for(let i=0;i<6;i++)game=bake(game);
  assert.equal(townProgress(game).breads.length,6);
  const full=bake(game);
  assert.equal(townProgress(full).breads.length,6);
  assert.equal(townProgress(full).serial,6);
  const bread=townProgress(full).breads[0];
  game=act(full,'eat',{breadId:bread.id});
  assert.equal(townProgress(game).breads.length,5);
  assert.equal(townProgress(game).lastSnack.id,bread.id);
  assert.equal(act(game,'eat',{breadId:bread.id}),game);
  game=act(game,'bake');
  assert.equal(townProgress(game).breads.length,6);
  assert.equal(townProgress(game).serial,7);
  assert.match(townJournal(game).entries.at(-1).title,/给自己留的一只/);
  assert.deepEqual([game.energy,game.money,game.connection],[start().energy,start().money,start().connection]);
});

test('同一陈设在真实位置之间移动而不复制，花的成长不会因换位置重置',()=>{
  let game=start();
  assert.equal(act(game,'decorate',{slot:'desk',item:'shell'}),game);
  game=act(game,'decorate',{slot:'window',item:'flower'});
  assert.equal(act(game,'decorate',{slot:'window',item:'flower'}),game);
  game=act(game,'rest');
  game=act(game,'decorate',{slot:'desk',item:'flower'});
  const state=townProgress(game);
  assert.equal(state.decor.window,null);
  assert.deepEqual(state.decor.desk,{item:'flower',placedDay:1,x:TOWN_SLOTS.find(s=>s.id==='desk').x,scale:1,rotation:0});
  assert.equal(Object.values(state.decor).filter(Boolean).length,1);
  assert.equal(townJournal(game).decorations[0].age,1);
  game=visit(game,'shore');game=act(game,'explore',{hotspot:'shore-shell'});
  game=visit(game,'room');game=act(game,'decorate',{slot:'desk',item:'shell'});
  assert.equal(townProgress(game).decor.desk.item,'shell');
  assert.equal(Object.values(townProgress(game).decor).filter(Boolean).length,1);
});


test('小花收回托盘、保存恢复后再摆出，仍按第一次种下的日子成长',()=>{
  let game=act(start(),'decorate',{slot:'window',item:'flower'});
  game=act(game,'rest');
  game=act(game,'decorate',{slot:'window',item:null});
  assert.equal(townProgress(game).flowerPlantedDay,1);
  assert.equal(townJournal(game).decorations.length,0);
  game=restoreGame(serializeGame(game));
  game=act(game,'decorate',{slot:'desk',item:'flower'});
  assert.equal(townProgress(game).decor.desk.placedDay,1);
  assert.equal(townJournal(game).decorations[0].age,1);
  game=act(game,'rest');
  game=act(game,'decorate',{slot:'desk',item:null});
  game=act(game,'decorate',{slot:'door',item:'flower'});
  assert.equal(townJournal(game).decorations[0].age,2);
  assert.match(townJournal(game).decorations[0].label,/花瓣/);
  const legacy=townProgress(game);delete legacy.flowerPlantedDay;
  assert.equal(normalizeTownDay(legacy).flowerPlantedDay,1);
  assert.equal(normalizeTownDay({day:2,flowerPlantedDay:999}).flowerPlantedDay,null);
});

test('自由休息到第三天也不会假定已经相识，首次问候与旧友重逢分别呈现',()=>{
  let first=act(act(start(),'rest'),'rest');
  assert.match(townDialogue(first,'lin').line,/问你怎么称呼/);
  assert.ok(!townDialogue(first,'lin').line.includes('已经不用再问名字'));
  assert.match(townDialogue(first,'he').line,/我叫阿禾/);
  assert.match(townDialogue(first,'zhou').line,/我是周予/);
  let known=act(visit(start(),'bakery'),'talk',{person:'lin',reply:'share'});
  known=act(act(visit(known,'room'),'rest'),'rest');
  assert.match(townDialogue(known,'lin').line,/已经不用再问名字/);
  assert.match(townDialogue(known,'he').line,/我叫阿禾/);
  let gifted=bake(start());
  gifted=act(gifted,'gift',{person:'lin',breadId:townProgress(gifted).breads[0].id});
  gifted=act(act(visit(gifted,'room'),'rest'),'rest');
  assert.match(townDialogue(gifted,'lin').line,/前天你送来的牛奶面包/);
  assert.match(townDialogue(gifted,'lin').line,/已经不用再问名字/);
});

test('三天完成只增加一次相册记忆，之后仍可探索与收起陈设，完成状态不倒退',()=>{
  const early=livedDay();assert.equal(act(early,'finish'),early);
  let game=completed();assert.equal(townProgress(game).completed,true);
  assert.equal(game.memories.filter(memory=>memory.id===TOWN_MEMORY.id).length,1);
  assert.equal(act(game,'finish'),game);
  assert.equal(act(game,'rest'),game);
  game=act(game,'decorate',{slot:'window',item:null});
  assert.equal(townProgress(game).completed,true);
  assert.equal(townJournal(game).completionReady,true);
  game=visit(game,'shore');game=act(game,'explore',{hotspot:'shore-tide'});
  assert.ok(townProgress(game).explored.includes('shore-tide'));
  assert.equal(game.memories.filter(memory=>memory.id===TOWN_MEMORY.id).length,1);
});

test('完成片段与自留、布置、赠礼全部可经正式存档接口严格往返，旧版本使用完整默认状态',()=>{
  let game=completed();game=bake(game,{recipe:'fruit'});
  game=act(game,'eat',{breadId:townProgress(game).breads[0].id});
  assert.deepEqual(restoreGame(serializeGame(game)),game);
  const legacy=start();delete legacy.townDay;
  const restored=restoreGame(JSON.stringify(legacy));
  assert.deepEqual(restored.townDay,normalizeTownDay());
  assert.deepEqual([restored.sceneId,restored.history],[legacy.sceneId,legacy.history]);
  assert.deepEqual(restored.memories,legacy.memories);
  assert.deepEqual(townProgress(restored),normalizeTownDay());
});

test('恢复只保留已知地点、线索、日期与对话，不信任导入的成品名和人物回应',()=>{
  const state=normalizeTownDay({day:2,place:'javascript:',serial:3,explored:['bakery-recipe','bakery-recipe','unknown'],talks:{'1:lin':'share','2:he':'borrow','3:zhou':'tea','1:__proto__':'x'},craft:{recipe:'unknown',shape:'unknown',ingredients:['flour','milk','script'],kneads:999,heat:Infinity,baked:true},breads:[{id:'bread-2',day:2,recipe:'milk',shape:'round',heat:180,name:'<script>bad</script>'},{id:'bread-999',day:1,recipe:'milk',shape:'round',heat:180}],gifts:[{day:1,person:'lin',breadId:'bread-1',recipe:'milk',shape:'round',heat:180,response:'<script>fake</script>',matched:false},{day:1,person:'lin',breadId:'bread-3',recipe:'milk',shape:'round',heat:180}],decor:{window:{item:'flower',placedDay:-9},desk:{item:'flower',placedDay:2},door:{item:'shell',placedDay:1}},card:'a'.repeat(100),completed:true});
  assert.equal(state.place,'room');assert.deepEqual(state.explored,['bakery-recipe']);
  assert.deepEqual(state.talks,{'1:lin':'share','2:he':'borrow'});
  assert.equal(state.gifts.length,1);assert.equal(state.gifts[0].matched,true);assert.ok(!state.gifts[0].response.includes('<script>'));
  assert.equal(state.breads.length,1);assert.match(state.breads[0].name,/牛奶面包/);
  assert.equal(state.decor.window.placedDay,1);assert.equal(state.decor.desk,null);assert.equal(state.decor.door,null);
  assert.equal(state.card.length,40);assert.equal(state.completed,false);
  assert.doesNotThrow(()=>normalizeTownDay(null));
  assert.doesNotThrow(()=>normalizeTownDay({talks:[],decor:[],breads:[null,{}],gifts:[null,{}]}));
});

test('非法动作、错误地点与无前置条件不改变游戏，探索同一物件幂等',()=>{
  let game=start();
  for(const action of [{type:'explore',hotspot:'bakery-recipe'},{type:'talk',person:'lin',reply:'share'},{type:'visit',place:'__proto__'},{type:'bake'},{type:'finish'},{type:'decorate',slot:'unknown',item:'flower'},{type:'card',text:12},null])assert.equal(performTownAction(game,action),game);
  game=act(game,'explore',{hotspot:'room-window'});
  assert.equal(act(game,'explore',{hotspot:'room-window'}),game);
  assert.equal(act(game,'heat',{value:NaN}),game);
  assert.equal(act(game,'gift',{person:'lin',breadId:'bread-1'}),game);
  assert.equal(townJournal(game).completionReady,false);
  assert.ok(townJournal(game).completionHints.length>0);
});

test('开启下一生会重置初秋片段、面包和布置，只保留既有终局回响规则',()=>{
  const end=ending(),lived=completed();
  const game={...end,townDay:lived.townDay,memories:[...end.memories,TOWN_MEMORY]};
  const next=reincarnate(game);
  assert.deepEqual(next.townDay,normalizeTownDay());
  assert.ok(!next.memories.some(memory=>memory.id===TOWN_MEMORY.id));
  assert.ok(next.memories.some(memory=>memory.id===`echo:${end.sceneId}`));
});

test('五处场景与可探索物件都有唯一稳定标识，全部原画维持既有素材路径',()=>{
  assert.equal(TOWN_PLACES.length,5);
  assert.equal(new Set(TOWN_PLACES.flatMap(place=>place.hotspots.map(h=>h.id))).size,TOWN_PLACES.flatMap(place=>place.hotspots).length);
  assert.ok(TOWN_PLACES.every(place=>/^\/art\/[a-z-]+\.webp$/.test(place.art)));
  assert.equal(new Set(TOWN_PEOPLE.map(person=>person.id)).size,3);
});
