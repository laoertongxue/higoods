# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: post-finishing-migration.spec.ts >> A20: two isolated tabs report a blocked database upgrade and preserve old records after the old connection closes
- Location: tests/post-finishing-migration.spec.ts:271:1

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('[data-post-finishing-storage-notice]')
Expected substring: "数据库升级被其他标签页阻止"
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toContainText" with timeout 10000ms
  - waiting for locator('[data-post-finishing-storage-notice]')

```

```yaml
- banner:
  - text: HG HiGood
  - button "商品中心系统 (PCS)"
  - button "采购管理系统 (PMS)"
  - button "工厂生产协同系统 (FCS)"
  - button "工艺工厂运营系统 (PFOS)"
  - button "仓储物流系统 (WLS)"
  - button "直播运营系统 (LOS)"
  - button "订单管理系统 (OMS)"
  - button "业财一体化系统 (BFIS)"
  - button "数据决策系统 (DDS)"
  - button "通知":
    - img
  - button "管理员":
    - img
    - text: 管理员
    - img
- complementary:
  - heading "工艺工厂运营系统" [level=2]
  - paragraph: PFOS
  - button "收起菜单":
    - img
  - button "裁床厂管理" [expanded]:
    - img
    - text: 裁床厂管理
    - img
  - button "裁床总览":
    - img
    - text: 裁床总览
    - img
  - button "裁前准备":
    - img
    - text: 裁前准备
    - img
  - button "接收管理":
    - img
    - text: 接收管理
    - img
  - button "铺布执行":
    - img
    - text: 铺布执行
    - img
  - button "裁后处理":
    - img
    - text: 裁后处理
    - img
  - button "裁床仓库管理":
    - img
    - text: 裁床仓库管理
    - img
  - button "裁床统计":
    - img
    - text: 裁床统计
    - img
  - button "印花厂管理" [expanded]:
    - img
    - text: 印花厂管理
    - img
  - button "印花管理":
    - img
    - text: 印花管理
    - img
  - button "染厂管理" [expanded]:
    - img
    - text: 染厂管理
    - img
  - button "染厂管理":
    - img
    - text: 染厂管理
    - img
  - button "毛织厂管理" [expanded]:
    - img
    - text: 毛织厂管理
    - img
  - button "毛织管理":
    - img
    - text: 毛织管理
    - img
  - button "辅料工厂管理" [expanded]:
    - img
    - text: 辅料工厂管理
    - img
  - button "花边厂管理":
    - text: 花边厂管理
    - img
  - button "织带厂管理":
    - img
    - text: 织带厂管理
    - img
  - button "后道工厂管理" [expanded]:
    - img
    - text: 后道工厂管理
    - img
  - button "后道工厂管理":
    - img
    - text: 后道工厂管理
    - img
  - button "后道生产任务":
    - img
    - text: 后道生产任务
  - button "后道辅料调拨单":
    - img
    - text: 后道辅料调拨单
  - button "执行质检":
    - img
    - text: 执行质检
  - button "质检清单":
    - img
    - text: 质检清单
  - button "后道加工单":
    - img
    - text: 后道加工单
  - button "复检单":
    - img
    - text: 复检单
  - button "后道待加工仓":
    - img
    - text: 后道待加工仓
  - button "后道待交出仓":
    - img
    - text: 后道待交出仓
  - button "后道出货单":
    - img
    - text: 后道出货单
  - button "差异与操作日志":
    - img
    - text: 差异与操作日志
  - button "我的动态授权码":
    - img
    - text: 我的动态授权码
  - button "成衣 SPU 替换":
    - img
    - text: 成衣 SPU 替换
  - button "辅助工艺工厂管理" [expanded]:
    - img
    - text: 辅助工艺工厂管理
    - img
  - button "打揽加工单":
    - img
    - text: 打揽加工单
  - button "打条加工单":
    - img
    - text: 打条加工单
  - button "烫画加工单":
    - img
    - text: 烫画加工单
  - button "直喷加工单":
    - img
    - text: 直喷加工单
  - button "布包扣加工单":
    - img
    - text: 布包扣加工单
  - button "绣花加工单":
    - img
    - text: 绣花加工单
  - button "压褶加工单":
    - img
    - text: 压褶加工单
  - button "缝边绣加工单":
    - img
    - text: 缝边绣加工单
  - button "盘扣加工单":
    - img
    - text: 盘扣加工单
  - button "花朵加工单":
    - img
    - text: 花朵加工单
  - button "打褶加工单":
    - img
    - text: 打褶加工单
  - button "烫钻加工单":
    - img
    - text: 烫钻加工单
  - button "辅助工艺待加工仓":
    - img
    - text: 辅助工艺待加工仓
  - button "辅助工艺待交出仓":
    - img
    - text: 辅助工艺待交出仓
  - button "特种工艺工厂管理" [expanded]:
    - img
    - text: 特种工艺工厂管理
    - img
  - button "模板工序加工单":
    - img
    - text: 模板工序加工单
  - button "激光开袋加工单":
    - img
    - text: 激光开袋加工单
  - button "特种车缝（花样机）加工单":
    - img
    - text: 特种车缝（花样机）加工单
  - button "橡筋定长切割加工单":
    - img
    - text: 橡筋定长切割加工单
  - button "特种工艺待加工仓":
    - img
    - text: 特种工艺待加工仓
  - button "特种工艺待交出仓":
    - img
    - text: 特种工艺待交出仓
- main:
  - button "后道加工单"
  - button:
    - img
  - button "全部关闭"
  - text: 页面内容加载失败，请稍后重试。
- button "查生产":
  - img
```

# Test source

```ts
  203 |     await retry.goto(`${new URL(page.url()).origin}/fcs/craft/post-finishing/work-orders`)
  204 |     await expect(retry.locator('main h1')).toHaveText('后道加工单')
  205 |     await expect(retry.locator('tbody tr').filter({ hasText: taskNo })).toHaveCount(1)
  206 |     const restored = await retry.evaluate(async id => {
  207 |       const f = await import('/src/data/fcs/post-finishing-full-flow.ts')
  208 |       const task = f.getPostFinishingFullFlowPostTask(id)!
  209 |       return { no: task.postTaskNo, expected: task.lines.reduce((sum, line) => sum + line.expectedQty, 0) }
  210 |     }, fixture.taskId)
  211 |     expect(restored).toEqual({ no: taskNo, expected: 1000 })
  212 |     mkdirSync(evidence, { recursive: true })
  213 |     await retry.screenshot({ path: `${evidence}/backup-ui-failure-retry-restored.png`, fullPage: true })
  214 |   } finally { await retryContext.close() }
  215 | })
  216 | 
  217 | test('A20/A21/A22: interrupted schema1 conversion resumes with archive Blob, common records and legacy sources preserved', async ({ page }) => {
  218 |   const fixture = legacyFixture()
  219 |   fixture.snapshot.schemaVersion = 1
  220 |   fixture.snapshot.recheckOrders[0].lines[0].expectedQty = 100
  221 |   for (let i=0;i<150;i++) {
  222 |     const record = structuredClone(fixture.snapshot.recheckOrders[0])
  223 |     record.recheckOrderId=`OLD-RC-MIGRATION-${i}`
  224 |     record.recheckOrderNo=`OLD-RC-MIGRATION-${i}`
  225 |     record.lines[0].expectedQty=1
  226 |     fixture.snapshot.recheckOrders.push(record)
  227 |   }
  228 |   const archiveKey = 'higood-fcs-post-finishing-outbound-orders-v1:archive'
  229 |   const inline = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='
  230 |   await openLegacy(page, fixture)
  231 |   const result = await page.evaluate(async ({ ns, archiveKey, inline, oldKey }) => {
  232 |     const r = await import('/src/data/fcs/post-finishing-records.ts')
  233 |     const db = await import('/src/data/pcs-record-db.ts')
  234 |     localStorage.setItem(archiveKey, JSON.stringify({ raw: JSON.stringify({ oldDraft: { quantity: 600, image: inline }, oldOutbound: { no: 'OLD-OUT', image: inline } }) }))
  235 |     await db.commitPcsRecords({ puts: [{ id: 'pcs-common/KEEP', collection: 'pcs-common', value: { quantity: 7 }, expectedVersion: 0 }], deletes: [], operationId: 'TEST-COMMON', intent: 'preserve unrelated record' })
  236 |     const original = IDBObjectStore.prototype.put
  237 |     let writes = 0
  238 |     IDBObjectStore.prototype.put = function (...args: any[]) {
  239 |       if (this.name === 'records' && ++writes === 110) throw new DOMException('验收中断第二批转换', 'AbortError')
  240 |       return original.apply(this, args as any)
  241 |     }
  242 |     let error = ''
  243 |     try { await r.migratePostFinishingLegacyData() } catch (e) { error=String(e) }
  244 |     finally { IDBObjectStore.prototype.put = original }
  245 |     const partial = await db.readPcsRecords([ns])
  246 |     const oldPreserved = Boolean(localStorage.getItem(oldKey) && localStorage.getItem(archiveKey))
  247 |     let oldWriteRejected = false
  248 |     try { await r.runPostFinishingCommand(() => true) } catch { oldWriteRejected=true }
  249 |     await r.migratePostFinishingLegacyData()
  250 |     const final = await db.readPcsRecords([ns])
  251 |     const backup = JSON.parse(await (await r.exportPostFinishingBackup()).text())
  252 |     await r.importPostFinishingBackup(new File([JSON.stringify(backup)], 'archive-with-blob.json'))
  253 |     return { error, partialCount: partial.records.length, oldPreserved, oldWriteRejected,
  254 |       common: (await db.readPcsRecords(['pcs-common'])).records[0]?.value,
  255 |       idsUnique: new Set(final.records.map(row => row.id)).size===final.records.length,
  256 |       archives: final.records.filter(row => row.collection==='archive').map(row=>row.value), fileCount: final.files.length,
  257 |       bytes: await Promise.all(final.files.map(async row => (await row.blob.arrayBuffer()).byteLength)),
  258 |       noInline: !JSON.stringify(final.records).includes('data:image'), sourcesRemoved: !localStorage.getItem(oldKey) && !localStorage.getItem(archiveKey) }
  259 |   }, { ns: namespace, archiveKey, inline, oldKey })
  260 |   expect(result.error).toContain('AbortError')
  261 |   expect(result.partialCount).toBeGreaterThan(0)
  262 |   expect(result.oldPreserved).toBe(true)
  263 |   expect(result.oldWriteRejected).toBe(true)
  264 |   expect(result.common).toEqual({ quantity: 7 })
  265 |   expect(result.idsUnique && result.noInline && result.sourcesRemoved).toBe(true)
  266 |   expect(result.fileCount).toBe(1)
  267 |   expect(result.bytes[0]).toBeGreaterThan(0)
  268 |   mkdirSync(evidence, { recursive: true })
  269 | })
  270 | 
  271 | test('A20: two isolated tabs report a blocked database upgrade and preserve old records after the old connection closes', async ({ page, context }) => {
  272 |   // A static same-origin asset starts no application bootstrap. The version-1
  273 |   // connection is an explicit old-storage fixture, held by a separate old tab.
  274 |   await page.goto('/shirt-sample.jpg')
  275 |   const initial = await page.evaluate(async () => {
  276 |     const db = await new Promise<IDBDatabase>((resolve, reject) => {
  277 |       const request = indexedDB.open('higood-pcs-records', 1)
  278 |       request.onupgradeneeded = () => {
  279 |         request.result.createObjectStore('records', { keyPath: 'id' })
  280 |         request.result.createObjectStore('files', { keyPath: 'id' })
  281 |       }
  282 |       request.onerror = () => reject(request.error)
  283 |       request.onsuccess = () => resolve(request.result)
  284 |     })
  285 |     ;(window as any).__pfOldUpgradeConnection = db
  286 |     ;(window as any).__pfVersionChangeEvents = []
  287 |     db.onversionchange = event => {
  288 |       ;(window as any).__pfVersionChangeEvents.push({ oldVersion: event.oldVersion, newVersion: event.newVersion })
  289 |       // Simulate an old tab that has not yet obeyed the close/reload instruction.
  290 |     }
  291 |     await new Promise<void>((resolve, reject) => {
  292 |       const transaction = db.transaction('records', 'readwrite')
  293 |       transaction.objectStore('records').put({ id: 'pcs-common/upgrade-sentinel', collection: 'pcs-common', value: { quantity: 7 }, version: 1 })
  294 |       transaction.oncomplete = () => resolve()
  295 |       transaction.onabort = () => reject(transaction.error)
  296 |     })
  297 |     return db.version
  298 |   })
  299 |   expect(initial).toBe(1)
  300 |   const newTab = await context.newPage()
  301 |   await newTab.goto('/fcs/craft/post-finishing/work-orders')
  302 |   const notice = newTab.locator('[data-post-finishing-storage-notice]')
> 303 |   await expect(notice).toContainText('数据库升级被其他标签页阻止')
      |                        ^ Error: expect(locator).toContainText(expected) failed
  304 |   await expect(notice).toContainText('关闭旧页面后重试')
  305 |   const blocked = await notice.innerText()
  306 |   const versionChanges = await page.evaluate(() => (window as any).__pfVersionChangeEvents)
  307 |   expect(versionChanges).toEqual([{ oldVersion: 1, newVersion: 2 }])
  308 |   await page.evaluate(() => {
  309 |     ;(window as any).__pfOldUpgradeConnection.close()
  310 |     delete (window as any).__pfOldUpgradeConnection
  311 |   })
  312 |   await newTab.locator('[data-post-finishing-action="storage-retry"]').click()
  313 |   await expect(notice).toHaveCount(0)
  314 |   await expect(newTab.locator('main h1')).toHaveText('后道加工单')
  315 |   const recovered = await newTab.evaluate(async ns => {
  316 |     const records = await import('/src/data/pcs-record-db.ts')
  317 |     const data = await records.readPcsRecords(['pcs-common'])
  318 |     const db = await new Promise<IDBDatabase>((resolve, reject) => {
  319 |       const request = indexedDB.open('higood-pcs-records')
  320 |       request.onerror = () => reject(request.error)
  321 |       request.onsuccess = () => resolve(request.result)
  322 |     })
  323 |     const result = { version: db.version, stores: [...db.objectStoreNames], common: data.records[0]?.value,
  324 |       postRows: (await records.readPcsRecords([ns])).records.length }
  325 |     db.close()
  326 |     return result
  327 |   }, namespace)
  328 |   expect(recovered.version).toBe(2)
  329 |   expect(recovered.stores).toEqual(expect.arrayContaining(['records', 'files', 'operations', 'meta']))
  330 |   expect(recovered.common).toEqual({ quantity: 7 })
  331 |   expect(recovered.postRows).toBe(0)
  332 |   mkdirSync(evidence, { recursive: true })
  333 |   const { writeFileSync } = await import('node:fs')
  334 |   writeFileSync(`${evidence}/two-tab-upgrade-recovery.json`, JSON.stringify({ blocked, versionChanges, recovered }, null, 2))
  335 |   await newTab.close()
  336 | })
  337 | 
```