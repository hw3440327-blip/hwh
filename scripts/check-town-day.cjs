// Optional end-to-end acceptance checks. Requires Playwright and Chromium.
// Run against the production website, or stream the standalone HTML with
// TOWN_TEST_URL=... TOWN_OFFLINE=1. No source/model state is injected after start.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const url = process.env.TOWN_TEST_URL || 'http://127.0.0.1:4173/hwh/';
const offline = process.env.TOWN_OFFLINE === '1';
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const check = (value, message) => { if (!value) throw new Error(message); };
const releaseTag = 'v' + JSON.parse(fs.readFileSync(path.join(root, 'package.json'))).version;
const output = path.join(root, 'release', `town-${releaseTag}-${offline ? 'offline' : 'browser'}.json`);
const report = { version: JSON.parse(fs.readFileSync(path.join(root, 'package.json'))).version,
  startedAt: new Date().toISOString(), url, offline, checks: [], errors: [], resourceFailures: [], externalRequests: [], cancelledRequests: [] };
let browser;

(async () => {
  const E = await import(path.join(root, 'src/engine.js'));
  const T = await import(path.join(root, 'src/townDay.js'));
  const N = (await import(path.join(root, 'src/narrationClips.js'))).NARRATION_MANIFEST;
  const original = E.finishIntroduction(E.createGame('小晴', 'pause'), { name: '小晴', origin: 'pause' });
  const legacy = { ...original }; delete legacy.townDay;
  const storySnapshot = g => JSON.stringify({ name:g.name, sceneId:g.sceneId, history:g.history,
    flags:g.flags, energy:g.energy, money:g.money, connection:g.connection, visited:g.visited });
  const initialStory = storySnapshot(legacy);
  browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-dev-shm-usage'] });

  async function test(name, fn, page) {
    try {
      const details = await fn(); report.checks.push({ name, status:'pass', details });
      console.log('PASS', name, JSON.stringify(details || {}));
    } catch(error) {
      const index = report.checks.length;
      if(page && !page.isClosed()) {
        await page.screenshot({ path:path.join(root,'release',`town-${releaseTag}-failure-${offline?'offline-':''}${index}.png`),fullPage:true }).catch(()=>{});
      }
      report.checks.push({ name, status:'fail', error:error.stack }); console.log('FAIL', name, error.message);
    }
  }
  async function setup(g=legacy, options={}) {
    const context = await browser.newContext({ viewport:{width:1440,height:1000},acceptDownloads:true,...options });
    await context.addInitScript(({g,key}) => {
      if(!localStorage.getItem('town-qa-initialized')) {
        localStorage.setItem(key,JSON.stringify(g)); localStorage.setItem('town-qa-initialized','1');
        localStorage.setItem('next-spring-preferences-v1',JSON.stringify({textSpeed:0,autoNarration:false,quietMotion:false,filmMotion:true}));
      }
      const Native=window.Audio; window.__townAudios=[];
      window.Audio=class extends Native { constructor(...args){ super(...args);window.__townAudios.push(this); } };
    },{g,key:E.STORAGE_KEY});
    if(offline) await context.route('**/*',route => {
      const r=route.request();
      if(r.isNavigationRequest() && r.url()===url) return route.continue();
      report.externalRequests.push(r.url()); return route.abort();
    });
    const page=await context.newPage(); page.setDefaultTimeout(15000);
    page.on('pageerror',error=>report.errors.push(error.message));
    page.on('requestfailed',r=>{const failure={url:r.url(),error:r.failure()?.errorText};
      // Browsers cancel media byte ranges on pause and outstanding work on navigation.
      // Keep these observable separately; actual resource errors and HTTP failures fail QA.
      if(failure.error==='net::ERR_ABORTED')report.cancelledRequests.push(failure);
      else report.resourceFailures.push(failure);
    });
    page.on('response',response=>{if(response.status()>=400)report.resourceFailures.push({url:response.url(),status:response.status()});});
    return {context,page};
  }
  async function navigate(context,page,reload=false) {
    if(offline) await context.setOffline(false);
    if(reload) await page.reload({waitUntil:'domcontentloaded',timeout:60000});
    else await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
    if(offline) await context.setOffline(true);
  }
  const save = page => page.evaluate(key=>JSON.parse(localStorage.getItem(key)),E.STORAGE_KEY);
  const state = async page => T.townProgress(await save(page));
  const town = page => page.getByRole('dialog',{name:'初秋的三天',exact:true});
  const button = (page,name) => town(page).getByRole('button',{name,exact:true});
  const painting = page => town(page).locator('.td-painting:not(.td-painting-previous) .film-poster');
  async function openTown(page) {
    await page.getByRole('button',{name:'走进初秋的三天',exact:true}).click();
    await town(page).waitFor(); await page.waitForFunction(()=>document.querySelector('[data-town-place] .td-painting:not(.td-painting-previous) img')?.naturalWidth>0);
  }
  async function closeTown(page) { await button(page,'收好这一天，回到故事').click();await town(page).waitFor({state:'detached'}); }
  const placeNames=Object.fromEntries(T.TOWN_PLACES.map(place=>[place.id,place.name]));
  async function go(page,place) {
    if((await state(page)).place===place) return;
    await button(page,'打开小镇地图').click(); await button(page,'去'+placeNames[place]).click();
    await page.waitForFunction(place=>document.querySelector('[data-town-place]')?.dataset.townPlace===place,place);
    await painting(page).evaluate(img=>img.decode());
  }
  async function dismiss(page) { await page.keyboard.press('Escape');check(await town(page).count()===1,'Escape unexpectedly closed the whole town'); }
  async function talk(page,person,reply=true) {
    const names={lin:'林姨',he:'阿禾',zhou:'周予'};
    await button(page,'和'+names[person]+'聊聊').first().click();
    const choices=town(page).locator('[data-town-reply]');
    if(reply && await choices.count()) await choices.first().click();
    return town(page).locator('.td-panel').innerText();
  }
  async function craft(page,{recipe='milk',shape='twist',pointer=false}={}) {
    await go(page,'bakery'); await button(page,'在面包房烤一炉面包').click();
    if((await state(page)).craft.baked)await button(page,'再做一炉').click();
    await town(page).locator(`[data-town-recipe="${recipe}"]`).click();
    await town(page).locator(`[data-town-shape="${shape}"]`).click();
    for(const ingredient of T.TOWN_RECIPES.find(item=>item.id===recipe).ingredients) {
      await button(page,'加入'+ingredient.label).click();
    }
    const knead=button(page,'轻轻揉一下面团');
    if(pointer) {
      const box=await knead.boundingBox();await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);
      await page.mouse.down();await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5+55,{steps:7});await page.mouse.up();
      check((await state(page)).craft.kneads===1,'Pointer drag did not count exactly one knead');
    }
    while((await state(page)).craft.kneads<3) { await knead.focus();await knead.press('Enter'); }
    const heat=town(page).getByRole('slider',{name:'调整面包炉火',exact:true});await heat.focus();
    for(let n=0;n<30&&Number(await heat.inputValue())!==180;n++)await heat.press(Number(await heat.inputValue())<180?'ArrowRight':'ArrowLeft');
    check(Number(await heat.inputValue())===180,'Keyboard could not set the oven temperature');
    await button(page,'把面团送进烤箱').click();
    return (await state(page)).breads.at(-1);
  }
  async function gift(page,person,bread) {
    const textBefore=await talk(page,person,false);
    await town(page).getByRole('combobox',{name:'挑选送出的面包',exact:true}).selectOption(bread.id);
    await button(page,'送出这只面包').click();return {textBefore,textAfter:await town(page).locator('.td-panel').innerText()};
  }
  async function rest(page,nextDay) {
    await go(page,'room');await button(page,'让今天慢慢结束').click();
    await button(page,nextDay===2?'睡到第二天':'睡到第三天').click();
    check((await state(page)).day===nextDay,'Rest did not move to the requested day');
  }
  async function journal(page,tab='这段旅程') {
    await page.getByRole('button',{name:'打开旅程手记',exact:true}).click();
    await page.locator('.journey-tabs button').filter({hasText:tab}).click();
  }
  const {context,page}=await setup();
  let dayOneBread,exportedPayload,fullTown;
  await test('the browser target matches the exact production build or standalone artifact',async()=>{
    const response=await fetch(url);check(response.ok,'The browser target cannot be fetched');
    const entry=Buffer.from(await response.arrayBuffer());
    if(offline) {
      const artifact=fs.readFileSync(path.join(root,'release','下一次春天-电影生活版.html'));
      check(digest(entry)===digest(artifact),'The streamed standalone differs from the packaged artifact');
      report.artifact={file:'下一次春天-电影生活版.html',bytes:entry.length,sha256:digest(entry)};
      report.buildFingerprint={version:report.version,...report.artifact};
    } else {
      const manifestBytes=fs.readFileSync(path.join(root,'release',`web-build-v${report.version}.json`));
      const manifest=JSON.parse(manifestBytes),record=manifest.files.find(item=>item.file==='index.html');
      check(manifest.version===report.version&&record.sha256===digest(entry)&&record.bytes===entry.length,'The target is not the current production entry');
      const javascript=entry.toString().match(/<script\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1];
      check(javascript,'The production entry has no external JavaScript');
      const jsURL=new URL(javascript,url),jsResponse=await fetch(jsURL);check(jsResponse.ok,'The production script cannot be fetched');
      const jsBytes=Buffer.from(await jsResponse.arrayBuffer());
      const jsRecord=manifest.files.find(item=>new URL(item.url,new URL(url).origin).pathname===jsURL.pathname);
      check(jsRecord&&jsRecord.sha256===digest(jsBytes)&&jsRecord.bytes===jsBytes.length,'The runtime script differs from the current build');
      report.buildFingerprint={version:manifest.version,entry:{bytes:entry.length,sha256:digest(entry)},
        javascript:{file:jsRecord.file,bytes:jsBytes.length,sha256:digest(jsBytes)},assetManifestSha256:digest(manifestBytes)};
    }
    return report.buildFingerprint;
  },page);

  await test('legacy journeys discover the town directly and through the journal',async()=>{
    await navigate(context,page);await openTown(page);await closeTown(page);
    await page.getByRole('button',{name:'继续这段人生',exact:true}).click();
    check(storySnapshot(await save(page))===initialStory,'Loading a legacy journey changed its story');
    await openTown(page);check((await state(page)).day===1,'Legacy journeys did not start on day one');
    check(await town(page).locator('video').count()===0,'Town replaced the painting with a deforming movie');
    await closeTown(page);await journal(page,'小镇日常');await openTown(page);
    return {legacySave:true,titleEntry:true,storyEntry:true,journalEntry:true,firstDay:1};
  },page);

  await test('spatial exploration reveals a preference and a daily conversation records the chosen reply',async()=>{
    await go(page,'bakery');await town(page).locator('[data-town-hotspot="bakery-recipe"]').click();
    check((await state(page)).explored.includes('bakery-recipe'),'The recipe clue was not recorded');
    const clue=await town(page).locator('.td-panel').innerText();check(clue.includes('林姨'),'The clue does not connect to a resident');
    check(!clue.split('\n').some(line=>['lin','he','zhou'].includes(line.trim())),'An internal resident ID leaked into the discovery copy');
    await dismiss(page);const conversation=await talk(page,'lin');check((await state(page)).talks['1:lin'],'The chosen reply was not saved');
    await dismiss(page);await page.screenshot({path:path.join(root,'release',`town-${releaseTag}-${offline?'offline-':''}bakery.png`)});
    return {clue,conversation,chosenReply:(await state(page)).talks['1:lin']};
  },page);

  await test('recipe, shape, actual pointer kneading and keyboard oven control produce a custom loaf',async()=>{
    dayOneBread=await craft(page,{recipe:'milk',shape:'twist',pointer:true});
    check(dayOneBread && dayOneBread.recipe==='milk' && dayOneBread.shape==='twist','The resulting loaf does not preserve its recipe and shape');
    check((await state(page)).breads.length===1,'One baking session created duplicate loaves');
    await page.screenshot({path:path.join(root,'release',`town-${releaseTag}-${offline?'offline-':''}bread.png`)});
    await dismiss(page);return {bread:dayOneBread,pointerKneading:true,keyboardKneading:true,keyboardTemperature:180};
  },page);

  await test('gifting the actual loaf changes the resident response and consumes it once',async()=>{
    const feedback=await gift(page,'lin',dayOneBread);
    check(feedback.textBefore!==feedback.textAfter,'Giving the loaf produced no visible response');
    const progress=await state(page);check(JSON.stringify(progress.gifts).includes(dayOneBread.id),'The actual gifted loaf was not recorded');
    await dismiss(page);return {feedback,gifts:progress.gifts};
  },page);

  await test('the other places and residents can be explored freely without advancing the main story',async()=>{
    const visited=[];
    for(const [place,person] of [['bookshop','he'],['workshop','zhou'],['shore',null]]) {
      await go(page,place);const point=town(page).locator('[data-town-hotspot]').first();
      const id=await point.getAttribute('data-town-hotspot');await point.click();await dismiss(page);
      if(person){await talk(page,person);await dismiss(page)}visited.push({place,clue:id});
    }
    check(storySnapshot(await save(page))===initialStory,'Exploring the town changed the main timeline or resources');
    return {visited,talks:(await state(page)).talks};
  },page);

  await test('a chosen room object and a personal card remain in the scene',async()=>{
    await go(page,'room');await button(page,'布置我的小屋').click();
    await button(page,'选择窗台').click();await town(page).locator('[data-town-decoration="flower"]').click();
    const input=town(page).getByRole('textbox');await input.fill('春'.repeat(45));
    const boundedCard=await input.inputValue();check([...boundedCard].length===40,'The card input does not enforce its displayed 40-character limit');
    await button(page,'收好这句话').click();check((await state(page)).card===boundedCard,'A long card silently lost typed characters when saved');
    await input.fill('雨停以后，也给自己留一点温柔。');
    await button(page,'收好这句话').click();
    const progress=await state(page);check(progress.decor.window?.item==='flower','The chosen decoration was not placed on the window');
    check(progress.card==='雨停以后，也给自己留一点温柔。','The personal card was not saved');
    await dismiss(page);await page.screenshot({path:path.join(root,'release',`town-${releaseTag}-${offline?'offline-':''}room.png`)});
    return {decor:progress.decor,card:progress.card};
  },page);

  await test('the next day remembers the actual gift and advances the flower',async()=>{
    await rest(page,2);const progress=await state(page);
    check(progress.decor.window?.placedDay===1,'The flower forgot when it was placed');
    const roomText=await town(page).innerText();
    check(await town(page).locator('[data-town-slot="window"]').getAttribute('data-town-growth')==='1','The flower did not visibly advance on the second day');
    await go(page,'bakery');const remembered=await talk(page,'lin',false);
    check(/昨天|昨日|上次/.test(remembered),'The next-day conversation does not recall the previous meeting');
    check(remembered.includes('奶')||remembered.includes(dayOneBread.name||dayOneBread.title||'奶香'),'The reply does not refer to the actual gifted recipe');
    const replies=town(page).locator('[data-town-reply]');if(await replies.count())await replies.first().click();
    await dismiss(page);return {day:progress.day,flowerPlacedDay:progress.decor.window.placedDay,roomText,remembered};
  },page);

  await test('different gifts receive their own response and three days form one saved memory',async()=>{
    const second=await craft(page,{recipe:'fruit',shape:'leaf'});await dismiss(page);
    const feedback=await gift(page,'lin',second);check(feedback.textAfter.includes('林姨'),'The resident response disappeared');await dismiss(page);
    await rest(page,3);await go(page,'bakery');const dayThree=await talk(page,'lin');await dismiss(page);
    await go(page,'room');await button(page,'让今天慢慢结束').click();await button(page,'收好初秋的三天').click();
    const saved=await save(page);check(T.townProgress(saved).completed===true,'The three days did not finish');
    check(saved.memories.filter(m=>m.id===T.TOWN_MEMORY.id).length===1,'The episode memory is missing or duplicated');
    check(storySnapshot(saved)===initialStory,'Finishing the episode changed the main story or economic resources');
    fullTown=T.townProgress(saved);return {secondLoaf:second,feedback,dayThree,memory:T.TOWN_MEMORY.id};
  },page);

  await test('closing, reopening and reloading keep the episode and main story',async()=>{
    if(await town(page).count())await closeTown(page);
    if(await page.getByRole('dialog',{name:'旅程手记',exact:true}).count())await page.getByRole('button',{name:'返回故事',exact:true}).click();
    await openTown(page);check(JSON.stringify(await state(page))===JSON.stringify(fullTown),'Reopening lost the episode');await closeTown(page);
    await navigate(context,page,true);await page.getByRole('button',{name:'继续这段人生',exact:true}).click();await openTown(page);
    check(JSON.stringify(await state(page))===JSON.stringify(fullTown),'Reloading lost the episode');await closeTown(page);
    return {completed:true,threeDayStatePreserved:true,mainStoryPreserved:true};
  },page);

  await test('real exported JSON and imported legacy/current journeys retain legal town state',async()=>{
    await journal(page);const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'收藏这段旅程',exact:true}).click();
    const download=await downloaded;exportedPayload=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
    check(JSON.stringify(T.townProgress(exportedPayload.save))===JSON.stringify(fullTown),'Export did not include the town episode');
    async function importJSON(value) {
      await page.getByRole('button',{name:'从存档继续',exact:true}).click();
      await page.getByRole('button',{name:'选择存档并继续',exact:true}).click({noWaitAfter:true});
      await page.locator('input[aria-label="导入旅程文件"]').setInputFiles({name:'验收旅程.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});
      await page.getByRole('dialog',{name:'旅程手记',exact:true}).waitFor({state:'detached'});
    }
    await importJSON({save:legacy});check((await state(page)).day===1 && !(await state(page)).completed,'A legacy import retained the previous episode');
    await journal(page);await importJSON(exportedPayload);
    check(JSON.stringify(await state(page))===JSON.stringify(fullTown),'Import lost a legal completed episode');
    return {downloadName:download.suggestedFilename(),legacyMigration:true,currentSaveRoundTrip:true};
  },page);
  await test('nested Escape and keyboard focus stay in the active layer and return to the trigger',async()=>{
    await openTown(page);await button(page,'打开小镇地图').click();
    for(let n=0;n<18;n++) {
      await page.keyboard.press(n%3===0?'Shift+Tab':'Tab');
      check(await town(page).evaluate(el=>el.contains(document.activeElement)),'Keyboard focus escaped the active town');
    }
    await page.keyboard.press('Escape');check(await town(page).count()===1,'Escape closed both the map and the town');
    check(await button(page,'打开小镇地图').evaluate(el=>el===document.activeElement),'Closing the map did not restore focus');
    await page.keyboard.press('Escape');await town(page).waitFor({state:'detached'});
    check(await page.getByRole('button',{name:'走进初秋的三天',exact:true}).evaluate(el=>el===document.activeElement),'Closing the town did not restore focus to its entry');
    return {focusContained:true,mapAndTownCloseSeparately:true,focusRestored:true};
  },page);

  await test('the source painting stays fixed and reduced motion preserves its resolution',async()=>{
    await openTown(page);await go(page,'bookshop');await painting(page).evaluate(img=>img.decode());await page.waitForTimeout(900);
    await page.setViewportSize({width:2560,height:1440});await page.waitForTimeout(300);
    const geometry=await painting(page).evaluate(img=>{const rect=img.getBoundingClientRect(),plane=img.closest('.td-scene-map').getBoundingClientRect();return {width:img.naturalWidth,height:img.naturalHeight,cssWidth:rect.width,cssHeight:rect.height,planeWidth:plane.width,planeHeight:plane.height,
      transform:getComputedStyle(img).transform,filter:getComputedStyle(img).filter,objectFit:getComputedStyle(img).objectFit}});
    check(geometry.width===7680&&geometry.transform==='none'&&geometry.filter==='none','Town filters or replaces the original painting');
    check(Math.abs((geometry.cssWidth/geometry.cssHeight)/(geometry.width/geometry.height)-1)<.001,'The wide-screen image is stretched away from the painting aspect ratio');
    check(Math.abs((geometry.planeWidth/geometry.planeHeight)/(geometry.width/geometry.height)-1)<.001,'The wide-screen hotspot canvas does not match the painting');
    const hide=await page.addStyleTag({content:'body *{visibility:hidden!important}[role="dialog"][aria-label="初秋的三天"] .film-poster{visibility:visible!important}'});
    const first=await page.screenshot();await page.waitForTimeout(1100);const second=await page.screenshot();
    check(digest(first)===digest(second),'Painting pixels move when environment overlays are hidden');await hide.evaluate(el=>el.remove());
    await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>!document.querySelector('[data-town-place] .scene-motion'));
    check(await painting(page).evaluate(img=>img.naturalWidth)===7680,'Reduced motion changed the original resolution');
    await page.emulateMedia({reducedMotion:'no-preference'});await page.screenshot({path:path.join(root,'release',`town-${releaseTag}-${offline?'offline-':''}wide.png`)});
    await page.setViewportSize({width:1440,height:1000});await closeTown(page);return {geometry,basePixelsStable:true,reducedMotionPreservesPainting:true};
  },page);

  await test('the selected first reference voice plays in the story and pauses while exploring',async()=>{
    const {context:voiceContext,page:voicePage}=await setup();
    try {
      await navigate(voiceContext,voicePage);await voicePage.getByRole('button',{name:'继续这段人生',exact:true}).click();
      await voicePage.getByRole('button',{name:'开启故事朗读',exact:true}).click();
      await voicePage.waitForFunction(()=>window.__townAudios.some(audio=>!audio.paused&&audio.currentTime>.15));
      const played=await voicePage.evaluate(()=>{const audio=window.__townAudios.find(a=>!a.paused);return {src:audio.currentSrc,time:audio.currentTime,error:audio.error?.code||null,edition:localStorage.getItem('next-spring-voice-edition-v1')}});
      check(played.edition===N.voice.voiceConfigHash&&!played.error,'The selected reference voice changed or failed');
      if(played.src.startsWith('data:'))check(digest(Buffer.from(played.src.split(',')[1],'base64'))==='0f9d4f91770ec21a81353431cdfe1730895e0d4f113b0b3e3d156d40e67a22e6','The embedded opening is not the selected first reference');
      else check(played.src.includes('/1c9a5c2cd357d71486be5e588d296f876ebc8bc9bcb722a59ce1b8cfba8676f0.mp3'),'The opening recording changed');
      await openTown(voicePage);await voicePage.waitForFunction(()=>window.__townAudios.every(audio=>audio.paused));await go(voicePage,'bakery');await talk(voicePage,'lin',false);await voicePage.waitForTimeout(450);
      check(await voicePage.evaluate(()=>window.__townAudios.every(audio=>audio.paused)),'An unrelated main-story recording plays over the town conversation');
      return {voiceConfigHash:played.edition,recordedOpeningPlayed:true,oldStoryPausedInsideTown:true};
    } finally { await voiceContext.close(); }
  });

  await test('native phone gestures knead once, cancel safely, place an object and keep the scene within the screen',async()=>{
    const {context:mobileContext,page:mobile}=await setup(legacy,{viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    try {
      await navigate(mobileContext,mobile);await mobile.getByRole('button',{name:'继续这段人生',exact:true}).tap();await openTown(mobile);
      await go(mobile,'bakery');await button(mobile,'在面包房烤一炉面包').tap();
      await town(mobile).locator('[data-town-recipe="milk"]').tap();
      for(const ingredient of T.TOWN_RECIPES.find(item=>item.id==='milk').ingredients)await button(mobile,'加入'+ingredient.label).tap();
      const dough=button(mobile,'轻轻揉一下面团');await dough.scrollIntoViewIfNeeded();let box=await dough.boundingBox();
      const cdp=await mobileContext.newCDPSession(mobile);
      const touch=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:['touchEnd','touchCancel'].includes(type)?[]:[{x,y,radiusX:4,radiusY:4,force:1,id:1}]});
      await touch('touchStart',box.x+box.width/2,box.y+box.height/2);await touch('touchMove',box.x+box.width/2+18,box.y+box.height/2+48);await touch('touchEnd');
      check((await state(mobile)).craft.kneads===1,'A native finger drag did not count exactly one knead');
      box=await dough.boundingBox();await touch('touchStart',box.x+box.width/2,box.y+box.height/2);await touch('touchMove',box.x+box.width/2+18,box.y+box.height/2+48);await touch('touchCancel');
      check((await state(mobile)).craft.kneads===1,'A cancelled gesture still kneaded the dough');
      await dismiss(mobile);await go(mobile,'room');await button(mobile,'布置我的小屋').tap();
      const flower=town(mobile).locator('[data-town-decoration="flower"]'),slot=town(mobile).locator('[data-town-slot="window"]');
      await button(mobile,'选择窗台').tap();await mobile.waitForTimeout(350);
      await flower.scrollIntoViewIfNeeded();const source=await flower.boundingBox(),target=await slot.boundingBox(),drawer=await town(mobile).locator('.td-panel').boundingBox();
      check(source&&target&&target.x+target.width/2>=0&&target.x+target.width/2<=390&&target.y>=0&&target.y+target.height<=844,'The phone cannot reach a room drop target');
      const drop={x:target.x+target.width/2,y:target.y+target.height/2};
      check(!(drop.x>=drawer.x&&drop.x<=drawer.x+drawer.width&&drop.y>=drawer.y&&drop.y<=drawer.y+drawer.height),'The decoration drawer visually covers the room drop target');
      await touch('touchStart',source.x+source.width/2,source.y+source.height/2);await touch('touchMove',target.x+target.width/2,target.y+target.height/2);await touch('touchEnd');
      check((await state(mobile)).decor.window?.item==='flower','Native dragging did not place the decoration');
      await dismiss(mobile);const dims=await mobile.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth,dialog:document.querySelector('[role="dialog"][aria-label="初秋的三天"]').getBoundingClientRect().width}));
      check(dims.scroll<=dims.viewport&&dims.dialog<=dims.viewport+1,'The phone scene overflows horizontally');
      const imageShape=await painting(mobile).evaluate(img=>{const b=img.getBoundingClientRect(),m=img.closest('.td-scene-map').getBoundingClientRect();return {natural:[img.naturalWidth,img.naturalHeight],display:[b.width,b.height],plane:[m.width,m.height]}});
      check(Math.abs((imageShape.display[0]/imageShape.display[1])/(imageShape.natural[0]/imageShape.natural[1])-1)<.001,'The phone image is stretched');
      check(Math.abs((imageShape.plane[0]/imageShape.plane[1])/(imageShape.natural[0]/imageShape.natural[1])-1)<.001,'The phone hotspot canvas is stretched');
      await mobile.screenshot({path:path.join(root,'release',`town-${releaseTag}-${offline?'offline-':''}mobile.png`),fullPage:true});
      return {nativeCDPTouch:true,kneads:1,cancelDoesNotCommit:true,decorationPlaced:true,...dims,imageShape};
    } finally { await mobileContext.close(); }
  });

  check(report.externalRequests.length===0,'The standalone game requested external resources');
  await context.close();
})().catch(error=>{
  report.fatalError=error.stack;console.error(error);
}).finally(async()=>{
  if(browser)await browser.close();
  report.completedAt=new Date().toISOString();report.passed=report.checks.filter(item=>item.status==='pass').length;
  report.failed=report.checks.filter(item=>item.status==='fail').length;
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  console.log('RESULT',JSON.stringify({passed:report.passed,failed:report.failed,errors:report.errors,resourceFailures:report.resourceFailures,externalRequests:report.externalRequests,fatalError:report.fatalError||null}));
  if(report.failed||report.errors.length||report.resourceFailures.length||report.externalRequests.length||report.fatalError)process.exitCode=1;
});
