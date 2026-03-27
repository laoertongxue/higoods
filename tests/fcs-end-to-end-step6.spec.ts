import { expect, test, type Page } from '@playwright/test'
import { indonesiaFactories } from '../src/data/fcs/indonesia-factories.ts'
import { listPreSettlementLedgers } from '../src/data/fcs/pre-settlement-ledger-repository.ts'
import { listFutureMobileFactoryQcBuckets } from '../src/data/fcs/quality-deduction-selectors.ts'
import { getSettlementEffectiveInfoByFactory } from '../src/data/fcs/settlement-change-requests.ts'
import {
  initialSettlementBatches,
  listFactoryConfirmedStatementsEligibleForPrepayment,
  listFeishuPaymentApprovals,
  listPaymentWritebacks,
  listSettlementBatchesByParty,
  listSettlementStatementsByParty,
  listStatements,
} from '../src/data/fcs/store-domain-settlement-seeds.ts'
import { deriveSettlementCycleFields } from '../src/data/fcs/store-domain-statement-grain.ts'

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

function getMixedStatementSample() {
  const statement = listStatements().find(
    (item) => (item.earningLedgerIds?.length ?? 0) > 0 && (item.deductionLedgerIds?.length ?? 0) > 0,
  )
  if (!statement) throw new Error('缺少用于对账单全链联调的正式流水混合样例')
  return statement
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

function getQualityCycleSample() {
  for (const factory of indonesiaFactories) {
    const qcBuckets = listFutureMobileFactoryQcBuckets(factory.id)
    const qcItems = [...qcBuckets.pending, ...qcBuckets.disputing, ...qcBuckets.processed]
    const ledgerMap = new Map<
      string,
      {
        taskLedgerNo?: string
        qualityLedgerNo?: string
        pendingQcNo?: string
        disputingQcNo?: string
        statementNo?: string
        snapshotMismatch: boolean
      }
    >()

    for (const ledger of listPreSettlementLedgers({ factoryId: factory.id })) {
      const current = ledgerMap.get(ledger.settlementCycleId) ?? { snapshotMismatch: false }
      if (ledger.ledgerType === 'TASK_EARNING' && !current.taskLedgerNo) current.taskLedgerNo = ledger.ledgerNo
      if (ledger.ledgerType === 'QUALITY_DEDUCTION' && !current.qualityLedgerNo) current.qualityLedgerNo = ledger.ledgerNo
      ledgerMap.set(ledger.settlementCycleId, current)
    }

    for (const item of qcItems) {
      const cycleId = deriveSettlementCycleFields(factory.id, item.inspectedAt).settlementCycleId
      const current = ledgerMap.get(cycleId) ?? { snapshotMismatch: false }
      if (qcBuckets.pending.some((candidate) => candidate.qcId === item.qcId) && !current.pendingQcNo) current.pendingQcNo = item.qcNo
      if (qcBuckets.disputing.some((candidate) => candidate.qcId === item.qcId) && !current.disputingQcNo) current.disputingQcNo = item.qcNo
      ledgerMap.set(cycleId, current)
    }

    for (const statement of listSettlementStatementsByParty(factory.id)) {
      const current = ledgerMap.get(statement.settlementCycleId) ?? { snapshotMismatch: false }
      if (!current.statementNo) current.statementNo = statement.statementNo ?? statement.statementId
      const effective = getSettlementEffectiveInfoByFactory(factory.code)
      current.snapshotMismatch = Boolean(effective && effective.versionNo !== statement.settlementProfileVersionNo)
      ledgerMap.set(statement.settlementCycleId, current)
    }

    const match = Array.from(ledgerMap.entries()).find(([, value]) => {
      return Boolean(value.taskLedgerNo && value.qualityLedgerNo && value.pendingQcNo && value.disputingQcNo && value.statementNo)
    })

    if (match) {
      return {
        factory,
        cycleId: match[0],
        taskLedgerNo: match[1].taskLedgerNo!,
        qualityLedgerNo: match[1].qualityLedgerNo!,
        pendingQcNo: match[1].pendingQcNo!,
        disputingQcNo: match[1].disputingQcNo!,
        statementNo: match[1].statementNo!,
        snapshotMismatch: match[1].snapshotMismatch,
      }
    }
  }

  throw new Error('缺少可用于工厂端最终联调的质量 / 正式流水混合样例')
}

function getPrepaidCycleSample() {
  for (const factory of indonesiaFactories) {
    const batches = listSettlementBatchesByParty(factory.id)
    const statements = listSettlementStatementsByParty(factory.id)
    for (const batch of batches) {
      const approval = listFeishuPaymentApprovals(batch.batchId)[0]
      const writeback = listPaymentWritebacks(batch.batchId)[0]
      const statement = statements.find((item) => batch.statementIds.includes(item.statementId))
      if (approval && writeback && statement) {
        return {
          factory,
          cycleId: statement.settlementCycleId,
          statementNo: statement.statementNo ?? statement.statementId,
          batchNo: batch.batchNo ?? batch.batchId,
          approvalNo: approval.approvalNo,
          bankReceiptName: writeback.bankReceiptName,
          bankSerialNo: writeback.bankSerialNo,
        }
      }
    }
  }

  throw new Error('缺少已进入预付款并已回写打款结果的样例')
}

async function openSettlementAsFactory(page: Page, factoryId: string, path = '/fcs/pda/settlement') {
  try {
    await page.goto('/')
  } catch {
    await page.waitForTimeout(500)
    await page.goto('/')
  }
  await page.evaluate((value) => window.localStorage.setItem('fcs_pda_factory_id', value), factoryId)
  await page.goto(path)
}

async function selectStatementRow(page: Page, statementNo: string) {
  const row = page.locator('tr').filter({ hasText: statementNo }).first()
  await expect(row).toBeVisible()
  await row.locator('input[type="checkbox"]').click()
}

test('平台侧预结算流水与对账单页面按最终正式流水口径渲染', async ({ page }) => {
  const mixedStatement = getMixedStatementSample()

  await page.goto('/fcs/settlement/adjustments')
  await expect(page.locator('body')).toContainText('预结算流水')
  await expect(page.locator('body')).toContainText('任务收入流水')
  await expect(page.locator('body')).toContainText('质量扣款流水')
  await expect(page.locator('body')).not.toContainText('应付调整')
  await expect(page.locator('body')).not.toContainText('下周期调整')
  await expect(page.locator('body')).not.toContainText('冲回')

  await page.goto('/fcs/settlement/statements')
  await expect(page.locator('body')).toContainText('对账单列表')
  await expect(page.locator('body')).toContainText('本期应付净额')
  await page.locator('[data-stm-list-filter="keyword"]').fill(mixedStatement.statementNo ?? mixedStatement.statementId)
  const row = page.locator('tbody tr').filter({ hasText: mixedStatement.statementNo ?? mixedStatement.statementId }).first()
  await row.getByRole('button', { name: '查看详情' }).click()
  await expect(page.locator('body')).toContainText('任务收入流水明细')
  await expect(page.locator('body')).toContainText('质量扣款流水明细')
  await expect(page.locator('body')).toContainText('正向金额')
  await expect(page.locator('body')).toContainText('反向金额')
  await expect(page.locator('body')).toContainText('本期应付净额')
  await expect(page.locator('body')).not.toContainText('回货净额行')
  await expect(page.locator('body')).not.toContainText('未裁决质量异议已计入本期')
})

test('平台侧预付款链可完成建批、飞书审批与打款回写', async ({ page }) => {
  const sample = getCreateBatchSample()
  await page.goto('/fcs/settlement/batches')

  await expect(page.locator('body')).toContainText('预付款批次')
  await selectStatementRow(page, sample.sameFactoryStatements[0].statementNo ?? sample.sameFactoryStatements[0].statementId)
  await selectStatementRow(page, sample.crossFactoryStatement.statementNo ?? sample.crossFactoryStatement.statementId)
  await page.getByRole('button', { name: '创建预付款批次' }).click()
  await expect(page.locator('#batches-toast-root')).toContainText('预付款批次不能跨工厂组批')

  await selectStatementRow(page, sample.crossFactoryStatement.statementNo ?? sample.crossFactoryStatement.statementId)
  await selectStatementRow(page, sample.sameFactoryStatements[1].statementNo ?? sample.sameFactoryStatements[1].statementId)
  await page.locator('[data-batch-field="batchName"]').fill('第六步全链联调批次')
  await page.locator('[data-batch-field="remark"]').fill('用于校验最终预付款审批与打款回写')
  await page.getByRole('button', { name: '创建预付款批次' }).click()

  await expect(page.locator('body')).toContainText('第六步全链联调批次')
  await page.locator('footer [data-batch-action="apply-payment"]').click()
  await expect(page.locator('body')).toContainText('审批编号')
  await expect(page.locator('body')).toContainText('飞书审批中')
  await expect(page.locator('footer [data-batch-action="create-writeback"]')).toHaveCount(0)

  const bodyAfterApply = await page.locator('body').textContent()
  expect(bodyAfterApply).toMatch(/FPA-\d{6}-[A-Z0-9]{4}/)

  await page.locator('footer [data-batch-action="sync-approval"]').click()
  await expect(page.locator('body')).toContainText('最近同步')
  await page.locator('footer [data-batch-action="sync-approval"]').click()
  await page.locator('footer [data-batch-action="sync-approval"]').click()
  await expect(page.locator('body')).toContainText('已付款')
  await expect(page.locator('footer [data-batch-action="create-writeback"]')).toHaveCount(1)

  await page.locator('footer [data-batch-action="create-writeback"]').click()
  await expect(page.locator('body')).toContainText('打款回写信息')
  await expect(page.locator('body')).toContainText('银行回执')
  await expect(page.locator('body')).toContainText('银行流水号')
  await expect(page.locator('body')).toContainText('已预付')

  const bodyAfterWriteback = await page.locator('body').textContent()
  expect(bodyAfterWriteback).toMatch(/BSN-[A-Z0-9]{8}/)
  expect(bodyAfterWriteback).not.toContain('结算批次')
  expect(bodyAfterWriteback).not.toContain('先 completed 再 payment')
})

test('工厂端移动应用按最终口径消费质量链、预付款链与资料快照版本差异', async ({ page }) => {
  const qualitySample = getQualityCycleSample()
  const prepaymentSample = getPrepaidCycleSample()

  await openSettlementAsFactory(page, qualitySample.factory.id)
  await expect(page.locator('body')).toContainText('结算周期')
  await expect(page.locator('body')).toContainText('结算资料')

  await page.goto(`/fcs/pda/settlement?tab=quality&cycleId=${encodeURIComponent(qualitySample.cycleId)}`)
  await expect(page.locator('body')).toContainText('质检扣款')
  await expect(page.locator('body')).toContainText(qualitySample.pendingQcNo)
  await page.getByRole('button', { name: /异议中/ }).click()
  await expect(page.locator('body')).toContainText(qualitySample.disputingQcNo)
  await expect(page.locator('body')).not.toContainText('未最终裁决的质量异议已形成正式流水')
  const qualityDetailHref = await page.getByRole('button', { name: '查看质检详情' }).first().getAttribute('data-nav')
  expect(qualityDetailHref).toMatch(/\/fcs\/pda\/quality\//)
  await page.goto(`http://127.0.0.1:4173${qualityDetailHref}`)
  await expect(page).toHaveURL(/\/fcs\/pda\/quality\//)

  await openSettlementAsFactory(page, qualitySample.factory.id, `/fcs/pda/settlement?tab=ledgers&cycleId=${encodeURIComponent(qualitySample.cycleId)}`)
  await expect(page.locator('body')).toContainText('正式流水查看区')
  await expect(page.locator('body')).toContainText(qualitySample.taskLedgerNo)
  await expect(page.locator('body')).toContainText(qualitySample.qualityLedgerNo)

  const taskLedgerCard = page.locator('article').filter({ hasText: qualitySample.taskLedgerNo }).first()
  await taskLedgerCard.getByRole('button', { name: '查看流水' }).click()
  await expect(page.locator('body')).toContainText('任务号')
  await expect(page.locator('body')).toContainText('回货批次')
  await expect(page.locator('body')).toContainText('价格来源')
  await page.locator('[data-pda-sett-action="close-ledger-drawer"]').first().click()

  const qualityLedgerCard = page.locator('article').filter({ hasText: qualitySample.qualityLedgerNo }).first()
  await qualityLedgerCard.getByRole('button', { name: '查看流水' }).click()
  await expect(page.locator('body')).toContainText('质检记录号')
  await expect(page.locator('body')).toContainText('待确认质量扣款记录号')
  await expect(page.locator('body')).toContainText('质量异议单号')
  await page.locator('[data-pda-sett-action="close-ledger-drawer"]').first().click()

  await openSettlementAsFactory(page, prepaymentSample.factory.id, `/fcs/pda/settlement?tab=statements&cycleId=${encodeURIComponent(prepaymentSample.cycleId)}`)
  await expect(page.locator('body')).toContainText('对账与预付款')
  await expect(page.locator('body')).toContainText(prepaymentSample.statementNo)
  await expect(page.locator('body')).toContainText(prepaymentSample.batchNo)
  await expect(page.locator('body')).toContainText(prepaymentSample.approvalNo)
  await expect(page.locator('body')).toContainText(prepaymentSample.bankReceiptName)
  await expect(page.locator('body')).toContainText(prepaymentSample.bankSerialNo)
  await expect(page.getByRole('button', { name: '创建预付款批次' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '申请付款' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '创建打款回写' })).toHaveCount(0)

  await openSettlementAsFactory(page, qualitySample.factory.id, `/fcs/pda/settlement?tab=overview&cycleId=${encodeURIComponent(qualitySample.cycleId)}`)
  await page.locator('[data-pda-sett-action="open-settlement-profile"]').first().click()
  await expect(page.locator('body')).toContainText('当前生效资料')
  await expect(page.locator('body')).toContainText('历史申请')
  await expect(page.locator('body')).toContainText('版本沿革')
  await expect(page.locator('body')).toContainText('当前周期资料快照版本')
  if (qualitySample.snapshotMismatch) {
    await expect(page.locator('body')).toContainText('新版本用于后续新单据，本期已生成单据继续沿用原快照')
  }

  await expect(page.locator('body')).not.toContainText('应付调整')
  await expect(page.locator('body')).not.toContainText('下周期调整')
  await expect(page.locator('body')).not.toContainText('冲回')
  await expect(page.locator('body')).not.toContainText('其它扣款')
})
