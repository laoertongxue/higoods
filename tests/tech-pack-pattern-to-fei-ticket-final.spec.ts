import { expect, test, type Locator, type Page } from '@playwright/test'

import { listCutPiecePartCrafts } from '../src/data/fcs/process-craft-dict'
import { techPacks } from '../src/data/fcs/tech-packs'
import {
  getFeiTicketsNeedSpecialCraft,
  listCutPieceFeiTickets,
  resetCutPieceFeiTicketRuntimeForTest,
} from '../src/data/fcs/cutting/fei-ticket-generation'
import {
  getFeiTicketSpecialCraftFlowSummary,
  groupFeiTicketsBySpecialCraft,
} from '../src/data/fcs/cutting/special-craft-fei-ticket-flow'
import {
  buildBomItemsFromTechPack,
  buildPatternItemsFromTechPack,
  buildTechniquesFromTechPack,
} from '../src/pages/tech-pack/context'
import { checkDuplicatePattern } from '../src/pages/tech-pack/pattern-duplicate-check'
import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

const requiredStableSelectors = [
  'process-craft-dictionary-page',
  'prep-process-list',
  'special-craft-list',
  'cutting-craft-list',
  'bom-table',
  'bom-shrink-requirement',
  'bom-wash-requirement',
  'pattern-management-page',
  'pattern-create-button',
  'pattern-step-merchandiser',
  'pattern-step-maker',
  'pattern-prj-file-upload',
  'pattern-marker-image-upload',
  'pattern-binding-strip-section',
  'pattern-duplicate-dialog',
  'pattern-piece-table',
  'pattern-color-piece-editor',
  'pattern-total-piece-qty',
  'piece-instance-editor',
  'piece-special-craft-selector',
  'fei-ticket-page',
  'fei-ticket-generate-button',
  'fei-ticket-generate-preview',
  'fei-ticket-row',
  'fei-ticket-detail',
  'fei-ticket-special-craft-summary',
  'special-craft-fei-ticket-flow',
  'special-craft-ticket-group',
  'special-craft-task-generation-preview',
]

async function openCurrentTechPack(page: Page): Promise<void> {
  await page.goto('/pcs/products/styles/style_seed_001/technical-data/tdv_seed_001')
  await expect(page.getByRole('button', { name: '添加纸样', exact: true })).toBeVisible({ timeout: 30_000 })
}

async function openPatternForEdit(page: Page, patternName: string): Promise<Locator> {
  const row = page.locator('tbody tr').filter({ hasText: patternName }).first()
  await expect(row).toBeVisible()
  await row.locator('[data-tech-action="edit-pattern"]').click()
  const dialog = page.getByTestId('pattern-two-step-dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByTestId('pattern-step-maker').click()
  await expect(dialog.getByTestId('pattern-step-maker-panel')).toBeVisible()
  return dialog
}

test('最终链路稳定选择器清单已纳入覆盖', async () => {
  expect(requiredStableSelectors).toContain('process-craft-dictionary-page')
  expect(requiredStableSelectors).toContain('bom-shrink-requirement')
  expect(requiredStableSelectors).toContain('piece-special-craft-selector')
  expect(requiredStableSelectors).toContain('fei-ticket-special-craft-summary')
  expect(requiredStableSelectors).toContain('special-craft-fei-ticket-flow')
})

test('字典与 BOM 缩水洗水联动可在页面和数据中闭环', async ({ page }) => {
  test.setTimeout(90_000)
  const errors = collectPageErrors(page)

  await page.goto('/fcs/production/craft-dict')
  await expect(page.getByRole('heading', { name: '工序工艺字典' })).toBeVisible()
  await expect(page.getByTestId('process-craft-dictionary-rebuild-summary')).toContainText('缩水')
  await expect(page.getByTestId('process-craft-dictionary-rebuild-summary')).toContainText('洗水')
  await expect(page.getByTestId('process-craft-dictionary-rebuild-summary')).toContainText('辅助工艺')
  await expect(page.getByTestId('process-craft-dictionary-rebuild-summary')).toContainText('特种工艺')
  await expect(page.locator('body')).toContainText('捆条')
  await expect(page.locator('body')).toContainText('面料')
  await expect(page.locator('body')).toContainText('橡筋定长切割')
  await expect(page.locator('body')).toContainText('辅料')

  await openCurrentTechPack(page)
  await page.getByRole('button', { name: '物料清单', exact: true }).click()
  await expect(page.getByRole('columnheader', { name: '缩水需求', exact: true })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: '洗水需求', exact: true })).toBeVisible()
  await expect(page.getByTestId('bom-shrink-requirement-select').first()).toContainText('是')
  await expect(page.getByTestId('bom-wash-requirement-select').first()).toContainText('否')

  await page.locator('[data-tech-field="bom-shrink"]').first().selectOption('是')
  await page.locator('[data-tech-field="bom-wash"]').first().selectOption('是')
  await page.getByRole('button', { name: '工序工艺', exact: true }).click()
  await expect(page.locator('[data-tech-process-card="PREP_SHRINKING"]')).toContainText('物料清单自动生成')
  await expect(page.locator('[data-tech-process-card="PREP_WASHING"]')).toContainText('物料清单自动生成')

  const techPack = techPacks.find((item) => item.spuCode === 'SPU-2024-001') || techPacks[0]
  const bomRows = buildBomItemsFromTechPack(techPack)
  const techniques = buildTechniquesFromTechPack(techPack, bomRows)
  expect(bomRows.some((item) => item.shrinkRequirement === '是')).toBeTruthy()
  expect(bomRows.some((item) => item.washRequirement === '是')).toBeTruthy()
  expect(techniques.some((item) => item.processCode === 'PREP_SHRINKING')).toBeTruthy()
  expect(techniques.some((item) => item.processCode === 'PREP_WASHING')).toBeTruthy()

  await expectNoPageErrors(errors)
})

test('纸样两步维护、捆条、重复校验、颜色片数和逐片特殊工艺保持同一快照口径', async ({ page }) => {
  test.setTimeout(120_000)
  const errors = collectPageErrors(page)

  await openCurrentTechPack(page)
  await expect(page.getByRole('button', { name: '添加纸样', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '添加纸样', exact: true }).click()
  const createDialog = page.getByTestId('pattern-two-step-dialog')
  await expect(createDialog).toBeVisible()
  await expect(createDialog.getByTestId('pattern-step-merchandiser')).toContainText('跟单基础信息')
  await expect(createDialog.getByTestId('pattern-step-maker')).toContainText('版师技术信息')
  await expect(createDialog.getByTestId('pattern-step-merchandiser-panel')).toContainText('纸样名称')
  await expect(createDialog.getByTestId('pattern-step-merchandiser-panel')).toContainText('关联物料')
  await expect(createDialog.getByTestId('pattern-step-merchandiser-panel')).not.toContainText('纸样 PRJ 文件')
  await expect(createDialog).not.toContainText(`纸样${'图片'}`)
  await createDialog.getByRole('button', { name: '取消', exact: true }).click()

  const dialog = await openPatternForEdit(page, '已解析待确认纸样2')
  await expect(dialog.getByTestId('pattern-step-maker-panel')).toContainText('纸样 PRJ 文件')
  await expect(dialog.getByTestId('pattern-step-maker-panel')).toContainText('唛架图片')
  await expect(dialog.getByTestId('pattern-binding-strip-section')).toBeVisible()
  await expect(dialog.getByTestId('pattern-piece-table')).toBeVisible()
  await expect(dialog.getByTestId('pattern-piece-table')).toContainText('适用颜色')
  await expect(dialog.getByTestId('pattern-piece-table')).toContainText('当前部位总片数')
  await expect(dialog.getByTestId('pattern-piece-total')).toContainText('当前总片数')
  await expect(dialog.getByTestId('pattern-piece-table').locator('thead')).not.toContainText(/^片数$/)
  const firstPieceRow = dialog.getByTestId('pattern-piece-row').first()
  await expect(firstPieceRow.getByTestId('pattern-color-piece-qty').first()).toBeVisible()
  await expect(firstPieceRow).toContainText('解析参考片数')

  await firstPieceRow.getByRole('button', { name: '维护逐片工艺', exact: true }).click()
  const craftDialog = page.getByTestId('piece-instance-special-craft-dialog')
  await expect(craftDialog).toBeVisible()
  await expect(craftDialog.getByTestId('piece-instance-row').first()).toContainText('第1片')
  const craftSelect = craftDialog.getByTestId('piece-instance-special-craft-select')
  for (const allowed of ['绣花', '打条', '压褶', '打揽', '烫画', '直喷', '贝壳绣', '曲牙绣', '一字贝绣花', '模板工序', '激光开袋', '特种车缝（花样机）']) {
    await expect(craftSelect).toContainText(allowed)
  }
  for (const forbidden of ['捆条', '橡筋定长切割', '缩水', '洗水']) {
    await expect(craftSelect.locator('option', { hasText: forbidden })).toHaveCount(0)
  }
  await expect(craftDialog.getByRole('button', { name: '应用到同颜色全部片', exact: true })).toBeVisible()

  const patterns = techPacks.flatMap((techPack) => buildPatternItemsFromTechPack(techPack))
  const fullPattern = patterns.find((item) => item.bindingStrips.length > 0 && item.pieceInstances.length > 0)
  expect(fullPattern).toBeTruthy()
  expect(fullPattern!.prjFile?.fileName).toMatch(/\.prj$/i)
  expect(fullPattern!.markerImage?.fileName).toBeTruthy()
  expect(fullPattern!.bindingStrips.some((strip) => strip.lengthCm > 0 && strip.widthCm > 0)).toBeTruthy()
  expect(fullPattern!.patternTotalPieceQty).toBeGreaterThan(0)
  expect(fullPattern!.pieceInstances.every((instance) => instance.pieceInstanceId && instance.sourcePieceId)).toBeTruthy()
  expect(fullPattern!.pieceInstances.some((instance) => instance.specialCraftAssignments.length > 0)).toBeTruthy()

  const existing = patterns.map((item) => ({
    patternId: item.id,
    patternName: item.name,
    patternType: item.patternMaterialType,
    linkedMaterialId: item.linkedMaterialId,
    prjFile: item.prjFile,
    dxfFile: item.dxfFile,
    rulFile: item.rulFile,
    markerImage: item.markerImage,
    selectedSizeCodes: item.selectedSizeCodes,
    pieceRows: item.pieceRows,
  }))
  const duplicateResult = checkDuplicatePattern({
    patternId: 'FINAL-DUP-CHECK',
    patternName: fullPattern!.name,
    linkedMaterialId: fullPattern!.linkedMaterialId,
    patternType: fullPattern!.patternMaterialType,
    prjFile: fullPattern!.prjFile,
  }, existing)
  expect(duplicateResult.hasBlockingDuplicate).toBeTruthy()

  const selectorOptions = listCutPiecePartCrafts().map((item) => item.craftName)
  expect(selectorOptions).not.toContain('捆条')
  expect(selectorOptions).not.toContain('橡筋定长切割')
  expect(selectorOptions).not.toContain('缩水')
  expect(selectorOptions).not.toContain('洗水')

  await expectNoPageErrors(errors)
})

test('逐片菲票携带特殊工艺并保持原始裁片单归属', async ({ page }) => {
  test.setTimeout(90_000)
  resetCutPieceFeiTicketRuntimeForTest()
  await page.addInitScript(() => {
    window.localStorage.removeItem('cuttingPerPieceFeiTickets')
  })
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/fei-tickets')
  await expect(page.getByRole('heading', { name: '打印菲票', exact: true })).toBeVisible()
  await expect(page.getByTestId('per-piece-fei-ticket-section')).toBeVisible()
  await expect(page.locator('body')).toContainText('逐片菲票')
  await expect(page.locator('body')).toContainText('菲票归属原始裁片单')
  await expect(page.locator('body')).toContainText('合并裁剪批次仅作为执行上下文')

  await page.getByRole('button', { name: '生成菲票', exact: true }).click()
  await expect(page.getByTestId('per-piece-fei-ticket-preview')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('per-piece-fei-ticket-preview')).toContainText('待生成菲票数量')
  await expect(page.getByTestId('per-piece-fei-ticket-preview')).toContainText('有特殊工艺菲票数量')
  await page.getByRole('button', { name: '确认生成', exact: true }).click()
  await expect(page.getByTestId('per-piece-fei-ticket-row').first()).toContainText(/FT-/)

  const craftRow = page.getByTestId('per-piece-fei-ticket-row').filter({ hasText: '打揽' }).first()
  await expect(craftRow).toBeVisible()
  await craftRow.getByRole('button', { name: '详情', exact: true }).click()
  const detail = page.getByTestId('per-piece-fei-ticket-detail')
  await expect(detail).toContainText('来源裁片实例')
  await expect(detail).toContainText('原始裁片单')
  await expect(detail).toContainText('打揽')
  await expect(detail).toContainText(/左|右|底|面/)
  await expect(detail.getByTestId('per-piece-fei-ticket-qr-payload')).toContainText('sourcePieceInstanceId')
  await expect(detail.getByTestId('per-piece-fei-ticket-qr-payload')).toContainText('originalCutPieceOrderId')

  const tickets = listCutPieceFeiTickets()
  const pieceInstanceIds = tickets.map((ticket) => ticket.sourcePieceInstanceId)
  expect(new Set(pieceInstanceIds).size).toBe(pieceInstanceIds.length)
  expect(tickets.every((ticket) => ticket.originalCutPieceOrderId)).toBeTruthy()
  expect(tickets.every((ticket) => !ticket.mergeBatchId || ticket.originalCutPieceOrderId)).toBeTruthy()
  expect(tickets.some((ticket) => ticket.specialCraftSummary === '无特殊工艺')).toBeTruthy()
  expect(tickets.some((ticket) => ticket.specialCrafts.length > 0)).toBeTruthy()

  await page.goto('/fcs/print/preview?documentType=FEI_TICKET_LABEL&sourceType=FEI_TICKET_RECORD&sourceId=' + encodeURIComponent(tickets.find((ticket) => ticket.specialCrafts.length > 0)!.feiTicketId))
  await expect(page.locator('body')).toContainText('菲票标签')
  await expect(page.locator('body')).toContainText('特殊工艺')
  await expect(page.locator('body')).toContainText('二维码追溯')

  await expectNoPageErrors(errors)
})

test('特殊工艺任务生成可以消费菲票上的结构化特殊工艺', async () => {
  resetCutPieceFeiTicketRuntimeForTest()
  const ticketsWithCraft = getFeiTicketsNeedSpecialCraft()
  expect(ticketsWithCraft.length).toBeGreaterThan(0)
  const groups = groupFeiTicketsBySpecialCraft(ticketsWithCraft)
  const smockingGroup = groups.find((group) => group.craftName === '打揽') || groups[0]
  expect(smockingGroup.feiTicketCount).toBeGreaterThan(0)
  expect(smockingGroup.feiTickets[0].specialCrafts[0].craftPositionName).toMatch(/左|右|底|面/)
  const flowSummary = getFeiTicketSpecialCraftFlowSummary(smockingGroup.feiTickets[0].feiTicketId)
  expect(flowSummary?.relatedFeiTicketIds).toContain(smockingGroup.feiTickets[0].feiTicketId)
  expect(groups.map((group) => group.craftName)).not.toContain('捆条')
  expect(groups.map((group) => group.craftName)).not.toContain('橡筋定长切割')
  expect(groups.map((group) => group.craftName)).not.toContain('缩水')
  expect(groups.map((group) => group.craftName)).not.toContain('洗水')
})
