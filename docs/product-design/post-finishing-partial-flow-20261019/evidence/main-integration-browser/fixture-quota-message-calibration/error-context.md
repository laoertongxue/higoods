# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: post-finishing-main-integration.spec.ts >> main integration: mixed legacy post-first-inline, atomic retry, original files and H/N continue
- Location: tests/post-finishing-main-integration.spec.ts:116:3

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('[data-post-finishing-storage-notice]')
Expected substring: "mixed migration abort"
Received string:    "发现本浏览器保存的旧后道资料。请先关闭其他旧版页面，再转换资料后继续操作；转换失败会保留旧资料。转换旧后道资料"
Timeout: 10000ms

Call log:
  - Expect "toContainText" with timeout 10000ms
  - waiting for locator('[data-post-finishing-storage-notice]')
    - locator resolved to <section role="status" data-post-finishing-storage-notice="" class="m-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">…</section>
    - unexpected value "发现本浏览器保存的旧后道资料。请先关闭其他旧版页面，再转换资料后继续操作；转换失败会保留旧资料。转换旧后道资料"
    2 × locator resolved to <section role="status" data-post-finishing-storage-notice="" class="m-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">…</section>
      - unexpected value "正在转换并核对旧资料，请等待完成。"
    9 × locator resolved to <section role="status" data-post-finishing-storage-notice="" class="m-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">…</section>
      - unexpected value "浏览器空间不足，本次未保存。请保留当前输入，空间恢复后重试。重新转换"
    8 × locator resolved to <section role="status" data-post-finishing-storage-notice="" class="m-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">…</section>
      - unexpected value "发现本浏览器保存的旧后道资料。请先关闭其他旧版页面，再转换资料后继续操作；转换失败会保留旧资料。转换旧后道资料"

```

```yaml
- status:
  - paragraph: 发现本浏览器保存的旧后道资料。请先关闭其他旧版页面，再转换资料后继续操作；转换失败会保留旧资料。
  - button "转换旧后道资料"
```

# Test source

```ts
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
  79  |   if (await button.count()) { page.once('dialog', dialog => dialog.accept()); await button.click() }
  80  |   await expect(page.locator('[data-post-material-migration]')).toContainText('已完成')
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
  93  |   await page.locator('[data-post-prototype-actor]').selectOption('PF-USER-POST-MGR')
  94  |   await page.locator('[data-post-finishing-work-order-detail-action="switch-actor"]').click()
  95  |   await page.locator('[data-post-finishing-work-order-detail-action="open-legacy"]').click()
  96  |   for (const item of flow.POST_FINISHING_PROCESS_ITEMS) await page.locator(`[data-post-legacy-process-item][value="${item}"]`).check()
  97  |   for (const item of flow.POST_FINISHING_PROCESS_ITEMS) for (const field of await page.locator(`[data-post-legacy-baseline="${item}"]`).all()) await field.fill('0')
  98  |   await page.locator('[data-post-entry-reason]').fill('混合旧资料承接，H400明确，剩余各项从0继续')
  99  |   page.once('dialog', dialog => dialog.accept())
  100 |   await page.locator('[data-post-finishing-work-order-detail-action="save-entry"]').click()
  101 |   await expect(page.locator('[data-post-entry-form]')).toHaveCount(0)
  102 |   return page.evaluate(async ({ parentId, skuId }) => {
  103 |     const r = await import('/src/data/fcs/post-finishing-records.ts'), f = await import('/src/data/fcs/post-finishing-full-flow.ts'), a = f.POST_FINISHING_ACCEPTANCE_ACTORS
  104 |     for (const item of f.POST_FINISHING_PROCESS_ITEMS) await r.runPostFinishingCommand(() => f.appendPostFinishingProcessCompletion({ postTaskId: parentId, processItem: item, quantities: [{ skuId, quantity: 100 }], responsible: a.postOperator, actor: a.postOperator, operationId: `MIXED-CONTINUE-${item}` }))
  105 |     const child = await r.runPostFinishingCommand(() => f.submitPostFinishingForRecheck({ postTaskId: parentId, quantities: [{ skuId, quantity: 100 }], actor: a.postOperator, operationId: 'MIXED-CONTINUE-RC' }))
  106 |     return { progress: f.getPostFinishingProcessProgress(parentId), child, children: f.listPostFinishingFullFlowRecheckOrders().filter(row => row.postTaskId === parentId) }
  107 |   }, input)
  108 | }
  109 | async function artifact(page: Page, name: string, value: unknown) {
  110 |   mkdirSync(evidence, { recursive: true })
  111 |   writeFileSync(resolve(evidence, `${name}.json`), JSON.stringify(value, null, 2))
  112 |   await page.screenshot({ path: `${evidence}/${name}.png`, fullPage: true })
  113 | }
  114 | 
  115 | for (const order of ['post-first-inline', 'accessory-first-existing-pcs'] as const) {
  116 |   test(`main integration: mixed legacy ${order}, atomic retry, original files and H/N continue`, async ({ page }) => {
  117 |     test.setTimeout(90000)
  118 |     const input = legacyGarment(), fixture = structuredClone(legacyMaterials)
  119 |     const originals = structuredClone(legacyMaterialRows.map((row: any) => row.value))
  120 |     for (const row of originals) input.snapshot[row.collection.split('/')[1]].push(row.value)
  121 |     if (order === 'post-first-inline') {
  122 |       const inline = `data:image/jpeg;base64,${readFileSync('public/materials/accessory-zipper.jpg').toString('base64')}`
  123 |       input.snapshot.materialTransferOrders[0].lines[0].imageUrl = inline
  124 |       input.snapshot.materialStocks[0].material.imageUrl = inline
  125 |       fixture.databases.find((db: any) => db.name === 'higood-pcs-records').stores.find((store: any) => store.name === 'records').rows = fixture.databases.find((db: any) => db.name === 'higood-pcs-records').stores.find((store: any) => store.name === 'records').rows.filter((row: any) => !/flow\/material(TransferOrders|Stocks)$/.test(row.value.collection))
  126 |     }
  127 |     await installFixture(page, fixture)
  128 |     const raw = JSON.stringify(input.snapshot)
  129 |     await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key: oldKey, raw })
  130 |     if (order === 'accessory-first-existing-pcs') await archiveAccessory(page)
  131 |     await page.goto('/fcs/craft/post-finishing/work-orders')
  132 |     await expect(page.locator('[data-post-finishing-action="storage-migrate"]')).toBeVisible()
  133 |     const before = await durable(page)
  134 |     await page.evaluate(() => { (window as any).__mixedOriginalPut = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (value: any, ...args: any[]) { if (this.name === 'records' && String(value?.id).startsWith('higood-fcs-post-finishing-records/')) throw new DOMException('mixed migration abort', 'QuotaExceededError'); return (window as any).__mixedOriginalPut.call(this, value, ...args) } })
  135 |     await migrateGarment(page)
> 136 |     await expect(page.locator('[data-post-finishing-storage-notice]')).toContainText('mixed migration abort')
      |                                                                        ^ Error: expect(locator).toContainText(expected) failed
  137 |     expect(await durable(page)).toEqual(before)
  138 |     expect(await page.evaluate(key => localStorage.getItem(key), oldKey)).toBe(raw)
  139 |     await page.evaluate(() => { IDBObjectStore.prototype.put = (window as any).__mixedOriginalPut })
  140 |     await migrateGarment(page)
  141 |     await expect(page.locator('[data-post-finishing-storage-notice]')).toHaveCount(0)
  142 |     expect(await page.evaluate(key => localStorage.getItem(key), oldKey)).toBeNull()
  143 |     const migrated = await durable(page)
  144 |     const originalPcs = (value: typeof migrated) => value.pcs.records.filter(row => !row.deleted && /flow\/material(TransferOrders|Stocks)$/.test(row.collection))
  145 |     expect(originalPcs(migrated)).toEqual(originalPcs(before))
  146 |     expect(migrated.accessory).toEqual(before.accessory)
  147 |     expect(migrated.pcs.records.some(row => row.collection === 'archive' && String(row.id).includes(encodeURIComponent(oldKey)))).toBe(true)
  148 |     await archiveAccessory(page)
  149 |     const material = await materialReadback(page)
  150 |     expect(material.inspection.state).toBe('已完成')
  151 |     expect(material.stocks).toHaveLength(1)
  152 |     expect(material.stocks[0].currentQty).toBe(7)
  153 |     expect(material.stocks[0].inboundQty).toBe(10)
  154 |     const afterArchive = await durable(page)
  155 |     await page.reload(); await expect(page.locator('[data-post-material-root]')).toBeVisible()
  156 |     expect(await materialReadback(page)).toEqual(material)
  157 |     expect((await durable(page)).accessory).toEqual(afterArchive.accessory)
  158 |     if (order === 'post-first-inline') {
  159 |       // Same LS source version plus its converted archive must deduplicate.
  160 |       await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key: oldKey, raw })
  161 |       expect((await materialReadback(page)).sourceKeys).toEqual(material.sourceKeys)
  162 |       const altered = JSON.parse(raw); altered.materialStocks[0].currentQty = 6
  163 |       await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key: oldKey, raw: JSON.stringify(altered) })
  164 |       const blocked = await page.evaluate(async () => { try { await (await import('/src/data/wls/accessory-warehouse-post-finishing.ts')).prepareAccessoryPostFinishing(); return '' } catch (error) { return String(error) } })
  165 |       expect(blocked).toContain('不一致')
  166 |       expect((await durable(page)).accessory).toEqual(afterArchive.accessory)
  167 |       await page.evaluate(key => localStorage.removeItem(key), oldKey)
  168 |       await materialReadback(page)
  169 |     }
  170 |     const continued = await carryAndContinue(page, input)
  171 |     expect(continued.progress.totalCompletedQty).toBe(500)
  172 |     expect(continued.children).toHaveLength(2)
  173 |     expect(continued.children.some(child => child.recheckOrderId === input.oldRecheckId)).toBe(true)
  174 |     expect((await durable(page)).accessory).toEqual(afterArchive.accessory)
  175 |     await artifact(page, order, { inputBoundary: 'public garment source encoded schema2 plus main frozen AW fixture; isolated prototype only', material, continued, durable: await durable(page) })
  176 |   })
  177 | }
  178 | 
  179 | async function publicPostTask(page: Page) {
  180 |   return page.evaluate(async () => {
  181 |     const f = await import('/src/data/fcs/post-finishing-full-flow.ts'), r = await import('/src/data/fcs/post-finishing-records.ts')
  182 |     const source = f.POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS[0], prior = source.skus[0].plannedQty, a = f.POST_FINISHING_ACCEPTANCE_ACTORS
  183 |     source.skus[0].plannedQty = prior + 1000
  184 |     try {
  185 |       const d = await r.runPostFinishingCommand(() => f.registerPostFinishingFactoryReturn({ productionOrderNo: source.productionOrderNo, executionTaskId: source.executionTaskId, returnIndex: 77, triggerSource: '车缝正常交出', idempotencyKey: 'INTEGRATED-BACKUP-SOURCE', quantities: source.skus.map((sku, i) => ({ skuId: sku.skuId, registeredQty: i ? 0 : 1000 })), deliveryPersonName: '整合备份隔离送货人', deliveryPersonPhone: '', evidenceImageUrls: [source.skus[0].imageUrl], actor: a.factoryCourier }))
  186 |       await r.runPostFinishingCommand(() => f.confirmPostFinishingFactoryReturn({ deliveryId: d.deliveryId, firstCounts: d.lines.map(line => ({ skuId: line.sku.skuId, actualQty: line.registeredQty })), actor: a.returnConfirmer }))
  187 |       const qc = await r.runPostFinishingCommand(() => f.sendPostFinishingFactoryReturnToQc({ deliveryId: d.deliveryId, actor: a.sender }))
  188 |       await r.runPostFinishingCommand(() => f.claimPostFinishingQcTask({ qcTaskNo: qc.qcTaskNo, actor: a.qcA }))
  189 |       const result = await r.runPostFinishingCommand(() => f.completePostFinishingQcTask({ qcTaskId: qc.qcTaskId, actor: a.qcA, processItems: [...f.POST_FINISHING_PROCESS_ITEMS], results: qc.lines.map(line => ({ skuId: line.sku.skuId, passedQty: line.expectedQty, defectQty: 0, returnQty: 0 })) }))
  190 |       for (const item of f.POST_FINISHING_PROCESS_ITEMS) await r.runPostFinishingCommand(() => f.appendPostFinishingProcessCompletion({ postTaskId: result.postTaskId!, processItem: item, quantities: [{ skuId: source.skus[0].skuId, quantity: 100 }], responsible: a.postOperator, actor: a.postOperator, operationId: `INTEGRATED-BACKUP-${item}` }))
  191 |       return { parentId: result.postTaskId!, skuId: source.skus[0].skuId }
  192 |     } finally { source.skus[0].plannedQty = prior }
  193 |   })
  194 | }
  195 | 
  196 | async function importBackup(page: Page, value: unknown, name = '混合旧备份.json') {
  197 |   await page.locator('[data-post-finishing-field="storage-import"]').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) })
  198 | }
  199 | 
  200 | test('main integration: actual restore keeps managed originals readonly, failed input retry and existing auxiliary stock unchanged', async ({ page }) => {
  201 |   test.setTimeout(90000)
  202 |   await installFixture(page, postFixture)
  203 |   await page.goto('/fcs/craft/post-finishing/material-transfers')
  204 |   await expect(page.locator('[data-post-material-root]')).toBeVisible()
  205 |   await page.evaluate(async id => {
  206 |     const api = await import('/src/data/wls/accessory-warehouse-post-finishing.ts'), f = await import('/src/data/fcs/post-finishing-full-flow.ts')
  207 |     const order = f.getPostFinishingMaterialTransferOrder(id)!
  208 |     await api.receiveAccessoryPostTransfer({ id, commandId: 'INTEGRATED-AUX-RECEIVE', at: '2026-10-20T00:00:00Z', actor: { role: '仓管', warehouseCode: 'DLN', name: '整合验证DLN仓管' }, lines: order.lines.map(line => ({ lineId: line.transferLineId, qty: line.preparedQty, locationId: api.listAccessoryPostLocations()[0].id })) })
  209 |   }, postFixture.pendingPostTransferId)
  210 |   await page.goto('/fcs/craft/post-finishing/work-orders')
  211 |   await expect(page.locator('main h1')).toHaveText('后道加工单')
  212 |   const task = await publicPostTask(page)
  213 |   const backup = await page.evaluate(async () => JSON.parse(await (await (await import('/src/data/fcs/post-finishing-records.ts')).exportPostFinishingBackup()).text()))
  214 |   for (const row of legacyMaterialRows) backup.records.push(structuredClone(row.value))
  215 |   backup.files.push({ id: legacyFile.id, type: legacyFile.blob.type, bytes: legacyFile.blob.bytes })
  216 |   await page.goto('/fcs/craft/post-finishing/audit-records')
  217 |   await expect(page.locator('[data-post-finishing-field="storage-import"]')).toHaveCount(1)
  218 |   const before = await durable(page)
  219 |   await importBackup(page, { invalid: true }, '错误格式.json')
  220 |   await expect(page.locator('[data-post-finishing-action-error]')).toContainText('格式')
  221 |   expect(await durable(page)).toEqual(before)
  222 |   const successfulInput = await page.locator('[data-post-finishing-field="storage-import"]').elementHandle()
  223 |   await importBackup(page, backup)
  224 |   await expect.poll(async () => (await durable(page)).pcs.records.filter(row => row.collection === 'archive' && (row.value as any)?.format === 'post-finishing-readonly-material-original').length).toBe(2)
  225 |   await expect(page.locator('[data-post-finishing-action-error]')).toHaveCount(0)
  226 |   await expect.poll(() => successfulInput!.evaluate(node => node.isConnected)).toBe(false)
  227 |   const restored = await durable(page)
  228 |   expect(restored.accessory).toEqual(before.accessory)
  229 |   expect(restored.pcs.records.filter(row => !row.deleted && /flow\/material(TransferOrders|Stocks)$/.test(row.collection))).toEqual(before.pcs.records.filter(row => !row.deleted && /flow\/material(TransferOrders|Stocks)$/.test(row.collection)))
  230 |   expect(restored.pcs.files.some(file => file.id === legacyFile.id && file.bytes.length === legacyFile.blob.bytes.length)).toBe(true)
  231 |   const repeatInput = await page.locator('[data-post-finishing-field="storage-import"]').elementHandle()
  232 |   await importBackup(page, backup, '同一备份重试.json')
  233 |   await expect(page.locator('[data-post-finishing-action-error]')).toHaveCount(0)
  234 |   await expect.poll(() => repeatInput!.evaluate(node => node.isConnected)).toBe(false)
  235 |   expect((await durable(page)).pcs.records).toEqual(restored.pcs.records)
  236 |   const conflict = structuredClone(backup)
```