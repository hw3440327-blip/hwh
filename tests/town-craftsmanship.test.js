import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,finishIntroduction,restoreGame,serializeGame} from '../src/engine.js';
import {performTownAction,townProgress,normalizeTownDay,TOWN_SLOTS,townJournal} from '../src/townDay.js';
const start=()=>finishIntroduction(createGame('小晴','pause'),{name:'小晴',origin:'pause'});
const act=(g,type,rest={})=>performTownAction(g,{type,...rest});

test('小屋的摆放贴合可用台面，移动不复制物件，清理非法尺寸与旧存档',()=>{
  let g=act(start(),'decorate',{slot:'window',item:'flower'});
  g=act(g,'arrange',{slot:'window',x:500,scale:99,rotation:-90});
  const s=townProgress(g),slot=TOWN_SLOTS.find(s=>s.id==='window');
  assert.equal(s.decor.window.x,slot.maxX);assert.equal(s.decor.window.scale,1.2);assert.equal(s.decor.window.rotation,-12);
  g=act(g,'decorate',{slot:'desk',item:'flower'});
  assert.equal(townProgress(g).decor.window,null);assert.equal(townProgress(g).decor.desk.placedDay,1);
  const old=normalizeTownDay({decor:{window:{item:'flower',placedDay:1}},home:{window:NaN},reading:{page:Infinity}});
  assert.equal(old.decor.window.x,slot.x);assert.equal(old.home.window,.65);assert.equal(old.reading.page,0);
  assert.deepEqual(townProgress(restoreGame(serializeGame(g))),townProgress(g));
});

test('书签留在选定书的真实页码，换书不伪造新书的阅读记录',()=>{
  const g=start();assert.equal(act(g,'reading',{keep:true}),g);
  let next=act(g,'visit',{place:'bookshop'});
  next=act(next,'reading',{book:'garden',page:2,mark:1,keep:true,quote:'今天也有一片新叶。'});
  const marked=townProgress(next).reading;
  assert.equal(marked.keptBook,'garden');assert.equal(marked.keptPage,2);assert.equal(marked.mark,1);
  next=act(next,'reading',{book:'letters'});assert.equal(townProgress(next).reading.page,0);
  next=act(next,'reading',{book:'garden'});assert.equal(townProgress(next).reading.page,2);
  assert.ok(townProgress(next).explored.includes('book-margin'));
  const restored=restoreGame(serializeGame(next));assert.deepEqual(townProgress(restored).reading,townProgress(next).reading);
  assert.ok(townJournal(restored).entries.some(e=>e.id==='reading:bookmark'));
});

test('海边只记录完成的投石，沙上的话和潮水结果随旅程保存，不推进主线',()=>{
  let g=start();assert.equal(act(g,'shore_cast',{skips:3}),g);
  g=act(g,'visit',{place:'shore'});assert.equal(act(g,'shore_cast',{skips:7}),g);
  const story=JSON.stringify({scene:g.sceneId,money:g.money,energy:g.energy,age:g.age,history:g.history});
  g=act(g,'shore_stone',{stone:'heart'});g=act(g,'shore_cast',{skips:2});g=act(g,'shore_words',{text:'留在今天，慢慢来。'});g=act(g,'shore_wash');
  const restored=restoreGame(serializeGame(g));assert.equal(townProgress(restored).shore.casts,1);assert.equal(townProgress(restored).shore.washed,true);
  assert.equal(JSON.stringify({scene:g.sceneId,money:g.money,energy:g.energy,age:g.age,history:g.history}),story);
  assert.ok(townJournal(g).entries.some(e=>e.id==='shore:stones'));
});
