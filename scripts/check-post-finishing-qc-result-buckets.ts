#!/usr/bin/env node

import {
  completePostFinishingQcOrder,
  listPostFinishingQcOrderEntities,
  listPostFinishingQcOrders,
  type PostFinishingQcSkuResult,
} from '../src/data/fcs/post-finishing-domain.ts'
import { renderPostFinishingQcOrdersPage } from '../src/pages/process-factory/post-finishing/qc-orders.ts'

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

const qc = listPostFinishingQcOrderEntities().find((item) => item.skuLines.length > 0)
assert(qc, '缺少可检查的后道质检单')

const pendingRecord = listPostFinishingQcOrders().find((item) => !item.status.includes('完成'))
assert(pendingRecord, '缺少可检查的待完成质检单')
;(globalThis as any).window = {
  location: {
    pathname: '/fcs/craft/post-finishing/qc-orders',
    search: `?tab=qc&completeQc=${pendingRecord!.actionRecordId}`,
  },
}
const completeDialogHtml = renderPostFinishingQcOrdersPage()
delete (globalThis as any).window

assert(!completeDialogHtml.includes('数量与处理'), '完成质检弹窗不应再显示数量与处理区')
assert(!completeDialogHtml.includes('责任与扣款依据'), '完成质检弹窗不应再显示责任与扣款依据区')
assert(!completeDialogHtml.includes('data-qc-sku-remark'), 'SKU 质检行不应再显示备注输入')
assert(!completeDialogHtml.includes('data-qc-result-select'), '质检结果不应再手动选择')
assert(completeDialogHtml.includes('data-qc-result-display'), '质检结果应由下方数量自动展示')
assert(completeDialogHtml.includes('每件扣款金额（印尼盾）'), '返工外流时应填写每件扣款金额')
assert(completeDialogHtml.includes('data-qc-rework-deduction-unit-amount'), '缺少返工扣款单价输入')
assert(completeDialogHtml.includes('data-qc-sku-card'), 'SKU 质检区应改成卡片，不能再是宽表')
assert(!completeDialogHtml.includes('min-w-[1500px]'), '完成质检弹窗不应再使用 1500px 宽表')
assert(completeDialogHtml.includes('原工厂') && completeDialogHtml.includes('当前后道工厂'), '返工工厂应只提供原工厂和当前后道工厂')

;(globalThis as any).window = {
  location: {
    pathname: '/fcs/craft/post-finishing/qc-orders',
    search: '?tab=qc',
  },
}
const qcListHtml = renderPostFinishingQcOrdersPage()
delete (globalThis as any).window
assert(!qcListHtml.includes('责任方') && !qcListHtml.includes('扣款决策'), '质检单列表不应再显示责任方和扣款决策')
assert(qcListHtml.includes('返工接收工厂') && qcListHtml.includes('瑕疵原因'), '质检单列表应显示返工工厂和瑕疵原因')
assert(qcListHtml.includes('data-qc-list-card'), '质检单列表应改成卡片列表，不能再是宽表')
assert(!qcListHtml.includes('min-w-[2200px]'), '质检单列表不应再使用 2200px 宽表')

;(globalThis as any).window = {
  location: {
    pathname: '/fcs/craft/post-finishing/qc-orders',
    search: `?tab=qc&viewQc=${pendingRecord!.actionRecordId}`,
  },
}
const qcDetailHtml = renderPostFinishingQcOrdersPage()
delete (globalThis as any).window
assert(!qcDetailHtml.includes('责任方') && !qcDetailHtml.includes('扣款决策'), '质检单详情不应再显示责任方和扣款决策')
assert(qcDetailHtml.includes('data-qc-detail-sku-card'), '质检单详情 SKU 明细应改成卡片，不能再是宽表')
assert(!qcDetailHtml.includes('min-w-[1320px]'), '质检单详情 SKU 明细不应再使用 1320px 宽表')

const line = qc!.skuLines[0]
const bucketResult = {
  qcSkuResultId: `${qc!.qcOrderId}-CHECK-001`,
  skuLineId: line.skuLineId,
  skuId: line.skuId,
  skuCode: line.skuCode,
  skuImageUrl: line.imageUrl,
  colorName: line.colorName,
  sizeName: line.sizeName,
  inspectedQty: 100,
  qualifiedQty: 50,
  reworkQty: 30,
  defectAcceptedQty: 20,
  unqualifiedQty: 50,
  platformReasonQty: 0,
  factoryReasonQty: 50,
  reworkReceiveFactoryName: '当前后道工厂',
  reworkDeductionUnitAmountIdr: 15000,
  responsibleFactoryId: qc!.sourceFactoryId,
  responsibleFactoryName: qc!.sourceFactoryName,
  defectReasonItems: [
    {
      reasonItemId: `${qc!.qcOrderId}-CHECK-REASON-1`,
      reasonName: '做工原因',
      qty: 12,
      liabilityType: '工厂',
      responsibleFactoryId: qc!.sourceFactoryId,
      responsibleFactoryName: qc!.sourceFactoryName,
    },
    {
      reasonItemId: `${qc!.qcOrderId}-CHECK-REASON-2`,
      reasonName: '脏污',
      qty: 8,
      liabilityType: '工厂',
      responsibleFactoryId: qc!.sourceFactoryId,
      responsibleFactoryName: qc!.sourceFactoryName,
    },
  ],
  postProjectJudgements: [],
  qtyUnit: '件',
} as PostFinishingQcSkuResult & {
  reworkQty: number
  defectAcceptedQty: number
  reworkReceiveFactoryName: string
  reworkDeductionUnitAmountIdr: number
}

const emptyResults = qc!.skuLines.slice(1).map((item, index): PostFinishingQcSkuResult => ({
  qcSkuResultId: `${qc!.qcOrderId}-CHECK-EMPTY-${index + 1}`,
  skuLineId: item.skuLineId,
  skuId: item.skuId,
  skuCode: item.skuCode,
  skuImageUrl: item.imageUrl,
  colorName: item.colorName,
  sizeName: item.sizeName,
  inspectedQty: 0,
  qualifiedQty: 0,
  unqualifiedQty: 0,
  platformReasonQty: 0,
  factoryReasonQty: 0,
  defectReasonItems: [],
  postProjectJudgements: [],
  qtyUnit: item.qtyUnit,
}))

const completed = completePostFinishingQcOrder({
  qcOrderId: qc!.qcOrderId,
  qcResult: '部分不合格',
  unqualifiedDisposition: '返修',
  unqualifiedReasonSummary: '合格 50，返工 30，瑕疵品 20。',
  rootCauseType: '工厂加工问题',
  responsiblePartyType: '工厂',
  responsiblePartyName: qc!.sourceFactoryName,
  deductionDecision: '建议扣款',
  deductionDecisionRemark: '本质检周期先扣返工数量对应加工费。',
  qcSkuResults: [bucketResult, ...emptyResults],
})

assert(completed.inspectedGarmentQty === 100, '质检数量应为 100')
assert(completed.passedGarmentQty === 50, '合格数量应为 50')
assert(completed.defectiveGarmentQty === 50, '返工和瑕疵品应计入质检异常数量 50')
assert(completed.reworkGarmentQty === 30, '返工数量应为 30')
assert(completed.defectAcceptedGarmentQty === 20, '瑕疵品接收数量应为 20')
assert(completed.processingFeeDeductionQty === 30, '本质检结算周期应扣返工加工费数量 30')
assert(completed.qcSkuResults[0].reworkReceiveFactoryName === '当前后道工厂', '返工接收工厂未保留')
assert(completed.qcSkuResults[0].reworkDeductionUnitAmountIdr === 15000, '返工外流扣款单价未保留')
assert(completed.qcSkuResults[0].reworkDeductionAmountIdr === 450000, '返工外流扣款金额应为返工数量乘以单价')
assert(
  completed.qcSkuResults[0].defectReasonItems.map((item) => item.reasonName).join('、') === '做工原因、脏污',
  '瑕疵原因明细未保留',
)

const action = listPostFinishingQcOrders().find((item) => item.linkedQcOrderId === completed.qcOrderId)
assert(action, '质检动作记录未生成')
assert(action!.reworkGarmentQty === 30, '动作记录应保留返工数量')
assert(action!.defectAcceptedGarmentQty === 20, '动作记录应保留瑕疵品数量')
assert(action!.qualityDeductionSnapshot?.processingFeeDeductionQty === 30, '扣款快照应记录本期扣加工费数量 30')

console.log('post finishing qc result bucket checks passed')
