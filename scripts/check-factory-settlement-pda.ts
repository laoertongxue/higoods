import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const pda = readFileSync(new URL('../src/pages/pda-settlement.ts', import.meta.url), 'utf8')
const batches = readFileSync(new URL('../src/pages/batches.ts', import.meta.url), 'utf8')

function findButtonSnippet(label: string, action: string): string {
  let offset = 0
  while (offset < pda.length) {
    const labelIndex = pda.indexOf(label, offset)
    if (labelIndex < 0) break
    const buttonStart = pda.lastIndexOf('<button', labelIndex)
    const buttonEnd = pda.indexOf('</button>', labelIndex)
    if (buttonStart >= 0 && buttonEnd >= labelIndex) {
      const snippet = pda.slice(buttonStart, buttonEnd + '</button>'.length)
      if (snippet.includes(action)) return snippet
    }
    offset = labelIndex + label.length
  }
  return ''
}

function sliceBetween(startToken: string, endToken: string, message: string): string {
  const start = pda.indexOf(startToken)
  assert(start >= 0, message)
  const end = pda.indexOf(endToken, start + startToken.length)
  assert(end > start, message)
  return pda.slice(start, end)
}

for (const token of ['应付', '扣款', '本期净额', '来源质检单', '确认对账单', '发起申诉', '打款结果']) {
  assert(pda.includes(token), `PDA 结算缺少：${token}`)
}

for (const forbidden of ['data-pda-sett-field="deduction-amount"', 'data-pda-sett-field="currency"', '修改扣款金额']) {
  assert(!pda.includes(forbidden), `PDA 不允许核算编辑：${forbidden}`)
}

for (const token of [
  'hasPdaSettlementPermission',
  'SETTLEMENT_VIEW',
  'SETTLEMENT_CONFIRM',
  'SETTLEMENT_DISPUTE',
  'SETTLEMENT_CHANGE_REQUEST',
  '当前账号没有确认对账单权限',
  '当前账号没有发起申诉权限',
  '当前账号没有变更结算资料权限',
]) {
  assert(pda.includes(token), `PDA 结算缺少权限拦截：${token}`)
}

const statementDetailButton = findButtonSnippet('查看明细', 'open-statement-detail')
assert(statementDetailButton, 'PDA 对账单卡片缺少查看明细按钮')
assert(statementDetailButton.includes('data-pda-sett-action="open-statement-detail"'), '查看明细按钮未绑定对账单详情动作')
assert(statementDetailButton.includes('data-statement-id'), '查看明细按钮缺少对账单 ID')

const paymentResultButton = findButtonSnippet('打款结果', 'open-payment-result')
assert(paymentResultButton, 'PDA 对账单卡片缺少打款结果按钮')
assert(paymentResultButton.includes('data-pda-sett-action="open-payment-result"'), '打款结果按钮未绑定打款结果动作')
assert(paymentResultButton.includes('data-statement-id'), '打款结果按钮缺少对账单 ID')

const paymentHandler = sliceBetween(
  "if (action === 'open-statement-payment'",
  "if (action === 'open-statement-appeal'",
  'PDA 缺少打款结果 handler 片段',
)
assert(paymentHandler.includes("action === 'open-statement-payment'"), 'handler 缺少 open-statement-payment')
assert(paymentHandler.includes("action === 'open-payment-result'"), 'handler 缺少 open-payment-result')

const statementDeductionDetail = sliceBetween("'质量扣款明细',", "'工厂反馈',", 'PDA 对账单详情缺少质量扣款明细片段')
assert(statementDeductionDetail.includes('来源质检单'), 'PDA 对账单详情缺少来源质检单')
assert(statementDeductionDetail.includes('扣款原因'), 'PDA 对账单详情缺少扣款原因')
assert(!statementDeductionDetail.includes('查看扣款依据'), 'PDA 对账单详情不应显示查看扣款依据')

assert(batches.includes('只消费已确认可付款对账单') || batches.includes('已确认可付款对账单'))
assert(batches.includes('锁账') || batches.includes('金额锁定'))

console.log('check:factory-settlement-pda passed')
