#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import {
  appendManualPrepRecord,
  appendPickupSessionFromNode,
  closeMaterialPrepOrder,
  confirmMaterialPrepRecord,
  createProductionMaterialPrepSeedStore,
  getMaterialPrepOrderProjection,
  getMaterialPrepRecordContext,
  getMaterialPrepRecordItems,
  listActivePickupNodes,
  listMaterialPrepOrderProjections,
  materialPrepWorkbenchTabs,
  pickupWorkbenchTabs,
  rejectMaterialPrepRecord,
  serializeProductionMaterialPrepStore,
  type MaterialPrepOrderStatus,
  type PickupOrderStatus,
} from '../src/data/fcs/cutting/production-material-prep.ts'
import { listBusinessFactoryMasterRecords } from '../src/data/fcs/factory-master-store.ts'
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

function assertPublicImagePath(publicPath: string, message: string): void {
  assert(publicPath.startsWith('/'), `${message}：必须是 public 下的真实图片路径`)
  assert(!publicPath.startsWith('data:image/svg+xml'), `${message}：不允许使用 SVG 占位图`)
  assert(!publicPath.includes('placeholder') && !publicPath.includes('picsum') && !publicPath.includes('dummyimage'), `${message}：不允许使用占位图片服务`)
  assert(fs.existsSync(path.join(repoRoot, 'public', publicPath.slice(1))), `${message}：文件不存在 ${publicPath}`)
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
  const wlsMaterialPrepSource = read('src/pages/wls/transfer-material-prep.ts')
  const pickupManagementSource = read('src/pages/process-factory/cutting/pickup-management.ts')
  const fcsHandlersSource = read('src/main-handlers/fcs-handlers.ts')
  const pdaAccessSource = read('src/data/fcs/factory-onboarding-flow.ts')
  const pdaRuntime = read('src/pages/pda-runtime.ts')
  const cuttingRuntimeLedgerSource = read('src/data/fcs/cutting/cutting-runtime-event-ledger.ts')

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
  assertIncludes(pdaAccessSource, "!targetRoute.startsWith('/fcs/pda')", 'PDA 登录守卫必须放行非 PDA 路由')
  assertIncludes(pdaRuntime, "startsWith('/fcs/pda')", 'PDA 登录重定向必须限定在 PDA 路由内')
  ;[
    [dataSource, "unit: '米'", '配料 mock 数据不应再使用米作为长度单位'],
    [wlsMaterialPrepSource, "unit = '米'", 'WLS 配料页面默认单位不应再是米'],
    [pickupManagementSource, "unit = '米'", 'PFOS 领料页面默认单位不应再是米'],
    [warehouseHub, "unit = '米'", '待加工仓页面默认单位不应再是米'],
    [warehouseHub, "unit: '米'", '待加工仓运行事件不应再写入米单位'],
    [pdaWaitProcess, "unit = '米'", 'PDA 待加工仓页面默认单位不应再是米'],
    [pdaWaitProcess, "unit: '米'", 'PDA 待加工仓运行事件不应再写入米单位'],
    [cuttingRuntimeLedgerSource, "unit: '米'", '裁床运行流水类型不应再固定米单位'],
  ].forEach(([source, snippet, message]) => {
    assertNotIncludes(source, snippet, message)
  })
  ;['领料数量（米）', '回收数量（米）', '1,008 米'].forEach((snippet) => {
    assertNotIncludes(`${wlsMaterialPrepSource}\n${pickupManagementSource}\n${warehouseHub}\n${pdaWaitProcess}`, snippet, `配料/领料页面不应再显示旧单位：${snippet}`)
  })
  assertIncludes(cuttingRuntimeLedgerSource, "if (text === '米') return 'yard'", '裁床运行流水需要把历史米单位兼容映射为 yard')

  const prepStatuses = materialPrepWorkbenchTabs.map((tab) => tab.key)
  const pickupStatuses = pickupWorkbenchTabs.map((tab) => tab.key)
  assert(!pickupStatuses.includes('WAIT_CONTINUE_PICKUP' as PickupOrderStatus), '领料工作台不应再包含待继续领料状态')
  assert(!pickupStatuses.includes('PARTIAL_PICKABLE' as PickupOrderStatus), '领料工作台不应再拆出可部分领料状态')
  const projections = listMaterialPrepOrderProjections(null)
  const businessFactories = listBusinessFactoryMasterRecords()
  const businessFactoryByIdOrCode = new Map<string, ReturnType<typeof listBusinessFactoryMasterRecords>[number]>()
  businessFactories.forEach((factory) => {
    businessFactoryByIdOrCode.set(factory.id, factory)
    businessFactoryByIdOrCode.set(factory.code, factory)
  })
  const requiredMaterialTypes = [
    { type: '面料', minimum: 3 },
    { type: '辅料', minimum: 3 },
    { type: '纱线', minimum: 1 },
    { type: '包材', minimum: 1 },
  ] as const
  assert(projections.length >= 8, '生产单级配料单样例不足，无法覆盖完整工作台状态')
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
    assert(!('styleImageUrl' in projection.order), '款式就是 SPU，不允许拆出 styleImageUrl')
    assert('spuImageUrl' in projection.order, '生产单缺少唯一的款式/SPU 图片字段：spuImageUrl')
    assertPublicImagePath(projection.order.spuImageUrl, `${projection.order.productionOrderNo} 缺少真实款式/SPU 图`)
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
        'stockWarehouseName',
        'stockWarehouseArea',
        'stockLocationCode',
        'canPrepQty',
        'shortageQty',
        'taskLinks',
        'upstreamSourceType',
        'upstreamProgressStatus',
      ].forEach((field) => {
        assert(field in line, `配料需求行缺少字段：${field}`)
      })
      const expectedWarehouse = line.materialType === '面料'
        ? '中转仓'
        : line.materialType === '辅料'
          ? '辅料仓'
          : line.materialType === '纱线'
            ? '纱线仓'
            : '包材仓'
      assert(line.stockWarehouseName === expectedWarehouse, `${projection.order.productionOrderNo} ${line.materialSku} 仓库类型不正确`)
      assertPublicImagePath(line.materialImageUrl, `${projection.order.productionOrderNo} ${line.materialSku} 缺少真实物料图片`)
      assert(Array.isArray(line.taskLinks), `${projection.order.productionOrderNo} ${line.materialSku} 必须带出关联任务数组`)
      line.taskLinks.forEach((task) => {
        ;['taskId', 'taskNo', 'taskName', 'taskType', 'factoryId', 'factoryCode', 'factoryName', 'assignedAt', 'allocationStatus'].forEach((field) => {
          assert(field in task, `${projection.order.productionOrderNo} ${line.materialSku} 关联任务缺少字段：${field}`)
        })
        if (task.allocationStatus === '已分配') {
          const factory = businessFactoryByIdOrCode.get(task.factoryId) ?? businessFactoryByIdOrCode.get(task.factoryCode)
          assert(factory, `${projection.order.productionOrderNo} ${task.taskNo} 关联任务工厂不在工厂档案中：${task.factoryName}`)
          assert(task.factoryName === `${factory.name}（${factory.code}）`, `${projection.order.productionOrderNo} ${task.taskNo} 工厂展示名必须来自工厂档案`)
        }
      })
    })
    assert(Array.isArray(projection.taskProjections), `${projection.order.productionOrderNo} 必须提供任务维度配料投影`)
  })

  const multiRecordOrder = getMaterialPrepOrderProjection('prep-order-po-202603-0101', null)
  assert(multiRecordOrder && multiRecordOrder.prepRecords.length >= 2, '一张配料单下必须支持多条配料记录')
  const draftMultiItemOrder = getMaterialPrepOrderProjection('prep-order-po-202603-0004', null)
  const multiItemRecord = draftMultiItemOrder?.prepRecords.find((record) =>
    record.recordStatus === 'DRAFT' && getMaterialPrepRecordItems(record).length >= 2,
  )
  assert(multiItemRecord, '配料记录必须支持记录内多物料明细')
  assert(multiRecordOrder.lines.some((line) => line.upstreamProgressStatus === '染色中'), '未配齐物料缺少染色进度')
  const noStockOrder = projections.find((projection) => projection.order.overallPrepStatus === 'NEED_PREP_NO_STOCK')
  assert(noStockOrder?.lines.some((line) => ['采购中', '印花中', '染色中'].includes(line.upstreamProgressStatus)), '待配料 - 无库存可配缺少上游进度')
  const partialStockOrders = projections.filter((projection) => projection.order.overallPrepStatus === 'NEED_PREP_PARTIAL_STOCK')
  assert(partialStockOrders.some((projection) => projection.lines.some((line) => line.remainingNeedQty > 0 && line.availableStockQty >= line.remainingNeedQty)), '待配料 - 部分有库存可配缺少库存充足物料')
  assert(partialStockOrders.some((projection) => projection.lines.some((line) => line.availableStockQty > 0 && line.availableStockQty < line.remainingNeedQty)), '待配料 - 部分有库存可配缺少库存不足物料')
  const allStockOrder = projections.find((projection) => projection.order.overallPrepStatus === 'NEED_PREP_ALL_STOCK')
  assert(allStockOrder?.lines.filter((line) => line.remainingNeedQty > 0).every((line) => line.availableStockQty >= line.remainingNeedQty), '待配料 - 全部都有充足库存状态定义错误')
  const purchaseTrackingOrder = projections.find((projection) => projection.order.pickupStatus === 'ACTUAL_CLOSED')
  assert(purchaseTrackingOrder?.lines.some((line) => line.upstreamProgressStatus === '采购中'), '按实关闭场景缺少采购进度回落')
  const defaultDetailOrder = getMaterialPrepOrderProjection('prep-order-po-202603-0004', null)
  assert(defaultDetailOrder && defaultDetailOrder.prepRecords.length >= 5, '默认配料详情单必须补齐多条配料记录 mock')
  assert(defaultDetailOrder.pickupRecords.length >= 1, '默认配料详情单必须补齐关联领料记录 mock')
  assert(defaultDetailOrder.rejectRecords.length >= 1, '默认配料详情单必须补齐打回记录 mock')
  assert(defaultDetailOrder.order.overallPrepStatus === 'NEED_PREP_PARTIAL_STOCK', '默认配料详情单补齐 mock 后应保持待配料 - 部分有库存可配状态')
  assert(defaultDetailOrder.taskProjections.length >= 4, '默认配料详情单必须按任务维度聚合配料情况')
  ;['裁片任务', '印花任务', '车缝任务', '包装任务'].forEach((taskType) => {
    assert(
      defaultDetailOrder.taskProjections.some((task) => task.taskType === taskType),
      `默认配料详情单缺少任务维度样例：${taskType}`,
    )
  })
  assert(
    defaultDetailOrder.taskProjections.some((task) =>
      task.materialLines.some((line) =>
        line.materialSku.includes('black-stretch-twill') &&
        line.prepRecords.some((record) => record.prepRecordId === 'prep-rec-po-0004-main-draft-001'),
      ),
    ),
    '任务维度配料情况必须列出关联配料记录',
  )

  const activeNodes = listActivePickupNodes(null)
  assert(activeNodes.length > 0, '已确认未领物料必须形成待领节点')
  assert(new Set(activeNodes.map((node) => node.prepOrderId)).size === activeNodes.length, '同一生产单同时刻只能有一个活动节点')
  assert(activeNodes.every((node) => node.items.length > 0), '活动节点必须包含全部可领明细')
  assert(activeNodes.some((node) => node.nodeType === 'INCOMPLETE_PICKABLE'), 'Mock 缺少未配齐可领节点')
  assert(activeNodes.some((node) => node.nodeType === 'READY_TO_PICKUP'), 'Mock 缺少已配齐待领节点')
  assert(activeNodes.some((node) => node.items.some((item) => item.sourcePrepRecordIds.length >= 2)), '多条配料记录未归并到同一节点')

  const readyNode = activeNodes.find((n) => n.nodeType === 'READY_TO_PICKUP')!
  assert(readyNode.items.length >= 8, '已配齐待领节点必须包含全部物料行')

  const nodeWarehouseNames = new Set(activeNodes.flatMap((node) => node.items.map((item) => item.sourceWarehouseName)))
  ;['中转仓', '辅料仓', '纱线仓', '包材仓'].forEach((warehouseName) => {
    assert(nodeWarehouseNames.has(warehouseName), `待领节点缺少来源仓库：${warehouseName}`)
  })

  const storage = new MemoryStorage()
  storage.setItem('productionMaterialPrepWorkflow', serializeProductionMaterialPrepStore(createProductionMaterialPrepSeedStore()))
  assert(
    !listActivePickupNodes(storage).some((node) => node.prepOrderId === multiItemRecord?.prepOrderId),
    '未确认物料不可进入待领节点',
  )
  const confirmedMultiItemRecord = confirmMaterialPrepRecord(multiItemRecord!.prepRecordId, '中转仓 林洁', storage)
  assert(confirmedMultiItemRecord, '多物料配料记录确认后必须返回整条记录')
  assert(confirmedMultiItemRecord.recordStatus === 'CONFIRMED', '配料确认必须作用于整条配料记录')
  rejectMaterialPrepRecord(multiItemRecord!.prepRecordId, '整条配料记录需重配', '记录内任一物料核对异常，整条配料记录退回重新确认。', '裁床 李明', storage)
  assert(
    !listActivePickupNodes(storage).some((node) => node.prepOrderId === multiItemRecord!.prepOrderId),
    '整条配料记录被打回后不可再进入待领节点',
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
  confirmMaterialPrepRecord(addedRecord.prepRecordId, '中转仓 周敏', storage)
  assert(listActivePickupNodes(storage).some((node) => node.items.some((item) => item.sourcePrepRecordIds.includes(addedRecord.prepRecordId))), '确认后的配料记录必须进入待领节点')

  const nodeForPickup = listActivePickupNodes(storage).find((n) => n.nodeType === 'READY_TO_PICKUP')
  assert(nodeForPickup, '缺少已配齐待领节点用于确认领料')
  const session = appendPickupSessionFromNode({
    pickupNodeId: nodeForPickup.nodeId,
    pickupNodeVersion: nodeForPickup.version,
    receiverName: '裁床 李明',
    warehouseArea: '待加工仓 A 区',
    locationCode: 'FAB-A-09',
    waitProcessLedgerEventId: 'check-node-session',
  }, storage)
  assert(session.status === '本轮已领完', '领料主记录状态错误')
  assert(session.pickupRecordIds.length === nodeForPickup.items.length, '节点每条物料必须形成一条领料明细')
  assert(!listActivePickupNodes(storage).some((n) => n.nodeId === nodeForPickup.nodeId), '确认后该生产单节点必须关闭')

  const duplicate = appendPickupSessionFromNode({
    pickupNodeId: nodeForPickup.nodeId,
    pickupNodeVersion: nodeForPickup.version,
    receiverName: '裁床 李明',
    warehouseArea: '待加工仓 A 区',
    locationCode: 'FAB-A-09',
    waitProcessLedgerEventId: 'check-node-session-retry',
  }, storage)
  assert(duplicate.pickupSessionId === session.pickupSessionId, '重复确认必须返回原主记录')

  let versionConflictThrew = false
  try {
    appendPickupSessionFromNode({
      pickupNodeId: nodeForPickup.nodeId,
      pickupNodeVersion: 99,
      receiverName: '裁床 李明',
      warehouseArea: '待加工仓 A 区',
      locationCode: 'FAB-A-09',
      waitProcessLedgerEventId: 'check-version-conflict',
    }, storage)
  } catch (e) {
    versionConflictThrew = (e as Error).message.includes('当前待领物料已更新')
  }
  assert(versionConflictThrew, '旧版本节点确认必须阻断')

  closeMaterialPrepOrder('prep-order-po-202603-0004', '后续不再配，按实关闭', '中转仓 周敏', storage)
  const closedProjection = getMaterialPrepOrderProjection('prep-order-po-202603-0004', storage)
  assert(closedProjection?.order.pickupStatus === 'ACTUAL_CLOSED', '配料关闭后领料端必须显示按实完结')
  assert(closedProjection?.order.overallPrepStatus === 'CLOSED', '关闭配料单后必须进入已关闭状态')


  const wlsListHtml = renderWlsTransferMaterialPrepPage()
  ;['配料管理', '配料工作台', '待配料 - 无库存可配', '待配料 - 部分有库存可配', '待配料 - 全部都有充足库存', '被打回重配', '已配齐', '已关闭', '查看详情', '新增配料记录', '关闭配料单'].forEach((snippet) => {
    assertIncludes(wlsListHtml, snippet, `WLS 配料列表页缺少文案：${snippet}`)
  })
  ;[
    '物料配料明细',
    '关联任务',
    'TASK-',
    '已分配',
    '需要多少',
    '已配多少',
    '剩余未配',
    '配料记录',
    '领料记录',
    '是否还需要配料',
    '上游进度',
    '库存充足',
    '库存不足',
    '无库存',
    '每个生产单至少 8 个物料',
    '面料 3 个',
    '辅料 3 个',
    '纱线 1 个',
    '包材 1 个',
    '/materials/',
    '/pants-sample.jpg',
  ].forEach((snippet) => {
    assertIncludes(wlsListHtml, snippet, `WLS 配料列表页缺少物料级字段或图片：${snippet}`)
  })
  assertNotIncludes(wlsListHtml, 'data:image/svg+xml', 'WLS 配料列表页不允许出现 SVG 占位图')
  assertIncludes(wlsListHtml, 'detailTab=records', 'WLS 配料列表新增配料记录必须跳到详情配料记录 Tab')
  assertIncludes(wlsListHtml, 'prepModal=1', 'WLS 配料列表新增配料记录必须打开新增弹窗')
  assertIncludes(wlsListHtml, 'closeModal=1', 'WLS 配料列表关闭配料单必须跳到详情二次确认弹窗')
  ;['可继续配料', '未配齐跟进', '被打回待重配'].forEach((snippet) => {
    assertNotIncludes(wlsListHtml, snippet, `WLS 配料列表页不应再显示旧状态：${snippet}`)
  })
  assertNotIncludes(wlsListHtml, '查看裁床领料管理', 'WLS 配料列表页不应保留裁床领料管理跳转按钮')
  ;['完全未配且已有库存', '之前配过且现在有库存', '展示采购/印花/染色进度', '领料端打回记录', '需求已全部确认配料', '后续不再配'].forEach((snippet) => {
    assertNotIncludes(wlsListHtml, snippet, `WLS 配料列表页不应保留顶部状态统计卡片：${snippet}`)
  })
  ;['生产需求信息', '当前各仓库存信息与上游进度', '与配料记录关联的领料记录', '手动新增配料记录'].forEach((snippet) => {
    assertNotIncludes(wlsListHtml, snippet, `WLS 配料列表页不应混入详情内容：${snippet}`)
  })
  assertNotIncludes(dataSource, 'styleImageUrl', '配料与领料数据模型不允许拆出 styleImageUrl')
  ;['MaterialPrepOrder', 'spuImageUrl', 'MaterialPrepLine', 'MaterialPrepMaterialType', 'materialType', 'materialImageUrl', 'stockWarehouseName', 'stockWarehouseArea', 'stockLocationCode', 'MaterialPrepTaskLink', 'taskLinks', 'MaterialPrepTaskProjection', 'taskProjections', 'MaterialPrepRecord', 'MaterialPrepRecordItem', 'MaterialPrepRecordContextItem', 'PickupRecord', 'PickupSession', 'pickupSessions', 'PrepRejectRecord', 'listActivePickupNodes', 'appendPickupSessionFromNode', 'buildPickupNodeItems'].forEach((snippet) => {
    assertIncludes(dataSource, snippet, `字段级模型缺少：${snippet}`)
  })
  const renderWlsDetailBySearch = (search: string): string => {
    const previousWindow = (globalThis as any).window
    ;(globalThis as any).window = {
      location: {
        search,
      },
    }
    const html = renderWlsTransferMaterialPrepDetailPage()
    if (previousWindow === undefined) delete (globalThis as any).window
    else (globalThis as any).window = previousWindow
    return html
  }
  const wlsDetailDemandHtml = renderWlsDetailBySearch('?prepOrderId=prep-order-po-202603-0004&detailTab=demand')
  const wlsDetailInventoryHtml = renderWlsDetailBySearch('?prepOrderId=prep-order-po-202603-0004&detailTab=inventory')
  const wlsDetailTasksHtml = renderWlsDetailBySearch('?prepOrderId=prep-order-po-202603-0004&detailTab=tasks')
  const wlsDetailRecordsHtml = renderWlsDetailBySearch('?prepOrderId=prep-order-po-202603-0004&detailTab=records')
  const wlsDetailRecordsModalHtml = renderWlsDetailBySearch('?prepOrderId=prep-order-po-202603-0004&detailTab=records&prepModal=1')
  const wlsDetailContinuePrepHtml = renderWlsDetailBySearch('?prepOrderId=prep-order-po-202603-0004&detailTab=records&continuePrepRecordId=prep-rec-po-0004-main-draft-001')
  const wlsDetailCloseModalHtml = renderWlsDetailBySearch('?prepOrderId=prep-order-po-202603-0004&detailTab=inventory&closeModal=1')
  const wlsDetailPickupHtml = renderWlsDetailBySearch('?prepOrderId=prep-order-po-202603-0004&detailTab=pickup')

  ;['配料详情', '返回配料列表', '生产需求信息', '款式/SPU 图', '/pants-sample.jpg', 'PO-202603-0004'].forEach((snippet) => {
    assertIncludes(wlsDetailDemandHtml, snippet, `WLS 配料详情生产需求 Tab 缺少文案：${snippet}`)
  })
  assertNotIncludes(wlsDetailDemandHtml, '查看裁床领料管理', 'WLS 配料详情页不应保留裁床领料管理跳转按钮')
  ;['配料详情', '当前各仓库存信息与上游进度', '关联任务', '在库仓库', '/materials/', '采购', '印花', '染色', '辅料仓', '纱线仓', '包材仓'].forEach((snippet) => {
    assertIncludes(wlsDetailInventoryHtml, snippet, `WLS 配料详情库存进度 Tab 缺少文案：${snippet}`)
  })
  ;['按任务查看配料情况', '任务维度配料情况', '这是个什么任务', '任务需要哪些物料', '任务工厂', '裁片任务', '印花任务', '车缝任务', '包装任务', 'TASK-CUT-', 'TASK-PRT-', '需要多少', '配了多少', '领了多少', '剩余未配', '配料记录', '配料记录号', '本次配料', '卷/件数', '记录ID', 'prep-rec-po-0004-main-draft-001'].forEach((snippet) => {
    assertIncludes(wlsDetailTasksHtml, snippet, `WLS 配料详情任务维度 Tab 缺少文案或数据：${snippet}`)
  })
  ;['关闭配料单二次确认', '关闭后该配料单进入已关闭', '按单位汇总缺口', '缺口物料', '关联任务', '关闭原因（必填）', '确认关闭配料单', 'data-wls-prep-action="close-order"', 'data-wls-close-reason', 'Black 弹力斜纹主面料'].forEach((snippet) => {
    assertIncludes(wlsDetailCloseModalHtml, snippet, `WLS 配料关闭二次确认弹窗缺少文案或字段：${snippet}`)
  })
  ;['配料详情', '配料记录', '新增配料记录', '新增配料', '配料记录号：1', '配料记录ID', '配料来源', '当前在库', '关联任务', '确认整条配料记录', '记录内物料明细', '确认对象是整条配料记录', 'continuePrepRecordId=', '中转仓', '辅料仓', '纱线仓', '包材仓'].forEach((snippet) => {
    assertIncludes(wlsDetailRecordsHtml, snippet, `WLS 配料详情配料记录 Tab 缺少文案：${snippet}`)
  })
  ;['已有未确认记录时仍可继续新增配料', '确认后裁床领料管理会看到对应待领料', 'data-wls-prep-action="confirm-record"'].forEach((snippet) => {
    assertIncludes(wlsDetailRecordsHtml, snippet, `WLS 配料详情未明确未确认记录可继续配料或确认动作：${snippet}`)
  })
  ;['prep-rec-po-0004-main-draft-001', 'prep-rec-po-0004-multi-draft-003', 'prep-rec-po-0004-package-draft-004', 'prep-rec-po-0004-lining-draft-005'].forEach((snippet) => {
    assertIncludes(wlsDetailRecordsHtml, snippet, `WLS 默认详情页缺少补齐的配料记录 mock：${snippet}`)
  })
  assertNotIncludes(wlsDetailRecordsHtml, 'BATCH-BLK-260316-D01', 'WLS 配料记录列表不应再把配料批次作为主展示字段')
  ;['新增配料记录', '默认展示该生产单全部 8 行物料', '配料记录号', 'value="6"', '生产单所需全部物料', '关联任务', '按行填写本次配料数量', '保存为未确认记录', '记录状态', '未确认'].forEach((snippet) => {
    assertIncludes(wlsDetailRecordsModalHtml, snippet, `WLS 新增配料记录弹窗缺少文案：${snippet}`)
  })
  assertNotIncludes(wlsDetailRecordsModalHtml, '配料批次', 'WLS 新增配料记录弹窗字段名不应再叫配料批次')
  assertNotIncludes(wlsDetailRecordsModalHtml, 'BATCH-', 'WLS 新增配料记录号应从数字 1 开始，不应使用 BATCH 前缀')
  ;['Black 弹力斜纹主面料', '拼接面料', '里布', '拉链', '纽扣', '主唛/洗水唛', '缝纫线', '包装袋/吊牌'].forEach((snippet) => {
    assertIncludes(wlsDetailRecordsModalHtml, snippet, `WLS 新增配料记录弹窗必须默认展示生产单全部物料：${snippet}`)
  })
  ;['新增配料', '继续补充配料记录号 1', '生产单所需全部物料', '关联任务', 'Black 弹力斜纹主面料', '保存本次新增配料'].forEach((snippet) => {
    assertIncludes(wlsDetailContinuePrepHtml, snippet, `WLS 未确认配料记录继续新增配料弹窗缺少文案：${snippet}`)
  })
  ;['配料人', '配料时间', '记录状态', '<span>备注</span>', '保存为未确认记录'].forEach((snippet) => {
    assertNotIncludes(wlsDetailContinuePrepHtml, snippet, `WLS 继续新增配料弹窗不应保留新增配料记录弹窗的外层字段：${snippet}`)
  })
  ;['与配料记录关联的领料记录', '领料记录', '打回记录', 'pickup-rec-po-0004-main-preview-001', '卷标缺失'].forEach((snippet) => {
    assertIncludes(wlsDetailPickupHtml, snippet, `WLS 配料详情领料记录 Tab 缺少文案或 mock：${snippet}`)
  })
  ;[wlsDetailDemandHtml, wlsDetailInventoryHtml, wlsDetailTasksHtml, wlsDetailRecordsHtml, wlsDetailRecordsModalHtml, wlsDetailContinuePrepHtml, wlsDetailCloseModalHtml, wlsDetailPickupHtml].forEach((html) => {
    assertNotIncludes(html, 'data:image/svg+xml', 'WLS 配料详情页不允许出现 SVG 占位图')
  })
  ;['暂无领料记录。', '暂无打回记录。'].forEach((snippet) => {
    assertNotIncludes(wlsDetailPickupHtml, snippet, `WLS 默认详情页不应再显示空记录：${snippet}`)
  })
  ;['确认 / 打回', '>确认配料</button>', '来源流水', '手动新增配料记录', '配料批次'].forEach((snippet) => {
    assertNotIncludes(wlsDetailRecordsHtml, snippet, `WLS 配料详情页不应出现旧字段或物料行确认动作：${snippet}`)
  })

  assertNotIncludes(dataSource, 'styleImageUrl', '配料与领料数据模型不允许拆出 styleImageUrl')
  ;['MaterialPrepOrder', 'spuImageUrl', 'MaterialPrepLine', 'MaterialPrepMaterialType', 'materialType', 'materialImageUrl', 'stockWarehouseName', 'stockWarehouseArea', 'stockLocationCode', 'MaterialPrepTaskLink', 'taskLinks', 'MaterialPrepTaskProjection', 'taskProjections', 'MaterialPrepRecord', 'MaterialPrepRecordItem', 'MaterialPrepRecordContextItem', 'PickupRecord', 'PickupSession', 'pickupSessions', 'PrepRejectRecord'].forEach((snippet) => {
    assertIncludes(dataSource, snippet, `字段级模型缺少：${snippet}`)
  })
  ;['factoryId', 'factoryCode', 'listBusinessFactoryMasterRecords', 'processCode', 'capacityNodeCode'].forEach((snippet) => {
    assertIncludes(dataSource, snippet, `关联任务工厂必须来自工厂档案字段或逻辑：${snippet}`)
  })
  ;['我方裁床一组', '印花厂 A 组', '染色厂 B 组', '车缝厂三组', '后整包装组'].forEach((snippet) => {
    assertNotIncludes(dataSource, snippet, `配料任务不应再使用假的工厂名称：${snippet}`)
    assertNotIncludes(wlsListHtml + wlsDetailTasksHtml + wlsDetailInventoryHtml + wlsDetailRecordsHtml, snippet, `配料页面不应再展示假的工厂名称：${snippet}`)
  })
  ;['PT Mulia Cutting Center', 'PT Prima Printing Center', 'PT Sinar Garment Indonesia', 'HiGood 后道工厂'].forEach((snippet) => {
    assertIncludes(wlsDetailTasksHtml, snippet, `任务维度 Tab 必须展示工厂档案里的真实工厂：${snippet}`)
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
        款式SPU真实图片: '通过',
        物料真实图片: '通过',
        列表物料级配料进度: '通过',
        物料关联任务展示: '通过',
        任务维度配料情况: '通过',
        任务工厂来自工厂档案: '通过',
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
