import { expect, test, type Page } from '@playwright/test'

test.use({ actionTimeout: 12_000 })

// Only isolated source-data preparation uses imports. Every tested mutation below uses the visible UI.
// This suite provides functional evidence; the independent performance suite owns five-sample timings.
const workAction = (name: string, id?: string) => `[data-wool-work-orders-action="${name}"]${id ? `[data-wool-order-id="${id}"]` : ''}`
async function open(page: Page, stage = 'knitting') {
  await page.goto(`/fcs/craft/wool/${stage}-orders`)
  await expect(page.locator('[data-wool-work-orders-root]')).toBeVisible()
}
async function facts(page: Page) {
  return page.evaluate(async () => (await import('/src/data/fcs/wool-domain/store.ts')).readWoolStore())
}
async function session(page: Page, factoryId = 'OWN_WOOL_FACTORY') {
  await page.evaluate(async (id) => {
    const { setPdaSession, listFactoryPdaUsers, createPdaSessionFromUser } = await import('/src/data/fcs/store-domain-pda.ts')
    const users = listFactoryPdaUsers(id)
    const user = users.find((row: any) => row.roleId === 'ROLE_MANAGER') || users[0]
    if (!user) throw Error(`Missing acceptance user for ${id}`)
    setPdaSession(createPdaSessionFromUser(user))
  }, factoryId)
}
async function handover(page: Page, id: string, qty: number, remark?: string) {
  await page.locator(workAction('open-handover', id)).click()
  await page.locator('[data-wool-dialog-field="qty"]').fill(String(qty))
  if (remark) await page.locator('[data-wool-dialog-field="factRemark"]').fill(remark)
  await page.locator(workAction('save-handover')).click()
  await expect(page.locator('[data-wool-business-dialog]')).toHaveCount(0)
}

for (const viewport of [{ width: 360, height: 800 }, { width: 400, height: 806 }]) {
  test(`A04 A10 PDA ${viewport.width} 多 SKU 选择不借用另一尺码的可填量`, async ({ page }, info) => {
    await page.setViewportSize(viewport)
    await open(page)
    // Existing mixed demo has M external pieces and L no external pieces; only prepare an unprocessed source.
    await page.evaluate(async () => {
      const { readWoolStore, replaceWoolStore } = await import('/src/data/fcs/wool-domain/store.ts')
      const s = readWoolStore()
      for (const id of ['WOOL-STAGE-010:KNITTING', 'WOOL-STAGE-010:LINKING']) {
        const order = s.workOrders[id]
        order.outputPlanLines.push({ ...order.outputPlanLines[0], outputSkuCode: 'CARDIGAN-CREAM-L', garmentSkuCode: 'CARDIGAN-CREAM-L', sizeCode: 'L' })
      }
      s.completions = s.completions.filter((row: any) => row.woolOrderId !== 'WOOL-STAGE-010:KNITTING')
      replaceWoolStore(s)
    })
    await session(page)
    await page.goto('/fcs/pda/exec/TASK-WOOL-STAGE-010%3AKNITTING')
    await page.locator('[data-wool-fact-action="REPORT_PROCESS"]').click()
    await page.locator('[data-draft-field="outputSkuCode"]').selectOption('CARDIGAN-CREAM-L')
    await page.locator('[data-draft-field="qty"]').fill('10')
    await page.locator('[data-pda-wool-action="save-fact"]').click()
    await expect(page.locator('[data-pda-wool-action="save-fact"]')).toHaveCount(0)
    await page.goto('/fcs/pda/exec/TASK-WOOL-STAGE-010%3ALINKING')
    await page.locator('[data-wool-fact-action="REPORT_PROCESS"]').click()
    await expect(page.locator('[data-draft-field="outputSkuCode"] option')).toHaveCount(1)
    await expect(page.locator('[data-draft-field="outputSkuCode"]')).toHaveValue('CARDIGAN-CREAM-M')
    await page.locator('[data-draft-field="qty"]').fill('50')
    await page.locator('[data-pda-wool-action="save-fact"]').click()
    await expect(page.locator('[data-pda-wool-action="save-fact"]')).toHaveCount(0)
    await page.locator('[data-wool-fact-action="REPORT_PROCESS"]').click()
    const before = await facts(page)
    await page.locator('[data-draft-field="qty"]').fill('31')
    await page.locator('[data-pda-wool-action="save-fact"]').click()
    await expect(page.locator('[data-pda-wool-root]')).toContainText(/上限|最多|超过|可用/)
    expect(await facts(page)).toEqual(before)
    await page.screenshot({ path: info.outputPath('sku-capacity-refusal.png'), fullPage: true })
    await page.reload()
    const totals = await page.evaluate(async () => {
      const { readWoolStore } = await import('/src/data/fcs/wool-domain/store.ts')
      const { stageReportedQty } = await import('/src/data/fcs/wool-domain/stage-rules.ts')
      const s = readWoolStore()
      return ['CARDIGAN-CREAM-M', 'CARDIGAN-CREAM-L'].map(sku => stageReportedQty(s, 'WOOL-STAGE-010:LINKING', sku))
    })
    expect(totals).toEqual([50, 10])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

test('A09 路线环、后继歧义、缺工厂的页面保留明确阻断且不伪造自动衔接', async ({ page }, info) => {
  test.setTimeout(120_000)
  for (const issue of ['Q1：该片工艺路线成环，不能确定先后顺序', 'Q1：同一片存在多个后继节点，无法确定下一站', 'Q1：首工艺尚未分配加工厂']) {
    await open(page)
    // Prepared invalid technical source, not a simulated successful business action.
    await page.evaluate(async (issue) => {
      const { readWoolStore, replaceWoolStore } = await import('/src/data/fcs/wool-domain/store.ts')
      const s = readWoolStore()
      for (const id of ['WOOL-STAGE-008:KNITTING', 'WOOL-STAGE-008:LINKING']) {
        s.workOrders[id].externalPieces.forEach((piece: any) => { piece.issues = [issue] })
      }
      replaceWoolStore(s)
    }, issue)
    const blockedBefore = await facts(page)
    await page.goto('/fcs/craft/wool/knitting-orders/WOOL-STAGE-008%3AKNITTING')
    await page.locator('[data-wool-detail-action="switch-tab"][data-tab="routes"]').click()
    await expect(page.locator('[data-wool-detail-root]')).toContainText(issue)
    await session(page)
    await page.goto('/fcs/pda/handover?tab=handout&taskId=TASK-WOOL-STAGE-008%3AKNITTING')
    await expect(page.locator('[data-pda-wool-root]')).toBeVisible()
    await expect(page.locator('[data-wool-fact-action="HANDOVER"]')).toHaveCount(0)
    const s = await facts(page)
    expect(s.handovers).toEqual(blockedBefore.handovers)
    expect(s.processReports.some((r: any) => r.woolOrderId === 'WOOL-STAGE-008:LINKING')).toBe(false)
  }
  await page.screenshot({ path: info.outputPath('blocked-route.png'), fullPage: true })
})

test('A06 工艺片第二厂真实接收加工交出后，缝盘才登记末工艺回货', async ({ page }) => {
  test.setTimeout(120_000)
  await open(page)
  const steps = await page.evaluate(async () => {
    const { listWoolCraftTaskOrders } = await import('/src/data/fcs/wool-domain/craft-flow.ts')
    const { buildSpecialCraftTaskDetailPath } = await import('/src/data/fcs/special-craft-operations.ts')
    const tasks = listWoolCraftTaskOrders().filter((row: any) => row.woolOrderId === 'WOOL-STAGE-009:KNITTING')
    const first = tasks.find((row: any) => row.receivedQty > 0 && row.completedQty === 0)!
    const second = tasks.find((row: any) => row.woolPieceKey === first.woolPieceKey && row.taskOrderId !== first.taskOrderId)!
    return [first, second].map((row: any) => ({ id: row.taskOrderId, piece: row.woolPieceKey, path: buildSpecialCraftTaskDetailPath(row, row.taskOrderId) }))
  })
  for (const [index, step] of steps.entries()) {
    await page.goto(step.path)
    if (index) {
      await expect(page.locator('[data-wool-craft-detail]')).toContainText('实际接收0 片')
      await page.locator('[data-action-code="SPECIAL_CRAFT_CONFIRM_RECEIVE"]').click()
      await page.locator('[data-wool-receiving-action="receive"]').first().click()
      await page.locator('[data-wool-receiving-field="pieceQty"]').fill('5')
      await page.locator('[data-wool-receiving-action="review"]').click()
      await page.locator('[data-wool-receiving-action="save"]').click()
      await expect(page.locator('[data-wool-receiving-feedback]')).toContainText('已保存')
      await page.goto(step.path)
    }
    for (const code of ['SPECIAL_CRAFT_PROCESS_REPORT', 'SPECIAL_CRAFT_SUBMIT_HANDOVER']) {
      await page.locator(`[data-action-code="${code}"]`).click()
      await page.getByRole('spinbutton', { name: '本次数量（片）' }).fill('5')
      await page.locator('[data-wool-craft-save]').click()
      await expect(page.locator('#wool-craft-dialog')).toHaveCount(0)
    }
  }
  await page.goto('/fcs/craft/wool/pending-receipts?workOrderId=WOOL-STAGE-009%3ALINKING')
  await page.locator('[data-wool-receiving-action="receive"]').first().click()
  await page.locator('[data-wool-receiving-field="pieceQty"]').fill('5')
  await page.locator('[data-wool-receiving-action="review"]').click()
  await page.locator('[data-wool-receiving-action="save"]').click()
  await expect(page.locator('[data-wool-receiving-feedback]')).toContainText('已保存')
  await page.reload()
  const received = (await facts(page)).pieceReceipts.filter((row: any) => row.woolOrderId === 'WOOL-STAGE-009:LINKING' && row.pieceKey === steps[0].piece)
  expect(received.reduce((sum: number, row: any) => sum + row.qty, 0)).toBe(5)
})

test('A07 同名工艺三节点页面分别保留工序身份与下一站', async ({ page }, info) => {
  await open(page)
  const steps = await page.evaluate(async () => {
    const { listWoolCraftTaskOrders } = await import('/src/data/fcs/wool-domain/craft-flow.ts')
    const { buildSpecialCraftTaskDetailPath } = await import('/src/data/fcs/special-craft-operations.ts')
    return listWoolCraftTaskOrders().filter((row: any) => row.woolOrderId === 'WOOL-STAGE-013:KNITTING' && row.woolPieceKey.includes(':Q1:')).map((row: any) => ({ id: row.taskOrderId, path: buildSpecialCraftTaskDetailPath(row, row.taskOrderId) }))
  })
  expect(steps).toHaveLength(3)
  expect(new Set(steps.map(row => row.id)).size).toBe(3)
  for (const [index, step] of steps.entries()) {
    await page.goto(step.path)
    await expect(page.locator('[data-wool-craft-detail]')).toHaveAttribute('data-wool-craft-detail', step.id)
    await expect(page.locator('[data-wool-craft-detail]')).toContainText(`路线第 ${index + 1} 步 / 3 步`)
    await expect(page.locator('[data-wool-craft-detail]')).toContainText('Q / 第1片')
    await page.screenshot({ path: info.outputPath(`repeated-craft-${index + 1}.png`), fullPage: true })
  }
})

test('A19 1024x768 主管毛织页面查询、详情各区及填报可操作', async ({ page }, info) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1024, height: 768 })
  for (const stage of ['knitting', 'linking']) {
    await open(page, stage)
    await page.locator('[data-wool-work-orders-field="keyword"]').fill('不存在的验收单')
    await page.locator(workAction('query')).click()
    await expect(page.locator('[data-wool-work-orders-table-surface]')).toContainText(/暂无|没有/)
    await page.locator(workAction('reset-filters')).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.goto(`/fcs/craft/wool/${stage}-orders/WOOL-STAGE-010%3A${stage === 'knitting' ? 'KNITTING' : 'LINKING'}`)
    const tabs = await page.locator('[data-wool-detail-action="switch-tab"]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-tab')!))
    for (const tab of tabs) {
      await page.locator(`[data-wool-detail-action="switch-tab"][data-tab="${tab}"]`).click()
      await expect(page.locator('[data-wool-detail-root]')).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
  }
  await open(page)
  await page.locator(workAction('open-report', 'WOOL-STAGE-002:KNITTING')).click()
  await page.locator('[data-wool-dialog-field="qty"]').fill('3')
  await page.locator(workAction('save-report')).click()
  await expect(page.locator('[data-wool-business-dialog]')).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('supervisor-1024.png'), fullPage: true })
})

test('A18 旧单据路径不可恢复旧毛织模型', async ({ page }) => {
  test.setTimeout(120_000)
  for (const tail of ['work-orders', 'work-orders/WOOL-001', 'work-orders/WOOL-001/handover-print', 'tasks', 'orders']) {
    await page.goto(`/fcs/craft/wool/${tail}`)
    await expect(page.locator('[data-wool-work-orders-root],[data-wool-detail-root],[data-wool-handover-print-root]')).toHaveCount(0)
    await expect(page.locator('body')).toContainText(/404|未找到|不存在/)
  }
})

test('A19 多批交出打印实际 A4 分页、完整备注、图片及 QR 就绪', async ({ page }, info) => {
  test.setTimeout(120_000)
  await open(page, 'linking')
  const note = '需核对本批颜色尺码和数量。'.repeat(20)
  for (let index = 0; index < 4; index++) await handover(page, 'WOOL-STAGE-004:LINKING', 5, `批次${index + 1}：${note}`)
  await page.goto('/fcs/craft/wool/linking-orders/WOOL-STAGE-004%3ALINKING/handover-print')
  await expect(page.locator('[data-wool-handover-print-page]')).toHaveCount(4)
  await expect(page.locator('[data-wool-print-button]')).toBeEnabled()
  await expect(page.locator('[data-real-qr] svg')).toHaveCount(4)
  for (let index = 0; index < 4; index++) await expect(page.locator('[data-wool-handover-print-page]').filter({ hasText: `批次${index + 1}：${note}` })).toHaveCount(1)
  await page.emulateMedia({ media: 'print' })
  const pdf = await page.pdf({ path: info.outputPath('four-batch-a4.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true })
  expect((pdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length).toBe(4)
})

test('A17 部位缝盘交出经指定裁厂 PDA 实收后才进入裁厂待装袋来源', async ({ page }, info) => {
  test.setTimeout(120_000)
  await open(page, 'linking')
  await handover(page, 'WOOL-STAGE-004:LINKING', 8)
  const head = await page.evaluate(async () => {
    const { listPdaHandoverHeads } = await import('/src/data/fcs/pda-handover-events.ts')
    const { readWoolStore } = await import('/src/data/fcs/wool-domain/store.ts')
    const record = readWoolStore().handovers.find((row: any) => row.woolOrderId === 'WOOL-STAGE-004:LINKING' && !row.automatic)!
    return { id: listPdaHandoverHeads().find((row: any) => row.sourceDocId === record.handoverId)!.handoverId, source: record.handoverId }
  })
  await page.goto('/fcs/craft/cutting/warehouse-management/wait-handover')
  await page.locator('[data-wait-handover-action="open-bagging"]').click()
  await expect(page.locator('[data-wait-handover-field="feiTicketId"]')).not.toContainText(head.source)
  await session(page, 'ID-F004')
  await page.goto(`/fcs/pda/handover/${encodeURIComponent(head.id)}`)
  await page.locator('[data-pda-handoverd-action="open-receiver-writeback"]').click()
  await page.locator('[data-pda-handoverd-field="writebackQty"]').fill('8')
  await page.locator('[data-pda-handoverd-action="submit-receiver-writeback"]').click()
  await expect(page.locator('[data-pda-handoverd-field="writebackQty"]')).toHaveCount(0)
  await page.reload()
  await expect(page.locator('body')).toContainText('接收方实收裁片片数（片）8 件')
  expect((await facts(page)).handovers.find((row: any) => row.handoverId === head.source)?.downstreamReceipt?.actualReceivedQty).toBe(8)
  await page.goto('/fcs/craft/cutting/warehouse-management/wait-handover')
  await page.locator('[data-wait-handover-action="open-bagging"]').click()
  await expect(page.locator('[data-wait-handover-field="feiTicketId"]')).toContainText(head.source)
  await page.screenshot({ path: info.outputPath('cutting-received-wool-source.png'), fullPage: true })
})

test('A17 整件缝盘实际交出只在指定后道生产任务呈现，横机不成为后道来源', async ({ page }, info) => {
  test.setTimeout(120_000)
  await open(page, 'linking')
  await handover(page, 'WOOL-STAGE-003:LINKING', 8)
  await page.goto('/fcs/craft/post-finishing/tasks?keyword=PO-MZ-003')
  await expect(page.locator('tbody')).toContainText('PO-MZ-003')
  await expect(page.locator('tbody')).toContainText('整件毛织')
  await expect(page.locator('tbody')).toContainText('HiGood 后道工厂')
  await expect(page.locator('tbody')).not.toContainText('HJ260918-003')
  await page.screenshot({ path: info.outputPath('post-finishing-wool-source.png'), fullPage: true })
  // Change only another isolated source's dispatch target, then perform its actual final handover in UI.
  await open(page, 'linking')
  await page.evaluate(async () => {
    const { readWoolStore, replaceWoolStore } = await import('/src/data/fcs/wool-domain/store.ts')
    const s = readWoolStore()
    s.workOrders['WOOL-STAGE-003:LINKING'].downstreamTarget = { receiverType: 'DOWNSTREAM_FACTORY', receiverId: 'FAC-APF', receiverName: 'APF - 辅助工艺' }
    replaceWoolStore(s)
  })
  await page.reload()
  await handover(page, 'WOOL-STAGE-003:LINKING', 2)
  const wrong = (await facts(page)).handovers.find((row: any) => row.woolOrderId === 'WOOL-STAGE-003:LINKING' && row.receiverId === 'FAC-APF')!
  await page.goto('/fcs/craft/post-finishing/tasks?keyword=PO-MZ-003')
  await expect(page.locator('tbody')).not.toContainText(wrong.handoverId)
})

test('A11 存储失败显示未保存，原输入保留；恢复后重试只产生一组自动衔接', async ({ page }) => {
  await open(page)
  await page.locator(workAction('open-report', 'WOOL-STAGE-002:KNITTING')).click()
  await page.locator('[data-wool-dialog-field="qty"]').fill('7')
  const before = await facts(page)
  await page.evaluate(() => {
    const previous = Storage.prototype.setItem
    ;(window as any).__restoreWoolSave = () => { Storage.prototype.setItem = previous }
    Storage.prototype.setItem = function (key, value) {
      if (key === 'higood-fcs-wool-stage-store-v3') throw new Error('验收：存储暂不可用，本次未保存')
      return previous.call(this, key, value)
    }
  })
  await page.locator(workAction('save-report')).click()
  await expect(page.locator('[data-wool-overlay-error]')).toContainText('未保存')
  await expect(page.locator('[data-wool-dialog-field="qty"]')).toHaveValue('7')
  expect(await facts(page)).toEqual(before)
  await page.evaluate(() => (window as any).__restoreWoolSave())
  await page.locator(workAction('save-report')).click()
  await expect(page.locator('[data-wool-business-dialog]')).toHaveCount(0)
  await page.reload()
  const after = await facts(page)
  expect(after.processReports.filter((row: any) => row.woolOrderId.startsWith('WOOL-STAGE-002:')).map((row: any) => row.reportedQty)).toEqual([7, 7])
  expect(after.handovers.filter((row: any) => row.woolOrderId === 'WOOL-STAGE-002:KNITTING').map((row: any) => row.handoverQty)).toEqual([7])
  expect(after.internalReceipts.filter((row: any) => row.woolOrderId === 'WOOL-STAGE-002:LINKING').map((row: any) => row.qty)).toEqual([7])
})

test('A15 PCS 真实启用新版后正式生产单绑定版本及既有毛织片路线数量保持原快照', async ({ page }, info) => {
  test.setTimeout(120_000)
  await open(page)
  const scene = await page.evaluate(async () => {
    const versions = await import('/src/data/pcs-technical-data-version-repository.ts')
    const masters = await import('/src/data/pcs-engineering-master-repository.ts')
    const styles = await import('/src/data/pcs-style-archive-repository.ts')
    const { ensureEngineeringMasterDemoData } = await import('/src/data/pcs-engineering-master-view-model.ts')
    const { productionOrders, persistCreatedProductionOrders } = await import('/src/data/fcs/production-orders.ts')
    const { buildProductionOrderTechPackSnapshot } = await import('/src/data/fcs/production-tech-pack-snapshot-builder.ts')
    const { extractWoolPieceSources } = await import('/src/data/fcs/wool-domain/piece-source.ts')
    const { readWoolStore, replaceWoolStore } = await import('/src/data/fcs/wool-domain/store.ts')
    ensureEngineeringMasterDemoData()
    const base = versions.listTechnicalDataVersions().find((r: any) => r.versionStatus === 'PUBLISHED' && masters.getEngineeringMasterOrderById(r.sourceProjectId))!
    if (!base) throw Error('需要具备有效生产准备单来源的已发布技术包')
    const content = versions.getTechnicalDataVersionContent(base.technicalVersionId)!
    delete content.bomPricingSnapshot
    const oldId = 'TDV-WOOL-ACCEPTANCE-A15-V1', newId = 'TDV-WOOL-ACCEPTANCE-A15-V2'
    const store = readWoolStore(), template = store.workOrders['WOOL-STAGE-007:KNITTING'], line = template.outputPlanLines[0]
    const sku = line.outputSkuCode, packageId = 'PATTERN-WOOL-A15'
    const pattern: any = { ...content.patternFiles[0], id: packageId, sourcePatternPackageId: packageId,
      fileName: 'A15-wool.rar', fileUrl: '/A15-wool.rar', patternMaterialType: 'WOOL', patternFileMode: 'SINGLE_FILE',
      parseStatus: 'PARSED', uploadedAt: '2026-09-18', uploadedBy: '隔离验收资料',
      pieceRows: [{ id: 'A15-Q', name: 'A15旧版Q', count: 1, applicableSkuCodes: [sku], specialCrafts: [{processCode:'SPECIAL_CRAFT',craftCode:'EMB',craftName:'绣花'}] }],
      pieceInstances: [{ pieceInstanceId:'A15-Q1', sourcePieceId:'A15-Q', pieceName:'A15旧版Q', sizeName:'M', colorId:'奶油色', colorName:'奶油色', sequenceNo:1, displayName:'A15旧版Q 第1片',status:'已配置',specialCraftAssignments:[{assignmentId:'A15-ASSIGN',craftCode:'EMB',craftName:'绣花',craftCategory:'SPECIAL',targetObject:'CUT_PIECE_PART',craftPosition:'FACE',craftPositionName:'面',remark:'旧版定位要求'}] }],
    }
    const entry: any = { id:'A15-EMB',craftCode:'EMB',craftName:'绣花',predecessorEntryIds:[],entryType:'CRAFT',stageCode:'PROD',stageName:'生产',processCode:'SPECIAL_CRAFT',processName:'工艺',assignmentGranularity:'DETAIL',defaultDocType:'TASK',taskTypeMode:'CRAFT',isSpecialCraft:true,routeSourceKind:'PIECE_CRAFT',routeObjectKey:`PATTERN:${packageId}:PIECE:A15-Q`,targetObject:'CUT_PIECE_PART',inputObjectType:'KNITTED_PANEL',outputObjectType:'KNITTED_PANEL',linkedPatternIds:[packageId] }
    const oldContent: any = { ...content, technicalVersionId:oldId,patternFiles:[pattern],processEntries:[entry],processRouteStatus:'CONFIRMED',
      bomItems:content.bomItems.map((b: any)=>({...b, usageProcessCodes:['PROC_WOOL'],applicableSkuCodes:[sku],linkedPatternIds:[packageId]})),
      colorMaterialMappings:[{id:'A15-MAP',mappingOrigin:'TECH_PACK',status:'CONFIRMED',colorCode:'奶油色',colorName:'奶油色',lines:content.bomItems.map((b: any)=>({id:`A15-MAP-${b.id}`,bomItemId:b.id,patternId:packageId,materialCode:b.materialCode,applicableSkuCodes:[sku]}))}],
    }
    const newContent = structuredClone(oldContent)
    newContent.technicalVersionId = newId
    newContent.patternFiles[0].pieceInstances[0].pieceName = 'A15新版改名片'
    newContent.patternFiles[0].pieceInstances[0].displayName = 'A15新版改名片 第1片'
    newContent.patternFiles[0].pieceInstances[0].specialCraftAssignments[0].remark = '新版定位要求'
    newContent.processEntries.push({...entry,id:'A15-EMB-SECOND',predecessorEntryIds:['A15-EMB']})
    for (const [id, code, number, data] of [[oldId,'A15-v1.0',1,oldContent],[newId,'A15-v2.0',2,newContent]] as const) {
      versions.createTechnicalDataVersionDraft({...base,technicalVersionId:id,technicalVersionCode:code,versionLabel:code,versionNo:number},data)
    }
    // Fixture describes a published successor awaiting final confirmation. Dependencies are retained;
    // the real activation button must still pass source identity, costs and fixed prerequisite checks.
    masters.updateEngineeringTaskRecord(base.sourceProjectId,base.createdFromTaskId,(task: any)=>{task.status='进行中'})
    styles.updateStyleArchive(base.styleId,{currentTechPackVersionId:oldId,currentTechPackVersionCode:'A15-v1.0',currentTechPackVersionLabel:'A15-v1.0'})
    const production = structuredClone(productionOrders.find((p: any)=>p.techPackSnapshot)!)
    production.productionOrderId = production.productionOrderNo = 'PO-WOOL-ACCEPTANCE-A15'
    production.demandId = 'DEMAND-WOOL-ACCEPTANCE-A15'
    production.demandSnapshot = {...production.demandSnapshot,demandId:production.demandId,spuCode:base.styleCode,spuName:base.styleName,skuLines:[{skuCode:sku,color:'奶油色',size:'M',qty:100}]}
    production.selectedTechPackVersionId = oldId
    production.techPackSnapshot = buildProductionOrderTechPackSnapshot({productionOrderId:production.productionOrderId,productionOrderNo:production.productionOrderNo,demand:production.demandSnapshot,technicalVersionId:oldId,snapshotAt:'2026-09-18 09:00:00',snapshotBy:'隔离验收'})
    production.taskBreakdownSummary.isBrokenDown = false
    productionOrders.push(production); persistCreatedProductionOrders([production.productionOrderId])
    const extracted = extractWoolPieceSources({snapshot:production.techPackSnapshot,sourceTaskId:'TASK-A15',scopeSkuLines:[{skuCode:sku,color:'奶油色',size:'M',qty:100}]})
    if (extracted.issues.length || extracted.pieces.length !== 1) throw Error(`冻结毛织来源无效 ${JSON.stringify(extracted)}`)
    const pairId='WOOL-A15', ids=[`${pairId}:KNITTING`,`${pairId}:LINKING`]
    for (const [index, stage] of ['KNITTING','LINKING'].entries()) store.workOrders[ids[index]]={...structuredClone(template),demoSource:undefined,stage,pairId,woolOrderId:ids[index],woolOrderNo:index?'FP-A15':'HJ-A15',pairedWorkOrderId:ids[1-index],taskId:`TASK-A15:${stage}`,sourceTaskId:'TASK-A15',taskNo:'TASK-A15',productionOrderId:production.productionOrderId,productionOrderNo:production.productionOrderNo,styleNo:base.styleCode,styleName:base.styleName,sourceTechPackVersionId:oldId,sourceTechPackVersionCode:'A15-v1.0',outputPlanLines:[{...line,sourceTechPackVersionId:oldId,sourceTechPackVersionCode:'A15-v1.0',sourceColorMappingIds:['A15-MAP'],sourceBomItemIds:content.bomItems.map((b:any)=>b.id)}],externalPieces:extracted.pieces.map((p:any)=>({pieceKey:p.pieceKey,patternPackageId:p.patternPackageId,pieceInstanceId:p.pieceInstanceId,pieceName:p.displayName,skuCode:p.skuCode,pieceCountPerGarment:p.pieceCountPerGarment,issues:[],routeNodes:p.routeNodes.map((n:any)=>({...n,factoryId:template.externalPieces[0].routeNodes[0].factoryId,factoryName:template.externalPieces[0].routeNodes[0].factoryName,taskOrderId:`WSC-A15-${n.sourceEntryId}`}))}))}
    replaceWoolStore(store)
    return {styleId:base.styleId,oldId,newId,productionId:production.productionOrderId,ids,oldSnapshot:production.techPackSnapshot,oldOrders:ids.map(id=>store.workOrders[id])}
  })
  await page.goto(`/pcs/products/styles/${scene.styleId}`)
  // Compare the normal persisted read path on both sides, including its schema normalization.
  const baseline = await page.evaluate(async(s)=>{const store=(await import('/src/data/fcs/wool-domain/store.ts')).readWoolStore();return {snapshot:(await import('/src/data/fcs/production-order-tech-pack-runtime.ts')).getProductionOrderTechPackSnapshot(s.productionId),orders:s.ids.map(id=>store.workOrders[id])}},scene)
  await page.locator('[data-pcs-product-archive-action="set-style-detail-tab"][data-value="versions"]').click()
  await expect(page.locator(`[data-pcs-product-archive-action="activate-tech-pack-version"][data-version-id="${scene.newId}"]`)).toBeVisible()
  await page.locator(`[data-pcs-product-archive-action="activate-tech-pack-version"][data-version-id="${scene.newId}"]`).click()
  await expect(page.getByText('已启用当前生效技术包版本。')).toBeVisible()
  await page.screenshot({path:info.outputPath('pcs-new-version-activated.png'),fullPage:true})
  await page.reload()
  expect(await page.evaluate(async(id)=>(await import('/src/data/pcs-style-archive-repository.ts')).getStyleArchiveById(id)?.currentTechPackVersionId,scene.styleId)).toBe(scene.newId)
  for (const [index, stage] of ['knitting','linking'].entries()) {
    await page.goto(`/fcs/craft/wool/${stage}-orders/${encodeURIComponent(scene.ids[index])}`)
    await expect(page.locator('[data-wool-detail-root]')).toContainText('A15-v1.0')
    await page.locator('[data-wool-detail-action="switch-tab"][data-tab="routes"]').click()
    await expect(page.locator('[data-wool-detail-root]')).toContainText('A15旧版Q')
    await expect(page.locator('[data-wool-detail-root]')).not.toContainText('A15新版改名片')
  }
  const after=await page.evaluate(async(s)=>({snapshot:(await import('/src/data/fcs/production-order-tech-pack-runtime.ts')).getProductionOrderTechPackSnapshot(s.productionId)}),scene)
  expect(after.snapshot).toEqual(baseline.snapshot)
  const current=await facts(page)
  expect(scene.ids.map(id=>current.workOrders[id])).toEqual(baseline.orders)
  await page.screenshot({path:info.outputPath('old-bound-wool-after-current-version-change.png'),fullPage:true})
})
