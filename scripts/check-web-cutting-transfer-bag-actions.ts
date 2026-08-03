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

for (const text of ['库存明细', '特种工艺回收入仓', '库位图']) {
  assert(warehouseSource.includes(text), `待交出仓工作台不得丢失原功能：${text}`)
}
for (const [action, label] of [
  ['bagging', '菲票装袋'],
  ['inbound', '中转袋入仓'],
  ['handover', '中转袋交出'],
] as const) {
  assert(
    warehouseSource.includes(
      `data-wait-handover-action="open-${action}">${label}</button>`,
    ),
    `${label}必须直接进入真实仓库事实账弹窗`,
  )
}

const inboundDialogBranch = warehouseSource.match(
  /: action === 'inbound'([\s\S]*?): action === 'handover'/,
)?.[1] || ''
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
  warehouseSource.includes('resolveWaitHandoverBaggingSnapshot('),
  '入仓必须按袋号读取装袋时的不可变菲票快照',
)
assert(
  !warehouseSource.includes('function submitWaitHandoverBaggingConfirm('),
  'Web 端不得继续产生“交出装袋确认”第二次装袋事实',
)
assert(
  !warehouseSource.includes(
    "action === 'submit-handover-bagging-confirm'",
  ),
  'Web 动作分发不得保留“交出装袋确认”写入口',
)

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
runtime.appendWaitHandoverBaggingEvent({
  source: 'WEB',
  operator: { operatorName: 'Web 装袋员' },
  bagCode: multiBagCode,
  tickets: [ticket],
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
const multiHandoverEvent = {
  ...structuredClone(multiInboundEvent),
  eventId: 'WEB-REAL-HANDOVER-MULTI-001',
  eventType: '新增交出记录' as const,
  occurredAt: '2026-08-01 09:10',
  inventoryEffect: { inventoryScope: '裁床待交出仓', direction: 'OUT' as const, qty: 12, unit: '片' as const },
  payload: { transferBagCode: multiBagCode, warehouseLocations: multiLocations },
}
assert.equal(
  runtime.buildWaitHandoverLocationOccupancyStates([multiInboundEvent, multiHandoverEvent]).length,
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

console.log('check:web-cutting-transfer-bag-actions passed')
