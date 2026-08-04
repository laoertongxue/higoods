#!/usr/bin/env node

// @ts-expect-error 本脚本由 Node + tsx 运行，仓库未安装 @types/node。
import assert from 'node:assert/strict'
// @ts-expect-error 本脚本由 Node + tsx 运行，仓库未安装 @types/node。
import { readFileSync } from 'node:fs'
// @ts-expect-error 本脚本由 Node + tsx 运行，仓库未安装 @types/node。
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const read = (path: string) => readFileSync(`${ROOT}/${path}`, 'utf8')
const warehouse = read('src/pages/process-factory/cutting/warehouse-hub.ts')
const dialogs = read('src/pages/process-factory/cutting/wait-handover-dialogs.ts')
const actions = read('src/pages/process-factory/cutting/wait-handover-actions.ts')
const runtime = read('src/pages/process-factory/cutting/wait-handover-runtime.ts')
const operations = read('src/data/fcs/cutting/transfer-bag-operations.ts')
const ppic = read('src/data/fcs/cutting/transfer-bag-handover-mock.ts')
const repackMock = read('src/data/fcs/cutting/transfer-bag-repack-mock.ts')
const pdaHandover = read('src/pages/pda-cutting-handover.ts')
const combined = `${warehouse}\n${dialogs}\n${actions}`

for (const [action, label] of [
  ['bagging', '菲票装袋'],
  ['inbound', '中转袋入仓'],
  ['handover', '中转袋交出'],
  ['special-craft-return', '特殊工艺回仓'],
  ['recovery', '中转袋回收'],
  ['scrap', '中转袋报废'],
] as const) {
  const token = `data-wait-handover-action="open-${action}">${label}</button>`
  assert(combined.includes(token), `Web 待交出仓缺少独立动作：${label}`)
  assert.equal(combined.split(token).length - 1, 1, `${label} 顶层入口必须且只能出现一次`)
}
assert(!combined.includes('data-wait-handover-action="open-repack">拆袋重装</button>'), '拆袋重装不得继续作为 Web 顶层独立入口')

for (const marker of [
  '第 1 步，共 5 步',
  '确定车缝任务',
  '核对相关中转袋',
  '直接交出或重装',
  '剩余来源袋',
  '汇总确认',
  "field('车缝任务编号', 'handoverTaskNo'",
  "field('生产单号', 'handoverProductionOrderNo'",
  "field('接收车缝工厂', 'handoverReceiverFactoryName'",
  'data-wait-handover-field="handoverPpicSelection"',
]) assert(dialogs.includes(marker), `Web 中转袋交出五步流程缺少：${marker}`)

assert(dialogs.includes('Web 端手工填写为主'), 'Web 必须明确以手工填写、搜索或选择为主')
assert(!dialogs.includes('扫码优先，手工输入兜底'), 'Web 不得显示 PDA 扫码优先文案')
assert(dialogs.includes('正常进入拆袋重装，不作为异常'), '袋内其他菲票必须进入正常重装，不得显示为交出异常')
assert(actions.includes('其他菲票属于正常重装对象，不是交出异常'), 'Web 核对结果必须明确其他菲票不是异常')
assert(actions.includes("disposition === 'DIRECT_HANDOVER'"), 'Web 必须自动识别整袋直接交出')
assert(actions.includes("disposition === 'REPACK_REQUIRED'"), 'Web 必须自动识别需要拆袋重装的袋')
assert(actions.includes('submitWaitHandoverTaskBatch({'), 'Web 必须通过统一批次命令提交直接交出与重装交出')
assert(runtime.includes('directBags') && runtime.includes('repackPayload?.resultBags'), '统一批次必须同时包含直接袋与重装结果袋')
assert(runtime.includes('duplicatedBag') && runtime.includes('本次交出中重复'), '统一批次必须阻断重复袋')

assert(dialogs.includes('未作为结果袋且仍有菲票的来源袋必须重新入仓；默认原库位，可以修改'), 'Web 必须说明剩余来源袋默认原库位且允许修改')
assert(actions.includes("previous?.warehouseArea || original?.warehouseArea") && actions.includes("previous?.locationCode || original?.locationCode"), 'Web 剩余来源袋必须默认回填权威原库位')
assert(actions.includes('resolveLocation(draft.warehouseArea, draft.locationCode)'), 'Web 修改回仓库位时必须重新核验有效库位')
assert(actions.includes('!selectedResultBagCodes.has(bagCode)') && actions.includes('reusedSourceResultId'), 'Web 必须允许无其他菲票的本次来源袋复用为结果袋，并把原袋目标菲票纳入结果袋')
assert(!actions.includes('请先填写来源袋编号。当前没有可重装来源袋时'), 'Web 任务交出不得残留手工添加来源袋的旧提示')

assert(ppic.includes('buildCuttingHandoverPpicOptions') && ppic.includes('receiverFactoryId'), 'PPIC 候选必须按接收工厂生成')
assert(!ppic.includes('onboarding'), '交出 PPIC 不得复用工厂入驻联系人')
assert(repackMock.includes("MOCK_OTHER_FACTORY_ID = 'FACTORY-SEWING-REPACK-OTHER'") && repackMock.includes('isTargetTask ? MOCK_RECEIVER_FACTORY_ID : MOCK_OTHER_FACTORY_ID'), '同一生产单的其他车缝任务必须归属其他工厂，Mock 不得制造同工厂多任务')
assert(operations.includes('receiverPpicId') && operations.includes('handoverBatchId'), '交出事实必须保存同批次和 PPIC')
assert(operations.includes('targetFeiTicketIds'), '交出批次必须保存当前任务目标菲票范围')

assert(!warehouse.includes('<h2 class="text-base font-semibold text-foreground">特殊工艺回仓扫码</h2>'), 'Web 特殊工艺回仓记录页必须删除扫码说明模块')
assert(!pdaHandover.includes('<div class="font-medium">特殊工艺回仓扫码</div>'), 'PDA 特殊工艺回仓必须删除重复说明模块')
assert(pdaHandover.includes('return renderPdaCuttingTransferBagRepackPage()'), 'PDA 旧中转袋交出深链必须收口到按车缝任务交出的统一五步流程')
assert(dialogs.includes('function specialCraftReturnContent'), 'Web 必须保留独立特殊工艺回仓操作弹窗')
assert(actions.includes('submitSpecialCraftReturn'), 'Web 独立特殊工艺回仓必须写入共享回仓事实')

assert(actions.includes('WeakSet<HTMLElement>') || actions.includes('submitLocks'), 'Web 提交必须防双击')
assert(actions.includes('replaceWith(next)'), 'Web 成功后必须局部刷新工作台数据区')
assert(!actions.includes('root.innerHTML'), 'Web 动作不得触发整页重绘')

console.log('PASS check-web-cutting-transfer-bag-actions')
