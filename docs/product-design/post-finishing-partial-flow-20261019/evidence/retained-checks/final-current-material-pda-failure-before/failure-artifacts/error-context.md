# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: post-finishing-pda-role-boundary.spec.ts >> 后道辅料在交接待接收中按完整单号整单入库并同步 Web 待加工仓
- Location: tests/post-finishing-pda-role-boundary.spec.ts:106:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: '确认辅料入库' })
Expected: visible
Timeout: 30000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 30000ms
  - waiting for getByRole('heading', { name: '确认辅料入库' })

```

```yaml
- text: 页面内容加载失败，请稍后重试。
```

# Test source

```ts
  32  | test('后道工厂执行页只保留后道加工和后道复检', async ({ page }) => {
  33  |   await setSession(page, 'ROLE_OPERATOR')
  34  |   for (const viewport of [{ width: 390, height: 844 }, { width: 480, height: 800 }]) {
  35  |     await page.setViewportSize(viewport)
  36  |     await page.goto('/fcs/pda/exec')
  37  |     await expect(page.getByRole('heading', { name: '后道现场执行' })).toBeVisible()
  38  |     await expect(page.getByRole('button', { name: '后道加工' })).toBeVisible()
  39  |     await expect(page.getByRole('button', { name: '后道复检' })).toBeVisible()
  40  |     await expect(page.locator('[data-pda-general-task-list]')).toHaveCount(0)
  41  |     await expect(page.locator('[data-testid="pda-exec-tabs"]')).toHaveCount(0)
  42  |     await expect(page.locator('[data-pda-exec-field="searchKeyword"]')).toHaveCount(0)
  43  |     await expect(page.locator('body')).not.toContainText('其他执行任务')
  44  |     await expect(page.locator('body')).not.toContainText('TASK-DYE-')
  45  |     await expectNoHorizontalOverflow(page)
  46  |   }
  47  | })
  48  | 
  49  | test('后道回货入口归入交接待接收，仓管不再承担回货或成衣仓收货', async ({ page }) => {
  50  |   await setSession(page, 'ROLE_OPERATOR')
  51  |   await page.setViewportSize({ width: 390, height: 844 })
  52  |   await page.goto('/fcs/pda/warehouse')
  53  |   await expect(page.locator('body')).not.toContainText('后道回货与出货')
  54  |   await expect(page.locator('body')).not.toContainText('扫描送货单点数确认')
  55  |   await expect(page.locator('body')).not.toContainText('扫描后道出货单收货')
  56  | 
  57  |   for (const viewport of [{ width: 390, height: 844 }, { width: 400, height: 786 }, { width: 480, height: 800 }]) {
  58  |     await page.setViewportSize(viewport)
  59  |     await page.goto('/fcs/pda/handover?tab=pickup')
  60  |     await expect(page.getByRole('button', { name: /待接收/ })).toBeVisible()
  61  |     await expect(page.getByRole('button', { name: /已交出/ })).toBeVisible()
  62  |     await expect(page.getByRole('button', { name: /待交出/ })).toHaveCount(0)
  63  |     const entryGrid = page.getByTestId('pda-pickup-entry-grid')
  64  |     await expect(entryGrid.locator('[data-pda-pickup-entry]')).toHaveCount(3)
  65  |     await expect(page.getByRole('button', { name: /回货接收/ })).toBeVisible()
  66  |     await expect(page.getByRole('button', { name: /自助回货/ })).toBeVisible()
  67  |     await expect(page.getByRole('button', { name: /辅料接收/ })).toBeVisible()
  68  |     const entryBoxes = await entryGrid.locator('[data-pda-pickup-entry]').evaluateAll((nodes) => nodes.map((node) => {
  69  |       const box = node.getBoundingClientRect()
  70  |       return { top: box.top, height: box.height }
  71  |     }))
  72  |     expect(new Set(entryBoxes.map((box) => Math.round(box.top))).size).toBe(1)
  73  |     expect(entryBoxes.every((box) => box.height <= 70)).toBe(true)
  74  |     const firstListCardTop = await page.locator('[data-pda-material-transfer-card]').first().evaluate((node) => node.getBoundingClientRect().top)
  75  |     expect(firstListCardTop).toBeLessThan(320)
  76  |     await expectNoHorizontalOverflow(page)
  77  |   }
  78  |   await page.setViewportSize({ width: 390, height: 844 })
  79  |   await page.goto('/fcs/pda/handover?tab=pickup')
  80  |   await page.getByRole('button', { name: /回货接收/ }).click()
  81  |   await expect(page).toHaveURL(/\/fcs\/pda\/post-finishing\/return-confirm/)
  82  |   await expect(page.getByRole('heading', { name: '扫描后道送货单号' })).toBeVisible()
  83  | 
  84  |   await page.goto('/fcs/pda/post-finishing/outbound-receive')
  85  |   await expect(page.getByRole('heading', { name: '扫描后道出货单条码' })).toHaveCount(0)
  86  | })
  87  | 
  88  | test('后道专用回货确认展示当前与已确认批次 SKU 明细', async ({ page }) => {
  89  |   await setSession(page, 'ROLE_OPERATOR')
  90  |   await page.setViewportSize({ width: 390, height: 844 })
  91  |   const deliveryNos = await page.evaluate(async () => {
  92  |     const flow = await import('/src/data/fcs/post-finishing-full-flow.ts')
  93  |     const rows = flow.listPostFinishingFactoryReturns()
  94  |     return [rows.find((row) => !row.confirmedAt)!, rows.find((row) => row.confirmedAt)!].map((row) => row.deliveryOrderNo)
  95  |   })
  96  |   for (const no of deliveryNos) {
  97  |     await page.goto('/fcs/pda/post-finishing/return-confirm')
  98  |     await page.locator('[data-pda-post-field="returnScan"]').fill(no)
  99  |     await page.getByRole('button', { name: '查询' }).click()
  100 |     await expect(page.locator('[data-return-confirm-line]').first()).toBeVisible()
  101 |     await expect(page.locator('[data-return-confirm-line]').first().locator('img')).toHaveCount(1)
  102 |     await expectNoHorizontalOverflow(page)
  103 |   }
  104 | })
  105 | 
  106 | test('后道辅料在交接待接收中按完整单号整单入库并同步 Web 待加工仓', async ({ page }) => {
  107 |   await setSession(page, 'ROLE_OPERATOR')
  108 |   for (const viewport of [{ width: 390, height: 844 }, { width: 480, height: 800 }]) {
  109 |     await page.setViewportSize(viewport)
  110 |     await page.goto('/fcs/pda/handover?tab=pickup')
  111 |     await expect(page.getByRole('heading', { name: '后道辅料待入库' })).toBeVisible()
  112 |     await expect(page.locator('[data-pda-material-transfer-card]')).toHaveCount(5)
  113 |     await expect(page.locator('[data-pda-material-transfer-card="DB-PF-202608-001"]')).toBeVisible()
  114 |     await expect(page.locator('[data-pda-material-transfer-card="DB-PF-202608-005"]')).toBeVisible()
  115 |     await expect(page.locator('[data-pda-handover-field="materialTransferNo"]')).not.toBeVisible()
  116 |     await page.getByRole('button', { name: /辅料接收/ }).click()
  117 |     await expect(page.locator('[data-pda-handover-field="materialTransferNo"]')).toBeVisible()
  118 |     await expect(page.locator('body')).toContainText('只接受完整单号，不提供模糊候选')
  119 |     await expectNoHorizontalOverflow(page)
  120 |   }
  121 | 
  122 |   const input = page.locator('[data-pda-handover-field="materialTransferNo"]')
  123 |   await input.fill('DB-PF-202608')
  124 |   page.once('dialog', async (dialog) => {
  125 |     expect(dialog.message()).toContain('不提供模糊候选')
  126 |     await dialog.accept()
  127 |   })
  128 |   await page.getByRole('button', { name: '查询', exact: true }).click()
  129 |   await input.fill('DB-PF-202608-001')
  130 |   await page.getByRole('button', { name: '查询', exact: true }).click()
  131 |   await expect(page).toHaveURL(/materialOrderNo=DB-PF-202608-001/)
> 132 |   await expect(page.getByRole('heading', { name: '确认辅料入库' })).toBeVisible()
      |                                                               ^ Error: expect(locator).toBeVisible() failed
  133 |   await expect(page.getByRole('heading', { name: '物料明细' }).locator('xpath=../following-sibling::div')).toHaveCount(4)
  134 |   await expect(page.locator('[data-pda-image-preview-url]')).toHaveCount(4)
  135 |   await expect(page.locator('input[type="number"]')).toHaveCount(0)
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
  163 |   await page.evaluate(async () => {
  164 |     const flow = await import('/src/data/fcs/post-finishing-full-flow.ts')
  165 |     const records = await import('/src/data/fcs/post-finishing-records.ts')
  166 |     await records.ensurePostFinishingRecordState()
  167 |     await records.runPostFinishingCommand(() => flow.receivePostFinishingMaterialTransfer({
  168 |       transferOrderNo: 'DB-PF-202608-001', actor: { actorId: 'PF-USER-WH', actorName: '孙仓库收货员', roleName: '仓库收货人员' },
  169 |       nowMs: Date.UTC(2026, 8, 12, 8, 0, 0),
  170 |     }))
  171 |   })
  172 |   await page.reload()
  173 |   await expect(page.locator('[data-pda-material-transfer-card]')).toHaveCount(4)
  174 |   await expect(page.locator('[data-pda-material-transfer-card="DB-PF-202608-001"]')).toHaveCount(0)
  175 |   await expect(page.locator('[data-pda-material-transfer-card="DB-PF-202608-002"]')).toBeVisible()
  176 |   await expect(page.locator('[data-pda-material-transfer-card="DB-PF-202608-005"]')).toBeVisible()
  177 |   const migrated = await page.evaluate(async () => {
  178 |     const flow = await import('/src/data/fcs/post-finishing-full-flow.ts')
  179 |     const db = await import('/src/data/pcs-record-db.ts')
  180 |     const rows = (await db.readPcsRecords(['higood-fcs-post-finishing-records'])).records
  181 |     const saved = rows.filter(row => row.collection === 'flow/materialTransferOrders' && !row.deleted).map(row => row.value as any)
  182 |     if (saved.length !== 1 || saved[0].transferOrderNo !== 'DB-PF-202608-001' || saved[0].status !== '已入库') throw new Error('只保存本次修改的001覆盖，不应整批复制静态种子')
  183 |     return flow.listPostFinishingMaterialTransferOrders().map(item => ({ no: item.transferOrderNo, status: item.status }))
  184 |   })
  185 |   expect(migrated).toHaveLength(5)
  186 |   expect(migrated).toContainEqual({ no: 'DB-PF-202608-001', status: '已入库' })
  187 |   await expectNoHorizontalOverflow(page)
  188 | })
  189 | 
  190 | test('后道交接已交出直接展示 Web 后道出货单及 SKU 明细', async ({ page }) => {
  191 |   await setSession(page, 'ROLE_OPERATOR')
  192 |   for (const viewport of [{ width: 390, height: 844 }, { width: 480, height: 800 }]) {
  193 |     await page.setViewportSize(viewport)
  194 |     await page.goto('/fcs/pda/handover?tab=shipped')
  195 |     await expect(page.getByText('已交出记录', { exact: true })).toBeVisible()
  196 |     await expect(page.locator('[data-pda-post-outbound-card]').first()).toBeVisible()
  197 |     await expect(page.locator('body')).toContainText('后道出货单')
  198 |     await expect(page.getByRole('button', { name: /待交出/ })).toHaveCount(0)
  199 |     const card = page.locator('[data-pda-post-outbound-card]').first()
  200 |     await card.locator('summary').click()
  201 |     await expect(card.locator('[data-pda-post-outbound-line]').first()).toBeVisible()
  202 |     await expect(card.locator('[data-pda-post-outbound-line]').first()).toContainText(/SPU-QC-/)
  203 |     await expect(card.locator('[data-pda-post-outbound-line]').first().locator('[data-pda-image-preview-url]')).toHaveCount(1)
  204 |     await expectNoHorizontalOverflow(page)
  205 |   }
  206 | })
  207 | 
  208 | test('后道加工和后道复检操作页均可返回执行工作台', async ({ page }) => {
  209 |   await setSession(page, 'ROLE_OPERATOR')
  210 |   for (const route of ['/fcs/pda/post-finishing/execute', '/fcs/pda/post-finishing/recheck']) {
  211 |     await page.goto(route)
  212 |     const back = page.getByTestId('pda-post-back')
  213 |     await expect(back).toBeVisible()
  214 |     await expect(back).toHaveText(/返回/)
  215 |     await back.click()
  216 |     await expect(page).toHaveURL(/\/fcs\/pda\/exec$/)
  217 |   }
  218 | })
  219 | 
  220 | test('车缝自助回货由管理员开启，锁定与退出状态完整闭环', async ({ page }) => {
  221 |   await setSession(page, 'ROLE_OPERATOR')
  222 |   await page.goto('/fcs/pda/handover?tab=pickup')
  223 |   page.once('dialog', async (dialog) => {
  224 |     expect(dialog.message()).toContain('请由后道工厂管理员开启')
  225 |     await dialog.accept()
  226 |   })
  227 |   await page.getByRole('button', { name: /自助回货/ }).click()
  228 |   await expect(page).toHaveURL(/\/fcs\/pda\/handover\?tab=pickup/)
  229 | 
  230 |   await setSession(page, 'ROLE_ADMIN')
  231 |   await page.goto('/fcs/pda/handover?tab=pickup')
  232 |   await page.getByRole('button', { name: /自助回货/ }).click()
```