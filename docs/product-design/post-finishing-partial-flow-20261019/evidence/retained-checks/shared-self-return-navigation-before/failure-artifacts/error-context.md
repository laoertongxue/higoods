# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: post-finishing-pda-role-boundary.spec.ts >> 车缝自助回货由管理员开启，锁定与退出状态完整闭环
- Location: tests/post-finishing-pda-role-boundary.spec.ts:222:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: '成衣回货登记模式' })
Expected: visible
Timeout: 30000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 30000ms
  - waiting for getByRole('heading', { name: '成衣回货登记模式' })

```

```yaml
- text: 页面内容加载失败，请稍后重试。
```

# Test source

```ts
  136 |   await expect(page.locator('body')).not.toContainText('授权码')
  137 |   await expect(page.locator('body')).not.toContainText('补料')
  138 |   await expectNoHorizontalOverflow(page)
  139 | 
  140 |   page.once('dialog', async (dialog) => {
  141 |     expect(dialog.message()).toContain('一次性入库')
  142 |     await dialog.accept()
  143 |   })
  144 |   await page.getByRole('button', { name: '确认全部物料已领回并整单入库' }).click()
  145 |   await expect(page.locator('body')).toContainText('整单入库成功')
  146 |   await expect(page.locator('body')).toContainText('该调拨单已整单入库')
  147 | 
  148 |   await page.setViewportSize({ width: 1280, height: 720 })
  149 |   await page.goto('/fcs/craft/post-finishing/wait-process-warehouse?tab=materials')
  150 |   await expect(page.getByRole('heading', { name: '后道待加工仓' })).toBeVisible()
  151 |   await expect(page.getByText('辅料库存', { exact: true }).first()).toBeVisible()
  152 |   await expect(page.getByRole('heading', { name: '辅料库存' })).toBeVisible()
  153 |   await expect(page.locator('tbody tr')).toHaveCount(4)
  154 |   await expect(page.locator('tbody')).toContainText('495 PCS')
  155 |   await expect(page.locator('tbody')).toContainText('DB-PF-202608-001')
  156 |   await expectNoHorizontalOverflow(page)
  157 | })
  158 | 
  159 | test('已有 001 入库历史不被覆盖并自动补齐新增待入库测试单', async ({ page }) => {
  160 |   await setSession(page, 'ROLE_OPERATOR')
  161 |   await page.setViewportSize({ width: 390, height: 844 })
  162 |   await page.goto('/fcs/pda/handover?tab=pickup')
  163 |   await expect(page.getByRole('heading', { name: '后道辅料待入库' })).toBeVisible()
  164 |   await expect(page.locator('[data-pda-material-transfer-card]')).toHaveCount(5)
  165 |   await page.evaluate(async () => {
  166 |     const flow = await import('/src/data/fcs/post-finishing-full-flow.ts')
  167 |     const records = await import('/src/data/fcs/post-finishing-records.ts')
  168 |     await records.ensurePostFinishingRecordState()
  169 |     await records.runPostFinishingCommand(() => flow.receivePostFinishingMaterialTransfer({
  170 |       transferOrderNo: 'DB-PF-202608-001', actor: { actorId: 'PF-USER-WH', actorName: '孙仓库收货员', roleName: '仓库收货人员' },
  171 |       nowMs: Date.UTC(2026, 8, 12, 8, 0, 0),
  172 |     }))
  173 |   })
  174 |   await page.reload()
  175 |   await expect(page.locator('[data-pda-material-transfer-card]')).toHaveCount(4)
  176 |   await expect(page.locator('[data-pda-material-transfer-card="DB-PF-202608-001"]')).toHaveCount(0)
  177 |   await expect(page.locator('[data-pda-material-transfer-card="DB-PF-202608-002"]')).toBeVisible()
  178 |   await expect(page.locator('[data-pda-material-transfer-card="DB-PF-202608-005"]')).toBeVisible()
  179 |   const migrated = await page.evaluate(async () => {
  180 |     const flow = await import('/src/data/fcs/post-finishing-full-flow.ts')
  181 |     const db = await import('/src/data/pcs-record-db.ts')
  182 |     const rows = (await db.readPcsRecords(['higood-fcs-post-finishing-records'])).records
  183 |     const saved = rows.filter(row => row.collection === 'flow/materialTransferOrders' && !row.deleted).map(row => row.value as any)
  184 |     if (saved.length !== 1 || saved[0].transferOrderNo !== 'DB-PF-202608-001' || saved[0].status !== '已入库') throw new Error('只保存本次修改的001覆盖，不应整批复制静态种子')
  185 |     return flow.listPostFinishingMaterialTransferOrders().map(item => ({ no: item.transferOrderNo, status: item.status }))
  186 |   })
  187 |   expect(migrated).toHaveLength(5)
  188 |   expect(migrated).toContainEqual({ no: 'DB-PF-202608-001', status: '已入库' })
  189 |   await expectNoHorizontalOverflow(page)
  190 | })
  191 | 
  192 | test('后道交接已交出直接展示 Web 后道出货单及 SKU 明细', async ({ page }) => {
  193 |   await setSession(page, 'ROLE_OPERATOR')
  194 |   for (const viewport of [{ width: 390, height: 844 }, { width: 480, height: 800 }]) {
  195 |     await page.setViewportSize(viewport)
  196 |     await page.goto('/fcs/pda/handover?tab=shipped')
  197 |     await expect(page.getByText('已交出记录', { exact: true })).toBeVisible()
  198 |     await expect(page.locator('[data-pda-post-outbound-card]').first()).toBeVisible()
  199 |     await expect(page.locator('body')).toContainText('后道出货单')
  200 |     await expect(page.getByRole('button', { name: /待交出/ })).toHaveCount(0)
  201 |     const card = page.locator('[data-pda-post-outbound-card]').first()
  202 |     await card.locator('summary').click()
  203 |     await expect(card.locator('[data-pda-post-outbound-line]').first()).toBeVisible()
  204 |     await expect(card.locator('[data-pda-post-outbound-line]').first()).toContainText(/SPU-QC-/)
  205 |     await expect(card.locator('[data-pda-post-outbound-line]').first().locator('[data-pda-image-preview-url]')).toHaveCount(1)
  206 |     await expectNoHorizontalOverflow(page)
  207 |   }
  208 | })
  209 | 
  210 | test('后道加工和后道复检操作页均可返回执行工作台', async ({ page }) => {
  211 |   await setSession(page, 'ROLE_OPERATOR')
  212 |   for (const route of ['/fcs/pda/post-finishing/execute', '/fcs/pda/post-finishing/recheck']) {
  213 |     await page.goto(route)
  214 |     const back = page.getByTestId('pda-post-back')
  215 |     await expect(back).toBeVisible()
  216 |     await expect(back).toHaveText(/返回/)
  217 |     await back.click()
  218 |     await expect(page).toHaveURL(/\/fcs\/pda\/exec$/)
  219 |   }
  220 | })
  221 | 
  222 | test('车缝自助回货由管理员开启，锁定与退出状态完整闭环', async ({ page }) => {
  223 |   await setSession(page, 'ROLE_OPERATOR')
  224 |   await page.goto('/fcs/pda/handover?tab=pickup')
  225 |   page.once('dialog', async (dialog) => {
  226 |     expect(dialog.message()).toContain('请由后道工厂管理员开启')
  227 |     await dialog.accept()
  228 |   })
  229 |   await page.getByRole('button', { name: /自助回货/ }).click()
  230 |   await expect(page).toHaveURL(/\/fcs\/pda\/handover\?tab=pickup/)
  231 | 
  232 |   await setSession(page, 'ROLE_ADMIN')
  233 |   await page.goto('/fcs/pda/handover?tab=pickup')
  234 |   await page.getByRole('button', { name: /自助回货/ }).click()
  235 |   await expect(page).toHaveURL(/\/fcs\/pda\/handover\/sewing-self-return/)
> 236 |   await expect(page.getByRole('heading', { name: '成衣回货登记模式' })).toBeVisible()
      |                                                                 ^ Error: expect(locator).toBeVisible() failed
  237 |   await expect.poll(() => page.evaluate(() => Boolean(window.localStorage.getItem('higoods-pda-sewing-self-return-mode')))).toBe(true)
  238 | 
  239 |   await page.getByRole('button', { name: '管理员退出' }).click()
  240 |   await expect(page).toHaveURL(/\/fcs\/pda\/handover\?tab=pickup/)
  241 |   await expect.poll(() => page.evaluate(() => window.localStorage.getItem('higoods-pda-sewing-self-return-mode'))).toBeNull()
  242 |   await expect(page.getByTestId('pda-pickup-entry-grid')).toBeVisible()
  243 | })
  244 | 
```