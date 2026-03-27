import { expect, test, type Page } from '@playwright/test'
import {
  initialSettlementBatches,
  listFactoryConfirmedStatementsEligibleForPrepayment,
} from '../src/data/fcs/store-domain-settlement-seeds.ts'

function buildPayeeSnapshotKey(statement: {
  settlementPartyId: string
  settlementCurrency?: string
  settlementProfileVersionNo: string
  settlementProfileSnapshot: { receivingAccountSnapshot: { bankAccountNo: string } }
}) {
  return [
    statement.settlementPartyId,
    statement.settlementCurrency ?? statement.settlementProfileSnapshot.receivingAccountSnapshot.bankAccountNo,
    statement.settlementProfileVersionNo,
    statement.settlementProfileSnapshot.receivingAccountSnapshot.bankAccountNo,
  ].join('::')
}

function getAvailablePrepaymentStatements() {
  const occupiedStatementIds = new Set(
    initialSettlementBatches
      .filter((batch) => batch.status !== 'CLOSED')
      .flatMap((batch) => batch.statementIds),
  )

  return listFactoryConfirmedStatementsEligibleForPrepayment().filter(
    (statement) => !occupiedStatementIds.has(statement.statementId),
  )
}

function getCreateBatchSample() {
  const available = getAvailablePrepaymentStatements()
  const grouped = new Map<string, typeof available>()

  for (const statement of available) {
    const key = buildPayeeSnapshotKey(statement)
    const current = grouped.get(key) ?? []
    current.push(statement)
    grouped.set(key, current)
  }

  const sameGroup = Array.from(grouped.values()).find((items) => items.length >= 2)
  if (!sameGroup) throw new Error('缺少可用于创建预付款批次的同工厂对账单样例')

  const crossFactory = available.find((statement) => statement.settlementPartyId !== sameGroup[0].settlementPartyId)
  if (!crossFactory) throw new Error('缺少跨工厂拦截样例')

  return {
    sameFactoryStatements: sameGroup.slice(0, 2),
    crossFactoryStatement: crossFactory,
  }
}

async function selectStatementRow(page: Page, statementNo: string) {
  const row = page.locator('tr').filter({ hasText: statementNo }).first()
  await expect(row).toBeVisible()
  await row.locator('input[type="checkbox"]').click()
}

async function createBatchThroughUi(page: Page) {
  const sample = getCreateBatchSample()
  await page.goto('/fcs/settlement/batches')

  await selectStatementRow(page, sample.sameFactoryStatements[0].statementNo ?? sample.sameFactoryStatements[0].statementId)
  await selectStatementRow(page, sample.crossFactoryStatement.statementNo ?? sample.crossFactoryStatement.statementId)
  await page.getByRole('button', { name: '创建预付款批次' }).click()
  await expect(page.locator('#batches-toast-root')).toContainText('预付款批次不能跨工厂组批')

  await selectStatementRow(page, sample.crossFactoryStatement.statementNo ?? sample.crossFactoryStatement.statementId)
  await page.locator('[data-batch-field="batchName"]').fill('阶段四预付款样例')
  await page.locator('[data-batch-field="remark"]').fill('用于校验飞书付款审批与打款回写')
  await page.getByRole('button', { name: '创建预付款批次' }).click()

  await expect(page.locator('body')).toContainText('阶段四预付款样例')
  await expect(page.locator('body')).toContainText('待申请付款')
  await expect(page.locator('body')).toContainText(sample.sameFactoryStatements[0].statementNo ?? sample.sameFactoryStatements[0].statementId)
  await expect(page.locator('body')).toContainText(sample.sameFactoryStatements[1].statementNo ?? sample.sameFactoryStatements[1].statementId)

  return sample
}

test('平台侧预付款批次页面按新口径渲染', async ({ page }) => {
  await page.goto('/fcs/settlement/batches')
  await expect(page.locator('body')).toContainText('预付款批次')
  await expect(page.locator('body')).toContainText('待申请/审批中')
  await expect(page.locator('body')).toContainText('飞书付款审批')
  await expect(page.locator('body')).not.toContainText('结算批次')
  await expect(page.locator('body')).not.toContainText('先 completed 再 payment')
})

test('预付款批次创建时拦截跨工厂对账单，并能成功创建同工厂批次', async ({ page }) => {
  const sample = await createBatchThroughUi(page)
  await expect(page.locator('body')).toContainText(sample.sameFactoryStatements[0].factoryName ?? sample.sameFactoryStatements[0].statementPartyView ?? '')
  await expect(page.locator('body')).toContainText('已选对账单列表')
  await expect(page.locator('body')).toContainText('预付总额')
})

test('预付款批次可完成申请付款、飞书状态同步与打款回写', async ({ page }) => {
  await createBatchThroughUi(page)

  await page.locator('footer [data-batch-action="apply-payment"]').click()
  await expect(page.locator('body')).toContainText('审批编号')
  await expect(page.locator('body')).toContainText('飞书审批中')
  await expect(page.locator('footer [data-batch-action="create-writeback"]')).toHaveCount(0)

  const bodyAfterApply = await page.locator('body').textContent()
  expect(bodyAfterApply).toMatch(/FPA-\d{6}-[A-Z0-9]{4}/)

  await page.locator('footer [data-batch-action="sync-approval"]').click()
  await expect(page.locator('body')).toContainText('最近同步')
  await expect(page.locator('footer [data-batch-action="create-writeback"]')).toHaveCount(0)

  await page.locator('footer [data-batch-action="sync-approval"]').click()
  await expect(page.locator('footer [data-batch-action="create-writeback"]')).toHaveCount(0)

  await page.locator('footer [data-batch-action="sync-approval"]').click()
  await expect(page.locator('body')).toContainText('已付款')
  await expect(page.locator('footer [data-batch-action="create-writeback"]')).toHaveCount(1)

  await page.locator('footer [data-batch-action="create-writeback"]').click()
  await expect(page.locator('body')).toContainText('打款回写信息')
  await expect(page.locator('body')).toContainText('银行回执')
  await expect(page.locator('body')).toContainText('银行流水号')
  await expect(page.locator('body')).toContainText('回写人')
  await expect(page.locator('body')).toContainText('已预付')
  await expect(page.locator('body')).toContainText('已完成打款回写')

  const bodyAfterWriteback = await page.locator('body').textContent()
  expect(bodyAfterWriteback).toMatch(/BSN-[A-Z0-9]{8}/)
  expect(bodyAfterWriteback).not.toContain('结算批次')
  expect(bodyAfterWriteback).not.toContain('先 completed 再 payment')
})
