# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pcs-design-revision-pda-receiving.spec.ts >> PDA dye-dispatched 按原卷实收、刷新可读且重复扫码不能重复入库
- Location: tests/pcs-design-revision-pda-receiving.spec.ts:9:3

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('[data-receiving-feedback]')
Expected pattern: /重复|已接收|已登记|已入库/
Received string:  ""
Timeout: 10000ms

Call log:
  - Expect "toContainText" with timeout 10000ms
  - waiting for locator('[data-receiving-feedback]')
    24 × locator resolved to <p role="alert" class="px-4 text-red-700" data-receiving-feedback=""></p>
       - unexpected value ""

```

```yaml
- text: 当前接收人：FLOWER / FLOWER_操作工
- alert
- main:
  - text: 1 扫码识别 →
  - strong: 2 核对实物并填写
  - text: → 3 复核 → 4 保存结果
  - heading "本次实际接收" [level=1]
  - paragraph: 接收人：FLOWER / FLOWER_操作工。只保存勾选并填写的行；未收到请明确选择零接收。
  - text: 本次统一库位
  - combobox "本次统一库位":
    - option "请选择本厂已启用的库位"
    - option "FLOWER · 待加工仓 / 烫画-成衣库区 / FLOWER-WP-01-01-01" [selected]
    - option "FLOWER · 待加工仓 / 烫画-成衣库区 / FLOWER-WP-01-01-02"
    - option "FLOWER · 待加工仓 / 直喷-成衣库区 / FLOWER-WP-04-01-01"
    - option "FLOWER · 待加工仓 / 直喷-成衣库区 / FLOWER-WP-04-01-02"
  - button "应用到全部明细和卷"
  - heading "SJ-DYE-1790191301617-4 · 全能力测试工厂" [level=2]
  - checkbox "登记这一行"
  - text: 登记这一行
  - button "查看设计改款白底蓝花棉布大图":
    - img "设计改款白底蓝花棉布 White"
  - strong: 设计改款白底蓝花棉布
  - text: DR-COTTON-001-WHITE White 面料 · 100% 棉 棉布 / 幅宽 150 cm / 克重 180 g/㎡ 批次：DY-20260923-000001-B1
  - group: 查看上游参考数量
  - checkbox "本行整批未收到（明确登记 0 卷 / 0 Yard）"
  - text: 本行整批未收到（明确登记 0 卷 / 0 Yard）
  - checkbox "DY-20260923-000001_0001"
  - text: DY-20260923-000001_0001 实收 Yard
  - spinbutton "实收 Yard"
  - text: 本卷库位
  - combobox "本卷库位":
    - option "请选择本厂已启用的库位"
    - option "FLOWER · 待加工仓 / 烫画-成衣库区 / FLOWER-WP-01-01-01" [selected]
    - option "FLOWER · 待加工仓 / 烫画-成衣库区 / FLOWER-WP-01-01-02"
    - option "FLOWER · 待加工仓 / 直喷-成衣库区 / FLOWER-WP-04-01-01"
    - option "FLOWER · 待加工仓 / 直喷-成衣库区 / FLOWER-WP-04-01-02"
  - text: 本行默认入库位置
  - combobox "本行默认入库位置":
    - option "请选择本厂已启用的库位"
    - option "FLOWER · 待加工仓 / 烫画-成衣库区 / FLOWER-WP-01-01-01" [selected]
    - option "FLOWER · 待加工仓 / 烫画-成衣库区 / FLOWER-WP-01-01-02"
    - option "FLOWER · 待加工仓 / 直喷-成衣库区 / FLOWER-WP-04-01-01"
    - option "FLOWER · 待加工仓 / 直喷-成衣库区 / FLOWER-WP-04-01-02"
  - text: 本次接收备注
  - textbox "本次接收备注"
  - button "下一步：复核实收"
  - button "返回列表"
```

# Test source

```ts
  1  | import {test,expect} from '@playwright/test'
  2  | import {readFile,writeFile} from 'node:fs/promises'
  3  | import {createHash} from 'node:crypto'
  4  |
  5  | for(const [stage,factory,sourcePrefix] of [
  6  |  ['warehouse-dispatched','F090','DR-MATERIAL-DYEING-'],
  7  |  ['dye-dispatched','FAC-FLOWER','DYE-DISPATCH-'],
  8  |  ['print-dispatched','DYE-GOTO-GLOBAL','PRINT-HANDOUT-'],
  9  | ])test(`PDA ${stage} 按原卷实收、刷新可读且重复扫码不能重复入库`,async({browser,baseURL},info)=>{
  10 |  const measurements:Record<string,number[]>={}
  11 |  for(let n=0;n<5;n++){
  12 |   const values:Record<string,string>=JSON.parse(await readFile(`output/playwright/design-revision-gap/fixtures/${stage}.json`,'utf8'))
  13 |   const before=JSON.parse(values['higood-factory-material-receiving-v1'])
  14 |   const source=before.sources.find((s:{id:string,targetFactoryId:string,lines:{material:{sku:string}}[]})=>s.id.startsWith(sourcePrefix)&&s.targetFactoryId===factory&&s.lines[0].material.sku.startsWith('DR-COTTON-'))
  15 |   expect(source).toBeTruthy()
  16 |   values.fcs_pda_session=JSON.stringify({userId:factory+'_operator',loginId:factory+'_operator',userName:'设计改款验收仓管',roleId:'ROLE_OPERATOR',factoryId:factory,factoryName:factory,loggedAt:'2026-09-24 09:00:00'})
  17 |   const c=await browser.newContext({viewport:{width:390,height:844},storageState:{cookies:[],origins:[{origin:new URL(baseURL!).origin,localStorage:Object.entries(values).map(([name,value])=>({name,value}))}]}})
  18 |   const p=await c.newPage();const errors:string[]=[];p.on('pageerror',e=>errors.push(e.message))
  19 |   const action=(a:string)=>p.locator(`[data-factory-receiving-action="${a}"]`)
  20 |   const measure=async(key:string,fn:()=>Promise<unknown>,event='click')=>{
  21 |    await p.evaluate(event=>{document.addEventListener(event,e=>(window as any).__actionStart=e.timeStamp,{once:true,capture:true})},event)
  22 |    await fn()
  23 |    const ms=await p.evaluate(async()=>{await Promise.all([...document.images].filter(i=>{const r=i.getBoundingClientRect();return r.width&&r.height&&r.top<innerHeight&&r.bottom>0}).map(i=>i.decode()));await new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())));return performance.now()-(window as any).__actionStart})
  24 |    ;(measurements[key]??=[]).push(ms)
  25 |   }
  26 |   await p.goto(`${baseURL}/fcs/pda/factory-receipts`)
  27 |   await measure('openScanner',async()=>{await action('scan').click();await expect(p.locator('[data-rfield="scan"]')).toBeVisible()})
  28 |   await measure('scanInput',()=>p.locator('[data-rfield="scan"]').fill(source.lines[0].rolls[0].barcode),'input')
  29 |   await measure('resolveRoll',async()=>{await action('scan-input').click();await expect(p.getByRole('heading',{name:'本次实际接收',exact:true})).toBeVisible()})
  30 |   const line=p.locator(`[data-receipt-line][data-source="${source.id}"]`)
  31 |   await measure('selectLine',()=>line.locator('[data-rinclude]').check())
  32 |   await measure('selectRoll',()=>line.locator('[data-rroll]').check())
  33 |   await measure('actualQuantity',()=>line.locator('input[data-rfield^="yard-"]').fill('20'),'input')
  34 |   await measure('review',async()=>{await action('review').click();await expect(action('save')).toBeVisible()})
  35 |   await measure('returnToEdit',async()=>{await action('edit').click();await expect(line.locator('input[data-rfield^="yard-"]')).toHaveValue('20')})
  36 |   await action('review').click()
  37 |   await measure('save',async()=>{await action('save').click();await expect(p.getByText('接收已保存',{exact:false})).toBeVisible()})
  38 |   const read=()=>p.evaluate(id=>JSON.parse(localStorage.getItem('higood-factory-material-receiving-v1')!).receipts.flatMap((r:any)=>r.lines).filter((l:any)=>l.sourceId===id),source.id)
  39 |   let actual=await read();expect(actual.reduce((s:number,l:any)=>s+l.qty,0)).toBe(20);expect(actual.flatMap((l:any)=>l.rolls).map((r:any)=>r.barcode)).toContain(source.lines[0].rolls[0].barcode)
  40 |   await p.reload();expect(await read()).toEqual(actual)
  41 |   await action('scan').click();await p.locator('[data-rfield="scan"]').fill(source.lines[0].rolls[0].barcode);await action('scan-input').click()
  42 |   if(await line.count()){
  43 |    await line.locator('[data-rinclude]').check();await line.locator('[data-rroll]').check();await line.locator('input[data-rfield^="yard-"]').fill('20');await action('review').click()
  44 |   }
> 45 |   await expect(p.locator('[data-receiving-feedback]')).toContainText(/重复|已接收|已登记|已入库/)
     |                                                        ^ Error: expect(locator).toContainText(expected) failed
  46 |   expect(await read()).toEqual(actual);expect(errors).toEqual([])
  47 |   if(n===0)await p.screenshot({path:info.outputPath(`${stage}.png`),fullPage:true})
  48 |   await c.close()
  49 |  }
  50 |  await writeFile(info.outputPath('performance.json'),JSON.stringify({stage,factory,viewport:'390x844',distSha:createHash('sha256').update(await readFile('dist/index.html')).digest('hex'),measurements},null,2))
  51 |  for(const [key,samples] of Object.entries(measurements))for(const ms of samples)expect(ms,`${stage} ${key}`).toBeLessThan(500)
  52 | })
  53 |
```
