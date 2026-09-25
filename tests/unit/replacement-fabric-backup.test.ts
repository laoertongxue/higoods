import test from 'node:test'
import assert from 'node:assert/strict'
import { validateCuttingRecordBackup, type CuttingRecordBackup } from '../../src/data/fcs/cutting/cutting-record-repository.ts'

function backup(): CuttingRecordBackup {
  const ticket = { id: 'HPB-test', ticketNo: 'HPB/PO/A/001', productionOrderId: 'PO', productionOrderNo: 'PO', cuttingFactoryId: 'CUT', assignmentKey: 'ASSIGN', material: { key: '["A","蓝"]', code: 'A', name: '面料 A', color: '蓝', imageUrl: '/a.png', skuCodes: ['SKU-A'] }, sequence: 1, length: 5, unit: 'Yard', createdAt: '2026-09-25', createdBy: '仓管', creationCommandId: 'create' }
  return {format:'higood-cutting-record-backup',version:1,exportedAt:'2026-09-25',commands:[],files:[],records:[
    {id:'replacement-tickets:HPB-test',collection:'replacement-tickets',value:ticket},
    {id:'replacement-prints:print',collection:'replacement-prints',value:{id:'print',ticketId:ticket.id,commandId:'print',printedAt:'2026-09-25',printedBy:'仓管'}},
    {id:'cutting-event:event',collection:'cutting-events',value:{eventId:'event',eventType:'简易裁片交出',refs:{handoverRecordId:'handover'},payload:{}}},
    {id:'replacement-receipts:receipt',collection:'replacement-receipts',value:{id:'receipt',ticket:structuredClone(ticket),taskId:'task',receiverFactoryId:'factory',handoverRecordId:'handover'}}
  ]}
}

test('备份恢复不能借原票编号伪造另一种面料的交出回执',()=>{
  const original=backup();assert.doesNotThrow(()=>validateCuttingRecordBackup(original))
  const tampered=structuredClone(original)
  const receipt=tampered.records[3].value as {ticket:{material:{code:string;key:string}}}
  receipt.ticket.material.code='B';receipt.ticket.material.key='["B","蓝"]'
  assert.throws(()=>validateCuttingRecordBackup(tampered),/原票.*不一致/)
})
