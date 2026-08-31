import { expect, test, type Page, type TestInfo } from '@playwright/test'

import { listSpecialCraftTaskOrders } from '../src/data/fcs/special-craft-task-orders.ts'
import { collectPageErrors, expectNoPageErrors } from './helpers/seed-cutting-runtime-state'

test.setTimeout(120_000)

const buttonLoopTask = listSpecialCraftTaskOrders().find((item) =>
  item.operationName === '盘扣'
  && item.quantityMode === 'TICKET_INPUT_OUTPUT'
  && (item.buttonLoopInputLines?.length || 0) > 0,
)

if (!buttonLoopTask) throw new Error('盘扣验收缺少真实生产单生成的加工单')

const BUTTON_LOOP_LIST_PATH = '/fcs/process-factory/special-craft/aux-op-button-loop/work-orders'
const BUTTON_LOOP_DETAIL_PATH = `/fcs/process-factory/special-craft/aux-op-button-loop/work-orders/${encodeURIComponent(buttonLoopTask.taskOrderId)}`
const BUTTON_LOOP_PDA_PATH = `/fcs/pda/exec/SPECIAL_CRAFT/${encodeURIComponent(buttonLoopTask.taskOrderId)}`
const TECH_PACK_PATH = '/pcs/products/styles/style_demand_SPU_2024_009/technical-data/tdv_demand_SPU_2024_009'
const EDITABLE_TECH_PACK_PATH = '/pcs/products/styles/style_seed_project_018/technical-data/tdv_seed_project_018_review_skip_demo'

const APF_PDA_SESSION = {
  userId: 'FAC-APF_operator',
  loginId: 'FAC-APF_operator',
  userName: 'APF_-_操作工',
  roleId: 'ROLE_OPERATOR',
  factoryId: 'FAC-APF',
  factoryName: 'APF - 辅助工艺',
  loggedAt: '2026-08-20 09:00:00',
}

async function saveEvidence(page: Page, testInfo: TestInfo, filename: string): Promise<void> {
  await page.screenshot({ path: testInfo.outputPath(filename), fullPage: true })
}

async function navigateInApp(page: Page, path: string): Promise<void> {
  await page.evaluate((nextPath) => {
    window.history.pushState({}, '', nextPath)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
}

test('管理端、技术包、加工单、捆条菲票打印和辅料仓形成可见闭环', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page)

  await page.goto('/fcs/production/craft-dict')
  for (const craftName of ['盘扣', '花朵', '打褶', '烫钻']) {
    await expect(page.locator('body')).toContainText(craftName)
  }
  await expect(page.locator('body')).toContainText('捆条')
  await expect(page.locator('body')).toContainText('裁片部位')

  await page.goto(TECH_PACK_PATH)
  await expect(page.locator('body')).toContainText('捆条 2 条', { timeout: 30_000 })
  await page.getByRole('button', { name: '查看纸样包' }).first().click()
  await expect(page.getByRole('heading', { name: '纸样详情' })).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('body')).toContainText('领口包边捆条')
  await expect(page.locator('body')).toContainText('前襟盘扣捆条')
  await expect(page.getByText('盘扣 · 黄色菲票', { exact: true })).toHaveCount(1)
  await saveEvidence(page, testInfo, '01-tech-pack-binding-strips.png')

  await page.locator('[data-tech-action="close-pattern-detail"]').dispatchEvent('click')
  await expect(page.getByRole('heading', { name: '纸样详情' })).toHaveCount(0)
  await page.goto(EDITABLE_TECH_PACK_PATH)
  await expect(page.getByRole('button', { name: '纸样管理', exact: true })).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: '工序工艺', exact: true }).click()
  await page.getByRole('button', { name: '新增生产阶段工序', exact: true }).click()
  const techniqueDialog = page.getByTestId('tech-pack-technique-form-dialog')
  await techniqueDialog.locator('[data-tech-field="new-technique-process-code"]').selectOption({ label: '特殊工艺' })
  await techniqueDialog.locator('[data-tech-field="new-technique-craft-code"]').selectOption({ label: '盘扣' })
  await expect(techniqueDialog).toContainText('捆条')
  await techniqueDialog.getByRole('button', { name: '确认新增', exact: true }).click()
  await page.getByRole('button', { name: '确认工艺路线', exact: true }).click()
  await expect(page.locator('body')).toContainText('路线已确认')
  await page.getByRole('button', { name: '纸样管理', exact: true }).click()
  await page.getByRole('button', { name: '编辑纸样包' }).first().click()
  await expect(page.getByRole('heading', { name: '编辑纸样包' })).toBeVisible({ timeout: 30_000 })
  const bindingStripEditor = page.getByTestId('pattern-binding-strip-section')
  await expect(bindingStripEditor).toContainText('每条捆条独立选择是否用于盘扣')
  const bindingStripRows = bindingStripEditor.getByTestId('binding-strip-row')
  while ((await bindingStripRows.count()) < 2) {
    await bindingStripEditor.getByRole('button', { name: '添加捆条', exact: true }).click()
  }
  await expect(bindingStripRows).toHaveCount(2)
  const buttonLoopToggles = bindingStripEditor.locator('[data-tech-action="toggle-binding-strip-button-loop"]')
  await expect(buttonLoopToggles).toHaveCount(2)
  await expect(buttonLoopToggles.nth(0)).toHaveAttribute('aria-pressed', 'false')
  await expect(buttonLoopToggles.nth(1)).toHaveAttribute('aria-pressed', 'false')
  await buttonLoopToggles.nth(1).click()
  await expect(buttonLoopToggles.nth(0)).toHaveAttribute('aria-pressed', 'false')
  await expect(buttonLoopToggles.nth(1)).toHaveAttribute('aria-pressed', 'true')
  await buttonLoopToggles.nth(0).click()
  await expect(buttonLoopToggles.nth(0)).toHaveAttribute('aria-pressed', 'true')
  await expect(buttonLoopToggles.nth(1)).toHaveAttribute('aria-pressed', 'true')
  await buttonLoopToggles.nth(0).click()
  await expect(buttonLoopToggles.nth(0)).toHaveAttribute('aria-pressed', 'false')
  await expect(buttonLoopToggles.nth(1)).toHaveAttribute('aria-pressed', 'true')
  await bindingStripEditor.screenshot({ path: testInfo.outputPath('01b-tech-pack-binding-strip-editor.png') })
  await page.locator('[data-tech-action="close-add-pattern"]').dispatchEvent('click')
  await expect(page.getByRole('heading', { name: '编辑纸样包' })).toHaveCount(0)

  await page.goto(BUTTON_LOOP_LIST_PATH)
  await expect(page.getByRole('heading', { name: '盘扣加工单' })).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('body')).toContainText(buttonLoopTask.taskOrderNo)
  await expect(page.locator('body')).toContainText('盘扣捆条菲票')
  await expect(page.locator('body')).toContainText('APF - 辅助工艺')

  await page.goto(BUTTON_LOOP_DETAIL_PATH)
  await expect(page.locator('body')).toContainText('捆条投入与盘扣产出')
  await expect(page.locator('body')).toContainText('投入按捆条菲票张数追溯')
  await expect(page.locator('body')).toContainText('中央辅料仓')
  await page.getByRole('button', { name: '确认接收', exact: true }).click()
  await expect(page.locator('#special-craft-button-loop-dialog')).toContainText('逐张核对捆条菲票')
  await expect(page.locator('#special-craft-button-loop-dialog')).toContainText('投入单位为张')
  await expect(page.locator('#special-craft-button-loop-dialog input[type="checkbox"]')).toHaveCount(buttonLoopTask.inputTicketCount || 0)
  await page.locator('[data-special-craft-button-loop-confirm]').click()
  await expect(page.locator('#special-craft-button-loop-dialog')).toHaveCount(0)
  for (const actionName of ['加工填报', '发起交出', '完成加工单']) {
    await expect(page.getByRole('button', { name: actionName, exact: true })).toBeVisible()
  }
  await saveEvidence(page, testInfo, '02-web-button-loop-task.png')

  await page.goto('/fcs/craft/cutting/binding-fei-tickets')
  await expect(page.getByTestId('binding-fei-ticket-print-workbench')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('body')).toContainText('普通白票')
  await expect(page.locator('body')).toContainText('盘扣黄票')
  const yellowPrintEntry = page.locator('[data-nav*="paperColor=YELLOW"]').first()
  const whitePrintEntry = page.locator('[data-nav*="paperColor=WHITE"]').first()
  await expect(yellowPrintEntry).toBeVisible()
  await expect(whitePrintEntry).toBeVisible()
  const yellowPrintPath = await yellowPrintEntry.getAttribute('data-nav')
  expect(yellowPrintPath).toBeTruthy()
  await page.goto(yellowPrintPath!)
  await expect(page.locator('[data-thermal-paper-color="YELLOW"]')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('body')).toContainText('盘扣')
  await expect(page.locator('body')).toContainText('APF - 辅助工艺')
  await expect(page.locator('body')).toContainText('中央辅料仓')
  const yellowLabelBox = await page.locator('article.print-label-paper.label-paper-label-100-100').boundingBox()
  expect(yellowLabelBox).toBeTruthy()
  expect(yellowLabelBox!.width).toBeGreaterThan(370)
  expect(yellowLabelBox!.width).toBeLessThan(385)
  expect(yellowLabelBox!.height).toBeGreaterThan(370)
  expect(yellowLabelBox!.height).toBeLessThan(385)
  await saveEvidence(page, testInfo, '03-button-loop-yellow-fei-ticket.png')

  await navigateInApp(page, '/wls/accessory-receipts')
  await expect(page.getByRole('heading', { name: '中央辅料仓收货' })).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('body')).toContainText('盘扣成品收货')
  await expect(page.locator('body')).toContainText('收货与库存单位均为“个”')
  await saveEvidence(page, testInfo, '04-central-accessory-warehouse.png')

  expectNoPageErrors(errors)
})

test('PDA 交接与执行按现场职责完成盘扣全流程', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page)
  await page.addInitScript((session) => {
    window.localStorage.setItem('fcs_pda_session', JSON.stringify(session))
  }, APF_PDA_SESSION)

  await page.goto(`${BUTTON_LOOP_PDA_PATH}?surface=handover&handoverAction=receive`)
  await expect(page.locator('[data-pda-special-craft-detail]')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('body')).toContainText('交接 · 确认接收')
  await expect(page.locator('body')).toContainText('投入捆条')
  await expect(page.locator('body')).toContainText('待确认接收')
  await expect(page.getByRole('button', { name: '确认接收捆条', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '加工填报', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '确认接收捆条', exact: true }).click()
  await expect(page.locator('body')).toContainText(/特殊工艺确认接收已同步|已确认接收/)

  await navigateInApp(page, BUTTON_LOOP_PDA_PATH)
  await expect(page.locator('body')).toContainText('执行 · 加工填报')
  await expect(page.getByRole('button', { name: '加工填报', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '发起交出', exact: true })).toHaveCount(0)
  await expect(page.locator('[data-special-craft-line-progress-summary]')).toHaveCount(0)
  await page.locator('[data-pda-execd-field="specialCraftButtonLoopQty"]').fill('24')
  await page.getByRole('button', { name: '加工填报', exact: true }).click()
  await expect(page.locator('body')).toContainText(/特殊工艺加工填报已同步|累计产出：24 个/)
  await saveEvidence(page, testInfo, '05-pda-button-loop-process-report.png')

  await navigateInApp(page, `${BUTTON_LOOP_PDA_PATH}?surface=handover&handoverAction=handout`)
  await expect(page.locator('body')).toContainText('交接 · 发起交出')
  await expect(page.getByRole('button', { name: '发起交出', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '完成加工单', exact: true })).toHaveCount(0)
  await page.locator('[data-pda-execd-field="specialCraftButtonLoopQty"]').fill('10')
  await page.getByRole('button', { name: '发起交出', exact: true }).click()
  await expect(page.locator('body')).toContainText(/特殊工艺发起交出已同步|已交出／待交出：10 \/ 14 个/)
  await saveEvidence(page, testInfo, '06-pda-button-loop-handover.png')

  await navigateInApp(page, '/wls/accessory-receipts')
  await expect(page.locator('[data-wls-button-loop-receipts]')).toContainText('10 个')
  await page.getByRole('button', { name: '确认全部收货', exact: true }).click()
  await expect(page.locator('[data-wls-button-loop-receipts]')).toContainText('已收货 10 个')

  await navigateInApp(page, `${BUTTON_LOOP_PDA_PATH}?surface=handover&handoverAction=handout`)
  await page.locator('[data-pda-execd-field="specialCraftButtonLoopQty"]').fill('14')
  await page.getByRole('button', { name: '发起交出', exact: true }).click()
  await expect(page.locator('body')).toContainText(/特殊工艺发起交出已同步|已交出／待交出：24 \/ 0 个/)

  await navigateInApp(page, BUTTON_LOOP_PDA_PATH)
  await expect(page.getByRole('button', { name: '完成加工单', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '完成加工单', exact: true }).click()
  await expect(page.locator('body')).toContainText(/特殊工艺完成加工单已同步|已完结/)
  await expect(page.locator('body')).toContainText('交出去向：中央辅料仓')
  await saveEvidence(page, testInfo, '07-pda-button-loop-complete.png')

  await navigateInApp(page, '/wls/accessory-receipts')
  await expect(page.locator('[data-wls-button-loop-receipts]')).toContainText(buttonLoopTask.taskOrderNo, { timeout: 30_000 })
  await expect(page.locator('[data-wls-button-loop-receipts]')).toContainText('24 个')
  await expect(page.locator('[data-wls-button-loop-receipts]')).toContainText('已收货 10 个 / 待收货 14 个')
  await page.getByRole('button', { name: '确认新增收货（14 个）', exact: true }).click()
  await expect(page.locator('[data-wls-button-loop-receipts]')).toContainText('已收货 24 个')
  await expect(page.locator('body')).toContainText('盘扣成品 24 个已确认进入中央辅料仓')
  await saveEvidence(page, testInfo, '08-central-accessory-warehouse-received.png')

  expectNoPageErrors(errors)
})
