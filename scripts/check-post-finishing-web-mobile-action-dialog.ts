#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

const pdaExec = read('../src/pages/pda-exec-detail.ts')
const pdaFlow = read('../src/pages/pda-post-finishing-flow.ts')
const qcWorkbench = read('../src/pages/process-factory/post-finishing/qc-workbench.ts')
const routes = read('../src/router/routes-pda.ts')
const handlers = read('../src/main-handlers/pda-handlers.ts')

assert(pdaExec.includes('POST_QC_WEB_ONLY'), '旧 PDA 后道详情必须把质检动作明确标记为 Web-only')
assert(!pdaExec.includes('postMobileAction'), '旧 PDA 后道详情不得保留后道质检动作参数')
assert(!pdaExec.includes('POST_QC_START') && !pdaExec.includes('POST_QC_FINISH'), 'PDA 后道详情不得再执行质检开始或完成')
assert(qcWorkbench.includes('full-flow-claim-qc') && qcWorkbench.includes('full-flow-complete-qc'), '后道质检必须在专用 Web 工作台领取和完成')

for (const path of [
  '/fcs/pda/post-finishing/return-confirm',
  '/fcs/pda/post-finishing/execute',
  '/fcs/pda/post-finishing/recheck',
  '/fcs/pda/post-finishing/outbound-receive',
]) {
  assert(routes.includes(`'${path}'`), `PDA 路由缺少 ${path}`)
  assert(handlers.includes(`exact('${path}')`), `PDA 事件处理缺少 ${path}`)
}

assert(pdaFlow.includes('只按完整后道任务号查询'), '后道 PDA 必须精确扫描且初始不展示任务池')
assert(pdaFlow.includes('初始不展示待确认任务池'), '回货确认 PDA 必须精确扫描送货单且不展示任务池')
assert(pdaFlow.includes('二次仍超过 5%才扫描授权码'), '回货确认 PDA 必须显示两段 5%规则')
assert(pdaFlow.includes('先核对产品、数量和工序，再确认开始'), '后道 PDA 不得扫描后直接绕过核对开始')
assert(pdaFlow.includes('扫描成功即由当前账号领取'), '复检 PDA 扫描成功必须领取')
assert(pdaFlow.includes('只接受完整 FCK 后道出货单号'), '仓库 PDA 不得接受内部交接号')
assert(pdaFlow.includes("actor('回货确认人员')") && pdaFlow.includes("actor('后道操作员')") && pdaFlow.includes("actor('复检员')") && pdaFlow.includes("actor('仓库收货人员')"), 'PDA 四类现场动作必须读取当前登录账号')

console.log('后道 Web/PDA 动作边界检查通过：质检仅 Web，回货确认/后道/复检/收货使用专用 PDA 扫码流程。')
