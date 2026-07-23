#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import {
  appendManualPrepRecord,
  appendPickupReturnRecord,
  appendPickupSessionFromNode,
  closeMaterialPrepOrder,
  confirmMaterialPrepRecord,
  createProductionMaterialPrepSeedStore,
  getMaterialPrepOrderProjection,
  getMaterialPrepRecordItems,
  listActivePickupNodes,
  listMaterialPrepOrderProjections,
  materialPrepWorkbenchTabs,
  pickMaterialPrepRecord,
  pickupWorkbenchTabs,
  rejectMaterialPrepRecord,
  serializeProductionMaterialPrepStore,
  stageMaterialPrepRecord,
} from '../src/data/fcs/cutting/production-material-prep.ts'
import { listBusinessFactoryMasterRecords } from '../src/data/fcs/factory-master-store.ts'
import {
  renderCraftCuttingPickupManagementDetailPage,
  renderCraftCuttingPickupManagementPage,
  summarizePickupNodeLines,
} from '../src/pages/process-factory/cutting/pickup-management.ts'

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
  assert(fs.existsSync(path.join(repoRoot, 'public', publicPath.slice(1))), `${message}：文件不存在 ${publicPath}`)
}

function renderWithBrowserState(
  storage: MemoryStorage,
  search: string,
  render: () => string,
): string {
  const previousWindow = (globalThis as { window?: unknown }).window
  ;(globalThis as { window?: unknown }).window = {
    location: { search },
    localStorage: storage,
  }
  try {
    return render()
  } finally {
    if (previousWindow === undefined) delete (globalThis as { window?: unknown }).window
    else (globalThis as { window?: unknown }).window = previousWindow
  }
}

function main(): void {
  const appShellConfig = read('src/data/app-shell-config.ts')
  const routesFcs = read('src/router/routes-fcs.ts')
  const routeRenderersFcs = read('src/router/route-renderers-fcs.ts')
  const meta = read('src/pages/process-factory/cutting/meta.ts')
  const pickupManagementSource = read('src/pages/process-factory/cutting/pickup-management.ts')
  const pdaWaitProcessSource = read('src/pages/pda-warehouse-wait-process.ts')
  const pdaAccessSource = read('src/data/fcs/factory-onboarding-flow.ts')
  const pdaRuntimeSource = read('src/pages/pda-runtime.ts')

  assertIncludes(appShellConfig, "title: '领料管理'", '裁片准备缺少领料管理菜单')
  assertIncludes(appShellConfig, "href: '/fcs/craft/cutting/pickup-management'", '领料管理菜单未指向现行路由')
  assertIncludes(routesFcs, '/fcs/craft/cutting/pickup-management', '领料管理路由缺失')
  assertIncludes(routesFcs, '/fcs/craft/cutting/pickup-management-detail', '领料详情路由缺失')
  assertIncludes(routeRenderersFcs, 'renderCraftCuttingPickupManagementPage', '领料管理页面入口缺失')
  assertIncludes(routeRenderersFcs, 'renderCraftCuttingPickupManagementDetailPage', '领料详情页面入口缺失')
  assertIncludes(meta, "'pickup-management'", '裁床页面元数据缺少领料管理')
  assertIncludes(pdaAccessSource, "!targetRoute.startsWith('/fcs/pda')", 'PDA 登录守卫必须放行非 PDA 路由')
  assertIncludes(pdaRuntimeSource, "startsWith('/fcs/pda')", 'PDA 登录重定向必须限定在 PDA 路由内')
  ;[
    [pickupManagementSource, "unit = '米'", '领料管理不应默认使用米'],
    [pdaWaitProcessSource, "unit = '米'", 'PDA 领料不应默认使用米'],
    [pdaWaitProcessSource, "unit: '米'", 'PDA 领料流水不应写入米'],
  ].forEach(([source, snippet, message]) => assertNotIncludes(source, snippet, message))

  const projections = listMaterialPrepOrderProjections(null)
  const prepStatuses = new Set(projections.map((projection) => projection.order.overallPrepStatus))
  const pickupStatuses = new Set(projections.map((projection) => projection.order.pickupStatus))
  assert(projections.length >= 8, '生产单级配料单样例不足')
  materialPrepWorkbenchTabs.forEach((tab) => assert(prepStatuses.has(tab.key), `配料状态缺少样例：${tab.label}`))
  pickupWorkbenchTabs.forEach((tab) => assert(pickupStatuses.has(tab.key), `领料状态缺少样例：${tab.label}`))
  assert(!pickupStatuses.has('WAIT_CONTINUE_PICKUP' as never), '领料工作台不应保留待继续领料')
  assert(!pickupStatuses.has('PARTIAL_PICKABLE' as never), '领料工作台不应保留可部分领料')

  const factories = listBusinessFactoryMasterRecords()
  const factoryByIdOrCode = new Map(factories.flatMap((factory) => [[factory.id, factory], [factory.code, factory]]))
  const requiredMaterialTypes = [
    ['面料', 3],
    ['辅料', 3],
    ['纱线', 1],
    ['包材', 1],
  ] as const
  projections.forEach((projection) => {
    assert(projection.order.productionOrderId && projection.order.productionOrderNo, '配料单必须挂在生产单下')
    assertPublicImagePath(projection.order.spuImageUrl, `${projection.order.productionOrderNo} 缺少款式图片`)
    assert(projection.lines.length >= 8, `${projection.order.productionOrderNo} 物料需求不足 8 行`)
    requiredMaterialTypes.forEach(([type, minimum]) => {
      assert(
        projection.lines.filter((line) => line.materialType === type).length >= minimum,
        `${projection.order.productionOrderNo} ${type}不足 ${minimum} 行`,
      )
    })
    projection.lines.forEach((line) => {
      assertPublicImagePath(line.materialImageUrl, `${projection.order.productionOrderNo} ${line.materialSku} 缺少物料图片`)
      line.taskLinks.filter((task) => task.allocationStatus === '已分配').forEach((task) => {
        const factory = factoryByIdOrCode.get(task.factoryId) ?? factoryByIdOrCode.get(task.factoryCode)
        assert(factory, `${task.taskNo} 的工厂不在工厂档案中`)
        assert(task.factoryName === `${factory.name}（${factory.code}）`, `${task.taskNo} 的工厂展示未使用工厂档案`)
      })
    })
  })

  const activeNodes = listActivePickupNodes(null)
  assert(activeNodes.length > 0, '已确认未领物料必须形成待领节点')
  assert(new Set(activeNodes.map((node) => node.prepOrderId)).size === activeNodes.length, '同一配料单只能有一个活动待领节点')
  assert(activeNodes.every((node) => node.items.length > 0), '活动待领节点必须包含可领物料')
  assert(activeNodes.some((node) => node.nodeType === 'INCOMPLETE_PICKABLE'), '缺少未配齐清单样例')
  assert(activeNodes.some((node) => node.nodeType === 'READY_TO_PICKUP'), '缺少已配齐待领样例')
  assert(activeNodes.every((node) => node.items.every((item) => item.sourcePrepRecordIds.length === 1)), '每个待领物料批次必须保留唯一来源配料记录')
  const po0101Node = activeNodes.find((node) => node.productionOrderNo === 'PO-202603-0101')
  assert(po0101Node, '缺少同物料多批次验收节点 PO-202603-0101')
  const po0101BlackLine = summarizePickupNodeLines(po0101Node).find((line) => line.prepLineId === 'prep-line-po-0101-black')
  assert(po0101BlackLine, 'PO-202603-0101 缺少黑色主面料需求行')
  assert(po0101BlackLine.batches.length === 2, 'PO-202603-0101 黑色主面料必须保留两个来源批次')
  assert(po0101BlackLine.requiredQty === 1386, '同物料多批次不得重复累计需求数量')
  assert(po0101BlackLine.effectivePickedQty === 835, '同物料多批次历史有效已领汇总错误')
  assert(po0101BlackLine.currentAvailableQty === 165, '同物料多批次当前可领汇总错误')
  assert(po0101BlackLine.remainingShortageQty === 386, '同物料多批次领后剩余缺口必须按需求行计算一次')

  const returnStorage = new MemoryStorage()
  returnStorage.setItem('productionMaterialPrepWorkflow', serializeProductionMaterialPrepStore(createProductionMaterialPrepSeedStore()))
  const returnSourceNode = listActivePickupNodes(returnStorage).find((node) => node.productionOrderNo === 'PO-202603-0101')
  assert(returnSourceNode, '缺少领完退回组合场景验收节点')
  const returnSourceBatch = returnSourceNode.items.find((item) => item.prepLineId === 'prep-line-po-0101-black')
  assert(returnSourceBatch, '领完退回组合场景缺少黑色主面料批次')
  const returnSession = appendPickupSessionFromNode({
    pickupNodeId: returnSourceNode.nodeId,
    pickupNodeVersion: returnSourceNode.version,
    receiverName: '裁床 李明',
    warehouseArea: '待加工仓 A 区',
    locationCode: 'FAB-A-09',
    waitProcessLedgerEventId: 'check-pickup-return-next-node',
  }, returnStorage)
  const returnPickupRecordId = returnSession.pickupRecordIds[returnSourceNode.items.indexOf(returnSourceBatch)]
  appendPickupReturnRecord({
    pickupRecordId: returnPickupRecordId,
    prepRecordId: returnSourceBatch.sourcePrepRecordIds[0],
    prepLineId: returnSourceBatch.prepLineId,
    returnQty: 10,
    rollCount: 1,
    reason: '裁床退料',
    remark: '组合场景回归',
    imageNames: [],
    returnedBy: '裁床 李明',
  }, returnStorage)
  const returnedNode = listActivePickupNodes(returnStorage).find((node) => node.productionOrderNo === 'PO-202603-0101')
  assert(returnedNode, '领完退回后未形成下一待领节点')
  const returnedBlackLine = summarizePickupNodeLines(returnedNode).find((line) => line.prepLineId === 'prep-line-po-0101-black')
  assert(returnedBlackLine, '领完退回后的节点缺少黑色主面料')
  assert(returnedBlackLine.effectivePickedQty === 990, '领完退回后的下一节点丢失已完全领取批次历史数量')
  assert(returnedBlackLine.currentAvailableQty === 10, '领完退回后的当前可领数量错误')
  assert(returnedBlackLine.remainingShortageQty === 386, '领完退回后的缺口必须继续按完整需求行计算')

  const storage = new MemoryStorage()
  storage.setItem('productionMaterialPrepWorkflow', serializeProductionMaterialPrepStore(createProductionMaterialPrepSeedStore()))
  const initialNode = listActivePickupNodes(storage)[0]
  assert(initialNode, '缺少真实节点版本变更验收节点')
  const initialBatch = initialNode.items[0]
  assert(initialBatch, '真实节点缺少可追加配料的物料行')
  const initialLineBatchCount = initialNode.items.filter((item) => item.prepLineId === initialBatch.prepLineId).length
  const addedRecord = appendManualPrepRecord({
    prepOrderId: initialNode.prepOrderId,
    prepLineId: initialBatch.prepLineId,
    preparedQty: 12,
    rollCount: 1,
    warehouseArea: '中转仓 A 区',
    locationCode: 'TR-A-099',
    operatorName: '中转仓 周敏',
  }, storage)
  assert(addedRecord.recordStatus === 'DRAFT', '新增配料记录必须先进入未拣货状态')
  assert(!confirmMaterialPrepRecord(addedRecord.prepRecordId, '中转仓 周敏', storage), '未拣货记录不可直接确认')
  assert(pickMaterialPrepRecord(addedRecord.prepRecordId, '中转仓 张三', storage)?.recordStatus === 'PICKED', '配料记录拣货失败')
  assert(stageMaterialPrepRecord(addedRecord.prepRecordId, '中转仓暂存区 A', '中转仓 李明', storage)?.recordStatus === 'STAGED', '配料记录暂存失败')
  assert(confirmMaterialPrepRecord(addedRecord.prepRecordId, '中转仓 周敏', storage)?.recordStatus === 'CONFIRMED', '暂存记录确认失败')
  const updatedNode = listActivePickupNodes(storage).find((node) => node.nodeId === initialNode.nodeId)
  assert(updatedNode, '追加配料后原活动待领节点丢失')
  assert(updatedNode.version !== initialNode.version, '追加确认配料后待领节点版本未更新')
  const addedBatch = updatedNode.items.find((item) => item.sourcePrepRecordIds.includes(addedRecord.prepRecordId))
  assert(addedBatch, '确认后的配料记录未进入活动待领节点')
  assert(addedBatch.sourceLocationCode === 'TR-A-099', '追加配料批次未保留实际库位')
  assert(
    updatedNode.items.filter((item) => item.prepLineId === initialBatch.prepLineId).length === initialLineBatchCount + 1,
    '同一物料的不同配料批次未按来源库位分开保留',
  )
  let realVersionConflictBlocked = false
  try {
    appendPickupSessionFromNode({
      pickupNodeId: initialNode.nodeId,
      pickupNodeVersion: initialNode.version,
      receiverName: '裁床 李明',
      warehouseArea: '待加工仓 A 区',
      locationCode: 'FAB-A-09',
      waitProcessLedgerEventId: 'check-real-version-conflict',
    }, storage)
  } catch (error) {
    realVersionConflictBlocked = (error as Error).message.includes('当前待领物料已更新')
  }
  assert(realVersionConflictBlocked, '真实追加配料后使用旧节点版本办理领料时未阻断')
  assert(rejectMaterialPrepRecord(
    addedRecord.prepRecordId,
    '整条配料记录需重配',
    '物料核对异常',
    '裁床 李明',
    storage,
  ), '待领物料打回失败')
  assert(
    !listActivePickupNodes(storage).some((node) => node.items.some((item) => item.sourcePrepRecordIds.includes(addedRecord.prepRecordId))),
    '打回后的配料记录仍出现在待领节点',
  )

  const readyNode = listActivePickupNodes(storage).find((node) => node.nodeType === 'READY_TO_PICKUP')
  assert(readyNode, '缺少可办理领料的已配齐节点')
  const session = appendPickupSessionFromNode({
    pickupNodeId: readyNode.nodeId,
    pickupNodeVersion: readyNode.version,
    receiverName: '裁床 李明',
    warehouseArea: '待加工仓 A 区',
    locationCode: 'FAB-A-09',
    waitProcessLedgerEventId: 'check-pickup-session',
  }, storage)
  assert(session.status === '本轮已领完', '领料主记录状态错误')
  assert(session.pickupRecordIds.length === readyNode.items.length, '节点内每条物料必须形成领料明细')
  assert(!listActivePickupNodes(storage).some((node) => node.nodeId === readyNode.nodeId), '办理领料后活动节点未关闭')
  const duplicateSession = appendPickupSessionFromNode({
    pickupNodeId: readyNode.nodeId,
    pickupNodeVersion: readyNode.version,
    receiverName: '裁床 李明',
    warehouseArea: '待加工仓 A 区',
    locationCode: 'FAB-A-09',
    waitProcessLedgerEventId: 'check-pickup-session-retry',
  }, storage)
  assert(duplicateSession.pickupSessionId === session.pickupSessionId, '重复办理领料未返回原领料记录')

  closeMaterialPrepOrder('prep-order-po-202603-0004', '后续不再配，按实关闭', '中转仓 周敏', storage)
  const closedProjection = getMaterialPrepOrderProjection('prep-order-po-202603-0004', storage)
  assert(closedProjection?.order.pickupStatus === 'ACTUAL_CLOSED', '关闭配料单后领料状态不是按实完结')
  assert(closedProjection?.order.overallPrepStatus === 'CLOSED', '关闭配料单后配料状态不是已关闭')

  const listHtml = renderWithBrowserState(storage, '', renderCraftCuttingPickupManagementPage)
  ;['领料管理', '未配齐清单', '已配齐待领', '当前节点全部物料', '历史有效已领', '领后剩余缺口', '办理领料入库'].forEach((snippet) => {
    assertIncludes(listHtml, snippet, `领料管理列表缺少：${snippet}`)
  })
  ;['可继续配料', '待继续领料', '可部分领料'].forEach((snippet) => {
    assertNotIncludes(listHtml, snippet, `领料管理仍显示废弃状态：${snippet}`)
  })

  const detailNode = listActivePickupNodes(storage)[0]
  assert(detailNode, '缺少领料详情验收节点')
  const detailHtml = renderWithBrowserState(
    storage,
    `?pickupNodeId=${encodeURIComponent(detailNode.nodeId)}`,
    renderCraftCuttingPickupManagementDetailPage,
  )
  ;['领料详情', '当前节点全部物料', '物料明细', '需求数量', '本轮全部领取', '打回中转仓'].forEach((snippet) => {
    assertIncludes(detailHtml, snippet, `领料详情缺少：${snippet}`)
  })

  console.log(JSON.stringify({
    现行菜单与路由: '通过',
    生产单级配料模型: '通过',
    工厂档案引用: '通过',
    单一活动待领节点: '通过',
    多次配料批次与库位保真: '通过',
    配料确认顺序: '通过',
    节点整单领料与关闭: '通过',
    重复提交幂等: '通过',
    节点版本防错: '通过',
    配料关闭按实完结: '通过',
    列表与详情展示: '通过',
    PDA路由边界: '通过',
  }, null, 2))
}

try {
  main()
} catch (error) {
  console.error(error)
  process.exit(1)
}
