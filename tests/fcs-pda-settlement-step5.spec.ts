import { expect, test, type Page } from '@playwright/test'
import { indonesiaFactories } from '../src/data/fcs/indonesia-factories.ts'
import { listFutureMobileFactoryQcBuckets } from '../src/data/fcs/quality-deduction-selectors.ts'
import { listPreSettlementLedgers } from '../src/data/fcs/pre-settlement-ledger-repository.ts'
import {
  listFeishuPaymentApprovals,
  listPaymentWritebacks,
  listSettlementBatchesByParty,
  listSettlementStatementsByParty,
} from '../src/data/fcs/store-domain-settlement-seeds.ts'
import { deriveSettlementCycleFields } from '../src/data/fcs/store-domain-statement-grain.ts'
import { getSettlementEffectiveInfoByFactory } from '../src/data/fcs/settlement-change-requests.ts'

async function openSettlementAsFactory(page: Page, factoryId: string, path = '/fcs/pda/settlement') {
  await page.goto('/')
  await page.evaluate((value) => window.localStorage.setItem('fcs_pda_factory_id', value), factoryId)
  await page.goto(path)
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

  throw new Error('缺少可用于工厂端结算页的质量 / 正式流水混合样例')
}

function getPrepaymentCycleSample() {
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

test('工厂端结算默认显示周期列表并保留结算资料入口', async ({ page }) => {
  const sample = getQualityCycleSample()
  await openSettlementAsFactory(page, sample.factory.id)

  await expect(page.locator('body')).toContainText('结算周期')
  await expect(page.locator('body')).toContainText('结算资料')
  await expect(page.locator('body')).toContainText('任务收入正式流水金额')
  await expect(page.locator('body')).toContainText('质量扣款正式流水金额')
  await expect(page.locator('body')).not.toContainText('应付调整')
  await expect(page.locator('body')).not.toContainText('下周期调整')
  await expect(page.locator('body')).not.toContainText('冲回')
})

test('工厂端周期详情可在质检扣款与正式流水间切换，并兼容旧 query', async ({ page }) => {
  const sample = getQualityCycleSample()
  await openSettlementAsFactory(page, sample.factory.id, `/fcs/pda/settlement?tab=overview&cycleId=${encodeURIComponent(sample.cycleId)}`)

  await expect(page.locator('body')).toContainText('总览')
  await expect(page.locator('body')).toContainText('质检扣款')
  await expect(page.locator('body')).toContainText('正式流水')
  await expect(page.locator('body')).toContainText('对账与预付款')

  await page.goto(`/fcs/pda/settlement?tab=tasks&cycleId=${encodeURIComponent(sample.cycleId)}`)
  await expect(page.locator('body')).toContainText('正式流水查看区')
  await expect(page.locator('body')).toContainText(sample.taskLedgerNo)

  await page.goto(`/fcs/pda/settlement?tab=deductions&cycleId=${encodeURIComponent(sample.cycleId)}`)
  await expect(page.locator('body')).toContainText('正式流水查看区')
  await expect(page.locator('body')).toContainText(sample.qualityLedgerNo)

  await page.goto(`/fcs/pda/settlement?tab=quality&cycleId=${encodeURIComponent(sample.cycleId)}`)
  await expect(page.locator('body')).toContainText('只展示待确认质量扣款记录与质量异议单')
  await expect(page.locator('body')).toContainText('待处理')
  await expect(page.locator('body')).toContainText('异议中')
  await expect(page.locator('body')).toContainText(sample.pendingQcNo)
  await expect(page.locator('body')).not.toContainText('未最终裁决的质量异议已形成正式流水')

  const qualityDetailHref = await page.getByRole('button', { name: '查看质检详情' }).first().getAttribute('data-nav')
  expect(qualityDetailHref).toMatch(/\/fcs\/pda\/quality\//)
  await page.goto(`http://127.0.0.1:4173${qualityDetailHref}`)
  await expect(page).toHaveURL(/\/fcs\/pda\/quality\//)

  await openSettlementAsFactory(page, sample.factory.id, `/fcs/pda/settlement?tab=quality&cycleId=${encodeURIComponent(sample.cycleId)}`)
  await page.getByRole('button', { name: /异议中/ }).click()
  await expect(page.locator('body')).toContainText(sample.disputingQcNo)
})

test('工厂端可查看正式流水、对账与预付款结果、以及结算资料版本差异', async ({ page }) => {
  const qualitySample = getQualityCycleSample()
  const prepaymentSample = getPrepaymentCycleSample()

  await openSettlementAsFactory(page, qualitySample.factory.id, `/fcs/pda/settlement?tab=ledgers&cycleId=${encodeURIComponent(qualitySample.cycleId)}`)
  await expect(page.locator('body')).toContainText(qualitySample.taskLedgerNo)
  await expect(page.locator('body')).toContainText(qualitySample.qualityLedgerNo)

  const taskLedgerCard = page.locator('article').filter({ hasText: qualitySample.taskLedgerNo }).first()
  await taskLedgerCard.getByRole('button', { name: '查看流水' }).click()
  await expect(page.locator('body')).toContainText('来源链路')
  await expect(page.locator('body')).toContainText('价格来源')
  await expect(page.locator('body')).toContainText('回货批次')
  await page.locator('[data-pda-sett-action="close-ledger-drawer"]').first().click()

  const qualityLedgerCard = page.locator('article').filter({ hasText: qualitySample.qualityLedgerNo }).first()
  await qualityLedgerCard.getByRole('button', { name: '查看流水' }).click()
  await expect(page.locator('body')).toContainText('质检记录号')
  await expect(page.locator('body')).toContainText('待确认质量扣款记录号')
  await expect(page.locator('body')).toContainText('质量异议单号')
  await page.locator('[data-pda-sett-action="close-ledger-drawer"]').first().click()

  await openSettlementAsFactory(page, prepaymentSample.factory.id, `/fcs/pda/settlement?tab=statements&cycleId=${encodeURIComponent(prepaymentSample.cycleId)}`)
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
})
