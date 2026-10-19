# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: post-finishing-main-integration.spec.ts >> main integration: mixed legacy post-first-inline, atomic retry, original files and H/N continue
- Location: tests/post-finishing-main-integration.spec.ts:117:3

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('[data-post-material-migration]')
Expected substring: "已完成"
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toContainText" with timeout 10000ms
  - waiting for locator('[data-post-material-migration]')

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
  - button "后道辅料调拨单"
  - button:
    - img
  - button "全部关闭"
  - heading "后道辅料调拨单" [level=1]
  - text: 调拨单 / 生产单 / 款式 / 物料
  - textbox "调拨单 / 生产单 / 款式 / 物料"
  - text: 来源仓
  - combobox "来源仓":
    - option "全部" [selected]
  - text: 当前状态
  - combobox "当前状态":
    - option "全部" [selected]
    - option "申请调拨"
    - option "待调拨"
    - option "待入库"
    - option "已入库"
  - text: 创建开始
  - textbox "创建开始"
  - text: 创建结束
  - textbox "创建结束"
  - button "查询"
  - button "重置"
  - text: 筛选调拨单
  - strong: "0"
  - text: 待调拨
  - strong: "0"
  - text: 待入库
  - strong: "0"
  - text: 已入库
  - strong: "0"
  - heading "调拨单列表" [level=2]
  - table:
    - rowgroup:
      - row "调拨单 款式 来源 → 去向 整单数量 当前状态 操作":
        - columnheader "调拨单"
        - columnheader "款式"
        - columnheader "来源 → 去向"
        - columnheader "整单数量"
        - columnheader "当前状态"
        - columnheader "操作"
    - rowgroup:
      - row "暂无数据":
        - cell "暂无数据"
  - paragraph: 共 0 条
  - combobox:
    - option "10 条/页" [selected]
    - option "20 条/页"
    - option "50 条/页"
  - button "上一页" [disabled]
  - text: 1 / 1
  - button "下一页" [disabled]
- button "查生产":
  - img
```

# Test source

```ts
  1   | import { expect, test, type Page } from '@playwright/test'
  2   | import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
  3   | import { resolve } from 'node:path'
  4   | import * as flow from '../src/data/fcs/post-finishing-full-flow.ts'
  5   | 
  6   | const namespace = 'higood-fcs-post-finishing-records'
  7   | const oldKey = 'higood-fcs-post-finishing-full-flow-v1'
  8   | const evidence = `${process.env.POST_FINISHING_EVIDENCE_ROOT || 'docs/product-design/post-finishing-partial-flow-20261019/evidence'}/main-integration-browser`
  9   | const postFixture = JSON.parse(readFileSync('tests/fixtures/accessory-warehouse/post.json', 'utf8'))
  10  | const legacyMaterials = JSON.parse(readFileSync('tests/fixtures/accessory-warehouse/postLegacy.json', 'utf8'))
  11  | const legacyMaterialRows = legacyMaterials.databases.find((db: any) => db.name === 'higood-pcs-records').stores.find((s: any) => s.name === 'records').rows.filter((row: any) => /flow\/material(TransferOrders|Stocks)$/.test(row.value.collection))
  12  | const legacyFile = legacyMaterials.databases.find((db: any) => db.name === 'higood-pcs-records').stores.find((s: any) => s.name === 'files').rows[0].value
  13  | 
  14  | // Frozen AW initial states are main's isolated input fixtures, not upstream
  15  | // factory operation evidence. All garment facts below use public commands.
  16  | async function installFixture(page: Page, fixture: any): Promise<void> {
  17  |   await page.route('**/__post-main-fixture', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }))
  18  |   await page.goto('/__post-main-fixture')
  19  |   await page.evaluate(async fixture => {
  20  |     function decode(value: any): any {
  21  |       if (value?.__fixtureType === 'Blob') return new Blob([new Uint8Array(value.bytes)], { type: value.type })
  22  |       if (Array.isArray(value)) return value.map(decode)
  23  |       if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decode(item)]))
  24  |       return value
  25  |     }
  26  |     if ((await indexedDB.databases()).length) throw new Error('integration input requires an isolated empty context')
  27  |     for (const info of fixture.databases) {
  28  |       const db = await new Promise<IDBDatabase>((ok, fail) => {
  29  |         const request = indexedDB.open(info.name, info.version)
  30  |         request.onupgradeneeded = () => { for (const s of info.stores) { const store = request.result.createObjectStore(s.name, { keyPath: s.keyPath, autoIncrement: s.autoIncrement }); for (const index of s.indexes || []) store.createIndex(index.name, index.keyPath, { unique: index.unique, multiEntry: index.multiEntry }) } }
  31  |         request.onsuccess = () => ok(request.result); request.onerror = () => fail(request.error)
  32  |       })
  33  |       const tx = db.transaction(info.stores.map((s: any) => s.name), 'readwrite')
  34  |       const done = new Promise<void>((ok, fail) => { tx.oncomplete = () => ok(); tx.onabort = () => fail(tx.error) })
  35  |       for (const s of info.stores) for (const row of s.rows) { const store = tx.objectStore(s.name); store.keyPath === null ? store.put(decode(row.value), decode(row.key)) : store.put(decode(row.value)) }
  36  |       await done; db.close()
  37  |     }
  38  |     for (const [key, value] of Object.entries(fixture.localStorage || {})) localStorage.setItem(key, String(value))
  39  |   }, fixture)
  40  | }
  41  | 
  42  | function legacyGarment() {
  43  |   flow.resetPostFinishingFullFlow()
  44  |   const source = flow.POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS[0], original = source.skus[0].plannedQty, actor = flow.POST_FINISHING_ACCEPTANCE_ACTORS
  45  |   try {
  46  |     source.skus[0].plannedQty = 1000
  47  |     const delivery = flow.registerPostFinishingFactoryReturn({ productionOrderNo: source.productionOrderNo, executionTaskId: source.executionTaskId, returnIndex: 1, triggerSource: '车缝正常交出', idempotencyKey: 'MIXED-LEGACY-INPUT', quantities: source.skus.map((sku, i) => ({ skuId: sku.skuId, registeredQty: i ? 0 : 1000 })), deliveryPersonName: '混合迁移隔离送货人', deliveryPersonPhone: '', evidenceImageUrls: [source.skus[0].imageUrl], actor: actor.factoryCourier })
  48  |     flow.confirmPostFinishingFactoryReturn({ deliveryId: delivery.deliveryId, firstCounts: delivery.lines.map(line => ({ skuId: line.sku.skuId, actualQty: line.registeredQty })), actor: actor.returnConfirmer })
  49  |     const qc = flow.sendPostFinishingFactoryReturnToQc({ deliveryId: delivery.deliveryId, actor: actor.sender })
  50  |     flow.claimPostFinishingQcTask({ qcTaskNo: qc.qcTaskNo, actor: actor.qcA })
  51  |     const complete = flow.completePostFinishingQcTask({ qcTaskId: qc.qcTaskId, actor: actor.qcA, processItems: [...flow.POST_FINISHING_PROCESS_ITEMS], results: qc.lines.map(line => ({ skuId: line.sku.skuId, passedQty: line.expectedQty, defectQty: 0, returnQty: 0 })) })
  52  |     const parent = flow.getPostFinishingFullFlowPostTask(complete.postTaskId!)!
  53  |     for (const processItem of flow.POST_FINISHING_PROCESS_ITEMS) flow.appendPostFinishingProcessCompletion({ postTaskId: parent.postTaskId, processItem, quantities: [{ skuId: source.skus[0].skuId, quantity: 400 }], responsible: actor.postOperator, actor: actor.postOperator, operationId: `MIXED-OLD-${processItem}` })
  54  |     const rc: any = flow.submitPostFinishingForRecheck({ postTaskId: parent.postTaskId, quantities: [{ skuId: source.skus[0].skuId, quantity: 400 }], actor: actor.postOperator, operationId: 'MIXED-OLD-RC' })
  55  |     delete rc.operationId; delete rc.operationIntent; delete rc.sequence
  56  |     const oldParent: any = { ...parent, executionModel: undefined, processItems: ['烫包'], status: '后道完成', recheckOrderId: rc.recheckOrderId, recheckOrderNo: rc.recheckOrderNo, results: parent.lines.map((line, i) => ({ ...line, processedQty: i ? 0 : 400, unprocessedQty: i ? 0 : 600, unprocessedReason: i ? undefined : '明确旧合并表示' })) }
  57  |     const snapshot: any = { schemaVersion: 2, deliveries: [flow.getPostFinishingFactoryReturn(delivery.deliveryId)], qcTasks: [flow.getPostFinishingFullFlowQcTask(qc.qcTaskId)], postTasks: [oldParent], recheckOrders: [rc], outboundOrders: [], warehouseReceipts: [], waitProcessWarehouseRecords: flow.listPostFinishingWaitProcessWarehouseRecords(), waitProcessWarehouseMovements: flow.listPostFinishingWaitProcessWarehouseMovements(), waitHandoverWarehouseRecords: [], waitHandoverWarehouseMovements: [], returnConfirmationVersions: flow.listPostFinishingReturnConfirmationVersions(), defects: [], materialTransferOrders: [], materialStocks: [] }
  58  |     return { snapshot, parentId: parent.postTaskId, skuId: source.skus[0].skuId, oldRecheckId: rc.recheckOrderId }
  59  |   } finally { source.skus[0].plannedQty = original }
  60  | }
  61  | 
  62  | async function durable(page: Page) {
  63  |   return page.evaluate(async () => {
  64  |     const pcs = await (await import('/src/data/pcs-record-db.ts')).readPcsRecords(['higood-fcs-post-finishing-records'])
  65  |     const accessory = await (await import('/src/data/wls/accessory-warehouse-records.ts')).readAccessoryRecordSnapshot()
  66  |     const cutting = await (await import('/src/data/fcs/cutting/cutting-record-repository.ts')).exportCuttingRecordBackup()
  67  |     const files = async (rows: any[]) => Promise.all(rows.map(async row => ({ id: row.id, type: row.blob.type, bytes: Array.from(new Uint8Array(await row.blob.arrayBuffer())) })))
  68  |     return { pcs: { records: pcs.records, files: await files(pcs.files) }, accessory: { records: accessory.records, files: await files(cutting.files) } }
  69  |   })
  70  | }
  71  | async function migrateGarment(page: Page) {
  72  |   page.once('dialog', dialog => dialog.accept())
  73  |   await page.locator('[data-post-finishing-action="storage-migrate"]').click()
  74  | }
  75  | async function archiveAccessory(page: Page) {
  76  |   await page.goto('/fcs/craft/post-finishing/material-transfers')
  77  |   await expect(page.locator('[data-post-material-root]')).toBeVisible()
  78  |   const button = page.locator('[data-post-finishing-material-transfers-action="migrate"]')
  79  |   if (await button.count()) await button.click()
> 80  |   await expect(page.locator('[data-post-material-migration]')).toContainText('已完成')
      |                                                                ^ Error: expect(locator).toContainText(expected) failed
  81  | }
  82  | async function materialReadback(page: Page) {
  83  |   return page.evaluate(async () => {
  84  |     const auxiliary = await import('/src/data/wls/accessory-warehouse-post-finishing.ts')
  85  |     await auxiliary.prepareAccessoryPostFinishing()
  86  |     const flow = await import('/src/data/fcs/post-finishing-full-flow.ts')
  87  |     const backup = auxiliary.readLegacyAccessoryPostBackup()
  88  |     return { inspection: auxiliary.inspectLegacyAccessoryPostMigration(), sourceKeys: backup.sources.map(row => ({ key: row.key, fingerprint: row.fingerprint })), stocks: flow.listPostFinishingMaterialStocks().filter(row => row.transferOrderId === 'OLD-POST-1'), transfer: flow.getPostFinishingMaterialTransferOrder('OLD-POST-1') }
  89  |   })
  90  | }
  91  | async function carryAndContinue(page: Page, input: ReturnType<typeof legacyGarment>) {
  92  |   await page.goto(`/fcs/craft/post-finishing/work-orders/${input.parentId}`)
  93  |   await expect(page.locator('[data-post-prototype-actor], [data-post-finishing-work-order-detail-action="switch-actor"]')).toHaveCount(0)
  94  |   await page.locator('[data-post-finishing-work-order-detail-action="open-legacy"]').click()
  95  |   await expect(page.locator('[data-post-entry-supervisor]')).toHaveValue('')
  96  |   await page.locator('[data-post-entry-supervisor]').selectOption('PF-USER-POST-MGR')
  97  |   for (const item of flow.POST_FINISHING_PROCESS_ITEMS) await page.locator(`[data-post-legacy-process-item][value="${item}"]`).check()
  98  |   for (const item of flow.POST_FINISHING_PROCESS_ITEMS) for (const field of await page.locator(`[data-post-legacy-baseline="${item}"]`).all()) await field.fill('0')
  99  |   await page.locator('[data-post-entry-reason]').fill('混合旧资料承接，H400明确，剩余各项从0继续')
  100 |   page.once('dialog', dialog => dialog.accept())
  101 |   await page.locator('[data-post-finishing-work-order-detail-action="save-entry"]').click()
  102 |   await expect(page.locator('[data-post-entry-form]')).toHaveCount(0)
  103 |   return page.evaluate(async ({ parentId, skuId }) => {
  104 |     const r = await import('/src/data/fcs/post-finishing-records.ts'), f = await import('/src/data/fcs/post-finishing-full-flow.ts'), a = f.POST_FINISHING_ACCEPTANCE_ACTORS
  105 |     for (const item of f.POST_FINISHING_PROCESS_ITEMS) await r.runPostFinishingCommand(() => f.appendPostFinishingProcessCompletion({ postTaskId: parentId, processItem: item, quantities: [{ skuId, quantity: 100 }], responsible: a.postOperator, actor: a.postOperator, operationId: `MIXED-CONTINUE-${item}` }))
  106 |     const child = await r.runPostFinishingCommand(() => f.submitPostFinishingForRecheck({ postTaskId: parentId, quantities: [{ skuId, quantity: 100 }], actor: a.postOperator, operationId: 'MIXED-CONTINUE-RC' }))
  107 |     return { progress: f.getPostFinishingProcessProgress(parentId), child, children: f.listPostFinishingFullFlowRecheckOrders().filter(row => row.postTaskId === parentId) }
  108 |   }, input)
  109 | }
  110 | async function artifact(page: Page, name: string, value: unknown) {
  111 |   mkdirSync(evidence, { recursive: true })
  112 |   writeFileSync(resolve(evidence, `${name}.json`), JSON.stringify(value, null, 2))
  113 |   await page.screenshot({ path: `${evidence}/${name}.png`, fullPage: true })
  114 | }
  115 | 
  116 | for (const order of ['post-first-inline', 'accessory-first-existing-pcs'] as const) {
  117 |   test(`main integration: mixed legacy ${order}, atomic retry, original files and H/N continue`, async ({ page }) => {
  118 |     test.setTimeout(90000)
  119 |     const input = legacyGarment(), fixture = structuredClone(legacyMaterials)
  120 |     const originals = structuredClone(legacyMaterialRows.map((row: any) => row.value))
  121 |     for (const row of originals) input.snapshot[row.collection.split('/')[1]].push(row.value)
  122 |     if (order === 'post-first-inline') {
  123 |       const inline = `data:image/jpeg;base64,${readFileSync('public/materials/accessory-zipper.jpg').toString('base64')}`
  124 |       input.snapshot.materialTransferOrders[0].lines[0].imageUrl = inline
  125 |       input.snapshot.materialStocks[0].material.imageUrl = inline
  126 |       fixture.databases.find((db: any) => db.name === 'higood-pcs-records').stores.find((store: any) => store.name === 'records').rows = fixture.databases.find((db: any) => db.name === 'higood-pcs-records').stores.find((store: any) => store.name === 'records').rows.filter((row: any) => !/flow\/material(TransferOrders|Stocks)$/.test(row.value.collection))
  127 |     }
  128 |     await installFixture(page, fixture)
  129 |     const raw = JSON.stringify(input.snapshot)
  130 |     await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key: oldKey, raw })
  131 |     if (order === 'accessory-first-existing-pcs') await archiveAccessory(page)
  132 |     await page.goto('/fcs/craft/post-finishing/work-orders')
  133 |     await expect(page.locator('[data-post-finishing-action="storage-migrate"]')).toBeVisible()
  134 |     const before = await durable(page)
  135 |     await page.evaluate(() => { (window as any).__mixedOriginalPut = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (value: any, ...args: any[]) { if (this.name === 'records' && String(value?.id).startsWith('higood-fcs-post-finishing-records/')) throw new DOMException('mixed migration abort', 'QuotaExceededError'); return (window as any).__mixedOriginalPut.call(this, value, ...args) } })
  136 |     await migrateGarment(page)
  137 |     await expect(page.locator('[data-post-finishing-storage-notice]')).toContainText('本次未保存')
  138 |     expect(await durable(page)).toEqual(before)
  139 |     expect(await page.evaluate(key => localStorage.getItem(key), oldKey)).toBe(raw)
  140 |     await page.evaluate(() => { IDBObjectStore.prototype.put = (window as any).__mixedOriginalPut })
  141 |     await migrateGarment(page)
  142 |     await expect(page.locator('[data-post-finishing-storage-notice]')).toHaveCount(0)
  143 |     expect(await page.evaluate(key => localStorage.getItem(key), oldKey)).toBeNull()
  144 |     const migrated = await durable(page)
  145 |     const originalPcs = (value: typeof migrated) => value.pcs.records.filter(row => !row.deleted && /flow\/material(TransferOrders|Stocks)$/.test(row.collection))
  146 |     expect(originalPcs(migrated)).toEqual(originalPcs(before))
  147 |     expect(migrated.accessory).toEqual(before.accessory)
  148 |     expect(migrated.pcs.records.some(row => row.collection === 'archive' && String(row.id).includes(encodeURIComponent(oldKey)))).toBe(true)
  149 |     await archiveAccessory(page)
  150 |     const material = await materialReadback(page)
  151 |     expect(material.inspection.state).toBe('已完成')
  152 |     expect(material.stocks).toHaveLength(1)
  153 |     expect(material.stocks[0].currentQty).toBe(7)
  154 |     expect(material.stocks[0].inboundQty).toBe(10)
  155 |     const afterArchive = await durable(page)
  156 |     await page.reload(); await expect(page.locator('[data-post-material-root]')).toBeVisible()
  157 |     expect(await materialReadback(page)).toEqual(material)
  158 |     expect((await durable(page)).accessory).toEqual(afterArchive.accessory)
  159 |     if (order === 'post-first-inline') {
  160 |       // Same LS source version plus its converted archive must deduplicate.
  161 |       await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key: oldKey, raw })
  162 |       expect((await materialReadback(page)).sourceKeys).toEqual(material.sourceKeys)
  163 |       const altered = JSON.parse(raw); altered.materialStocks[0].currentQty = 6
  164 |       await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key: oldKey, raw: JSON.stringify(altered) })
  165 |       const blocked = await page.evaluate(async () => { try { await (await import('/src/data/wls/accessory-warehouse-post-finishing.ts')).prepareAccessoryPostFinishing(); return '' } catch (error) { return String(error) } })
  166 |       expect(blocked).toContain('不一致')
  167 |       expect((await durable(page)).accessory).toEqual(afterArchive.accessory)
  168 |       await page.evaluate(key => localStorage.removeItem(key), oldKey)
  169 |       await materialReadback(page)
  170 |     }
  171 |     const continued = await carryAndContinue(page, input)
  172 |     expect(continued.progress.totalCompletedQty).toBe(500)
  173 |     expect(continued.children).toHaveLength(2)
  174 |     expect(continued.children.some(child => child.recheckOrderId === input.oldRecheckId)).toBe(true)
  175 |     expect((await durable(page)).accessory).toEqual(afterArchive.accessory)
  176 |     await artifact(page, order, { inputBoundary: 'public garment source encoded schema2 plus main frozen AW fixture; isolated prototype only', material, continued, durable: await durable(page) })
  177 |   })
  178 | }
  179 | 
  180 | async function publicPostTask(page: Page) {
```