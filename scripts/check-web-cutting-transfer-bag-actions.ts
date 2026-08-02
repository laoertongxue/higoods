#!/usr/bin/env node

// @ts-expect-error 本脚本由 Node + tsx 运行，仓库未安装 @types/node。
import assert from 'node:assert/strict'
// @ts-expect-error 本脚本由 Node + tsx 运行，仓库未安装 @types/node。
import { existsSync, readFileSync } from 'node:fs'
// @ts-expect-error 本脚本由 Node + tsx 运行，仓库未安装 @types/node。
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const warehouseSource = readFileSync(
  `${ROOT}/src/pages/process-factory/cutting/warehouse-hub.ts`,
  'utf8',
)
const actionsPath = `${ROOT}/src/pages/process-factory/cutting/wait-handover-actions.ts`
const dialogsPath = `${ROOT}/src/pages/process-factory/cutting/wait-handover-dialogs.ts`
assert(existsSync(actionsPath), 'Web 六动作状态和 handler 必须拆到 wait-handover-actions.ts')
assert(existsSync(dialogsPath), 'Web 六动作模板必须拆到 wait-handover-dialogs.ts')
const actionsSource = readFileSync(actionsPath, 'utf8')
const dialogsSource = readFileSync(dialogsPath, 'utf8')
const webActionSources = `${warehouseSource}\n${actionsSource}\n${dialogsSource}`
const handlersSource = readFileSync(
  `${ROOT}/src/main-handlers/fcs-handlers.ts`,
  'utf8',
)
const rendererSource = readFileSync(
  `${ROOT}/src/router/route-renderers-fcs.ts`,
  'utf8',
)
const routesSource = readFileSync(
  `${ROOT}/src/router/routes-fcs.ts`,
  'utf8',
)

assert(
  rendererSource.includes(
    "() => import('../pages/process-factory/cutting/warehouse-hub')",
  ),
  '待交出仓路由必须保留真实仓库工作台',
)
assert(
  routesSource.includes(
    "'/fcs/craft/cutting/warehouse-management/wait-handover': () => renderCraftCuttingWarehouseManagementWaitHandoverPage()",
  ),
  '待交出仓工作台必须保持既有菜单路由可达',
)
assert(
  !handlersSource.includes('handleCraftCuttingWaitHandoverWebActionsEvent'),
  '旧 Mock Web 弹窗处理器不得先于真实仓库处理器截获动作',
)
assert(
  !existsSync(
    `${ROOT}/src/pages/process-factory/cutting/wait-handover-web-actions.ts`,
  ),
  '旧 Mock Web 弹窗模块必须移除，避免保留第二套状态与写入路径',
)

for (const text of ['库存明细', '特殊工艺回仓', '库位图']) {
  assert(warehouseSource.includes(text), `待交出仓工作台不得丢失原功能：${text}`)
}
for (const [action, label] of [
  ['bagging', '菲票装袋'],
  ['inbound', '中转袋入仓'],
  ['repack', '拆袋重装'],
  ['handover', '中转袋交出'],
  ['recovery', '中转袋回收'],
  ['scrap', '中转袋报废'],
] as const) {
  assert(
    webActionSources.includes(
      `data-wait-handover-action="open-${action}">${label}</button>`,
    ),
    `${label}必须直接进入真实仓库事实账弹窗`,
  )
  assert.equal(
    webActionSources.match(new RegExp(`data-wait-handover-action="open-${action}"`, 'g'))?.length,
    1,
    `${label}顶层动作必须且只能出现一次`,
  )
  assert.match(
    webActionSources,
    new RegExp(`data-skip-page-rerender="true"[^>]*data-wait-handover-action="open-${action}"`),
    `${label}必须屏蔽整页重渲染`,
  )
}
assert(
  !webActionSources.includes('data-wait-handover-action="open-special-craft-return"'),
  '特殊工艺回仓不得作为顶层动作，只能由中转袋入仓识别分支',
)

for (const sharedCommand of [
  'appendWaitHandoverBaggingEvent(',
  'appendWaitHandoverInboundEvent(',
  'submitTransferBagRepack(',
  'submitWholeBagHandover(',
  'recoverTransferBag(',
  'recoverThenScrapTransferBag(',
  'submitTransferBagScrap(',
  'submitSpecialCraftBagReturn(',
]) {
  assert(actionsSource.includes(sharedCommand), `Web handler 必须调用共享命令：${sharedCommand}`)
}
assert(!dialogsSource.includes('transfer-bag-operations'), '弹窗模板不得直接写中转袋事实')
assert(!dialogsSource.includes('wait-handover-runtime'), '弹窗模板不得直接调用运行命令')
assert(
  actionsSource.includes('data-wait-handover-workbench-data')
  && actionsSource.includes('replaceWith('),
  '成功后必须只替换工作台数据区',
)
assert(
  !actionsSource.includes("new Event('higood:request-render')")
  && !actionsSource.includes('root.innerHTML'),
  '六动作 handler 不得触发 root.innerHTML 或整页 render 事件',
)
assert(
  actionsSource.includes('data-submit-lock') || actionsSource.includes('WeakSet<HTMLElement>'),
  '六动作提交必须有双击锁并复用共享命令幂等',
)
for (const section of ['来源袋 / 菲票', '按接收车缝工厂分组', '结果袋 / 复用旧袋', '合计与确认']) {
  assert(dialogsSource.includes(section), `重装宽工作区缺少分区：${section}`)
}
for (const label of ['普通回收', '强制回收', '实物袋已收到', '实物袋为空', '强制回收原因']) {
  assert(dialogsSource.includes(label), `回收弹窗缺少防错内容：${label}`)
}
for (const label of ['先拆袋重装', '回收后再报废', '二次确认']) {
  assert(dialogsSource.includes(label), `报废弹窗缺少危险动作防错：${label}`)
}

const inboundDialogBranch = dialogsSource.match(
  /action === 'inbound'([\s\S]*?)action === 'repack'/,
)?.[1] || dialogsSource
assert(inboundDialogBranch, '必须保留中转袋入仓弹窗分支')
assert(
  inboundDialogBranch.includes('中转袋二维码 / 袋码')
  && inboundDialogBranch.includes('库区')
  && inboundDialogBranch.includes('库位'),
  '入仓弹窗必须只要求袋码、库区和库位',
)
assert(
  !inboundDialogBranch.includes('data-wait-handover-field="feiTicketId"')
  && !inboundDialogBranch.includes('data-wait-handover-field="ticketScanInput"'),
  '中转袋入仓不得再次选择或扫描菲票',
)
assert(
  actionsSource.includes('resolveWaitHandoverBaggingSnapshot('),
  '入仓必须按袋号读取装袋时的不可变菲票快照',
)
assert(
  !webActionSources.includes('function submitWaitHandoverBaggingConfirm('),
  'Web 端不得继续产生“交出装袋确认”第二次装袋事实',
)
assert(
  !webActionSources.includes(
    "action === 'submit-handover-bagging-confirm'",
  ),
  'Web 动作分发不得保留“交出装袋确认”写入口',
)
assert(
  actionsSource.includes('submitWholeBagHandover({')
  && actionsSource.includes('isCompleteSuccessfulWholeBagHandoverEvent(event)'),
  'Web 整袋交出必须走权威整袋提交并在成功后复核完整事实',
)
assert(
  !webActionSources.includes('appendWaitHandoverHandoverRecordEvent({'),
  'Web 整袋交出不得继续调用旧简化交出 writer',
)

const runtimeLedger = await import(
  '../src/data/fcs/cutting/cutting-runtime-event-ledger.ts'
)
const runtime = await import(
  '../src/pages/process-factory/cutting/wait-handover-runtime.ts'
)

function createMemoryStorage() {
  const records = new Map<string, string>()
  return {
    getItem(key: string) {
      return records.get(key) ?? null
    },
    setItem(key: string, value: string) {
      records.set(key, value)
    },
    removeItem(key: string) {
      records.delete(key)
    },
  }
}

const storage = createMemoryStorage()
const bagCode = 'WEB-REAL-BAG-001'
const occurredAt = '2026-07-30 15:00'
const usageCycleId = runtime.buildWaitHandoverUsageCycleId(
  bagCode,
  occurredAt,
)
const ticket = {
  feiTicketId: 'WEB-REAL-FEI-ID-001',
  feiTicketNo: 'WEB-REAL-FEI-001',
  productionOrderId: 'WEB-REAL-PO-ID-001',
  productionOrderNo: 'WEB-REAL-PO-001',
  cutOrderId: 'WEB-REAL-CUT-ID-001',
  cutOrderNo: 'WEB-REAL-CUT-001',
  spreadingOrderId: 'WEB-REAL-SPREAD-ID-001',
  spreadingOrderNo: 'WEB-REAL-SPREAD-001',
  spuCode: 'WEB-REAL-SPU-001',
  color: '黑色',
  size: 'M',
  partCode: 'FRONT',
  partName: '前幅',
  pieceQty: 12,
  pieceSequenceLabel: '1-12',
  hasSpecialCraft: false,
  specialCraftDisplay: '无',
  receiverFactoryDisplay: '无',
  printStatus: '已打印',
  voidStatus: '有效',
}

runtime.appendWaitHandoverBaggingEvent({
  source: 'WEB',
  operator: { operatorName: 'Web 装袋员' },
  bagCode,
  tickets: [ticket],
  occurredAt,
  usageCycleId,
  storage,
})
const snapshot = runtime.resolveWaitHandoverBaggingSnapshot(
  bagCode,
  storage,
)
assert(snapshot, '必须能按袋号读取当前使用周期的装袋快照')
assert.equal(snapshot.usageCycleId, usageCycleId)
assert.equal(snapshot.productionOrderNo, ticket.productionOrderNo)
assert.deepEqual(snapshot.tickets, [ticket])

const inboundEvent = runtime.appendWaitHandoverInboundEvent({
  source: 'WEB',
  operator: { operatorName: 'Web 入仓员' },
  bagCode,
  warehouseArea: '裁片暂存区',
  locationCode: 'A-01-01',
  occurredAt: '2026-07-30 15:10',
  storage,
})
assert.equal(inboundEvent.refs.usageCycleId, usageCycleId)
assert.deepEqual(
  (inboundEvent.payload as { feiTicketItems: unknown[] }).feiTicketItems,
  (
    runtimeLedger.listCuttingRuntimeEvents(storage)
      .find((event: { eventType: string }) => event.eventType === '菲票装袋')
      ?.payload as { feiTicketItems: unknown[] }
  ).feiTicketItems,
  '入仓事实必须原样沿用装袋快照，不接受第二套菲票输入',
)
assert.equal(
  runtime.buildWaitHandoverLifecycleByBagCode(bagCode, storage).flowStage,
  'INBOUND_STORED',
)

assert.throws(
  () => runtime.appendWaitHandoverBaggingEvent({
    source: 'WEB',
    operator: { operatorName: 'Web 装袋员' },
    bagCode: 'WEB-REAL-BAG-MIXED',
    tickets: [
      ticket,
      {
        ...ticket,
        feiTicketId: 'WEB-REAL-FEI-ID-002',
        feiTicketNo: 'WEB-REAL-FEI-002',
        productionOrderId: 'WEB-REAL-PO-ID-002',
        productionOrderNo: 'WEB-REAL-PO-002',
      },
    ],
    occurredAt: '2026-07-30 16:00',
    storage,
  }),
  /同一生产单/,
  '真实装袋入口必须阻断一个袋混入多个生产单',
)

const browserStorage = createMemoryStorage()
let rejectAuthoritativeWrite = false
const guardedBrowserStorage = {
  getItem: browserStorage.getItem,
  setItem(key: string, value: string) {
    if (
      rejectAuthoritativeWrite
      && value.includes('whole-bag-handover:')
    ) throw new Error('模拟 Web 权威账本写入失败')
    browserStorage.setItem(key, value)
  },
  removeItem: browserStorage.removeItem,
}
const alerts: string[] = []
let removedDialogCount = 0
let refreshCount = 0
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    localStorage: guardedBrowserStorage,
    location: { pathname: '/fcs/craft/cutting/warehouse-management/wait-handover', search: '' },
    alert(message: string) {
      alerts.push(message)
    },
    dispatchEvent() {
      refreshCount += 1
      return true
    },
  },
})
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: guardedBrowserStorage,
})
Object.defineProperty(globalThis, 'document', {
  configurable: true,
  value: {
    getElementById() {
      return { remove: () => { removedDialogCount += 1 } }
    },
  },
})

const warehouseModule = await import(
  '../src/pages/process-factory/cutting/warehouse-hub.ts'
)
assert.equal(
  typeof warehouseModule.buildWaitHandoverConfirmSelections,
  'function',
  '真实 Web handler 检查必须能读取其当前可交出选择，而不是在测试中绕过页面直接写数据层',
)

browserStorage.removeItem(runtimeLedger.CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY)
const handlerBagCode = 'WEB-HANDLER-BAG-001'
const handlerUsageCycleId = runtime.buildWaitHandoverUsageCycleId(handlerBagCode, '2026-07-30 17:00')
runtime.appendWaitHandoverBaggingEvent({
  source: 'WEB',
  operator: { operatorName: 'Web Handler 装袋员' },
  bagCode: handlerBagCode,
  tickets: [{ ...ticket, hasSpecialCraft: false }],
  occurredAt: '2026-07-30 17:00',
  usageCycleId: handlerUsageCycleId,
  storage: guardedBrowserStorage,
})
runtime.appendWaitHandoverInboundEvent({
  source: 'WEB',
  operator: { operatorName: 'Web Handler 入仓员' },
  bagCode: handlerBagCode,
  warehouseArea: 'Web Handler 待交出区',
  locationCode: 'WEB-001',
  locationRef: {
    factoryId: 'FACTORY-WEB-HANDLER',
    warehouseId: 'WAREHOUSE-WEB-HANDLER',
    warehouseKind: 'WAIT_HANDOVER',
    areaId: 'AREA-WEB-HANDLER',
    areaName: 'Web Handler 待交出区',
    shelfId: 'SHELF-WEB-HANDLER',
    shelfNo: 'WEB',
    locationId: 'LOCATION-WEB-HANDLER-001',
    locationNo: 'WEB-001',
  },
  occurredAt: '2026-07-30 17:10',
  usageCycleId: handlerUsageCycleId,
  storage: guardedBrowserStorage,
})
const handlerSelection = warehouseModule.buildWaitHandoverConfirmSelections()
  .find((selection) => selection.bagCode === handlerBagCode)
assert(
  handlerSelection,
  '测试数据中必须找到具有当前车缝任务和接收工厂分配的真实 Web 可交出中转袋',
)

const fieldValues: Record<string, string> = {
  handoverSelection: handlerSelection.value,
  operatorName: 'Web Handler 交出员',
}
const dialog = {
  querySelector(selector: string) {
    const field = selector.match(/data-wait-handover-field="([^"]+)"/)?.[1] || ''
    return field ? { value: fieldValues[field] || '' } : null
  },
}
const actionNode = {
  dataset: { waitHandoverAction: 'submit-handover' },
  closest(selector: string) {
    return selector === '[data-wait-handover-modal]' ? dialog : null
  },
}
const target = {
  closest(selector: string) {
    if (selector === '[data-wait-handover-modal] [data-warehouse-map-action]') return null
    if (selector === '[data-wait-handover-action], [data-wait-handover-web-action]') return actionNode
    return null
  },
}

rejectAuthoritativeWrite = true
assert.equal(
  warehouseModule.handleCraftCuttingWaitHandoverEvent(target as unknown as HTMLElement),
  true,
  '真实 Web handler 必须接管交出点击',
)
rejectAuthoritativeWrite = false
assert.match(alerts.at(-1) || '', /模拟 Web 权威账本写入失败/, '权威账本写入失败必须保留原始错误提示')
assert.equal(removedDialogCount, 0, '权威写入失败不得关闭当前交出弹窗')
assert.equal(refreshCount, 0, '权威写入失败不得刷新成伪成功状态')
assert.equal(
  runtime.buildWaitHandoverLifecycleByBagCode(handlerBagCode, guardedBrowserStorage).flowStage,
  'INBOUND_STORED',
  '权威写入失败不得推进中转袋生命周期',
)

assert.equal(
  warehouseModule.handleCraftCuttingWaitHandoverEvent(target as unknown as HTMLElement),
  true,
  '真实 Web handler 重试必须仍可提交',
)
assert.equal(removedDialogCount, 0, '权威事实写入成功后仍保留弹窗以展示明确反馈')
assert.equal(refreshCount, 0, '权威事实写入成功后不得触发整页重渲染事件')
const handlerEvents = runtimeLedger.listCuttingRuntimeEvents(guardedBrowserStorage)
const handlerHandover = handlerEvents.find((event: { eventType: string }) => event.eventType === '新增交出记录')
assert(handlerHandover, '真实 Web handler 必须写入新增交出记录')
const operations = await import(
  '../src/data/fcs/cutting/transfer-bag-operations.ts'
)
assert.equal(operations.isCompleteSuccessfulWholeBagHandoverEvent(handlerHandover), true, '真实 Web handler 事件必须通过权威严格守卫')
const handlerPayload = handlerHandover.payload as {
  canonicalIntent: string
  handoverLegId: string
  transferBagUses: Array<{
    sewingTaskIds: string[]
    sewingTaskNos: string[]
    ticketSnapshot: unknown[]
    sourceWarehouseArea: string
    sourceLocationCode: string
  }>
}
assert.match(handlerPayload.canonicalIntent, /"handoverLegId"/, 'Web 交出必须持久化 canonical 业务意图')
assert.equal(handlerPayload.handoverLegId, `${handlerUsageCycleId}:handover:1`, 'Web 交出必须使用共享动态流转段')
assert(handlerPayload.transferBagUses[0].sewingTaskIds.length > 0, 'Web 交出必须持久化实际车缝任务 ID 数组')
assert(handlerPayload.transferBagUses[0].sewingTaskNos.length > 0, 'Web 交出必须持久化实际车缝任务号数组')
assert(handlerPayload.transferBagUses[0].ticketSnapshot.length > 0, 'Web 交出必须持久化当前完整袋内快照')
assert.equal(handlerPayload.transferBagUses[0].sourceWarehouseArea, 'Web Handler 待交出区')
assert.match(handlerPayload.transferBagUses[0].sourceLocationCode, /^WEB-/)
assert.equal(
  runtime.buildWaitHandoverLifecycleByBagCode(handlerBagCode, guardedBrowserStorage).flowStage,
  'HANDED_OVER_WAITING_RETURN',
  '真实 Web handler 成功后必须由权威事实推进生命周期',
)

console.log('check:web-cutting-transfer-bag-actions passed')
