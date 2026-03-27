import { expect, test } from '@playwright/test'
import { listPreSettlementLedgers } from '../src/data/fcs/pre-settlement-ledger-repository.ts'
import {
  listStatements,
  findOpenStatementByPartyAndCycle,
} from '../src/data/fcs/store-domain-settlement-seeds.ts'
import {
  buildStatementDraftLines,
  listStatementBuildScopes,
  listStatementEligibleLedgers,
} from '../src/data/fcs/store-domain-statement-source-adapter.ts'

function getBuildScopeSample() {
  const scope = listStatementBuildScopes().find(
    (item) =>
      item.earningLedgerCount > 0 &&
      item.deductionLedgerCount > 0 &&
      findOpenStatementByPartyAndCycle(item.settlementPartyId, item.settlementCycleId) == null,
  )
  if (!scope) throw new Error('缺少可用于生成预览的对账单样例')
  return scope
}

function getLateResolvedLedgerSample() {
  const statements = listStatements()
  const ledgers = listPreSettlementLedgers({ ledgerType: 'QUALITY_DEDUCTION' })
  for (const statement of statements) {
    const ledger = ledgers.find(
      (item) =>
        item.factoryId === statement.settlementPartyId &&
        item.settlementCycleId === statement.settlementCycleId &&
        item.status === 'OPEN' &&
        item.occurredAt > statement.createdAt &&
        !(statement.ledgerIds ?? []).includes(item.ledgerId),
    )
    if (ledger) {
      return { statement, ledger }
    }
  }
  throw new Error('缺少后裁决正式流水不回写旧单的样例')
}

test('平台侧对账单页面按正式流水汇总单渲染', async ({ page }) => {
  await page.goto('/fcs/settlement/statements')
  await expect(page.locator('body')).toContainText('对账单列表')
  await expect(page.locator('body')).toContainText('待入预付款')
  await expect(page.locator('body')).toContainText('本期应付净额')
  await expect(page.locator('body')).not.toContainText('应付调整')
  await expect(page.locator('body')).not.toContainText('其他调整')
  await expect(page.locator('body')).not.toContainText('跨周期调整')
  await expect(page.locator('body')).not.toContainText('回货净额行')
  await expect(page.locator('body')).not.toContainText('下周期调整')
  await expect(page.locator('body')).not.toContainText('冲回')
})

test('对账单生成预览按正式流水展示任务收入和质量扣款', async ({ page }) => {
  const scope = getBuildScopeSample()
  await page.goto('/fcs/settlement/statements')
  await page.getByRole('button', { name: '新建 / 编辑草稿' }).click()
  await page.locator('[data-stm-build-field=\"factory\"]').selectOption(scope.settlementPartyId)
  await page.locator('[data-stm-build-field=\"cycle\"]').selectOption(scope.settlementCycleId)

  await expect(page.locator('body')).toContainText('正式流水候选')
  await expect(page.locator('body')).toContainText('任务收入流水')
  await expect(page.locator('body')).toContainText('质量扣款流水')
  await expect(page.locator('body')).toContainText('任务收入流水合计')
  await expect(page.locator('body')).toContainText('质量扣款流水合计')
  await expect(page.locator('body')).toContainText('本期应付净额')
  await expect(page.locator('body')).not.toContainText('待确认质量扣款记录待入单')
  await expect(page.locator('body')).not.toContainText('未裁决质量异议已计入本期')
})

test('对账单详情按正式流水分段展示，并且后裁决流水不会回写旧单', async ({ page }) => {
  const scope = getBuildScopeSample()
  const buildCandidates = listStatementEligibleLedgers(scope.settlementPartyId, scope.settlementCycleId)
  const buildLines = buildStatementDraftLines(scope.settlementPartyId, scope.settlementCycleId)
  const taskLine = buildLines.find((item) => item.sourceItemType === 'TASK_EARNING')
  const qualityLine = buildLines.find((item) => item.sourceItemType === 'QUALITY_DEDUCTION')
  if (!taskLine || !qualityLine) throw new Error('缺少对账单详情校验样例')

  await page.goto('/fcs/settlement/statements')
  await page.getByRole('button', { name: '新建 / 编辑草稿' }).click()
  await page.locator('[data-stm-build-field=\"factory\"]').selectOption(scope.settlementPartyId)
  await page.locator('[data-stm-build-field=\"cycle\"]').selectOption(scope.settlementCycleId)
  await page.getByRole('button', { name: '确认生成草稿' }).click()

  await expect(page.locator('body')).toContainText('对账单详情')
  await expect(page.locator('body')).toContainText('任务收入流水明细')
  await expect(page.locator('body')).toContainText('质量扣款流水明细')
  await expect(page.locator('body')).toContainText(taskLine.taskNo ?? '')
  await expect(page.locator('body')).toContainText(taskLine.returnInboundBatchNo ?? '')
  await expect(page.locator('body')).toContainText(qualityLine.qcRecordId ?? '')
  await expect(page.locator('body')).toContainText(qualityLine.pendingDeductionRecordId ?? '')

  const { statement, ledger } = getLateResolvedLedgerSample()
  const futureCandidates = listStatementEligibleLedgers(statement.settlementPartyId, statement.settlementCycleId ?? '')
  expect(futureCandidates.some((item) => item.sourceItemId === ledger.ledgerId)).toBeTruthy()
  await page.locator('[data-stm-action=\"close-detail\"]').nth(1).click()
  await page.locator('[data-stm-list-filter=\"keyword\"]').fill(statement.statementNo ?? statement.statementId)
  const row = page.locator('tbody tr').filter({ hasText: statement.statementNo ?? statement.statementId }).first()
  await row.getByRole('button', { name: '查看详情' }).click()
  await expect(page.locator('body')).not.toContainText(ledger.ledgerNo)
  await page.locator('[data-stm-action=\"close-detail\"]').nth(1).click()

  await page.getByRole('button', { name: '新建 / 编辑草稿' }).click()
  await page.locator('[data-stm-build-field=\"factory\"]').selectOption(statement.settlementPartyId)
  await page.locator('[data-stm-build-field=\"cycle\"]').selectOption(statement.settlementCycleId ?? '')
  await expect(page.locator('body')).toContainText('已存在未关闭对账单')

  await expect(page.locator('body')).toContainText(ledger.ledgerNo)
  const futureQualityCandidate = futureCandidates.find((item) => item.sourceType === 'QUALITY_DEDUCTION')
  if (futureQualityCandidate) {
    await expect(page.locator('body')).toContainText(
      futureQualityCandidate.ledgerNo ?? futureQualityCandidate.sourceItemId,
    )
  }
})
