#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import {
  appendManualPrepRecord,
  appendPickupRecordFromPrepRecord,
  closeMaterialPrepOrder,
  confirmMaterialPrepRecord,
  createProductionMaterialPrepSeedStore,
  getMaterialPrepOrderProjection,
  getMaterialPrepRecordContext,
  getMaterialPrepRecordItems,
  listMaterialPrepOrderProjections,
  listPdaTransferPickupCandidates,
  listPickupCandidates,
  materialPrepWorkbenchTabs,
  pickupWorkbenchTabs,
  rejectMaterialPrepRecord,
  serializeProductionMaterialPrepStore,
  type MaterialPrepOrderStatus,
  type PickupOrderStatus,
} from '../src/data/fcs/cutting/production-material-prep.ts'
import {
  renderCraftCuttingPickupManagementDetailPage,
  renderCraftCuttingPickupManagementPage,
} from '../src/pages/process-factory/cutting/pickup-management.ts'
import {
  renderWlsTransferMaterialPrepDetailPage,
  renderWlsTransferMaterialPrepPage,
} from '../src/pages/wls/transfer-material-prep.ts'

const repoRoot = process.cwd()

class MemoryStorage {
  private readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }
}

function read(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function assertIncludes(source: string, snippet: string, message: string): void {
  assert(source.includes(snippet), message)
}

function assertNotIncludes(source: string, snippet: string, message: string): void {
  assert(!source.includes(snippet), message)
}

function main(): void {
  const appShellConfig = read('src/data/app-shell-config.ts')
  const routes = read('src/router/routes.ts')
  const routesWls = read('src/router/routes-wls.ts')
  const routesFcs = read('src/router/routes-fcs.ts')
  const routeRenderersFcs = read('src/router/route-renderers-fcs.ts')
  const meta = read('src/pages/process-factory/cutting/meta.ts')
  const warehouseHub = read('src/pages/process-factory/cutting/warehouse-hub.ts')
  const pdaWaitProcess = read('src/pages/pda-warehouse-wait-process.ts')
  const dataSource = read('src/data/fcs/cutting/production-material-prep.ts')

  assertIncludes(appShellConfig, "title: '中转仓管理'", 'WLS 缺少一级菜单：中转仓管理')
  assertIncludes(appShellConfig, "title: '配料管理'", 'WLS 缺少二级菜单：配料管理')
  assertIncludes(appShellConfig, "href: '/wls/transfer-warehouse/material-prep'", 'WLS 配料管理菜单未指向新路由')
  assertIncludes(appShellConfig, "title: '领料管理'", 'PFOS 裁前准备缺少领料管理菜单')
  assertIncludes(appShellConfig, "href: '/fcs/craft/cutting/pickup-management'", 'PFOS 领料管理菜单未指向新路由')

  assertIncludes(routes, 'getWlsRoutes', '全局路由未注册 WLS route registry')
  assertIncludes(routesWls, '/wls/transfer-warehouse/material-prep', 'WLS 配料管理路由缺失')
  assertIncludes(routesWls, '/wls/transfer-warehouse/material-prep-detail', 'WLS 配料详情路由缺失')
  assertIncludes(routesFcs, '/fcs/craft/cutting/pickup-management', 'PFOS 领料管理路由缺失')
  assertIncludes(routesFcs, '/fcs/craft/cutting/pickup-management-detail', 'PFOS 领料详情路由缺失')
  assertIncludes(routeRenderersFcs, 'renderCraftCuttingPickupManagementPage', 'PFOS 领料管理 renderer 缺失')
  assertIncludes(routeRenderersFcs, 'renderCraftCuttingPickupManagementDetailPage', 'PFOS 领料详情 renderer 缺失')
  assertIncludes(meta, "'pickup-management'", '裁床页面元数据缺少 pickup-management')

  const prepStatuses = materialPrepWorkbenchTabs.map((tab) => tab.key)
  const pickupStatuses = pickupWorkbenchTabs.map((tab) => tab.key)
  const projections = listMaterialPrepOrderProjections(null)
  const requiredMaterialTypes = [
    { type: '面料', minimum: 3 },
    { type: '辅料', minimum: 3 },
    { type: '纱线', minimum: 1 },
    { type: '包材', minimum: 1 },
  ] as const
  assert(projections.length >= 7, '生产单级配料单样例不足，无法覆盖完整工作台状态')
  prepStatuses.forEach((status) => {
    assert(
      projections.some((projection) => projection.order.overallPrepStatus === status),
      `配料工作台缺少状态样例：${status}`,
    )
  })
  pickupStatuses.forEach((status) => {
    assert(
      projections.some((projection) => projection.order.pickupStatus === status),
      `领料工作台缺少状态样例：${status}`,
    )
  })

  projections.forEach((projection) => {
    assert(projection.order.productionOrderId && projection.order.productionOrderNo, '配料单必须以生产单为主对象')
    assert(!('taskId' in projection.order), '配料单不应以任务作为主对象')
    assert(projection.lines.length >= 8, `${projection.order.productionOrderNo} 物料需求行少于 8 个`)
    requiredMaterialTypes.forEach(({ type, minimum }) => {
      assert(
        projection.lines.filter((line) => line.materialType === type).length >= minimum,
        `${projection.order.productionOrderNo} ${type} 物料少于 ${minimum} 个`,
      )
    })
    projection.lines.forEach((line) => {
      ;[
        'prepLineId',
        'materialType',
        'materialImageUrl',
        'materialSku',
        'requiredQty',
        'confirmedPrepQty',
        'pickedQty',
        'remainingNeedQty',
        'availableStockQty',
        'canPrepQty',
        'shortageQty',
        'upstreamSourceType',
        'upstreamProgressStatus',
      ].forEach((field) => {
        assert(field in line, `配料需求行缺少字段：${field}`)
      })
      assert(line.materialImageUrl.startsWith('data:image/svg+xml'), `${projection.order.productionOrderNo} ${line.materialSku} 缺少物料图片`)
    })
  })

  const multiRecordOrder = getMaterialPrepOrderProjection('prep-order-po-202603-0101', null)
  assert(multiRecordOrder && multiRecordOrder.prepRecords.length >= 2, '一张配料单下必须支持多条配料记录')
  const multiItemRecord = multiRecordOrder.prepRecords.find((record) => getMaterialPrepRecordItems(record).length >= 2)
  assert(multiItemRecord, '配料记录必须支持记录内多物料明细')
  assert(multiRecordOrder.lines.some((line) => line.upstreamProgressStatus === '染色中'), '未配齐物料缺少染色进度')
  const shortageTrackingOrder = projections.find((projection) => projection.order.overallPrepStatus === 'SHORTAGE_TRACKING')
  assert(shortageTrackingOrder?.lines.some((line) => line.upstreamProgressStatus === '印花中'), '未配齐跟进缺少印花进度')
  const purchaseTrackingOrder = projections.find((projection) => projection.order.pickupStatus === 'ACTUAL_CLOSED')
  assert(purchaseTrackingOrder?.lines.some((line) => line.upstreamProgressStatus === '采购中'), '按实关闭场景缺少采购进度回落')
  const defaultDetailOrder = getMaterialPrepOrderProjection('prep-order-po-202603-0004', null)
  assert(defaultDetailOrder && defaultDetailOrder.prepRecords.length >= 2, '默认配料详情单必须补齐配料记录 mock')
  assert(defaultDetailOrder.pickupRecords.length >= 1, '默认配料详情单必须补齐关联领料记录 mock')
  assert(defaultDetailOrder.rejectRecords.length >= 1, '默认配料详情单必须补齐打回记录 mock')
  assert(defaultDetailOrder.order.overallPrepStatus === 'NEED_PREP', '默认配料详情单补齐 mock 后仍应保持待配料状态')

  const pickupCandidates = listPickupCandidates(null)
  assert(pickupCandidates.length > 0, '已确认配料记录未进入领料可领投影')
  assert(pickupCandidates.every((candidate) => candidate.prepRecordId && candidate.availableToPickupQty > 0), '可领投影必须按配料记录计算可领数量')
  assert(
    pickupCandidates.some((candidate) => candidate.prepRecordId === 'prep-rec-po-0007-main-001' && candidate.availableToPickupQty === 1008),
    '领料详情默认样例必须有已确认可领的配料记录 mock',
  )
  const pdaCandidates = listPdaTransferPickupCandidates(null)
  assert(pdaCandidates.length === pickupCandidates.length, 'PDA 可领投影必须与 PC 领料管理同源')
  assert(pdaCandidates.every((candidate) => candidate.prepRecordId), 'PDA 可领投影缺少 prepRecordId')

  const storage = new MemoryStorage()
  storage.setItem('productionMaterialPrepWorkflow', serializeProductionMaterialPrepStore(createProductionMaterialPrepSeedStore()))
  assert(
    !listPickupCandidates(storage).some((candidate) => candidate.prepRecordId === multiItemRecord.prepRecordId),
    '未确认的多物料配料记录不可进入领料管理',
  )
  const confirmedMultiItemRecord = confirmMaterialPrepRecord(multiItemRecord.prepRecordId, '中转仓 林洁', storage)
  assert(confirmedMultiItemRecord, '多物料配料记录确认后必须返回整条记录')
  assert(confirmedMultiItemRecord.recordStatus === 'CONFIRMED', '配料确认必须作用于整条配料记录')
  const confirmedMultiItemCount = getMaterialPrepRecordItems(confirmedMultiItemRecord).length
  assert(
    listPickupCandidates(storage).filter((candidate) => candidate.prepRecordId === confirmedMultiItemRecord.prepRecordId).length === confirmedMultiItemCount,
    '整条配料记录确认后，记录内所有物料明细都必须进入领料候选',
  )
  rejectMaterialPrepRecord(multiItemRecord.prepRecordId, '整条配料记录需重配', '记录内任一物料核对异常，整条配料记录退回重新确认。', '裁床 李明', storage)
  assert(
    !listPickupCandidates(storage).some((candidate) => candidate.prepRecordId === multiItemRecord.prepRecordId),
    '整条配料记录被打回后，记录内物料明细都不可继续领料',
  )
  const addedRecord = appendManualPrepRecord({
    prepOrderId: 'prep-order-po-202603-0004',
    prepLineId: 'prep-line-po-0004-main',
    preparedQty: 300,
    rollCount: 1,
    warehouseArea: '中转仓 A 区',
    locationCode: 'TR-A-099',
    operatorName: '中转仓 周敏',
  }, storage)
  assert(addedRecord.recordStatus === 'DRAFT', '手动新增配料记录必须先进入未确认状态')
  assert(getMaterialPrepRecordItems(addedRecord).length === 1, '手动新增配料记录必须生成记录内物料明细')
  assert(!listPickupCandidates(storage).some((candidate) => candidate.prepRecordId === addedRecord.prepRecordId), '未确认配料记录不可进入领料管理')
  const confirmedAddedRecord = confirmMaterialPrepRecord(addedRecord.prepRecordId, '中转仓 周敏', storage)
  assert(confirmedAddedRecord?.recordStatus === 'CONFIRMED', '确认按钮必须确认整条配料记录')
  assert(listPickupCandidates(storage).some((candidate) => candidate.prepRecordId === addedRecord.prepRecordId), '确认后的配料记录必须进入领料管理')
  assert(
    (() => {
      try {
        rejectMaterialPrepRecord(addedRecord.prepRecordId, '', '', '裁床 李明', storage)
        return false
      } catch {
        return true
      }
    })(),
    '打回配料记录必须要求填写原因',
  )
  rejectMaterialPrepRecord(addedRecord.prepRecordId, '数量与配料记录不一致', '现场核对少 1 卷', '裁床 李明', storage)
  assert(!listPickupCandidates(storage).some((candidate) => candidate.prepRecordId === addedRecord.prepRecordId), '被打回的配料记录不可继续领料')
  const rejectedProjection = getMaterialPrepOrderProjection('prep-order-po-202603-0004', storage)
  assert(rejectedProjection?.order.overallPrepStatus === 'REJECTED_REWORK', '下游打回应使配料单进入被打回待重配')

  const waitCandidate = listPickupCandidates(storage).find((candidate) => candidate.prepRecordId === 'prep-rec-po-0007-main-001')
  assert(waitCandidate, '缺少待领料候选配料记录')
  appendPickupRecordFromPrepRecord({
    prepRecordId: waitCandidate.prepRecordId,
    prepLineId: waitCandidate.prepLineId,
    pickedQty: waitCandidate.availableToPickupQty,
    rollCount: waitCandidate.rollCount,
    receiverName: '裁床 李明',
    warehouseArea: '待加工仓 A 区',
    locationCode: 'FAB-A-09',
    waitProcessLedgerEventId: 'check-runtime-pickup',
  }, storage)
  const pickedContext = getMaterialPrepRecordContext(waitCandidate.prepRecordId, waitCandidate.prepLineId, storage)
  assert(pickedContext?.availableToPickupQty === 0, '领料记录必须扣减配料记录可领数量')
  closeMaterialPrepOrder('prep-order-po-202603-0004', '后续不再配，按实关闭', '中转仓 周敏', storage)
  const closedProjection = getMaterialPrepOrderProjection('prep-order-po-202603-0004', storage)
  assert(closedProjection?.order.pickupStatus === 'ACTUAL_CLOSED', '配料关闭后领料端必须显示按实完结')

  const wlsListHtml = renderWlsTransferMaterialPrepPage()
  ;['配料管理', '配料工作台', '待配料', '可继续配料', '未配齐跟进', '查看详情'].forEach((snippet) => {
    assertIncludes(wlsListHtml, snippet, `WLS 配料列表页缺少文案：${snippet}`)
  })
  ;[
    '物料配料明细',
    '需要多少',
    '已配多少',
    '剩余未配',
    '配料记录',
    '领料记录',
    '是否还需要配料',
    '上游进度',
    '每个生产单至少 8 个物料',
    '面料 3 个',
    '辅料 3 个',
    '纱线 1 个',
    '包材 1 个',
    'data:image/svg+xml',
  ].forEach((snippet) => {
    assertIncludes(wlsListHtml, snippet, `WLS 配料列表页缺少物料级字段或图片：${snippet}`)
  })
  ;['1、生产需求信息', '2、当前中转仓库存信息与上游进度', '3、配料记录', '4、与配料记录关联的领料记录', '手动新增配料记录'].forEach((snippet) => {
    assertNotIncludes(wlsListHtml, snippet, `WLS 配料列表页不应混入详情内容：${snippet}`)
  })
  const previousWindow = (globalThis as any).window
  ;(globalThis as any).window = {
    location: {
      search: '?prepOrderId=prep-order-po-202603-0004',
    },
  }
  const wlsDetailHtml = renderWlsTransferMaterialPrepDetailPage()
  if (previousWindow === undefined) delete (globalThis as any).window
  else (globalThis as any).window = previousWindow
  ;['配料详情', '返回配料列表', '1、生产需求信息', '2、当前中转仓库存信息与上游进度', '3、配料记录', '4、与配料记录关联的领料记录', '采购', '印花', '染色', '手动新增配料记录', '确认整条配料记录', '记录内物料明细', '确认对象是整条配料记录'].forEach((snippet) => {
    assertIncludes(wlsDetailHtml, snippet, `WLS 配料详情页缺少文案：${snippet}`)
  })
  ;['BATCH-BLK-260316-D01', 'pickup-rec-po-0004-main-preview-001', '卷标缺失'].forEach((snippet) => {
    assertIncludes(wlsDetailHtml, snippet, `WLS 默认详情页缺少补齐的 mock 数据：${snippet}`)
  })
  ;['暂无领料记录。', '暂无打回记录。'].forEach((snippet) => {
    assertNotIncludes(wlsDetailHtml, snippet, `WLS 默认详情页不应再显示空记录：${snippet}`)
  })
  ;['确认 / 打回', '>确认配料</button>'].forEach((snippet) => {
    assertNotIncludes(wlsDetailHtml, snippet, `WLS 配料详情页不应把确认动作挂在物料行：${snippet}`)
  })
  const pickupHtml = renderCraftCuttingPickupManagementPage()
  ;['领料管理', '领料工作台', '待领料', '可部分领料', '待继续领料', '打回待仓库处理', '已领料完结', '按实完结', '去待加工仓领料', '查看详情'].forEach((snippet) => {
    assertIncludes(pickupHtml, snippet, `PFOS 领料列表页缺少文案：${snippet}`)
  })
  ;['可领配料记录', '打回配料记录', '领料详情', '打回原因（必填）'].forEach((snippet) => {
    assertNotIncludes(pickupHtml, snippet, `PFOS 领料列表页不应混入详情内容：${snippet}`)
  })
  ;(globalThis as any).window = {
    location: {
      search: '?prepOrderId=prep-order-po-202603-0007&prepRecordId=prep-rec-po-0007-main-001&fromTab=WAIT_PICKUP',
    },
  }
  const pickupDetailHtml = renderCraftCuttingPickupManagementDetailPage()
  if (previousWindow === undefined) delete (globalThis as any).window
  else (globalThis as any).window = previousWindow
  ;['领料详情', '返回领料列表', '查看中转仓配料详情', '可领配料记录', '打回配料记录', '打回原因（必填）', '打回对象是整条配料记录', 'BATCH-NVY-260316-01', 'prep-rec-po-0007-main-001', '1,008 米'].forEach((snippet) => {
    assertIncludes(pickupDetailHtml, snippet, `PFOS 领料详情页缺少文案或 mock：${snippet}`)
  })

  ;['prepRecordId', 'prepOrderId', 'prepLineId', 'prepContext?.item', '已关联配料记录', '记录内物料', '提交后会写回领料记录并入裁床待加工仓'].forEach((snippet) => {
    assertIncludes(warehouseHub, snippet, `待加工仓中转仓领料未关联配料记录字段：${snippet}`)
  })
  ;['listPdaTransferPickupCandidates', 'data-prep-record-id', 'data-prep-line-id', 'cuttingPickupPrepRecordId', 'cuttingPickupPrepLineId', 'prepRecordId'].forEach((snippet) => {
    assertIncludes(pdaWaitProcess, snippet, `PDA 中转仓领料未接入生产单级配料记录：${snippet}`)
  })
  ;['MaterialPrepOrder', 'MaterialPrepLine', 'MaterialPrepMaterialType', 'materialType', 'materialImageUrl', 'MaterialPrepRecord', 'MaterialPrepRecordItem', 'PickupRecord', 'PrepRejectRecord'].forEach((snippet) => {
    assertIncludes(dataSource, snippet, `字段级模型缺少：${snippet}`)
  })

  const prepStatusKeys = new Set<MaterialPrepOrderStatus>(projections.map((projection) => projection.order.overallPrepStatus))
  const pickupStatusKeys = new Set<PickupOrderStatus>(projections.map((projection) => projection.order.pickupStatus))
  console.log(
    JSON.stringify(
      {
        WLS中转仓配料菜单与路由: '通过',
        WLS配料列表详情分离: '通过',
        PFOS裁前准备领料菜单与路由: '通过',
        PFOS领料列表详情分离: '通过',
        生产单级配料单: '通过',
        生产单BOM八项物料: '通过',
        物料分类构成: '通过',
        物料图片: '通过',
        列表物料级配料进度: '通过',
        多次配料记录: '通过',
        配料记录级确认: '通过',
        四区详情字段: '通过',
        库存不足上游进度: '通过',
        默认详情Mock补齐: '通过',
        确认后进入领料: '通过',
        打回原因必填并退回未确认: '通过',
        配料关闭按实完结: '通过',
        待加工仓执行边界: '通过',
        PDA同源可领投影: '通过',
        配料状态覆盖: Array.from(prepStatusKeys),
        领料状态覆盖: Array.from(pickupStatusKeys),
      },
      null,
      2,
    ),
  )
}

try {
  main()
} catch (error) {
  console.error(error)
  process.exit(1)
}
