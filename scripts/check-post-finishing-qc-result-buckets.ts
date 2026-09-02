#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

const pdaQuality = source('../src/pages/pda-quality.ts')
const pdaExecDetail = source('../src/pages/pda-exec-detail.ts')
const qcWorkbench = source('../src/pages/process-factory/post-finishing/qc-workbench.ts')
const qcOrders = source('../src/pages/process-factory/post-finishing/qc-orders.ts')
const tasks = source('../src/pages/process-factory/post-finishing/tasks.ts')
const dispatchWorkbench = source('../src/pages/unified-dispatch-workbench.ts')
const fullFlow = source('../src/data/fcs/post-finishing-full-flow.ts')

for (const obsolete of [
  ['open', 'create', 'qc'].join('-'),
  ['submit', 'create', 'qc'].join('-'),
  'listPostFinishingSourceStyleOptions',
  ['不关联来源任务', '直接选择 SKU'].join('，'),
  ['PDA', '后道质检员'].join(' '),
]) {
  assert(!pdaQuality.includes(obsolete), `PDA 质检页不得保留旧后道质检能力：${obsolete}`)
}

assert(pdaQuality.includes('后道质检仅在 Web“质检单”领取'), 'PDA 通用质检页必须明确后道质检的 Web 边界')
assert(pdaExecDetail.includes('质检仅在 Web“质检单”'), 'PDA 执行详情必须把后道质检导向 Web 质检单页')
assert(qcWorkbench.includes('输入完整质检单号'), 'Web 质检单执行页必须以完整单号输入进入')
assert(!qcWorkbench.includes('扫描完整质检单号'), 'Web 质检单执行页不得把输入描述为扫描')
assert(qcWorkbench.includes('错误领取，退回待质检'), 'Web 质检必须支持错误领取后的退领')
assert(qcWorkbench.includes('已由 ${escapeHtml(task.claimedBy.actorName)} 质检中'), '他人领取时必须显示占用质检员')
assert(qcOrders.includes('主管释放'), '质检任务管理页必须提供主管释放兜底')
assert(qcOrders.includes('data-qc-task-input'), '同一质检任务页面必须提供普通质检员输入领取入口')
assert(!tasks.includes('创建质检单'), '兼容任务页不得保留手工创建质检单')
assert(!tasks.includes('>生成质检单<'), '后道任务页不得保留重复的生成质检单操作')
assert(tasks.includes('/fcs/dispatch/workbench?search_field=task&keyword='), '后道任务页查看任务必须携带任务号进入任务分配工作台')
assert(tasks.includes('source=post-finishing'), '后道任务页必须声明任务分配工作台的数据来源')
assert(dispatchWorkbench.includes("params.get('keyword')"), '任务分配工作台必须读取后道任务号查询条件')
assert(dispatchWorkbench.includes("params.get('source') === 'post-finishing'"), '任务分配工作台必须按后道来源加载对应任务')
assert(fullFlow.includes('sendPostFinishingFactoryReturnToQc'), '质检任务必须由统一送检动作生成')
assert(fullFlow.includes('只有后道待加工仓中的待送检库存可以发起送检'), '质检任务生成必须受待加工仓批次状态门禁约束')

console.log('后道质检 Web/PDA 迁移检查通过：PDA 旧入口、自由选 SKU 和手工建单已归零。')
