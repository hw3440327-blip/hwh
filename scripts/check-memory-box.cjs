// Optional production-browser acceptance checks for the repaired memory box.
// Requires Playwright and Chromium. MEMORY_BOX_TEST_URL and MEMORY_BOX_OFFLINE=1
// also exercise a streamed, self-contained HTML after network access is disabled.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const url=process.env.MEMORY_BOX_TEST_URL||'http://127.0.0.1:4173/hwh/';
const offline=process.env.MEMORY_BOX_OFFLINE==='1';
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const check=(ok,message)=>{if(!ok)throw Error(message)};
const report={version:JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version,
 startedAt:new Date().toISOString(),url,offline,checks:[],errors:[],resourceFailures:[],cancelledRequests:[],externalRequests:[]};
const output=path.join(root,'release',`memory-box-v${report.version}-${offline?'offline':'browser'}.json`);
let browser;
(async()=>{
 const E=await import(path.join(root,'src/engine.js'));
 const M=await import(path.join(root,'src/memoryBox.js'));
 const original=E.finishIntroduction(E.createGame('小晴','pause'),{name:'小晴',origin:'pause'});
 const legacy={...original};delete legacy.memoryBox;
 const story=g=>JSON.stringify({name:g.name,sceneId:g.sceneId,history:g.history,flags:g.flags,
  money:g.money,energy:g.energy,connection:g.connection,visited:g.visited});
 const originalStory=story(legacy);
 browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
 async function test(name,fn,page){
  try{const details=await fn();report.checks.push({name,status:'pass',details});console.log('PASS',name,JSON.stringify(details||{}));}
  catch(error){if(page&&!page.isClosed())await page.screenshot({path:path.join(root,'release',`memory-box-v${report.version}-${offline?'offline-':''}failure-${report.checks.length}.png`),fullPage:true}).catch(()=>{});
   report.checks.push({name,status:'fail',error:error.stack});console.error('FAIL',name,error.message);throw error;}
 }
 async function setup(g=legacy,options={},largeText=false){
  const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true,...options});
  await context.addInitScript(({game,key,largeText})=>{
   if(!localStorage.getItem('memory-box-qa-seeded')){
    localStorage.setItem(key,JSON.stringify(game));localStorage.setItem('memory-box-qa-seeded','1');
    localStorage.setItem('next-spring-preferences-v1',JSON.stringify({textSpeed:0,autoNarration:false,quietMotion:false,filmMotion:true,largeText}));
   }
   const NativeAudio=window.Audio;window.__memoryAudios=[];
   window.Audio=class extends NativeAudio{constructor(...args){super(...args);window.__memoryAudios.push(this)}};
   window.__memoryContexts=[];window.__memoryAnalysers=[];window.__memorySources=[];
   const NativeContext=window.AudioContext;
   window.AudioContext=class extends NativeContext{constructor(...args){super(...args);window.__memoryContexts.push(this)}};
   const connect=AudioNode.prototype.connect;
   AudioNode.prototype.connect=function(target,...args){const result=connect.call(this,target,...args);
    if(target===this.context.destination&&!this.__memoryQaObserved){this.__memoryQaObserved=true;const analyser=this.context.createAnalyser();analyser.fftSize=2048;connect.call(this,analyser);window.__memoryAnalysers.push(analyser)}return result;};
   const start=AudioBufferSourceNode.prototype.start;
   AudioBufferSourceNode.prototype.start=function(...args){const row={source:this,startedAt:this.context.currentTime,scheduledAt:Math.max(this.context.currentTime,Number(args[0])||0),loop:this.loop,duration:this.buffer?.duration||0,offset:Number(args[1])||0,ended:false};window.__memorySources.push(row);this.addEventListener('ended',()=>row.ended=true);return start.apply(this,args)};
  },{game:g,key:E.STORAGE_KEY,largeText});
  if(offline)await context.route('**/*',route=>{
   const request=route.request();if(request.isNavigationRequest()&&request.url()===url)return route.continue();
   report.externalRequests.push(request.url());return route.abort();
  });
  const page=await context.newPage();page.setDefaultTimeout(18000);
  page.on('pageerror',error=>report.errors.push(error.message));
  page.on('requestfailed',request=>{const row={url:request.url(),error:request.failure()?.errorText};
   if(row.error==='net::ERR_ABORTED')report.cancelledRequests.push(row);else report.resourceFailures.push(row);});
  page.on('response',response=>{if(response.status()>=400)report.resourceFailures.push({url:response.url(),status:response.status()})});
  return {context,page};
 }
 async function navigate(context,page,reload=false){
  if(offline)await context.setOffline(false);
  if(reload)await page.reload({waitUntil:'domcontentloaded',timeout:60000});
  else await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  if(offline)await context.setOffline(true);
 }
 const save=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),E.STORAGE_KEY);
 const state=async page=>M.memoryBoxProgress(await save(page));
 const box=page=>page.getByRole('dialog',{name:'雨声里的木盒',exact:true});
 const button=(page,name)=>box(page).getByRole('button',{name,exact:true});
 const town=page=>page.getByRole('dialog',{name:'初秋的三天',exact:true});
 const stage=page=>box(page).getAttribute('data-memory-box-stage');
 async function goTown(page,place){
  if(!await town(page).count())await page.getByRole('button',{name:'走进初秋的三天',exact:true}).click();
  const current=await town(page).getAttribute('data-town-place');
  if(current!==place){await town(page).getByRole('button',{name:'打开小镇地图',exact:true}).click();
   const names={workshop:'旧物修补铺',room:'蓝门小屋',bakery:'有光面包房'};
   await town(page).getByRole('button',{name:'去'+names[place],exact:true}).click();}
  await town(page).locator('.td-painting:not(.td-painting-previous) img').evaluate(img=>img.decode());
 }
 async function openBox(page){await goTown(page,'workshop');await town(page).locator('[data-town-memory-box]').first().click();await box(page).waitFor();}
 async function closeBox(page){await button(page,'收好木盒，回到小镇').click();await box(page).waitFor({state:'detached'});}
 async function rms(page){return page.evaluate(()=>window.__memoryAnalysers.map(a=>{if(a.context.state!=='running')return 0;const data=new Float32Array(a.fftSize);a.getFloatTimeDomainData(data);return Math.sqrt(data.reduce((sum,x)=>sum+x*x,0)/data.length)}));}
 async function setLid(page,value){const slider=box(page).getByRole('slider',{name:'木盒打开程度',exact:true});await slider.focus();
  await slider.press(value===0?'Home':value===100?'End':'Home');
  if(value!==0&&value!==100)for(let n=0;n<value;n++)await slider.press('ArrowRight');
  await page.waitForFunction(({key,value})=>Math.abs(JSON.parse(localStorage.getItem(key)).memoryBox.lid-value/100)<.011,{key:E.STORAGE_KEY,value});
 }
 const {context,page}=await setup();let completedState,exportedPayload,beforeSanding,repairedSeed,heardSeed;
 await test('the target matches the exact production build or independent HTML artifact',async()=>{
  const response=await fetch(url);check(response.ok,'Cannot fetch the test target');const bytes=Buffer.from(await response.arrayBuffer());
  if(offline){const artifact=fs.readFileSync(path.join(root,'release','下一次春天-电影生活版.html'));check(hash(bytes)===hash(artifact),'The streamed standalone differs from the packaged HTML');
   report.artifact={file:'下一次春天-电影生活版.html',bytes:bytes.length,sha256:hash(bytes)};report.buildFingerprint={version:report.version,...report.artifact};
  }else{const manifestBytes=fs.readFileSync(path.join(root,'release',`web-build-v${report.version}.json`)),manifest=JSON.parse(manifestBytes),entry=manifest.files.find(row=>row.file==='index.html');
   check(entry.sha256===hash(bytes)&&entry.bytes===bytes.length,'Stale production entry');const javascript=bytes.toString().match(/<script\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1];check(javascript,'No production JavaScript entry');
   const jsURL=new URL(javascript,url),jsResponse=await fetch(jsURL);check(jsResponse.ok,'Cannot fetch runtime JavaScript');const js=Buffer.from(await jsResponse.arrayBuffer());
   const record=manifest.files.find(row=>new URL(row.url,new URL(url).origin).pathname===jsURL.pathname);check(record&&record.sha256===hash(js)&&record.bytes===js.length,'Stale runtime JavaScript');
   report.buildFingerprint={version:manifest.version,entry:{bytes:bytes.length,sha256:hash(bytes)},javascript:{file:record.file,bytes:js.length,sha256:hash(js)},assetManifestSha256:hash(manifestBytes)};
  }return report.buildFingerprint;
 },page);
 await test('an existing journey enters the repair workshop and observes the three physical clues',async()=>{
  await navigate(context,page);await openBox(page);check(await stage(page)==='inspect','A legacy journey did not begin with observation');
  check(await box(page).getAttribute('data-memory-place')==='workshop','A first repair does not open in the workshop');
  for(const id of ['scratch','hinge','grain'])await box(page).locator(`[data-memory-inspect="${id}"]`).click();
  check(await stage(page)==='sand','Inspecting the box did not reveal sanding');check(story(await save(page))===originalStory,'The memory box changed the main story');
  beforeSanding=await save(page);return {legacyMigration:true,observations:(await state(page)).inspected};
 },page);
 await test('real sanding gestures follow the grain, cancel without progress and support a keyboard alternative',async()=>{
  const surface=box(page).locator('[data-memory-sanding]');const bounds=await surface.boundingBox();check(bounds,'No physical sanding surface');
  let before=(await state(page)).sandProgress;
  await page.mouse.move(bounds.x+bounds.width*.2,bounds.y+bounds.height*.5);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width*.7,bounds.y+bounds.height*.52,{steps:8});await page.mouse.up();
  const after=(await state(page)).sandProgress;check(after>before&&after<1,'One sanding stroke did not create gradual progress');
  const touchContext=await context.newCDPSession(page);
  await touchContext.send('Input.dispatchMouseEvent',{type:'mousePressed',x:bounds.x+bounds.width*.2,y:bounds.y+bounds.height*.5,button:'left',clickCount:1});
  await touchContext.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:bounds.x+bounds.width*.65,y:bounds.y+bounds.height*.5,button:'left',buttons:1});
  await surface.dispatchEvent('pointercancel',{pointerId:1,pointerType:'mouse',isPrimary:true});
  await touchContext.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:bounds.x+bounds.width*.65,y:bounds.y+bounds.height*.5,button:'left',clickCount:1});
  check((await state(page)).sandProgress===after,'A cancelled sanding gesture committed progress');
  while(await stage(page)==='sand'){await surface.focus();await surface.press('Enter');}
  check(await stage(page)==='style','Keyboard sanding did not complete the preparation');return {firstStroke:after,cancelPreserved:true,keyboardAlternative:true};
 },page);
 await test('the repair keeps a personal mark and both hinges must be physically fixed',async()=>{
  await box(page).locator('[data-memory-style="leaf"]').click();check((await state(page)).style==='leaf','The chosen repair mark was lost');
  await button(page,'拧紧左边的合页').click();check(!(await state(page)).repaired,'One half-fastener repaired the whole box');
  await button(page,'拧紧左边的合页').click();await button(page,'拧紧右边的合页').click();await button(page,'拧紧右边的合页').click();
  check((await state(page)).repaired&&await stage(page)==='listen','Both fixed hinges did not unlock the lid');
  check(await box(page).locator('[data-memory-fragment]').count()===0,'The closed box reveals an unheard recording before the player opens it');
  check(await button(page,'读完这段主人的话').isDisabled(),'A closed box permits the player to read an undiscovered recording');
  await page.screenshot({path:path.join(root,'release',`memory-box-v${report.version}-${offline?'offline-':''}repaired.png`)});
  repairedSeed=await save(page);return {style:(await state(page)).style,fasteners:(await state(page)).fasteners};
 },page);
 await test('a continuously opening lid reveals actual rain and speech without inventing heard progress',async()=>{
  await setLid(page,40);
  await page.waitForFunction(()=>window.__memorySources.some(s=>s.source.context.state==='running'&&s.loop&&!s.ended));
  check(!await page.evaluate(()=>window.__memorySources.some(s=>s.source.context.state==='running'&&!s.loop&&!s.ended&&s.duration>1)),'The owner speaks while the lid is only slightly ajar');
  await setLid(page,100);
  await page.waitForFunction(()=>window.__memorySources.some(s=>s.source.context.state==='running'&&!s.loop&&!s.ended&&s.duration>1));
  await page.waitForFunction(()=>window.__memoryAnalysers.some(a=>{if(a.context.state!=='running')return false;const s=new Float32Array(a.fftSize);a.getFloatTimeDomainData(s);return s.some(v=>Math.abs(v)>.00001)}));
  await page.waitForFunction(()=>window.__memorySources.some(s=>!s.loop&&!s.ended&&s.duration>1&&s.source.context.currentTime-s.scheduledAt>.45));
  const audible=await rms(page);check(audible.some(v=>v>.00001),'The opened box produces no real audio samples');
  check((await state(page)).heard.length===0,'Opening the lid falsely marked a recording heard before playback completed');
  const before=await page.evaluate(()=>window.__memorySources.map(s=>({duration:s.duration,loop:s.loop,offset:s.offset,ended:s.ended})));
  await setLid(page,0);await page.waitForTimeout(1000);
  check((await state(page)).heard.length===0,'Closing midway falsely marked the voice heard');
  const quiet=await rms(page);check(quiet.every(v=>v<.00001),'Closing the lid did not fade the memory audio away');
  return {audibleRms:audible,closedRms:quiet,sources:before,heardBeforeNaturalEnd:0};
 },page);
 await test('three owner recordings really play to their natural ends with the exact subtitles',async()=>{
  const listened=[];await setLid(page,100);
  await page.waitForFunction(()=>window.__memorySources.some(s=>s.source.context.state==='running'&&!s.loop&&!s.ended&&s.duration>1&&s.offset>.3));
  for(const [index,recording]of M.MEMORY_BOX_RECORDINGS.entries()){
   if((await state(page)).memoryIndex!==index)await box(page).locator(`[data-memory-recording="${recording.id}"]`).click();
   const caption=box(page).locator(`[data-memory-fragment="${recording.id}"]`);await caption.waitFor();
   check((await caption.innerText()).includes(recording.text),'A recording subtitle differs from the frozen owner text');
   await page.waitForFunction(({key,id})=>JSON.parse(localStorage.getItem(key)).memoryBox.heard.includes(id),{key:E.STORAGE_KEY,id:recording.id},{timeout:90000});
   listened.push({id:recording.id,subtitle:recording.text,heard:[...(await state(page)).heard]});
   if(index<M.MEMORY_BOX_RECORDINGS.length-1)await box(page).locator(`[data-memory-recording="${M.MEMORY_BOX_RECORDINGS[index+1].id}"]`).click();
  }
  const final=await state(page);check(final.heard.length===3&&final.read.length===0,'Listening was replaced by a caption shortcut or lost natural completions');
  check(await stage(page)==='reply','The natural listening sequence did not reach a response');
  const sources=await page.evaluate(()=>window.__memorySources.map(s=>({duration:s.duration,loop:s.loop,offset:s.offset,ended:s.ended})));
  check(sources.some(s=>!s.loop&&s.duration>1&&s.ended),'No actual non-looping voice buffer reached its natural end');
  heardSeed=await save(page);await page.screenshot({path:path.join(root,'release',`memory-box-v${report.version}-${offline?'offline-':''}listening.png`)});
  return {recordings:listened,read:final.read,sources,resumedInterruptedVoice:sources.some(s=>!s.loop&&s.offset>.3)};
 },page);
 await test('a personal response and returning the repaired box create a visible resident follow-up',async()=>{
  const reply=box(page).getByRole('textbox');await reply.fill('雨'.repeat(65));
  check([...(await reply.inputValue())].length===60,'The response input does not enforce its displayed 60-character limit');
  await reply.fill('愿下一次下雨时，你们还能坐在同一扇窗边。');
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).memoryBox.reply==='愿下一次下雨时，你们还能坐在同一扇窗边。',E.STORAGE_KEY);
  await box(page).locator('[data-memory-destination="return"]').click();
  const saved=await save(page);check(M.memoryBoxProgress(saved).destination==='return','The chosen destination was not saved');
  check(saved.memories.filter(m=>m.id===M.MEMORY_BOX_MEMORY.id).length===1,'Finishing duplicated or omitted the episode memory');
  check(story(saved)===originalStory,'The memory changed the main timeline or economic resources');
  completedState=M.memoryBoxProgress(saved);await closeBox(page);await goTown(page,'bakery');
  const followUp=M.memoryBoxEcho(saved,'bakery');
  check(await town(page).getByRole('button',{name:followUp.objectLabel,exact:true}).isVisible(),'The returned box has no visible physical placement in the bakery');
  await town(page).locator('[data-town-person="lin"]').click();
  const conversation=M.memoryBoxFollowUp(saved,'lin'),echo=town(page).locator('.td-memory-box-echo');
  await echo.waitFor();check((await echo.innerText()).includes(conversation.title)&&(await echo.innerText()).includes(conversation.text),'The resident does not remember the repaired box');
  await town(page).getByRole('button',{name:'收起眼前的小事',exact:true}).click();
  return {destination:completedState.destination,reply:completedState.reply,followUp,conversation,memory:M.MEMORY_BOX_MEMORY.id};
 },page);
 await test('reopening and replaying preserve the repair and never repeat its reward',async()=>{
  await openBox(page);check((await state(page)).completed,'Reopening lost the completed memory');
  check(await box(page).getAttribute('data-memory-place')==='bakery','A returned box reopens at the repair bench instead of its bakery destination');
  check((await box(page).innerText()).includes('林姨重新收好的雨声木盒'),'The returned box still describes an unfinished repair');
  await box(page).locator('[data-memory-recording="rain-table"]').click();await setLid(page,100);
  await page.waitForFunction(()=>window.__memorySources.some(s=>s.source.context.state==='running'&&!s.loop&&!s.ended&&s.duration>1));
  await setLid(page,0);await closeBox(page);
  check((await save(page)).memories.filter(m=>m.id===M.MEMORY_BOX_MEMORY.id).length===1,'Replaying added another reward');
  await page.waitForTimeout(1000);check((await rms(page)).every(v=>v<.00001),'Memory audio keeps playing behind the town after leaving');
  return {place:'bakery',completedCaption:true,replayStarted:true,rewardCount:1,stopsWhenClosed:true};
 },page);
 await test('reloading and real exported/imported journeys retain the legal memory state',async()=>{
  const before=await state(page);
  await town(page).getByRole('button',{name:'收好这一天，回到故事',exact:true}).click();
  await navigate(context,page,true);await page.getByRole('button',{name:'继续这段人生',exact:true}).click();
  check(JSON.stringify(await state(page))===JSON.stringify(before),'Reloading lost the memory state');
  await page.getByRole('button',{name:'打开旅程手记',exact:true}).click();
  const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'收藏这段旅程',exact:true}).click();
  const download=await downloaded;exportedPayload=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
  check(JSON.stringify(M.memoryBoxProgress(exportedPayload.save))===JSON.stringify(before),'The exported journey omitted the box');
  async function importJSON(value){
   await page.getByRole('button',{name:'从存档继续',exact:true}).click();await page.getByRole('button',{name:'选择存档并继续',exact:true}).click({noWaitAfter:true});
   await page.locator('input[aria-label="导入旅程文件"]').setInputFiles({name:'木盒验收旅程.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});
   await page.getByRole('dialog',{name:'旅程手记',exact:true}).waitFor({state:'detached'});
  }
  await importJSON({save:legacy});check(!(await state(page)).repaired,'A legacy import retained the previous repaired box');
  await page.getByRole('button',{name:'打开旅程手记',exact:true}).click();await importJSON(exportedPayload);
  check(JSON.stringify(await state(page))===JSON.stringify(before),'Import did not restore the finished box');
  return {download:download.suggestedFilename(),legacyMigration:true,currentSaveRoundTrip:true};
 },page);
 await test('keyboard focus stays in the active memory and Escape returns to the town entry',async()=>{
  await openBox(page);
  for(let n=0;n<18;n++){await page.keyboard.press(n%3===0?'Shift+Tab':'Tab');check(await box(page).evaluate(el=>el.contains(document.activeElement)),'Focus escaped to the inactive town');}
  await page.keyboard.press('Escape');await box(page).waitFor({state:'detached'});
  check(await town(page).evaluate(el=>el.contains(document.activeElement)),'Closing the box did not return focus to the town');
  return {focusContained:true,escapeClosesOneLayer:true};
 },page);
 await test('the painted background stays fixed, keeps its aspect and supports reduced motion',async()=>{
  await openBox(page);await page.waitForTimeout(700);
  const poster=box(page).locator('.film-poster').first();await poster.evaluate(img=>img.decode());
  const geometry=await poster.evaluate(img=>({width:img.naturalWidth,height:img.naturalHeight,transform:getComputedStyle(img).transform,filter:getComputedStyle(img).filter,fit:getComputedStyle(img).objectFit}));
  check(geometry.width===7680&&geometry.transform==='none'&&geometry.filter==='none'&&geometry.fit!=='fill','The memory scene replaces, filters or distorts the painting');
  const hide=await page.addStyleTag({content:'body *{visibility:hidden!important}[role="dialog"][aria-label="雨声里的木盒"] .film-poster{visibility:visible!important}'});
  const a=await page.screenshot();await page.waitForTimeout(1000);const b=await page.screenshot();check(hash(a)===hash(b),'The base painting moves independently of the memory object');await hide.evaluate(el=>el.remove());
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>!document.querySelector('[data-memory-box-stage] .scene-motion'));
  check(await poster.evaluate(img=>img.naturalWidth)===7680,'Reduced motion lowered the image resolution');
  await page.emulateMedia({reducedMotion:'no-preference'});await closeBox(page);return {geometry,basePixelsStable:true,reducedMotionPreservesPainting:true};
 },page);
 await test('native phone gestures sand once, cancel safely and continuously open the lid',async()=>{
  const {context:mobileContext,page:mobile}=await setup(beforeSanding,{viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  try{
   await navigate(mobileContext,mobile);await openBox(mobile);const surface=box(mobile).locator('[data-memory-sanding]');await surface.scrollIntoViewIfNeeded();let area=await surface.boundingBox();
   const cdp=await mobileContext.newCDPSession(mobile);
   const touch=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:['touchEnd','touchCancel'].includes(type)?[]:[{x,y,radiusX:4,radiusY:4,force:1,id:1}]});
   const initial=(await state(mobile)).sandProgress;
   await touch('touchStart',area.x+area.width*.2,area.y+area.height*.5);await touch('touchMove',area.x+area.width*.7,area.y+area.height*.52);await touch('touchEnd');
   const sanded=(await state(mobile)).sandProgress;check(sanded>initial&&sanded<1,'The finger stroke did not create gradual sanding progress');
   await touch('touchStart',area.x+area.width*.2,area.y+area.height*.5);await touch('touchMove',area.x+area.width*.7,area.y+area.height*.52);await touch('touchCancel');
   check((await state(mobile)).sandProgress===sanded,'A native cancelled stroke still counted');
   while(await stage(mobile)==='sand')await surface.press('Enter');
   await box(mobile).locator('[data-memory-style="keep"]').tap();for(const name of ['拧紧左边的合页','拧紧左边的合页','拧紧右边的合页','拧紧右边的合页'])await button(mobile,name).tap();
   const lid=box(mobile).locator('[data-memory-lid]');await lid.scrollIntoViewIfNeeded();area=await lid.boundingBox();
   const lidY=area.y+area.height*.72;
   await touch('touchStart',area.x+area.width*.5,lidY);await touch('touchMove',area.x+area.width*.5,Math.max(20,lidY-90));await touch('touchEnd');
   check((await state(mobile)).lid>.1,'A real finger drag did not open the lid continuously');
   const dims=await mobile.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth,width:document.querySelector('[data-memory-box-stage]').getBoundingClientRect().width}));
   check(dims.scroll<=dims.viewport&&dims.width<=dims.viewport+1,'The memory view overflows the phone');
   await mobile.screenshot({path:path.join(root,'release',`memory-box-v${report.version}-${offline?'offline-':''}mobile.png`),fullPage:true});
   return {nativeCDPTouch:true,sanding:sanded,cancelPreserved:true,lid:(await state(mobile)).lid,...dims};
  }finally{await mobileContext.close()}
 });
 await test('a real decoding error is explained and the retry starts the packaged owner voice',async()=>{
  const {context:failureContext,page:failurePage}=await setup(repairedSeed);
  try{
   await failureContext.addInitScript(()=>{
    const decode=AudioContext.prototype.decodeAudioData;window.__memoryQaFailedDecode=false;
    AudioContext.prototype.decodeAudioData=function(bytes,...args){
     const b=new Uint8Array(bytes),mp3=(b[0]===73&&b[1]===68&&b[2]===51)||(b[0]===255&&(b[1]&224)===224);
     if(mp3&&!window.__memoryQaFailedDecode){window.__memoryQaFailedDecode=true;return Promise.reject(new DOMException('One injected owner-recording decoder failure','EncodingError'));}
     return decode.call(this,bytes,...args);
    };
   });
   await navigate(failureContext,failurePage);await openBox(failurePage);await setLid(failurePage,100);
   await box(failurePage).getByRole('alert').waitFor();
   check(await failurePage.evaluate(()=>window.__memoryQaFailedDecode),'The decoder-error branch was not actually exercised');
   const error=await box(failurePage).getByRole('alert').innerText();await button(failurePage,'再试一次').click();
   await failurePage.waitForFunction(()=>window.__memorySources.some(s=>s.source.context.state==='running'&&!s.loop&&!s.ended&&s.duration>1));
   check((await state(failurePage)).heard.length===0,'Retry marked the voice heard before it completed');
   await closeBox(failurePage);return {injectedSingleDecodeFailure:true,error,retryPlaysRealOwnerBuffer:true};
  }finally{await failureContext.close()}
 });
 await test('a late failure from an abandoned recording cannot interrupt the new owner fragment',async()=>{
  const {context:staleContext,page:stalePage}=await setup(repairedSeed);
  try{
   await staleContext.addInitScript(()=>{
    const decode=AudioContext.prototype.decodeAudioData;window.__memoryQaStalePending=false;
    AudioContext.prototype.decodeAudioData=function(bytes,...args){
     const b=new Uint8Array(bytes),mp3=(b[0]===73&&b[1]===68&&b[2]===51)||(b[0]===255&&(b[1]&224)===224);
     if(mp3&&!window.__memoryQaStalePending){window.__memoryQaStalePending=true;return new Promise((_,reject)=>{window.__memoryQaReleaseStale=()=>reject(new DOMException('Delayed decoder failure from the previous fragment','EncodingError'));});}
     return decode.call(this,bytes,...args);
    };
   });
   await navigate(staleContext,stalePage);await openBox(stalePage);await setLid(stalePage,100);
   await stalePage.waitForFunction(()=>window.__memoryQaStalePending);
   await box(stalePage).locator('[data-memory-read="rain-table"]').click();await button(stalePage,'听下一段雨声').click();
   await stalePage.waitForFunction(()=>document.querySelector('[data-memory-box-stage]')?.dataset.memoryAudioId==='rain-window'&&document.querySelector('[data-memory-box-stage]')?.dataset.memoryAudioStatus==='playing');
   await stalePage.evaluate(()=>window.__memoryQaReleaseStale());await stalePage.waitForTimeout(600);
   check(await box(stalePage).getAttribute('data-memory-audio-status')==='playing','An abandoned recording failure stopped the current fragment');
   check(await box(stalePage).getByRole('alert').count()===0,'A stale decoder failure was shown for a healthy current fragment');
   check((await rms(stalePage)).some(v=>v>.00001),'The next recording lost its actual output after the old failure arrived');
   check((await state(stalePage)).read.join(',')==='rain-table'&&(await state(stalePage)).heard.length===0,'The stale failure changed legal read/heard progress');
   await closeBox(stalePage);return {oldDecoderFailedAfterSwitch:true,currentId:'rain-window',newVoiceRemainsAudible:true};
  }finally{await staleContext.close()}
 });
 await test('continuing to move a nearly closed lid cannot consume unheard owner speech',async()=>{
  const {context:lidContext,page:lidPage}=await setup(repairedSeed);
  try{
   await navigate(lidContext,lidPage);await openBox(lidPage);await setLid(lidPage,100);
   await lidPage.waitForFunction(()=>window.__memorySources.some(s=>s.source.context.state==='running'&&!s.loop&&!s.ended&&s.duration>1));
   await lidPage.waitForTimeout(600);await setLid(lidPage,0);
   const slider=box(lidPage).getByRole('slider',{name:'木盒打开程度',exact:true});
   for(let n=0;n<38;n++){await slider.press('ArrowRight');await lidPage.waitForTimeout(40);}
   await lidPage.waitForTimeout(300);check((await state(lidPage)).heard.length===0,'Silent low-lid motion marked an unheard recording complete');
   await setLid(lidPage,100);
   await lidPage.waitForFunction(()=>window.__memorySources.some(s=>s.source.context.state==='running'&&!s.loop&&!s.ended&&s.duration>1&&s.offset>.2));
   const resumed=await lidPage.evaluate(()=>window.__memorySources.filter(s=>s.source.context.state==='running'&&!s.loop&&!s.ended&&s.duration>1).map(s=>({offset:s.offset,duration:s.duration})));
   check(resumed.length===1&&resumed[0].offset<2,'Continued low-lid motion consumed seconds of inaudible owner speech');
   await closeBox(lidPage);return {subThresholdAdjustments:38,resumed,unheardSpeechPreserved:true};
  }finally{await lidContext.close()}
 });
 await test('the selected story narration stays paused inside the box and its sound switch resumes the owner',async()=>{
  const {context:voiceContext,page:voicePage}=await setup(repairedSeed);
  try{
   await navigate(voiceContext,voicePage);await voicePage.getByRole('button',{name:'继续这段人生',exact:true}).click();
   await voicePage.getByRole('button',{name:'开启故事朗读',exact:true}).click();
   await voicePage.waitForFunction(()=>window.__memoryAudios.some(audio=>!audio.paused&&audio.currentTime>.15));
   const opening=await voicePage.evaluate(()=>{const audio=window.__memoryAudios.find(a=>!a.paused);return {src:audio.currentSrc,time:audio.currentTime,error:audio.error?.code||null}});
   check(!opening.error,'The existing selected story voice failed before entering the box');
   await openBox(voicePage);await voicePage.waitForFunction(()=>window.__memoryAudios.every(audio=>audio.paused));
   await setLid(voicePage,100);await voicePage.waitForFunction(()=>window.__memorySources.some(s=>s.source.context.state==='running'&&!s.loop&&!s.ended&&s.duration>1));
   await voicePage.waitForFunction(()=>window.__memorySources.some(s=>!s.loop&&!s.ended&&s.duration>1&&s.source.context.currentTime-s.scheduledAt>.25));await button(voicePage,'关闭木盒声音').click();await voicePage.waitForTimeout(600);
   check((await rms(voicePage)).every(v=>v<.00001),'The box sound switch leaves its owner or rain audible');
   check((await state(voicePage)).heard.length===0,'Muting the owner falsely marks the recording complete');
   await button(voicePage,'开启木盒声音').click();
   await voicePage.waitForFunction(()=>window.__memorySources.some(s=>s.source.context.state==='running'&&!s.loop&&!s.ended&&s.duration>1&&s.offset>.15));
   check(await voicePage.evaluate(()=>window.__memoryAudios.every(audio=>audio.paused)),'The main story voice overlaps the memory owner');
   await closeBox(voicePage);await voicePage.waitForTimeout(600);
   check((await rms(voicePage)).every(v=>v<.00001),'The owner resumes after the player has left the box');
   check(await voicePage.evaluate(()=>window.__memoryAudios.every(audio=>audio.paused)),'The old story resumes over the remaining town overlay');
   return {openingPlayed:true,storyPausedInsideBox:true,mutingSilent:true,unmutingContinuesOwner:true,leavingStopsOwner:true};
  }finally{await voiceContext.close()}
 });
 await test('captions provide a separate silent path and a borrowed box really appears at home',async()=>{
  const {context:readContext,page:readPage}=await setup(repairedSeed,{viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  try{
   await navigate(readContext,readPage);await openBox(readPage);
   const mute=box(readPage).getByRole('button',{name:'关闭木盒声音',exact:true});if(await mute.count())await mute.click();
   await setLid(readPage,100);
   for(const [index,recording]of M.MEMORY_BOX_RECORDINGS.entries()){
    if((await state(readPage)).memoryIndex!==index)await box(readPage).locator(`[data-memory-recording="${recording.id}"]`).click();
    await box(readPage).locator(`[data-memory-read="${recording.id}"]`).click();
   }
   const read=await state(readPage);check(read.heard.length===0&&read.read.length===3,'Caption reading was falsely marked as hearing the voice');
   await box(readPage).locator('[data-memory-reply="window"]').click();await box(readPage).locator('[data-memory-destination="window"]').click();
   const saved=await save(readPage);await closeBox(readPage);await goTown(readPage,'room');
   const echo=M.memoryBoxEcho(saved,'room'),object=town(readPage).getByRole('button',{name:echo.objectLabel,exact:true});
   await object.scrollIntoViewIfNeeded();check(await object.isVisible(),'The borrowed box has no visible home placement');await object.click();
   check(await box(readPage).getAttribute('data-memory-place')==='room','The borrowed box reopens in the workshop instead of the player’s room');
   check((await box(readPage).innerText()).includes('暂放在你窗边的雨声木盒'),'The borrowed box still describes a pending delivery from its owner');
   check((await box(readPage).innerText()).includes('你把木盒放在蓝门小屋的窗边'),'The home object does not reopen the player’s borrowed box');
   return {heard:read.heard,read:read.read,destination:'window',echo};
  }finally{await readContext.close()}
 });
 await test('the existing large-text preference also enlarges the new memory captions',async()=>{
  await openBox(page);const normal=await box(page).locator('.mb-listening blockquote').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));await closeBox(page);
  const {context:largeContext,page:largePage}=await setup(await save(page),{},true);
  try{
   await navigate(largeContext,largePage);await openBox(largePage);
   const large=await box(largePage).locator('.mb-listening blockquote').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
   check(large>normal,'The story large-text preference does not enlarge the memory dialogue');return {normal,large};
  }finally{await largeContext.close()}
 });
 await test('starting a new life clears the repaired object and its one-time memory',async()=>{
  if(await box(page).count())await closeBox(page);
  if(await town(page).count())await town(page).getByRole('button',{name:'收好这一天，回到故事',exact:true}).click();
  await page.getByRole('button',{name:'打开旅程手记',exact:true}).click();await page.locator('.journey-tabs button').filter({hasText:'阅读与声音'}).click();
  await page.getByRole('button',{name:'开始新的生活',exact:true}).click();await page.getByRole('button',{name:'重新出发',exact:true}).click();
  const reset=await save(page);check(!M.memoryBoxProgress(reset).repaired&&!M.memoryBoxProgress(reset).completed,'A new life inherited the repaired box');
  check(!reset.memories.some(m=>m.id===M.MEMORY_BOX_MEMORY.id),'A new life kept the old box reward');return {repaired:false,completed:false,memoryCleared:true};
 },page);
 await context.close();
})().catch(error=>{report.fatalError=error.stack;console.error(error)}).finally(async()=>{
 if(browser)await browser.close();report.completedAt=new Date().toISOString();report.passed=report.checks.filter(row=>row.status==='pass').length;report.failed=report.checks.filter(row=>row.status==='fail').length;
 fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 console.log('RESULT',JSON.stringify({passed:report.passed,failed:report.failed,errors:report.errors,resourceFailures:report.resourceFailures,externalRequests:report.externalRequests,fatalError:report.fatalError||null}));
 if(report.failed||report.errors.length||report.resourceFailures.length||report.externalRequests.length||report.fatalError)process.exitCode=1;
});
