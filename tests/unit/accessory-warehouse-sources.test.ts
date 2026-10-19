import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildAccessoryPreparationSources,
  listAccessoryPreparations,
  findPostMigrationAccessoryConflicts,
  type AccessoryPreparationSourceInput,
} from '../../src/data/wls/accessory-warehouse-sources.ts'
import type { MaterialPrepLine, MaterialPrepOrderProjection } from '../../src/data/fcs/cutting/production-material-prep.ts'
import type { RuntimeProcessTask } from '../../src/data/fcs/runtime-process-tasks.ts'
import type { EffectiveTaskAssignment } from '../../src/data/fcs/effective-task-assignments.ts'
import type { ProductionOrderTechPackSnapshot } from '../../src/data/fcs/production-tech-pack-snapshot-types.ts'

function line(overrides: Partial<MaterialPrepLine> = {}): MaterialPrepLine {
  return {
    prepLineId: 'prep-line-zipper', prepOrderId: 'prep-1', materialType: '辅料',
    materialSku: 'SPU-1-bom-accessory-zipper', materialName: '拉链', materialImageUrl: '/materials/accessory-zipper.jpg',
    color: '灰色', spec: '60cm', unit: '条', requiredQty: 100, confirmedPrepQty: 20,
    availableStockQty: 80, stockLocationCode: 'ACC-B-001', taskLinks: [], ...overrides,
  } as MaterialPrepLine
}
function input(lines: MaterialPrepLine[] = [line()]): AccessoryPreparationSourceInput {
  return {
    projections: [{ order: { prepOrderId: 'prep-1', productionOrderId: 'PO-1', productionOrderNo: 'PO-001',
      styleName: '样例款', spu: 'SPU-1', spuImageUrl: '/hoodie.jpg', bomSourceLabel: 'BOM-1' },
      lines, prepRecords: [],
    } as MaterialPrepOrderProjection],
    orders: [], tasks: [], factories: [], assignments: [], savedPreparations: [],
  }
}
function snapshot(): ProductionOrderTechPackSnapshot {
  return { sourceTechPackVersionId: 'TP-1', bomItems: [], processEntries: [], patternFiles: [], colorMaterialMappings: [] } as unknown as ProductionOrderTechPackSnapshot
}
function task(overrides: Partial<RuntimeProcessTask> = {}): RuntimeProcessTask {
  return { taskId: 'CUT-1', productionOrderId: 'PO-1', processBusinessCode: 'CUT_PANEL', processCode: 'CUTTING',
    assignmentStatus: 'ASSIGNED', assignedFactoryId: 'SEA-CUTTING-002', assignedFactoryName: 'sea cutting (59)',
    executionEnabled: true, ...overrides,
  } as RuntimeProcessTask
}

test('来源保留配料身份、原实配、库存、真实单位与待定裁剪，不写入假分配', () => {
  const source = input([line(), line({ prepLineId: 'thread', materialType: '纱线', materialSku: 'SPU-1-bom-yarn-stitching',
    materialName: '缝纫线', unit: '公斤', requiredQty: 12, confirmedPrepQty: 3, availableStockQty: 9 })])
  const before = structuredClone(source)
  const result = buildAccessoryPreparationSources(source)
  assert.equal(result.issues.length, 0)
  assert.equal(result.preparations.length, 1)
  const [preparation] = result.preparations
  assert.equal(preparation.id, 'prep-1')
  assert.equal(preparation.lines[0].id, 'prep-line-zipper')
  assert.equal(preparation.lines[0].preparedQty, 20)
  assert.equal(preparation.lines[0].availableQty, 80)
  assert.equal(preparation.lines[1].unit, '公斤')
  assert.equal(preparation.lines[1].preparedQty, 3)
  assert.equal(preparation.lines[1].purpose, '车缝线')
  assert.equal(preparation.cuttingFactoryId, null)
  assert.equal(preparation.cuttingFactoryName, null)
  assert.deepEqual(source, before)
})

test('迁移后新旧冲突按明细范围识别，原样保留的共用头和其他工艺不误报', () => {
  const preparation = buildAccessoryPreparationSources(input()).preparations[0]
  const sharedReject = { rejectId: 'SHARED-REJECT', prepOrderId: preparation.id, prepLineId: 'prep-line-zipper', rejectReason: '原共用记录' }
  const late = { prepRecordId: 'LATE', prepOrderId: preparation.id, prepLineId: 'prep-line-zipper', preparedQty: 3 }
  const other = { prepRecordId: 'FABRIC', prepOrderId: preparation.id, prepLineId: 'other-fabric-line', preparedQty: 11 }
  const raw = JSON.stringify({ prepRecords: [late, other], rejectRecords: [sharedReject] })
  const conflicts = findPostMigrationAccessoryConflicts(raw, [preparation], [{ field: 'rejectRecords', sourceId: 'SHARED-REJECT', retainedShared: true, entry: sharedReject }])
  assert.equal(conflicts.length, 1)
  assert.equal(conflicts[0].sourceId, 'LATE')
  assert.equal(conflicts[0].preparationId, preparation.id)
  assert.deepEqual(conflicts[0].entry, late)
  const closed = findPostMigrationAccessoryConflicts(JSON.stringify({ closedOrders: [{ prepOrderId: preparation.id, closeReason: '旧页面新增关闭' }] }), [preparation], [])
  assert.equal(closed[0].field, 'closedOrders')
})

test('裁剪工厂只依有效任务 ID 查档案，历史近似文案和原HiGood厂不会冒用两地身份', () => {
  const source = input()
  source.tasks = [task()]
  source.factories = [{ id: 'SEA-CUTTING-002', name: 'sea cutting2' }, { id: 'OWN-CUTTING-001', name: 'HiGood 裁床厂' }]
  let result = buildAccessoryPreparationSources(source)
  assert.equal(result.preparations[0].cuttingFactoryName, 'sea cutting2')
  source.tasks = [task({ assignedFactoryId: 'OWN-CUTTING-001', assignedFactoryName: 'sea cutting' })]
  result = buildAccessoryPreparationSources(source)
  assert.equal(result.preparations[0].cuttingFactoryId, 'OWN-CUTTING-001')
  assert.equal(result.preparations[0].cuttingFactoryName, 'HiGood 裁床厂')
  source.tasks = [task({ assignmentStatus: 'UNASSIGNED', assignedFactoryId: undefined })]
  assert.equal(buildAccessoryPreparationSources(source).preparations[0].cuttingFactoryId, null)
  source.tasks = [task(), task({ taskId: 'CUT-2', assignmentStatus: 'UNASSIGNED', assignedFactoryId: undefined })]
  assert.equal(buildAccessoryPreparationSources(source).preparations[0].cuttingFactoryId, null)
})

test('取消旧分配不复活，冲突工厂与缺失工厂明确阻断', () => {
  const source = input()
  source.tasks = [task()]
  source.assignments = [{ runtimeTaskId: 'CUT-1', factoryId: 'SEA-CUTTING-001', status: 'CANCELLED' } as EffectiveTaskAssignment]
  assert.equal(buildAccessoryPreparationSources(source).preparations[0].cuttingFactoryId, null)
  source.assignments = []
  assert.equal(buildAccessoryPreparationSources(source).issues[0].code, 'FACTORY_MISSING')
  source.tasks.push(task({ taskId: 'CUT-2', assignedFactoryId: 'SEA-CUTTING-001' }))
  const result = buildAccessoryPreparationSources(source)
  assert.equal(result.issues[0].code, 'FACTORY_CONFLICT')
  assert.equal(result.preparations[0].cuttingFactoryId, null)
})

test('关联纸样、裁剪与毛织材料排除；准确吊牌字段保留，未知不按关键词归类', () => {
  const source = input([
    line(),
    line({ prepLineId: 'prep-1:TP-1:cut', runtimeBomLine: true, materialSku: 'CUT-RAW' }),
    line({ prepLineId: 'prep-1:TP-1:wool', runtimeBomLine: true, materialType: '纱线', materialSku: 'WOOL-RAW' }),
    line({ prepLineId: 'prep-1:TP-1:pattern', runtimeBomLine: true, materialSku: 'PATTERN-RAW' }),
    line({ prepLineId: 'price', materialType: '包材', materialSku: 'PRICE-NEW', materialName: '价格吊牌' }),
    line({ prepLineId: 'unknown', materialSku: 'UNKNOWN-01', materialName: '吊牌装饰纽扣线' }),
    line({ prepLineId: 'fabric', materialType: '面料' }),
  ])
  const pack = snapshot()
  pack.bomItems = [
    { id: 'cut', usageProcessCodes: ['CUT_PANEL'] },
    { id: 'wool', usageProcessCodes: ['PROC_WOOL'] },
    { id: 'pattern', linkedPatternIds: ['PAT-1'] },
  ] as typeof pack.bomItems
  source.orders = [{ productionOrderId: 'PO-1', techPackSnapshot: pack }]
  const result = buildAccessoryPreparationSources(source)
  assert.deepEqual(result.preparations[0].lines.map(entry => entry.id), ['prep-line-zipper', 'price', 'unknown'])
  assert.equal(result.preparations[0].lines[1].purpose, '价格吊牌')
  assert.equal(result.preparations[0].lines[2].purpose, '待核对')
  assert.equal(result.issues.find(issue => issue.lineId === 'unknown')?.code, 'UNKNOWN_PURPOSE')
})

test('同一来源保存覆盖生效，技术包版本或单位需求变化不套用旧配料清单', () => {
  const source = input()
  const saved = buildAccessoryPreparationSources(source).preparations[0]
  saved.version = 2
  saved.remark = '仓管备注'
  saved.lines[0].preparedQty = 50
  saved.lines[0].availableQty = 50
  source.savedPreparations = [saved]
  let result = buildAccessoryPreparationSources(source)
  assert.equal(result.preparations[0].remark, '仓管备注')
  assert.equal(result.preparations[0].lines[0].preparedQty, 50)
  source.projections[0].lines[0].requiredQty = 120
  result = buildAccessoryPreparationSources(source)
  assert.equal(result.preparations[0].lines[0].requiredQty, 120)
  assert.equal(result.preparations[0].lines[0].preparedQty, 20)
  assert.equal(result.issues[0].code, 'SOURCE_CHANGED')
  source.projections[0].lines[0].requiredQty = 100
  source.orders = [{ productionOrderId: 'PO-1', techPackSnapshot: snapshot() }]
  assert.equal(buildAccessoryPreparationSources(source).issues[0].code, 'SOURCE_CHANGED')
  assert.equal(saved.lines[0].preparedQty, 50)
})

test('损坏原配料资料读取报错，不降级为空或展示一份假种子结果', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: { getItem: () => '{broken' } } })
  try { assert.throws(() => listAccessoryPreparations(), /原配料资料格式损坏/) }
  finally {
    if (descriptor) Object.defineProperty(globalThis, 'window', descriptor)
    else Reflect.deleteProperty(globalThis, 'window')
  }
})

test('原配料存储拒绝读取时不伪装成空资料', async () => {
  // 单独模块实例避免上一错误状态掩盖本次实际存储读取。
  const modulePath = '../../src/data/wls/accessory-warehouse-sources.ts'
  const sources = await import(`${modulePath}?storage-blocked`)
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { get localStorage() { throw new Error('denied') } } })
  try { assert.throws(() => sources.listAccessoryPreparations(), /存储不可读取/) }
  finally {
    if (descriptor) Object.defineProperty(globalThis, 'window', descriptor)
    else Reflect.deleteProperty(globalThis, 'window')
  }
})
