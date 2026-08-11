import { expect, test, type Page } from '@playwright/test'

import { listGeneratedFeiTickets } from '../src/data/fcs/cutting/generated-fei-tickets.ts'
import { CUTTING_MANUAL_FEI_TICKET_SOURCES_STORAGE_KEY } from '../src/data/fcs/cutting/storage/fei-tickets-storage.ts'
import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

const LIST_PATH = '/fcs/craft/cutting/fei-tickets'
const WHITE_MARKER_NO = 'MKP-20260403-008'

async function clearTicketRuntime(page: Page): Promise<void> {
  await page.goto(LIST_PATH, { waitUntil: 'domcontentloaded' })
  await page.evaluate((manualStorageKey) => {
    window.localStorage.removeItem(manualStorageKey)
  }, CUTTING_MANUAL_FEI_TICKET_SOURCES_STORAGE_KEY)
  await page.reload({ waitUntil: 'domcontentloaded' })
}

async function createWhiteManualBatch(page: Page): Promise<{
  detailPath: string
  recordIds: string[]
  whiteRecordIds: string[]
  yellowRecordIds: string[]
}> {
  await page.goto(LIST_PATH, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: '手动增加打印菲票' }).click()
  const dialog = page.getByRole('dialog', { name: '手动增加打印菲票' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('无铺布单')

  const markerSelect = dialog.locator('[data-cutting-fei-manual-field="markerPlanId"]')
  const markerValue = await markerSelect.locator('option').evaluateAll((options, markerNo) =>
    options.find((option) => option.textContent?.includes(String(markerNo)))?.getAttribute('value') || '', WHITE_MARKER_NO)
  expect(markerValue, `未找到可用验收唛架 ${WHITE_MARKER_NO}`).toBeTruthy()
  await markerSelect.selectOption(markerValue)
  await expect(dialog).toContainText('PO-202603-0003')
  await expect(dialog.locator('[data-cutting-fei-manual-size]').first()).toBeVisible()
  await dialog.locator('[data-cutting-fei-manual-field="layerCount"]').fill('2')
  await dialog.locator('[data-cutting-fei-manual-field="remark"]').fill('手动建票与分纸打印专项验收')
  await dialog.getByRole('button', { name: '确认生成菲票' }).click()
  await expect(page.locator('body')).toContainText('已按唛架')
  await expect(page.locator('body')).toContainText('手动唛架建票 / 无铺布单')

  const manualButton = page.getByRole('button', { name: '手动建票批次' }).first()
  await expect(manualButton).toBeVisible()
  const detailPath = await manualButton.getAttribute('data-nav')
  expect(detailPath).toBeTruthy()
  const storedRecords = await page.evaluate((manualStorageKey) => {
    const raw = window.localStorage.getItem(manualStorageKey)
    const parsed = raw ? JSON.parse(raw) : { records: [] }
    return (parsed.records || []).map((record: {
      feiTicketId: string
      productionOrderNo: string
      hasSpecialCraft: boolean
      qrPayload?: { productionOrderNo?: string }
    }) => ({
      feiTicketId: record.feiTicketId,
      productionOrderNo: record.productionOrderNo,
      hasSpecialCraft: record.hasSpecialCraft,
      qrProductionOrderNo: record.qrPayload?.productionOrderNo || '',
    }))
  }, CUTTING_MANUAL_FEI_TICKET_SOURCES_STORAGE_KEY)
  const recordIds = storedRecords.map((record) => record.feiTicketId)
  const whiteRecordIds = storedRecords.filter((record) => !record.hasSpecialCraft).map((record) => record.feiTicketId)
  const yellowRecordIds = storedRecords.filter((record) => record.hasSpecialCraft).map((record) => record.feiTicketId)
  expect(recordIds.length).toBeGreaterThan(0)
  expect(whiteRecordIds.length).toBeGreaterThan(0)
  expect(yellowRecordIds.length).toBeGreaterThan(0)
  expect(storedRecords.every((record) => record.productionOrderNo === 'PO-202603-0003')).toBe(true)
  expect(storedRecords.every((record) => record.qrProductionOrderNo === 'PO-202603-0003')).toBe(true)
  return { detailPath: detailPath!, recordIds, whiteRecordIds, yellowRecordIds }
}

test('手动批量建票、明细操作、白纸打印与打印后锁定形成闭环', async ({ page }) => {
  const errors = collectPageErrors(page)
  await clearTicketRuntime(page)
  const { detailPath } = await createWhiteManualBatch(page)

  await page.goto(detailPath)
  await expect(page.locator('body')).toContainText('手动菲票批次明细')
  await expect(page.locator('body')).toContainText('手动唛架建票 / 无铺布单')
  await expect(page.locator('body')).toContainText('PO-202603-0003')
  await expect(page.locator('body')).not.toContainText('待补生产单')
  await expect(page.locator('[data-cutting-fei-action="set-detail-paper"][data-paper-color="WHITE"]')).toContainText('白色热敏纸')
  await expect(page.locator('[data-cutting-fei-action="set-detail-paper"][data-paper-color="YELLOW"]')).not.toContainText('（0）')
  const detailTable = page.locator('table').first()
  await expect(detailTable).not.toContainText('特殊工艺 / 承接工厂')

  await page.getByRole('button', { name: '新增菲票' }).click()
  await page.locator('[data-cutting-fei-detail-dialog-field="qty"]').fill('3')
  await page.locator('[data-cutting-fei-detail-dialog-field="remark"]').fill('业务补建')
  await page.getByRole('button', { name: '确定新增' }).click()
  await expect(page.locator('body')).toContainText('已新增未打印菲票')

  const appendedRecord = await page.evaluate((manualStorageKey) => {
    const raw = window.localStorage.getItem(manualStorageKey)
    const store = raw ? JSON.parse(raw) : { records: [] }
    const record = [...store.records].reverse().find((item: { feiTicketNo: string }) => /-A\d+$/.test(item.feiTicketNo))
    return {
      qty: record?.qty,
      pieceSetNoRange: record?.pieceSetNoRange,
      sourceOutputLineId: record?.sourceOutputLineId,
      qrSourceOutputLineId: record?.qrPayload?.sourceOutputLineId,
      qrPieceSetNoRange: record?.qrPayload?.pieceSetNoRange,
    }
  }, CUTTING_MANUAL_FEI_TICKET_SOURCES_STORAGE_KEY)
  expect(appendedRecord).toEqual(expect.objectContaining({
    qty: 3,
    pieceSetNoRange: '1-3',
    qrPieceSetNoRange: '1-3',
  }))
  expect(appendedRecord.qrSourceOutputLineId).toBe(appendedRecord.sourceOutputLineId)

  const editButton = page.getByRole('button', { name: '修改数量' }).first()
  const editedTicketId = await editButton.getAttribute('data-ticket-id')
  expect(editedTicketId).toBeTruthy()
  await editButton.click()
  await page.locator('[data-cutting-fei-detail-dialog-field="qty"]').fill('7')
  await page.locator('[data-cutting-fei-detail-dialog-field="remark"]').fill('裁片复核后修正数量')
  await page.getByRole('button', { name: '确认修改' }).click()
  await expect(page.locator('body')).toContainText('二维码数量和编号范围同步更新')

  const updatedRecord = await page.evaluate(({ manualStorageKey, ticketId }) => {
    const raw = window.localStorage.getItem(manualStorageKey)
    const store = raw ? JSON.parse(raw) : { records: [], operationLogs: [] }
    const record = store.records.find((item: { feiTicketId: string }) => item.feiTicketId === ticketId)
    return {
      qty: record?.qty,
      pieceSetNoRange: record?.pieceSetNoRange,
      qrQty: record?.qrPayload?.qty,
      qrPieceSetNoRange: record?.qrPayload?.pieceSetNoRange,
      sourceOutputLineId: record?.sourceOutputLineId,
      qrSourceOutputLineId: record?.qrPayload?.sourceOutputLineId,
    }
  }, { manualStorageKey: CUTTING_MANUAL_FEI_TICKET_SOURCES_STORAGE_KEY, ticketId: editedTicketId })
  expect(updatedRecord).toEqual(expect.objectContaining({
    qty: 7,
    pieceSetNoRange: '1-7',
    qrQty: 7,
    qrPieceSetNoRange: '1-7',
  }))
  expect(updatedRecord.qrSourceOutputLineId).toBe(updatedRecord.sourceOutputLineId)

  await page.getByRole('button', { name: '单条详情' }).first().click()
  await expect(page.locator('body')).toContainText('操作记录')
  await expect(page.locator('body')).toContainText('修改数量')
  await expect(page.locator('body')).toContainText('裁片复核后修正数量')
  await page.locator('[data-cutting-fei-action="close-detail-dialog"]').click()

  const allPrintButton = page.locator('[data-cutting-fei-action="request-detail-all-print"]')
  await expect(allPrintButton).toBeEnabled()
  await allPrintButton.click()
  await expect(page.locator('body')).toContainText('请装入白色热敏纸')
  await page.getByRole('button', { name: '已装入白色热敏纸，进入预览' }).click()

  await expect(page).toHaveURL(/documentType=FEI_TICKET_LABEL/)
  await expect(page.locator('body')).toContainText('菲票标签（白色热敏纸）')
  await expect(page.locator('body')).toContainText('PO-202603-0003')
  await expect(page.locator('.print-label-paper').first()).toBeVisible()
  expect(await page.locator('.print-label-paper').count()).toBeGreaterThan(1)
  await expect(page.locator('.print-preview-root')).not.toContainText('特殊工艺 / 承接工厂')

  await page.evaluate(() => {
    ;(window as unknown as { __feiTicketPrintCalled?: boolean }).__feiTicketPrintCalled = false
    window.print = () => {
      ;(window as unknown as { __feiTicketPrintCalled?: boolean }).__feiTicketPrintCalled = true
    }
  })
  await page.getByRole('button', { name: '打印', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __feiTicketPrintCalled?: boolean }).__feiTicketPrintCalled)).toBe(true)

  await page.goto(detailPath)
  await expect(page.getByRole('button', { name: '修改数量' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '删除' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '补打' }).first()).toBeVisible()
  const firstPrintHistory = await page.evaluate(({ manualStorageKey, ticketId }) => {
    const raw = window.localStorage.getItem(manualStorageKey)
    const store = raw ? JSON.parse(raw) : { records: [] }
    return store.records.find((item: { feiTicketId: string }) => item.feiTicketId === ticketId)?.manualPrintHistory || []
  }, { manualStorageKey: CUTTING_MANUAL_FEI_TICKET_SOURCES_STORAGE_KEY, ticketId: editedTicketId })
  expect(firstPrintHistory).toHaveLength(1)
  expect(firstPrintHistory[0]).toEqual(expect.objectContaining({
    action: 'PRINT',
    paperColor: 'WHITE',
    templateCode: 'FEI_TICKET_WHITE_THERMAL',
  }))
  expect(firstPrintHistory[0].labelSize).toMatch(/^LABEL_/)
  expect(firstPrintHistory[0].sourceRange.length).toBeGreaterThan(1)

  await page.goto(`/fcs/print/preview?documentType=FEI_TICKET_REPRINT_LABEL&sourceType=FEI_TICKET_RECORD&sourceId=${encodeURIComponent(editedTicketId!)}&paperColor=WHITE`)
  await expect(page.locator('body')).toContainText('手动菲票补打必须填写补打原因')
  await page.goto(detailPath)

  await page.locator(`[data-cutting-fei-action="request-detail-row-print"][data-ticket-id="${editedTicketId}"]`).click()
  await expect(page.locator('body')).toContainText('补打原因与纸张确认')
  const reprintConfirm = page.locator('[data-cutting-fei-action="confirm-detail-print"]')
  await expect(reprintConfirm).toBeDisabled()
  await page.locator('[data-cutting-fei-detail-print-field="reason"]').fill('原菲票破损，现场申请补打')
  await expect(reprintConfirm).toBeEnabled()
  await reprintConfirm.click()
  await expect(page).toHaveURL(/documentType=FEI_TICKET_REPRINT_LABEL/)
  await expect(page.locator('body')).toContainText('补打原因：原菲票破损，现场申请补打')
  await page.evaluate(() => {
    ;(window as unknown as { __feiTicketReprintCalled?: boolean }).__feiTicketReprintCalled = false
    window.print = () => {
      ;(window as unknown as { __feiTicketReprintCalled?: boolean }).__feiTicketReprintCalled = true
    }
  })
  await page.getByRole('button', { name: '打印', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __feiTicketReprintCalled?: boolean }).__feiTicketReprintCalled)).toBe(true)

  await page.goto(detailPath)
  await page.locator(`[data-cutting-fei-action="open-detail-single"][data-ticket-id="${editedTicketId}"]`).click()
  await expect(page.locator('body')).toContainText('打印菲票')
  await expect(page.locator('body')).toContainText('补打菲票')
  await expect(page.locator('body')).toContainText('原菲票破损，现场申请补打')

  const reprintHistory = await page.evaluate(({ manualStorageKey, ticketId }) => {
    const raw = window.localStorage.getItem(manualStorageKey)
    const store = raw ? JSON.parse(raw) : { records: [] }
    return store.records.find((item: { feiTicketId: string }) => item.feiTicketId === ticketId)?.manualPrintHistory || []
  }, { manualStorageKey: CUTTING_MANUAL_FEI_TICKET_SOURCES_STORAGE_KEY, ticketId: editedTicketId })
  expect(reprintHistory).toHaveLength(2)
  expect(reprintHistory[1]).toEqual(expect.objectContaining({
    action: 'REPRINT',
    reason: '原菲票破损，现场申请补打',
    paperColor: 'WHITE',
    templateCode: 'FEI_TICKET_WHITE_THERMAL',
  }))

  await expectNoPageErrors(errors)
})

test('手动建票阻断非法层数和全零尺码件数', async ({ page }) => {
  const errors = collectPageErrors(page)
  await clearTicketRuntime(page)
  await page.getByRole('button', { name: '手动增加打印菲票' }).click()
  const dialog = page.getByRole('dialog', { name: '手动增加打印菲票' })
  const markerSelect = dialog.locator('[data-cutting-fei-manual-field="markerPlanId"]')
  const markerValue = await markerSelect.locator('option').evaluateAll((options, markerNo) =>
    options.find((option) => option.textContent?.includes(String(markerNo)))?.getAttribute('value') || '', WHITE_MARKER_NO)
  await markerSelect.selectOption(markerValue)

  await dialog.locator('[data-cutting-fei-manual-field="layerCount"]').fill('0')
  await dialog.getByRole('button', { name: '确认生成菲票' }).click()
  await expect(page.locator('body')).toContainText('铺布层数必须大于 0')

  await dialog.locator('[data-cutting-fei-manual-field="layerCount"]').fill('1')
  const sizeInputs = dialog.locator('[data-cutting-fei-manual-size]')
  for (let index = 0; index < await sizeInputs.count(); index += 1) {
    await dialog.locator('[data-cutting-fei-manual-size]').nth(index).fill('0')
  }
  await dialog.getByRole('button', { name: '确认生成菲票' }).click()
  await expect(page.locator('body')).toContainText('请至少为一个尺码填写每层件数')
  const storedCount = await page.evaluate((manualStorageKey) => {
    const raw = window.localStorage.getItem(manualStorageKey)
    return raw ? JSON.parse(raw).records.length : 0
  }, CUTTING_MANUAL_FEI_TICKET_SOURCES_STORAGE_KEY)
  expect(storedCount).toBe(0)
  await expectNoPageErrors(errors)
})

test('辅助工艺和特种工艺菲票只进黄纸 Tab，打印模板显著标记工艺与工厂', async ({ page }) => {
  const errors = collectPageErrors(page)
  await clearTicketRuntime(page)
  await page.goto(LIST_PATH)
  const systemDetailButton = page.locator('button[data-nav*="/fcs/craft/cutting/fei-tickets/spreading%3A"]').first()
  await expect(systemDetailButton).toBeVisible()
  const detailPath = await systemDetailButton.getAttribute('data-nav')
  expect(detailPath).toBeTruthy()
  await page.goto(detailPath!)

  const yellowTab = page.locator('[data-cutting-fei-action="set-detail-paper"][data-paper-color="YELLOW"]')
  await expect(yellowTab).toBeVisible()
  await yellowTab.click()
  await expect(page.locator('body')).toContainText('黄色热敏纸：')
  await expect(page.locator('table').first()).toContainText('特殊工艺 / 承接工厂')
  await expect(page.getByRole('button', { name: '修改数量' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '删除' })).toHaveCount(0)

  const firstPrint = page.locator('[data-cutting-fei-action="request-detail-all-print"]:not([disabled]), [data-cutting-fei-action="request-detail-all-reprint"]:not([disabled])').first()
  await expect(firstPrint).toBeVisible()
  await firstPrint.click()
  await expect(page.locator('body')).toContainText('请装入黄色热敏纸')
  await page.getByRole('button', { name: '已装入黄色热敏纸，进入预览' }).click()

  await expect(page.locator('body')).toContainText('特殊工艺 · 黄色热敏纸')
  await expect(page.locator('body')).toContainText('特殊工艺 / 承接工厂')
  const yellowLabels = page.locator('.print-label-paper')
  const yellowLabelCount = await yellowLabels.count()
  expect(yellowLabelCount).toBeGreaterThan(1)
  for (let index = 0; index < yellowLabelCount; index += 1) {
    const yellowLabel = yellowLabels.nth(index)
    await expect(yellowLabel).toBeVisible()
    const productionOrderCell = yellowLabel.getByText('生产单号（PO）', { exact: true }).locator('..')
    const spuCell = yellowLabel.getByText('SPU', { exact: true }).locator('..')
    await expect(productionOrderCell).toHaveCount(1)
    await expect(productionOrderCell.locator('strong')).not.toHaveText('—')
    await expect(spuCell).toHaveCount(1)
    await expect(spuCell.locator('strong')).not.toHaveText('—')
  }

  const yellowReprintRecord = listGeneratedFeiTickets().find((record) =>
    record.hasSpecialCraft
    && record.specialCrafts.length > 0
    && record.specialCrafts.every((craft) =>
      Boolean(craft.receiverFactoryId)
      && craft.receiverFactoryId !== 'PENDING-SPECIAL-CRAFT-FACTORY'))
  expect(yellowReprintRecord, '未找到可用于黄色菲票补打验收的已绑定特殊工艺工厂记录').toBeTruthy()
  await page.goto(`/fcs/print/preview?documentType=FEI_TICKET_REPRINT_LABEL&sourceType=FEI_TICKET_RECORD&sourceId=${encodeURIComponent(yellowReprintRecord!.feiTicketId)}&paperColor=YELLOW&reason=${encodeURIComponent('黄色特殊工艺菲票补打验收')}`)
  await expect(page.locator('body')).toContainText('特殊工艺 · 黄色热敏纸')
  await expect(page.locator('body')).toContainText('补打原因：黄色特殊工艺菲票补打验收')
  const yellowReprintLabel = page.locator('.print-label-paper').first()
  await expect(yellowReprintLabel.getByText('生产单号（PO）', { exact: true }).locator('..').locator('strong')).not.toHaveText('—')
  await expect(yellowReprintLabel.getByText('SPU', { exact: true }).locator('..').locator('strong')).not.toHaveText('—')
  await expectNoPageErrors(errors)
})

test('详情保留线上筛选、选择、批量打印、删除和分页能力，跨纸选择不串联', async ({ page }) => {
  const errors = collectPageErrors(page)
  await clearTicketRuntime(page)
  const { detailPath } = await createWhiteManualBatch(page)
  await page.goto(detailPath)

  const firstSelection = page.locator('[data-cutting-fei-detail-select]').first()
  await firstSelection.check()
  await expect(page.locator('[data-cutting-fei-action="request-detail-selected-print"]')).toContainText('批量打印（1）')
  await page.locator('[data-cutting-fei-action="set-detail-paper"][data-paper-color="YELLOW"]').click()
  await expect(page.locator('[data-cutting-fei-action="request-detail-selected-print"]')).toBeDisabled()
  await page.locator('[data-cutting-fei-action="set-detail-paper"][data-paper-color="WHITE"]').click()

  const firstTicketNo = (await page.locator('tbody tr').first().locator('p.font-mono').textContent())?.trim() || ''
  expect(firstTicketNo).toBeTruthy()
  await page.locator('[data-cutting-fei-detail-field="keyword"]').fill(firstTicketNo)
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await page.locator('[data-cutting-fei-action="reset-detail-filters"]').click()
  expect(await page.locator('tbody tr').count()).toBeGreaterThan(1)

  await page.locator('[data-cutting-fei-detail-field="sourceFilter"]').selectOption('SYSTEM')
  await expect(page.locator('body')).toContainText('当前纸张分类和筛选条件下没有菲票')
  await page.locator('[data-cutting-fei-detail-field="sourceFilter"]').selectOption('MANUAL')
  expect(await page.locator('tbody tr').count()).toBeGreaterThan(1)

  const beforeDeleteCount = await page.locator('tbody tr').count()
  const deletedTicketNo = (await page.locator('tbody tr').first().locator('p.font-mono').textContent())?.trim() || ''
  await page.getByRole('button', { name: '删除' }).first().click()
  await page.getByRole('button', { name: '确认删除' }).click()
  await expect(page.locator('body')).toContainText('已删除该未打印手动菲票')
  await expect(page.locator('tbody')).not.toContainText(deletedTicketNo)
  await expect(page.locator('tbody tr')).toHaveCount(beforeDeleteCount - 1)

  await page.evaluate((manualStorageKey) => {
    const raw = window.localStorage.getItem(manualStorageKey)
    const store = raw ? JSON.parse(raw) : { records: [], operationLogs: [] }
    const source = store.records.find((record: { hasSpecialCraft: boolean }) => !record.hasSpecialCraft)
    const currentWhiteCount = store.records.filter((record: { hasSpecialCraft: boolean }) => !record.hasSpecialCraft).length
    for (let index = currentWhiteCount; index < 35; index += 1) {
      const suffix = `-PAGE-${String(index + 1).padStart(2, '0')}`
      store.records.push({
        ...source,
        feiTicketId: `${source.feiTicketId}${suffix}`,
        feiTicketNo: `${source.feiTicketNo}${suffix}`,
        sourceOutputLineId: `${source.sourceOutputLineId}${suffix}`,
        qrPayload: {
          ...source.qrPayload,
          feiTicketId: `${source.feiTicketId}${suffix}`,
          feiTicketNo: `${source.feiTicketNo}${suffix}`,
          sourceOutputLineId: `${source.sourceOutputLineId}${suffix}`,
        },
      })
    }
    window.localStorage.setItem(manualStorageKey, JSON.stringify(store))
  }, CUTTING_MANUAL_FEI_TICKET_SOURCES_STORAGE_KEY)
  await page.reload()
  await expect(page.locator('body')).toContainText('第 1 / 2 页')
  await page.locator('[data-cutting-fei-action="detail-next-page"]').click()
  await expect(page.locator('body')).toContainText('第 2 / 2 页')
  await page.locator('[data-cutting-fei-action="toggle-detail-page-selection"]').check()
  const selectedPrintButton = page.locator('[data-cutting-fei-action="request-detail-selected-print"]')
  await expect(selectedPrintButton).toBeEnabled()
  await selectedPrintButton.click()
  await expect(page.locator('body')).toContainText('请装入白色热敏纸')
  await page.locator('[data-cutting-fei-action="cancel-detail-print"]').click()

  await expectNoPageErrors(errors)
})

test('白黄菲票混打和特殊工艺缺少承接工厂均被阻断', async ({ page }) => {
  const errors = collectPageErrors(page)
  await clearTicketRuntime(page)
  const { detailPath, whiteRecordIds } = await createWhiteManualBatch(page)
  const yellowRecord = listGeneratedFeiTickets().find((record) => record.hasSpecialCraft)
  expect(yellowRecord).toBeTruthy()

  const mixedSourceId = encodeURIComponent(`${whiteRecordIds[0]},${yellowRecord!.feiTicketId}`)
  await page.goto(`/fcs/print/preview?documentType=FEI_TICKET_LABEL&sourceType=FEI_TICKET_RECORD&sourceId=${mixedSourceId}`)
  await expect(page.locator('body')).toContainText('白色热敏纸菲票与黄色热敏纸菲票不能合并打印')

  await page.evaluate(({ manualStorageKey, recordId }) => {
    const raw = window.localStorage.getItem(manualStorageKey)
    const store = raw ? JSON.parse(raw) : { records: [], operationLogs: [] }
    const record = store.records.find((item: { feiTicketId: string }) => item.feiTicketId === recordId)
    record.hasSpecialCraft = true
    record.secondaryCrafts = ['绣花']
    record.currentCraftStage = '绣花'
    record.specialCraftDisplayLabel = '辅助工艺：绣花 / 承接工厂待补'
    record.specialCrafts = [{
      sourceOutputLineId: record.sourceOutputLineId,
      craftCategory: 'AUXILIARY',
      craftType: 'EMBROIDERY',
      craftName: '绣花',
      receiverFactoryId: 'PENDING-SPECIAL-CRAFT-FACTORY',
      receiverFactoryCode: '待补',
      receiverFactoryName: '承接工厂待补',
    }]
    window.localStorage.setItem(manualStorageKey, JSON.stringify(store))
  }, { manualStorageKey: CUTTING_MANUAL_FEI_TICKET_SOURCES_STORAGE_KEY, recordId: whiteRecordIds[0] })

  await page.goto(detailPath)
  await page.locator('[data-cutting-fei-action="set-detail-paper"][data-paper-color="YELLOW"]').click()
  await expect(page.locator('body')).toContainText('缺少承接工厂，正式打印已阻断')
  await page.locator(`[data-cutting-fei-action="request-detail-row-print"][data-ticket-id="${whiteRecordIds[0]}"]`).click()
  await expect(page.locator('body')).toContainText('存在特殊工艺但尚未明确承接工厂，已阻断正式打印')

  await page.goto(`/fcs/print/preview?documentType=FEI_TICKET_LABEL&sourceType=FEI_TICKET_RECORD&sourceId=${encodeURIComponent(whiteRecordIds[0])}&paperColor=YELLOW`)
  await expect(page.locator('body')).toContainText('存在特殊工艺但承接工厂未明确，禁止正式打印')
  await expectNoPageErrors(errors)
})
