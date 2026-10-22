import { townProgress, performTownAction, TOWN_RECIPES, TOWN_SHAPES, handmadeBreadName } from './townDay.js';

export const BAKERY_MEMORY = { id:'bakery_afternoon', title:'把一个下午揉进面香里', description:'你记得掌心里逐渐柔软的面团、林姨忙完后递来的热汤，还有一张终于留下自己字迹的配方。试出来的味道，后来真的有人惦记。' };
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const number=(n,a,b,f=a)=>Number.isFinite(n)?clamp(n,a,b):f;
const object=n=>n&&typeof n==='object'&&!Array.isArray(n);
const text=n=>typeof n==='string'?Array.from(n.replace(/[\u0000-\u001f\u007f]/g,'').trim()).slice(0,24).join(''):'';
const additions=['milk','fruit','sesame'];
const cleanAdditions=n=>Array.isArray(n)?[...new Set(n.filter(x=>additions.includes(x)))]:[];
const freshBatch=()=>({flour:0,water:0,additions:[],knead:0,stretch:.5,shape:'round',heat:180,colour:0,onTray:false,inOven:false,done:false,finish:'whole',packedId:null,served:false});
const spec=value=>({flour:number(value?.flour,80,160,100),water:number(value?.water,25,125,65),additions:cleanAdditions(value?.additions),stretch:number(value?.stretch,.15,1,.5),shape:TOWN_SHAPES.some(x=>x.id===value?.shape)?value.shape:'round',heat:Math.round(number(value?.heat,150,210,180)),colour:number(value?.colour,0,1,.55),finish:value?.finish==='soup'?'soup':'whole'});
export function normalizeBakeryLife(value) {
  const saved=object(value)?value:{},b=object(saved.batch)?saved.batch:{},batch=freshBatch();
  batch.flour=Math.round(number(b.flour,0,160));batch.water=Math.round(number(b.water,0,125));batch.additions=cleanAdditions(b.additions);
  batch.knead=batch.flour>=80&&batch.water>=25?number(b.knead,0,1):0;
  batch.stretch=number(b.stretch,.15,1,.5);batch.shape=TOWN_SHAPES.some(x=>x.id===b.shape)?b.shape:'round';batch.heat=Math.round(number(b.heat,150,210,180));
  const ready=batch.knead>=.65;batch.colour=ready?number(b.colour,0,1):0;
  batch.onTray=ready&&b.onTray===true;batch.done=ready&&b.done===true&&batch.colour>=.15;batch.inOven=ready&&batch.onTray&&!batch.done&&b.inOven===true;
  batch.finish=batch.done&&batch.colour>=.74&&b.finish==='soup'?'soup':'whole';
  batch.packedId=batch.done&&/^bread-[1-9]\d{0,3}$/.test(b.packedId)?b.packedId:null;batch.served=Boolean(batch.packedId&&b.served);
  const recipes=Array.isArray(saved.recipes)?saved.recipes.filter(object).slice(-8).map((r,i)=>({id:'recipe-'+i,name:text(r.name)||'我的这一炉',...spec(r)})):[];
  const loaves=Array.isArray(saved.loaves)?saved.loaves.filter(r=>object(r)&&/^bread-[1-9]\d{0,3}$/.test(r.id)&&Number.isInteger(r.day)&&r.day>=1&&r.day<=3).slice(-24).map(r=>({id:r.id,day:r.day,...spec(r),shared:r.shared===true,sharedDay:r.shared===true&&Number.isInteger(r.sharedDay)&&r.sharedDay>=r.day&&r.sharedDay<=3?r.sharedDay:r.shared===true?r.day:null})):[];
  const seen=new Set();const promises=Array.isArray(saved.promises)?saved.promises.filter(r=>object(r)&&Number.isInteger(r.day)&&r.day>=1&&r.day<3&&!seen.has(r.day)&&seen.add(r.day)).map(r=>({day:r.day,due:r.day+1,spec:spec(r.spec),fulfilled:loaves.some(l=>l.shared&&(l.sharedDay||l.day)===r.day+1&&matchesRecipe(l,r.spec))})):[];
  const work=number(saved.work,0,100000),watch=object(saved.watch)&&Number.isInteger(saved.watch.day)&&saved.watch.day>=1&&saved.watch.day<=3&&Number.isFinite(saved.watch.start)&&saved.watch.start>=0&&saved.watch.start<=work?{day:saved.watch.day,start:saved.watch.start,welcomed:saved.watch.welcomed===true,completed:saved.watch.completed===true&&saved.watch.welcomed===true&&work>=saved.watch.start+12}:null;
  return {version:1,entered:saved.entered===true,coat:saved.coat===true,atBench:saved.coat===true&&saved.atBench===true,batch,recipes,loaves,promises,
    work,watch,helpedDays:Array.isArray(saved.helpedDays)?[...new Set(saved.helpedDays.filter(d=>Number.isInteger(d)&&d>=1&&d<=3))]:[],askedHelp:saved.askedHelp===true,
    learned:saved.learned===true,quiet:saved.quiet===true,sharedCount:loaves.filter(l=>l.shared).length};
}
export function bakeryProgress(game){
  const s=normalizeBakeryLife(game?.bakeryLife),gifts=townProgress(game).gifts.filter(g=>g.person==='lin');
  if(!gifts.length)return s;
  const loaves=s.loaves.map(l=>{const gift=gifts.find(g=>g.breadId===l.id);return gift?{...l,shared:true,sharedDay:gift.day}:l;});
  const batch=gifts.some(g=>g.breadId===s.batch.packedId)?{...s.batch,served:true}:s.batch;
  return normalizeBakeryLife({...s,loaves,batch});
}
export function bakeryStage(state) {const b=state.batch;if(!state.entered)return 'door';if(!state.coat)return 'coat';if(!state.atBench)return 'bench';if(b.done)return 'done';if(b.inOven)return 'oven';if(b.flour<80||b.water<25)return 'mix';if(b.knead<.65)return 'knead';return 'shape';}
export const bakeryHydration=b=>b.flour?b.water/b.flour:0;
export function bakeryDoughFeel(b){const h=bakeryHydration(b);return h<.52?'面团有点紧，推开时会缩回来。再添一点水，或慢慢揉，都可以。':h>.82?'面团很柔软，带一点黏手感。撒一点面粉，或用轻折的方式收拢。':'面团柔软而有支撑，顺着掌心慢慢延展开。';}
export const bakeryLoafName=handmadeBreadName;
function matchesRecipe(a,b){a=spec(a);b=spec(b);return a.shape===b.shape&&a.finish===b.finish&&a.additions.slice().sort().join(',')===b.additions.slice().sort().join(',')&&Math.abs(a.water/a.flour-b.water/b.flour)<=.08&&Math.abs(a.colour-b.colour)<=.12;}
export function bakeryResident(game){
  const s=bakeryProgress(game),day=townProgress(game).day,pending=s.promises.find(p=>p.due===day&&!p.fulfilled),met=s.sharedCount>0||s.helpedDays.length>0;
  const phase=s.work%60;
  let activity=phase<12?'packing':phase<38?'working':'resting';
  let line=activity==='packing'?'林姨正在把刚出炉的面包装进纸袋。她抬眼笑了一下，先把袋口折好。':activity==='working'?'林姨拂去围裙上的面粉，给你空出一角工作台。':'林姨把手腕搁在桌边歇一会儿。杯里的热气慢慢散开。';
  if(pending)line=`林姨在窗边放下一只空纸袋：“昨天说好的${bakeryLoafName(pending.spec)}，今天还想试吗？不急，先把外套挂好。”`;
  else if(s.promises.some(p=>p.due===day&&p.fulfilled))line='昨天留早餐的约定，已经好好放进今天。林姨把那张纸袋折起来，留着下次再用。';
  else if(s.loaves.some(l=>l.shared&&(l.sharedDay||l.day)<day))line=`门边留着昨天的纸袋，纸上写着：“昨天那种，今天还会有吗？”林姨替你留好了工作台。`;
  if(s.askedHelp&&activity!=='packing')line=s.batch.water/s.batch.flour>.82?'林姨洗净手，走过来示范：“不用和它较劲。轻轻拉开一角，再折回来。”':'林姨走近一点，把手放低：“先用掌根推开，指尖收回来。它会慢慢跟着你。”';
  if(s.watch&&!s.watch.completed){activity='away';line=s.watch.welcomed?'你替林姨招呼了门边的客人。她在后间慢慢喝水，客人愿意等这一炉。':'林姨把柜台留给你，去后间歇歇手腕。门边的风铃轻轻响了一下。';}
  else if(s.watch?.completed)line='林姨捧着水杯回来：“刚才那位客人，还记得你试出的味道。多亏你在，我这杯水总算喝完了。”';
  return {activity,line,pending,trust:met?'熟悉的工作台':'借来的一角',canWatchShop:new Set(s.loaves.filter(l=>l.shared).map(l=>l.sharedDay||l.day)).size>=2&&s.helpedDays.length>0&&!s.watch,
    reply:met?'“你在这儿，我能先喝完这杯水。想聊天就叫我，安静做也好。”':'“原料都在手边。慢慢试，做出什么样子都能吃。”'};
}
export function bakeryConsequences(game){const s=bakeryProgress(game),day=townProgress(game).day,p=s.promises.find(p=>p.due===day);return {
  recipes:s.recipes.length,loaves:s.loaves.length,shared:s.sharedCount,
  text:p?(p.fulfilled?'昨天留下的早餐，今天已经交到林姨手里。':'林姨留着一只空纸袋，记得你答应的那份早餐。'):s.loaves.some(l=>l.shared&&(l.sharedDay||l.day)<day)?'林姨留着昨天的纸袋，有人还想尝尝你试出的味道。':s.recipes.length?'炉边多了你亲手留下的配方。随时可以照着，再做一炉。':'',
};}
function storeBread(game,state,share){
  const town=townProgress(game),b=state.batch;if(b.packedId||town.breads.length>=6||town.serial>=9999)return null;
  const recipe=b.additions.includes('fruit')?'fruit':b.additions.includes('sesame')?'sesame':'milk';
  let next=performTownAction(game,{type:'recipe',value:recipe});next=performTownAction(next,{type:'new_batch'});next=performTownAction(next,{type:'shape',value:b.shape});
  for(const ingredient of TOWN_RECIPES.find(r=>r.id===recipe).ingredients)next=performTownAction(next,{type:'ingredient',ingredient:ingredient.id});
  for(let i=0;i<3;i++)next=performTownAction(next,{type:'knead'});
  const heat=b.colour>.8?205:b.colour>.6?195:b.colour<.35?160:180;
  next=performTownAction(next,{type:'heat',value:heat});next=performTownAction(next,{type:'bake'});
  const id='bread-'+townProgress(next).serial;if(townProgress(next).serial===town.serial)return null;
  const t=townProgress(next);next={...next,townDay:{...t,breads:t.breads.map(l=>l.id===id?{...l,handmade:spec(b)}:l)}};
  if(share)next=shareBread(next,id);
  return {game:next,id};
}
function shareBread(game,id){const t=townProgress(game);return t.gifts.some(g=>g.day===t.day&&g.person==='lin')?{...game,townDay:{...t,breads:t.breads.filter(b=>b.id!==id)}}:performTownAction(game,{type:'gift',person:'lin',breadId:id});}

export function performBakeryAction(game,action){
  if(!object(game)||!object(action))return game;
  let s=bakeryProgress(game),b=s.batch,next=game;const day=townProgress(game).day,stage=bakeryStage(s);
  if(townProgress(game).place!=='bakery')return game;
  switch(action.type){
    case 'enter':if(s.entered)return game;s={...s,entered:true};break;
    case 'coat':if(!s.entered||s.coat)return game;s={...s,coat:true};break;
    case 'bench':if(!s.coat||s.atBench)return game;s={...s,atBench:true};break;
    case 'flour':if(!s.atBench||b.onTray||b.inOven||b.done||b.flour>=160)return game;b={...b,flour:Math.min(160,b.flour+(b.flour?10:100)),knead:Math.max(0,b.knead-.05)};break;
    case 'water':if(!s.atBench||b.onTray||b.inOven||b.done||!Number.isFinite(action.amount)||action.amount<=0||action.amount>8)return game;b={...b,water:Math.min(125,b.water+action.amount),knead:Math.max(0,b.knead-.01)};break;
    case 'addition':if(!s.atBench||b.onTray||b.inOven||b.done||!additions.includes(action.id)||b.additions.includes(action.id))return game;b={...b,additions:[...b.additions,action.id]};break;
    case 'knead':if(!['knead','shape'].includes(stage)||!Number.isFinite(action.distance)||action.distance<.05)return game;b={...b,knead:Math.min(1,b.knead+Math.min(.12,action.distance*.18)*(bakeryHydration(b)<.52?.75:bakeryHydration(b)>.82?.85:1)),stretch:clamp(b.stretch+(action.dx||0)*.08,.15,1)};break;
    case 'stretch':if(!['knead','shape'].includes(stage)||!Number.isFinite(action.value))return game;b={...b,stretch:clamp(action.value,.15,1)};break;
    case 'shape':if(stage!=='shape'||!TOWN_SHAPES.some(x=>x.id===action.value))return game;b={...b,shape:action.value};break;
    case 'heat':if(!s.atBench||b.done||!Number.isFinite(action.value))return game;b={...b,heat:Math.round(clamp(action.value,150,210))};break;
    case 'tray':if(stage!=='shape'||b.onTray)return game;b={...b,onTray:true};break;
    case 'back_to_bowl':if(stage!=='shape'||!b.onTray)return game;b={...b,onTray:false};break;
    case 'insert':if(stage!=='shape'||!b.onTray)return game;b={...b,inOven:true};break;
    case 'tick':{
      if(!s.entered||s.quiet||!Number.isFinite(action.seconds)||action.seconds<=0||action.seconds>1)return game;
      const dt=action.seconds;s={...s,work:s.work+dt};if(s.watch?.welcomed&&s.work>=s.watch.start+12)s={...s,watch:{...s.watch,completed:true}};if(b.inOven)b={...b,colour:Math.min(1,b.colour+dt*.022*(b.heat/180))};break;
    }
    case 'take':if(stage!=='oven'||b.colour<.15)return game;b={...b,inOven:false,done:true};break;
    case 'soup':if(stage!=='done'||b.colour<.74||b.packedId||b.finish==='soup')return game;b={...b,finish:'soup'};break;
    case 'pack':case 'share':{
      if(stage!=='done')return game;const share=action.type==='share';
      if(b.packedId){if(!share||b.served||!townProgress(game).breads.some(l=>l.id===b.packedId))return game;next=shareBread(game,b.packedId);}
      else {const result=storeBread(game,s,share);if(!result)return game;next=result.game;b={...b,packedId:result.id};}
      b={...b,served:share};const loaf={id:b.packedId,day,...spec(b),shared:share,sharedDay:share?day:null};
      s={...s,loaves:[...s.loaves.filter(l=>l.id!==b.packedId),loaf]};break;
    }
    case 'save_recipe':if(stage!=='done'||s.recipes.some(r=>matchesRecipe(r,b)))return game;s={...s,recipes:[...s.recipes,{id:'recipe-'+s.recipes.length,name:text(action.name)||bakeryLoafName(b).slice(0,24),...spec(b)}].slice(-8)};break;
    case 'recall':{const r=s.recipes.find(x=>x.id===action.id);if(!r||b.inOven||(!b.packedId&&b.done))return game;b={...freshBatch(),flour:r.flour,water:r.water,additions:r.additions.slice(),shape:r.shape,stretch:r.stretch,heat:r.heat};break;}
    case 'new_batch':if(!b.done||!b.packedId)return game;b=freshBatch();break;
    case 'help':if(s.helpedDays.includes(day))return game;s={...s,helpedDays:[...s.helpedDays,day],work:Math.floor(s.work/60)*60+40};break;
    case 'ask':s={...s,askedHelp:!s.askedHelp,quiet:false};break;
    case 'learn':if(!s.askedHelp||s.work%60<12||!['knead','shape'].includes(stage))return game;s={...s,learned:true,askedHelp:false};b={...b,knead:Math.min(1,b.knead+.12)};break;
    case 'promise':if(!s.loaves.length||day>=3||s.promises.some(p=>p.day===day))return game;s={...s,promises:[...s.promises,{day,due:day+1,spec:spec(s.loaves.at(-1)),fulfilled:false}]};break;
    case 'watch':if(!bakeryResident(game).canWatchShop)return game;s={...s,watch:{day,start:s.work,welcomed:false,completed:false}};break;
    case 'welcome':if(!s.watch||s.watch.completed||s.watch.welcomed||s.work<s.watch.start+3)return game;s={...s,watch:{...s.watch,welcomed:true}};break;
    case 'quiet':s={...s,quiet:!s.quiet};break;
    default:return game;
  }
  s=normalizeBakeryLife({...s,batch:b});
  const memories=s.loaves.length&&!next.memories?.some(m=>m.id===BAKERY_MEMORY.id)?[...(next.memories||[]),{...BAKERY_MEMORY}]:next.memories;
  return {...next,bakeryLife:s,...(memories!==next.memories?{memories}:{})};
}
