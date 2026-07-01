import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const postDomain = readFileSync(new URL('../src/data/fcs/post-finishing-domain.ts', import.meta.url), 'utf8')
const postQcPage = readFileSync(new URL('../src/pages/process-factory/post-finishing/qc-orders.ts', import.meta.url), 'utf8')
const qcDetail = readFileSync(new URL('../src/pages/qc-records/detail-domain.ts', import.meta.url), 'utf8')

assert(postQcPage.includes('来源反扣'))
assert(postQcPage.includes('对账单确认后生效'))
assert(!postQcPage.includes('本期扣加工费数量'))
assert(!postQcPage.includes('请填写每件扣款金额'))

assert(!qcDetail.includes('data-qcd-field="deductionDecision"'))
assert(!qcDetail.includes('data-qcd-field="deductionAmount"'))
assert(!qcDetail.includes('扣款金额（元）'))
assert(qcDetail.includes('来源反扣'))
assert(qcDetail.includes('质检事实'))

assert(!postDomain.includes("deductionDecision = hasDefect ? input.deductionDecision || qc.deductionDecision || '建议扣款'"))
assert(postDomain.includes('sourceChargeback'))

console.log('check:factory-settlement-qc-boundary passed')
