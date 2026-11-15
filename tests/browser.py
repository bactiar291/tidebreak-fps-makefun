# SPDX-License-Identifier: MIT
import subprocess, json, time, pathlib, traceback
from playwright.sync_api import sync_playwright
from PIL import Image, ImageStat
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=pathlib.Path('/tmp/makefun/fps-browser');OUT.mkdir(exist_ok=True)
checks=[];errors=[];console=[];requests=[]
def check(name,ok,detail=None):
    checks.append({'name':name,'passed':bool(ok),'detail':detail});print(name,ok,detail,flush=True)
    assert ok,name
server=subprocess.Popen(['/root/venv/bin/python3',str(ROOT/'tests/server.py'),str(ROOT/'game')],stdout=subprocess.PIPE,stderr=open(OUT/'server.log','w'),text=True)
try:
    port=json.loads(server.stdout.readline())['port'];url=f'http://127.0.0.1:{port}/'
    with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        page=browser.new_page(viewport={'width':1280,'height':720},device_scale_factor=1)
        page.on('pageerror',lambda e: errors.append(str(e)))
        page.on('console',lambda m:console.append({'type':m.type,'text':m.text}))
        page.on('request',lambda r: requests.append(r.url))
        page.goto(url);page.wait_for_function('window.tidebreak && window.tidebreak.renderInfo().frames > 2',timeout=30000)
        state=lambda:page.evaluate('window.tidebreak.state()')
        check('webgl2',page.evaluate('window.tidebreak.renderInfo().webgl2'))
        deep=page.evaluate((ROOT/'tests/browser-invariants.js').read_text());checks.extend(deep)
        print('Browser isolated invariants',len(deep),'passed',flush=True)
        page.screenshot(path=str(OUT/'menu.jpg'),type='jpeg',quality=85)
        check('menu visible',page.locator('#menu').is_visible())
        page.locator('#start').click();page.wait_for_function("window.tidebreak.state().phase==='buy'")
        check('start to buy',state()['money']==2400)
        page.locator('[data-buy="rifle"]').click();check('buy actual rifle cost',state()['money']==500 and state()['actors'][0]['weapon']=='rifle')
        page.screenshot(path=str(OUT/'buy.jpg'),type='jpeg',quality=85)
        page.locator('#deploy').click();page.wait_for_function("window.tidebreak.state().phase==='live' && !window.tidebreak.state().paused")
        page.keyboard.down('s');page.wait_for_timeout(1800);page.keyboard.up('s');wallpos=state()['actors'][0]['z']
        check('normal input boundary collision',26.9<wallpos<27.2,wallpos)
        page.mouse.move(640,360);before=state()['actors'][0]
        page.keyboard.down('w');page.wait_for_timeout(1800);page.keyboard.up('w');after=state()['actors'][0]
        check('WASD movement',after['z']<before['z']-.5,{'before':before['z'],'after':after['z']})
        yaw=after['yaw'];page.mouse.move(730,350,steps=5);page.wait_for_timeout(150)
        check('real mouse orientation',abs(state()['actors'][0]['yaw']-yaw)>.03,{'before':yaw,'after':state()['actors'][0]['yaw']})
        ammo=state()['actors'][0]['ammo'];page.mouse.down();page.wait_for_timeout(400);page.mouse.up()
        check('fire consumes ammo',state()['actors'][0]['ammo']<ammo)
        before=state()['actors'][0];page.keyboard.press('r');page.wait_for_function('window.tidebreak.state().actors[0].reload>0');page.wait_for_function('window.tidebreak.state().actors[0].reload===0',timeout=12000)
        after=state()['actors'][0];check('reload transfers reserve',after['ammo']==20 and after['reserve']<before['reserve'])
        page.keyboard.down('Control');page.wait_for_timeout(200);check('crouch state',state()['actors'][0]['crouch']);page.keyboard.up('Control')
        page.screenshot(path=str(OUT/'cover.jpg'),type='jpeg',quality=85)
        page.keyboard.press('g');page.wait_for_timeout(600);check('grenade smoke',state()['grenades']==0 and any(g['active'] for g in state()['smokes']))
        page.screenshot(path=str(OUT/'gameplay.jpg'),type='jpeg',quality=85)
        page.keyboard.press('Escape');page.wait_for_function('window.tidebreak.state().paused');t=state()['time'];page.wait_for_timeout(350);check('pause freezes simulation',state()['time']==t)
        page.locator('#resume').click();page.wait_for_function('!window.tidebreak.state().paused')
        page.keyboard.press('Escape');page.wait_for_function('window.tidebreak.state().paused');page.locator('#restart').click();check('clean match restart',state()['score']==[0,0] and state()['money']==2400)
        # Public drill: honest held interaction, no state injection.
        page.goto(url);page.wait_for_function('window.tidebreak');page.locator('#difficulty').select_option('easy');page.locator('#range').click()
        page.wait_for_function('window.tidebreak.state().actors[0].hp<100',timeout=15000)
        check('easy bots shoot player',any(a['shots']>0 for a in state()['actors'][2:]),state()['actors'][0]['hp'])
        page.goto(url);page.wait_for_function('window.tidebreak');page.locator('#relay').click();page.wait_for_function("window.tidebreak.state().phase==='live'")
        page.keyboard.down('e');page.wait_for_function('window.tidebreak.state().bomb.planted',timeout=20000);page.keyboard.up('e')
        check('actual relay planting',state()['bomb']['planted'])
        page.mouse.move(640,360);page.mouse.move(1100,360,steps=8);page.wait_for_timeout(200)
        page.screenshot(path=str(OUT/'relay.jpg'),type='jpeg',quality=85)
        check('bots move',any(abs(a['x']-x)>0.2 or abs(a['z']-z)>0.2 for a,(x,z) in zip(state()['actors'][1:],[(-2,-13),(10,10),(-18,23),(17,23)])))
        page.wait_for_function("['result','match'].includes(window.tidebreak.state().phase)",timeout=90000)
        check('live drill round resolves',state()['awards']==1,state()['result']);page.screenshot(path=str(OUT/'result.jpg'),type='jpeg',quality=85)
        page.locator('#next').click();check('round restart',state()['phase']=='buy' and state()['round']==2)
        check('page errors absent',not errors,errors)
        unexpected=[r for r in requests if not r.startswith(url)];check('no unexpected network requests',not unexpected,unexpected)
        im=Image.open(OUT/'gameplay.jpg');std=ImageStat.Stat(im).stddev;check('render pixel spread',min(std)>15,std)
        browser.close()
except Exception as exc:
    try:
        (OUT/'failure-state.json').write_text(json.dumps(state(),indent=2))
        page.screenshot(path=str(OUT/'failure.jpg'),type='jpeg',quality=85)
    except Exception:
        pass
    errors.append(traceback.format_exc());print(errors[-1],flush=True)
finally:
    server.terminate();server.wait(timeout=5)
    report={'checks':checks,'errors':errors,'console':console,'requests':requests,'server_stopped':server.poll() is not None}
    (OUT/'report.json').write_text(json.dumps(report,indent=2))
if errors:raise SystemExit(1)
