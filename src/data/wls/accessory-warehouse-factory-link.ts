import type { CuttingStoredRecord, CuttingRecordChange } from '../fcs/cutting/cutting-record-repository.ts'
import type { RuntimeProcessTask } from '../fcs/runtime-process-tasks.ts'
import type { EffectiveTaskAssignment } from '../fcs/effective-task-assignments.ts'
import { planAccessoryCuttingFactoryChange, type AccessoryPreparation, type AccessoryTransfer, type AccessoryPickup, type AccessoryReassignment } from './accessory-warehouse-flow.ts'
import { accessoryRecord, ACCESSORY_RECORD_PREFIX } from './accessory-warehouse-records.ts'
import { accessoryReceiptForTransfer, type AccessoryReceipt } from './accessory-warehouse-commands.ts'
import type { SewingPickupSlipVersion } from '../fcs/sewing-pickup-slips.ts'

/** 由原生产分配保存动作提供同库快照；这里不写库，不在打开页面时补单。 */
export function buildAccessoryFactoryLinkChange(input: {
  records: CuttingStoredRecord[]; tasks: RuntimeProcessTask[]; assignments: EffectiveTaskAssignment[];
  factories: Array<{ id: string; name: string }>; commandId: string; at: string; by: string
}): CuttingRecordChange {
  const rows = <T>(kind: string) => input.records.filter(row => row.collection === `${ACCESSORY_RECORD_PREFIX}${kind}`).map(row => row.value as T)
  const transfers = rows<AccessoryTransfer>('transfer'), receipts = rows<AccessoryReceipt>('receipt')
  const pickups = rows<AccessoryPickup>('pickup'), changes = rows<AccessoryReassignment>('change')
  const puts: CuttingStoredRecord[] = []
  for (const preparation of rows<AccessoryPreparation>('preparation')) {
    const tasks = input.tasks.filter(task => task.productionOrderId === preparation.productionOrderId && task.executionEnabled !== false
      && !task.isSplitSource && !task.mergedIntoTaskId && ['CUT', 'CUTTING', 'CUT_PANEL'].includes(task.processBusinessCode || task.processCode))
    if (!tasks.length) continue
    const ids = new Set<string>()
    let pending = false
    for (const task of tasks) {
      const history = input.assignments.filter(assignment => assignment.runtimeTaskId === task.taskId)
      const current = history.filter(assignment => assignment.status === 'EFFECTIVE')
      if (history.length) { if (!current.length) pending = true; current.forEach(assignment => ids.add(assignment.factoryId)) }
      else if (['ASSIGNED', 'AWARDED'].includes(task.assignmentStatus) && task.assignedFactoryId) ids.add(task.assignedFactoryId)
      else pending = true
    }
    if (pending || !ids.size) continue
    if (ids.size !== 1) throw new Error('同一生产单的裁剪任务有多个承接工厂，辅料整单去向无法确定。')
    const factory = input.factories.find(factory => factory.id === [...ids][0])
    if (!factory) throw new Error('裁剪工厂档案缺失，辅料去向未更新。')
    if (preparation.cuttingFactoryId === factory.id && preparation.cuttingFactoryName === factory.name) continue
    const existingChanges = changes.filter(change => change.sourceTransferId && transfers.some(transfer => transfer.preparationId === preparation.id && transfer.id === change.sourceTransferId))
    const related = transfers.filter(transfer => transfer.preparationId === preparation.id && transfer.kind !== 'SITE_TO_POST')
    const leaves = related.filter(transfer => transfer.status !== '已作废' && !related.some(next => next.sourceTransferId === transfer.id && next.kind === 'SITE_REASSIGN' && next.status !== '已作废'))
    if (leaves.length > 1) throw new Error('辅料存在多条当前流转，请核对后再改厂。')
    const current = leaves[0] || null
    if (existingChanges.some(change => change.status === '等待原仓收货' && !related.some(transfer => transfer.changeId === change.id))) {
      throw new Error('原仓尚待收货，已有改厂调拨安排。先完成当前流转后再办理下一次改厂。')
    }
    const releasedQtyByLine: Record<string, number> = {}
    for (const legacy of rows<{ id: string; kind?: string; field?: string; entry?: { prepOrderId?: string; pickedQty?: number } }>('migration')) {
      if (legacy.kind === 'LEGACY_ENTRY' && legacy.field === 'pickupRecords' && legacy.entry?.prepOrderId === preparation.id) releasedQtyByLine[`legacy:${legacy.id}`] = Number(legacy.entry.pickedQty || 0)
    }
    const sewingContexts = rows<{ assignmentId: string; productionOrderId: string; requirementLines: Array<{ requirementLineId: string; materialType: string }> }>('sewing-context')
    for (const event of rows<{ id: string; assignmentId: string; lines: Array<{ requirementLineId: string; actualQty: number }> }>('sewing-handover')) {
      const context = sewingContexts.find(row => row.assignmentId === event.assignmentId && row.productionOrderId === preparation.productionOrderId)
      if (context) for (const line of event.lines.filter(line => context.requirementLines.some(requirement => requirement.requirementLineId === line.requirementLineId && requirement.materialType === '辅料'))) releasedQtyByLine[`sewing:${event.id}:${line.requirementLineId}`] = line.actualQty
    }
    for (const pickup of pickups.filter(row => row.preparationId === preparation.id)) for (const line of pickup.lines) releasedQtyByLine[`pickup:${pickup.id}:${line.id}`] = line.handedQty
    for (const transfer of transfers.filter(row => row.preparationId === preparation.id && row.kind === 'SITE_TO_POST' && ['已出库待收货', '已收货'].includes(row.status))) {
      for (const line of transfer.lines) releasedQtyByLine[`post:${transfer.id}:${line.id}`] = line.qty
    }
    const changedTask = tasks.find(task => task.assignedFactoryId === factory.id) || tasks[0]
    const reason = [...(changedTask.auditLogs || [])].reverse().find(log => log.action === 'CUTTING_REASSIGN')?.detail
      || changedTask.dispatchRemark || '裁剪任务分配确定辅料调入方'
    const action = { at: input.at, by: input.by, reason, changeId: `AW-CHANGE:${input.commandId}:${preparation.id}`,
      transferId: `AW-REASSIGN:${input.commandId}:${preparation.id}`, newFactoryId: factory.id, newFactoryName: factory.name, releasedQtyByLine }
    const plan = planAccessoryCuttingFactoryChange(preparation, current, action)
    puts.push(accessoryRecord('preparation', preparation.id, plan.preparation))
    if (plan.currentTransfer && plan.currentTransfer !== current) puts.push(accessoryRecord('transfer', plan.currentTransfer.id, plan.currentTransfer))
    const newTransfer = plan.onwardTransfer || (plan.mode === 'UPDATE_DESTINATION' ? plan.currentTransfer : null)
    const newReceipt = newTransfer ? accessoryReceiptForTransfer(newTransfer) : undefined
    if (plan.cancelledReceipt) {
      for (const old of receipts.filter(receipt => receipt.transferId === plan.cancelledReceipt!.transferId && receipt.warehouseCode === plan.cancelledReceipt!.warehouseCode && receipt.status === '待收货')) {
        puts.push(accessoryRecord('receipt', old.id, { ...old, status: '已取消', version: old.version + 1, cancelledAt: input.at,
          cancellationReason: reason, replacedByReceiptId: newReceipt?.id }))
      }
    }
    if (plan.reassignment) puts.push(accessoryRecord('change', plan.reassignment.id, plan.reassignment))
    if (plan.onwardTransfer) puts.push(accessoryRecord('transfer', plan.onwardTransfer.id, plan.onwardTransfer))
    if (newReceipt) puts.push(accessoryRecord('receipt', newReceipt.id, newReceipt))
    if (!['NO_TRANSFER', 'UNCHANGED_DESTINATION'].includes(plan.mode)) {
      for (const slip of rows<SewingPickupSlipVersion & { id: string }>('sewing-slip').filter(row => row.productionOrderId === preparation.productionOrderId && row.status === 'CURRENT')) {
        puts.push(accessoryRecord('sewing-slip', slip.id, { ...slip, status: 'VOIDED', voidedAt: input.at }))
      }
      for (const pickup of pickups.filter(row => row.preparationId === preparation.id && row.status !== '已失效')) {
        puts.push(accessoryRecord('pickup', pickup.id, { ...pickup, status: '已失效', version: pickup.version + 1,
          history: [...pickup.history, { at: input.at, by: input.by, action: '改厂清单失效', detail: reason }] }))
      }
      for (const post of transfers.filter(row => row.preparationId === preparation.id && row.kind === 'SITE_TO_POST' && row.status === '待出库')) {
        puts.push(accessoryRecord('transfer', post.id, { ...post, status: '已作废', version: post.version + 1,
          history: [...post.history, { at: input.at, by: input.by, action: '改厂未出调拨作废', detail: reason }] }))
        for (const receipt of receipts.filter(row => row.transferId === post.id && row.status === '待收货')) puts.push(accessoryRecord('receipt', receipt.id,
          { ...receipt, status: '已取消', version: receipt.version + 1, cancelledAt: input.at, cancellationReason: reason }))
      }
    }
    puts.push(accessoryRecord('audit', action.changeId, { ...action, id: action.changeId, commandId: input.commandId, mode: plan.mode, preparationId: preparation.id }))
  }
  return { puts }
}
