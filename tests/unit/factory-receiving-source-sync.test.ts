import assert from 'node:assert/strict'
import test from 'node:test'
import { syncFactoryReceivingWarehouseSources } from '../../src/data/fcs/factory-receiving-source-sync.ts'
import { getFactoryReceivingSource, listFactoryReceivingSources } from '../../src/data/fcs/factory-receiving.ts'
import { listWaterSolubleWorkOrders } from '../../src/data/fcs/water-soluble-task-domain.ts'
import {
  buildWarehouseExecutionDocumentSnapshot,
  type WarehouseExecutionDoc,
  type WarehouseInternalTransferOrder,
  type WarehouseReturnOrder,
} from '../../src/data/fcs/warehouse-material-execution.ts'

test('warehouse receiving accepts issue/transfer facts, excludes returns and preserves actual quantities', () => {
  const target = listWaterSolubleWorkOrders().find(order => order.productionOrderId === 'PO-202603-081')
  const original = buildWarehouseExecutionDocumentSnapshot().issueOrders.find(doc => doc.id === 'ISSUE-WATER-PO-202603-087')
  assert(target)
  assert(original)
  const issue = structuredClone(original)
  issue.id = 'TYPECHECK-SYNC-ISSUE'
  issue.docNo = issue.id
  issue.productionOrderId = target.productionOrderId
  issue.baseTaskId = issue.runtimeTaskId = target.taskId
  issue.taskNo = target.taskNo
  issue.lines = issue.lines.map(line => ({ ...line, docId: issue.id, lineId: `${issue.id}-L1`, issuedQty: 7 }))
  const transfer: WarehouseInternalTransferOrder = {
    ...issue, id: 'TYPECHECK-SYNC-TRANSFER', docNo: 'TYPECHECK-SYNC-TRANSFER', docType: 'INTERNAL_TRANSFER',
    lines: issue.lines.map(line => ({ ...line, docId: 'TYPECHECK-SYNC-TRANSFER', lineId: 'TYPECHECK-SYNC-TRANSFER-L1', transferredQty: 11 })),
  }
  const returned: WarehouseReturnOrder = {
    ...issue, id: 'TYPECHECK-SYNC-RETURN', docNo: 'TYPECHECK-SYNC-RETURN', docType: 'RETURN',
    lines: issue.lines.map(line => ({ ...line, docId: 'TYPECHECK-SYNC-RETURN', lineId: 'TYPECHECK-SYNC-RETURN-L1', returnedQty: 99 })),
  }
  const unapproved = { ...issue, id: 'TYPECHECK-SYNC-UNAPPROVED', approvedAt: undefined }
  const documents: WarehouseExecutionDoc[] = [returned, issue, unapproved, transfer]
  const before = structuredClone(documents)

  syncFactoryReceivingWarehouseSources(documents)
  assert.equal(getFactoryReceivingSource(`UPSTREAM-${issue.id}`)?.lines[0].sentQty, 7)
  assert.equal(getFactoryReceivingSource(`UPSTREAM-${transfer.id}`)?.lines[0].sentQty, 11)
  assert.equal(getFactoryReceivingSource(`UPSTREAM-${returned.id}`), undefined)
  assert.equal(getFactoryReceivingSource(`UPSTREAM-${unapproved.id}`), undefined)
  assert.deepEqual(documents, before)

  syncFactoryReceivingWarehouseSources(documents)
  syncFactoryReceivingWarehouseSources([returned])
  syncFactoryReceivingWarehouseSources([])
  const synced = listFactoryReceivingSources().filter(source => source.id.startsWith('UPSTREAM-TYPECHECK-SYNC-'))
  assert.equal(synced.length, 2, 'repeated reads and return-only snapshots must not create another shipment')
  assert.equal(synced.reduce((sum, source) => sum + source.lines[0].sentQty, 0), 18)
})
