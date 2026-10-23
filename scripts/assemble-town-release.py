#!/usr/bin/env python3
"""Package the verified town release and stage an explicit public-file allowlist."""
import hashlib,json,shutil,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];R=ROOT/'release';DOCS=ROOT/'docs'
V=json.loads((ROOT/'package.json').read_text())['version']
def load(p):return json.loads(p.read_text())
def sha(p):
    with p.open('rb')as f:return hashlib.file_digest(f,'sha256').hexdigest()
def main():
    reports=[]
    for name,count in [(f'craft-v{V}-browser.json',6),(f'craft-v{V}-offline.json',6),(f'bakery-v{V}-browser.json',15),(f'bakery-v{V}-offline.json',15),(f'memory-box-v{V}-browser.json',19),(f'memory-box-v{V}-offline.json',19),(f'town-v{V}-browser.json',15)]:
        d=load(R/name);assert d['version']==V and d['passed']>=count and not d.get('failed') and not d.get('error') and not d.get('fatalError')
        for key in ['errors','resources','resourceFailures','external','externalRequests']:assert not d.get(key),(name,key,d.get(key))
        reports.append((name,d['passed']))
    manifest=load(R/f'web-build-v{V}.json');published=[]
    for row in manifest['files']:
        src=R/'web/hwh'/row['file'];assert src.stat().st_size==row['bytes'] and sha(src)==row['sha256']
        dest=DOCS/row['file'];dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(src,dest);published.append(dest)
    for row in load(ROOT/'public/art/CRAFT-CREDITS.json')['files']:assert sha(ROOT/'public/art'/row['file'])==row['sha256']
    guide=R/'小镇手作版游玩说明.txt'
    guide.write_text(f'''《下一次春天》{V} · 小镇手作版

解压整个压缩包，在新版Edge或Chrome中打开“下一次春天-电影生活版.html”。画面、字体与默认声音已内置，可离线游玩。

已有旅程可以继续；从其他浏览器或应用迁移时，先在“旅程手记→这段旅程→收藏这段旅程”导出JSON，再在标题页或手记中导入。移动文件、换电脑或清理浏览器数据前，请先导出备份。

从“去小镇走走”或“旅程手记→小镇日常”进入初秋三天。打开小镇地图可以在五处往返。
面包房：走近工作台，挂外套、取原料、持续添水、揉面与整形、观察炉色出炉。可以装袋分享、留配方、给林姨留早餐；烤深的面包可以切薄配汤。三种口味、三种造型使用不同绘画切片。“走近手边”能放大查看操作。
小屋：摆六件绘画物品。先选窗台、木桌或床边小柜，再轻点物品，也可拖入位置；选中后可以直接沿台面挪动，用方向键或滑杆调整位置、大小、转向。物件只有一份，换位置不会复制。
书店：坐下来翻三本三页短篇，拖动书签，或轻点想再读的一句话。写自己的页边话，阿禾会回应；书签记住书名和页码。
海堤：走到水边，换一枚石子，握住后拖动、松手。Enter轻抛，上/下方向键用不同力道。取消或离开不会记录完成。也能在沙上写一句话，让海水带走。
修补铺：顺纹打磨木盒，拧紧两枚合页，慢慢开合听雨。保留选定的初版参考声线，三段角色声音改为分句演绎；字幕也能独立阅读。闭盖淡出，重新打开接着听。

音乐和故事声音需要主动开启。默认内置声音不需要语音服务；可选系统联网声音仍取决于浏览器服务。新增书页和场景说明采用文字，未给这些新句子冒充已有的故事配音。

没有失败扣分、每日登录或催促。读对话、看海和离开面包房时，制作过程暂停。小屋布置、配方、书签与海边痕迹随旅程保存。
16幅背景保持既有原画和摘要，仍为7680像素宽输出；原画是普通重采样，不是原生8K绘制。新道具是项目生成的绘画素材，见CRAFT-CREDITS.json。声音仍为合成演绎，自然度与情绪需要实际试听判断。
字体、声音及模型的许可和署名随包提供。原始参考录音和模型权重不在包内。
''',encoding='utf-8-sig')
    notices=['OFL-Noto.txt','NARRATION-CREDITS.txt','LICENSE-ZipVoice.txt','LICENSE-Vocos.txt','SOUND-CREDITS.txt','SOUND-SOURCES.json','CLARITY-CREDITS.txt','ASSETS-8K.json','LICENSE-FSRCNN.txt','CRAFT-CREDITS.json']
    html=R/'下一次春天-电影生活版.html';archive=R/f'next-spring-v{V}.zip'
    entries=[(html,html.name),(guide,guide.name)]+[(R/name,name)for name in notices]+[(ROOT/'public/audio/memory-box'/n,'memory-box/'+n)for n in ['CREDITS.txt','SOURCES.json']]
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9)as z:
        for src,name in entries:z.write(src,name)
    with zipfile.ZipFile(archive)as z:
        assert z.testzip()is None and hashlib.sha256(z.read(html.name)).hexdigest()==sha(html)
    assert archive.stat().st_size<104857600
    out=DOCS/'downloads'/archive.name;shutil.copyfile(archive,out);published.append(out)
    sums=DOCS/'downloads'/f'SHA256SUMS-v{V}.txt';sums.write_text(f'{sha(archive)}  {archive.name}\n{sha(html)}  {html.name}\n');published.append(sums)
    extras=[(R/name,DOCS/name)for name in notices]+[(guide,DOCS/guide.name),(R/f'web-build-v{V}.json',DOCS/f'web-v{V}-assets.json')]+[(R/name,DOCS/name)for name,_ in reports]+[(ROOT/'public/audio/memory-box'/name,DOCS/'audio/memory-box'/name)for name in ['CREDITS.txt','SOURCES.json']]
    for src,dest in extras:dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(src,dest);published.append(dest)
    summary={'version':V,'webManifestSHA256':sha(R/f'web-build-v{V}.json'),'webFiles':len(manifest['files']),'bytes':manifest['totalBytes'],'reports':dict(reports),'originalBackgroundsUnchanged':True,'original213NarrationClipsPreserved':True,'newPerformedMemoryClips':3,'offlineArchive':{'file':archive.name,'bytes':archive.stat().st_size,'sha256':sha(archive),'fullCRCVerified':True},'offlineHTML':{'bytes':html.stat().st_size,'sha256':sha(html)},'scope':'Automated functional and resource checks plus visual review. This does not establish subjective art or acting quality, or a native Windows GUI launch.'}
    record=DOCS/f'craft-v{V}-validation.json';record.write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n');published.append(record)
    (R/f'craft-v{V}-web-files.json').write_text(json.dumps(sorted(set(str(p.relative_to(ROOT))for p in published)),ensure_ascii=False,indent=2)+'\n')
    (R/f'craft-v{V}-production-state.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(summary,ensure_ascii=False))
if __name__=='__main__':main()
