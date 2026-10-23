#!/usr/bin/env python3
"""Stage a strict game allowlist, or package the built Windows desktop shell."""
import argparse, hashlib, json, shutil, struct, zipfile
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
RELEASE = ROOT / 'release'
VERSION = json.loads((ROOT / 'package.json').read_text())['version']
def sha(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()
def load(path): return json.loads(path.read_text())
def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--prepare',action='store_true')
    parser.add_argument('--package',action='store_true')
    parser.add_argument('--go-root',type=Path)
    args=parser.parse_args()
    manifest_path=RELEASE/f'web-build-v{VERSION}.json'
    manifest=load(manifest_path)
    assert manifest['version']==VERSION and manifest['excludesUnreferencedSources']
    if args.prepare:
        destination=ROOT/'desktop/payload'
        if destination.exists(): shutil.rmtree(destination)
        destination.mkdir(parents=True)
        for row in manifest['files']:
            name=PurePosixPath(row['file'])
            assert not name.is_absolute() and '..'not in name.parts
            assert not str(name).startswith('films/') and not str(name).endswith('.png')
            source=RELEASE/'web/hwh'/str(name)
            assert source.stat().st_size==row['bytes'] and sha(source)==row['sha256']
            target=destination/str(name);target.parent.mkdir(parents=True,exist_ok=True)
            shutil.copyfile(source,target)
        (destination/'asset-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
        print(json.dumps({'stagedFiles':len(manifest['files']),'bytes':manifest['totalBytes'],'manifestSHA256':sha(manifest_path)}))
    if args.package:
        assert args.go_root and (args.go_root/'LICENSE').is_file()
        exe=RELEASE/'desktop/下一次春天.exe'
        data=exe.read_bytes();offset=struct.unpack_from('<I',data,0x3c)[0]
        assert data[:2]==b'MZ' and data[offset:offset+4]==b'PE\0\0'
        assert struct.unpack_from('<H',data,offset+4)[0]==0x8664
        assert struct.unpack_from('<H',data,offset+24)[0]==0x20b
        assert struct.unpack_from('<H',data,offset+24+68)[0]==2 # Windows GUI subsystem.
        for row in manifest['files']:
            embedded=ROOT/'desktop/payload'/row['file']
            assert sha(embedded)==row['sha256'] and embedded.read_bytes() in data
        report=load(RELEASE/f'bakery-v{VERSION}-desktop.json')
        assert report['passed']==15 and report['failed']==0 and not report['errors'] and not report['resourceFailures'] and not report['externalRequests']
        assert report['desktopLocalOnly'] and report['buildFingerprint']['assetManifestSha256']==sha(manifest_path)
        tests=(RELEASE/'desktop-go-tests.log').read_text();assert 'PASS' in tests and 'FAIL'not in tests
        assert f'{len(manifest["files"])} embedded files verified' in (RELEASE/'desktop-embedded-verification.log').read_text()
        profile=load(RELEASE/f'desktop-v{VERSION}-profile.json')
        assert profile['passed'] and not profile['errors'] and not profile['externalRequests']
        craft=load(RELEASE/f'craft-v{VERSION}-desktop.json')
        assert craft['success'] and craft['passed']>=7 and craft['desktopLocalOnly']
        guide=RELEASE/'desktop/先读我-使用说明.txt'
        guide.write_text(f'''《下一次春天》{VERSION} · Windows 64位免安装应用

解压整个压缩包，双击“下一次春天.exe”。不要在压缩包预览窗口里直接运行。
支持 Windows 10/11 64位。使用电脑已经安装的 Microsoft Edge，找不到时尝试 Chrome，在独立游戏窗口中显示。无需安装 Node.js、Python 或游戏运行库。

所有画面、字体、默认配音与环境声都已包含在应用中。游玩不需要连接互联网，也不需要VPN。声音需要在游戏中主动开启。游戏内容与{VERSION}小镇手作版一致。

新增互动：书店可以翻页、拖动书签和写页边话；海堤可以蓄力投石、在沙上写话并让海水带走；小屋可以摆放六件绘画物件，挪动、转向和调整大小。木盒配音保持原声线，改为分句演绎与雨夜空间混音。

面包房入口：去小镇走走→有光面包房→走近工作台。也可在旅程手记→小镇日常进入。
可以取料、持续添水、揉面整形、观察炉色出炉，深烘可切片配汤；配方、隔日早餐、帮忙与托店会留在旅程里。读对话、看海和离开游戏时，制作暂停。

桌面版使用单独的游戏存档空间，不读取或改变你日常浏览器的数据。
原网页版存档不会自动迁移：先在网页版“旅程手记→这段旅程→收藏这段旅程”导出JSON，再在应用标题页或手记中导入。
关闭后再打开，可以继续之前的旅程。移动应用到另一文件夹不会主动清除存档；换电脑前请先导出JSON备份。

关闭独立游戏窗口即可退出。重复启动时，请切换到已经打开的游戏窗口。打不开时请确认已解压，并已安装Edge或Chrome；请保留错误提示文字以便排查。

本包是调用已有浏览器的桌面启动应用，未捆绑浏览器内核。程序没有代码签名。构建及嵌入资源已校验，并在Linux环境验证相同服务的完整游戏流程；当前环境没有实际运行Windows窗口，因此不声称完成Windows实机验收。
字体、声音及Go运行时许可见LICENSES文件夹。原始参考录音、模型权重及工作素材不随应用分发。
''',encoding='utf-8-sig')
        licenses=[]
        for name in ['OFL-Noto.txt','OFL-MaShanZheng.txt','NARRATION-CREDITS.txt','LICENSE-ZipVoice.txt','LICENSE-Vocos.txt','SOUND-CREDITS.txt','SOUND-SOURCES.json','CLARITY-CREDITS.txt','ASSETS-8K.json','LICENSE-FSRCNN.txt','CRAFT-CREDITS.json']:
            source=RELEASE/name;assert source.is_file();licenses.append((source,'LICENSES/'+name))
        for name in ['CREDITS.txt','SOURCES.json']:
            licenses.append((ROOT/'public/audio/memory-box'/name,'LICENSES/memory-box/'+name))
        licenses.append((args.go_root/'LICENSE','LICENSES/LICENSE-Go.txt'))
        for license_path in sorted((args.go_root/'src/vendor').rglob('LICENSE')):
            licenses.append((license_path,'LICENSES/Go-vendor/'+str(license_path.relative_to(args.go_root/'src/vendor'))))
        archive=RELEASE/f'next-spring-v{VERSION}-windows-x64.zip'
        entries=[(exe,exe.name),(guide,guide.name),*licenses]
        with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9)as z:
            for source,name in entries:z.write(source,name)
        with zipfile.ZipFile(archive)as z:
            assert z.testzip()is None and set(z.namelist())==set(name for _,name in entries)
            assert hashlib.sha256(z.read(exe.name)).hexdigest()==sha(exe)
        assert archive.stat().st_size<104857600
        target=ROOT/'docs/downloads'/archive.name;shutil.copyfile(archive,target)
        sums=ROOT/'docs/downloads'/f'SHA256SUMS-v{VERSION}-windows-x64.txt'
        sums.write_text(f'{sha(archive)}  {archive.name}\n{sha(exe)}  {exe.name}\n')
        summary={'version':VERSION,'target':'Windows 10/11 amd64','format':'portable GUI executable with embedded game, using installed Edge/Chrome','windowsGUILaunchTested':False,'codeSigned':False,'embeddedFiles':len(manifest['files']),'windowsEmbeddedFilesVerified':len(manifest['files']),'profileRelaunchTestedOnLinux':True,'assetManifestSHA256':sha(manifest_path),'goTestsPassed':True,'desktopBrowserChecks':report['passed'],'desktopCraftChecks':craft['passed'],'outboundGameRequests':0,'zipCRCVerified':True,'exe':{'file':exe.name,'bytes':exe.stat().st_size,'sha256':sha(exe)},'archive':{'file':archive.name,'bytes':archive.stat().st_size,'sha256':sha(archive)},'scope':'Windows PE target and every embedded asset verified. The same local server, persistent browser profile and full game flow were exercised on Linux; Windows GUI launch was not executed.'}
        (RELEASE/f'desktop-v{VERSION}-validation.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
        record=ROOT/'docs'/f'desktop-v{VERSION}-validation.json';shutil.copyfile(RELEASE/record.name,record)
        browser_record=ROOT/'docs'/f'bakery-v{VERSION}-desktop.json';shutil.copyfile(RELEASE/browser_record.name,browser_record)
        craft_record=ROOT/'docs'/f'craft-v{VERSION}-desktop.json';shutil.copyfile(RELEASE/craft_record.name,craft_record)
        (RELEASE/f'desktop-v{VERSION}-web-files.json').write_text(json.dumps([str(p.relative_to(ROOT))for p in [target,sums,record,browser_record,craft_record]],ensure_ascii=False,indent=2)+'\n')
        print(json.dumps(summary,ensure_ascii=False))
    assert args.prepare or args.package

if __name__=='__main__': main()
