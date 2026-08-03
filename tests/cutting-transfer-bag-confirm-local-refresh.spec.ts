import { expect, test, type Page } from '@playwright/test'
import {
  collectPageErrors,
  expectNoPageErrors,
  seedLocalStorage,
} from './helpers/seed-cutting-runtime-state'

const PDA_SESSION = {
  userId: 'F090_operator',
  loginId: 'F090_operator',
  userName: '全能力测试工厂_操作工',
  roleId: 'ROLE_OPERATOR',
  factoryId: 'F090',
  factoryName: '全能力测试工厂',
  loggedAt: '2026-07-27 12:00:00',
}

type ConfirmResult = {
  durationMs: number
  activeField: string | null
  rootStable: boolean
  workflowStable: boolean
  scrollBefore: number
  scrollAfter: number
  workflowScrollBefore: number
  workflowScrollAfter: number
}

async function openPdaWorkflow(page: Page, path: string, workflowSelector: string): Promise<void> {
  await seedLocalStorage(page, { fcs_pda_session: PDA_SESSION })
  await page.goto(path, { waitUntil: 'domcontentloaded' })
  await expect(page.locator(workflowSelector)).toBeVisible({ timeout: 30_000 })
  await page.waitForLoadState('networkidle')
}

async function seedInboundTransferBagLifecycle(page: Page, bagCode: string): Promise<void> {
  await page.evaluate(async (runtimeBagCode) => {
    const { appendCuttingRuntimeEvent } = await import('/src/data/fcs/cutting/cutting-runtime-event-ledger.ts')
    const { appendWaitHandoverInboundEvent } = await import('/src/pages/process-factory/cutting/wait-handover-runtime.ts')
    const usageCycleId = `E2E-CYCLE-${runtimeBagCode}`
    const operator = {
      operatorId: 'F090_operator',
      operatorName: '全能力测试工厂_操作工',
      operatorRole: '裁片仓操作员',
    }
    appendCuttingRuntimeEvent({
      eventType: '菲票装袋',
      eventSource: 'PDA',
      eventStatus: '已同步',
      occurredAt: '2026-07-30 10:00',
      operatorName: operator.operatorName,
      refs: {
        transferBagCode: runtimeBagCode,
        usageCycleId,
        productionOrderId: 'PO-202603-0102',
        productionOrderNo: 'PO-202603-0102',
        feiTicketIds: ['E2E-FEI-PO-202603-0102-001'],
        feiTicketNos: ['E2E-FEI-PO-202603-0102-001'],
      },
      payload: {
        baggingRecordId: `E2E-BAGGING-${runtimeBagCode}`,
        bagCode: runtimeBagCode,
        totalPieceQty: 12,
        mixedFlag: false,
        baggingBy: operator.operatorName,
        baggingAt: '2026-07-30 10:00',
        feiTicketItems: [{
        feiTicketId: 'E2E-FEI-PO-202603-0102-001',
        feiTicketNo: 'E2E-FEI-PO-202603-0102-001',
        productionOrderId: 'PO-202603-0102',
        productionOrderNo: 'PO-202603-0102',
        cutOrderId: 'E2E-CUT-001',
        cutOrderNo: 'E2E-CUT-001',
        spreadingOrderId: 'E2E-SPREAD-001',
        spreadingOrderNo: 'E2E-SPREAD-001',
        spuCode: 'SPU-E2E-001',
        color: '黑色',
        size: 'M',
        partCode: 'FRONT',
        partName: '前片',
        pieceQty: 12,
        pieceSequenceLabel: '1-12',
        hasSpecialCraft: false,
        specialCraftDisplay: '无特殊工艺',
        receiverFactoryDisplay: 'HiGood 印尼一厂',
        sewingTaskId: 'SEW-E2E-001',
        sewingTaskNo: 'CFRW-PO-202603-0102-01',
        receiverFactoryId: 'F090',
        receiverFactoryName: 'HiGood 印尼一厂',
        printStatus: '已打印',
        voidStatus: '正常',
        }],
      },
    })
    appendWaitHandoverInboundEvent({
      source: 'PDA',
      operator,
      bagCode: runtimeBagCode,
      usageCycleId,
      occurredAt: '2026-07-30 10:05',
      warehouseArea: '裁片暂存区',
      locationCode: 'E2E-01',
    })
  }, bagCode)
}

async function setInputValueWithoutInputDispatch(
  page: Page,
  selector: string,
  value: string,
): Promise<void> {
  await page.locator(selector).evaluate((node, nextValue) => {
    ;(node as HTMLInputElement).value = nextValue
  }, value)
}

async function confirmWithoutBrowserAutoScroll(
  page: Page,
  options: {
    workflowSelector: string
    buttonSelector: string
    feedbackText: string
    activeFieldAttribute: string
    postClickContentionMs?: number
    cpuThrottlingRate?: number
    inputValues?: Array<{ selector: string; value: string }>
  },
): Promise<ConfirmResult> {
  const cpuSession = options.cpuThrottlingRate
    ? await page.context().newCDPSession(page)
    : null
  if (cpuSession) {
    await cpuSession.send('Emulation.setCPUThrottlingRate', {
      rate: options.cpuThrottlingRate,
    })
  }
  try {
    return await page.evaluate(async (settings) => {
      const root = document.querySelector<HTMLElement>('#app')
      const workflow = document.querySelector<HTMLElement>(settings.workflowSelector)
      const button = document.querySelector<HTMLButtonElement>(settings.buttonSelector)
      if (!root?.firstElementChild || !workflow || !button) {
        throw new Error('确认前未找到根节点、工作区或按钮')
      }
      settings.inputValues?.forEach(({ selector, value }) => {
        const input = workflow.querySelector<HTMLInputElement>(selector)
        if (!input) throw new Error(`确认前未找到输入框：${selector}`)
        input.value = value
      })

      workflow.style.height = '180px'
      workflow.style.overflowY = 'auto'
      workflow.scrollTop = 80
      const spacer = document.createElement('div')
      spacer.dataset.testScrollSpacer = 'true'
      spacer.style.height = '1200px'
      document.body.append(spacer)
      window.scrollTo(0, 360)

      const rootChildBefore = root.firstElementChild
      const workflowBefore = workflow
      const scrollBefore = window.scrollY
      const workflowScrollBefore = workflow.scrollTop
      const startedAt = performance.now()
      const feedbackAt = await new Promise<number>((resolve, reject) => {
        const deadline = window.setTimeout(() => {
          observer.disconnect()
          reject(new Error(`确认后未出现反馈：${settings.feedbackText}`))
        }, 3_000)
        const finishIfReady = () => {
          if (!workflow.textContent?.includes(settings.feedbackText)) return
          window.clearTimeout(deadline)
          observer.disconnect()
          resolve(performance.now())
        }
        const observer = new MutationObserver(finishIfReady)
        observer.observe(workflow, { childList: true, subtree: true, characterData: true })
        button.click()
        finishIfReady()
        const contentionUntil = performance.now() + (settings.postClickContentionMs || 0)
        while (performance.now() < contentionUntil) {
          // 模拟点击处理让出事件循环后，同线程被其他页面检查或浏览器任务占用。
        }
      })

      return {
        durationMs: feedbackAt - startedAt,
        activeField: document.activeElement?.getAttribute(settings.activeFieldAttribute) ?? null,
        rootStable: root.firstElementChild === rootChildBefore,
        workflowStable: document.querySelector(settings.workflowSelector) === workflowBefore,
        scrollBefore,
        scrollAfter: window.scrollY,
        workflowScrollBefore,
        workflowScrollAfter: workflow.scrollTop,
      }
    }, options)
  } finally {
    if (cpuSession) {
      await cpuSession.send('Emulation.setCPUThrottlingRate', { rate: 1 })
      await cpuSession.detach()
    }
  }
}

function expectLocalConfirmation(
  result: ConfirmResult,
  expectedField: string,
  label: string,
): void {
  expect(result.scrollBefore, `${label} 必须在非零页面滚动位置验证`).toBeGreaterThan(0)
  expect(result.workflowScrollBefore, `${label} 必须在非零工作区滚动位置验证`).toBeGreaterThan(0)
  expect(result.activeField, `${label} 必须聚焦替换后的真实输入框`).toBe(expectedField)
  expect(result.rootStable, `${label} 不得替换整页根内容`).toBe(true)
  expect(result.workflowStable, `${label} 不得替换工作区容器`).toBe(true)
  expect(result.scrollAfter, `${label} 不得改变页面滚动位置`).toBe(result.scrollBefore)
  expect(result.workflowScrollAfter, `${label} 不得改变工作区滚动位置`).toBe(
    result.workflowScrollBefore,
  )
  expect(result.durationMs, `${label} 响应必须低于 200ms`).toBeLessThan(200)
}

test('确认装袋成功后局部刷新并聚焦下一轮袋码', async ({ page }) => {
  const errors = collectPageErrors(page)
  await openPdaWorkflow(
    page,
    '/fcs/pda/cutting/inbound/TASK-CUT-PDA-CUT-DONE-0307?action=bagging',
    '[data-pda-cutting-inbound-workflow]',
  )
  await page.locator('[data-pda-cut-inbound-field="carrierCode"]').fill('BAG-001')
  await page.locator('[data-pda-cut-inbound-field="scanCode"]').fill('FT-CUT-260307-102-01-001')
  await page.locator('[data-pda-cut-inbound-field="scanCode"]').press('Enter')
  await expect(page.locator('[data-pda-cutting-inbound-workflow]')).toContainText(
    'FT-CUT-260307-102-01-001',
  )

  const result = await confirmWithoutBrowserAutoScroll(page, {
    workflowSelector: '[data-pda-cutting-inbound-workflow]',
    buttonSelector: '[data-pda-cut-inbound-action="confirm"]',
    feedbackText: '装袋成功',
    activeFieldAttribute: 'data-pda-cut-inbound-field',
  })
  console.log(`[PDA confirm] 装袋成功 ${result.durationMs.toFixed(1)}ms`)
  expectLocalConfirmation(result, 'carrierCode', '装袋成功')
  await expectNoPageErrors(errors)
})

test('确认装袋失败后局部刷新并聚焦菲票', async ({ page }) => {
  const errors = collectPageErrors(page)
  await openPdaWorkflow(
    page,
    '/fcs/pda/cutting/inbound/TASK-CUT-PDA-CUT-DONE-0307?action=bagging',
    '[data-pda-cutting-inbound-workflow]',
  )
  await setInputValueWithoutInputDispatch(
    page,
    '[data-pda-cut-inbound-field="carrierCode"]',
    'BAG-002',
  )

  const result = await confirmWithoutBrowserAutoScroll(page, {
    workflowSelector: '[data-pda-cutting-inbound-workflow]',
    buttonSelector: '[data-pda-cut-inbound-action="confirm"]',
    feedbackText: '请扫描菲票。',
    activeFieldAttribute: 'data-pda-cut-inbound-field',
  })
  console.log(`[PDA confirm] 装袋失败 ${result.durationMs.toFixed(1)}ms`)
  expectLocalConfirmation(result, 'scanCode', '装袋失败')
  await expectNoPageErrors(errors)
})

test('缺少中转袋时局部刷新并聚焦袋码', async ({ page }) => {
  const errors = collectPageErrors(page)
  await openPdaWorkflow(
    page,
    '/fcs/pda/cutting/inbound/TASK-CUT-PDA-CUT-DONE-0307?action=bagging',
    '[data-pda-cutting-inbound-workflow]',
  )
  const result = await confirmWithoutBrowserAutoScroll(page, {
    workflowSelector: '[data-pda-cutting-inbound-workflow]',
    buttonSelector: '[data-pda-cut-inbound-action="confirm"]',
    feedbackText: '请扫描中转袋。',
    activeFieldAttribute: 'data-pda-cut-inbound-field',
    postClickContentionMs: 0,
    cpuThrottlingRate: 4,
  })
  console.log(`[PDA confirm] 装袋袋码失败 ${result.durationMs.toFixed(1)}ms`)
  expectLocalConfirmation(result, 'carrierCode', '装袋袋码失败')
  await expectNoPageErrors(errors)
})

test('入仓扫描无效完整库位编号时局部反馈并保持库位扫码焦点', async ({ page }) => {
  const errors = collectPageErrors(page)
  await openPdaWorkflow(
    page,
    '/fcs/pda/cutting/inbound/TASK-CUT-PDA-CUT-DONE-0307?action=inbound-location',
    '[data-pda-cutting-inbound-workflow]',
  )
  const cpuSession = await page.context().newCDPSession(page)
  await cpuSession.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  const result = await page.evaluate(async () => {
    const root = document.querySelector<HTMLElement>('#app')
    const workflow = document.querySelector<HTMLElement>('[data-pda-cutting-inbound-workflow]')
    const input = workflow?.querySelector<HTMLInputElement>('[data-pda-cut-inbound-field="locationScan"]')
    if (!root?.firstElementChild || !workflow || !input) {
      throw new Error('扫码前未找到根节点、工作区或库位扫码框')
    }

    workflow.style.height = '180px'
    workflow.style.overflowY = 'auto'
    workflow.scrollTop = 80
    const spacer = document.createElement('div')
    spacer.dataset.testScrollSpacer = 'true'
    spacer.style.height = '1200px'
    document.body.append(spacer)
    window.scrollTo(0, 360)

    const rootChildBefore = root.firstElementChild
    const workflowBefore = workflow
    const scrollBefore = window.scrollY
    const workflowScrollBefore = workflow.scrollTop
    input.focus({ preventScroll: true })
    input.value = 'A-99-99-99'
    const startedAt = performance.now()
    const feedbackAt = await new Promise<number>((resolve, reject) => {
      const deadline = window.setTimeout(() => {
        observer.disconnect()
        reject(new Error('扫码后未出现反馈：库位不存在，请重新扫描。'))
      }, 3_000)
      const finishIfReady = () => {
        if (!workflow.textContent?.includes('库位不存在，请重新扫描。')) return
        window.clearTimeout(deadline)
        observer.disconnect()
        resolve(performance.now())
      }
      const observer = new MutationObserver(finishIfReady)
      observer.observe(workflow, { childList: true, subtree: true, characterData: true })
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      finishIfReady()
    })

    return {
      durationMs: feedbackAt - startedAt,
      activeField: document.activeElement?.getAttribute('data-pda-cut-inbound-field') ?? null,
      rootStable: root.firstElementChild === rootChildBefore,
      workflowStable: document.querySelector('[data-pda-cutting-inbound-workflow]') === workflowBefore,
      scrollBefore,
      scrollAfter: window.scrollY,
      workflowScrollBefore,
      workflowScrollAfter: workflow.scrollTop,
    }
  })
  await cpuSession.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  await cpuSession.detach()
  console.log(`[PDA confirm] 入仓库位扫码失败 ${result.durationMs.toFixed(1)}ms`)
  expectLocalConfirmation(result, 'locationScan', '入仓库位失败')
  await expectNoPageErrors(errors)
})

test('袋码 Enter 后自动带出全部任务并确认整袋交出', async ({ page }) => {
  test.setTimeout(120_000)
  const errors = collectPageErrors(page)
  await openPdaWorkflow(
    page,
    '/fcs/pda/cutting/handover/TASK-CUT-PDA-CUT-DONE-0307?action=transfer-bag-handover',
    '[data-pda-transfer-bag-handover-workflow]',
  )
  await seedInboundTransferBagLifecycle(page, 'E2E-TB-CUT-260730-001')
  await page.evaluate(() => {
    const bagInput = document.querySelector<HTMLInputElement>(
      '[data-pda-cut-handover-field="bagCode"]',
    )
    if (!bagInput) throw new Error('缺少整袋交出扫码输入框')
    bagInput.value = 'E2E-TB-CUT-260730-001'
    bagInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  })
  await expect(page.locator('[data-pda-transfer-bag-handover-workflow]')).toContainText(
    'CFRW-PO-202603-0102-01',
  )
  await expect(page.locator('[data-pda-transfer-bag-handover-workflow]')).toContainText('HiGood 印尼一厂')

  const result = await confirmWithoutBrowserAutoScroll(page, {
    workflowSelector: '[data-pda-transfer-bag-handover-workflow]',
    buttonSelector: '[data-pda-cut-handover-action="confirm-transfer-bag-handover"]',
    feedbackText: '交出成功',
    activeFieldAttribute: 'data-pda-cut-handover-field',
    postClickContentionMs: 0,
    cpuThrottlingRate: 4,
  })
  console.log(`[PDA confirm] 交出成功 ${result.durationMs.toFixed(1)}ms`)
  expectLocalConfirmation(result, 'bagCode', '交出成功')
  await expectNoPageErrors(errors)
})

test('确认交出缺少袋码时局部刷新并聚焦袋码', async ({ page }) => {
  const errors = collectPageErrors(page)
  await openPdaWorkflow(
    page,
    '/fcs/pda/cutting/handover/TASK-CUT-PDA-CUT-DONE-0307?action=transfer-bag-handover',
    '[data-pda-transfer-bag-handover-workflow]',
  )

  const result = await confirmWithoutBrowserAutoScroll(page, {
    workflowSelector: '[data-pda-transfer-bag-handover-workflow]',
    buttonSelector: '[data-pda-cut-handover-action="confirm-transfer-bag-handover"]',
    feedbackText: '请扫描中转袋。',
    activeFieldAttribute: 'data-pda-cut-handover-field',
    postClickContentionMs: 0,
    cpuThrottlingRate: 4,
  })
  console.log(`[PDA confirm] 交出袋码失败 ${result.durationMs.toFixed(1)}ms`)
  expectLocalConfirmation(result, 'bagCode', '交出袋码失败')
  await expectNoPageErrors(errors)
})

test('未知袋码交出失败后局部刷新并聚焦袋码', async ({ page }) => {
  const errors = collectPageErrors(page)
  await openPdaWorkflow(
    page,
    '/fcs/pda/cutting/handover/TASK-CUT-PDA-CUT-DONE-0307?action=transfer-bag-handover',
    '[data-pda-transfer-bag-handover-workflow]',
  )
  await page.locator('[data-pda-cut-handover-field="bagCode"]').fill('UNKNOWN-BAG')
  await page.locator('[data-pda-cut-handover-field="bagCode"]').press('Enter')
  await expect(page.locator('[data-pda-transfer-bag-handover-live]')).toContainText('没有找到这个中转袋')

  const result = await confirmWithoutBrowserAutoScroll(page, {
    workflowSelector: '[data-pda-transfer-bag-handover-workflow]',
    buttonSelector: '[data-pda-cut-handover-action="confirm-transfer-bag-handover"]',
    feedbackText: '没有找到这个中转袋',
    activeFieldAttribute: 'data-pda-cut-handover-field',
    postClickContentionMs: 220,
    cpuThrottlingRate: 4,
  })
  console.log(`[PDA confirm] 交出失败 ${result.durationMs.toFixed(1)}ms`)
  expectLocalConfirmation(result, 'bagCode', '交出失败')
  await expectNoPageErrors(errors)
})
