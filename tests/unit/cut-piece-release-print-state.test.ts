import test from 'node:test'
import assert from 'node:assert/strict'
import { projectReleaseTicketPrintState } from '../../src/data/fcs/cutting/release-ticket-print-state.ts'
import type { GeneratedFeiTicketSourceRecord } from '../../src/data/fcs/cutting/generated-fei-tickets.ts'
import { buildGeneratedCutReleaseInputs } from '../../src/data/fcs/cutting/generated-cut-release.ts'
import type { GeneratedCutOrderSourceRecord } from '../../src/data/fcs/cutting/generated-cut-orders.ts'

const ticket = {
  feiTicketId: 'actual-ticket', feiTicketNo: 'FP-A', sourceBasisType: 'ACTUAL_CUTTING_OUTPUT',
  productionOrderId: 'PO-A', cutOrderId: 'CUT-A', sourceSpreadingSessionId: 'PB-A', sourceOutputLineId: 'OUTPUT-A',
  skuCode: 'SKU-S', skuColor: 'Black', skuSize: 'S', fabricColor: 'Black', materialSku: 'FAB-A', qrValue: 'CURRENT-TICKET-QR',
  partCode: 'SLEEVE', partInstanceNo: '1', actualCutPieceQty: 5, printStatus: 'WAIT_PRINT',
} as GeneratedFeiTicketSourceRecord
const printed = { ...ticket, ticketRecordId: ticket.feiTicketId, ticketNo: ticket.feiTicketNo, quantity: 5, status: 'PRINTED', printStatus: 'PRINTED' }

test('C01.12a: a formal print activates only its exact current source and never mutates generated facts', () => {
  assert.equal(projectReleaseTicketPrintState([ticket], [printed])[0].printStatus, 'PRINTED')
  assert.equal(ticket.printStatus, 'WAIT_PRINT')
  assert.equal(projectReleaseTicketPrintState([ticket], [])[0].printStatus, 'WAIT_PRINT')
  for (const patch of [
    { productionOrderId: 'OTHER' }, { cutOrderId: 'OTHER' }, { sourceSpreadingSessionId: 'OTHER' },
    { sourceOutputLineId: 'OTHER' }, { skuCode: 'OTHER' }, { partCode: 'OTHER' }, { partInstanceNo: '2' },
    { skuColor: 'OTHER' }, { skuSize: 'OTHER' }, { fabricColor: 'OTHER' }, { materialSku: 'OTHER' }, { qrValue: 'OLD-QR' },
    { ticketNo: 'OTHER' }, { sourceBasisType: 'MANUAL_MARKER_PLAN' }, { actualCutPieceQty: 6 }, { quantity: 6 },
  ]) assert.equal(projectReleaseTicketPrintState([ticket], [{ ...printed, ...patch }])[0].printStatus, 'WAIT_PRINT')
})

test('C01.12a: voided current or formal tickets cannot be revived by a prior print', () => {
  assert.equal(projectReleaseTicketPrintState([{ ...ticket, printStatus: 'VOIDED' }], [printed])[0].printStatus, 'VOIDED')
  assert.equal(projectReleaseTicketPrintState([ticket], [{ ...printed, status: 'VOIDED' }])[0].printStatus, 'VOIDED')
  assert.equal(projectReleaseTicketPrintState([ticket], [{ ...printed, printStatus: 'REPRINTED' }])[0].printStatus, 'REPRINTED')
})

test('C01.12a: formal print and reprint activate the initial order, without counting unbagged output as released pieces', () => {
  const source = {
    productionOrderId: 'PO-A', productionOrderNo: 'PO-A', cutOrderId: 'CUT-A', cutOrderNo: 'CUT-A',
    spuCode: 'SPU-A', styleName: 'source', materialSku: 'FAB-A', materialName: 'fabric', sourceBomItemIds: [],
    skuScopeLines: [{ skuCode: 'SKU-S', color: 'Black', size: 'S', plannedQty: 5 }],
    pieceRows: [{ partCode: 'SLEEVE', partName: 'sleeve', pieceCountPerUnit: 1, applicableSkuCodes: [] }],
  } as unknown as GeneratedCutOrderSourceRecord
  const scope = { initialOrderIds: new Set(['PO-A']) }
  const read = (records: Record<string, unknown>[]) => buildGeneratedCutReleaseInputs([source], [], {
    tickets: projectReleaseTicketPrintState([ticket], records), details: [],
  }, scope)
  assert.equal(read([]).length, 0)
  for (const printStatus of ['PRINTED', 'REPRINTED']) {
    const result = read([{ ...printed, printStatus }])
    assert.equal(result.length, 1)
    assert.equal(result[0].input.facts.length, 0)
    assert.equal(result[0].input.planQtyByColorSize.Black.S, 5)
  }
  assert.equal(read([{ ...printed, quantity: 6 }]).length, 0)
})
