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
]) {
  assert(routes.includes(`'${path}'`), `PDA 路由缺少 ${path}`)
  assert(handlers.includes(`exact('${path}')`), `PDA 事件处理缺少 ${path}`)
}

assert(pdaFlow.includes('只按完整后道加工单号查询'), '后道 PDA 必须精确扫描后道加工单且初始不展示任务池')
assert(pdaFlow.includes('初始不展示待确认任务池'), '回货确认 PDA 必须精确扫描送货单且不展示任务池')
assert(pdaFlow.includes('二次仍超过 5%才扫描授权码'), '回货确认 PDA 必须显示两段 5%规则')
assert(pdaFlow.includes('核对无误，开始后道') && pdaFlow.includes('质检已确认加工项目'), '后道 PDA 必须先展示质检已确认项目并由员工核对后开始')
assert(pdaFlow.includes('data-post-completed-qty') && !pdaFlow.includes('toggle-process-item'), '后道 PDA 开始后必须只填完成数量，不得重复勾选加工项目')
assert(pdaFlow.includes('扫描成功即由当前账号领取'), '复检 PDA 扫描成功必须领取')
assert(!pdaFlow.includes('扫描后道出货单条码') && !pdaFlow.includes("actor('仓库收货人员')"), '后道工厂 PDA 不得保留成衣仓收货动作')
assert(pdaFlow.includes("actor('回货确认人员')") && pdaFlow.includes("actor('后道操作员')") && pdaFlow.includes("actor('复检员')"), 'PDA 三类后道现场动作必须读取当前登录账号')

console.log('后道 Web/PDA 动作边界检查通过：质检使用专用 Web 工作台；现场后道动作 PDA 优先，Web 保留应急兜底。')
