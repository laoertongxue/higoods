#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const fullFlowPrint = readFileSync(new URL('../src/pages/process-factory/post-finishing/full-flow-print.ts', import.meta.url), 'utf8')
const legacyQcPrint = readFileSync(new URL('../src/pages/print/templates/post-finishing-qc-print-template.ts', import.meta.url), 'utf8')

for (const type of ['SEND_QC', 'POST_ORDER', 'OUTBOUND', 'SKU_LABEL']) {
  assert(fullFlowPrint.includes(`'${type}'`), `缺少 ${type} 打印类型`)
}

assert(fullFlowPrint.includes('renderCode128Barcode'), '三类业务单必须打印真实 Code128 条形码')
assert(fullFlowPrint.includes('/fcs/craft/post-finishing/qc-workbench?taskNo='), '送检单二维码必须进入 Web 质检工作台')
assert(fullFlowPrint.includes('/fcs/pda/post-finishing/execute?id='), '后道加工单二维码必须进入 PDA 后道执行')
assert(fullFlowPrint.includes('/fcs/pda/post-finishing/outbound-receive?id='), '后道出货单二维码必须进入仓库 PDA 收货')
assert(fullFlowPrint.includes("'后道出货单'") && fullFlowPrint.includes('业务单号条码'), '打印页面必须明确整单出货条码')
assert(fullFlowPrint.includes('SKU 贴标'), '打印页面必须明确 SKU 贴标')
assert(fullFlowPrint.includes('imageUrl'), '打印明细必须带真实产品图片')

for (const obsolete of [['postMobileAction', 'complete-qc'].join('='), ['/fcs/pda', 'exec/'].join('/')]) {
  assert(!legacyQcPrint.includes(obsolete), `旧质检打印模板不得再跳转 PDA：${obsolete}`)
}
assert(legacyQcPrint.includes('/fcs/craft/post-finishing/qc-workbench'), '历史质检打印模板也必须统一跳转 Web 工作台')

console.log('后道打印路由检查通过：送检、后道、出货、SKU 贴标目标已分离。')
