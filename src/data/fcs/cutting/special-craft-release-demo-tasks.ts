import type { ProcessTask } from '../process-tasks.ts'
import type { ProductionOrder } from '../production-orders.ts'
import type { TechPackCutPiecePartSnapshot } from '../production-tech-pack-snapshot-types.ts'

/** 具名原型示例：提供待分配任务；完成、交出及回仓均须由正常页面另行登记。 */
export function buildSpecialCraftReleaseDemoTasks(
  order: ProductionOrder | undefined,
  parts: readonly TechPackCutPiecePartSnapshot[],
): ProcessTask[] {
  if (order?.productionOrderId !== 'PO-202603-0002' || order.status === 'CANCELLED' || !order.techPackSnapshot) return []
  const part = parts.find(row => row.partCode === 'tdv_demand_SPU_2024_005-pattern-main-back')
  const crafts = part?.specialCrafts || []
  if (!part || crafts.length !== 2 || crafts[0].craftCode !== 'CRAFT_000032' || crafts[1].craftCode !== 'CRAFT_3000002'
    || crafts.some(craft => craft.selectedTargetObject !== '已裁部位')) return []
  const skuLines = order.demandSnapshot.skuLines.filter(line => part.applicableColorList.includes(line.color) && part.applicableSizeList.includes(line.size))
  const qty = skuLines.reduce((sum, line) => sum + line.qty, 0)
  if (!skuLines.length || !Number.isSafeInteger(qty) || qty <= 0) return []
  return crafts.map((craft, index) => {
    const taskId = `SC-RELEASE-DEMO-0002-${index + 1}`
    const sourceEntryId = `${order.techPackSnapshot!.sourceTechPackVersionId}:${part.partCode}:${craft.craftCode}`
    const detailRows = skuLines.map(line => ({ rowKey: `${taskId}:${line.skuCode}`, taskId, rowType: 'COMPOSITE' as const,
      rowLabel: `${part.partNameCn} · ${line.color} / ${line.size}`, qty: line.qty, uom: '片',
      dimensions: { GARMENT_COLOR: line.color, GARMENT_SKU: line.skuCode, MATERIAL_SKU: part.materialSku },
      sourceRefs: { orderId: order.productionOrderId, spuCode: order.demandSnapshot.spuCode, processCode: craft.processCode,
        sourceEntryId, craftCode: craft.craftCode, bomItemId: part.materialSku, pieceIds: [part.partCode], garmentSku: line.skuCode, garmentColor: line.color },
      sortKey: line.skuCode }))
    return { taskId, taskNo: taskId, productionOrderId: order.productionOrderId, productionOrderNo: order.productionOrderNo,
      sourceType: 'PRODUCTION_ORDER', sourceSnapshot: { sourceType: 'PRODUCTION_ORDER', productionOrderId: order.productionOrderId,
        productionOrderNo: order.productionOrderNo, techPackVersionId: order.techPackSnapshot!.sourceTechPackVersionId,
        techPackVersionLabel: order.techPackSnapshot!.versionLabel, processEntryId: sourceEntryId, bomItemId: part.materialSku },
      seq: 90 + index, processCode: craft.processCode, processNameZh: craft.craftName, craftCode: craft.craftCode, craftName: craft.craftName,
      selectedTargetObject: '已裁部位', stage: 'SPECIAL', stageCode: 'PROD', stageName: '生产',
      processBusinessCode: craft.processCode, processBusinessName: craft.craftName,
      qty, qtyUnit: 'PIECE', qtyDisplayUnit: '片', taskTypeLabel: `${craft.craftName}裁片任务（示例）`,
      scopeLabel: `${part.partNameCn} · 连续工艺示例`, assignmentMode: 'DIRECT', assignmentStatus: 'UNASSIGNED',
      ownerSuggestion: { kind: 'RECOMMENDED_FACTORY_POOL' }, qcPoints: [], attachments: [], status: 'NOT_STARTED',
      dependsOnTaskIds: index ? ['SC-RELEASE-DEMO-0002-1'] : [], taskKind: 'NORMAL', taskUnitType: 'SINGLE_PROCESS_TASK',
      sourceEntryId, sourceEntryIds: [sourceEntryId], sourceEntryType: 'CRAFT', inputObjectType: 'CUT_PIECE', outputObjectType: 'CUT_PIECE',
      assignmentGranularity: 'ORDER', detailRows, detailRowKeys: detailRows.map(row => row.rowKey),
      defaultDocType: 'TASK', taskTypeMode: 'CRAFT', isSpecialCraft: true, allowAutoDispatch: false, executionEnabled: true,
      createdAt: '2026-10-09 08:00:00', updatedAt: '2026-10-09 08:00:00', auditLogs: [] }
  })
}
