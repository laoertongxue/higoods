import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/pages/statements.ts', import.meta.url), 'utf8')
const settlementSeedsSource = readFileSync(new URL('../src/data/fcs/store-domain-settlement-seeds.ts', import.meta.url), 'utf8')
const copySources = `${source}\n${settlementSeedsSource}`
let html = ''
try {
  html = (await import('../src/pages/statements.ts')).renderStatementsPage()
} catch {
  html = ''
}

for (const token of [
  'data-stm-build-field="start-date"',
  'data-stm-build-field="end-date"',
  'data-stm-build-field="object-mode"',
  'data-stm-build-field="currency"',
  '按预结算流水',
  '按生产单',
  '预结算流水',
  '反查生产单',
  '未完成，不纳入本期对账',
  '差 ',
  '裁片完成数量',
  '预结算流水明细',
  '关联质检单',
  '结算口径累计交出',
  '后道返工反扣',
  '本期应付净额',
  'getStatementBuildTabs',
  'MOCK-SETTLE-PO-003',
  'MOCK-PSL-PO3-05',
  'MOCK-QC-PO3-03',
  'SKU-SETTLE-${input.poKey}-${qcKey}-C',
  '返工接收对象',
  '质检扣款',
  '金额确认',
  'data-stm-build-field="manual-defect-reason-amount"',
  'data-stm-build-field="manual-defect-reason-remark"',
  'data-stm-build-field="manual-delay-deduction-amount"',
  'data-stm-build-field="manual-delay-deduction-remark"',
  '开始时间参考',
  '最后交出时间',
  '由业务人员填写',
]) {
  assert(source.includes(token) || html.includes(token), `缺少对账单生成口径：${token}`)
}

assert(!source.includes('必须先选工厂和结算周期，再自动加载该范围内的回货批次明细行'))
for (const token of ['该工厂该结算周期', '当前工厂和结算周期', '工厂和结算周期范围', '工厂或结算周期']) {
  assert(!copySources.includes(token), `对账单仍残留旧结算周期提示：${token}`)
}
assert(
  copySources.includes('工厂、时间段和结算对象') || copySources.includes('工厂或时间段'),
  '对账单缺少工厂、时间段和结算对象的新口径提示',
)
assert(source.includes('buildStatementDraftLinesFromSettlementSelection'))
assert(source.includes('buildProductionOrderSettlementProjections'))
assert(source.includes('listStatementEligiblePreSettlementLedgersByRange'))
assert(!source.includes('listStatementBuildCandidates(selectedScope.settlementPartyId, selectedScope.settlementCycleId)'))
assert(!source.includes('当前工厂和结算周期暂无可'))
assert(source.includes('开始日期不能晚于结束日期'))
assert(source.includes('存在多个币种'))
assert(!source.includes('settlementCurrency: state.buildCurrency'))
assert(source.includes('canStatementEnterPrepayment'), '对账单页待入预付款展示必须使用正向可入池谓词')
assert(!source.includes("READY_FOR_PREPAYMENT: '待入预付款'"), 'READY_FOR_PREPAYMENT 不应固定显示为待入预付款')
assert(
  !source.includes("readyForPrepayment: listItems.filter((item) => item.status === 'READY_FOR_PREPAYMENT').length"),
  '概览待入预付款统计不应只按 raw status 计数',
)
assert(
  !source.includes("detail.draft.status === 'READY_FOR_PREPAYMENT'"),
  '详情生命周期提示不应只按 raw status 展示等待进入预付款',
)
assert(source.includes('财务待处理'), '净额非正向确认单应在对账单页展示财务待处理口径')

console.log('check:factory-settlement-statements passed')
