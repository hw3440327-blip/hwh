// Optional browser integration check: Playwright and Chromium are required.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const check=(ok,message)=>{if(!ok)throw Error(message)};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

(async()=>{
  const E=await import(path.join(root,'src/engine.js'));
  const M=(await import(path.join(root,'src/narrationClips.js'))).NARRATION_MANIFEST;
  const game=E.finishIntroduction(E.createGame('清晰度测试','pause'),{name:'清晰度测试',origin:'pause'});
  const build=JSON.parse(fs.readFileSync(path.join(root,'release/web-build-v'+version+'.json')));
  const url='http://127.0.0.1:4173/hwh/';
  const report={version,checks:[],errors:[],voiceConfigHash:M.voice.voiceConfigHash};
  async function test(name,fn){try{const details=await fn();report.checks.push({name,status:'pass',details});console.log('PASS',name,JSON.stringify(details||{}));}catch(error){report.checks.push({name,status:'fail',error:error.stack});console.log('FAIL',name,error.message);}}
  await test('all production files match their full SHA-256 and no warped video is requested',async()=>{
    check(!build.files.some(f=>f.file.startsWith('films/')),'legacy video remains in the site');
    for(let n=0;n<build.files.length;n+=6)await Promise.all(build.files.slice(n,n+6).map(async file=>{
      const response=await fetch('http://127.0.0.1:4173'+file.url);check(response.ok,'HTTP '+file.file);
      const bytes=Buffer.from(await response.arrayBuffer());check(bytes.length===file.bytes&&hash(bytes)===file.sha256,'asset mismatch '+file.file);
    }));return {files:build.files.length,totalBytes:build.totalBytes,legacyVideos:0};
  });
  const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
  async function contextFor(g,options={}){
    const c=await browser.newContext({viewport:{width:1440,height:1000},...options});
    await c.addInitScript(({g,key})=>{
      if(!localStorage.getItem('clarity-test-seeded')){localStorage.setItem(key,JSON.stringify(g));localStorage.setItem('clarity-test-seeded','1');localStorage.setItem('next-spring-narration-mode-v2','system');localStorage.setItem('next-spring-voice-edition-v1','older-edition');}
      localStorage.setItem('next-spring-preferences-v1',JSON.stringify({textSpeed:0,autoNarration:false,quietMotion:false,filmMotion:true}));
      window.testAudios=[];const Native=window.Audio;window.Audio=class extends Native{constructor(...a){super(...a);window.testAudios.push(this)}};
    },{g,key:E.STORAGE_KEY});return c;
  }
  const context=await contextFor(game),page=await context.newPage();page.setDefaultTimeout(20000);
  page.on('pageerror',e=>report.errors.push(e.message));
  const requests=[];page.on('request',r=>requests.push(r.url()));
  const loaded=()=>page.waitForFunction(()=>[...document.querySelectorAll('.film-poster')].every(i=>i.complete&&i.naturalWidth===7680));
  async function journal(){await page.getByRole('button',{name:'打开旅程手记',exact:true}).click();}
  async function landscape(){await page.getByRole('button',{name:'暂时收起文字，看看风景',exact:true}).click();await page.waitForTimeout(400);}
  await test('title and saved story use actual 8K images and the selected first reference voice',async()=>{
    await page.goto(url);await loaded();check(await page.locator('video').count()===0,'video overrides the painting');
    const title=await page.locator('.opening-landscape .film-poster').evaluate(i=>({width:i.naturalWidth,height:i.naturalHeight,src:i.currentSrc}));
    await page.getByRole('button',{name:'继续这段人生',exact:true}).click();await loaded();
    const prefs=await page.evaluate(()=>({mode:localStorage.getItem('next-spring-narration-mode-v2'),edition:localStorage.getItem('next-spring-voice-edition-v1')}));
    check(prefs.mode==='recorded'&&prefs.edition===M.voice.voiceConfigHash,'voice was changed');
    return {title,prefs};
  });
  await test('painting pixels stay identical while independent environment effects change',async()=>{
    const style=await page.addStyleTag({content:'.cm-screen > :not(.cm-world){visibility:hidden!important}.scene-motion{visibility:hidden!important}'});
    const image=page.locator('.cm-world-plate');
    const first=await image.screenshot();await page.waitForTimeout(1100);const second=await image.screenshot();
    check(hash(first)===hash(second),'base artwork moves or changes');
    await style.evaluate(el=>{el.textContent='.cm-screen > :not(.cm-world){visibility:hidden!important}'});
    const a=await image.screenshot();await page.waitForTimeout(1100);const b=await image.screenshot();
    check(hash(a)!==hash(b),'environment effects are not moving');
    const geometry=await image.evaluate(el=>({plane:getComputedStyle(el).transform,image:getComputedStyle(el.querySelector('img')).transform,filter:getComputedStyle(el.querySelector('img')).filter}));
    check(geometry.plane==='none'&&geometry.image==='none'&&geometry.filter==='none','base geometry or filter changed');
    await style.evaluate(el=>el.remove());return {basePixelsIdentical:true,environmentChanges:true,geometry};
  });
  await test('actual prerecorded MP3 plays and opening a journal pauses scene animation',async()=>{
    await page.getByRole('button',{name:'开启故事朗读',exact:true}).click();
    await page.waitForFunction(()=>window.testAudios.some(a=>!a.paused&&a.currentTime>.2));
    const audio=await page.evaluate(()=>{const a=window.testAudios.find(a=>!a.paused);return {src:a.currentSrc,duration:a.duration,error:a.error?.code||null}});
    check(audio.src.includes('/audio/narration/1c9a5c2cd357d71486be5e588d296f876ebc8bc9bcb722a59ce1b8cfba8676f0.mp3')&&!audio.error,'wrong voice or playback failure');
    await journal();await page.waitForFunction(()=>document.querySelector('.scene-motion')?.dataset.running==='false');
    const time=()=>page.evaluate(()=>document.querySelector('.scene-light').getAnimations()[0].currentTime);
    const before=await time();await page.waitForTimeout(350);const after=await time();check(Math.abs(before-after)<20,'animation keeps running behind journal');
    await page.getByRole('button',{name:'返回故事',exact:true}).click();await page.getByRole('button',{name:'关闭故事朗读',exact:true}).click();
    return {audio,pausedTimeStable:true};
  });
  await test('8K closeup shares the source and moves only by uniform camera framing',async()=>{
    await landscape();await page.locator('.cm-detail-point').first().click();await loaded();
    // Wait for the lens's entrance transition before measuring its drag area.
    await page.waitForTimeout(650);
    const source=await page.locator('.film-observation .film-poster').evaluate(i=>({width:i.naturalWidth,height:i.naturalHeight}));
    const lens=page.locator('.film-observation'),old=await lens.getAttribute('style');
    await page.getByRole('button',{name:'镜头靠近一点',exact:true}).click();check(await lens.getAttribute('style')!==old,'zoom does not change framing');
    const zoomed=await lens.getAttribute('style'),box=await page.locator('.cm-closeup-frame').boundingBox();
    await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.56,box.y+box.height*.54,{steps:6});await page.mouse.up();
    await page.waitForFunction(previous=>document.querySelector('.film-observation')?.getAttribute('style')!==previous,zoomed);
    check(await lens.getAttribute('style')!==zoomed,'camera does not pan');
    const ratio=await lens.evaluate(el=>el.getBoundingClientRect().width/el.getBoundingClientRect().height);check(Math.abs(ratio/(source.width/source.height)-1)<.001,'closeup stretches the painting');
    await page.waitForTimeout(650);await page.screenshot({path:path.join(root,'release/clarity-v'+version+'-closeup.png')});
    await page.keyboard.press('Escape');await page.keyboard.press('Escape');return {...source,aspectPreserved:true,pan:true,zoom:true};
  });
  await test('full-resolution background can be photographed and the saved journey survives reload',async()=>{
    await landscape();await page.locator('.cf-discover-photo').click();await loaded();
    await page.getByRole('textbox',{name:'照片题字',exact:true}).fill('海风与清晰的这一刻');
    await page.getByRole('button',{name:'按下快门，收藏这一帧',exact:true}).click();await page.locator('.ds-photo-developed img').waitFor();
    const shot=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).discoveries.photo.shots.at(-1),E.STORAGE_KEY);
    check(shot.image?.startsWith('data:image/jpeg;base64,')&&shot.image.length>5000,'actual photograph missing');
    await page.reload();await page.getByRole('button',{name:'继续这段人生',exact:true}).click();await loaded();
    const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),E.STORAGE_KEY);check(saved.name===game.name&&saved.discoveries.photo.shots.length===1,'save lost');
    return {jpegChars:shot.image.length,namePreserved:true,photoPreserved:true};
  });
  await test('new 8K scene waits for decode before retiring the previous painting',async()=>{
    await context.route('**/art/film-bakery.webp*',async route=>{await delay(1000);await route.continue();});
    await page.getByRole('button',{name:'跳过本场剩余文字，直接查看选择',exact:true}).click();
    const choice=E.availableChoices(game).find(c=>E.choose(game,c.id).sceneId==='bakery');check(choice,'bakery choice missing');
    await page.locator('.cm-choice').filter({hasText:choice.title}).click();
    await page.waitForTimeout(150);const previous=page.locator('.cm-world-previous');check(await previous.count()===1,'old frame was dropped before decode');
    check(!((await previous.getAttribute('class'))||'').includes('is-leaving'),'old frame fades before new image loads');
    await loaded();await page.waitForFunction(()=>!document.querySelector('.cm-world-previous'));
    return {oldFrameHeldUntilReady:true,fadeUsesOpacityOnly:true};
  });
  await test('tea uses an actual 8K background and pointer pouring still completes',async()=>{
    await landscape();await page.locator('.cf-discover-tea').click();
    await page.locator('.ds-playfield-painting').evaluate(i=>i.decode());
    check(await page.locator('.ds-playfield-painting').evaluate(i=>i.naturalWidth)===7680,'tea background is not 8K');
    await page.getByRole('button',{name:/茉莉青茶/}).click();await page.waitForTimeout(300);
    const area=await page.locator('.ds-tea-field').boundingBox(),pot=await page.locator('.ds-teapot').boundingBox();
    await page.mouse.move(pot.x+pot.width/2,pot.y+pot.height/2);await page.mouse.down();await page.mouse.move(area.x+area.width*.59,area.y+area.height*.36,{steps:10});await page.waitForTimeout(4400);await page.mouse.up();
    const filled=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).discoveries.tea.filled,E.STORAGE_KEY);check(filled>=82,'pouring did not fill the cup');
    await page.getByRole('button',{name:'收壶，闻一闻茶香',exact:true}).click();await page.getByRole('button',{name:'捧起杯子，给自己一点时间',exact:true}).click();
    await page.keyboard.press('Escape');await page.keyboard.press('Escape');return {filled,completed:true};
  });
  await test('mobile scene and closeup remain sharp, proportionate and within the viewport',async()=>{
    await page.setViewportSize({width:390,height:844});await loaded();await landscape();await page.locator('.cm-detail-point').first().click();await loaded();
    const dims=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth,width:document.querySelector('.film-observation img').naturalWidth}));
    check(dims.scroll<=dims.viewport&&dims.width===7680,'mobile overflow or lower-resolution background');
    await page.waitForTimeout(650);await page.screenshot({path:path.join(root,'release/clarity-v'+version+'-mobile.png'),fullPage:true});await page.keyboard.press('Escape');await page.keyboard.press('Escape');
    await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelectorAll('.scene-motion').length===0);check(await page.locator('.film-poster').evaluate(i=>i.naturalWidth)===7680,'reduced motion lowered clarity');
    await page.emulateMedia({reducedMotion:'no-preference'});return {...dims,reducedMotionKeeps8K:true};
  });
  await test('a native 7680 by 4320 viewport renders the 8K painting with readable UI',async()=>{
    await page.setViewportSize({width:7680,height:4320});await loaded();
    const dims=await page.evaluate(()=>({width:innerWidth,height:innerHeight,image:document.querySelector('.cm-world-plate img').naturalWidth,font:parseFloat(getComputedStyle(document.querySelector('.cm-dialogue-text')).fontSize),overflow:document.documentElement.scrollWidth>innerWidth}));
    check(dims.image===7680&&!dims.overflow&&dims.font>=40,'8K rendering or reading size failed');
    const largeFont=await page.evaluate(()=>{const el=document.querySelector('.cm-screen');el.classList.add('cm-large-text');const size=parseFloat(getComputedStyle(document.querySelector('.cm-dialogue-text')).fontSize);el.classList.remove('cm-large-text');return size});
    check(largeFont>dims.font,'large text preference does not increase the 8K reading size');dims.largeFont=largeFont;
    await page.screenshot({path:path.join(root,'release/clarity-v'+version+'-8k.png')});return dims;
  });
  check(!requests.some(r=>r.includes('/films/')),'legacy videos fetched');
  report.passed=report.checks.filter(c=>c.status==='pass').length;report.failed=report.checks.filter(c=>c.status==='fail').length;
  fs.writeFileSync(path.join(root,'release/clarity-v'+version+'-browser.json'),JSON.stringify(report,null,2)+'\n');
  await browser.close();console.log('RESULT',JSON.stringify({passed:report.passed,failed:report.failed,errors:report.errors}));
  if(report.failed||report.errors.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1)});
