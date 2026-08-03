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
    webActionSources.match(new RegExp(`data-wait-handover-action="open-${action}">${label}</button>`, 'g'))?.length,
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

const handoverProjectionSource = warehouseSource.match(
  /function buildRuntimeHandoverTableProjection\([\s\S]*?\n}\n\n/,
)?.[0] || ''
const taskSevenSpecGaps = [
  !warehouseSource.includes("['INBOUND_STORED', 'READY_HANDOVER'].includes(lifecycle.flowStage || '')")
    ? 'P1-1：重装形成 READY_HANDOVER 后必须仍是可交出候选'
    : '',
  !webActionSources.includes('data-wait-handover-repack-result-row')
  || !actionsSource.includes('data-wait-handover-repack-ticket-assignment')
    ? 'P1-2：重装必须由员工按结果袋逐票显式分配，支持同厂同单拆多袋及同厂不同单隔离'
    : '',
  !actionsSource.includes('refreshBagEligibility')
  || !dialogsSource.includes('data-wait-handover-submit-disabled')
    ? 'P1-3：普通袋码输入必须本地识别资格，使用中袋不得提交报废'
    : '',
  !warehouseSource.includes('filterCurrentWaitHandoverRuntimeEvents')
  || !warehouseSource.includes('历史重装记录')
    ? 'P1-4：旧交出装袋确认只能作为历史重装记录，不得进入当前事件、动作或 KPI'
    : '',
  handoverProjectionSource.includes(': listHandoverRecords()')
    ? 'P1-5：交出页不得在运行时事实为空时回退 JCR 演示记录'
    : '',
  !warehouseSource.includes('data-wait-handover-pagination-action="next"')
  || warehouseSource.includes('filterWaitHandoverInboundTempBags(inboundTempBags, filters).slice(')
  || warehouseSource.includes('specialCraftReturnProjection.records.slice(')
  || warehouseSource.includes('].slice(0, 16)')
  || actionsSource.includes('.slice(0, 20)')
    ? 'P1-6：Task 7 列表必须使用真实本地分页且不得预截断数据'
    : '',
].filter(Boolean)
assert.deepEqual(
  taskSevenSpecGaps,
  [],
  `Task 7 独立规格审查仍有缺口：\n${taskSevenSpecGaps.join('\n')}`,
)

const taskSevenSecondReviewGaps = [
  !actionsSource.includes('buildRepackSourceCurrents')
  || !actionsSource.includes('resolveActionBagCurrent(bagCode).tickets')
  || !dialogsSource.includes('selected: item.value === model.current?.bagCode')
    ? 'P1-A：报废引导打开重装后必须预选并解析权威来源袋当前菲票'
    : '',
  !dialogsSource.includes('renderWaitHandoverRecoveryEligibility')
  || !dialogsSource.includes('isWaitHandoverRecoveryBlocked')
  || !actionsSource.includes('refreshRecoveryEligibility')
    ? 'P1-B：回收必须按当前袋状态、实物确认、模式与原因本地闭环资格'
    : '',
  !actionsSource.includes('refreshScrapEligibility')
  || !actionsSource.includes("'recoverFirst'")
  || !actionsSource.includes("'authorizedBy'")
  || !actionsSource.includes("'secondConfirm'")
    ? 'P2-C：已交出袋报废必须在回收后再报废及必要输入齐备后才开放'
    : '',
].filter(Boolean)
assert.deepEqual(
  taskSevenSecondReviewGaps,
  [],
  `Task 7 第二次独立规格审查仍有缺口：\n${taskSevenSecondReviewGaps.join('\n')}`,
)

const recoveryEligibilitySource = dialogsSource.match(
  /export function isWaitHandoverRecoveryBlocked\([\s\S]*?\n}\n/,
)?.[0] || ''
for (const field of [
  'physicalBagReceived',
  'physicalBagEmpty',
  'recoveryNode',
  'recoveryLocation',
  'reason',
  'operatorName',
  'secondConfirm',
]) {
  assert(
    recoveryEligibilitySource.includes(`input.${field}`),
    `普通与强制回收本地门禁都必须校验 ${field}`,
  )
}
assert(
  !recoveryEligibilitySource.includes("input.recoveryMode === 'FORCED' && (!input.reason || !input.secondConfirm)"),
  '普通回收不得跳过原因和二次确认',
)
for (const field of ['recoveryNode', 'recoveryLocation', 'operatorName']) {
  assert(
    actionsSource.includes(`${field}: readField(dialog, '${field}')`),
    `回收局部资格快照必须读取 ${field}`,
  )
}

const specialCraftReturnSubmit = warehouseSource.match(
  /function submitWaitHandoverSpecialCraftReturn[\s\S]*?\n}\n\nexport function handleCraftCuttingWaitHandoverEvent/,
)?.[0] || ''
assert(specialCraftReturnSubmit, '必须保留 Web 特殊工艺回仓提交入口')
assert.match(
  specialCraftReturnSubmit,
  /revalidateWarehouseLocationSelection\([\s\S]*waitHandoverSelectedLocationIds/,
  'Web 特殊工艺回仓提交前必须基于最新待交出仓投影一次复核全部所选库位',
)
assert.match(
  specialCraftReturnSubmit,
  /warehouseLocations,/,
  'Web 特殊工艺回仓事件必须提交全部稳定库位引用',
)
assert.doesNotMatch(
  specialCraftReturnSubmit,
  /\blocationRef\s*:/,
  'Web 特殊工艺回仓新事件不得双写旧单库位 locationRef',
)

const runtimeLedger = await import(
  '../src/data/fcs/cutting/cutting-runtime-event-ledger.ts'
)
const runtime = await import(
  '../src/pages/process-factory/cutting/wait-handover-runtime.ts'
)
const operations = await import(
  '../src/data/fcs/cutting/transfer-bag-operations.ts'
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

const multiStorage = createMemoryStorage()
const multiBagCode = 'WEB-REAL-BAG-MULTI-001'
const multiUsageCycleId = runtime.buildWaitHandoverUsageCycleId(
  multiBagCode,
  '2026-08-01 09:00',
)
const multiTicket = {
  ...ticket,
  sewingTaskId: 'WEB-MULTI-SEW-ID-001',
  sewingTaskNo: 'WEB-MULTI-SEW-001',
  receiverFactoryId: 'WEB-MULTI-FACTORY-ID-001',
  receiverFactoryName: 'Web 多库位车缝厂',
}
runtime.appendWaitHandoverBaggingEvent({
  source: 'WEB',
  operator: { operatorName: 'Web 装袋员' },
  bagCode: multiBagCode,
  tickets: [multiTicket],
  occurredAt: '2026-08-01 09:00',
  usageCycleId: multiUsageCycleId,
  storage: multiStorage,
})
const multiLocations = [
  {
    factoryId: 'CUTTING-CENTER', warehouseId: 'CUTTING-WAIT-HANDOVER', warehouseKind: 'WAIT_HANDOVER',
    areaId: 'AREA-A', areaCode: 'A', areaName: 'A 区',
    shelfId: 'SHELF-A-01', shelfSequence: 1, shelfNo: 'R01',
    locationId: 'LOC-A-R01-L01-P01', locationNo: 'A-R01-L01-P01', locationName: 'A-R01-L01-P01',
    levelNo: 1, positionNo: 1, areaStatus: 'AVAILABLE', shelfStatus: 'AVAILABLE', status: 'AVAILABLE', orderIndex: 0,
  },
  {
    factoryId: 'CUTTING-CENTER', warehouseId: 'CUTTING-WAIT-HANDOVER', warehouseKind: 'WAIT_HANDOVER',
    areaId: 'AREA-B', areaCode: 'B', areaName: 'B 区',
    shelfId: 'SHELF-B-02', shelfSequence: 2, shelfNo: 'R02',
    locationId: 'LOC-B-R02-L03-P02', locationNo: 'B-R02-L03-P02', locationName: 'B-R02-L03-P02',
    levelNo: 3, positionNo: 2, areaStatus: 'AVAILABLE', shelfStatus: 'AVAILABLE', status: 'AVAILABLE', orderIndex: 1,
  },
] as const
const multiInboundEvent = runtime.appendWaitHandoverInboundEvent({
  source: 'WEB',
  operator: { operatorName: 'Web 入仓员' },
  bagCode: multiBagCode,
  warehouseArea: multiLocations[0].areaName,
  locationCode: multiLocations[0].locationNo,
  locationRef: multiLocations[0],
  warehouseLocations: multiLocations,
  occurredAt: '2026-08-01 09:05',
  usageCycleId: multiUsageCycleId,
  storage: multiStorage,
} as Parameters<typeof runtime.appendWaitHandoverInboundEvent>[0] & { warehouseLocations: typeof multiLocations })
assert.deepEqual(
  (multiInboundEvent.payload as { warehouseLocations?: unknown[] }).warehouseLocations,
  multiLocations,
  'Web 入仓事件必须一次保存全部稳定库位引用和提交时编号快照',
)
assert.equal(
  (multiInboundEvent.payload as { locationRef?: unknown }).locationRef,
  undefined,
  '新入仓事实不得同时双写单库位 locationRef',
)
const multiStates = runtime.buildWaitHandoverLocationOccupancyStates([multiInboundEvent])
assert.equal(multiStates.length, 2, '一个中转袋选择两个库位后必须投影两个占用格')
assert.equal(new Set(multiStates.map((state: { bagCode: string }) => state.bagCode)).size, 1, '多库位占用的业务袋数量只能汇总一次')
assert.equal(new Set(multiStates.flatMap((state: { feiTicketIds: string[] }) => state.feiTicketIds)).size, 1, '多库位占用的菲票数量只能汇总一次')
operations.submitWholeBagHandover({
  bagCode: multiBagCode,
  usageCycleId: multiUsageCycleId,
  handoverOrderId: 'WEB-MULTI-HO-ID-001',
  handoverOrderNo: 'WEB-MULTI-HO-001',
  handoverRecordId: 'WEB-MULTI-HR-ID-001',
  handoverRecordNo: 'WEB-MULTI-HR-001',
  assignments: [{
    feiTicketId: multiTicket.feiTicketId,
    feiTicketNo: multiTicket.feiTicketNo,
    sewingTaskId: multiTicket.sewingTaskId,
    sewingTaskNo: multiTicket.sewingTaskNo,
    receiverFactoryId: multiTicket.receiverFactoryId,
    receiverFactoryName: multiTicket.receiverFactoryName,
  }],
  submittedTicketSnapshot: [multiTicket],
  operator: { operatorName: 'Web 多库位交出员' },
  source: 'WEB',
  occurredAt: '2026-08-01 09:10',
}, multiStorage)
assert.equal(
  runtime.buildWaitHandoverLocationOccupancyStates(
    runtimeLedger.listCuttingRuntimeEvents(multiStorage),
  ).length,
  0,
  '整袋交出必须一次释放该袋全部库位',
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

assert.equal(
  typeof runtime.preflightWaitHandoverBaggingEvent,
  'function',
  '共享 runtime 必须导出不写真实账本的装袋预校验',
)
const preflightStorage = createMemoryStorage()
const preflightBagCode = 'WEB-PREFLIGHT-HANDED-001'
const preflightUsageCycleId = runtime.buildWaitHandoverUsageCycleId(
  preflightBagCode,
  '2026-07-30 16:10',
)
const preflightTicket = {
  ...ticket,
  feiTicketId: 'WEB-PREFLIGHT-FEI-ID-001',
  feiTicketNo: 'WEB-PREFLIGHT-FEI-001',
  productionOrderId: 'WEB-PREFLIGHT-PO-ID-001',
  productionOrderNo: 'WEB-PREFLIGHT-PO-001',
  sewingTaskId: 'WEB-PREFLIGHT-SEW-ID-001',
  sewingTaskNo: 'WEB-PREFLIGHT-SEW-001',
  receiverFactoryId: 'WEB-PREFLIGHT-FACTORY-ID-001',
  receiverFactoryName: '预校验车缝工厂',
}
runtime.appendWaitHandoverBaggingEvent({
  source: 'WEB',
  operator: { operatorName: '预校验装袋员' },
  bagCode: preflightBagCode,
  tickets: [preflightTicket],
  occurredAt: '2026-07-30 16:10',
  usageCycleId: preflightUsageCycleId,
  storage: preflightStorage,
})
runtime.appendWaitHandoverInboundEvent({
  source: 'WEB',
  operator: { operatorName: '预校验入仓员' },
  bagCode: preflightBagCode,
  warehouseArea: '预校验待交出区',
  locationCode: 'PREFLIGHT-01',
  locationRef: {
    factoryId: 'FACTORY-PREFLIGHT',
    warehouseId: 'WAREHOUSE-PREFLIGHT',
    warehouseKind: 'WAIT_HANDOVER',
    areaId: 'AREA-PREFLIGHT',
    areaName: '预校验待交出区',
    shelfId: 'SHELF-PREFLIGHT',
    shelfNo: 'PREFLIGHT',
    locationId: 'LOCATION-PREFLIGHT-01',
    locationNo: 'PREFLIGHT-01',
  },
  occurredAt: '2026-07-30 16:20',
  usageCycleId: preflightUsageCycleId,
  storage: preflightStorage,
})
operations.submitWholeBagHandover({
  bagCode: preflightBagCode,
  usageCycleId: preflightUsageCycleId,
  handoverOrderId: 'WEB-PREFLIGHT-HO-ID-001',
  handoverOrderNo: 'WEB-PREFLIGHT-HO-001',
  handoverRecordId: 'WEB-PREFLIGHT-HR-ID-001',
  handoverRecordNo: 'WEB-PREFLIGHT-HR-001',
  assignments: [{
    feiTicketId: preflightTicket.feiTicketId,
    feiTicketNo: preflightTicket.feiTicketNo,
    sewingTaskId: preflightTicket.sewingTaskId,
    sewingTaskNo: preflightTicket.sewingTaskNo,
    receiverFactoryId: preflightTicket.receiverFactoryId,
    receiverFactoryName: preflightTicket.receiverFactoryName,
  }],
  submittedTicketSnapshot: [preflightTicket],
  operator: { operatorName: '预校验交出员' },
  source: 'WEB',
  occurredAt: '2026-07-30 16:30',
}, preflightStorage)
const preflightLedgerBefore = preflightStorage.getItem(
  runtimeLedger.CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY,
)
assert.throws(
  () => runtime.preflightWaitHandoverBaggingEvent({
    source: 'WEB',
    operator: { operatorName: '预校验装袋员' },
    bagCode: preflightBagCode,
    tickets: [
      preflightTicket,
      {
        ...preflightTicket,
        feiTicketId: 'WEB-PREFLIGHT-FEI-ID-002',
        feiTicketNo: 'WEB-PREFLIGHT-FEI-002',
        productionOrderId: 'WEB-PREFLIGHT-PO-ID-002',
        productionOrderNo: 'WEB-PREFLIGHT-PO-002',
      },
    ],
    occurredAt: '2026-07-30 16:40',
    storage: preflightStorage,
  }, (temporaryStorage) => {
    operations.ensureTransferBagAvailableForUse({
      bagCode: preflightBagCode,
      forceRecovery: {
        physicalBagReceived: true,
        physicalBagEmpty: true,
        recoveryNode: '裁床待交出仓',
        recoveryLocation: '装袋操作区',
        reason: '预校验强制回收',
        operator: { operatorName: '预校验装袋员' },
        source: 'WEB',
      },
    }, temporaryStorage)
  }),
  /同一生产单/,
  '跨生产单装袋必须在真实强制回收写入前失败',
)
assert.equal(
  preflightStorage.getItem(runtimeLedger.CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY),
  preflightLedgerBefore,
  '装袋预校验失败不得写入真实回收或装袋事实',
)
assert.equal(
  runtime.buildWaitHandoverLifecycleByBagCode(preflightBagCode, preflightStorage).flowStage,
  'HANDED_OVER_WAITING_RETURN',
  '装袋预校验失败后中转袋必须仍是已交出待回收',
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
