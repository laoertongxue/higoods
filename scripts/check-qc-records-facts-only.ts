#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { listPostFinishingQcOrders } from '../src/data/fcs/post-finishing-domain.ts'
import { getQcFactDetail } from '../src/pages/qc-records/fact-view.ts'
import { renderQcRecordDetailPage, renderQcRecordsPage } from '../src/pages/qc-records.ts'

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

const postQc = listPostFinishingQcOrders().find((record) =>
  (record.qcSkuResults ?? []).some((item) => (item.reworkQty ?? 0) > 0 && item.reworkReceiveFactoryName),
)
const multiSkuQc = listPostFinishingQcOrders().find((record) =>
  (record.qcSkuResults ?? []).length > 1 &&
  (record.qcSkuResults ?? []).some((item) =>
    (item.defectAcceptedQty ?? 0) > 0 &&
    (item.defectReasonItems ?? []).reduce((sum, reason) => sum + (Number(reason.qty) || 0), 0) === item.defectAcceptedQty,
  ),
)
const externalReworkQc = listPostFinishingQcOrders().find((record) =>
  (record.qcSkuResults ?? []).some((item) =>
    (item.reworkQty ?? 0) > 0 &&
    item.reworkReceiveFactoryName &&
    item.reworkReceiveFactoryName !== record.sourceFactoryName &&
    ((item.sourceChargeback?.amount ?? item.reworkDeductionAmountIdr ?? 0) > 0),
  ),
)

assert(postQc, '缺少带返工接收对象的后道质检单样例')
assert(multiSkuQc, '缺少带多个 SKU、瑕疵数量和瑕疵原因数量的后道质检单样例')
assert(externalReworkQc, '缺少返工接收工厂不同于来源工厂且带返工扣款金额的后道质检单样例')

const externalReworkReceiver = (externalReworkQc!.qcSkuResults ?? []).find((item) =>
  (item.reworkQty ?? 0) > 0 &&
  item.reworkReceiveFactoryName &&
  item.reworkReceiveFactoryName !== externalReworkQc!.sourceFactoryName,
)?.reworkReceiveFactoryName
const expectedReworkReceivers = Array.from(new Set(
  (externalReworkQc!.qcSkuResults ?? [])
    .filter((item) => (item.reworkQty ?? 0) > 0)
    .map((item) => item.reworkReceiveFactoryName)
    .filter(Boolean),
))
const externalFact = getQcFactDetail(externalReworkQc!.actionRecordId)
const factViewSource = readFileSync(new URL('../src/pages/qc-records/fact-view.ts', import.meta.url), 'utf8')

assert(externalReworkReceiver, '缺少外部返工接收对象')
for (const receiver of expectedReworkReceivers) {
  assert(externalFact?.reworkReceivers.includes(receiver!), `事实视图缺少返工接收对象：${receiver}`)
}
assert(
  !factViewSource.includes('skuResults.find((item) => numberValue(item.reworkQty) > 0 && item.reworkReceiveFactoryName)'),
  '事实视图不能从 SKU 返工接收对象中取第一条作为订单级字段',
)
assert(factViewSource.includes('formatSkuReworkReceiverTexts'), '事实视图需要按 SKU 和数量汇总返工接收对象')

const externalChargebackAmount = (externalReworkQc!.qcSkuResults ?? []).reduce((sum, item) => {
  const isExternalRework =
    (item.reworkQty ?? 0) > 0 &&
    item.reworkReceiveFactoryName &&
    item.reworkReceiveFactoryName !== externalReworkQc!.sourceFactoryName
  return isExternalRework ? sum + (item.sourceChargeback?.amount ?? item.reworkDeductionAmountIdr ?? 0) : sum
}, 0)
const externalChargebackText = `IDR ${externalChargebackAmount.toLocaleString('en-US')}`

const listHtml = renderQcRecordsPage()

assert(listHtml.includes('具体质检事实'), '质检记录列表缺少事实优先说明')
assert(listHtml.includes('条/页'), '质检记录列表缺少分页条数选择')
assert(!listHtml.includes('data-qcr-filter="pageSize"'), '质检记录搜索条件不应显示每页条数选择')
assert(listHtml.includes('data-qcr-action="query"'), '质检记录搜索条件缺少查询按钮')
assert(listHtml.includes('下一页'), '质检记录列表缺少分页按钮')
assert(listHtml.includes('返工数量'), '质检记录列表缺少返工数量')
assert(listHtml.includes('返工接收对象'), '质检记录列表缺少返工接收对象')
assert(listHtml.includes(postQc!.actionRecordNo), '质检记录列表缺少后道质检单')
assert(listHtml.includes('返工扣款金额'), '质检记录列表缺少外部返工扣款金额')
assert(listHtml.includes(externalChargebackText), '质检记录列表缺少外部返工扣款金额数值')
assert(!listHtml.includes('显示旧记录'), '质检记录列表不应显示旧记录开关')
assert(!listHtml.includes('对账追溯'), '质检记录列表不应显示对账追溯')
assert(!listHtml.includes('工厂响应'), '质检记录列表不应显示工厂响应')
assert(!listHtml.includes('异议状态'), '质检记录列表不应显示异议状态')
assert(!listHtml.includes('来源反扣金额'), '质检记录列表不应显示扣款金额')
assert(!listHtml.includes('对账提示状态'), '质检记录列表不应显示对账提示状态')
assert(!listHtml.includes('责任状态'), '质检记录列表不应显示责任状态')

const detailHtml = renderQcRecordDetailPage(multiSkuQc!.actionRecordId)

assert(detailHtml.includes(multiSkuQc!.actionRecordNo), '质检记录详情无法打开后道质检单')
assert(detailHtml.includes('基本事实'), '质检记录详情缺少基本事实')
assert(detailHtml.includes('数量事实'), '质检记录详情缺少数量事实')
assert(detailHtml.includes('SKU 明细'), '质检记录详情缺少 SKU 明细')
for (const sku of multiSkuQc!.qcSkuResults ?? []) {
  assert(detailHtml.includes(sku.skuCode), `质检记录详情缺少 SKU：${sku.skuCode}`)
  for (const reason of sku.defectReasonItems ?? []) {
    if ((reason.qty ?? 0) > 0) {
      assert(detailHtml.includes(`${reason.reasonName}${reason.qty}`), `质检记录详情缺少瑕疵原因数量：${reason.reasonName}${reason.qty}`)
    }
  }
}
assert(detailHtml.includes('返工数量'), '质检记录详情缺少返工数量')
assert(detailHtml.includes('返工接收对象'), '质检记录详情缺少返工接收对象')
assert(detailHtml.includes('瑕疵原因'), '质检记录详情缺少瑕疵原因')
assert(detailHtml.includes('返工扣款金额'), '质检记录详情缺少外部返工扣款金额')
assert(detailHtml.includes(externalChargebackText), '质检记录详情缺少外部返工扣款金额数值')
assert(!detailHtml.includes('质检证据'), '质检记录详情不应显示质检证据模块')
assert(!detailHtml.includes('对账追溯'), '质检记录详情不应显示对账追溯模块')
assert(!detailHtml.includes('原始链路信息'), '质检记录详情不应显示原始链路信息模块')
assert(!detailHtml.includes('工厂响应与异议'), '质检记录详情不应显示工厂响应与异议')
assert(!detailHtml.includes('来源反扣金额'), '质检记录详情不应显示扣款金额')
assert(!detailHtml.includes('裁决意见'), '质检记录详情不应显示裁决过程')

console.log('check:qc-records-facts-only passed')
