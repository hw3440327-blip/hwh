// Exercise closing and reopening the app's dedicated browser profile.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),url='http://127.0.0.1:19842/hwh/';
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'next-spring-desktop-profile-'));
const report={version:JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version,passed:false,errors:[],externalRequests:[],scope:'Persistent Chromium profile on Linux, using the same stable local origin. This is not a Windows GUI launch test.'};
let context;
(async()=>{
 const E=await import(path.join(root,'src/engine.js')),T=await import(path.join(root,'src/townDay.js'));
 let game=E.finishIntroduction(E.createGame('桌面续玩','pause'),{name:'桌面续玩',origin:'pause'});game=T.performTownAction(game,{type:'visit',place:'bakery'});
 async function launch(){const c=await chromium.launchPersistentContext(profile,{headless:true,executablePath:'/usr/bin/chromium',viewport:{width:1440,height:1000},args:['--no-sandbox','--disable-dev-shm-usage','--disable-background-mode']});
  await c.route('**/*',r=>{if(new URL(r.request().url()).origin===new URL(url).origin)return r.continue();report.externalRequests.push(r.request().url());return r.abort();});
  return c;
 }
 context=await launch();await context.addInitScript(({game,key})=>{if(!localStorage.getItem(key)){localStorage.setItem(key,JSON.stringify(game));localStorage.setItem('next-spring-preferences-v1',JSON.stringify({textSpeed:0,autoNarration:false}));}},{game,key:E.STORAGE_KEY});
 let page=context.pages()[0];page.on('pageerror',e=>report.errors.push(e.message));await page.goto(url,{waitUntil:'domcontentloaded'});
 async function open(p){await p.getByRole('button',{name:'走进初秋的三天',exact:true}).click();await p.getByRole('button',{name:'走近面包房工作台，亲手过一个下午',exact:true}).click();}
 await open(page);const box=page.getByRole('dialog',{name:'面包房里的一个下午',exact:true});
 for(const name of ['推开面包房的门','把外套挂到门边木钩','走到面包房工作台前','舀面粉进木碗'])await box.getByRole('button',{name,exact:true}).click();
 for(let n=0;n<10;n++)await box.locator('[data-bakery-object="water"]').press('Enter');
 await box.getByRole('button',{name:'离开面包房，回到小镇',exact:true}).click();
 const saved=await page.evaluate(k=>localStorage.getItem(k),E.STORAGE_KEY);if(JSON.parse(saved).bakeryLife.batch.water!==40)throw Error('The test did not create a real measured mixture');
 await context.close();context=await launch();page=context.pages()[0];page.on('pageerror',e=>report.errors.push(e.message));await page.goto(url,{waitUntil:'domcontentloaded'});
 const restored=await page.evaluate(k=>localStorage.getItem(k),E.STORAGE_KEY);
 if(restored!==saved)throw Error('Closing and reopening the dedicated browser profile changed the save');
 await open(page);const text=await page.getByRole('dialog',{name:'面包房里的一个下午',exact:true}).locator('.bl-bowl-note').innerText();if(!text.includes('40 ml'))throw Error('The saved measured dough is not playable after relaunch');
 report.saveSHA256=crypto.createHash('sha256').update(saved).digest('hex');report.flour=100;report.water=40;report.passed=true;
})().catch(e=>{report.error=e.stack;process.exitCode=1;}).finally(async()=>{await context?.close();fs.writeFileSync(path.join(root,'release',`desktop-v${report.version}-profile.json`),JSON.stringify(report,null,2)+'\n');fs.rmSync(profile,{recursive:true,force:true});console.log(JSON.stringify(report));if(report.errors.length||report.externalRequests.length)process.exitCode=1;});
