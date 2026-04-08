import { expect, test } from '@playwright/test'

import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test('首张菲票会自动开始周转并锁定车缝上下文，后续不兼容菲票会被拒绝', async ({ page }) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/craft/cutting/transfer-bag-detail?bagId=carrier-bag-014')
  await expect(page.getByRole('heading', { name: '中转袋详情', exact: true })).toBeVisible()

  const body = page.locator('body')
  await expect(body).not.toContainText('绑定任务')
  await expect(page.locator('select[data-transfer-bags-workbench-field="sewingTaskId"]')).toHaveCount(0)

  const ticketPair = await page.evaluate(async () => {
    const { buildTransferBagsProjection } = await import('/src/pages/process-factory/cutting/transfer-bags-projection.ts')
    const { resolveTransferBagCycleContextFromTicket } = await import('/src/pages/process-factory/cutting/transfer-bags-model.ts')

    const projection = buildTransferBagsProjection()
    const used = new Set(Object.keys(projection.viewModel.activeTicketBindingsByTicketId || {}))
    const freePrinted = projection.viewModel.ticketCandidates.filter(
      (ticket) => ticket.ticketStatus === 'PRINTED' && used.has(ticket.ticketRecordId) === false,
    )
    const first = freePrinted.find((ticket) =>
      resolveTransferBagCycleContextFromTicket({
        ticket,
        sewingTasks: projection.viewModel.sewingTasks,
      }).ok,
    )
    if (!first) return null
    const firstTask = resolveTransferBagCycleContextFromTicket({
      ticket: first,
      sewingTasks: projection.viewModel.sewingTasks,
    }).sewingTask
    if (!firstTask) return null

    const incompatible = freePrinted.find((ticket) => {
      if (ticket.ticketRecordId === first.ticketRecordId) return false
      const task = resolveTransferBagCycleContextFromTicket({
        ticket,
        sewingTasks: projection.viewModel.sewingTasks,
      }).sewingTask
      return task && task.sewingTaskId !== firstTask.sewingTaskId && (ticket.styleCode !== first.styleCode || ticket.spuCode !== first.spuCode)
    })
    if (!incompatible) return null

    return {
      firstTicketNo: first.ticketNo,
      firstTaskNo: firstTask.sewingTaskNo,
      firstFactoryName: firstTask.sewingFactoryName,
      incompatibleTicketNo: incompatible.ticketNo,
    }
  })

  expect(ticketPair).not.toBeNull()
  if (!ticketPair) return

  const ticketInput = page.locator('input[data-transfer-bags-workbench-field="ticketInput"]').first()
  await ticketInput.fill(ticketPair.firstTicketNo)
  await page.getByRole('button', { name: '加入本袋', exact: true }).click()

  await expect(body).toContainText(ticketPair.firstTaskNo)
  await expect(body).toContainText(ticketPair.firstFactoryName)
  await expect(body).not.toContainText('待首张菲票锁定')

  const afterFirstBind = await page.evaluate(() => {
    const ledger = JSON.parse(window.localStorage.getItem('cuttingTransferBagLedger') || '{}')
    const activeUsages = (ledger.usages || []).filter((item: any) => {
      const bagId = item.bagId || item.carrierId
      const status = item.usageStatus || item.cycleStatus
      return bagId === 'carrier-bag-014' && !['CLOSED', 'EXCEPTION_CLOSED'].includes(status)
    })
    const activeUsage = activeUsages[0] || null
    const bindingCount = (ledger.bindings || []).filter((item: any) => (item.bagId || item.carrierId) === 'carrier-bag-014').length
    return {
      usageCount: activeUsages.length,
      usageNo: activeUsage?.usageNo || activeUsage?.cycleNo || '',
      sewingTaskNo: activeUsage?.sewingTaskNo || '',
      sewingFactoryName: activeUsage?.sewingFactoryName || '',
      bindingCount,
    }
  })

  expect(afterFirstBind.usageCount).toBe(1)
  expect(afterFirstBind.usageNo).not.toBe('')
  expect(afterFirstBind.sewingTaskNo).toBe(ticketPair.firstTaskNo)
  expect(afterFirstBind.sewingFactoryName).toBe(ticketPair.firstFactoryName)
  expect(afterFirstBind.bindingCount).toBe(1)

  await ticketInput.fill(ticketPair.incompatibleTicketNo)
  await page.getByRole('button', { name: '加入本袋', exact: true }).click()
  await expect(body).toContainText('不可混装')

  const afterRejectedBind = await page.evaluate(() => {
    const ledger = JSON.parse(window.localStorage.getItem('cuttingTransferBagLedger') || '{}')
    return (ledger.bindings || []).filter((item: any) => (item.bagId || item.carrierId) === 'carrier-bag-014').length
  })
  expect(afterRejectedBind).toBe(1)

  await expectNoPageErrors(errors)
})
