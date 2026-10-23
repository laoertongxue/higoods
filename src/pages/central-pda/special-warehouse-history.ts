import { listProcessActionOperationRecords } from '../../data/fcs/process-action-writeback-service.ts'
import { listProcessHandoverRecords } from '../../data/fcs/process-warehouse-domain.ts'
import { centralWoolCraftContexts, centralWoolCraftOutgoing } from './wool-craft-model.ts'
import { listCentralSpecialOrders, centralUnit } from './special-model.ts'
import { readFactoryPdaExecutionUsers } from '../../data/fcs/store-domain-pda.ts'
import { getFactoryMasterRecordById } from '../../data/fcs/factory-master-store.ts'
import { woolPieceName } from './wool-ui.ts'
import type { CentralPdaLanguage } from './frame.ts'
import { ce, cn, ct, centralFormalName, centralTime } from './ui.ts'

interface Receipt { qty: number; at: string; operatorId?: string; operatorName: string }
export interface CentralSpecialWarehouseHistoryRow {
  id: string; orderNo: string; object: string; qty: number; unit: string; at: string; actorName: string; actorId?: string;
  source?: string; target?: string; woolPiece?: boolean; actualQty?: number; receipts?: Receipt[]
}
/** Read the two existing business sources; do not copy them into another log. */
export function centralSpecialWarehouseHistory(factoryId: string, operationId: string,
  view: 'receiveRecords' | 'handoffRecords', lang: CentralPdaLanguage): CentralSpecialWarehouseHistoryRow[] {
  const ordinary = listCentralSpecialOrders(factoryId, operationId), byId = new Map(ordinary.map(o => [o.taskOrderId, o]))
  const wool = centralWoolCraftContexts(factoryId, operationId)
  const rows: CentralSpecialWarehouseHistoryRow[] = view === 'receiveRecords'
    ? listProcessActionOperationRecords({ sourceType: 'SPECIAL_CRAFT' })
      .filter(r => byId.has(r.sourceId) && r.actionCode === 'SPECIAL_CRAFT_CONFIRM_RECEIVE')
      .map(r => ({ id: r.operationRecordId, orderNo: byId.get(r.sourceId)!.taskOrderNo, object: '',
        qty: r.objectQty, unit: r.qtyUnit, at: r.operatedAt, actorName: r.operatorName, actorId: r.operatorUserId }))
    : listProcessHandoverRecords().filter(r => byId.has(r.workOrderId)).map(r => ({
      id: r.handoverRecordId, orderNo: r.workOrderNo, object: '', qty: r.handoverObjectQty, unit: r.qtyUnit,
      at: r.handoverAt, actorName: r.handoverPerson, actorId: r.operatorUserId,
      target: centralFormalName(r.receiveFactoryName || r.receiveWarehouseName,
        getFactoryMasterRecordById(r.receiveFactoryId || '')?.code || r.receiveFactoryId, lang),
      actualQty: r.receiveAt || r.receiveObjectQty > 0 ? r.receiveObjectQty : undefined,
      receipts: r.receiveAt ? [{ qty: r.receiveObjectQty, at: r.receiveAt, operatorName: r.receivePerson || '' }] : [],
    }))
  for (const c of wool) {
    const object = woolPieceName(c.piece, lang) + ' · ' + c.piece.skuCode
    if (view === 'receiveRecords') for (const row of c.incoming) for (const receipt of row.receipts) rows.push({
      id: JSON.stringify([c.task.taskOrderId, row.key, receipt.id]), orderNo: c.task.taskOrderNo, object,
      qty: receipt.qty, unit: '片', woolPiece: true, at: receipt.at, actorName: receipt.operatorName, actorId: receipt.operatorId,
      source: row.source.documentNo,
    })
    else for (const batch of centralWoolCraftOutgoing(c)) rows.push({
      id: batch.record.recordId, orderNo: c.task.taskOrderNo, object, qty: batch.record.qty, unit: '片', woolPiece: true,
      at: batch.record.operatedAt, actorName: batch.record.operatedBy,
      target: centralFormalName(batch.source?.targetFactoryName, getFactoryMasterRecordById(batch.record.targetFactoryId || '')?.code || batch.record.targetFactoryId || '', lang),
      actualQty: batch.actualQty, receipts: batch.receipts,
    })
  }
  return rows.sort((a, b) => {
    const left = Date.parse(a.at.replace(' ', 'T')), right = Date.parse(b.at.replace(' ', 'T'))
    return (Number.isFinite(left) && Number.isFinite(right) ? right - left : b.at.localeCompare(a.at)) || a.id.localeCompare(b.id)
  })
}
export function renderCentralSpecialWarehouseHistory(rows: CentralSpecialWarehouseHistoryRow[], factoryId: string,
  view: 'receiveRecords' | 'handoffRecords', lang: CentralPdaLanguage, limit: number): string {
  const users = readFactoryPdaExecutionUsers(), actor = (name: string, id?: string) => centralFormalName(name,
    users.find(u => id ? u.userId === id : u.name === name)?.loginId || id || name, lang)
  return rows.slice(0, limit).map(r => {
    const unit = r.woolPiece && lang === 'id' ? 'potong' : centralUnit(r.unit, lang), received = r.actualQty
    return `<article data-central-warehouse-record class="my-3 space-y-2 rounded-xl border bg-white p-3"><strong class="block break-words">${ce(r.orderNo)}</strong>${r.object ? `<p class="break-words">${ce(r.object)}</p>` : ''}
      <p class="text-lg font-bold">${view === 'handoffRecords' ? ct(lang, 'handed') + ' · ' : ''}${cn(r.qty, lang)} ${ce(unit)}</p>
      ${r.source ? `<p class="break-words">${ct(lang, 'source')} · ${ce(r.source)}</p>` : ''}${r.target ? `<p class="break-words">${ct(lang, 'target')} · ${ce(r.target)}</p>` : ''}
      <p class="break-words">${ct(lang, view === 'receiveRecords' ? 'receiver' : 'sender')} · ${ce(actor(r.actorName, r.actorId))}</p><p>${centralTime(r.at, lang)}</p>
      ${view === 'handoffRecords' ? `<p>${received === undefined ? ct(lang, 'awaiting') : ct(lang, 'actual') + ' · ' + cn(received, lang) + ' ' + ce(unit)}</p>
      ${received !== undefined && received < r.qty ? `<p>${ct(lang, 'awaiting')} · ${cn(r.qty - received, lang)} ${ce(unit)}</p>` : ''}
      ${(r.receipts || []).slice(0, limit).map(p => `<p class="break-words text-sm">${ct(lang, 'receiver')} · ${ce(actor(p.operatorName, p.operatorId))} · ${cn(p.qty, lang)} ${ce(unit)} · ${centralTime(p.at, lang)}</p>`).join('')}` : ''}</article>`
  }).join('')
}
