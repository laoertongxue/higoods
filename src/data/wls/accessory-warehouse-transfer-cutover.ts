import { accessoryRecord, ensureAccessoryWarehouseRecords, listAccessoryRecords, saveAccessoryWarehouseAction } from './accessory-warehouse-records.ts'
import { completeAccessoryPreparation, type AccessoryPreparation, type AccessoryTransfer } from './accessory-warehouse-flow.ts'
import { accessoryReceiptForTransfer } from './accessory-warehouse-commands.ts'
import type { CuttingRecordChange } from '../fcs/cutting/cutting-record-repository.ts'

/** 显式阶段切换，仅处理已保存的完成记录；不复制静态演示单，不补造历史预留。 */
export function buildCompletedAccessoryTransferCutover(preparations: AccessoryPreparation[], transfers: AccessoryTransfer[], action: { at: string; by: string }): { change: CuttingRecordChange; created: string[] } {
  const puts: CuttingRecordChange['puts'] = [], created: string[] = []
  for (const preparation of preparations.filter(row => row.status === '已配齐')) {
    const prior = transfers.filter(row => row.kind === 'GTP_TO_SITE' && row.preparationId === preparation.id)
    if (prior.length > 1) throw new Error('同一已配齐记录存在多张首次调拨，切换已停止，原记录保留。')
    if (prior.length) continue
    const completed = completeAccessoryPreparation(preparation, { ...action, transferId: `GTP-CUTOVER:${preparation.id}:V${preparation.completionVersion ?? preparation.version}` })
    const receipt = accessoryReceiptForTransfer(completed.transfer)
    puts.push(accessoryRecord('transfer', completed.transfer.id, completed.transfer))
    if (receipt) puts.push(accessoryRecord('receipt', receipt.id, receipt))
    puts.push(accessoryRecord('audit', `CUTOVER:${completed.transfer.id}`, { id: `CUTOVER:${completed.transfer.id}`, preparationId: preparation.id,
      originalCompletedAt: preparation.completedAt, originalCompletedBy: preparation.completedBy, at: action.at, by: action.by, action: '历史已配齐调拨补建' }))
    created.push(completed.transfer.id)
  }
  return { change: { puts }, created }
}

export async function migrateCompletedAccessoryPreparationTransfers(input: { commandId: string; at: string; operator: string }): Promise<string[]> {
  await ensureAccessoryWarehouseRecords()
  const result = buildCompletedAccessoryTransferCutover(listAccessoryRecords<AccessoryPreparation>('preparation'), listAccessoryRecords<AccessoryTransfer>('transfer'), { at: input.at, by: input.operator })
  if (!result.created.length) return []
  return saveAccessoryWarehouseAction({ commandId: input.commandId, intent: 'explicit-completed-transfer-cutover-v1', result: result.created, change: result.change })
}
