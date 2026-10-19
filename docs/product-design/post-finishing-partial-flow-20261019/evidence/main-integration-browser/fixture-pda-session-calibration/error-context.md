# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: post-finishing-main-integration.spec.ts >> main integration: managed PDA real route respects factory/roles, preserves failed receipt input and commits one auxiliary source
- Location: tests/post-finishing-main-integration.spec.ts:259:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('[data-managed-accessory-post-root]')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('[data-managed-accessory-post-root]')

```

```yaml
- text: HiGOOD
- heading "工厂登录" [level=1]
- paragraph: 已合作工厂请登录，未合作工厂可申请入驻。
- article:
  - text: 登录账号
  - img
  - textbox "登录账号":
    - /placeholder: 请输入登录账号
  - text: 密码
  - img
  - textbox "密码":
    - /placeholder: 请输入密码
  - img
  - button "登录"
  - button "去入驻"
```

# Test source

```ts
  176 |   })
  177 | }
  178 | 
  179 | async function publicPostTask(page: Page) {
  180 |   return page.evaluate(async () => {
  181 |     const f = await import('/src/data/fcs/post-finishing-full-flow.ts'), r = await import('/src/data/fcs/post-finishing-records.ts')
  182 |     const source = f.POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS[0], prior = source.skus[0].plannedQty, a = f.POST_FINISHING_ACCEPTANCE_ACTORS
  183 |     // The seed's qcA already owns another task; this isolated source uses a
  184 |     // separate complete prototype identity without releasing unrelated work.
  185 |     const qcActor = { ...a.qcA, actorId: 'INTEGRATED-QC-ACTOR', actorName: '整合验证独立质检员' }
  186 |     source.skus[0].plannedQty = prior + 1000
  187 |     try {
  188 |       const d = await r.runPostFinishingCommand(() => f.registerPostFinishingFactoryReturn({ productionOrderNo: source.productionOrderNo, executionTaskId: source.executionTaskId, returnIndex: 77, triggerSource: '车缝正常交出', idempotencyKey: 'INTEGRATED-BACKUP-SOURCE', quantities: source.skus.map((sku, i) => ({ skuId: sku.skuId, registeredQty: i ? 0 : 1000 })), deliveryPersonName: '整合备份隔离送货人', deliveryPersonPhone: '', evidenceImageUrls: [source.skus[0].imageUrl], actor: a.factoryCourier }))
  189 |       await r.runPostFinishingCommand(() => f.confirmPostFinishingFactoryReturn({ deliveryId: d.deliveryId, firstCounts: d.lines.map(line => ({ skuId: line.sku.skuId, actualQty: line.registeredQty })), actor: a.returnConfirmer }))
  190 |       const qc = await r.runPostFinishingCommand(() => f.sendPostFinishingFactoryReturnToQc({ deliveryId: d.deliveryId, actor: a.sender }))
  191 |       await r.runPostFinishingCommand(() => f.claimPostFinishingQcTask({ qcTaskNo: qc.qcTaskNo, actor: qcActor }))
  192 |       const result = await r.runPostFinishingCommand(() => f.completePostFinishingQcTask({ qcTaskId: qc.qcTaskId, actor: qcActor, processItems: [...f.POST_FINISHING_PROCESS_ITEMS], results: qc.lines.map(line => ({ skuId: line.sku.skuId, passedQty: line.expectedQty, defectQty: 0, returnQty: 0 })) }))
  193 |       for (const item of f.POST_FINISHING_PROCESS_ITEMS) await r.runPostFinishingCommand(() => f.appendPostFinishingProcessCompletion({ postTaskId: result.postTaskId!, processItem: item, quantities: [{ skuId: source.skus[0].skuId, quantity: 100 }], responsible: a.postOperator, actor: a.postOperator, operationId: `INTEGRATED-BACKUP-${item}` }))
  194 |       return { parentId: result.postTaskId!, skuId: source.skus[0].skuId }
  195 |     } finally { source.skus[0].plannedQty = prior }
  196 |   })
  197 | }
  198 | 
  199 | async function importBackup(page: Page, value: unknown, name = '混合旧备份.json') {
  200 |   await page.locator('[data-post-finishing-field="storage-import"]').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) })
  201 | }
  202 | 
  203 | test('main integration: actual restore keeps managed originals readonly, failed input retry and existing auxiliary stock unchanged', async ({ page }) => {
  204 |   test.setTimeout(90000)
  205 |   await installFixture(page, postFixture)
  206 |   await page.goto('/fcs/craft/post-finishing/material-transfers')
  207 |   await expect(page.locator('[data-post-material-root]')).toBeVisible()
  208 |   await page.evaluate(async id => {
  209 |     const api = await import('/src/data/wls/accessory-warehouse-post-finishing.ts'), f = await import('/src/data/fcs/post-finishing-full-flow.ts')
  210 |     const order = f.getPostFinishingMaterialTransferOrder(id)!
  211 |     await api.receiveAccessoryPostTransfer({ id, commandId: 'INTEGRATED-AUX-RECEIVE', at: '2026-10-20T00:00:00Z', actor: { role: '仓管', warehouseCode: 'DLN', name: '整合验证DLN仓管' }, lines: order.lines.map(line => ({ lineId: line.transferLineId, qty: line.preparedQty, locationId: api.listAccessoryPostLocations()[0].id })) })
  212 |   }, postFixture.pendingPostTransferId)
  213 |   await page.goto('/fcs/craft/post-finishing/work-orders')
  214 |   await expect(page.locator('main h1')).toHaveText('后道加工单')
  215 |   const task = await publicPostTask(page)
  216 |   const backup = await page.evaluate(async () => JSON.parse(await (await (await import('/src/data/fcs/post-finishing-records.ts')).exportPostFinishingBackup()).text()))
  217 |   for (const row of legacyMaterialRows) backup.records.push(structuredClone(row.value))
  218 |   backup.files.push({ id: legacyFile.id, type: legacyFile.blob.type, bytes: legacyFile.blob.bytes })
  219 |   await page.goto('/fcs/craft/post-finishing/audit-records')
  220 |   await expect(page.locator('[data-post-finishing-field="storage-import"]')).toHaveCount(1)
  221 |   const before = await durable(page)
  222 |   await importBackup(page, { invalid: true }, '错误格式.json')
  223 |   await expect(page.locator('[data-post-finishing-action-error]')).toContainText('格式')
  224 |   expect(await durable(page)).toEqual(before)
  225 |   const successfulInput = await page.locator('[data-post-finishing-field="storage-import"]').elementHandle()
  226 |   await importBackup(page, backup)
  227 |   await expect.poll(async () => (await durable(page)).pcs.records.filter(row => row.collection === 'archive' && (row.value as any)?.format === 'post-finishing-readonly-material-original').length).toBe(2)
  228 |   await expect(page.locator('[data-post-finishing-action-error]')).toHaveCount(0)
  229 |   await expect.poll(() => successfulInput!.evaluate(node => node.isConnected)).toBe(false)
  230 |   const restored = await durable(page)
  231 |   expect(restored.accessory).toEqual(before.accessory)
  232 |   expect(restored.pcs.records.filter(row => !row.deleted && /flow\/material(TransferOrders|Stocks)$/.test(row.collection))).toEqual(before.pcs.records.filter(row => !row.deleted && /flow\/material(TransferOrders|Stocks)$/.test(row.collection)))
  233 |   expect(restored.pcs.files.some(file => file.id === legacyFile.id && file.bytes.length === legacyFile.blob.bytes.length)).toBe(true)
  234 |   const repeatInput = await page.locator('[data-post-finishing-field="storage-import"]').elementHandle()
  235 |   await importBackup(page, backup, '同一备份重试.json')
  236 |   await expect(page.locator('[data-post-finishing-action-error]')).toHaveCount(0)
  237 |   await expect.poll(() => repeatInput!.evaluate(node => node.isConnected)).toBe(false)
  238 |   expect((await durable(page)).pcs.records).toEqual(restored.pcs.records)
  239 |   const conflict = structuredClone(backup)
  240 |   conflict.records.find((row: any) => row.collection === 'flow/materialStocks').value.currentQty = 6
  241 |   await importBackup(page, conflict, '相同原记录不同内容.json')
  242 |   await expect(page.locator('[data-post-finishing-action-error]')).toContainText('冲突')
  243 |   expect(await page.locator('[data-post-finishing-field="storage-import"]').evaluate((node: HTMLInputElement) => node.files?.[0]?.name)).toBe('相同原记录不同内容.json')
  244 |   expect(await durable(page)).toEqual(restored)
  245 |   const continued = await page.evaluate(async input => {
  246 |     const f = await import('/src/data/fcs/post-finishing-full-flow.ts'), r = await import('/src/data/fcs/post-finishing-records.ts'), a = f.POST_FINISHING_ACCEPTANCE_ACTORS
  247 |     await r.runPostFinishingCommand(() => f.appendPostFinishingProcessCompletion({ postTaskId: input.parentId, processItem: '开扣眼', quantities: [{ skuId: input.skuId, quantity: 100 }], responsible: a.postOperator, actor: a.postOperator, operationId: 'AFTER-READONLY-RESTORE' }))
  248 |     return r.runPostFinishingCommand(() => f.submitPostFinishingForRecheck({ postTaskId: input.parentId, quantities: [{ skuId: input.skuId, quantity: 100 }], actor: a.postOperator, operationId: 'AFTER-READONLY-RESTORE-RC' }))
  249 |   }, task)
  250 |   expect(continued.lines.reduce((sum, line) => sum + line.expectedQty, 0)).toBe(100)
  251 |   expect((await durable(page)).accessory).toEqual(before.accessory)
  252 |   await artifact(page, 'readonly-backup-restore', { restored, continued, auxiliaryUnchanged: true })
  253 | })
  254 | 
  255 | async function session(page: Page, roleId: string, factoryId = 'ID-F002') {
  256 |   await page.evaluate(({ roleId, factoryId }) => localStorage.setItem('fcs_pda_session', JSON.stringify({ userId: `${factoryId}_integration_${roleId}`, loginId: `${factoryId}_integration_${roleId}`, userName: '整合验证原型身份', roleId, factoryId, factoryName: factoryId === 'ID-F002' ? '后道工厂' : '其他工厂', loggedAt: '2026-10-20 10:00:00' })), { roleId, factoryId })
  257 | }
  258 | 
  259 | test('main integration: managed PDA real route respects factory/roles, preserves failed receipt input and commits one auxiliary source', async ({ browser, baseURL }) => {
  260 |   test.setTimeout(120000)
  261 |   const results: any[] = []
  262 |   for (const [roleId, factoryId] of [['ROLE_OPERATOR', 'ID-F002'], ['ROLE_ADMIN', 'ID-F002'], ['ROLE_HANDOVER', 'ID-F002'], ['ROLE_DISPATCH', 'ID-F002'], ['ROLE_ADMIN', 'ID-F090']]) {
  263 |     const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } }), page = await context.newPage()
  264 |     try {
  265 |       await installFixture(page, postFixture)
  266 |       await session(page, roleId, factoryId)
  267 |       await page.goto('/fcs/craft/post-finishing/material-transfers')
  268 |       await expect(page.locator('[data-post-material-root]')).toBeVisible()
  269 |       const no = await page.evaluate(id => import('/src/data/fcs/post-finishing-full-flow.ts').then(f => f.getPostFinishingMaterialTransferOrder(id)!.transferOrderNo), postFixture.pendingPostTransferId)
  270 |       await page.goto(`/fcs/pda/handover?tab=pickup&materialOrderNo=${encodeURIComponent(no)}`)
  271 |       const before = await durable(page)
  272 |       if (factoryId !== 'ID-F002') {
  273 |         await expect(page.locator('[data-managed-accessory-post-access-blocked]')).toBeVisible()
  274 |         await expect(page.locator('[data-pda-post-qty]')).toHaveCount(0)
  275 |       } else {
> 276 |         await expect(page.locator('[data-managed-accessory-post-root]')).toBeVisible()
      |                                                                          ^ Error: expect(locator).toBeVisible() failed
  277 |         const quantities = page.locator('[data-pda-post-qty]'), locations = page.locator('[data-pda-post-location]'), save = page.locator('[data-pda-handover-action="confirm-material-inbound"]')
  278 |         if (roleId === 'ROLE_OPERATOR') {
  279 |           for (const input of await quantities.all()) await expect(input).toBeDisabled()
  280 |           await expect(save).toHaveCount(0)
  281 |           const blocked = await page.evaluate(async no => { try { const f = await import('/src/data/fcs/post-finishing-full-flow.ts'), r = await import('/src/data/fcs/post-finishing-records.ts'); await r.runPostFinishingCommand(() => f.receivePostFinishingMaterialTransfer({ transferOrderNo: no, actor: { actorId: 'old', actorName: '旧入口', roleName: '仓管' } })); return '' } catch (error) { return String(error) } }, no)
  282 |           expect(blocked).toContain('原整单入库入口不可')
  283 |         } else {
  284 |           await expect(save).toBeVisible()
  285 |           for (const input of await quantities.all()) await expect(input).toBeEnabled()
  286 |           if (roleId === 'ROLE_ADMIN') {
  287 |             await quantities.nth(0).fill('9'); await quantities.nth(1).fill('20')
  288 |             await save.click(); await expect(page.locator('[data-pda-post-error]')).toContainText('逐行')
  289 |             expect(await durable(page)).toEqual(before)
  290 |             for (const select of await locations.all()) await select.selectOption({ label: 'PF-MAT-A01-01' })
  291 |             page.once('dialog', dialog => dialog.accept()); await save.click()
  292 |             await expect(page.locator('[data-pda-post-error]')).toContainText('整单')
  293 |             expect(await quantities.nth(0).inputValue()).toBe('9')
  294 |             expect(await durable(page)).toEqual(before)
  295 |             await quantities.nth(0).fill('10')
  296 |             await page.evaluate(() => { (window as any).__integratedPut = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (...args: any[]) { if (this.name === 'records') throw new DOMException('integrated PDA abort', 'QuotaExceededError'); return (window as any).__integratedPut.apply(this, args) } })
  297 |             page.once('dialog', dialog => dialog.accept()); await save.click()
  298 |             await expect(page.locator('[data-pda-post-error]')).toContainText('integrated PDA abort')
  299 |             expect(await quantities.nth(0).inputValue()).toBe('10')
  300 |             expect(await durable(page)).toEqual(before)
  301 |             await page.evaluate(() => { IDBObjectStore.prototype.put = (window as any).__integratedPut })
  302 |             await save.click()
  303 |             await expect(page.getByRole('heading', { name: '辅料已收货上架', exact: true })).toBeVisible()
  304 |             const after = await durable(page)
  305 |             expect(after.pcs).toEqual(before.pcs)
  306 |             const readback = await page.evaluate(async () => { const f = await import('/src/data/fcs/post-finishing-full-flow.ts'); return { stocks: f.listPostFinishingMaterialStocks().filter(row => row.productionOrderNo === 'PO-AW-202610-F01'), ready: f.getPostFinishingMaterialReadiness('PO-AW-202610-F01') } })
  307 |             expect(readback.stocks.map(row => row.currentQty).sort((a, b) => a - b)).toEqual([10, 20])
  308 |             expect(readback.ready.status).toBe('已入库')
  309 |             await page.reload(); await expect(page.getByRole('heading', { name: '辅料已收货上架', exact: true })).toBeVisible()
  310 |             expect(await durable(page)).toEqual(after)
  311 |             await artifact(page, 'managed-pda-receipt', { roleId, no, readback, before, after })
  312 |           }
  313 |         }
  314 |       }
  315 |       if (roleId !== 'ROLE_ADMIN' || factoryId !== 'ID-F002') expect(await durable(page)).toEqual(before)
  316 |       expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  317 |       results.push({ roleId, factoryId, actualRoute: page.url(), result: factoryId !== 'ID-F002' ? 'blocked' : roleId === 'ROLE_OPERATOR' ? 'readonly, old managed receive rejected' : roleId === 'ROLE_ADMIN' ? 'failure retry and receipt complete' : 'receipt controls enabled' })
  318 |     } finally { await context.close() }
  319 |   }
  320 |   mkdirSync(evidence, { recursive: true }); writeFileSync(resolve(evidence, 'managed-role-results.json'), JSON.stringify(results, null, 2))
  321 | })
  322 | 
```