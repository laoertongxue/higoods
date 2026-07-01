import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const postDomain = readFileSync(new URL('../src/data/fcs/post-finishing-domain.ts', import.meta.url), 'utf8')
const postQcPage = readFileSync(new URL('../src/pages/process-factory/post-finishing/qc-orders.ts', import.meta.url), 'utf8')
const qcDetail = readFileSync(new URL('../src/pages/qc-records/detail-domain.ts', import.meta.url), 'utf8')
const qcList = readFileSync(new URL('../src/pages/qc-records/list-domain.ts', import.meta.url), 'utf8')
const qcActions = readFileSync(new URL('../src/pages/qc-records/actions.ts', import.meta.url), 'utf8')

assert(postQcPage.includes('来源反扣'))
assert(postQcPage.includes('对账单确认后生效'))
assert(!postQcPage.includes('本期扣加工费数量'))
assert(!postQcPage.includes('请填写每件扣款金额'))

assert(!qcDetail.includes('data-qcd-field="deductionDecision"'))
assert(!qcDetail.includes('data-qcd-field="deductionAmount"'))
assert(!qcDetail.includes('扣款金额（元）'))
assert(!qcDetail.includes('可直接生成正式质量扣款流水'))
assert(!qcDetail.includes('调整后冻结加工费金额'))
assert(!qcDetail.includes('调整后生效质量扣款金额'))
assert(!qcDetail.includes('正式质量扣款流水与预结算衔接'))
assert(!qcDetail.includes('预付款批次'))
assert(!qcDetail.includes('关联扣款依据'))
assert(!qcDetail.includes('扣款依据条目'))
assert(!qcDetail.includes('结算影响状态'))
assert(!qcDetail.includes('结算冻结原因'))
assert(qcDetail.includes('来源反扣'))
assert(qcDetail.includes('质检事实'))

assert(!qcActions.includes('必须明确是否扣款'))
assert(!qcActions.includes('deductionDecision: isFail && finalLiabilityRequired'))
assert(!qcActions.includes('deductionAmount:'))
assert(!qcActions.includes('deductionCurrency:'))

assert(!qcList.includes('生效质量扣款'))
assert(!qcList.includes('已进入可结算口径'))
assert(qcList.includes('来源反扣') || qcList.includes('质检事实') || qcList.includes('对账待确认'))

assert(!postDomain.includes("deductionDecision = hasDefect ? input.deductionDecision || qc.deductionDecision || '建议扣款'"))
assert(postDomain.includes('sourceChargeback'))
assert(postDomain.includes('result?.sourceChargeback'))

console.log('check:factory-settlement-qc-boundary passed')
