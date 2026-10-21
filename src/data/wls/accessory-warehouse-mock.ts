import { ACCESSORY_WAREHOUSE_DEMOS } from './accessory-warehouse-demo.ts'
import { ACCESSORY_WORKFLOW_SCENES, listAccessoryFixtureMaterials } from './accessory-warehouse-upstream-fixtures.ts'
import { ACCESSORY_GTP_WAREHOUSE, registerAccessoryPreparation, completeAccessoryPreparation, createAccessoryPickup, createAccessoryPostTransfer, type AccessoryPreparation, type AccessoryTransfer } from './accessory-warehouse-flow.ts'
import { reserveAccessoryPreparationStock, getAccessoryStockId, type AccessoryStock } from './accessory-warehouse-stock.ts'
import { listAccessoryWarehouseLocations, listAccessoryPostWarehouseLocations } from './accessory-warehouse-master.ts'
import { accessoryRecord } from './accessory-warehouse-records.ts'
import { accessoryReceiptForTransfer, buildAccessoryDispatchChange, buildAccessoryReceiveChange, type AccessoryReceipt } from './accessory-warehouse-commands.ts'
import { buildAccessorySewingTaskScopes } from './accessory-warehouse-task-scope.ts'
import { buildAccessorySewingHandover } from './accessory-warehouse-sewing.ts'
import { resolveInitialOrderRuntimeTaskIdentity } from '../fcs/process-tasks.ts'
import { dispatchTaskSheetFingerprint } from '../fcs/dispatch-task-sheet.ts'
import type { EffectiveTaskAssignment } from '../fcs/effective-task-assignments.ts'
import type { SewingMaterialHandoverContext } from '../fcs/sewing-material-handover.ts'
import type { SewingPickupSlipVersion } from '../fcs/sewing-pickup-slips.ts'
import type { CuttingStoredRecord, CuttingRecordChange } from '../fcs/cutting/cutting-record-repository.ts'

export const ACCESSORY_WORKFLOW_MOCK_VERSION = 'AW-WORKFLOW-20261022-V1'
const at = '2026-10-19 09:00:00'
const action = { at, by: '固定样例仓管' }

/** 固定历史事实，只计算静态基线；不会调用保存、迁移或实际分配动作。 */
export function buildAccessoryWorkflowMockRecords(): CuttingStoredRecord[] {
  const records = new Map<string, CuttingStoredRecord>()
  const put = (kind: Parameters<typeof accessoryRecord>[0], id: string, value: unknown) => {
    const row = accessoryRecord(kind, id, value); records.set(row.id, row)
  }
  const apply = (change: CuttingRecordChange) => { for (const row of change.puts) records.set(row.id, row) }
  const stocks = () => [...records.values()].filter(row => row.collection === 'accessory-warehouse:stock').map(row => row.value as AccessoryStock)
  const versions = () => Object.fromEntries(stocks().map(row => [row.id, row.version]))
  const dispatch = (transfer: AccessoryTransfer) => {
    const result = buildAccessoryDispatchChange({ transfer, stocks: stocks(), actor: { warehouseCode: transfer.fromWarehouse, role: '仓管', name: action.by }, commandId: `MOCK:dispatch:${transfer.id}`, at })
    apply(result.change); return result.transfer
  }
  const receive = (transfer: AccessoryTransfer, receipt: AccessoryReceipt) => {
    const locations = transfer.toWarehouse === 'DLN' ? listAccessoryPostWarehouseLocations() : listAccessoryWarehouseLocations(transfer.toWarehouse!)
    const result = buildAccessoryReceiveChange({ transfer, receipt, stocks: stocks(), locations,
      lines: transfer.lines.map((line, index) => ({ lineId: line.id, qty: line.qty, locationId: locations[index % locations.length].id })),
      actor: { warehouseCode: transfer.toWarehouse!, role: '仓管', name: action.by }, commandId: `MOCK:receive:${transfer.id}`, at })
    apply(result.change); return result.transfer
  }
  const materials = listAccessoryFixtureMaterials()
  for (const scene of ACCESSORY_WORKFLOW_SCENES) {
    const fixture = ACCESSORY_WAREHOUSE_DEMOS.find(row => row.key === scene.key)!
    const order = fixture.order, snapshot = fixture.techPack, preparationId = `prep-order-${order.productionOrderId}`
    const locations = listAccessoryWarehouseLocations(ACCESSORY_GTP_WAREHOUSE)
    let preparation: AccessoryPreparation = {
      id: preparationId, productionOrderId: order.productionOrderId, productionOrderNo: order.productionOrderNo,
      styleName: fixture.demand.spuName, styleImageUrl: fixture.demand.imageUrl, techPackVersion: snapshot.sourceTechPackVersionId,
      cuttingFactoryId: fixture.tasks[0].assignedFactoryId || null, cuttingFactoryName: fixture.tasks[0].assignedFactoryName || null,
      status: '待配料', version: 0, remark: '', history: [],
      lines: snapshot.bomItems.filter(bom => bom.id !== 'AW-BOM-FABRIC').map((bom, index) => ({
        id: `${preparationId}:${snapshot.sourceTechPackVersionId}:${bom.id}`, materialSku: bom.materialCode!, materialName: bom.name,
        imageUrl: bom.materialImageUrl!, color: bom.colorLabel!, spec: bom.spec, unit: bom.unit!,
        purpose: materials[index].purpose, requiresCutting: false, requiredQty: 100 * bom.unitConsumption, preparedQty: 0, availableQty: 0, locationId: locations[index].id,
      })),
    }
    // 独立的固定盘点底稿：每个样例 SKU 600（纽扣1200，线12），从此余额重放历史收发。
    for (const [index, line] of preparation.lines.entries()) {
      const stock: AccessoryStock = { id: getAccessoryStockId(ACCESSORY_GTP_WAREHOUSE, line.locationId, line.materialSku, line.unit),
        warehouseCode: ACCESSORY_GTP_WAREHOUSE, locationId: line.locationId, materialSku: line.materialSku, unit: line.unit,
        onHandQty: [600, 1200, 600, 600, 600, 12][index], reservedQty: 0, version: 0, sourceRefs: [] }
      line.availableQty = stock.onHandQty
      put('stock', stock.id, stock)
    }
    const entries = preparation.lines.map(line => ({ lineId: line.id, qty: line.requiredQty * (scene.stage === '配料中' ? 0.5 : 1), locationId: line.locationId }))
    const reserved = reserveAccessoryPreparationStock(stocks(), preparation, entries, { operationId: `MOCK:reserve:${scene.key}`, expectedVersions: versions() })
    for (const row of reserved.changed) put('stock', row.id, row)
    preparation = registerAccessoryPreparation(preparation, entries, action)
    put('preparation', preparation.id, preparation)
    if (scene.stage === '配料中') continue
    const completed = completeAccessoryPreparation(preparation, { ...action, transferId: `AW-MOCK:${scene.key}:GTP` })
    preparation = completed.preparation
    let transfer = completed.transfer
    put('preparation', preparation.id, preparation)
    put('transfer', transfer.id, transfer)
    const receipt = accessoryReceiptForTransfer(transfer)
    if (receipt) put('receipt', receipt.id, receipt)
    if (scene.stage === '待出库' || scene.stage === '待定调入方') continue
    transfer = dispatch(transfer)
    if (scene.stage === '待收货') continue
    transfer = receive(transfer, receipt!)
    if (scene.stage === '待建领料') continue

    // 沿用原任务生成器身份和派单索引身份，避免平行任务 / 平行实交账。
    const identity = resolveInitialOrderRuntimeTaskIdentity(order.productionOrderId, 'SEW')
    if (!identity) throw new Error('固定辅料样例缺少原车缝任务。')
    const ppic = { ppicId: 'PPIC-ACTIVE-006', ppicName: '陈琳' } // 固定分配时的责任快照，不能随用户档案修改重建历史。
    const assignment: EffectiveTaskAssignment = {
      assignmentId: `ASG-EXISTING-${identity.runtimeTaskId}-${dispatchTaskSheetFingerprint(`ID-F021|${at}`)}`,
      runtimeTaskId: identity.runtimeTaskId, taskNo: identity.taskNo, productionOrderId: order.productionOrderId, productionOrderNo: order.productionOrderNo,
      factoryId: 'ID-F021', factoryName: 'CV Micro Sewing Jakarta Pusat', assignedQty: 100, skuLines: fixture.demand.skuLines,
      ppicId: ppic.ppicId, ppicName: ppic.ppicName, source: 'DIRECT_DISPATCH', status: 'EFFECTIVE', indexedRuntimeSnapshot: true,
      processCodes: ['SEWING'], frozenPrice: 0, priceCurrency: 'IDR', priceUnit: '件', operatedAt: at, businessAssignedAt: at, operatedBy: '固定样例',
    }
    const task = { ...fixture.tasks[1], taskId: identity.runtimeTaskId, taskNo: identity.taskNo }
    const [scope] = buildAccessorySewingTaskScopes(preparation, transfer, { tasks: [task], assignments: [assignment], snapshot, orderSkuLines: fixture.demand.skuLines })
    const pickup = createAccessoryPickup(transfer, { id: `ACCESSORY-PICKUP:${transfer.id}:${assignment.assignmentId}`, ...scope, quantitiesByLine: scope.sewingQuantitiesByLine })
    put('pickup', pickup.id, pickup)
    let post = createAccessoryPostTransfer(transfer, { ...action, id: `ACCESSORY-POST:${transfer.id}:${assignment.assignmentId}`, taskType: scope.taskType, responsibilityKey: scope.taskVersion, quantitiesByLine: scope.postQuantitiesByLine })
    put('transfer', post.id, post)
    const postReceipt: AccessoryReceipt = { id: `ACCESSORY-RECEIPT:${post.id}`, transferId: post.id, warehouseCode: 'DLN', status: '待收货', version: 1, lines: [] }
    put('receipt', postReceipt.id, postReceipt)
    const context: SewingMaterialHandoverContext = { assignmentId: assignment.assignmentId, runtimeTaskId: task.taskId, productionOrderId: order.productionOrderId,
      productionOrderNo: order.productionOrderNo, taskNo: identity.taskNo, factoryId: assignment.factoryId, factoryName: assignment.factoryName,
      ppicId: assignment.ppicId!, ppicName: assignment.ppicName!, snapshotId: snapshot.snapshotId, snapshotVersionLabel: snapshot.versionLabel,
      dataCompleteness: 'COMPLETE', requirementLines: pickup.lines.map(line => {
        const bom = snapshot.bomItems.find(row => row.materialCode === line.materialSku)!
        const requirementLineId = `MAT-REQ-${assignment.assignmentId}-BOM-${bom.id}`
        scope.requirementLineIdByLine[line.id] = requirementLineId
        return { requirementLineId, bomItemId: bom.id, materialType: '辅料', materialCode: line.materialSku, materialName: line.materialName, materialSpec: line.spec,
          unit: line.unit, unitConsumption: bom.unitConsumption, lossRate: 0, assignedGarmentQty: 100, requiredQty: line.qty, imageUrl: line.imageUrl }
      }) }
    put('sewing-context', assignment.assignmentId, { ...context, id: assignment.assignmentId })
    const slipId = `PPIC-PICKUP-${assignment.assignmentId}-ACCESSORY`
    const version: SewingPickupSlipVersion = { slipId, slipNo: `LL-${task.taskNo}-ACC`, versionId: `${slipId}-V1`, versionNo: 1, versionLabel: 'V1', status: 'CURRENT',
      assignmentId: assignment.assignmentId, runtimeTaskId: task.taskId, taskNo: identity.taskNo, productionOrderId: order.productionOrderId, productionOrderNo: order.productionOrderNo,
      taskKindLabel: '独立车缝', factoryId: assignment.factoryId, factoryName: assignment.factoryName, ppicId: assignment.ppicId!, ppicName: assignment.ppicName!,
      warehouseName: scene.site === 'H' ? 'HILON辅料仓' : 'Mahameru辅料仓', objectKind: 'ACCESSORY', styleCode: snapshot.styleCode, styleName: preparation.styleName,
      styleImageUrl: preparation.styleImageUrl, printedAt: at, printedByPpicId: assignment.ppicId!, printedByPpicName: assignment.ppicName!,
      lines: context.requirementLines.map(line => ({ lineId: `PICKUP-LINE-${line.requirementLineId}`, sourceLineId: line.requirementLineId, objectType: '辅料', objectCode: line.materialCode,
        objectName: line.materialName, color: line.materialSpec, size: '不适用', part: '辅料', unit: line.unit, requiredQty: line.requiredQty, previouslyHandedOverQty: 0, availableQty: line.requiredQty, imageUrl: line.imageUrl! })) }
    put('sewing-slip', version.versionId, { ...version, id: version.versionId })
    if (scene.stage === '待领料') continue
    const handed = buildAccessorySewingHandover({ pickup, scope, context, version, stocks: stocks(), entries: pickup.lines.map(line => ({ lineId: line.id, qty: line.requiredQty * (scene.stage === '部分领料' ? 0.4 : 1) })),
      actor: { warehouseCode: pickup.warehouseCode, role: '仓管', name: action.by }, commandId: `MOCK:handover:${scene.key}`, at })
    apply(handed.change)
    post = dispatch(post)
    if (scene.stage === '已完成') receive(post, postReceipt)
  }
  return [...records.values()]
}
